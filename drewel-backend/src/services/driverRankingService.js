import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import DriverRanking from "../models/DriverRanking.js";
import Ride from "../models/Ride.js";

const PLATFORM_AVERAGE_RATING = 4.5;
const MIN_REVIEWS_FOR_CONFIDENCE = 10;
const BAYESIAN_M = MIN_REVIEWS_FOR_CONFIDENCE;

const WEIGHTS = {
  ratingQuality: 0.40,
  completedTrips: 0.20,
  completionRate: 0.15,
  cancellationBehavior: 0.10,
  recentPerformance: 0.10,
  accountQuality: 0.05,
};

const normalizeToScore = (value, max) => Math.min(100, Math.max(0, (value / max) * 100));

const computeWeightedRating = (averageRating, reviewCount) => {
  const v = reviewCount;
  const R = averageRating || 0;
  const C = PLATFORM_AVERAGE_RATING;
  const m = BAYESIAN_M;
  return ((v / (v + m)) * R) + ((m / (v + m)) * C);
};

const computeCancellationRate = (totalRides, cancelledByDriver) => {
  if (totalRides === 0) return 0;
  return (cancelledByDriver / totalRides) * 100;
};

const computeCompletionRate = (totalRides, completedRides) => {
  if (totalRides === 0) return 100;
  return (completedRides / totalRides) * 100;
};

const computeRecentPerformance = (recentRatings) => {
  if (!recentRatings || recentRatings.length === 0) return 50;
  const avg = recentRatings.reduce((sum, r) => sum + r, 0) / recentRatings.length;
  return (avg / 5) * 100;
};

export const recalculateDriverRanking = async (driverId) => {
  const driver = await Driver.findById(driverId).select(
    "firstName lastName fullName rating isApproved status profileRequestStatus profileImageUrl"
  ).lean();
  if (!driver) return null;

  const [
    completedTripsResult,
    cancelledByDriverResult,
    totalRidesResult,
    reviewCountResult,
    averageRatingResult,
    recentRatingsResult,
  ] = await Promise.all([
    Ride.countDocuments({
      driverId: new mongoose.Types.ObjectId(String(driverId)),
      status: "completed",
    }),
    Ride.countDocuments({
      driverId: new mongoose.Types.ObjectId(String(driverId)),
      status: "cancelled_by_driver",
    }),
    Ride.countDocuments({
      driverId: new mongoose.Types.ObjectId(String(driverId)),
      status: { $in: ["completed", "cancelled", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"] },
    }),
    Ride.countDocuments({
      driverId: new mongoose.Types.ObjectId(String(driverId)),
      "reviews.passenger.rating": { $gte: 1, $lte: 5 },
    }),
    Ride.aggregate([
      {
        $match: {
          driverId: new mongoose.Types.ObjectId(String(driverId)),
          "reviews.passenger.rating": { $gte: 1, $lte: 5 },
        },
      },
      {
        $group: {
          _id: "$driverId",
          avg: { $avg: "$reviews.passenger.rating" },
        },
      },
    ]),
    Ride.find({
      driverId: new mongoose.Types.ObjectId(String(driverId)),
      "reviews.passenger.rating": { $gte: 1, $lte: 5 },
    })
      .sort({ "reviews.passenger.submittedAt": -1 })
      .limit(20)
      .select("reviews.passenger.rating")
      .lean(),
  ]);

  const completedTrips = completedTripsResult || 0;
  const cancelledByDriver = cancelledByDriverResult || 0;
  const totalRides = totalRidesResult || 0;
  const totalReviews = reviewCountResult || 0;
  const averageRating = averageRatingResult?.[0]?.avg || 0;
  const recentRatings = recentRatingsResult
    .map((r) => r.reviews?.passenger?.rating)
    .filter(Boolean);

  const completionRate = computeCompletionRate(totalRides, completedTrips);
  const cancellationRate = computeCancellationRate(totalRides, cancelledByDriver);
  const weightedRating = computeWeightedRating(averageRating, totalReviews);
  const recentPerformance = computeRecentPerformance(recentRatings);

  const isVerified = driver.isApproved === true &&
    (driver.status === "approved" || driver.status === "completed");
  const hasValidDocuments = driver.profileRequestStatus === "approved";

  const ratingScore = (weightedRating / 5) * 100;
  const tripScore = normalizeToScore(Math.log10(completedTrips + 1) / Math.log10(10000), 100);
  const completionScore = completionRate;
  const cancellationScore = 100 - cancellationRate;
  const accountScore = (isVerified ? 50 : 0) + (hasValidDocuments ? 50 : 0);

  const rankingScore =
    ratingScore * WEIGHTS.ratingQuality +
    tripScore * WEIGHTS.completedTrips +
    completionScore * WEIGHTS.completionRate +
    cancellationScore * WEIGHTS.cancellationBehavior +
    recentPerformance * WEIGHTS.recentPerformance +
    accountScore * WEIGHTS.accountQuality;

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const ranking = await DriverRanking.findOneAndUpdate(
    { driverId: driver._id },
    {
      $set: {
        weightedRating: Math.round(weightedRating * 100) / 100,
        completedTrips,
        totalReviews,
        completionRate: Math.round(completionRate * 10) / 10,
        cancellationRate: Math.round(cancellationRate * 10) / 10,
        acceptanceRate: 100,
        recentPerformanceScore: Math.round(recentPerformance * 10) / 10,
        rankingScore: Math.round(rankingScore * 100) / 100,
        isVerified,
        hasValidDocuments,
        lastCalculatedAt: now,
        month,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: { driverId: driver._id } }
  );

  return ranking;
};

export const recalculateAllRankings = async () => {
  const drivers = await Driver.find({
    status: { $in: ["approved", "completed"] },
    isApproved: true,
    isRestricted: { $ne: true },
    isDeleted: { $ne: true },
  })
    .select("_id")
    .lean();

  const batchSize = 50;
  for (let i = 0; i < drivers.length; i += batchSize) {
    const batch = drivers.slice(i, i + batchSize);
    await Promise.all(
      batch.map((d) => recalculateDriverRanking(d._id).catch(() => null))
    );
  }

  await assignRankingPositions();
};

export const assignRankingPositions = async (month) => {
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const rankings = await DriverRanking.find({ month: targetMonth })
    .sort({ rankingScore: -1 })
    .select("_id")
    .lean();

  const bulkOps = rankings.map((r, index) => ({
    updateOne: {
      filter: { _id: r._id },
      update: { $set: { rankingPosition: index + 1 } },
    },
  }));

  if (bulkOps.length > 0) {
    await DriverRanking.bulkWrite(bulkOps);
  }
};

export const getTopDrivers = async ({ month, limit = 20, offset = 0 } = {}) => {
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const rankings = await DriverRanking.find({ month: targetMonth })
    .sort({ rankingScore: -1 })
    .skip(offset)
    .limit(limit)
    .populate("driverId", "firstName lastName fullName profileImageUrl vehicleType vehicleModel rating isVerified")
    .lean();

  return rankings
    .filter((r) => r.driverId)
    .map((r, index) => ({
      position: r.rankingPosition || offset + index + 1,
      driver: {
        id: String(r.driverId._id),
        firstName: r.driverId.firstName || "",
        lastName: r.driverId.lastName || "",
        fullName: r.driverId.fullName || [r.driverId.firstName, r.driverId.lastName].filter(Boolean).join(" "),
        profileImageUrl: r.driverId.profileImageUrl || "",
        vehicleType: r.driverId.vehicleType || "",
        vehicleModel: r.driverId.vehicleModel || "",
        rating: r.driverId.rating ?? null,
        isVerified: r.driverId.isVerified || false,
      },
      ranking: {
        weightedRating: r.weightedRating,
        completedTrips: r.completedTrips,
        totalReviews: r.totalReviews,
        completionRate: r.completionRate,
        rankingScore: r.rankingScore,
      },
    }));
};

export const getDriverRanking = async (driverId) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let ranking = await DriverRanking.findOne({
    driverId,
    month: currentMonth,
  }).lean();

  if (!ranking) {
    ranking = await recalculateDriverRanking(driverId);
    if (ranking) ranking = ranking.toObject ? ranking.toObject() : ranking;
  }

  return ranking;
};

export const getDriverReviews = async (driverId, { sort = "recent", limit = 20, offset = 0 } = {}) => {
  const sortField = sort === "oldest" ? "reviews.passenger.submittedAt" : "reviews.passenger.submittedAt";
  const sortOrder = sort === "oldest" ? 1 : -1;
  const ratingFilter = sort === "highest"
    ? { "reviews.passenger.rating": { $gte: 4 } }
    : sort === "lowest"
      ? { "reviews.passenger.rating": { $lte: 2 } }
      : { "reviews.passenger.rating": { $gte: 1, $lte: 5 } };

  const rides = await Ride.find({
    driverId: new mongoose.Types.ObjectId(String(driverId)),
    status: "completed",
    "reviews.passenger.rating": { $gte: 1, $lte: 5 },
    ...ratingFilter,
  })
    .sort({ [sortField]: sortOrder })
    .skip(offset)
    .limit(limit)
    .select("reviews.passenger passengerId createdAt")
    .populate("passengerId", "firstName fullName profilePicture")
    .lean();

  const reviews = rides
    .filter((r) => r.reviews?.passenger?.rating != null)
    .map((r) => ({
      id: String(r._id),
      rating: r.reviews.passenger.rating,
      comment: r.reviews.passenger.comment || "",
      submittedAt: r.reviews.passenger.submittedAt || r.updatedAt,
      reviewer: {
        firstName: r.passengerId?.firstName || "Passenger",
        profilePicture: r.passengerId?.profilePicture || "",
      },
    }));

  const totalReviews = await Ride.countDocuments({
    driverId: new mongoose.Types.ObjectId(String(driverId)),
    status: "completed",
    "reviews.passenger.rating": { $gte: 1, $lte: 5 },
  });

  return { reviews, totalReviews };
};

export const getDriverReviewsSummary = async (driverId) => {
  const [summary] = await Ride.aggregate([
    {
      $match: {
        driverId: new mongoose.Types.ObjectId(String(driverId)),
        "reviews.passenger.rating": { $gte: 1, $lte: 5 },
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$reviews.passenger.rating" },
        totalReviews: { $sum: 1 },
        rating5: {
          $sum: { $cond: [{ $eq: ["$reviews.passenger.rating", 5] }, 1, 0] },
        },
        rating4: {
          $sum: { $cond: [{ $eq: ["$reviews.passenger.rating", 4] }, 1, 0] },
        },
        rating3: {
          $sum: { $cond: [{ $eq: ["$reviews.passenger.rating", 3] }, 1, 0] },
        },
        rating2: {
          $sum: { $cond: [{ $eq: ["$reviews.passenger.rating", 2] }, 1, 0] },
        },
        rating1: {
          $sum: { $cond: [{ $eq: ["$reviews.passenger.rating", 1] }, 1, 0] },
        },
      },
    },
  ]);

  const completedTrips = await Ride.countDocuments({
    driverId: new mongoose.Types.ObjectId(String(driverId)),
    status: "completed",
  });

  if (!summary) {
    return {
      averageRating: 0,
      totalReviews: 0,
      completedTrips,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }

  const total = summary.totalReviews || 1;
  return {
    averageRating: Math.round((summary.averageRating || 0) * 100) / 100,
    totalReviews: summary.totalReviews,
    completedTrips,
    distribution: {
      5: Math.round((summary.rating5 / total) * 100),
      4: Math.round((summary.rating4 / total) * 100),
      3: Math.round((summary.rating3 / total) * 100),
      2: Math.round((summary.rating2 / total) * 100),
      1: Math.round((summary.rating1 / total) * 100),
    },
  };
};

export const getPublicDriverProfile = async (driverId) => {
  const driver = await Driver.findById(driverId)
    .select(
      "firstName lastName fullName profileImageUrl rating vehicleType vehicleModel " +
      "registration registrationVisible isVerified availabilityStatus isOnline " +
      "bio experienceLanguages languages publicProfileEnabled status isApproved " +
      "experienceYears city"
    )
    .lean();

  if (!driver) return null;
  if (driver.publicProfileEnabled === false) return null;

  const [reviewsSummary, ranking] = await Promise.all([
    getDriverReviewsSummary(driverId),
    getDriverRanking(driverId),
  ]);

  const badges = [];
  if (driver.isVerified) badges.push("Verified Driver");
  if (ranking && ranking.completedTrips >= 500) badges.push("Highly Experienced");
  if (ranking && ranking.weightedRating >= 4.8 && ranking.totalReviews >= 50) badges.push("Top Rated");
  if (ranking && ranking.rankingPosition != null && ranking.rankingPosition <= 10) badges.push("Elite Driver");
  if (ranking && ranking.completedTrips >= 100 && ranking.weightedRating >= 4.5) badges.push("Airport Specialist");
  if (ranking && ranking.completedTrips < 50 && ranking.weightedRating >= 4.5) badges.push("Rising Driver");

  return {
    id: String(driver._id),
    firstName: driver.firstName || "",
    lastName: driver.lastName || "",
    fullName: driver.fullName || [driver.firstName, driver.lastName].filter(Boolean).join(" "),
    profileImageUrl: driver.profileImageUrl || "",
    isVerified: driver.isVerified || false,
    rating: driver.rating ?? null,
    availabilityStatus: driver.availabilityStatus || "Offline",
    isOnline: driver.isOnline || false,
    bio: driver.bio || "",
    experienceYears: driver.experienceYears ?? null,
    languages: driver.languages || [],
    city: driver.city || "",
    vehicle: {
      type: driver.vehicleType || "",
      model: driver.vehicleModel || "",
      registration: driver.registrationVisible ? (driver.registration || "") : "",
    },
    badges,
    reviewsSummary: {
      averageRating: reviewsSummary.averageRating,
      totalReviews: reviewsSummary.totalReviews,
      completedTrips: reviewsSummary.completedTrips,
      distribution: reviewsSummary.distribution,
    },
    ranking: ranking
      ? {
          position: ranking.rankingPosition,
          score: ranking.rankingScore,
          weightedRating: ranking.weightedRating,
        }
      : null,
  };
};

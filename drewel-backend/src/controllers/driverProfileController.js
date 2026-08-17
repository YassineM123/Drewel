import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import {
  getPublicDriverProfile,
  getDriverReviews,
  getDriverReviewsSummary,
  getDriverRanking,
  getTopDrivers,
  recalculateDriverRanking,
  recalculateAllRankings,
} from "../services/driverRankingService.js";

const sendError = (res, error) =>
  res.status(error.statusCode || 500).json({
    success: false,
    code: error.code || "INTERNAL_ERROR",
    message: error.statusCode ? error.message : "Internal server error",
  });

export const getPublicProfile = async (req, res) => {
  try {
    const { driverId } = req.params;
    if (!mongoose.isValidObjectId(driverId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DRIVER_ID",
        message: "Invalid driver ID",
      });
    }

    const profile = await getPublicDriverProfile(driverId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        code: "DRIVER_NOT_FOUND",
        message: "Driver profile not found or not available",
      });
    }

    return res.json({ success: true, profile });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getDriverReviewsList = async (req, res) => {
  try {
    const { driverId } = req.params;
    if (!mongoose.isValidObjectId(driverId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DRIVER_ID",
        message: "Invalid driver ID",
      });
    }

    const sort = ["recent", "highest", "lowest", "oldest"].includes(req.query.sort)
      ? req.query.sort
      : "recent";
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || "20", 10) || 20));
    const offset = (page - 1) * limit;

    const [result, summary] = await Promise.all([
      getDriverReviews(driverId, { sort, limit, offset }),
      getDriverReviewsSummary(driverId),
    ]);

    return res.json({
      success: true,
      reviews: result.reviews,
      summary,
      pagination: {
        page,
        limit,
        total: result.totalReviews,
        totalPages: Math.ceil(result.totalReviews / limit),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getRankings = async (req, res) => {
  try {
    const month = req.query.month || null;
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || "20", 10) || 20));
    const offset = (page - 1) * limit;

    const drivers = await getTopDrivers({ month, limit, offset });

    return res.json({
      success: true,
      drivers,
      pagination: {
        page,
        limit,
        offset,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getMyRanking = async (req, res) => {
  try {
    const driverId = req.user?._id;
    if (!driverId) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Authentication required",
      });
    }

    const ranking = await getDriverRanking(driverId);
    return res.json({ success: true, ranking });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateDriverProfileFields = async (req, res) => {
  try {
    const driverId = req.user?._id;
    if (!driverId) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Authentication required",
      });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    const { bio, experienceYears, languages, publicProfileEnabled } = req.body;

    if (bio !== undefined) {
      driver.bio = String(bio).trim().slice(0, 500);
    }
    if (experienceYears !== undefined) {
      const years = Number(experienceYears);
      driver.experienceYears = Number.isFinite(years) ? Math.max(0, Math.min(50, Math.round(years))) : null;
    }
    if (languages !== undefined && Array.isArray(languages)) {
      driver.languages = languages
        .map((l) => String(l).trim().toUpperCase())
        .filter((l) => l.length > 0 && l.length <= 10)
        .slice(0, 5);
    }
    if (publicProfileEnabled !== undefined) {
      driver.publicProfileEnabled = Boolean(publicProfileEnabled);
    }

    await driver.save();

    return res.json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        bio: driver.bio,
        experienceYears: driver.experienceYears,
        languages: driver.languages,
        publicProfileEnabled: driver.publicProfileEnabled,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const toggleFavoriteDriver = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Authentication required",
      });
    }

    const { driverId } = req.body;
    if (!mongoose.isValidObjectId(driverId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DRIVER_ID",
        message: "Invalid driver ID",
      });
    }

    const user = await Driver.findById(userId).select("favoriteDrivers").lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const favorites = user.favoriteDrivers || [];
    const isFavorited = favorites.some((f) => String(f) === String(driverId));

    if (isFavorited) {
      await Driver.updateOne(
        { _id: userId },
        { $pull: { favoriteDrivers: new mongoose.Types.ObjectId(driverId) } }
      );
    } else {
      await Driver.updateOne(
        { _id: userId },
        { $addToSet: { favoriteDrivers: new mongoose.Types.ObjectId(driverId) } }
      );
    }

    return res.json({
      success: true,
      favorited: !isFavorited,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const triggerRankingRecalculation = async (req, res) => {
  try {
    await recalculateAllRankings();
    return res.json({
      success: true,
      message: "Rankings recalculated successfully",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

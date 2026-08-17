import mongoose from "mongoose";

const driverRankingSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      unique: true,
      index: true,
    },
    weightedRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    completedTrips: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    completionRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    cancellationRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    acceptanceRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    recentPerformanceScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    rankingScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    rankingPosition: {
      type: Number,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    hasValidDocuments: {
      type: Boolean,
      default: false,
    },
    lastCalculatedAt: {
      type: Date,
      default: null,
    },
    month: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

driverRankingSchema.index({ rankingScore: -1 });
driverRankingSchema.index({ month: 1, rankingScore: -1 });
driverRankingSchema.index({ driverId: 1, month: 1 });

const DriverRanking = mongoose.model("DriverRanking", driverRankingSchema);

export default DriverRanking;

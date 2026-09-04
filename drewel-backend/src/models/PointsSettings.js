import mongoose from "mongoose";

const positiveSafeIntegerFromEnv = (name, fallback, { allowZero = false } = {}) => {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") return fallback;
  const value = Number(rawValue);
  const minimum = allowZero ? 0 : 1;
  return Number.isSafeInteger(value) && value >= minimum ? value : fallback;
};

const positiveNumberFromEnv = (name, fallback) => {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") return fallback;
  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const DEFAULT_WELCOME_DRIVER_POINTS = positiveSafeIntegerFromEnv(
  "WELCOME_DRIVER_POINTS",
  1000,
  { allowZero: true }
);
export const DEFAULT_RIDE_OFFER_POINTS_COST = positiveSafeIntegerFromEnv(
  "RIDE_OFFER_POINTS_COST",
  20
);
export const DEFAULT_POINTS_LOW_BALANCE_THRESHOLD = positiveSafeIntegerFromEnv(
  "POINTS_LOW_BALANCE_THRESHOLD",
  20,
  { allowZero: true }
);
export const DEFAULT_TRIP_OFFER_EXPIRATION_SECONDS = positiveSafeIntegerFromEnv(
  "TRIP_OFFER_TTL_SECONDS",
  300
);
export const DEFAULT_MAXIMUM_CONCURRENT_OFFERS = positiveSafeIntegerFromEnv(
  "POINTS_MAXIMUM_CONCURRENT_OFFERS",
  5
);
export const DEFAULT_POINTS_LARGE_ADJUSTMENT_THRESHOLD =
  positiveSafeIntegerFromEnv("POINTS_LARGE_ADJUSTMENT_THRESHOLD", 1000);
export const DEFAULT_COMMISSION_RATE = positiveNumberFromEnv(
  "COMMISSION_RATE",
  0.10
);
export const DEFAULT_POINTS_PER_AED = positiveNumberFromEnv(
  "POINTS_PER_AED",
  1
);
export const GLOBAL_POINTS_SETTINGS_KEY = "global";

const pointsSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: [GLOBAL_POINTS_SETTINGS_KEY],
      default: GLOBAL_POINTS_SETTINGS_KEY,
      required: true,
      unique: true,
      immutable: true,
    },
    welcomeDriverPoints: {
      type: Number,
      default: DEFAULT_WELCOME_DRIVER_POINTS,
      required: true,
      min: 0,
    },
    rideOfferPointsCost: {
      type: Number,
      default: DEFAULT_RIDE_OFFER_POINTS_COST,
      required: true,
      min: 1,
    },
    commissionRate: {
      type: Number,
      default: DEFAULT_COMMISSION_RATE,
      required: true,
      min: 0,
      max: 1,
    },
    pointsPerAED: {
      type: Number,
      default: DEFAULT_POINTS_PER_AED,
      required: true,
      min: 0.01,
    },
    lowBalanceThreshold: {
      type: Number,
      default: DEFAULT_POINTS_LOW_BALANCE_THRESHOLD,
      required: true,
      min: 0,
    },
    offerExpirationSeconds: {
      type: Number,
      default: DEFAULT_TRIP_OFFER_EXPIRATION_SECONDS,
      required: true,
      min: 30,
      max: 86400,
    },
    maximumConcurrentOffers: {
      type: Number,
      default: DEFAULT_MAXIMUM_CONCURRENT_OFFERS,
      required: true,
      min: 1,
      max: 100,
    },
    largeAdjustmentThreshold: {
      type: Number,
      default: DEFAULT_POINTS_LARGE_ADJUSTMENT_THRESHOLD,
      required: true,
      min: 1,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    updateReason: { type: String, trim: true, default: "", maxlength: 1000 },
  },
  { timestamps: true, versionKey: false }
);

pointsSettingsSchema.pre("validate", function validatePointValues() {
  for (const field of [
    "welcomeDriverPoints",
    "rideOfferPointsCost",
    "lowBalanceThreshold",
    "offerExpirationSeconds",
    "maximumConcurrentOffers",
    "largeAdjustmentThreshold",
  ]) {
    if (!Number.isSafeInteger(this.get(field))) {
      throw new Error(`${field} must be a safe integer`);
    }
  }
  const commissionRate = this.get("commissionRate");
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 1) {
    throw new Error("commissionRate must be a number between 0 and 1");
  }
  const pointsPerAED = this.get("pointsPerAED");
  if (!Number.isFinite(pointsPerAED) || pointsPerAED <= 0) {
    throw new Error("pointsPerAED must be a positive number");
  }
});

pointsSettingsSchema.statics.getEffective = async function getEffective(options = {}) {
  const query = this.findOne({ key: GLOBAL_POINTS_SETTINGS_KEY }).lean();
  if (options.session) query.session(options.session);
  const stored = await query;
  return {
    welcomeDriverPoints: stored?.welcomeDriverPoints ?? DEFAULT_WELCOME_DRIVER_POINTS,
    rideOfferPointsCost: stored?.rideOfferPointsCost ?? DEFAULT_RIDE_OFFER_POINTS_COST,
    lowBalanceThreshold:
      stored?.lowBalanceThreshold ?? DEFAULT_POINTS_LOW_BALANCE_THRESHOLD,
    offerExpirationSeconds:
      stored?.offerExpirationSeconds ?? DEFAULT_TRIP_OFFER_EXPIRATION_SECONDS,
    maximumConcurrentOffers:
      stored?.maximumConcurrentOffers ?? DEFAULT_MAXIMUM_CONCURRENT_OFFERS,
    largeAdjustmentThreshold:
      stored?.largeAdjustmentThreshold ??
      DEFAULT_POINTS_LARGE_ADJUSTMENT_THRESHOLD,
    commissionRate: stored?.commissionRate ?? DEFAULT_COMMISSION_RATE,
    pointsPerAED: stored?.pointsPerAED ?? DEFAULT_POINTS_PER_AED,
  };
};

export default mongoose.model("PointsSettings", pointsSettingsSchema);

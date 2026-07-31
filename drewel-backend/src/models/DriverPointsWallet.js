import mongoose from "mongoose";

const NON_NEGATIVE_INTEGER_FIELDS = [
  "availableBonusPoints",
  "availablePurchasedPoints",
  "reservedBonusPoints",
  "reservedPurchasedPoints",
  "totalEarnedBonus",
  "totalPurchased",
  "totalConsumed",
  "totalRefunded",
  "version",
];

const driverPointsWalletSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      immutable: true,
      unique: true,
    },
    availableBonusPoints: { type: Number, default: 0, min: 0 },
    availablePurchasedPoints: { type: Number, default: 0, min: 0 },
    reservedBonusPoints: { type: Number, default: 0, min: 0 },
    reservedPurchasedPoints: { type: Number, default: 0, min: 0 },
    totalEarnedBonus: { type: Number, default: 0, min: 0 },
    totalPurchased: { type: Number, default: 0, min: 0 },
    totalConsumed: { type: Number, default: 0, min: 0 },
    totalRefunded: { type: Number, default: 0, min: 0 },
    welcomeBonusGranted: { type: Boolean, default: false },
    welcomeBonusGrantedAt: { type: Date, default: null },
    version: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    optimisticConcurrency: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

driverPointsWalletSchema.virtual("availablePoints").get(function availablePoints() {
  return this.availableBonusPoints + this.availablePurchasedPoints;
});

driverPointsWalletSchema.virtual("reservedPoints").get(function reservedPoints() {
  return this.reservedBonusPoints + this.reservedPurchasedPoints;
});

driverPointsWalletSchema.virtual("totalPoints").get(function totalPoints() {
  return (
    this.availableBonusPoints +
    this.availablePurchasedPoints +
    this.reservedBonusPoints +
    this.reservedPurchasedPoints
  );
});

driverPointsWalletSchema.pre("validate", function validateWallet() {
  for (const field of NON_NEGATIVE_INTEGER_FIELDS) {
    const value = this.get(field);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${field} must be a non-negative safe integer`);
    }
  }

  if (this.welcomeBonusGranted && !this.welcomeBonusGrantedAt) {
    throw new Error("welcomeBonusGrantedAt is required after the welcome bonus is granted");
  }
  if (!this.welcomeBonusGranted && this.welcomeBonusGrantedAt) {
    throw new Error("welcomeBonusGrantedAt cannot be set before the welcome bonus is granted");
  }
});

driverPointsWalletSchema.index({ updatedAt: -1, _id: -1 });

export default mongoose.model("DriverPointsWallet", driverPointsWalletSchema);

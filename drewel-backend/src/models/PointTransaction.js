import mongoose from "mongoose";

export const POINT_TRANSACTION_TYPES = [
  "WELCOME_BONUS",
  "POINTS_PURCHASE",
  "OFFER_RESERVE",
  "OFFER_RELEASE",
  "RIDE_CHARGE",
  "RIDE_COMMISSION",
  "TECHNICAL_REFUND",
  "ADMIN_CREDIT",
  "ADMIN_DEBIT",
  "PENALTY",
  "CORRECTION",
];

export const POINT_TRANSACTION_STATUSES = ["PENDING", "COMPLETED", "FAILED"];

const pointTransactionSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      immutable: true,
    },
    type: {
      type: String,
      enum: POINT_TRANSACTION_TYPES,
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: POINT_TRANSACTION_STATUSES,
      default: "COMPLETED",
      required: true,
      immutable: true,
    },
    points: { type: Number, required: true, min: 1, immutable: true },
    bonusPoints: { type: Number, default: 0, min: 0, immutable: true },
    purchasedPoints: { type: Number, default: 0, min: 0, immutable: true },
    previousAvailableBalance: { type: Number, required: true, min: 0, immutable: true },
    newAvailableBalance: { type: Number, required: true, min: 0, immutable: true },
    previousReservedBalance: { type: Number, required: true, min: 0, immutable: true },
    newReservedBalance: { type: Number, required: true, min: 0, immutable: true },
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TripOffer",
      default: null,
      immutable: true,
    },
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      default: null,
      immutable: true,
    },
    purchaseRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PointPurchaseRequest",
      default: null,
      immutable: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      immutable: true,
    },
    paymentReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
      immutable: true,
      select: false,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
      immutable: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 200,
      immutable: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: Object.freeze({}),
      immutable: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

pointTransactionSchema.pre("validate", function validateComponents() {
  for (const field of [
    "points",
    "bonusPoints",
    "purchasedPoints",
    "previousAvailableBalance",
    "newAvailableBalance",
    "previousReservedBalance",
    "newReservedBalance",
  ]) {
    if (!Number.isSafeInteger(this.get(field))) {
      throw new Error(`${field} must be a safe integer`);
    }
  }
  if (this.bonusPoints + this.purchasedPoints !== this.points) {
    throw new Error("bonusPoints and purchasedPoints must add up to points");
  }
});

pointTransactionSchema.index({ idempotencyKey: 1 }, { unique: true });
pointTransactionSchema.index(
  { paymentReference: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentReference: { $gt: "" } },
    name: "unique_nonempty_point_payment_reference",
  }
);
pointTransactionSchema.index({ driverId: 1, createdAt: -1, _id: -1 });
pointTransactionSchema.index({ driverId: 1, type: 1, createdAt: -1 });
pointTransactionSchema.index(
  { rideId: 1 },
  { partialFilterExpression: { rideId: { $type: "objectId" } } }
);
pointTransactionSchema.index({ createdAt: -1 });
pointTransactionSchema.index(
  { offerId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { offerId: { $type: "objectId" } },
    name: "one_transaction_type_per_offer",
  }
);
pointTransactionSchema.index(
  { purchaseRequestId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { purchaseRequestId: { $type: "objectId" } },
    name: "one_transaction_type_per_purchase_request",
  }
);

const rejectMutation = function rejectMutation() {
  throw new Error("Point transaction records are append-only");
};

for (const hook of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
]) {
  pointTransactionSchema.pre(hook, rejectMutation);
}

pointTransactionSchema.pre("save", function rejectExistingSave() {
  if (!this.isNew) throw new Error("Point transaction records are append-only");
});
pointTransactionSchema.pre("deleteOne", { document: true, query: false }, rejectMutation);

export default mongoose.model("PointTransaction", pointTransactionSchema);

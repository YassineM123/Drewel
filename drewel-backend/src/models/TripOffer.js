import mongoose from "mongoose";

export const TRIP_OFFER_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "delivery_failed",
];

export const TRIP_OFFER_RESERVATION_STATES = ["reserved", "captured", "released"];

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, min: -90, max: 90, default: null },
    long: { type: Number, min: -180, max: 180, default: null },
    address: { type: String, trim: true, default: "", maxlength: 300 },
  },
  { _id: false }
);

const tripOfferSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      immutable: true,
    },
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
      immutable: true,
    },
    contactRideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      immutable: true,
    },
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      default: null,
    },
    clientOfferId: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 200,
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
    requestFingerprint: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-f0-9]{64}$/,
      immutable: true,
    },
    offeredPrice: { type: Number, required: true, min: 0, immutable: true },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}$/,
      immutable: true,
    },
    pickup: { type: locationSchema, default: () => ({}), immutable: true },
    destination: { type: locationSchema, default: () => ({}), immutable: true },
    vehicleType: { type: String, trim: true, default: "", maxlength: 120, immutable: true },
    note: { type: String, trim: true, default: "", maxlength: 1000, immutable: true },
    pointsCost: { type: Number, required: true, min: 1, immutable: true },
    reservedBonusPoints: { type: Number, required: true, min: 0, immutable: true },
    reservedPurchasedPoints: { type: Number, required: true, min: 0, immutable: true },
    status: {
      type: String,
      enum: TRIP_OFFER_STATUSES,
      default: "pending",
      required: true,
      index: true,
    },
    reservationState: {
      type: String,
      enum: TRIP_OFFER_RESERVATION_STATES,
      default: "reserved",
      required: true,
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true, immutable: true },
    acceptedAt: { type: Date, default: null },
    acceptanceIdempotencyKey: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    declinedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    deliveryFailedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    stateVersion: { type: Number, default: 0, min: 0 },
    commission: {
      ridePriceAED: { type: Number, default: null },
      commissionRate: { type: Number, default: null },
      commissionAED: { type: Number, default: null },
      pointsPerAED: { type: Number, default: null },
      pointsToDeduct: { type: Number, default: null },
      driverNetAED: { type: Number, default: null },
    },
  },
  { timestamps: true, versionKey: false }
);

tripOfferSchema.pre("validate", function validateReservation() {
  for (const field of ["pointsCost", "reservedBonusPoints", "reservedPurchasedPoints", "stateVersion"]) {
    if (!Number.isSafeInteger(this.get(field))) {
      throw new Error(`${field} must be a safe integer`);
    }
  }
  if (this.reservedBonusPoints + this.reservedPurchasedPoints !== this.pointsCost) {
    throw new Error("Reserved point components must add up to pointsCost");
  }
  if (this.status === "accepted" && (!this.rideId || this.reservationState !== "released")) {
    throw new Error("An accepted offer must reference its ride and have a released reservation");
  }
  if (
    ["declined", "expired", "cancelled", "delivery_failed"].includes(this.status) &&
    this.reservationState !== "released"
  ) {
    throw new Error("A closed unaccepted offer must have a released reservation");
  }
});

tripOfferSchema.index({ driverId: 1, clientOfferId: 1 }, { unique: true });
tripOfferSchema.index({ driverId: 1, idempotencyKey: 1 }, { unique: true });
tripOfferSchema.index({ passengerId: 1, status: 1, createdAt: -1, _id: -1 });
tripOfferSchema.index({ driverId: 1, status: 1, createdAt: -1, _id: -1 });
tripOfferSchema.index({ status: 1, reservationState: 1, expiresAt: 1 });
tripOfferSchema.index(
  { contactRideId: 1, driverId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "one_pending_offer_per_driver_contact",
  }
);
tripOfferSchema.index(
  { rideId: 1 },
  {
    unique: true,
    partialFilterExpression: { rideId: { $type: "objectId" } },
    name: "one_offer_per_confirmed_ride",
  }
);

export default mongoose.model("TripOffer", tripOfferSchema);

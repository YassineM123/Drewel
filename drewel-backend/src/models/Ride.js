import mongoose from "mongoose";

export const RIDE_STATUSES = [
  "contacting",
  "requested",
  "accepted",
  "driver_arriving",
  "offer_pending",
  "confirmed",
  "driver_on_the_way",
  "driver_arrived",
  "pickup_confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "cancelled_by_user",
  "cancelled_by_driver",
  "cancelled_by_admin",
  "disputed",
];

export const ACTIVE_RIDE_STATUSES = [
  "accepted",
  "driver_arriving",
  "confirmed",
  "driver_on_the_way",
  "driver_arrived",
  "pickup_confirmed",
  "in_progress",
  "disputed",
];

export const TERMINAL_RIDE_STATUSES = [
  "completed",
  "cancelled",
  "cancelled_by_user",
  "cancelled_by_driver",
  "cancelled_by_admin",
];

const rideReviewSchema = new mongoose.Schema(
  {
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 500 },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false, versionKey: false }
);

const rideSchema = new mongoose.Schema(
  {
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    status: { type: String, enum: RIDE_STATUSES, default: "requested", index: true },
    reference: { type: String, required: true, unique: true, immutable: true },
    requestedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    contactEndsAt: { type: Date, default: null, index: true },
    communicationBlockedAt: { type: Date, default: null },
    communicationBlockedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    pickup: {
      lat: { type: Number, min: -90, max: 90 },
      long: { type: Number, min: -180, max: 180 },
      address: { type: String, default: "", maxlength: 300 },
    },
    destination: {
      lat: { type: Number, min: -90, max: 90 },
      long: { type: Number, min: -180, max: 180 },
      address: { type: String, default: "", maxlength: 300 },
    },
    vehicleType: { type: String, default: "", maxlength: 120 },
    agreedPrice: { type: Number, default: null, min: 0 },
    confirmedAt: { type: Date, default: null },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    driverOnTheWayAt: { type: Date, default: null },
    driverArrivedAt: { type: Date, default: null },
    pickupConfirmedAt: { type: Date, default: null },
    pickupPinHash: { type: String, default: "", select: false },
    pickupPinSalt: { type: String, default: "", select: false },
    pickupPinEncrypted: { type: String, default: "", select: false },
    pickupPinAttempts: { type: Number, default: 0, min: 0, select: false },
    pickupPinLockedUntil: { type: Date, default: null, select: false },
    stateVersion: { type: Number, default: 0, min: 0 },
    lastDriverLocation: {
      lat: { type: Number, min: -90, max: 90, default: null },
      long: { type: Number, min: -180, max: 180, default: null },
      accuracy: { type: Number, min: 0, max: 10000, default: null },
      heading: { type: Number, min: 0, max: 360, default: null },
      speed: { type: Number, min: 0, max: 150, default: null },
      recordedAt: { type: Date, default: null },
    },
    cancellation: {
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, default: null },
      actorRole: {
        type: String,
        enum: ["passenger", "driver", "admin", "system", null],
        default: null,
      },
      reason: { type: String, default: "", maxlength: 120 },
      note: { type: String, default: "", maxlength: 1000 },
      stateBeforeCancellation: { type: String, default: "" },
      location: {
        lat: { type: Number, min: -90, max: 90, default: null },
        long: { type: Number, min: -180, max: 180, default: null },
      },
      timestamp: { type: Date, default: null },
      pointsDecision: {
        type: String,
        enum: ["captured_no_refund", "not_captured", "admin_refund_pending", ""],
        default: "",
      },
      adminReviewStatus: {
        type: String,
        enum: ["not_required", "pending", "resolved", ""],
        default: "",
      },
    },
    reviews: {
      passenger: { type: rideReviewSchema, default: null },
      driver: { type: rideReviewSchema, default: null },
    },
  },
  { timestamps: true, versionKey: false }
);

rideSchema.index({ passengerId: 1, status: 1, updatedAt: -1 });
rideSchema.index({ driverId: 1, status: 1, updatedAt: -1 });
rideSchema.index(
  { passengerId: 1, driverId: 1 },
  { unique: true, partialFilterExpression: { status: "contacting" }, name: "one_open_contact_per_pair" }
);
rideSchema.index(
  { passengerId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ACTIVE_RIDE_STATUSES } }, name: "one_active_ride_per_passenger" }
);
rideSchema.index(
  { driverId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ACTIVE_RIDE_STATUSES } }, name: "one_active_ride_per_driver" }
);

export default mongoose.model("Ride", rideSchema);

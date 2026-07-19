import mongoose from "mongoose";

export const RIDE_STATUSES = [
  "requested",
  "accepted",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
  "completed",
  "cancelled",
];

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
  },
  { timestamps: true, versionKey: false }
);

rideSchema.index({ passengerId: 1, status: 1, updatedAt: -1 });
rideSchema.index({ driverId: 1, status: 1, updatedAt: -1 });
rideSchema.index(
  { passengerId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["accepted", "driver_arriving", "driver_arrived", "in_progress"] } }, name: "one_active_ride_per_passenger" }
);
rideSchema.index(
  { driverId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["accepted", "driver_arriving", "driver_arrived", "in_progress"] } }, name: "one_active_ride_per_driver" }
);

export default mongoose.model("Ride", rideSchema);

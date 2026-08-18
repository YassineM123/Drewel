import mongoose from "mongoose";

export const CALL_STATUSES = [
  "planned",
  "ringing",
  "in_call",
  "completed",
  "missed",
  "failed",
  "cancelled",
];

/**
 * Secure-call metadata. This is deliberately metadata-only: call ID, ride and
 * participant references, timing, duration, status, failure reason and the
 * provider reference. A recording URL is only stored when recording has been
 * explicitly and legally enabled for the product, and is never projected into
 * admin payloads by the controller DTO.
 */
const callLogSchema = new mongoose.Schema(
  {
    callId: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      default: null,
      index: true,
    },
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true,
    },
    passengerName: { type: String, default: "", trim: true, maxlength: 160 },
    driverName: { type: String, default: "", trim: true, maxlength: 160 },
    startedAt: { type: Date, default: null, index: true },
    endedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: CALL_STATUSES,
      default: "planned",
      index: true,
    },
    failureReason: { type: String, default: "", trim: true, maxlength: 200 },
    providerReference: { type: String, default: "", trim: true, maxlength: 120 },
    recordingEnabled: { type: Boolean, default: false },
    recordingUrl: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

callLogSchema.index({ rideId: 1, startedAt: -1 });
callLogSchema.index({ passengerId: 1, startedAt: -1 });
callLogSchema.index({ driverId: 1, startedAt: -1 });
callLogSchema.index({ status: 1, startedAt: -1 });

export default mongoose.model("CallLog", callLogSchema);

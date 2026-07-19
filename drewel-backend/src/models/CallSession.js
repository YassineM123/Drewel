import mongoose from "mongoose";

export const CALL_STATUSES = [
  "initiating", "ringing", "accepted", "connected", "declined",
  "missed", "cancelled", "ended", "failed",
];
export const ACTIVE_CALL_STATUSES = ["initiating", "ringing", "accepted", "connected"];

const callSessionSchema = new mongoose.Schema(
  {
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true, index: true },
    callerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    callerRole: { type: String, enum: ["passenger", "driver"], required: true },
    receiverRole: { type: String, enum: ["passenger", "driver"], required: true },
    provider: { type: String, enum: ["agora"], default: "agora", immutable: true },
    channelName: { type: String, required: true, unique: true, select: false },
    callerAgoraUid: { type: Number, required: true, select: false },
    receiverAgoraUid: { type: Number, required: true, select: false },
    status: { type: String, enum: CALL_STATUSES, default: "initiating", index: true },
    stateVersion: { type: Number, default: 0 },
    idempotencyKey: { type: String, default: "", select: false },
    startedAt: { type: Date, default: Date.now },
    ringingAt: { type: Date, default: null },
    ringingDeadline: { type: Date, default: null, index: true },
    answeredAt: { type: Date, default: null },
    connectedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0, min: 0 },
    endedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    endReason: { type: String, default: "", maxlength: 200 },
    reported: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false }
);

callSessionSchema.index({ rideId: 1, createdAt: -1 });
callSessionSchema.index({ callerId: 1, createdAt: -1 });
callSessionSchema.index({ receiverId: 1, createdAt: -1 });
callSessionSchema.index({ status: 1, createdAt: -1 });
callSessionSchema.index(
  { rideId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ACTIVE_CALL_STATUSES } }, name: "one_active_call_per_ride" }
);
callSessionSchema.index(
  { rideId: 1, callerId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } },
    name: "ride_caller_idempotency",
  }
);

export default mongoose.model("CallSession", callSessionSchema);

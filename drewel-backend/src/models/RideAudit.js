import mongoose from "mongoose";

const rideAuditSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      immutable: true,
      index: true,
    },
    action: { type: String, required: true, trim: true, maxlength: 80, immutable: true },
    fromStatus: { type: String, default: "", maxlength: 40, immutable: true },
    toStatus: { type: String, default: "", maxlength: 40, immutable: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
    actorRole: {
      type: String,
      enum: ["passenger", "driver", "admin", "system"],
      required: true,
      immutable: true,
    },
    reasonCode: { type: String, default: "", maxlength: 120, immutable: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: Object.freeze({}), immutable: true },
    idempotencyKey: { type: String, default: "", maxlength: 200, immutable: true },
    occurredAt: { type: Date, default: Date.now, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

rideAuditSchema.index({ rideId: 1, occurredAt: -1, _id: -1 });
rideAuditSchema.index(
  { rideId: 1, actorId: 1, action: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $gt: "" } },
    name: "ride_action_idempotency",
  }
);

const rejectMutation = function rejectMutation() {
  throw new Error("Ride audit records are append-only");
};
for (const hook of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
]) {
  rideAuditSchema.pre(hook, rejectMutation);
}
rideAuditSchema.pre("save", function rejectExistingSave() {
  if (!this.isNew) throw new Error("Ride audit records are append-only");
});

export default mongoose.model("RideAudit", rideAuditSchema);

import mongoose from "mongoose";

const communicationAuditSchema = new mongoose.Schema(
  {
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true, immutable: true, index: true },
    callId: { type: mongoose.Schema.Types.ObjectId, ref: "CallSession", default: null, immutable: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 80, immutable: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
    actorRole: { type: String, enum: ["passenger", "driver", "admin", "system"], required: true, immutable: true },
    outcome: { type: String, enum: ["allowed", "denied", "success", "failure"], required: true, immutable: true },
    reasonCode: { type: String, default: "", maxlength: 100, immutable: true },
    occurredAt: { type: Date, default: Date.now, immutable: true },
  },
  { timestamps: true, versionKey: false }
);

communicationAuditSchema.index({ rideId: 1, occurredAt: -1 });
communicationAuditSchema.index({ callId: 1, occurredAt: -1 });

const rejectMutation = function rejectMutation() {
  throw new Error("Communication audit records are append-only");
};
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  communicationAuditSchema.pre(hook, rejectMutation);
}
communicationAuditSchema.pre("save", function rejectExistingSave() {
  if (!this.isNew) throw new Error("Communication audit records are append-only");
});

export default mongoose.model("CommunicationAudit", communicationAuditSchema);

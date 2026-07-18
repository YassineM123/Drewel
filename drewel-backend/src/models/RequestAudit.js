import mongoose from "mongoose";

const STATUS_VALUES = ["not_submitted", "pending", "approved", "rejected", "completed"];

const requestAuditSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      immutable: true,
    },
    requestType: {
      type: String,
      enum: ["driver_verification"],
      default: "driver_verification",
      required: true,
      immutable: true,
    },
    requestStage: {
      type: String,
      enum: ["basic", "profile"],
      default: "basic",
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      enum: ["submitted", "resubmitted", "approved", "reopened", "rejected", "completed", "status_changed"],
      required: true,
      immutable: true,
    },
    oldStatus: { type: String, enum: STATUS_VALUES, required: true, immutable: true },
    newStatus: { type: String, enum: STATUS_VALUES, required: true, immutable: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    actorType: {
      type: String,
      enum: ["admin", "driver", "system"],
      required: true,
      immutable: true,
    },
    actorName: { type: String, trim: true, default: "", immutable: true },
    actorEmail: { type: String, trim: true, lowercase: true, default: "", immutable: true },
    reason: { type: String, trim: true, default: "", maxlength: 1000, immutable: true },
    occurredAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { timestamps: true, versionKey: false }
);

requestAuditSchema.index({ requestId: 1, occurredAt: -1 });
requestAuditSchema.index({ requestId: 1, requestStage: 1, occurredAt: -1 });
requestAuditSchema.index({ actorId: 1, occurredAt: -1 });
requestAuditSchema.index({ newStatus: 1, occurredAt: -1 });

const rejectMutation = function rejectMutation() {
  throw new Error("Request audit records are append-only");
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
  requestAuditSchema.pre(hook, rejectMutation);
}

requestAuditSchema.pre("save", function rejectExistingSave() {
  if (!this.isNew) throw new Error("Request audit records are append-only");
});
requestAuditSchema.pre("deleteOne", { document: true, query: false }, rejectMutation);

export default mongoose.model("RequestAudit", requestAuditSchema);

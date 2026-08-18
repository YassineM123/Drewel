import mongoose from "mongoose";

export const CONTENT_ENTITY_TYPES = ["banner", "conversation"];
export const CONTENT_ACTIONS = [
  "created",
  "updated",
  "activated",
  "deactivated",
  "deleted",
  "note_added",
];

const contentAuditSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: CONTENT_ENTITY_TYPES,
      required: true,
      immutable: true,
      index: true,
    },
    entityId: { type: String, required: true, immutable: true, index: true },
    action: {
      type: String,
      enum: CONTENT_ACTIONS,
      required: true,
      immutable: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    actorName: { type: String, default: "", trim: true, maxlength: 160, immutable: true },
    actorEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 200,
      immutable: true,
    },
    changes: { type: mongoose.Schema.Types.Mixed, default: null, immutable: true },
    reason: { type: String, default: "", trim: true, maxlength: 1000, immutable: true },
    occurredAt: { type: Date, default: Date.now, immutable: true },
  },
  { timestamps: true, versionKey: false }
);

contentAuditSchema.index({ entityType: 1, entityId: 1, occurredAt: -1 });
contentAuditSchema.index({ actorId: 1, occurredAt: -1 });

const rejectMutation = function rejectMutation() {
  throw new Error("Content audit records are append-only");
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
  contentAuditSchema.pre(hook, rejectMutation);
}
contentAuditSchema.pre("save", function rejectExistingSave() {
  if (!this.isNew) throw new Error("Content audit records are append-only");
});

export default mongoose.model("ContentAudit", contentAuditSchema);

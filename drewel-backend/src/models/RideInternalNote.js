import mongoose from "mongoose";

const rideInternalNoteSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      immutable: true,
      index: true,
    },
    adminId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true, index: true },
    adminName: { type: String, default: "", maxlength: 120, immutable: true },
    text: { type: String, required: true, trim: true, maxlength: 2000, immutable: true },
    idempotencyKey: { type: String, default: "", maxlength: 200, immutable: true },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

rideInternalNoteSchema.index({ rideId: 1, createdAt: -1, _id: -1 });
rideInternalNoteSchema.index(
  { rideId: 1, adminId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $gt: "" } },
    name: "ride_internal_note_idempotency",
  }
);

const rejectMutation = function rejectMutation() {
  throw new Error("Ride internal notes are append-only");
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
  rideInternalNoteSchema.pre(hook, rejectMutation);
}
rideInternalNoteSchema.pre("save", function rejectExistingSave() {
  if (!this.isNew) throw new Error("Ride internal notes are append-only");
});

export default mongoose.model("RideInternalNote", rideInternalNoteSchema);

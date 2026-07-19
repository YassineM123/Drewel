import mongoose from "mongoose";

const rideSafetyActionSchema = new mongoose.Schema(
  {
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true, immutable: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true, index: true },
    actorRole: { type: String, enum: ["passenger", "driver"], required: true, immutable: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true, index: true },
    targetRole: { type: String, enum: ["passenger", "driver"], required: true, immutable: true },
    type: { type: String, enum: ["report", "block"], required: true, immutable: true, index: true },
    reason: { type: String, trim: true, default: "", maxlength: 1000, immutable: true },
  },
  { timestamps: true, versionKey: false }
);

rideSafetyActionSchema.index({ rideId: 1, createdAt: -1 });
rideSafetyActionSchema.index({ actorId: 1, targetId: 1, type: 1, createdAt: -1 });
const rejectMutation = function rejectMutation() { throw new Error("Ride safety actions are append-only"); };
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  rideSafetyActionSchema.pre(hook, rejectMutation);
}
rideSafetyActionSchema.pre("save", function rejectExistingSave() {
  if (!this.isNew) throw new Error("Ride safety actions are append-only");
});

export default mongoose.model("RideSafetyAction", rideSafetyActionSchema);

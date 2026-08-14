import mongoose from "mongoose";

export const SAVED_PLACE_TYPES = ["home", "work", "favorite"];

const savedPlaceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: SAVED_PLACE_TYPES,
      default: "favorite",
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    lat: { type: Number, required: true, min: -90, max: 90 },
    long: { type: Number, required: true, min: -180, max: 180 },
    category: { type: String, trim: true, maxlength: 40, default: "" },
  },
  { timestamps: true, versionKey: false }
);

savedPlaceSchema.index(
  { userId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: { $in: ["home", "work"] } },
    name: "one_home_work_per_user",
  }
);
savedPlaceSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model("SavedPlace", savedPlaceSchema);

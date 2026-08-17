import mongoose from "mongoose";

const userPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    actorRole: {
      type: String,
      enum: ["passenger", "driver"],
      default: "passenger",
      index: true,
    },
    language: {
      type: String,
      enum: ["en", "ar"],
      default: "en",
    },
    notifications: {
      rideUpdates: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      accountUpdates: { type: Boolean, default: true },
      sounds: { type: Boolean, default: true },
      vibration: { type: Boolean, default: true },
    },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("UserPreference", userPreferenceSchema);

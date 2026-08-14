import mongoose from "mongoose";

export const SUPPORT_REPORT_CATEGORIES = [
  "ride",
  "driver",
  "passenger",
  "safety",
  "pickup",
  "points",
  "document",
  "technical",
  "app",
  "account",
  "other",
];

const supportReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      enum: ["passenger", "driver"],
      default: "passenger",
      index: true,
    },
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      default: null,
      index: true,
    },
    category: {
      type: String,
      enum: SUPPORT_REPORT_CATEGORIES,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["open", "reviewing", "resolved", "closed"],
      default: "open",
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

supportReportSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("SupportReport", supportReportSchema);

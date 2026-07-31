import mongoose from "mongoose";

export const POINTS_OUTBOX_EVENT_TYPES = [
  "points:wallet_updated",
  "points:reserved",
  "points:released",
  "points:charged",
  "points:credited",
  "points:purchase_request_updated",
  "points:notification",
];

const pointsOutboxEventSchema = new mongoose.Schema(
  {
    eventKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 8,
      maxlength: 240,
      immutable: true,
    },
    type: {
      type: String,
      enum: POINTS_OUTBOX_EVENT_TYPES,
      required: true,
      immutable: true,
    },
    aggregateType: {
      type: String,
      enum: ["wallet", "trip_offer", "purchase_request"],
      required: true,
      immutable: true,
    },
    aggregateId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    recipientType: {
      type: String,
      enum: ["Driver", "User", "Admin"],
      required: true,
      immutable: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: Object.freeze({}),
      immutable: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "delivered", "failed"],
      default: "pending",
      required: true,
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, trim: true, default: "", maxlength: 200 },
    deliveredAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: "", maxlength: 2000, select: false },
  },
  { timestamps: true, versionKey: false }
);

pointsOutboxEventSchema.pre("validate", function validateAttempts() {
  if (!Number.isSafeInteger(this.attempts)) {
    throw new Error("attempts must be a non-negative safe integer");
  }
});

pointsOutboxEventSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
pointsOutboxEventSchema.index({ aggregateType: 1, aggregateId: 1, createdAt: -1 });

export default mongoose.model("PointsOutboxEvent", pointsOutboxEventSchema);

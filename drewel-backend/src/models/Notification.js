import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    recipientType: {
      type: String,
      enum: ["user", "driver", "admin"],
      default: "user",
      index: true,
    },
    type: {
      type: String,
      default: "GENERAL",
      trim: true,
      maxlength: 80,
      index: true,
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    isValid: { type: Boolean, default: true, index: true },
    eventKey: {
      type: String,
      default: null,
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

notificationSchema.index(
  { eventKey: 1 },
  {
    unique: true,
    partialFilterExpression: { eventKey: { $type: "string" } },
    name: "unique_notification_event",
  }
);
notificationSchema.index({ userId: 1, recipientType: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;

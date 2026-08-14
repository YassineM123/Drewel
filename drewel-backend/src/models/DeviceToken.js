import mongoose from "mongoose";

const DEVICE_PLATFORMS = ["android", "ios", "web", "unknown"];

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userType: {
      type: String,
      enum: ["user", "driver", "admin"],
      default: "user",
      index: true,
    },
    token: {
      type: String,
      required: true,
      trim: true,
      maxlength: 512,
    },
    platform: {
      type: String,
      enum: DEVICE_PLATFORMS,
      default: "unknown",
    },
    deviceId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    appVersion: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: { type: Date, default: Date.now },
    registeredAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

// One active token per (userId, deviceId). A reinstall that changes deviceId
// simply registers a fresh row; the old row is deactivated when the same
// user re-registers from the same deviceId.
deviceTokenSchema.index(
  { userId: 1, deviceId: 1, token: 1 },
  { unique: true, name: "unique_device_token" }
);
// Fast lookup of a single physical token (provider invalidation, logout).
deviceTokenSchema.index({ token: 1, isActive: 1 });
deviceTokenSchema.index({ userId: 1, userType: 1, isActive: 1 });

const DeviceToken = mongoose.model("DeviceToken", deviceTokenSchema);

export default DeviceToken;

import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, default: "" },
    otpCode: { type: String, required: true, default: "" },
    type: {
      type: String,
      enum: ["user", "driver"],
      required: true,
      default: "user",
    },
    countryCode: { type: String, required: true, default: "" },
    expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 5 * 60 * 1000) }, // 5 minutes from now
  },
  {
    timestamps: true,
  }
);

// TTL index — MongoDB auto-deletes the document when expiresAt is reached
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ phone: 1, type: 1 });

export default mongoose.model("OTP", otpSchema);

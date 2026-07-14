import mongoose from "mongoose";
import { DEFAULT_PROFILE_IMAGE_URL } from "../utils/publicAssets.js";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: "" },
    countryCode: {
      type: String,
      default: "",
      set: (value) => {
        const digits = String(value ?? "").replace(/\D/g, "");
        return digits ? `+${digits}` : "";
      },
    },
    phone: {
      type: String,
      required: true,
      default: "",
      set: (value) =>
        String(value ?? "").replace(/\D/g, "").replace(/^0+/, ""),
    },

    long: {
      type: Number,
      default: 0,
    },
    lat: {
      type: Number,
      default: 0,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    otpCode: {
      type: String,
      default: null,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    profilePicture: {
      type: String,
      default: DEFAULT_PROFILE_IMAGE_URL,
    },
    isRestricted: {
      type: Boolean,
      default: false,
    },
  },

  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);

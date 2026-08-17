import mongoose from "mongoose";

export const ADMIN_ROLES = Object.freeze([
  "owner",
  "finance_admin",
  "admin",
  "support",
  "analyst",
  "user",
]);

const adminSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, default: "" },
    password: {
      type: String,
      required: true,
      select: false,
    },
    otpCode: {
      type: String,
      default: null,
      select: false,
    },
    role: {
      type: String,
      enum: ADMIN_ROLES,
      default: "user",
    },
    permissions: {
      type: [String],
      default: [],
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    profilePicture: {
      type: String,
      default:
        "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Admin", adminSchema);

import mongoose from "mongoose";

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
      enum: ["owner", "finance_admin", "admin", "user"],
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

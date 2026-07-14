import mongoose from "mongoose";

const driverLogsSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    countryCode: {
      type: String,
      required: true,
      default: "+91", // optional: default to India
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      match: /^[6-9]\d{9}$/,
    },
    whatsappNumber: {
      type: String,
      default: "",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otpCode: {
      type: String,
      default: "",
    },
    fullName: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      default: "",
    },
    vehicleType: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },

    licenseCompanyUrl: {
      type: String,
      default: "",
    },
    carLicenseFrontUrl: {
      type: String,
      default: "",
    },
    carLicenseBackUrl: {
      type: String,
      default: "",
    },
    drivingLicenseFrontUrl: {
      type: String,
      default: "",
    },
    drivingLicenseBackUrl: {
      type: String,
      default: "",
    },
    idProofFrontUrl: {
      type: String,
      default: "",
    },
    idProofBackUrl: {
      type: String,
      default: "",
    },
    passportCopyUrl: {
      type: String,
      default: "",
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
    isApproved: {
      type: Boolean,
      default: false,
    },
    isRestricted: {
      type: Boolean,
      default: false,
    },
    profileImageUrl: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    }
  },
  { timestamps: true }
);

export default mongoose.model("Driverlogs", driverLogsSchema);
import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    countryCode: {
      type: String,
      required: true,
      default: "+91", // optional: default to India
      set: (value) => {
        const digits = String(value ?? "").replace(/\D/g, "");
        return digits ? `+${digits}` : "+91";
      },
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      set: (value) => String(value ?? "").replace(/\D/g, ""),
      // Supports international local numbers (e.g. Tunisia/UAE) while keeping Indian numbers valid.
      match: /^\d{6,14}$/,
    },
    whatsappNumber: {
      type: String,
      default: "",
    },
    firstName: {
      type: String,
      default: "",
    },
    lastName: {
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
      select: false,
    },
    fullName: {
      type: String,
      default: "",
    },
    contractNumber: {
      type: String,
      default: "",
    },
    licenseCompany: {
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
    licenseCarUrl: {
      type: String,
      default: "",
    },
    licenseDriverUrl: {
      type: String,
      default: "",
    },
    idDocumentUrl: {
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
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
      index: true,
    },
    basicRequestSubmittedAt: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: "",
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
    },
    driverLogs: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driverlogs",
    },
    isUpdate: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

export default mongoose.model("Driver", driverSchema);

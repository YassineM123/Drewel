import mongoose from "mongoose";

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2,
        message: "currentLocation coordinates must be [longitude, latitude]",
      },
    },
  },
  { _id: false }
);

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
      trim: true,
      set: (value) => String(value ?? "").replace(/\D/g, ""),
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
    heading: {
      type: Number,
      default: null,
    },
    speed: {
      type: Number,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    presenceStatus: {
      type: String,
      enum: ["Online", "Offline"],
      default: "Offline",
      index: true,
    },
    presenceSessionId: { type: String, default: null, select: false },
    presenceLastHeartbeatAt: { type: Date, default: null },
    presenceLeaseExpiresAt: { type: Date, default: null, index: true },
    presenceDisconnectedAt: { type: Date, default: null },
    presenceVersion: { type: Number, default: 0, min: 0 },
    currentLocation: { type: geoPointSchema, default: undefined },
    locationUpdatedAt: { type: Date, default: null, index: true },
    locationAccuracyM: { type: Number, default: null, min: 0 },
    currentServiceArea: { type: String, enum: ["uae", "dubai", "tunisia-test", null], default: null, index: true },
    availabilityStatus: {
      type: String,
      enum: ["Online", "Busy", "Offline"],
      default: "Offline",
      index: true,
    },
    activeRideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      default: null,
      index: true,
    },
    activeRideStartedAt: {
      type: Date,
      default: null,
    },
    vehicleModel: {
      type: String,
      default: "",
      maxlength: 120,
    },
    registration: {
      type: String,
      default: "",
      maxlength: 40,
    },
    registrationVisible: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      default: null,
      min: 0,
      max: 5,
    },
    priceEstimate: {
      type: Number,
      default: null,
      min: 0,
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
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },
    pendingSince: {
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
    profileRequestStatus: {
      type: String,
      enum: ["not_submitted", "pending", "approved", "rejected"],
      default: "not_submitted",
      index: true,
    },
    profileSubmittedAt: {
      type: Date,
      default: null,
    },
    profileApprovedAt: {
      type: Date,
      default: null,
    },
    profileApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },
    profileRejectionReason: {
      type: String,
      default: "",
      maxlength: 1000,
    },
isRestricted: {
      type: Boolean,
      default: false,
    },
    restrictedReason: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    restrictedAt: {
      type: Date,
      default: null,
    },
    restrictedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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
    },
    bio: {
      type: String,
      default: "",
      maxlength: 500,
    },
    experienceYears: {
      type: Number,
      default: null,
      min: 0,
      max: 50,
    },
    languages: {
      type: [String],
      default: [],
    },
    publicProfileEnabled: {
      type: Boolean,
      default: true,
    },
    favoriteDrivers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Driver",
      default: [],
    },
  },
  { timestamps: true }
);

driverSchema.index({ status: 1, approvedAt: -1, _id: -1 });
driverSchema.index({ status: 1, basicRequestSubmittedAt: -1, _id: -1 });
driverSchema.index({ status: 1, approvedBy: 1, approvedAt: -1 });
driverSchema.index({ profileRequestStatus: 1, profileSubmittedAt: -1, _id: -1 });
driverSchema.index({ profileRequestStatus: 1, profileApprovedBy: 1, profileApprovedAt: -1 });
driverSchema.index({ isOnline: 1, availabilityStatus: 1, city: 1, vehicleType: 1 });
driverSchema.index(
  { presenceStatus: 1, presenceLeaseExpiresAt: 1 },
  { name: "driver_presence_lease" }
);
driverSchema.index(
  { currentLocation: "2dsphere" },
  { sparse: true, name: "currentLocation_2dsphere" }
);
driverSchema.index(
  { currentServiceArea: 1, isOnline: 1, availabilityStatus: 1, locationUpdatedAt: -1 },
  { name: "marketplace_availability" }
);

const Driver = mongoose.model("Driver", driverSchema);

export const ensureMarketplaceDriverIndexes = async () => {
  await Driver.collection.createIndex(
    { currentLocation: "2dsphere" },
    { sparse: true, name: "currentLocation_2dsphere" }
  );
  await Driver.collection.createIndex(
    { currentServiceArea: 1, isOnline: 1, availabilityStatus: 1, locationUpdatedAt: -1 },
    { name: "marketplace_availability" }
  );
  await Driver.collection.createIndex(
    { presenceStatus: 1, presenceLeaseExpiresAt: 1 },
    { name: "driver_presence_lease" }
  );
  const indexes = await Driver.collection.indexes();
  for (const required of [
    "currentLocation_2dsphere",
    "marketplace_availability",
    "driver_presence_lease",
  ]) {
    if (!indexes.some((index) => index.name === required)) {
      throw new Error(`Required marketplace index is missing: ${required}`);
    }
  }
};

export default Driver;

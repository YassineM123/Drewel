import mongoose from "mongoose";

export const DISPUTE_STATUSES = [
  "open",
  "under_review",
  "waiting_user",
  "waiting_driver",
  "resolved",
  "rejected",
];

export const DISPUTE_REASONS = [
  "overcharge",
  "route_deviation",
  "driver_misconduct",
  "no_show",
  "safety_concern",
  "payment_issue",
  "app_malfunction",
  "driver_cancelled",
  "trip_not_completed",
  "other",
];

export const DISPUTE_PRIORITIES = ["low", "medium", "high", "urgent"];

export const DISPUTE_RESOLUTIONS = ["driver", "user", "split", "rejected"];

const disputeNoteSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    adminName: { type: String, default: "" },
    text: { type: String, required: true, maxlength: 2000 },
    isInternal: { type: Boolean, default: true },
  },
  { _id: true, timestamps: true, versionKey: false }
);

const operationalDisputeSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },
    rideReference: { type: String, default: "", maxlength: 60 },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: DISPUTE_STATUSES,
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: DISPUTE_PRIORITIES,
      default: "medium",
      index: true,
    },
    reason: {
      type: String,
      enum: DISPUTE_REASONS,
      required: true,
      index: true,
    },
    description: { type: String, default: "", maxlength: 2000 },
    openedBy: {
      type: String,
      enum: ["admin", "user", "driver", "system"],
      default: "admin",
    },
    openedById: { type: mongoose.Schema.Types.ObjectId, default: null },

    driverStatement: { type: String, default: "", maxlength: 2000 },
    userStatement: { type: String, default: "", maxlength: 2000 },

    assignedAdmin: {
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
      adminName: { type: String, default: "" },
      assignedAt: { type: Date, default: null },
    },
    internalNotes: [disputeNoteSchema],

    resolution: {
      decision: {
        type: String,
        enum: [...DISPUTE_RESOLUTIONS, ""],
        default: "",
      },
      pointsAdjustment: { type: Number, default: 0 },
      note: { type: String, default: "", maxlength: 2000 },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
      resolvedByName: { type: String, default: "" },
      resolvedAt: { type: Date, default: null },
    },

    rideSnapshot: {
      pickupAddress: { type: String, default: "" },
      destinationAddress: { type: String, default: "" },
      agreedPrice: { type: Number, default: null },
      vehicleType: { type: String, default: "" },
      rideStatus: { type: String, default: "" },
    },
    pointsTransactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "PointTransaction" }],
  },
  { timestamps: true, versionKey: false }
);

operationalDisputeSchema.index({ status: 1, priority: 1, createdAt: -1 });
operationalDisputeSchema.index({ status: 1, reason: 1, createdAt: -1 });
operationalDisputeSchema.index({ "assignedAdmin.adminId": 1, status: 1 });

const OperationalDispute = mongoose.model("OperationalDispute", operationalDisputeSchema);
export default OperationalDispute;

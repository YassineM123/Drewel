import mongoose from "mongoose";

export const POINT_PURCHASE_REQUEST_STATUSES = [
  "pending",
  "contacted",
  "payment_pending",
  "payment_verified",
  "credited",
  "rejected",
  "cancelled",
];

const pointPurchaseRequestSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      immutable: true,
    },
    requestedPackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PointPack",
      default: null,
      immutable: true,
    },
    requestedPoints: { type: Number, default: null, min: 1, immutable: true },
    packSnapshot: {
      name: { type: String, trim: true, default: "", immutable: true },
      points: { type: Number, default: null, min: 1, immutable: true },
      price: { type: Number, default: null, min: 0, immutable: true },
      currency: {
        type: String,
        uppercase: true,
        trim: true,
        default: "",
        match: /^$|^[A-Z]{3}$/,
        immutable: true,
      },
    },
    clientRequestId: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 200,
      immutable: true,
    },
    status: {
      type: String,
      enum: POINT_PURCHASE_REQUEST_STATUSES,
      default: "pending",
      required: true,
      index: true,
    },
    contactSnapshot: {
      phone: { type: String, trim: true, default: "" },
      whatsappNumber: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, lowercase: true, default: "" },
    },
    ownerAdminNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
      select: false,
    },
    paymentReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
      select: false,
    },
    paymentAmount: { type: Number, default: null, min: 0, select: false },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: "",
      match: /^$|^[A-Z]{3}$/,
      select: false,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
      select: false,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      select: false,
    },
    contactedAt: { type: Date, default: null },
    paymentVerifiedAt: { type: Date, default: null },
    creditedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

pointPurchaseRequestSchema.pre("validate", function validateRequestedPoints() {
  const hasPack = Boolean(this.requestedPackId);
  const hasPoints = this.requestedPoints !== null && this.requestedPoints !== undefined;
  if (hasPack === hasPoints) {
    throw new Error("Exactly one of requestedPackId or requestedPoints is required");
  }
  if (hasPoints && !Number.isSafeInteger(this.requestedPoints)) {
    throw new Error("requestedPoints must be a safe integer");
  }
});

pointPurchaseRequestSchema.index({ driverId: 1, clientRequestId: 1 }, { unique: true });
pointPurchaseRequestSchema.index({ driverId: 1, createdAt: -1, _id: -1 });
pointPurchaseRequestSchema.index({ status: 1, createdAt: -1, _id: -1 });
pointPurchaseRequestSchema.index(
  { paymentReference: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentReference: { $gt: "" } },
    name: "unique_nonempty_purchase_payment_reference",
  }
);

export default mongoose.model("PointPurchaseRequest", pointPurchaseRequestSchema);

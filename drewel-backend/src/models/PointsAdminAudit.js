import mongoose from "mongoose";

export const POINTS_ADMIN_AUDIT_ACTIONS = Object.freeze([
  "POINTS_CREDIT",
  "POINTS_DEBIT",
  "PURCHASE_REQUEST_TRANSITION",
  "POINTS_SETTINGS_UPDATE",
  "POINT_PACK_CREATE",
  "POINT_PACK_UPDATE",
]);

const pointsAdminAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: POINTS_ADMIN_AUDIT_ACTIONS,
      required: true,
      immutable: true,
      index: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      immutable: true,
      index: true,
    },
    adminRole: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      immutable: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      immutable: true,
      index: true,
    },
    previousAvailableBalance: {
      type: Number,
      min: 0,
      default: null,
      immutable: true,
    },
    newAvailableBalance: {
      type: Number,
      min: 0,
      default: null,
      immutable: true,
    },
    pointsChange: {
      type: Number,
      default: 0,
      immutable: true,
    },
    reason: {
      type: String,
      trim: true,
      required: true,
      maxlength: 1000,
      immutable: true,
    },
    paymentReferenceMasked: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
      immutable: true,
    },
    paymentReferenceHash: {
      type: String,
      default: "",
      select: false,
      immutable: true,
    },
    purchaseRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PointPurchaseRequest",
      default: null,
      immutable: true,
      index: true,
    },
    pointTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PointTransaction",
      default: null,
      immutable: true,
    },
    pointPackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PointPack",
      default: null,
      immutable: true,
    },
    requestId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
      immutable: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
      immutable: true,
    },
    userAgent: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
      immutable: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
      immutable: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: Object.freeze({}),
      immutable: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

pointsAdminAuditSchema.pre("validate", function validateBalances() {
  for (const field of [
    "previousAvailableBalance",
    "newAvailableBalance",
    "pointsChange",
  ]) {
    const value = this.get(field);
    if (value !== null && !Number.isSafeInteger(value)) {
      throw new Error(`${field} must be a safe integer`);
    }
  }
  const hasPrevious = this.previousAvailableBalance !== null;
  const hasNew = this.newAvailableBalance !== null;
  if (hasPrevious !== hasNew) {
    throw new Error(
      "previousAvailableBalance and newAvailableBalance must be recorded together"
    );
  }
  if (
    ["POINTS_CREDIT", "POINTS_DEBIT"].includes(this.action) &&
    (!this.driverId || !hasPrevious)
  ) {
    throw new Error(
      "Wallet adjustments require driver and balance audit evidence"
    );
  }
  if (
    hasPrevious &&
    this.newAvailableBalance - this.previousAvailableBalance !==
      this.pointsChange
  ) {
    throw new Error("pointsChange must match the recorded balance difference");
  }
});

pointsAdminAuditSchema.index({ idempotencyKey: 1 }, { unique: true });
pointsAdminAuditSchema.index({ createdAt: -1, _id: -1 });
pointsAdminAuditSchema.index({ driverId: 1, createdAt: -1, _id: -1 });
pointsAdminAuditSchema.index({ adminId: 1, createdAt: -1, _id: -1 });

const rejectMutation = function rejectMutation() {
  throw new Error("Points administrator audit records are append-only");
};

for (const hook of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
]) {
  pointsAdminAuditSchema.pre(hook, rejectMutation);
}

pointsAdminAuditSchema.pre("save", function rejectExistingSave() {
  if (!this.isNew) {
    throw new Error("Points administrator audit records are append-only");
  }
});
pointsAdminAuditSchema.pre(
  "deleteOne",
  { document: true, query: false },
  rejectMutation
);

export default mongoose.model("PointsAdminAudit", pointsAdminAuditSchema);

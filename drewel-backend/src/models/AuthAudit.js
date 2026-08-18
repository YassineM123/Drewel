import mongoose from "mongoose";

export const AUTH_AUDIT_ACTIONS = [
  "login_success",
  "login_failure",
  "logout",
  "password_changed",
  "admin_created",
  "admin_role_changed",
  "admin_deactivated",
  "admin_reactivated",
  "ride_cancelled",
  "ride_unlock",
  "driver_approved",
  "driver_rejected",
  "point_added",
  "point_refunded",
  "request_approved",
  "dispute_resolved",
  "sponsor_changed",
  "settings_changed",
  "role_changed",
];

const authAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: AUTH_AUDIT_ACTIONS,
      required: true,
      index: true,
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    actorRole: { type: String, default: "" },
    actorName: { type: String, default: "" },
    actorEmail: { type: String, default: "" },
    targetType: {
      type: String,
      enum: ["admin", "driver", "user", "ride", "points", "settings", "sponsor", "system", ""],
      default: "",
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    description: { type: String, default: "", maxlength: 1000 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false, versionKey: false }
);

authAuditSchema.index({ action: 1, occurredAt: -1 });
authAuditSchema.index({ actorId: 1, occurredAt: -1 });
authAuditSchema.index({ targetType: 1, targetId: 1, occurredAt: -1 });

const AuthAudit = mongoose.model("AuthAudit", authAuditSchema);
export default AuthAudit;

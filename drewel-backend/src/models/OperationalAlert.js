import mongoose from "mongoose";

export const ALERT_TYPES = [
  "stuck_ride",
  "stale_gps",
  "busy_driver_no_active_ride",
  "multiple_active_rides",
  "invalid_ride_lock",
  "negative_inconsistent_points",
  "expired_point_reservation",
  "google_routes_failure",
  "socketio_interruption",
  "pickup_pin_failures",
  "expiring_driver_documents",
];

export const ALERT_SEVERITIES = ["critical", "warning", "info"];

export const ALERT_STATUSES = ["open", "acknowledged", "investigating", "resolved"];

const operationalAlertSchema = new mongoose.Schema(
  {
    alertType: {
      type: String,
      enum: ALERT_TYPES,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ALERT_SEVERITIES,
      default: "warning",
      index: true,
    },
    title: { type: String, required: true, maxlength: 300 },
    description: { type: String, default: "", maxlength: 2000 },
    status: {
      type: String,
      enum: ALERT_STATUSES,
      default: "open",
      index: true,
    },
    entity: {
      entityType: {
        type: String,
        enum: ["ride", "driver", "user", "system", "points", "trip_offer", null],
        default: null,
      },
      entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
      label: { type: String, default: "", maxlength: 300 },
    },
    assignedAdmin: {
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
      adminName: { type: String, default: "" },
      assignedAt: { type: Date, default: null },
    },
    acknowledgement: {
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
      adminName: { type: String, default: "" },
      acknowledgedAt: { type: Date, default: null },
    },
    resolution: {
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
      adminName: { type: String, default: "" },
      resolvedAt: { type: Date, default: null },
      note: { type: String, default: "", maxlength: 2000 },
      outcome: {
        type: String,
        enum: ["fixed", "wont_fix", "duplicate", "false_positive", "other", ""],
        default: "",
      },
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    detectedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false }
);

operationalAlertSchema.index({ status: 1, severity: 1, detectedAt: -1 });
operationalAlertSchema.index({ alertType: 1, status: 1, detectedAt: -1 });
operationalAlertSchema.index({ "entity.entityType": 1, "entity.entityId": 1 });

const OperationalAlert = mongoose.model("OperationalAlert", operationalAlertSchema);
export default OperationalAlert;

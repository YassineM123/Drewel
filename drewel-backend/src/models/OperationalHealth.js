import mongoose from "mongoose";

export const HEALTH_SERVICE_IDS = [
  "api",
  "database",
  "socket_io",
  "location_stream",
  "google_maps",
  "google_routes",
  "chat",
  "notifications",
  "storage",
];

// Historical health/incident records may still reference the retired call
// service. Accept those records without scheduling new runtime checks for it.
const HEALTH_SERVICE_SCHEMA_IDS = [...HEALTH_SERVICE_IDS, "secure_calls"];

export const HEALTH_STATUSES = ["operational", "degraded", "outage", "maintenance"];

const healthCheckSchema = new mongoose.Schema(
  {
    serviceId: {
      type: String,
      enum: HEALTH_SERVICE_SCHEMA_IDS,
      required: true,
      index: true,
    },
    serviceName: { type: String, required: true },
    status: {
      type: String,
      enum: HEALTH_STATUSES,
      default: "operational",
      index: true,
    },
    latencyMs: { type: Number, default: null },
    errorRatePct: { type: Number, default: 0, min: 0, max: 100 },
    uptimePct: { type: Number, default: 100, min: 0, max: 100 },
    errorCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
    lastCheckedAt: { type: Date, default: Date.now },
    errorTrend: { type: [Number], default: [] },
  },
  { _id: false, versionKey: false }
);

const incidentUpdateSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 1000 },
    status: { type: String, default: "" },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    adminName: { type: String, default: "" },
    occurredAt: { type: Date, default: Date.now },
  },
  { _id: false, versionKey: false }
);

const incidentSchema = new mongoose.Schema(
  {
    incidentId: { type: String, required: true, unique: true },
    title: { type: String, required: true, maxlength: 300 },
    serviceId: { type: String, enum: HEALTH_SERVICE_SCHEMA_IDS, required: true },
    severity: {
      type: String,
      enum: ["critical", "warning", "info"],
      default: "warning",
    },
    status: {
      type: String,
      enum: ["investigating", "identified", "monitoring", "resolved"],
      default: "investigating",
    },
    startedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    updates: [incidentUpdateSchema],
  },
  { timestamps: true, versionKey: false }
);

incidentSchema.index({ status: 1, startedAt: -1 });
incidentSchema.index({ serviceId: 1, startedAt: -1 });

const operationalHealthSchema = new mongoose.Schema(
  {
    services: { type: [healthCheckSchema], default: [] },
    overallStatus: {
      type: String,
      enum: HEALTH_STATUSES,
      default: "operational",
    },
    checkedAt: { type: Date, default: Date.now },
    avgLatencyMs: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

operationalHealthSchema.index({ checkedAt: -1 });

const OperationalHealth = mongoose.model("OperationalHealth", operationalHealthSchema);
export const Incident = mongoose.model("Incident", incidentSchema);
export default OperationalHealth;

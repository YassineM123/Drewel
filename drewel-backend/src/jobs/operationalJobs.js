import OperationalHealth, { Incident, HEALTH_SERVICE_IDS } from "../models/OperationalHealth.js";
import { detectOperationalAlerts } from "../controllers/operationalController.js";
import mongoose from "mongoose";

const SERVICE_NAMES = {
  api: "Main API",
  database: "Database",
  socket_io: "Socket.IO",
  location_stream: "Driver Location Stream",
  google_maps: "Google Maps",
  google_routes: "Google Routes",
  chat: "In-App Chat",
  secure_calls: "Secure Calls",
  notifications: "Notifications",
  storage: "File Storage",
};

const checkDatabase = async () => {
  const start = Date.now();
  try {
    await mongoose.connection.db.admin().ping();
    return { status: "operational", latencyMs: Date.now() - start };
  } catch {
    return { status: "outage", latencyMs: Date.now() - start, lastError: "Database ping failed" };
  }
};

const checkApi = async () => {
  const start = Date.now();
  try {
    const health = mongoose.connection.readyState === 1;
    return { status: health ? "operational" : "outage", latencyMs: Date.now() - start };
  } catch {
    return { status: "outage", latencyMs: Date.now() - start, lastError: "API check failed" };
  }
};

const checkSocketIo = async () => {
  try {
    const available = Boolean(global.io);
    const connectedCount = available ? (global.io.engine?.clientsCount || 0) : 0;
    return {
      status: available ? "operational" : "outage",
      latencyMs: 0,
      metadata: { connectedClients: connectedCount },
    };
  } catch {
    return { status: "outage", latencyMs: 0, lastError: "Socket.IO check failed" };
  }
};

const checkNotifications = async () => {
  const configured = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FCM_SERVICE_ACCOUNT_JSON
  );
  return {
    status: configured ? "operational" : "degraded",
    latencyMs: 0,
    lastError: configured ? "" : "Firebase not configured",
  };
};

const checkStorage = async () => {
  const configured = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET);
  return {
    status: configured ? "operational" : "degraded",
    latencyMs: 0,
    lastError: configured ? "" : "S3 not configured",
  };
};

const checkGoogleRoutes = async () => {
  const configured = Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_ROUTES_API_KEY);
  return {
    status: configured ? "operational" : "degraded",
    latencyMs: 0,
    lastError: configured ? "" : "Google Routes API key not configured",
  };
};

const checkGoogleMaps = async () => {
  const configured = Boolean(process.env.GOOGLE_MAPS_API_KEY);
  return {
    status: configured ? "operational" : "degraded",
    latencyMs: 0,
    lastError: configured ? "" : "Google Maps API key not configured",
  };
};

const SERVICE_CHECKERS = {
  api: checkApi,
  database: checkDatabase,
  socket_io: checkSocketIo,
  location_stream: async () => ({ status: Boolean(global.io) ? "operational" : "degraded", latencyMs: 0 }),
  google_maps: checkGoogleMaps,
  google_routes: checkGoogleRoutes,
  chat: async () => ({ status: Boolean(global.io) ? "operational" : "degraded", latencyMs: 0 }),
  secure_calls: async () => {
    const configured = Boolean(process.env.AGORA_APP_ID);
    return { status: configured ? "operational" : "degraded", latencyMs: 0, lastError: configured ? "" : "Agora not configured" };
  },
  notifications: checkNotifications,
  storage: checkStorage,
};

const detectServiceIncidents = async (services) => {
  for (const svc of services) {
    if (svc.status === "outage") {
      const existing = await Incident.findOne({
        serviceId: svc.serviceId,
        status: { $in: ["investigating", "identified", "monitoring"] },
      });
      if (!existing) {
        const count = await Incident.countDocuments({});
        await Incident.create({
          incidentId: `INC-${String(count + 1).padStart(4, "0")}`,
          title: `${svc.serviceName} outage detected`,
          serviceId: svc.serviceId,
          severity: "critical",
          status: "investigating",
          updates: [
            {
              text: `Automated detection: ${svc.serviceName} is experiencing an outage.`,
              status: "investigating",
            },
          ],
        });
      }
    }
  }
};

export const runHealthCheck = async () => {
  const services = [];

  for (const serviceId of HEALTH_SERVICE_IDS) {
    const checker = SERVICE_CHECKERS[serviceId];
    if (!checker) continue;

    const result = await checker();
    services.push({
      serviceId,
      serviceName: SERVICE_NAMES[serviceId] || serviceId,
      status: result.status || "operational",
      latencyMs: result.latencyMs ?? null,
      errorRatePct: 0,
      uptimePct: result.status === "operational" ? 100 : result.status === "degraded" ? 95 : 0,
      errorCount: result.status === "outage" ? 1 : 0,
      successCount: result.status === "operational" ? 1 : 0,
      lastError: result.lastError || "",
      lastCheckedAt: new Date(),
      errorTrend: [],
    });
  }

  const outageCount = services.filter((s) => s.status === "outage").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const overallStatus = outageCount > 0 ? "outage" : degradedCount > 0 ? "degraded" : "operational";
  const avgLatency = services.reduce((sum, s) => sum + (s.latencyMs || 0), 0) / services.length;

  await OperationalHealth.create({
    services,
    overallStatus,
    avgLatencyMs: Math.round(avgLatency),
    checkedAt: new Date(),
  });

  await detectServiceIncidents(services);

  return { overallStatus, serviceCount: services.length, outageCount, degradedCount };
};

export const runAlertDetection = async () => {
  return detectOperationalAlerts();
};

let healthInterval = null;
let alertInterval = null;

export const startOperationalJobs = () => {
  if (healthInterval) clearInterval(healthInterval);
  if (alertInterval) clearInterval(alertInterval);

  console.log("[operational-jobs] Starting health checks (every 60s) and alert detection (every 120s)");
  runHealthCheck().catch((err) => console.error("[operational-jobs] Initial health check failed:", err.message));
  runAlertDetection().catch((err) => console.error("[operational-jobs] Initial alert detection failed:", err.message));

  healthInterval = setInterval(() => {
    runHealthCheck().catch((err) => console.error("[operational-jobs] Health check failed:", err.message));
  }, 60 * 1000);

  alertInterval = setInterval(() => {
    runAlertDetection().catch((err) => console.error("[operational-jobs] Alert detection failed:", err.message));
  }, 2 * 60 * 1000);
};

export const stopOperationalJobs = () => {
  if (healthInterval) { clearInterval(healthInterval); healthInterval = null; }
  if (alertInterval) { clearInterval(alertInterval); alertInterval = null; }
};

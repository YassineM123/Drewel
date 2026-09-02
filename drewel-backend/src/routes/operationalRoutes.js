import express from "express";
import { isAdmin, requireSignIn } from "../middlewares/authMiddleware.js";
import {
  listAlerts,
  getAlert,
  acknowledgeAlert,
  assignAlert,
  investigateAlert,
  resolveAlert,
  listDisputes,
  getDispute,
  createDispute,
  updateDisputeStatus,
  assignDispute,
  addDisputeNote,
  resolveDispute,
  getOperationalHealth,
  getOperationalHealthTrend,
  createIncident,
  updateIncident,
  listOperationalAuditLogs,
  getLiveOperationsMap,
  searchLiveOperationsMap,
} from "../controllers/operationalController.js";

const router = express.Router();

// Alerts
router.get("/alerts", requireSignIn, isAdmin, listAlerts);
router.get("/alerts/:id", requireSignIn, isAdmin, getAlert);
router.post("/alerts/:id/acknowledge", requireSignIn, isAdmin, acknowledgeAlert);
router.post("/alerts/:id/assign", requireSignIn, isAdmin, assignAlert);
router.post("/alerts/:id/investigate", requireSignIn, isAdmin, investigateAlert);
router.post("/alerts/:id/resolve", requireSignIn, isAdmin, resolveAlert);

// Disputes
router.get("/disputes", requireSignIn, isAdmin, listDisputes);
router.get("/disputes/:id", requireSignIn, isAdmin, getDispute);
router.post("/disputes", requireSignIn, isAdmin, createDispute);
router.patch("/disputes/:id/status", requireSignIn, isAdmin, updateDisputeStatus);
router.post("/disputes/:id/assign", requireSignIn, isAdmin, assignDispute);
router.post("/disputes/:id/notes", requireSignIn, isAdmin, addDisputeNote);
router.post("/disputes/:id/resolve", requireSignIn, isAdmin, resolveDispute);

// System Health
router.get("/health", requireSignIn, isAdmin, getOperationalHealth);
router.get("/health/trend", requireSignIn, isAdmin, getOperationalHealthTrend);
router.post("/incidents", requireSignIn, isAdmin, createIncident);
router.patch("/incidents/:id", requireSignIn, isAdmin, updateIncident);

// Audit Logs (cross-domain)
router.get("/audit-logs", requireSignIn, isAdmin, listOperationalAuditLogs);

// Live Operations Map
router.get("/live-map", requireSignIn, isAdmin, getLiveOperationsMap);
router.get("/live-map/search", requireSignIn, isAdmin, searchLiveOperationsMap);

export default router;

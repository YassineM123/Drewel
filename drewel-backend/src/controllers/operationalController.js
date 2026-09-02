import mongoose from "mongoose";
import OperationalAlert, {
  ALERT_TYPES,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
} from "../models/OperationalAlert.js";
import OperationalDispute, {
  DISPUTE_STATUSES,
  DISPUTE_REASONS,
  DISPUTE_PRIORITIES,
} from "../models/OperationalDispute.js";
import OperationalHealth, {
  Incident,
  HEALTH_SERVICE_IDS,
} from "../models/OperationalHealth.js";
import AuthAudit from "../models/AuthAudit.js";
import RideAudit from "../models/RideAudit.js";
import RequestAudit from "../models/RequestAudit.js";
import CommunicationAudit from "../models/CommunicationAudit.js";
import PointsAdminAudit from "../models/PointsAdminAudit.js";
import Ride from "../models/Ride.js";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import { ACTIVE_RIDE_STATUSES } from "../models/Ride.js";
import DriverPointsWallet from "../models/DriverPointsWallet.js";

const isObjectId = (value) => mongoose.isValidObjectId(value);

const pagination = (req, max = 100) => ({
  page: Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1),
  limit: Math.min(
    max,
    Math.max(1, Number.parseInt(req.query.limit || "25", 10) || 25)
  ),
});

const dateRange = (req, field = "createdAt") => {
  const query = req.query || {};
  const range = {};
  if (query.from) {
    const value = new Date(String(query.from));
    if (Number.isNaN(value.getTime())) {
      const error = new Error("from is invalid");
      error.statusCode = 400;
      throw error;
    }
    range.$gte = value;
  }
  if (query.to) {
    const value = new Date(String(query.to));
    if (Number.isNaN(value.getTime())) {
      const error = new Error("to is invalid");
      error.statusCode = 400;
      throw error;
    }
    range.$lte = value;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) {
    const error = new Error("from must not be after to");
    error.statusCode = 400;
    throw error;
  }
  return Object.keys(range).length ? { [field]: range } : {};
};

const sendError = (res, error) => {
  const status = error.statusCode || error.status || 500;
  return res.status(status).json({
    success: false,
    code: error.code || "OPERATIONAL_ERROR",
    message: status >= 500 ? "Internal server error" : error.message,
  });
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pointsPerAED = () => {
  const value = Number(process.env.DRIVER_POINTS_PER_AED || process.env.POINTS_PER_AED || 10);
  return Number.isFinite(value) && value > 0 ? value : 10;
};

const adminDriverFields =
  "firstName lastName fullName phone whatsappNumber profileImageUrl isOnline isApproved isRestricted isDeleted status lat long heading speed currentLocation currentServiceArea locationAccuracyM activeRideId vehicleType vehicleModel registration locationUpdatedAt availabilityStatus presenceStatus presenceLastHeartbeatAt presenceVersion rating updatedAt";

const driverName = (driver) =>
  driver.fullName || [driver.firstName, driver.lastName].filter(Boolean).join(" ").trim();

const driverLocation = (driver) => {
  const coordinates = driver.currentLocation?.coordinates;
  const long = Array.isArray(coordinates) ? Number(coordinates[0]) : Number(driver.long);
  const lat = Array.isArray(coordinates) ? Number(coordinates[1]) : Number(driver.lat);
  if (!Number.isFinite(lat) || !Number.isFinite(long) || lat < -90 || lat > 90 || long < -180 || long > 180) {
    return null;
  }
  return {
    lat,
    long,
    heading: Number.isFinite(Number(driver.heading)) ? Number(driver.heading) : null,
    speed: Number.isFinite(Number(driver.speed)) ? Number(driver.speed) : null,
    accuracyM: Number.isFinite(Number(driver.locationAccuracyM)) ? Number(driver.locationAccuracyM) : null,
    updatedAt: driver.locationUpdatedAt || null,
  };
};

const availability = (driver) => {
  if (!driver.isOnline || driver.presenceStatus === "Offline") return "offline";
  if (driver.activeRideId) return "on_ride";
  if (driver.availabilityStatus === "Busy") return "busy";
  if (driver.availabilityStatus === "Online") return "available";
  return "online";
};

const freshness = (driver, now = new Date()) => {
  if (!driver.isOnline || driver.presenceStatus === "Offline") return "offline";
  const time = driver.locationUpdatedAt ? new Date(driver.locationUpdatedAt).getTime() : NaN;
  if (!Number.isFinite(time)) return "unavailable";
  return time < now.getTime() - 2 * 60 * 1000 ? "stale" : "live";
};

const rideMapDto = (ride) => {
  const fare = Number(ride.agreedPrice);
  const hasFare = Number.isFinite(fare);
  return {
    id: String(ride._id),
    reference: ride.reference,
    status: ride.status,
    driverId: ride.driverId?._id ? String(ride.driverId._id) : String(ride.driverId),
    passengerId: ride.passengerId?._id ? String(ride.passengerId._id) : String(ride.passengerId),
    driver: ride.driverId && typeof ride.driverId === "object"
      ? { id: String(ride.driverId._id), fullName: driverName(ride.driverId), vehicleType: ride.driverId.vehicleType || "" }
      : null,
    passenger: ride.passengerId && typeof ride.passengerId === "object"
      ? { id: String(ride.passengerId._id), fullName: ride.passengerId.fullName || "" }
      : null,
    pickup: ride.pickup || null,
    destination: ride.destination || null,
    estimatedFareAED: hasFare ? fare : null,
    estimatedCommissionAED: hasFare ? Math.round(fare * 10) / 100 : null,
    estimatedPoints: hasFare ? Math.round(fare * pointsPerAED() * 0.1) : null,
    finalCommission: ride.commission || null,
    startedAt: ride.startedAt || ride.pickupConfirmedAt || null,
    requestedAt: ride.requestedAt || null,
    distanceMeters: ride.routeSnapshot?.distanceMeters ?? null,
    durationSeconds: ride.routeSnapshot?.durationSeconds ?? null,
    routePolyline: ride.routeSnapshot?.encodedPolyline || "",
    lastDriverLocation: ride.lastDriverLocation || null,
    updatedAt: ride.updatedAt,
  };
};

const buildLiveOperations = async (query = {}) => {
  const now = new Date();
  const lowBalanceThreshold = Math.max(0, Number.parseInt(query.lowBalanceThreshold || "100", 10) || 100);
  const driverFilter = { isDeleted: { $ne: true } };
  if (query.vehicleType && query.vehicleType !== "all") driverFilter.vehicleType = new RegExp(`^${escapeRegex(query.vehicleType)}$`, "i");

  const [drivers, activeRides] = await Promise.all([
    Driver.find(driverFilter).select(adminDriverFields).sort({ locationUpdatedAt: -1, _id: 1 }).limit(1500).lean(),
    Ride.find({ status: { $in: ACTIVE_RIDE_STATUSES } })
      .populate("driverId", "firstName lastName fullName vehicleType")
      .populate("passengerId", "fullName")
      .sort({ updatedAt: -1 })
      .limit(300)
      .lean(),
  ]);

  const driverIds = drivers.map((driver) => driver._id);
  const [wallets, completedCounts] = await Promise.all([
    DriverPointsWallet.find({ driverId: { $in: driverIds } }).lean({ virtuals: true }),
    Ride.aggregate([
      { $match: { driverId: { $in: driverIds }, status: "completed" } },
      { $group: { _id: "$driverId", completed: { $sum: 1 } } },
    ]),
  ]);
  const walletsByDriver = new Map(wallets.map((wallet) => [String(wallet.driverId), wallet]));
  const completedByDriver = new Map(completedCounts.map((row) => [String(row._id), Number(row.completed || 0)]));
  const activeRideByDriver = new Map(activeRides.map((ride) => [String(ride.driverId?._id || ride.driverId), ride]));

  const liveDrivers = drivers.map((driver) => {
    const wallet = walletsByDriver.get(String(driver._id)) || {};
    const availablePoints =
      Number(wallet.availablePoints) ||
      Number(wallet.availableBonusPoints || 0) + Number(wallet.availablePurchasedPoints || 0);
    const activeRide = activeRideByDriver.get(String(driver._id));
    return {
      id: String(driver._id),
      _id: String(driver._id),
      fullName: driverName(driver),
      phone: driver.phone || driver.whatsappNumber || "",
      profileImageUrl: driver.profileImageUrl || "",
      rating: Number.isFinite(Number(driver.rating)) ? Number(driver.rating) : null,
      isOnline: Boolean(driver.isOnline),
      availabilityStatus: availability(driver),
      rawAvailabilityStatus: driver.availabilityStatus || "",
      gpsFreshness: freshness(driver, now),
      location: driverLocation(driver),
      vehicle: {
        type: driver.vehicleType || "",
        model: driver.vehicleModel || "",
        plateNumber: driver.registration || "",
      },
      points: {
        available: availablePoints,
        creditAED: Math.round((availablePoints / pointsPerAED()) * 100) / 100,
        lowBalance: availablePoints < lowBalanceThreshold,
      },
      completedRides: completedByDriver.get(String(driver._id)) || 0,
      currentRideId: activeRide ? String(activeRide._id) : null,
      currentRide: activeRide ? rideMapDto(activeRide) : null,
      lastLocationAt: driver.locationUpdatedAt || null,
      presenceLastHeartbeatAt: driver.presenceLastHeartbeatAt || null,
      lastActivityAt: driver.locationUpdatedAt || driver.presenceLastHeartbeatAt || driver.updatedAt || null,
    };
  });

  const totals = liveDrivers.reduce((acc, driver) => {
    acc.totalDrivers += 1;
    acc.online += driver.isOnline ? 1 : 0;
    acc.available += driver.availabilityStatus === "available" ? 1 : 0;
    acc.onRide += driver.availabilityStatus === "on_ride" ? 1 : 0;
    acc.busy += driver.availabilityStatus === "busy" ? 1 : 0;
    acc.offline += driver.availabilityStatus === "offline" ? 1 : 0;
    acc.lowBalance += driver.points.lowBalance ? 1 : 0;
    acc.staleGps += ["stale", "unavailable"].includes(driver.gpsFreshness) && driver.isOnline ? 1 : 0;
    return acc;
  }, { totalDrivers: 0, online: 0, available: 0, onRide: 0, busy: 0, offline: 0, lowBalance: 0, staleGps: 0, activeRides: activeRides.length });

  const alerts = [
    ...liveDrivers.filter((driver) => driver.points.lowBalance).slice(0, 20).map((driver) => ({
      id: `low-points:${driver.id}`,
      type: "driver_low_points",
      severity: "warning",
      driverId: driver.id,
      title: "Low points",
      description: `${driver.fullName || "Driver"} has ${driver.points.available} points.`,
      detectedAt: now,
    })),
    ...liveDrivers.filter((driver) => driver.currentRideId && driver.gpsFreshness !== "live").slice(0, 20).map((driver) => ({
      id: `ride-gps:${driver.currentRideId}`,
      type: "driver_location_unavailable",
      severity: "critical",
      driverId: driver.id,
      rideId: driver.currentRideId,
      title: "Driver location unavailable",
      description: `${driver.fullName || "Driver"} is on an active ride without fresh GPS.`,
      detectedAt: now,
    })),
  ];

  return {
    drivers: liveDrivers,
    rides: activeRides.map(rideMapDto),
    totals,
    alerts,
    settings: { lowBalanceThreshold, pointsPerAED: pointsPerAED(), commissionRate: 0.1 },
    generatedAt: now,
  };
};

export const getLiveOperationsMap = async (req, res) => {
  try {
    const snapshot = await buildLiveOperations(req.query || {});
    return res.status(200).json({ success: true, ...snapshot });
  } catch (error) {
    return sendError(res, error);
  }
};

export const searchLiveOperationsMap = async (req, res) => {
  try {
    const term = String(req.query.q || "").trim();
    if (term.length < 2) return res.status(200).json({ success: true, results: [] });
    const pattern = new RegExp(escapeRegex(term), "i");
    const [drivers, rides] = await Promise.all([
      Driver.find({
        isDeleted: { $ne: true },
        $or: [
          { fullName: pattern }, { firstName: pattern }, { lastName: pattern },
          { phone: pattern }, { whatsappNumber: pattern }, { registration: pattern },
        ],
      }).select(adminDriverFields).limit(20).lean(),
      Ride.find({ reference: pattern })
        .populate("driverId", "firstName lastName fullName vehicleType")
        .populate("passengerId", "fullName")
        .limit(20)
        .lean(),
    ]);
    const driverResults = drivers.map((driver) => ({
      type: "driver",
      id: String(driver._id),
      driverId: String(driver._id),
      label: driverName(driver) || `Driver ${String(driver._id).slice(-6)}`,
      subtitle: [driver.vehicleType, driver.registration, driver.phone].filter(Boolean).join(" / "),
      location: driverLocation(driver),
    }));
    const rideResults = rides.map((ride) => ({
      type: "ride",
      id: String(ride._id),
      rideId: String(ride._id),
      driverId: ride.driverId?._id ? String(ride.driverId._id) : String(ride.driverId),
      label: ride.reference || `Ride ${String(ride._id).slice(-6)}`,
      subtitle: [ride.status, driverName(ride.driverId || {}), ride.passengerId?.fullName].filter(Boolean).join(" / "),
      pickup: ride.pickup || null,
      destination: ride.destination || null,
    }));
    return res.status(200).json({ success: true, results: [...driverResults, ...rideResults].slice(0, 30) });
  } catch (error) {
    return sendError(res, error);
  }
};

const requireAdmin = (req) => {
  const adminId = req.admin?._id;
  if (!adminId) {
    const error = new Error("Admin authentication required");
    error.statusCode = 401;
    throw error;
  }
  return {
    id: adminId,
    name: req.admin.fullName || req.admin.email || "Admin",
    role: req.admin.role || "admin",
  };
};

// ---------------------------------------------------------------------------
// ALERTS
// ---------------------------------------------------------------------------

const alertDto = (alert) => ({
  id: String(alert._id),
  alertType: alert.alertType,
  severity: alert.severity,
  title: alert.title,
  description: alert.description || "",
  status: alert.status,
  entity: alert.entity || null,
  assignedAdmin: alert.assignedAdmin?.adminId
    ? {
        id: String(alert.assignedAdmin.adminId),
        name: alert.assignedAdmin.adminName,
        assignedAt: alert.assignedAdmin.assignedAt,
      }
    : null,
  acknowledgement: alert.acknowledgement?.adminId
    ? {
        id: String(alert.acknowledgement.adminId),
        name: alert.acknowledgement.adminName,
        acknowledgedAt: alert.acknowledgement.acknowledgedAt,
      }
    : null,
  resolution: alert.resolution?.resolvedAt
    ? {
        id: alert.resolution.adminId ? String(alert.resolution.adminId) : null,
        name: alert.resolution.adminName,
        resolvedAt: alert.resolution.resolvedAt,
        note: alert.resolution.note,
        outcome: alert.resolution.outcome,
      }
    : null,
  metadata: alert.metadata || null,
  detectedAt: alert.detectedAt,
  createdAt: alert.createdAt,
  updatedAt: alert.updatedAt,
});

export const listAlerts = async (req, res) => {
  try {
    const { page, limit } = pagination(req);
    const filter = {};

    if (req.query.status && ALERT_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.severity && ALERT_SEVERITIES.includes(req.query.severity)) {
      filter.severity = req.query.severity;
    }
    if (req.query.alertType && ALERT_TYPES.includes(req.query.alertType)) {
      filter.alertType = req.query.alertType;
    }
    Object.assign(filter, dateRange(req, "detectedAt"));

    const search = String(req.query.search || "").trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: new RegExp(escaped, "i") },
        { description: new RegExp(escaped, "i") },
      ];
    }

    const [alerts, total] = await Promise.all([
      OperationalAlert.find(filter)
        .sort({ detectedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      OperationalAlert.countDocuments(filter),
    ]);

    const summary = await OperationalAlert.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const summaryMap = {};
    summary.forEach((row) => {
      summaryMap[row._id] = row.count;
    });

    return res.status(200).json({
      success: true,
      alerts: alerts.map(alertDto),
      summary: {
        open: summaryMap.open || 0,
        acknowledged: summaryMap.acknowledged || 0,
        investigating: summaryMap.investigating || 0,
        resolved: summaryMap.resolved || 0,
        total,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getAlert = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      const error = new Error("Invalid alert id");
      error.statusCode = 400;
      throw error;
    }
    const alert = await OperationalAlert.findById(id).lean();
    if (!alert) {
      const error = new Error("Alert not found");
      error.statusCode = 404;
      throw error;
    }
    return res.status(200).json({ success: true, alert: alertDto(alert) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      const error = new Error("Invalid alert id");
      error.statusCode = 400;
      throw error;
    }
    const admin = requireAdmin(req);
    const alert = await OperationalAlert.findById(id);
    if (!alert) {
      const error = new Error("Alert not found");
      error.statusCode = 404;
      throw error;
    }
    if (alert.status !== "open") {
      const error = new Error(`Cannot acknowledge an alert with status "${alert.status}"`);
      error.statusCode = 409;
      throw error;
    }
    alert.status = "acknowledged";
    alert.acknowledgement = {
      adminId: admin.id,
      adminName: admin.name,
      acknowledgedAt: new Date(),
    };
    await alert.save();
    return res.status(200).json({ success: true, alert: alertDto(alert) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const assignAlert = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      const error = new Error("Invalid alert id");
      error.statusCode = 400;
      throw error;
    }
    const targetAdminId = req.body?.adminId;
    const targetAdminName = String(req.body?.adminName || "").trim();
    if (!targetAdminId || !isObjectId(targetAdminId)) {
      const error = new Error("A valid adminId is required");
      error.statusCode = 400;
      throw error;
    }
    const alert = await OperationalAlert.findById(id);
    if (!alert) {
      const error = new Error("Alert not found");
      error.statusCode = 404;
      throw error;
    }
    if (["resolved"].includes(alert.status)) {
      const error = new Error(`Cannot assign an alert with status "${alert.status}"`);
      error.statusCode = 409;
      throw error;
    }
    alert.assignedAdmin = {
      adminId: targetAdminId,
      adminName: targetAdminName || "Admin",
      assignedAt: new Date(),
    };
    if (alert.status === "open") {
      alert.status = "acknowledged";
      alert.acknowledgement = {
        adminId: req.admin?._id,
        adminName: req.admin?.fullName || "Admin",
        acknowledgedAt: new Date(),
      };
    }
    await alert.save();
    return res.status(200).json({ success: true, alert: alertDto(alert) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const investigateAlert = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      const error = new Error("Invalid alert id");
      error.statusCode = 400;
      throw error;
    }
    const admin = requireAdmin(req);
    const alert = await OperationalAlert.findById(id);
    if (!alert) {
      const error = new Error("Alert not found");
      error.statusCode = 404;
      throw error;
    }
    if (alert.status === "resolved") {
      const error = new Error("Cannot investigate a resolved alert");
      error.statusCode = 409;
      throw error;
    }
    alert.status = "investigating";
    if (!alert.assignedAdmin?.adminId) {
      alert.assignedAdmin = {
        adminId: admin.id,
        adminName: admin.name,
        assignedAt: new Date(),
      };
    }
    await alert.save();
    return res.status(200).json({ success: true, alert: alertDto(alert) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      const error = new Error("Invalid alert id");
      error.statusCode = 400;
      throw error;
    }
    const admin = requireAdmin(req);
    const note = String(req.body?.note || "").trim();
    if (note.length > 2000) {
      const error = new Error("Note must not exceed 2000 characters");
      error.statusCode = 400;
      throw error;
    }
    const outcome = String(req.body?.outcome || "fixed").trim();
    const validOutcomes = ["fixed", "wont_fix", "duplicate", "false_positive", "other"];
    if (!validOutcomes.includes(outcome)) {
      const error = new Error(`outcome must be one of: ${validOutcomes.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }
    const alert = await OperationalAlert.findById(id);
    if (!alert) {
      const error = new Error("Alert not found");
      error.statusCode = 404;
      throw error;
    }
    if (alert.status === "resolved") {
      const error = new Error("Alert is already resolved");
      error.statusCode = 409;
      throw error;
    }
    alert.status = "resolved";
    alert.resolution = {
      adminId: admin.id,
      adminName: admin.name,
      resolvedAt: new Date(),
      note,
      outcome,
    };
    await alert.save();
    return res.status(200).json({ success: true, alert: alertDto(alert) });
  } catch (error) {
    return sendError(res, error);
  }
};

// ---------------------------------------------------------------------------
// DISPUTES
// ---------------------------------------------------------------------------

const disputeDto = (dispute) => ({
  id: String(dispute._id),
  rideId: dispute.rideId ? String(dispute.rideId) : null,
  rideReference: dispute.rideReference || "",
  driverId: dispute.driverId ? String(dispute.driverId) : null,
  userId: dispute.userId ? String(dispute.userId) : null,
  status: dispute.status,
  priority: dispute.priority,
  reason: dispute.reason,
  description: dispute.description || "",
  openedBy: dispute.openedBy,
  openedById: dispute.openedById ? String(dispute.openedById) : null,
  driverStatement: dispute.driverStatement || "",
  userStatement: dispute.userStatement || "",
  assignedAdmin: dispute.assignedAdmin?.adminId
    ? {
        id: String(dispute.assignedAdmin.adminId),
        name: dispute.assignedAdmin.adminName,
        assignedAt: dispute.assignedAdmin.assignedAt,
      }
    : null,
  internalNotes: (dispute.internalNotes || []).map((note) => ({
    id: String(note._id),
    adminId: note.adminId ? String(note.adminId) : null,
    adminName: note.adminName || "",
    text: note.text,
    isInternal: note.isInternal,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  })),
  resolution: dispute.resolution?.resolvedAt
    ? {
        decision: dispute.resolution.decision,
        pointsAdjustment: dispute.resolution.pointsAdjustment,
        note: dispute.resolution.note,
        resolvedBy: dispute.resolution.resolvedBy
          ? String(dispute.resolution.resolvedBy)
          : null,
        resolvedByName: dispute.resolution.resolvedByName,
        resolvedAt: dispute.resolution.resolvedAt,
      }
    : null,
  rideSnapshot: dispute.rideSnapshot || null,
  createdAt: dispute.createdAt,
  updatedAt: dispute.updatedAt,
});

export const listDisputes = async (req, res) => {
  try {
    const { page, limit } = pagination(req);
    const filter = {};

    if (req.query.status && DISPUTE_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.reason && DISPUTE_REASONS.includes(req.query.reason)) {
      filter.reason = req.query.reason;
    }
    if (req.query.priority && DISPUTE_PRIORITIES.includes(req.query.priority)) {
      filter.priority = req.query.priority;
    }
    Object.assign(filter, dateRange(req, "createdAt"));

    if (isObjectId(req.query.rideId)) filter.rideId = req.query.rideId;
    if (isObjectId(req.query.driverId)) filter.driverId = req.query.driverId;
    if (isObjectId(req.query.userId)) filter.userId = req.query.userId;

    const search = String(req.query.search || "").trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { rideReference: new RegExp(escaped, "i") },
        { description: new RegExp(escaped, "i") },
      ];
    }

    const [disputes, total] = await Promise.all([
      OperationalDispute.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("rideId", "reference status")
        .populate("driverId", "firstName lastName fullName")
        .populate("userId", "fullName")
        .lean(),
      OperationalDispute.countDocuments(filter),
    ]);

    const summary = await OperationalDispute.aggregate([
      { $match: {} },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const summaryMap = {};
    summary.forEach((row) => { summaryMap[row._id] = row.count; });

    return res.status(200).json({
      success: true,
      disputes: disputes.map((d) => ({
        ...disputeDto(d),
        driver: d.driverId && typeof d.driverId === "object"
          ? { id: String(d.driverId._id), fullName: d.driverId.fullName || [d.driverId.firstName, d.driverId.lastName].filter(Boolean).join(" ") }
          : null,
        user: d.userId && typeof d.userId === "object"
          ? { id: String(d.userId._id), fullName: d.userId.fullName || "" }
          : null,
        ride: d.rideId && typeof d.rideId === "object"
          ? { id: String(d.rideId._id), reference: d.rideId.reference, status: d.rideId.status }
          : null,
      })),
      summary: summaryMap,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getDispute = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      const error = new Error("Invalid dispute id");
      error.statusCode = 400;
      throw error;
    }
    const dispute = await OperationalDispute.findById(id)
      .populate("rideId", "reference status pickup destination agreedPrice vehicleType lastDriverLocation")
      .populate("driverId", "firstName lastName fullName phone vehicleType isOnline")
      .populate("userId", "fullName phone")
      .lean();
    if (!dispute) {
      const error = new Error("Dispute not found");
      error.statusCode = 404;
      throw error;
    }

    let rideAudit = [];
    let pointsTransactions = [];
    if (dispute.rideId?._id) {
      [rideAudit, pointsTransactions] = await Promise.all([
        RideAudit.find({ rideId: dispute.rideId._id })
          .sort({ occurredAt: -1 })
          .limit(100)
          .lean(),
        mongoose.model("PointTransaction").find({ rideId: dispute.rideId._id })
          .sort({ createdAt: -1 })
          .lean(),
      ]);
    }

    return res.status(200).json({
      success: true,
      dispute: {
        ...disputeDto(dispute),
        driver: dispute.driverId && typeof dispute.driverId === "object"
          ? {
              id: String(dispute.driverId._id),
              fullName: dispute.driverId.fullName || [dispute.driverId.firstName, dispute.driverId.lastName].filter(Boolean).join(" "),
              phone: dispute.driverId.phone || "",
              vehicleType: dispute.driverId.vehicleType || "",
              isOnline: dispute.driverId.isOnline,
            }
          : null,
        user: dispute.userId && typeof dispute.userId === "object"
          ? { id: String(dispute.userId._id), fullName: dispute.userId.fullName || "", phone: dispute.userId.phone || "" }
          : null,
        ride: dispute.rideId && typeof dispute.rideId === "object"
          ? {
              id: String(dispute.rideId._id),
              reference: dispute.rideId.reference,
              status: dispute.rideId.status,
              pickup: dispute.rideId.pickup,
              destination: dispute.rideId.destination,
              agreedPrice: dispute.rideId.agreedPrice,
              vehicleType: dispute.rideId.vehicleType,
              lastDriverLocation: dispute.rideId.lastDriverLocation,
            }
          : null,
        rideAudit: rideAudit.map((entry) => ({
          id: String(entry._id),
          action: entry.action,
          fromStatus: entry.fromStatus,
          toStatus: entry.toStatus,
          actorId: entry.actorId ? String(entry.actorId) : null,
          actorRole: entry.actorRole,
          reasonCode: entry.reasonCode || "",
          occurredAt: entry.occurredAt,
        })),
        pointsTransactions: pointsTransactions.map((tx) => ({
          id: String(tx._id),
          type: tx.type,
          status: tx.status,
          points: tx.points,
          createdAt: tx.createdAt,
        })),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const createDispute = async (req, res) => {
  try {
    const rideId = String(req.body?.rideId || "").trim();
    if (!isObjectId(rideId)) {
      const error = new Error("A valid rideId is required");
      error.statusCode = 400;
      throw error;
    }
    const reason = String(req.body?.reason || "").trim();
    if (!DISPUTE_REASONS.includes(reason)) {
      const error = new Error(`reason must be one of: ${DISPUTE_REASONS.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }
    const admin = requireAdmin(req);

    const ride = await Ride.findById(rideId)
      .populate("passengerId", "fullName")
      .populate("driverId", "firstName lastName fullName")
      .lean();
    if (!ride) {
      const error = new Error("Ride not found");
      error.statusCode = 404;
      throw error;
    }

    const existing = await OperationalDispute.findOne({
      rideId,
      status: { $in: ["open", "under_review", "waiting_user", "waiting_driver"] },
    });
    if (existing) {
      const error = new Error("An active dispute already exists for this ride");
      error.statusCode = 409;
      throw error;
    }

    const dispute = await OperationalDispute.create({
      rideId,
      rideReference: ride.reference || "",
      driverId: ride.driverId?._id || ride.driverId,
      userId: ride.passengerId?._id || ride.passengerId,
      status: "open",
      priority: String(req.body?.priority || "medium").trim(),
      reason,
      description: String(req.body?.description || "").trim().slice(0, 2000),
      openedBy: "admin",
      openedById: admin.id,
      rideSnapshot: {
        pickupAddress: ride.pickup?.address || "",
        destinationAddress: ride.destination?.address || "",
        agreedPrice: ride.agreedPrice,
        vehicleType: ride.vehicleType || "",
        rideStatus: ride.status,
      },
    });

    return res.status(201).json({ success: true, dispute: disputeDto(dispute) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateDisputeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      const error = new Error("Invalid dispute id");
      error.statusCode = 400;
      throw error;
    }
    const newStatus = String(req.body?.status || "").trim();
    if (!DISPUTE_STATUSES.includes(newStatus)) {
      const error = new Error(`status must be one of: ${DISPUTE_STATUSES.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }
    const admin = requireAdmin(req);
    const dispute = await OperationalDispute.findById(id);
    if (!dispute) {
      const error = new Error("Dispute not found");
      error.statusCode = 404;
      throw error;
    }
    if (dispute.status === "resolved" || dispute.status === "rejected") {
      const error = new Error(`Cannot update a dispute with status "${dispute.status}"`);
      error.statusCode = 409;
      throw error;
    }
    dispute.status = newStatus;
    await dispute.save();
    return res.status(200).json({ success: true, dispute: disputeDto(dispute) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const assignDispute = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      const error = new Error("Invalid dispute id");
      error.statusCode = 400;
      throw error;
    }
    const targetAdminId = req.body?.adminId;
    const targetAdminName = String(req.body?.adminName || "").trim();
    if (!targetAdminId || !isObjectId(targetAdminId)) {
      const error = new Error("A valid adminId is required");
      error.statusCode = 400;
      throw error;
    }
    const dispute = await OperationalDispute.findById(id);
    if (!dispute) {
      const error = new Error("Dispute not found");
      error.statusCode = 404;
      throw error;
    }
    dispute.assignedAdmin = {
      adminId: targetAdminId,
      adminName: targetAdminName || "Admin",
      assignedAt: new Date(),
    };
    if (dispute.status === "open") {
      dispute.status = "under_review";
    }
    await dispute.save();
    return res.status(200).json({ success: true, dispute: disputeDto(dispute) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const addDisputeNote = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      const error = new Error("Invalid dispute id");
      error.statusCode = 400;
      throw error;
    }
    const admin = requireAdmin(req);
    const text = String(req.body?.text || "").trim();
    if (text.length < 3 || text.length > 2000) {
      const error = new Error("Note must be between 3 and 2000 characters");
      error.statusCode = 400;
      throw error;
    }
    const dispute = await OperationalDispute.findById(id);
    if (!dispute) {
      const error = new Error("Dispute not found");
      error.statusCode = 404;
      throw error;
    }
    if (dispute.status === "resolved" || dispute.status === "rejected") {
      const error = new Error("Cannot add notes to a closed dispute");
      error.statusCode = 409;
      throw error;
    }
    dispute.internalNotes.push({
      adminId: admin.id,
      adminName: admin.name,
      text,
      isInternal: req.body?.isInternal !== false,
    });
    await dispute.save();
    return res.status(201).json({ success: true, note: dispute.internalNotes[dispute.internalNotes.length - 1] });
  } catch (error) {
    return sendError(res, error);
  }
};

export const resolveDispute = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      const error = new Error("Invalid dispute id");
      error.statusCode = 400;
      throw error;
    }
    const admin = requireAdmin(req);
    const decision = String(req.body?.decision || "").trim();
    const validDecisions = ["driver", "user", "split", "rejected"];
    if (!validDecisions.includes(decision)) {
      const error = new Error(`decision must be one of: ${validDecisions.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }
    const note = String(req.body?.note || "").trim();
    if (note.length > 2000) {
      const error = new Error("Note must not exceed 2000 characters");
      error.statusCode = 400;
      throw error;
    }
    const pointsAdjustment = Number(req.body?.pointsAdjustment || 0);

    const dispute = await OperationalDispute.findById(id);
    if (!dispute) {
      const error = new Error("Dispute not found");
      error.statusCode = 404;
      throw error;
    }
    if (dispute.status === "resolved" || dispute.status === "rejected") {
      const e = new Error("Dispute is already closed");
      e.statusCode = 409;
      throw e;
    }
    dispute.status = decision === "rejected" ? "rejected" : "resolved";
    dispute.resolution = {
      decision,
      pointsAdjustment,
      note,
      resolvedBy: admin.id,
      resolvedByName: admin.name,
      resolvedAt: new Date(),
    };
    await dispute.save();
    return res.status(200).json({ success: true, dispute: disputeDto(dispute) });
  } catch (error) {
    return sendError(res, error);
  }
};

// ---------------------------------------------------------------------------
// SYSTEM HEALTH
// ---------------------------------------------------------------------------

const HEALTH_TREND_RANGES = {
  "1h": { bucketMinutes: 5, buckets: 12 },
  "6h": { bucketMinutes: 30, buckets: 12 },
  "24h": { bucketMinutes: 120, buckets: 12 },
  "7d": { bucketMinutes: 720, buckets: 14 },
};

export const getOperationalHealthTrend = async (req, res) => {
  try {
    const range = HEALTH_TREND_RANGES[req.query.range] ? req.query.range : "1h";
    const { bucketMinutes, buckets } = HEALTH_TREND_RANGES[range];
    const bucketMs = bucketMinutes * 60 * 1000;
    const now = new Date();
    const since = new Date(now.getTime() - buckets * bucketMs);

    // Bucket and sum server-side via aggregation rather than pulling every
    // 60-second health-check document (potentially thousands for a 7-day
    // range) into Node.
    const grouped = await OperationalHealth.aggregate([
      { $match: { checkedAt: { $gte: since } } },
      {
        $project: {
          docErrors: { $sum: "$services.errorCount" },
          bucketIndex: {
            $floor: {
              $divide: [{ $subtract: [now, "$checkedAt"] }, bucketMs],
            },
          },
        },
      },
      { $group: { _id: "$bucketIndex", errors: { $sum: "$docErrors" } } },
    ]);
    const errorsByBucket = new Map(grouped.map((g) => [g._id, g.errors]));

    const trend = Array.from({ length: buckets }, (_, i) => {
      const bucketIndexFromNow = buckets - 1 - i;
      const minutesAgo = bucketIndexFromNow * bucketMinutes;
      const label = range === "7d" ? `${Math.round(minutesAgo / 60 / 24)}d` : `${minutesAgo}m`;
      return { label, errors: errorsByBucket.get(bucketIndexFromNow) || 0 };
    });

    return res.status(200).json({ success: true, range, trend });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getOperationalHealth = async (req, res) => {
  try {
    const latest = await OperationalHealth.findOne({}).sort({ checkedAt: -1 }).lean();
    const activeIncidents = await Incident.find({ status: { $ne: "resolved" } })
      .sort({ startedAt: -1 })
      .limit(50)
      .lean();
    const recentIncidents = await Incident.find({})
      .sort({ startedAt: -1 })
      .limit(20)
      .lean();

    const services = (latest?.services || []).map((svc) => ({
      id: svc.serviceId,
      name: svc.serviceName,
      status: svc.status,
      latencyMs: svc.latencyMs,
      errorRatePct: svc.errorRatePct,
      uptimePct: svc.uptimePct,
      errorCount: svc.errorCount,
      successCount: svc.successCount,
      lastError: svc.lastError,
      lastCheck: svc.lastCheckedAt,
      errorTrend: svc.errorTrend || [],
    }));

    const incidents = recentIncidents.map((inc) => ({
      id: inc.incidentId,
      title: inc.title,
      serviceId: inc.serviceId,
      severity: inc.severity,
      status: inc.status,
      start: inc.startedAt,
      resolved: inc.resolvedAt,
      createdAt: inc.createdAt,
      updates: (inc.updates || []).map((u) => ({
        text: u.text,
        status: u.status,
        at: u.occurredAt,
        adminName: u.adminName,
      })),
    }));

    return res.status(200).json({
      success: true,
      health: {
        services,
        overallStatus: latest?.overallStatus || "operational",
        checkedAt: latest?.checkedAt || null,
        avgLatencyMs: latest?.avgLatencyMs || 0,
        activeIncidentCount: activeIncidents.length,
        incidents,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const createIncident = async (req, res) => {
  try {
    const admin = requireAdmin(req);
    const title = String(req.body?.title || "").trim();
    if (title.length < 5 || title.length > 300) {
      const error = new Error("Title must be between 5 and 300 characters");
      error.statusCode = 400;
      throw error;
    }
    const serviceId = String(req.body?.serviceId || "").trim();
    if (!HEALTH_SERVICE_IDS.includes(serviceId)) {
      const error = new Error(`serviceId must be one of: ${HEALTH_SERVICE_IDS.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }
    const severity = String(req.body?.severity || "warning").trim();
    const description = String(req.body?.description || "").trim();
    const count = await Incident.countDocuments({});
    const incidentId = `INC-${String(count + 1).padStart(4, "0")}`;

    const incident = await Incident.create({
      incidentId,
      title,
      serviceId,
      severity,
      status: "investigating",
      updates: description
        ? [{ text: description, status: "investigating", adminId: admin.id, adminName: admin.name }]
        : [],
    });

    return res.status(201).json({ success: true, incident });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = requireAdmin(req);
    const incident = await Incident.findOne({ incidentId: id });
    if (!incident) {
      const error = new Error("Incident not found");
      error.statusCode = 404;
      throw error;
    }
    const newStatus = String(req.body?.status || "").trim();
    const validIncidentStatuses = ["investigating", "identified", "monitoring", "resolved"];
    if (newStatus && validIncidentStatuses.includes(newStatus)) {
      incident.status = newStatus;
      if (newStatus === "resolved") incident.resolvedAt = new Date();
    }
    const updateText = String(req.body?.update || "").trim();
    if (updateText) {
      incident.updates.push({
        text: updateText,
        status: newStatus || incident.status,
        adminId: admin.id,
        adminName: admin.name,
        occurredAt: new Date(),
      });
    }
    await incident.save();
    return res.status(200).json({ success: true, incident });
  } catch (error) {
    return sendError(res, error);
  }
};

// ---------------------------------------------------------------------------
// CROSS-DOMAIN AUDIT LOGS (enhanced with auth events)
// ---------------------------------------------------------------------------

const AUDIT_SOURCES = ["request", "ride", "communication", "points", "auth"];

const requestAuditDto = (entry) => ({
  id: String(entry._id),
  domain: "request",
  occurredAt: entry.occurredAt,
  action: entry.action,
  actorId: entry.actorId ? String(entry.actorId) : null,
  actorName: entry.actorName || "",
  actorType: entry.actorType,
  reason: entry.reason || "",
  details: {
    requestId: entry.requestId ? String(entry.requestId) : null,
    requestStage: entry.requestStage,
    oldStatus: entry.oldStatus,
    newStatus: entry.newStatus,
  },
});

const rideAuditDto = (entry) => ({
  id: String(entry._id),
  domain: "ride",
  occurredAt: entry.occurredAt,
  action: entry.action,
  actorId: entry.actorId ? String(entry.actorId) : null,
  actorName: "",
  actorType: entry.actorRole,
  reason: entry.reasonCode || "",
  details: {
    rideId: entry.rideId ? String(entry.rideId) : null,
    fromStatus: entry.fromStatus || "",
    toStatus: entry.toStatus || "",
  },
});

const communicationAuditDto = (entry) => ({
  id: String(entry._id),
  domain: "communication",
  occurredAt: entry.occurredAt,
  action: entry.action,
  actorId: entry.actorId ? String(entry.actorId) : null,
  actorName: "",
  actorType: entry.actorRole,
  reason: entry.reasonCode || "",
  details: {
    rideId: entry.rideId ? String(entry.rideId) : null,
    outcome: entry.outcome,
  },
});

const pointsAuditDto = (entry) => ({
  id: String(entry._id),
  domain: "points",
  occurredAt: entry.createdAt,
  action: entry.action,
  actorId: entry.adminId ? String(entry.adminId) : null,
  actorName: "",
  actorType: entry.adminRole,
  reason: entry.reason || "",
  details: {
    driverId: entry.driverId ? String(entry.driverId) : null,
    pointsChange: entry.pointsChange ?? null,
    previousAvailableBalance: entry.previousAvailableBalance ?? null,
    newAvailableBalance: entry.newAvailableBalance ?? null,
  },
});

const authAuditDto = (entry) => ({
  id: String(entry._id),
  domain: "auth",
  occurredAt: entry.occurredAt,
  action: entry.action,
  actorId: entry.actorId ? String(entry.actorId) : null,
  actorName: entry.actorName || "",
  actorType: entry.actorRole,
  reason: entry.description || "",
  details: {
    targetType: entry.targetType || "",
    targetId: entry.targetId ? String(entry.targetId) : null,
  },
});

export const listOperationalAuditLogs = async (req, res) => {
  try {
    const { page, limit } = pagination(req);
    let types = (req.query.types || req.query.type || "")
      .split(",")
      .map((v) => String(v).trim())
      .filter(Boolean);
    types = types.length ? types.filter((v) => AUDIT_SOURCES.includes(v)) : AUDIT_SOURCES;
    if (!types.length) types = AUDIT_SOURCES;

    const baseFilter = { ...dateRange(req) };
    if (req.query.action) {
      const action = String(req.query.action).trim();
      baseFilter.action = { $regex: action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    const sensors = [];
    let total = 0;

    await Promise.all(
      types.map(async (type) => {
        const filter = { ...baseFilter };
        let count;
        let docs;
        if (type === "request") {
          count = await RequestAudit.countDocuments(filter);
          docs = await RequestAudit.find(filter)
            .sort({ occurredAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
          sensors.push(...docs.map(requestAuditDto));
        } else if (type === "ride") {
          count = await RideAudit.countDocuments(filter);
          docs = await RideAudit.find(filter)
            .sort({ occurredAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
          sensors.push(...docs.map(rideAuditDto));
        } else if (type === "communication") {
          count = await CommunicationAudit.countDocuments(filter);
          docs = await CommunicationAudit.find(filter)
            .sort({ occurredAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
          sensors.push(...docs.map(communicationAuditDto));
        } else if (type === "auth") {
          const authFilter = { ...baseFilter };
          if (req.query.actorId && isObjectId(req.query.actorId)) {
            authFilter.actorId = req.query.actorId;
          }
          count = await AuthAudit.countDocuments(authFilter);
          docs = await AuthAudit.find(authFilter)
            .sort({ occurredAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
          sensors.push(...docs.map(authAuditDto));
        } else {
          count = await PointsAdminAudit.countDocuments(filter);
          docs = await PointsAdminAudit.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
          sensors.push(...docs.map(pointsAuditDto));
        }
        total += count;
      })
    );

    sensors.sort((a, b) => {
      if (b.occurredAt !== a.occurredAt) return new Date(b.occurredAt) - new Date(a.occurredAt);
      return String(b.id).localeCompare(String(a.id));
    });

    return res.status(200).json({
      success: true,
      items: sensors.slice(0, limit),
      sources: AUDIT_SOURCES,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ---------------------------------------------------------------------------
// DETECT OPERATIONAL ALERTS (called by background job)
// ---------------------------------------------------------------------------

export const detectOperationalAlerts = async () => {
  const now = new Date();
  const created = [];

  const upsertAlert = async (filter, doc) => {
    const existing = await OperationalAlert.findOne({
      ...filter,
      status: { $in: ["open", "acknowledged", "investigating"] },
    });
    if (!existing) {
      const alert = await OperationalAlert.create(doc);
      created.push(alert);
    }
  };

  try {
    const stuckRides = await Ride.find({
      status: { $in: ACTIVE_RIDE_STATUSES },
      updatedAt: { $lt: new Date(now.getTime() - 60 * 60 * 1000) },
    })
      .populate("driverId", "firstName lastName fullName")
      .populate("passengerId", "fullName")
      .limit(50)
      .lean();

    for (const ride of stuckRides) {
      await upsertAlert(
        { alertType: "stuck_ride", "entity.entityId": ride._id },
        {
          alertType: "stuck_ride",
          severity: "critical",
          title: `Stuck ride: ${ride.reference}`,
          description: `Ride ${ride.reference} has been active for over 1 hour (status: ${ride.status}).`,
          status: "open",
          entity: {
            entityType: "ride",
            entityId: ride._id,
            label: ride.reference,
          },
          detectedAt: now,
        }
      );
    }

    const staleGpsDrivers = await Driver.find({
      isOnline: true,
      "currentLocation.coordinates": { $exists: true },
      updatedAt: { $lt: new Date(now.getTime() - 10 * 60 * 1000) },
    })
      .limit(50)
      .lean();

    for (const driver of staleGpsDrivers) {
      const driverName = driver.fullName || [driver.firstName, driver.lastName].filter(Boolean).join(" ");
      await upsertAlert(
        { alertType: "stale_gps", "entity.entityId": driver._id },
        {
          alertType: "stale_gps",
          severity: "warning",
          title: `Stale GPS: ${driverName}`,
          description: `Driver ${driverName} is marked online but hasn't updated location in over 10 minutes.`,
          status: "open",
          entity: {
            entityType: "driver",
            entityId: driver._id,
            label: driverName,
          },
          detectedAt: now,
        }
      );
    }

    const multiActiveDrivers = await Driver.aggregate([
      { $match: { activeRideId: { $ne: null } } },
      { $group: { _id: "$activeRideId", count: { $sum: 1 }, drivers: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ]);

    for (const group of multiActiveDrivers) {
      await upsertAlert(
        { alertType: "multiple_active_rides", "entity.entityId": group._id },
        {
          alertType: "multiple_active_rides",
          severity: "critical",
          title: `Multiple drivers on ride`,
          description: `${group.count} drivers are assigned to the same active ride.`,
          status: "open",
          entity: {
            entityType: "ride",
            entityId: group._id,
            label: `Ride with ${group.count} drivers`,
          },
          detectedAt: now,
        }
      );
    }

    const lowBalanceThreshold = 10;
    const lowBalance = await mongoose.model("DriverPointsWallet").find({
      $expr: {
        $lt: [
          { $add: ["$availableBonusPoints", "$availablePurchasedPoints"] },
          lowBalanceThreshold,
        ],
      },
    })
      .limit(20)
      .lean();

    for (const wallet of lowBalance) {
      const totalPts = (wallet.availableBonusPoints || 0) + (wallet.availablePurchasedPoints || 0);
      if (totalPts < 0) {
        await upsertAlert(
          { alertType: "negative_inconsistent_points", "entity.entityId": wallet.driverId },
          {
            alertType: "negative_inconsistent_points",
            severity: "critical",
            title: `Negative points balance`,
            description: `Driver ${String(wallet.driverId)} has a negative points balance (${totalPts}).`,
            status: "open",
            entity: {
              entityType: "driver",
              entityId: wallet.driverId,
              label: `Driver ${String(wallet.driverId)}`,
            },
            detectedAt: now,
          }
        );
      }
    }

    const failedPinRides = await Ride.find({
      pickupPinAttempts: { $gte: 3 },
    })
      .limit(20)
      .lean();

    for (const ride of failedPinRides) {
      await upsertAlert(
        { alertType: "pickup_pin_failures", "entity.entityId": ride._id },
        {
          alertType: "pickup_pin_failures",
          severity: "warning",
          title: `Pickup PIN failures: ${ride.reference}`,
          description: `Ride ${ride.reference} has ${ride.pickupPinAttempts} failed pickup PIN attempts.`,
          status: "open",
          entity: {
            entityType: "ride",
            entityId: ride._id,
            label: ride.reference,
          },
          detectedAt: now,
        }
      );
    }

    const socketAvailable = Boolean(global.io);
    if (!socketAvailable) {
      await upsertAlert(
        { alertType: "socketio_interruption", "entity.entityType": "system" },
        {
          alertType: "socketio_interruption",
          severity: "critical",
          title: "Socket.IO interruption",
          description: "Socket.IO server is not available or not responding.",
          status: "open",
          entity: {
            entityType: "system",
            label: "Socket.IO Service",
          },
          detectedAt: now,
        }
      );
    }
  } catch (error) {
    console.error("[alert-detection] Error during alert detection:", error.message);
  }

  return created;
};

export default {
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
  createIncident,
  updateIncident,
  listOperationalAuditLogs,
  detectOperationalAlerts,
};

import mongoose from "mongoose";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import Ride, { ACTIVE_RIDE_STATUSES } from "../models/Ride.js";
import TripOffer from "../models/TripOffer.js";
import DriverPointsWallet from "../models/DriverPointsWallet.js";
import PointPurchaseRequest from "../models/PointPurchaseRequest.js";
import RideMessage from "../models/RideMessage.js";
import SupportReport from "../models/SupportReport.js";
import PointsSettings from "../models/PointsSettings.js";
import RideConversation from "../models/RideConversation.js";
import CommunicationAudit from "../models/CommunicationAudit.js";
import RequestAudit from "../models/RequestAudit.js";
import RideAudit from "../models/RideAudit.js";
import PointsAdminAudit from "../models/PointsAdminAudit.js";
import Admin, { ADMIN_ROLES } from "../models/Admin.js";
import Notification from "../models/Notification.js";
import {
  dispatchNotification,
  isPushConfigured,
} from "../services/notificationService.js";

const isObjectId = (value) => mongoose.isValidObjectId(value);

const pagination = (req, max = 100) => ({
  page: Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1),
  limit: Math.min(max, Math.max(1, Number.parseInt(req.query.limit || "25", 10) || 25)),
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
    code: error.code || "ADMIN_SYSTEM_ERROR",
    message: status >= 500 ? "Internal server error" : error.message,
  });
};

// ---------------------------------------------------------------------------
// GET /api/admin/health — lightweight system health probe
// ---------------------------------------------------------------------------
export const getSystemHealth = async (req, res) => {
  const startedAt = Date.now();
  try {
    const dbState = mongoose.connection.readyState === 1 ? "operational" : "unavailable";
    await PointsSettings.getEffective();
    const health = {
      api: "operational",
      database: dbState,
      socketIo: global.io ? "operational" : "unavailable",
      notifications:
        process.env.FIREBASE_SERVICE_ACCOUNT ||
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        process.env.FCM_SERVICE_ACCOUNT_JSON
          ? "configured"
          : "not_configured",
      storage:
        process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET
          ? "configured"
          : "not_configured",
      latencyMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    };
    return res.status(200).json({ success: true, health });
  } catch (error) {
    return res.status(200).json({
      success: true,
      health: {
        api: "operational",
        database: mongoose.connection.readyState === 1 ? "operational" : "unavailable",
        socketIo: global.io ? "operational" : "unavailable",
        notifications:
          process.env.FIREBASE_SERVICE_ACCOUNT ||
          process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            ? "configured"
            : "not_configured",
        storage:
          process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET
            ? "configured"
            : "not_configured",
        latencyMs: Date.now() - startedAt,
        generatedAt: new Date().toISOString(),
      },
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/alerts — operational queues that need attention
// ---------------------------------------------------------------------------
export const listAdminAlerts = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const settings = await PointsSettings.getEffective();
    const lowBalanceThreshold = settings.lowBalanceThreshold;
    const activeRideFilter = { status: { $in: ACTIVE_RIDE_STATUSES } };

    const [
      pendingApproval1,
      pendingApproval2,
      activeReservations,
      pendingTripOffers,
      openDisputes,
      stuckRides,
      lowBalanceDrivers,
      pendingPointPurchaseRequests,
      unreadRideMessages,
      openSupportReports,
      restrictedUsers,
      restrictedDrivers,
      recentCommunicationDenials,
    ] = await Promise.all([
      Driver.countDocuments({ status: "pending" }),
      Driver.countDocuments({ profileRequestStatus: "pending" }),
      Ride.countDocuments(activeRideFilter),
      TripOffer.countDocuments({ status: "pending", expiresAt: { $gt: now } }),
      Ride.countDocuments({ status: "disputed" }),
      Ride.countDocuments({
        status: { $in: ACTIVE_RIDE_STATUSES },
        updatedAt: { $lt: new Date(now.getTime() - 60 * 60 * 1000) },
      }),
      DriverPointsWallet.countDocuments({
        $expr: {
          $lt: [
            { $add: ["$availableBonusPoints", "$availablePurchasedPoints"] },
            lowBalanceThreshold,
          ],
        },
      }),
      PointPurchaseRequest.countDocuments({
        status: { $in: ["pending", "contacted", "payment_pending", "payment_verified"] },
      }),
      RideMessage.countDocuments({ status: { $ne: "read" } }),
      SupportReport.countDocuments({ status: { $in: ["open", "reviewing"] } }),
      User.countDocuments({ isRestricted: true }),
      Driver.countDocuments({ isRestricted: true }),
      CommunicationAudit.countDocuments({
        action: "communication_denied",
        occurredAt: { $gte: startOfToday },
      }),
    ]);

    const build = (severity, code, title, count, path, detail = "") => ({
      severity,
      code,
      title,
      count,
      path,
      detail,
    });

    const alerts = [];
    if (pendingApproval1) {
      alerts.push(build("info", "PENDING_DRIVER_REQUESTS", "Pending driver verification requests", pendingApproval1, "/drivers"));
    }
    if (pendingApproval2) {
      alerts.push(build("info", "PENDING_PROFILE_REVIEWS", "Pending driver profile reviews", pendingApproval2, "/drivers"));
    }
    if (pendingTripOffers) {
      alerts.push(build("info", "PENDING_TRIP_OFFERS", "Pending trip offers", pendingTripOffers, "/rides"));
    }
    if (pendingPointPurchaseRequests) {
      alerts.push(build("info", "POINT_PURCHASE_REQUESTS", "Point purchase requests awaiting review", pendingPointPurchaseRequests, "/points"));
    }
    if (openDisputes) {
      alerts.push(build("warning", "OPEN_DISPUTES", "Open ride disputes", openDisputes, "/rides"));
    }
    if (stuckRides) {
      alerts.push(build("warning", "STUCK_RIDES", "Rides stuck for over an hour", stuckRides, "/rides"));
    }
    if (lowBalanceDrivers) {
      alerts.push(build("warning", "LOW_BALANCE_DRIVERS", "Drivers below point balance threshold", lowBalanceDrivers, "/points"));
    }
    if (unreadRideMessages) {
      alerts.push(build("info", "UNREAD_RIDE_MESSAGES", "Unread ride messages", unreadRideMessages, "/chat"));
    }
    if (openSupportReports) {
      alerts.push(build("warning", "OPEN_SUPPORT_REPORTS", "Open support reports", openSupportReports, "/alerts"));
    }
    if (restrictedUsers || restrictedDrivers) {
      alerts.push(build("info", "RESTRICTED_ACCOUNTS", "Restricted accounts", restrictedUsers + restrictedDrivers, "/", `${restrictedUsers} users, ${restrictedDrivers} drivers`));
    }
    if (recentCommunicationDenials) {
      alerts.push(build("info", "COMMUNICATION_DENIALS", "Blocked communication attempts today", recentCommunicationDenials, "/secure-calls"));
    }
    if (activeReservations) {
      alerts.push(build("info", "ACTIVE_RESERVATIONS", "Active reservations", activeReservations, "/rides"));
    }

    return res.status(200).json({
      success: true,
      alerts,
      summary: {
        total: alerts.reduce((sum, alert) => sum + alert.count, 0),
        count: alerts.length,
        generatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/audit-logs — cross-domain append-only audit feed
// ---------------------------------------------------------------------------
const AUDIT_SOURCES = ["request", "ride", "communication", "points"];

const requestAuditDto = (entry) => ({
  id: String(entry._id),
  type: "request",
  occurredAt: entry.occurredAt,
  action: entry.action,
  requestId: String(entry.requestId),
  requestStage: entry.requestStage,
  oldStatus: entry.oldStatus,
  newStatus: entry.newStatus,
  actorId: entry.actorId ? String(entry.actorId) : null,
  actorType: entry.actorType,
  actorName: entry.actorName || "",
  reason: entry.reason || "",
});

const rideAuditDto = (entry) => ({
  id: String(entry._id),
  type: "ride",
  occurredAt: entry.occurredAt,
  action: entry.action,
  rideId: entry.rideId ? String(entry.rideId) : null,
  fromStatus: entry.fromStatus || "",
  toStatus: entry.toStatus || "",
  actorId: entry.actorId ? String(entry.actorId) : null,
  actorRole: entry.actorRole,
  reasonCode: entry.reasonCode || "",
});

const communicationAuditDto = (entry) => ({
  id: String(entry._id),
  type: "communication",
  occurredAt: entry.occurredAt,
  action: entry.action,
  rideId: entry.rideId ? String(entry.rideId) : null,
  actorId: entry.actorId ? String(entry.actorId) : null,
  actorRole: entry.actorRole,
  outcome: entry.outcome,
  reasonCode: entry.reasonCode || "",
});

const pointsAuditDto = (entry) => ({
  id: String(entry._id),
  type: "points",
  occurredAt: entry.createdAt,
  action: entry.action,
  adminId: entry.adminId ? String(entry.adminId) : null,
  adminRole: entry.adminRole,
  driverId: entry.driverId ? String(entry.driverId) : null,
  pointsChange: entry.pointsChange ?? null,
  previousAvailableBalance: entry.previousAvailableBalance ?? null,
  newAvailableBalance: entry.newAvailableBalance ?? null,
  reason: entry.reason || "",
  purchaseRequestId: entry.purchaseRequestId ? String(entry.purchaseRequestId) : null,
  idempotencyKey: entry.idempotencyKey || "",
});

export const listAdminAuditLogs = async (req, res) => {
  try {
    const { page, limit } = pagination(req);
    let types = (req.query.types || req.query.type || "")
      .split(",")
      .map((value) => String(value).trim())
      .filter(Boolean);
    types = types.length ? types.filter((value) => AUDIT_SOURCES.includes(value)) : AUDIT_SOURCES;
    if (!types.length) {
      types = AUDIT_SOURCES;
    }

    const filters = types.map((type) => {
      const filter = { ...dateRange(req) };
      if (req.query.action) {
        const action = String(req.query.action).trim();
        if (action.length > 120) {
          const error = new Error("action filter is too long");
          error.statusCode = 400;
          throw error;
        }
        filter.action = { $regex: action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      }
      return { type, filter };
    });

    const sensors = [];
    let total = 0;
    await Promise.all(
      filters.map(async ({ type, filter }) => {
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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getAuditSources = async (req, res) =>
  res.status(200).json({ success: true, sources: AUDIT_SOURCES });

// ---------------------------------------------------------------------------
// GET /api/admin/chat/metadata — ride chat health and volumes
// ---------------------------------------------------------------------------
export const getChatMetadata = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [totalConversations, activeConversations, totalMessages, unreadMessages, messagesToday] =
      await Promise.all([
        RideConversation.countDocuments({}),
        RideConversation.countDocuments({ status: "active" }),
        RideMessage.countDocuments({}),
        RideMessage.countDocuments({ status: { $ne: "read" } }),
        RideMessage.countDocuments({ createdAt: { $gte: startOfToday } }),
      ]);

    return res.status(200).json({
      success: true,
      metadata: {
        totalConversations,
        activeConversations,
        totalMessages,
        unreadMessages,
        messagesToday,
        socketConnected: Boolean(global.io),
        generatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/chat/threads - recent ride conversations
// ---------------------------------------------------------------------------
export const listChatThreads = async (req, res) => {
  try {
    const { page, limit } = pagination(req);
    const filter = {};
    if (req.query.status && ["active", "completed", "cancelled"].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    const [threads, total] = await Promise.all([
      RideConversation.find(filter)
        .sort({ lastMessageAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      RideConversation.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      threads: threads.map((thread) => ({
        id: String(thread._id),
        rideId: thread.rideId ? String(thread.rideId) : "",
        rideReference: thread.rideReference || "",
        status: thread.status,
        passenger: {
          id: thread.passengerId ? String(thread.passengerId) : "",
          fullName: thread.passengerName || "",
          image: thread.passengerImage || "",
        },
        driver: {
          id: thread.driverId ? String(thread.driverId) : "",
          fullName: thread.driverName || "",
          image: thread.driverImage || "",
          vehicleType: thread.driverVehicleType || "",
          vehicleModel: thread.driverVehicleModel || "",
          registration: thread.driverRegistration || "",
        },
        passengerUnreadCount: thread.passengerUnreadCount || 0,
        driverUnreadCount: thread.driverUnreadCount || 0,
        lastMessageAt: thread.lastMessageAt || null,
        lastMessagePreview: thread.lastMessagePreview || "",
        lastMessageSenderRole: thread.lastMessageSenderRole || "",
        lastMessageStatus: thread.lastMessageStatus || "",
        createdAt: thread.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/secure-calls — secure call / contact audit feed
// ---------------------------------------------------------------------------
export const listSecureCalls = async (req, res) => {
  try {
    const { page, limit } = pagination(req);
    const filter = {};
    const actions = String(req.query.action || "")
      .split(",")
      .map((value) => String(value).trim())
      .filter(Boolean);
    if (req.query.rideId) {
      if (!isObjectId(req.query.rideId)) {
        const error = new Error("rideId is invalid");
        error.statusCode = 400;
        throw error;
      }
      filter.rideId = req.query.rideId;
    }
    if (actions.length) {
      filter.action = { $in: actions };
    }

    const [entries, total] = await Promise.all([
      CommunicationAudit.find(filter)
        .sort({ occurredAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CommunicationAudit.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      items: entries.map((entry) => ({
        id: String(entry._id),
        rideId: entry.rideId ? String(entry.rideId) : null,
        action: entry.action,
        actorId: entry.actorId ? String(entry.actorId) : null,
        actorRole: entry.actorRole,
        outcome: entry.outcome,
        reasonCode: entry.reasonCode || "",
        occurredAt: entry.occurredAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getCommunicationActions = async (req, res) => {
  const actions = await CommunicationAudit.distinct("action");
  return res.status(200).json({ success: true, actions });
};

// ---------------------------------------------------------------------------
// GET /api/admin/roles — role catalog and current admin's permissions
// ---------------------------------------------------------------------------
export const getRolesCatalog = async (req, res) => {
  try {
    const adminId = req.admin?._id || req.admin?._id;
    const current = adminId
      ? await Admin.findById(adminId).select("_id fullName email role permissions isActive lastLoginAt").lean()
      : null;
    const [team, allAdmins] = await Promise.all([
      Admin.find({}).select("_id fullName email role isActive lastLoginAt").lean(),
      Admin.find({}).countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      roles: ADMIN_ROLES,
      permissions: ["points_read", "points_adjust", "points_purchase_management", "rides_read", "rides_manage", "users_read", "users_manage", "support"],
      current: current
        ? {
            id: String(current._id),
            fullName: current.fullName,
            email: current.email,
            role: current.role,
          }
        : null,
      team: team.map((member) => ({
        id: String(member._id),
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        isActive: member.isActive,
        lastLoginAt: member.lastLoginAt || null,
      })),
      totalAdmins: allAdmins,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ---------------------------------------------------------------------------
// GET/POST /api/admin/notifications — broadcast + history
// ---------------------------------------------------------------------------
export const listAdminNotifications = async (req, res) => {
  try {
    const { page, limit } = pagination(req, 50);
    const filter = { recipientType: { $in: ["user", "driver", "admin"] } };
    if (req.query.recipientType && ["user", "driver", "admin"].includes(req.query.recipientType)) {
      filter.recipientType = req.query.recipientType;
    }
    Object.assign(filter, dateRange(req));

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-data -__v")
        .lean(),
      Notification.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      notifications: notifications.map((notification) => ({
        id: String(notification._id),
        userId: notification.userId ? String(notification.userId) : null,
        recipientType: notification.recipientType,
        type: notification.type,
        title: notification.title || "",
        message: notification.message,
        read: notification.read,
        readAt: notification.readAt || null,
        isValid: notification.isValid,
        deepLink: notification.deepLink || "",
        createdAt: notification.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const VALID_BROADCAST_RECIPIENTS = ["user", "driver", "both"];

export const sendAdminNotification = async (req, res) => {
  try {
    const recipient = String(req.body.recipients || req.body.recipientType || "both");
    if (!VALID_BROADCAST_RECIPIENTS.includes(recipient)) {
      const error = new Error("recipients must be one of user, driver, both");
      error.statusCode = 400;
      throw error;
    }
    const message = String(req.body.message || "").trim();
    if (message.length < 1 || message.length > 1000) {
      const error = new Error("message of 1 to 1000 characters is required");
      error.statusCode = 400;
      throw error;
    }
    const title = String(req.body.title || "").trim().slice(0, 160);
    const type = String(req.body.type || "GENERAL").trim().slice(0, 80) || "GENERAL";

    const pushConfigured = await isPushConfigured();

    const targets = [];
    if (recipient === "user" || recipient === "both") {
      const userIds = await User.find({ isRestricted: { $ne: true } })
        .select("_id")
        .lean();
      targets.push(...userIds.map(({ _id }) => ({ recipientId: _id, recipientType: "user" })));
    }
    if (recipient === "driver" || recipient === "both") {
      const driverIds = await Driver.find({ status: "approved", profileRequestStatus: "approved", isDeleted: { $ne: true } })
        .select("_id")
        .lean();
      targets.push(...driverIds.map(({ _id }) => ({ recipientId: _id, recipientType: "driver" })));
    }

    const maxTargets = Number.parseInt(req.body.maxTargets || String(targets.length), 10) || targets.length;
    const boundedTargets = targets.slice(0, Math.max(1, Math.max(1, maxTargets)));

    let queued = 0;
    let failed = 0;
    for (const target of boundedTargets) {
      try {
        await dispatchNotification({
          recipientId: target.recipientId,
          recipientType: target.recipientType,
          type,
          title,
          message,
          deepLink: "drewel://notifications",
        });
        queued += 1;
      } catch (error) {
        failed += 1;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Notification broadcast queued for ${queued} recipient(s)`,
      recipients: targets.length,
      queued,
      failed,
      pushConfigured,
      pushSkipped: !pushConfigured,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/settings — non-sensitive settings snapshot for the panel
// ---------------------------------------------------------------------------
export const getAdminSettings = async (req, res) => {
  try {
    const settings = await PointsSettings.getEffective();
    return res.status(200).json({
      success: true,
      settings: {
        lowBalanceThreshold: settings.lowBalanceThreshold,
        largeAdjustmentThreshold: settings.largeAdjustmentThreshold,
        welcomeDriverPoints: settings.welcomeDriverPoints,
        rideOfferPointsCost: settings.rideOfferPointsCost,
        offerExpirationSeconds: settings.offerExpirationSeconds,
        maximumConcurrentOffers: settings.maximumConcurrentOffers,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export default {
  getSystemHealth,
  listAdminAlerts,
  listAdminAuditLogs,
  getAuditSources,
  getChatMetadata,
  listChatThreads,
  listSecureCalls,
  getCommunicationActions,
  getRolesCatalog,
  listAdminNotifications,
  sendAdminNotification,
  getAdminSettings,
};
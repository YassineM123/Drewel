import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import AuthAudit from "../models/AuthAudit.js";
import Driver from "../models/Driver.js";
import DriverLogs from "../models/Driverlogs.js";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import {
  applyForcedOfflinePresence,
  buildActiveDriverPresenceFilter,
  emitDriverPresenceTransition,
} from "../services/driverPresenceService.js";
import { buildFreshAdminMarketplaceAvailabilityFilter } from "../utils/availableDrivers.js";
import {
  getDriverLocationFutureSkewMs,
  getDriverLocationMaxAgeMs,
  getServiceAreaLocationMaxAccuracyM,
} from "../utils/dubaiLocation.js";
import DriverPointsWallet from "../models/DriverPointsWallet.js";
import Ride, { ACTIVE_RIDE_STATUSES } from "../models/Ride.js";
import TripOffer from "../models/TripOffer.js";
import RequestAudit from "../models/RequestAudit.js";

const deriveLegacyStatus = (driver) => {
  const hasDocs =
    Boolean(driver.licenseCarUrl || driver.carLicenseFrontUrl) &&
    Boolean(driver.licenseDriverUrl || driver.drivingLicenseFrontUrl) &&
    Boolean(driver.profileImageUrl) &&
    Boolean(driver.idDocumentUrl || driver.idProofFrontUrl) &&
    Boolean(driver.passportCopyUrl);
  if (driver.isApproved && (driver.status === "completed" || hasDocs)) {
    return "completed";
  }
  if (driver.isApproved) return "approved";
  if (driver.status) return driver.status;
  return "pending";
};

const DRIVER_DETAIL_FALLBACK_FIELDS = [
  "address",
  "city",
  "vehicleType",
  "whatsappNumber",
  "licenseCompanyUrl",
  "carLicenseFrontUrl",
  "carLicenseBackUrl",
  "drivingLicenseFrontUrl",
  "drivingLicenseBackUrl",
  "idProofFrontUrl",
  "idProofBackUrl",
  "passportCopyUrl",
  "profileImageUrl",
];

const applyDriverLogFallbacks = (driver, driverLog) => {
  if (!driverLog) return driver;

  for (const field of DRIVER_DETAIL_FALLBACK_FIELDS) {
    if (!driver[field] && driverLog[field]) driver[field] = driverLog[field];
  }

  // Keep the mobile snake_case contract and the legacy camelCase contract
  // readable through one admin response.
  if (!driver.licenseCarUrl) driver.licenseCarUrl = driver.carLicenseFrontUrl || "";
  if (!driver.licenseDriverUrl) {
    driver.licenseDriverUrl = driver.drivingLicenseFrontUrl || "";
  }
  if (!driver.idDocumentUrl) driver.idDocumentUrl = driver.idProofFrontUrl || "";
  driver.driverLogs = driverLog;
  return driver;
};

const ADMIN_DRIVER_PRESENCE_FIELDS =
  "firstName lastName fullName phone whatsappNumber isOnline isApproved isRestricted isDeleted status profileRequestStatus lat long heading speed currentLocation currentServiceArea locationAccuracyM activeRideId vehicleType vehicleModel registration locationUpdatedAt availabilityStatus presenceStatus presenceLeaseExpiresAt presenceLastHeartbeatAt presenceVersion";

const hasValidMarketplacePoint = (driver) => {
  const coordinates = driver.currentLocation?.coordinates;
  return (
    driver.currentLocation?.type === "Point" &&
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    Number.isFinite(Number(coordinates[0])) &&
    Number.isFinite(Number(coordinates[1]))
  );
};

const discoverabilityReasonsFor = (driver, now = new Date()) => {
  const reasons = [];
  const status = String(driver.status || "").trim();
  const profileStatus = String(driver.profileRequestStatus || "").trim();
  const locationUpdatedAt = driver.locationUpdatedAt
    ? new Date(driver.locationUpdatedAt)
    : null;
  const locationTime = locationUpdatedAt?.getTime();
  const maxAgeMs = getDriverLocationMaxAgeMs();
  const futureSkewMs = getDriverLocationFutureSkewMs();
  const serviceArea = driver.currentServiceArea || null;
  const accuracyM = Number(driver.locationAccuracyM);
  const maxAccuracyM = getServiceAreaLocationMaxAccuracyM(serviceArea);

  if (driver.isApproved !== true) reasons.push("not_approved");
  if (driver.isRestricted === true) reasons.push("restricted");
  if (driver.isDeleted === true) reasons.push("deleted");
  if (!(status === "completed" || (!status && !profileStatus))) {
    reasons.push("profile_incomplete");
  }
  if (driver.isOnline !== true) reasons.push("legacy_online_flag_off");
  if (driver.availabilityStatus !== "Online") reasons.push("not_available");
  if (driver.activeRideId) reasons.push("active_ride");
  if (!hasValidMarketplacePoint(driver)) reasons.push("missing_current_location");
  if (!Number.isFinite(locationTime)) {
    reasons.push("missing_location_time");
  } else if (locationTime < now.getTime() - maxAgeMs) {
    reasons.push("stale_gps");
  } else if (locationTime > now.getTime() + futureSkewMs) {
    reasons.push("future_gps");
  }
  if (!Number.isFinite(accuracyM) || accuracyM < 0) {
    reasons.push("missing_accuracy");
  } else if (accuracyM > maxAccuracyM) {
    reasons.push("low_accuracy");
  }
  if (!serviceArea) reasons.push("missing_service_area");

  return [...new Set(reasons)];
};

const enrichAdminDriverPresence = async (drivers, now = new Date()) => {
  const driverIds = drivers.map((driver) => driver._id).filter(Boolean);
  const discoverableDrivers = driverIds.length
    ? await Driver.find({
        ...buildFreshAdminMarketplaceAvailabilityFilter({}, now),
        _id: { $in: driverIds },
      })
        .select("_id")
        .lean()
    : [];
  const discoverableIds = new Set(
    discoverableDrivers.map((driver) => String(driver._id))
  );

  return drivers.map((driver) => {
    const reasons = discoverabilityReasonsFor(driver, now);
    const locationUpdatedAt = driver.locationUpdatedAt
      ? new Date(driver.locationUpdatedAt)
      : null;
    const locationAgeSeconds = Number.isFinite(locationUpdatedAt?.getTime())
      ? Math.max(0, Math.round((now.getTime() - locationUpdatedAt.getTime()) / 1000))
      : null;
    return {
      ...driver,
      fullName:
        driver.fullName ||
        [driver.firstName, driver.lastName].filter(Boolean).join(" ").trim(),
      status: deriveLegacyStatus(driver),
      isDiscoverable: discoverableIds.has(String(driver._id)),
      discoverabilityReasons: reasons,
      locationAgeSeconds,
      locationAccuracyM:
        Number.isFinite(Number(driver.locationAccuracyM))
          ? Number(driver.locationAccuracyM)
          : null,
    };
  });
};

const documentAvailability = (driver) => {
  const fields = [
    "licenseCompanyUrl",
    "carLicenseFrontUrl",
    "carLicenseBackUrl",
    "drivingLicenseFrontUrl",
    "drivingLicenseBackUrl",
    "idProofFrontUrl",
    "idProofBackUrl",
    "passportCopyUrl",
    "profileImageUrl",
  ];
  const available = fields.filter((field) => Boolean(driver[field])).length;
  return {
    available,
    total: fields.length,
    missing: fields.length - available,
    complete: available === fields.length,
  };
};

const walletDto = (wallet) => {
  if (!wallet) {
    return {
      availablePoints: 0,
      reservedPoints: 0,
      totalPurchased: 0,
      totalEarnedBonus: 0,
      totalConsumed: 0,
    };
  }
  const value = typeof wallet.toObject === "function"
    ? wallet.toObject({ virtuals: true })
    : wallet;
  return {
    availablePoints:
      Number(value.availablePoints) ||
      Number(value.availableBonusPoints || 0) + Number(value.availablePurchasedPoints || 0),
    reservedPoints:
      Number(value.reservedPoints) ||
      Number(value.reservedBonusPoints || 0) + Number(value.reservedPurchasedPoints || 0),
    totalPurchased: Number(value.totalPurchased || 0),
    totalEarnedBonus: Number(value.totalEarnedBonus || 0),
    totalConsumed: Number(value.totalConsumed || 0),
    totalRefunded: Number(value.totalRefunded || 0),
  };
};

const lastDriverActivity = (driver) => {
  const times = [
    driver.updatedAt,
    driver.presenceLastHeartbeatAt,
    driver.locationUpdatedAt,
  ]
    .map((value) => new Date(value || 0).getTime())
    .filter((value) => Number.isFinite(value) && value > 0);
  return times.length ? new Date(Math.max(...times)) : null;
};

const enrichDriverOperations = async (drivers) => {
  const normalized = await enrichAdminDriverPresence(
    drivers.map((driver) => (typeof driver.toObject === "function" ? driver.toObject() : driver))
  );
  const driverIds = normalized.map((driver) => driver._id).filter(Boolean);
  const [
    wallets,
    activeRides,
    rideCounts,
    offerCounts,
  ] = await Promise.all([
    DriverPointsWallet.find({ driverId: { $in: driverIds } }).lean({ virtuals: true }),
    Ride.find({ driverId: { $in: driverIds }, status: { $in: ACTIVE_RIDE_STATUSES } })
      .select("_id driverId reference status vehicleType requestedAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean(),
    Ride.aggregate([
      { $match: { driverId: { $in: driverIds } } },
      {
        $group: {
          _id: "$driverId",
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          cancelledByDriver: { $sum: { $cond: [{ $eq: ["$status", "cancelled_by_driver"] }, 1, 0] } },
          terminal: {
            $sum: {
              $cond: [
                { $in: ["$status", ["completed", "cancelled", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    TripOffer.aggregate([
      { $match: { driverId: { $in: driverIds } } },
      { $group: { _id: "$driverId", total: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } } } },
    ]),
  ]);

  const walletsByDriver = new Map(wallets.map((wallet) => [String(wallet.driverId), wallet]));
  const activeRideByDriver = new Map(activeRides.map((ride) => [String(ride.driverId), ride]));
  const rideCountsByDriver = new Map(rideCounts.map((item) => [String(item._id), item]));
  const offerCountsByDriver = new Map(offerCounts.map((item) => [String(item._id), item]));

  return normalized.map((driver) => {
    const driverId = String(driver._id);
    const rideSummary = rideCountsByDriver.get(driverId) || {};
    const offerSummary = offerCountsByDriver.get(driverId) || {};
    const activeRide = activeRideByDriver.get(driverId) || null;
    return {
      ...driver,
      documentSummary: documentAvailability(driver),
      pointsWallet: walletDto(walletsByDriver.get(driverId)),
      cancellationRate: rideSummary.terminal
        ? (Number(rideSummary.cancelledByDriver || 0) / Number(rideSummary.terminal)) * 100
        : 0,
      rideSummary: {
        total: Number(rideSummary.total || 0),
        completed: Number(rideSummary.completed || 0),
        activeRide: activeRide
          ? {
              id: String(activeRide._id),
              reference: activeRide.reference,
              status: activeRide.status,
              vehicleType: activeRide.vehicleType || "",
              updatedAt: activeRide.updatedAt,
            }
          : null,
      },
      tripOfferSummary: {
        total: Number(offerSummary.total || 0),
        pending: Number(offerSummary.pending || 0),
      },
      lastActivityAt: lastDriverActivity(driver),
    };
  });
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The only admin roles a team-management action may ever assign. "owner" can
// never be granted this way, and "support"/"analyst" are schema-valid but not
// yet enforced anywhere in the backend, so granting them would silently hand
// out full admin access under a misleading label.
const MANAGEABLE_ADMIN_ROLES = ["finance_admin", "admin"];

export const registerAdmin = async (req, res) => {
  try {
    if (req.admin?.role !== "owner") {
      return res.status(403).send({
        success: false,
        message: "Only the Drewel Owner can create new admin accounts",
      });
    }

    const { fullName, email, password } = req.body || {};
    const requestedRole = String(req.body?.role || "admin");
    if (!MANAGEABLE_ADMIN_ROLES.includes(requestedRole)) {
      return res.status(400).send({
        success: false,
        message: `Role must be one of: ${MANAGEABLE_ADMIN_ROLES.join(", ")}`,
      });
    }

    if (!fullName || !email || !password) {
      return res
        .status(200)
        .send({ success: false, message: "Please provide all fields" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingAdmin = await Admin.findOne({ email: normalizedEmail });
    if (existingAdmin) {
      return res
        .status(200)
        .send({ success: false, message: "This email already registered" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({
      fullName,
      email: normalizedEmail,
      password: hashedPassword,
      role: requestedRole,
    });
    await newAdmin.save();
    await AuthAudit.create({
      action: "admin_created",
      actorId: req.admin._id,
      actorRole: req.admin.role,
      actorName: req.admin.fullName,
      actorEmail: req.admin.email,
      targetType: "admin",
      targetId: newAdmin._id,
      description: `Created admin account ${normalizedEmail} with role ${requestedRole}`,
    });
    return res
      .status(200)
      .send({ success: true, message: "New admin is registered" });
  } catch (error̥) {
    console.log("error̥ ==> ", error̥);
    return res
      .status(500)
      .send({ success: false, message: "Error while registering admin" });
  }
};

export const updateAdminRole = async (req, res) => {
  try {
    if (req.admin?.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Only the Drewel Owner can change admin roles",
      });
    }
    const { id } = req.params;
    const nextRole = String(req.body?.role || "");
    if (!MANAGEABLE_ADMIN_ROLES.includes(nextRole)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${MANAGEABLE_ADMIN_ROLES.join(", ")}`,
      });
    }
    if (String(id) === String(req.admin._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
    }
    const target = await Admin.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
    if (target.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "The Owner role cannot be changed",
      });
    }
    const previousRole = target.role;
    target.role = nextRole;
    await target.save();
    await AuthAudit.create({
      action: "admin_role_changed",
      actorId: req.admin._id,
      actorRole: req.admin.role,
      actorName: req.admin.fullName,
      actorEmail: req.admin.email,
      targetType: "admin",
      targetId: target._id,
      description: `Changed role of ${target.email} from ${previousRole} to ${nextRole}`,
      metadata: { previousRole, newRole: nextRole },
    });
    return res.status(200).json({
      success: true,
      message: "Admin role updated",
      admin: { id: String(target._id), fullName: target.fullName, email: target.email, role: target.role },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update admin role" });
  }
};

export const updateAdminStatus = async (req, res) => {
  try {
    if (req.admin?.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Only the Drewel Owner can activate or deactivate admins",
      });
    }
    const { id } = req.params;
    const isActive = Boolean(req.body?.isActive);
    if (String(id) === String(req.admin._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }
    const target = await Admin.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
    if (target.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "The Owner account cannot be deactivated",
      });
    }
    target.isActive = isActive;
    await target.save();
    await AuthAudit.create({
      action: isActive ? "admin_reactivated" : "admin_deactivated",
      actorId: req.admin._id,
      actorRole: req.admin.role,
      actorName: req.admin.fullName,
      actorEmail: req.admin.email,
      targetType: "admin",
      targetId: target._id,
      description: `${isActive ? "Reactivated" : "Deactivated"} admin account ${target.email}`,
    });
    return res.status(200).json({
      success: true,
      message: isActive ? "Admin reactivated" : "Admin deactivated",
      admin: { id: String(target._id), fullName: target.fullName, email: target.email, isActive: target.isActive },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update admin status" });
  }
};

export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // 2. Check if admin exists
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingAdmin = await Admin.findOne({ email: normalizedEmail }).select(
      "+password"
    );
    if (!existingAdmin) {
      return res.status(401).json({
        success: false,
        message: "Admin not found",
      });
    }

    // 3. Compare passwords
    const isMatch = await bcrypt.compare(password, existingAdmin.password);
    if (!isMatch) {
      await AuthAudit.create({
        action: "login_failure",
        actorId: existingAdmin._id,
        actorRole: existingAdmin.role,
        actorName: existingAdmin.fullName,
        actorEmail: existingAdmin.email,
        description: "Invalid password",
      });
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!["owner", "finance_admin", "admin"].includes(existingAdmin.role)) {
      return res.status(403).json({
        success: false,
        message: "This account does not have administrator access",
      });
    }

    if (existingAdmin.isActive === false) {
      await AuthAudit.create({
        action: "login_failure",
        actorId: existingAdmin._id,
        actorRole: existingAdmin.role,
        actorName: existingAdmin.fullName,
        actorEmail: existingAdmin.email,
        description: "Login attempt on a deactivated admin account",
      });
      return res.status(403).json({
        success: false,
        message: "This admin account has been deactivated",
      });
    }

    // 4. Generate JWT token
    const token = jwt.sign(
      { _id: existingAdmin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "8h" }
    );

    const admin = existingAdmin.toObject();
    delete admin.password;

    await AuthAudit.create({
      action: "login_success",
      actorId: existingAdmin._id,
      actorRole: existingAdmin.role,
      actorName: existingAdmin.fullName,
      actorEmail: existingAdmin.email,
    });

    // 5. Send success response
    return res.status(200).json({
      success: true,
      message: "Admin logged in successfully",
      token,
      admin,
    });
  } catch (error) {
    console.log("Login error ==> ", error);
    return res.status(500).json({
      success: false,
      message: "Error while login",
    });
  }
};

export const logoutAdmin = async (req, res) => {
  try {
    if (req.admin) {
      await AuthAudit.create({
        action: "logout",
        actorId: req.admin._id,
        actorRole: req.admin.role,
        actorName: req.admin.fullName,
        actorEmail: req.admin.email,
      });
    }
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to record logout" });
  }
};

export const getOnlineDrivers = async (_req, res) => {
  try {
    const now = new Date();
    const drivers = await Driver.find({
      ...buildActiveDriverPresenceFilter(),
    })
      .select(ADMIN_DRIVER_PRESENCE_FIELDS)
      .sort({ presenceLastHeartbeatAt: -1, _id: 1 })
      .lean();

    const normalized = await enrichAdminDriverPresence(drivers, now);

    return res.status(200).json({
      success: true,
      message: "Online driver list fetched successfully",
      drivers: normalized,
    });
  } catch (error) {
    console.error("Failed to fetch online drivers:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch online drivers",
    });
  }
};

export const getDriversWithLocation = async (_req, res) => {
  try {
    const now = new Date();
    const drivers = await Driver.find({
      isApproved: true,
      isDeleted: { $ne: true },
      isRestricted: { $ne: true },
      lat: { $ne: 0 },
      long: { $ne: 0 },
    })
      .select(ADMIN_DRIVER_PRESENCE_FIELDS)
      .sort({ locationUpdatedAt: -1, _id: 1 })
      .lean();

    const normalized = await enrichAdminDriverPresence(drivers, now);

    return res.status(200).json({
      success: true,
      message: "Drivers with location fetched successfully",
      drivers: normalized,
    });
  } catch (error) {
    console.error("Failed to fetch drivers with location:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch drivers with location",
    });
  }
};

export const getDriversForReview = async (req, res) => {
  try {
    const {
      status,
      search,
      availability,
      discoverability,
      restricted,
      page = 1,
      limit = 20,
      sort = "updatedAt",
      dir = "desc",
    } = req.query || {};
    const filter = {};
    if (status && ["pending", "approved", "rejected", "completed"].includes(status)) {
      filter.status = status;
    }
    if (availability) {
      const values = String(availability)
        .split(",")
        .map((v) => v.trim())
        .filter((v) => ["Online", "Busy", "Offline"].includes(v));
      if (values.length === 1) filter.availabilityStatus = values[0];
      else if (values.length > 1) filter.availabilityStatus = { $in: values };
    }
    if (restricted === "true") {
      filter.isRestricted = true;
    } else if (restricted === "false") {
      filter.isRestricted = { $ne: true };
    }
    const term = String(search || "").trim();
    if (term) {
      const regex = new RegExp(escapeRegex(term), "i");
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { fullName: regex },
        { phone: regex },
        { whatsappNumber: regex },
        { vehicleType: regex },
        { vehicleModel: regex },
        { registration: regex },
      ];
    }

    const pageNumber = Math.max(1, Math.trunc(Number(page) || 1));
    const limitNumber = Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20)));
    const sortFields = new Set([
      "updatedAt",
      "createdAt",
      "basicRequestSubmittedAt",
      "status",
      "availabilityStatus",
      "locationUpdatedAt",
      "presenceLastHeartbeatAt",
    ]);
    if (!sortFields.has(String(sort))) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DRIVER_SORT",
        message: "Invalid driver sort field",
      });
    }
    const sortDir = String(dir).toLowerCase() === "asc" ? 1 : -1;

    const [drivers, total] = await Promise.all([
      Driver.find(filter)
        .sort({ [sort]: sortDir, _id: sortDir })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),
      Driver.countDocuments(filter),
    ]);
    let normalized = await enrichDriverOperations(drivers);
    if (discoverability === "discoverable") {
      normalized = normalized.filter((driver) => driver.isDiscoverable);
    } else if (discoverability === "blocked") {
      normalized = normalized.filter((driver) => !driver.isDiscoverable);
    }
    return res.status(200).json({
      success: true,
      message: "Driver list fetched successfully",
      drivers: normalized,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNumber)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch drivers",
      error: error.message,
    });
  }
};

export const getDriverReviewDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await Driver.findById(id).populate("driverLogs");
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }
    const data = driver.toObject();
    // Older update flows created DriverLogs by driverId without assigning the
    // optional Driver.driverLogs reference, so populate alone misses them.
    const driverLog =
      data.driverLogs || (await DriverLogs.findOne({ driverId: driver._id }).lean());
    applyDriverLogFallbacks(data, driverLog);
    const [enriched] = await enrichDriverOperations([data]);
    const driverId = driver._id;
    const [
      recentRides,
      recentTripOffers,
      requestHistory,
    ] = await Promise.all([
      Ride.find({ driverId })
        .select("_id reference status pickup destination vehicleType agreedPrice requestedAt startedAt endedAt updatedAt")
        .sort({ updatedAt: -1, _id: -1 })
        .limit(10)
        .lean(),
      TripOffer.find({ driverId })
        .select("_id rideId amount price status expiresAt acceptedAt declinedAt createdAt updatedAt")
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .lean(),
      RequestAudit.find({ driverId })
        .select("_id action oldStatus newStatus requestStage actorType actorName actorEmail reason occurredAt createdAt")
        .sort({ occurredAt: -1, _id: -1 })
        .limit(25)
        .lean(),
    ]);
    const responseDriver = {
      ...enriched,
      recentRides,
      recentTripOffers,
      requestHistory,
    };
    return res.status(200).json({
      success: true,
      message: "Driver details fetched successfully",
      driver: responseDriver,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch driver details",
      error: error.message,
    });
  }
};

const isPersonnelController = (req) =>
  ["owner", "finance_admin"].includes(String(req.admin?.role || "").toLowerCase());

const personnelControlError = () => ({
  success: false,
  code: "PERSONNEL_CONTROL_REQUIRED",
  message: "Only the Drewel Owner or a Finance Admin may suspend or restore driver accounts",
});

const writeRestrictionAudit = async (driver, { action, actor, reason, oldStatus, session }) => {
  await RequestAudit.create(
    [{
      requestId: driver._id,
      requestStage: "basic",
      action,
      oldStatus,
      newStatus: action === "suspended" ? "restricted" : "approved",
      actorId: actor._id,
      actorType: actor.actorType || "admin",
      actorName: actor.fullName || actor.name || "",
      actorEmail: actor.email || "",
      reason: String(reason || "").trim(),
      occurredAt: driver.restrictedAt || new Date(),
    }],
    { session }
  );
};

const restrictDriverLoader = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ success: false, code: "INVALID_DRIVER_ID", message: "Invalid driver id" });
    return null;
  }
  if (!isPersonnelController(req)) {
    res.status(403).json(personnelControlError());
    return null;
  }
  if (req.body?.confirmed !== true) {
    res.status(400).json({ success: false, code: "CONFIRMATION_REQUIRED", message: "Account changes must be explicitly confirmed" });
    return null;
  }
  const reason = String(req.body?.reason || "").trim();
  if (!reason) {
    res.status(400).json({ success: false, code: "REASON_REQUIRED", message: "A reason is required for this account change" });
    return null;
  }
  if (reason.length > 1000) {
    res.status(400).json({ success: false, code: "INVALID_REASON", message: "reason must not exceed 1000 characters" });
    return null;
  }
  const driver = await Driver.findById(id);
  if (!driver) {
    res.status(404).json({ success: false, code: "DIVER_NOT_FOUND", message: "Driver not found" });
    return null;
  }
  return driver;
};

export const suspendDriverAccess = async (req, res) => {
  const driver = await restrictDriverLoader(req, res);
  if (!driver) return;
  const session = await mongoose.startSession();
  let saved = null;
  let forcedPresenceTransition = false;
  try {
    await session.withTransaction(async () => {
      const locked = await Driver.findById(req.params.id).session(session);
      if (locked.isRestricted) {
        throw Object.assign(new Error("This driver account is already suspended"), { statusCode: 409, code: "ALREADY_RESTRICTED" });
      }
      const wasOnline = locked.presenceStatus === "Online" || locked.isOnline === true;
      locked.isRestricted = true;
      locked.restrictedReason = String(req.body?.reason || "").trim();
      locked.restrictedAt = new Date();
      locked.restrictedBy = req.admin._id;
      applyForcedOfflinePresence(locked, locked.restrictedAt);
      forcedPresenceTransition = wasOnline && locked.presenceStatus === "Offline" && locked.isOnline === false;
      await locked.save({ session });
      await writeRestrictionAudit(locked, {
        action: "suspended",
        actor: { _id: req.admin._id, fullName: req.admin.fullName, email: req.admin.email, actorType: "admin" },
        reason: locked.restrictedReason,
        oldStatus: locked.status || "approved",
        session,
      });
      saved = locked;
    });
    if (forcedPresenceTransition) emitDriverPresenceTransition(saved, "DRIVER_ELIGIBILITY_REVOKED");
    return res.status(200).json({
      success: true,
      message: "Driver account suspended",
      driver: saved,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      ...(error.code ? { code: error.code } : {}),
      message: statusCode === 500 ? "Failed to suspend driver account" : error.message,
    });
  } finally {
    await session.endSession();
  }
};

export const restoreDriverAccess = async (req, res) => {
  const driver = await restrictDriverLoader(req, res);
  if (!driver) return;
  const session = await mongoose.startSession();
  let saved = null;
  try {
    await session.withTransaction(async () => {
      const locked = await Driver.findById(req.params.id).session(session);
      if (!locked.isRestricted) {
        throw Object.assign(new Error("This driver account is not currently suspended"), { statusCode: 409, code: "NOT_RESTRICTED" });
      }
      locked.isRestricted = false;
      locked.restrictedReason = "";
      locked.restrictedAt = null;
      locked.restrictedBy = null;
      await locked.save({ session });
      await writeRestrictionAudit(locked, {
        action: "restored",
        actor: { _id: req.admin._id, fullName: req.admin.fullName, email: req.admin.email, actorType: "admin" },
        reason: String(req.body?.reason || "").trim(),
        oldStatus: "restricted",
        session,
      });
      saved = locked;
    });
    return res.status(200).json({
      success: true,
      message: "Driver account restored",
      driver: saved,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      ...(error.code ? { code: error.code } : {}),
      message: statusCode === 500 ? "Failed to restore driver account" : error.message,
    });
  } finally {
    await session.endSession();
  }
};

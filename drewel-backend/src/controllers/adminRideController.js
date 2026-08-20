import mongoose from "mongoose";
import Ride, {
  ACTIVE_RIDE_STATUSES,
  TERMINAL_RIDE_STATUSES,
} from "../models/Ride.js";
import RideAudit from "../models/RideAudit.js";
import RideInternalNote from "../models/RideInternalNote.js";
import TripOffer from "../models/TripOffer.js";
import PointTransaction from "../models/PointTransaction.js";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import {
  RideTransitionError,
  transitionRideState,
} from "../services/rideTransitionService.js";
import {
  refundRidePointsInSession,
  runPointsTransaction,
  toWalletDto,
} from "../services/pointsWalletService.js";
import { io, ADMIN_TRACKING_ROOM } from "../socket/index.js";
import { toTripOfferDto } from "../services/tripOfferService.js";
import { calculateRideCommission } from "../services/commissionService.js";
import PointsSettings from "../models/PointsSettings.js";

const cancelledStatuses = [
  "cancelled",
  "cancelled_by_user",
  "cancelled_by_driver",
  "cancelled_by_admin",
];

const fail = (res, error) =>
  res.status(error.statusCode || error.status || 500).json({
    success: false,
    code: error.code || "ADMIN_RIDE_INTERNAL_ERROR",
    message:
      error.statusCode || error.status ? error.message : "Internal server error",
  });

const requireRideId = (value) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new RideTransitionError("Invalid ride id", 400, "INVALID_RIDE_ID");
  }
  return value;
};

const requireReason = (value) => {
  const reason = String(value || "").trim();
  if (reason.length < 3 || reason.length > 1000) {
    throw new RideTransitionError(
      "A reason between 3 and 1000 characters is required",
      400,
      "ADMIN_RIDE_REASON_REQUIRED"
    );
  }
  return reason;
};

const requireKey = (req) => {
  const key = String(
    req.get("Idempotency-Key") || req.body?.idempotencyKey || ""
  ).trim();
  if (key.length < 8 || key.length > 200) {
    throw new RideTransitionError(
      "A valid Idempotency-Key header is required",
      400,
      "IDEMPOTENCY_KEY_REQUIRED"
    );
  }
  return key;
};

const principalFor = (req) => ({
  id: req.admin._id,
  role: "admin",
  subject: req.admin,
});

const emitAdminRideUpdate = (ride, event, payload) => {
  try {
    io.to(`ride:${String(ride?._id)}`)
      .to(ADMIN_TRACKING_ROOM)
      .emit(event, { rideId: String(ride?._id), ...payload });
  } catch (error) {
    console.error("[socket] admin ride update emit failed", error.message);
  }
};

const rideDto = (ride) => ({
  id: String(ride._id),
  reference: ride.reference,
  status: ride.status,
  passengerId: String(ride.passengerId?._id || ride.passengerId),
  driverId: String(ride.driverId?._id || ride.driverId),
  user:
    ride.passengerId && typeof ride.passengerId === "object"
      ? {
          id: String(ride.passengerId._id),
          fullName: ride.passengerId.fullName || "",
        }
      : null,
  passenger:
    ride.passengerId && typeof ride.passengerId === "object"
      ? {
          id: String(ride.passengerId._id),
          fullName: ride.passengerId.fullName || "",
        }
      : null,
  driver:
    ride.driverId && typeof ride.driverId === "object"
      ? {
          id: String(ride.driverId._id),
          fullName:
            ride.driverId.fullName ||
            [ride.driverId.firstName, ride.driverId.lastName]
              .filter(Boolean)
              .join(" "),
          vehicleType: ride.driverId.vehicleType || "",
        }
      : null,
  pickup: ride.pickup,
  destination: ride.destination,
  agreedPrice: ride.agreedPrice,
  stateVersion: ride.stateVersion || 0,
  cancellation: ride.cancellation,
  lastDriverLocation: ride.lastDriverLocation,
  routeUpdatedAt:
    ride.routeSnapshot?.updatedAt || ride.routeUpdatedAt || null,
  etaMinutes:
    ride.routeSnapshot?.durationSeconds != null
      ? Math.ceil(ride.routeSnapshot.durationSeconds / 60)
      : null,
  distanceMeters: ride.routeSnapshot?.distanceMeters ?? null,
  routePhase: ride.routeSnapshot?.phase || null,
  routePolyline: ride.routeSnapshot?.encodedPolyline || "",
  lastGpsAt: ride.lastDriverLocation?.recordedAt || null,
  lastGpsAgeSeconds:
    ride.lastDriverLocation?.recordedAt != null
      ? Math.max(
          0,
          Math.round((Date.now() - new Date(ride.lastDriverLocation.recordedAt).getTime()) / 1000)
        )
      : null,
  requestedAt: ride.requestedAt,
  confirmedAt: ride.confirmedAt,
  driverOnTheWayAt: ride.driverOnTheWayAt,
  driverArrivedAt: ride.driverArrivedAt,
  pickupConfirmedAt: ride.pickupConfirmedAt,
  startedAt: ride.startedAt,
  endedAt: ride.endedAt,
  createdAt: ride.createdAt,
  updatedAt: ride.updatedAt,
});

const loadRide = (id) =>
  Ride.findById(id)
    .populate("passengerId", "fullName")
    .populate("driverId", "firstName lastName fullName vehicleType");

export const listAdminRides = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit || "20", 10) || 20)
    );
    const status = String(req.query.status || "active").trim().toLowerCase();
    const filter = {};
    const statusBuckets = {
      requested: ["requested"],
      searching: ["contacting", "offer_pending"],
      assigned: ["accepted", "confirmed"],
      live: [
        "driver_arriving",
        "driver_on_the_way",
        "driver_arrived",
        "pickup_confirmed",
        "in_progress",
        "disputed",
      ],
      active: [
        "driver_arriving",
        "driver_on_the_way",
        "driver_arrived",
        "pickup_confirmed",
        "in_progress",
        "disputed",
      ],
      completed: ["completed"],
      cancelled: cancelledStatuses,
      disputed: ["disputed"],
      disputes: ["disputed"],
      stuck: ACTIVE_RIDE_STATUSES,
    };
    if (status !== "all") {
      const statusFilter = statusBuckets[status];
      if (!statusFilter) {
        throw new RideTransitionError(
          "Invalid ride status filter",
          400,
          "INVALID_RIDE_FILTER"
        );
      }
      filter.status =
        statusFilter.length === 1 ? statusFilter[0] : { $in: statusFilter };
      if (status === "stuck") {
        filter.updatedAt = {
          ...(filter.updatedAt || {}),
          $lt: new Date(Date.now() - 60 * 60 * 1000),
        };
      }
    }

    const from = String(req.query.from || "").trim();
    if (from) {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) {
        throw new RideTransitionError(
          "Invalid from date filter",
          400,
          "INVALID_RIDE_FILTER"
        );
      }
      filter.createdAt = { ...(filter.createdAt || {}), $gte: fromDate };
    }

    const to = String(req.query.to || "").trim();
    if (to) {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) {
        throw new RideTransitionError(
          "Invalid to date filter",
          400,
          "INVALID_RIDE_FILTER"
        );
      }
      toDate.setHours(23, 59, 59, 999);
      filter.createdAt = { ...(filter.createdAt || {}), $lte: toDate };
    }

    const vehicleType = String(req.query.vehicleType || "").trim();
    if (vehicleType) {
      const escaped = vehicleType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.vehicleType = new RegExp(escaped, "i");
    }

    const city = String(req.query.city || "").trim();
    if (city) {
      const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        ...(filter.$or || []),
        { "pickup.address": new RegExp(escaped, "i") },
        { "destination.address": new RegExp(escaped, "i") },
      ];
    }

    const addParticipantFilter = async (field, value, model, nameFields) => {
      const text = String(value || "").trim();
      if (!text) return;
      if (mongoose.isValidObjectId(text)) {
        filter[field] = text;
        return;
      }
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = await model
        .find({
          $or: nameFields.map((nameField) => ({
            [nameField]: new RegExp(escaped, "i"),
          })),
        })
        .select("_id")
        .limit(100)
        .lean();
      filter[field] = matches.length
        ? { $in: matches.map((item) => item._id) }
        : { $in: [] };
    };

    const search = String(req.query.search || "").trim();
    if (search) {
      if (search.length > 100) {
        throw new RideTransitionError(
          "Search is too long",
          400,
          "INVALID_RIDE_SEARCH"
        );
      }
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ reference: new RegExp(escaped, "i") }];
      if (mongoose.isValidObjectId(search)) {
        filter.$or.push(
          { _id: search },
          { passengerId: search },
          { driverId: search }
        );
      }
    }

    await Promise.all([
      addParticipantFilter("driverId", req.query.driver, Driver, [
        "fullName",
        "firstName",
        "lastName",
      ]),
      addParticipantFilter("passengerId", req.query.customer, User, [
        "fullName",
      ]),
    ]);

    const sortKey = String(req.query.sort || "updatedAt").trim();
    const sortDir = String(req.query.dir || "desc").trim().toLowerCase() === "asc" ? 1 : -1;
    const sortFields = new Set([
      "createdAt",
      "updatedAt",
      "requestedAt",
      "endedAt",
      "status",
      "vehicleType",
    ]);
    if (!sortFields.has(sortKey)) {
      throw new RideTransitionError(
        "Invalid ride sort field",
        400,
        "INVALID_RIDE_SORT"
      );
    }

    const [rides, total] = await Promise.all([
      Ride.find(filter)
        .populate("passengerId", "fullName")
        .populate("driverId", "firstName lastName fullName vehicleType")
        .sort({ [sortKey]: sortDir, _id: sortDir })
        .skip((page - 1) * limit)
        .limit(limit),
      Ride.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      rides: rides.map(rideDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getAdminRide = async (req, res) => {
  try {
    const rideId = requireRideId(req.params.rideId);
    const ride = await loadRide(rideId);
    if (!ride) {
      throw new RideTransitionError("Ride not found", 404, "RIDE_NOT_FOUND");
    }
    const [auditTrail, points, tripOffer, internalNotes] = await Promise.all([
      RideAudit.find({ rideId }).sort({ occurredAt: -1, _id: -1 }).limit(250),
      PointTransaction.find({ rideId }).sort({ createdAt: -1, _id: -1 }),
      TripOffer.findOne({
        $or: [{ contactRideId: rideId }, { rideId }],
      }).lean(),
      RideInternalNote.find({ rideId }).sort({ createdAt: -1, _id: -1 }).lean(),
    ]);
    const pointsCharged = points.reduce(
      (sum, transaction) =>
        transaction.type === "debit" && transaction.status === "completed"
          ? sum + Number(transaction.points || 0)
          : sum,
      0
    );

    let commissionBreakdown = null;
    if (ride.commission?.ridePriceAED != null) {
      commissionBreakdown = {
        ridePriceAED: ride.commission.ridePriceAED,
        commissionRate: ride.commission.commissionRate,
        commissionAED: ride.commission.commissionAED,
        pointsPerAED: ride.commission.pointsPerAED,
        pointsCharged: ride.commission.pointsCharged,
        driverNetAED: ride.commission.driverNetAED,
        chargedAt: ride.commission.chargedAt,
        transactionId: ride.commission.transactionId,
      };
    } else if (ride.agreedPrice && ride.status === "completed") {
      try {
        const settings = await PointsSettings.getEffective();
        commissionBreakdown = calculateRideCommission(ride.agreedPrice, settings);
        commissionBreakdown.note = "Estimated from current settings (snapshot not saved)";
      } catch { /* ignore */ }
    }

    return res.json({
      success: true,
      ride: {
        ...rideDto(ride),
        tripOffer: tripOffer ? toTripOfferDto(tripOffer) : null,
        internalNotes: internalNotes.map((note) => ({
          id: String(note._id),
          adminId: String(note.adminId),
          adminName: note.adminName,
          text: note.text,
          createdAt: note.createdAt,
        })),
        pointsCharged,
        pointsTransaction: points,
        auditTrail,
        commission: commissionBreakdown,
      },
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const cancelAdminRide = async (req, res) => {
  try {
    const ride = await transitionRideState({
      rideId: requireRideId(req.params.rideId),
      principal: principalFor(req),
      nextStatus: "cancelled_by_admin",
      idempotencyKey: requireKey(req),
      reason: requireReason(req.body?.reason),
      note: String(req.body?.note || "").trim().slice(0, 1000),
      overrideReason: requireReason(req.body?.reason),
    });
    emitAdminRideUpdate(ride, "ride:status_changed", {
      status: ride.status,
      action: "cancelled_by_admin",
      updatedAt: ride.endedAt || ride.updatedAt,
    });
    return res.json({ success: true, ride: rideDto(ride) });
  } catch (error) {
    return fail(res, error);
  }
};

export const openAdminDispute = async (req, res) => {
  try {
    const ride = await transitionRideState({
      rideId: requireRideId(req.params.rideId),
      principal: principalFor(req),
      nextStatus: "disputed",
      idempotencyKey: requireKey(req),
      reason: requireReason(req.body?.reason),
      note: String(req.body?.note || "").trim().slice(0, 1000),
      metadata: { openedBy: "admin", disputeOpened: true },
    });
    emitAdminRideUpdate(ride, "ride:status_changed", {
      status: ride.status,
      action: "dispute_opened",
      updatedAt: ride.updatedAt,
    });
    return res.json({ success: true, ride: rideDto(ride) });
  } catch (error) {
    return fail(res, error);
  }
};

export const markRideTechnicalFailure = async (req, res) => {
  try {
    const ride = await transitionRideState({
      rideId: requireRideId(req.params.rideId),
      principal: principalFor(req),
      nextStatus: "cancelled_by_admin",
      idempotencyKey: requireKey(req),
      reason: requireReason(req.body?.reason),
      note: String(req.body?.note || "").trim().slice(0, 1000),
      overrideReason: requireReason(req.body?.reason),
      metadata: { failureType: "technical", pointsDecision: "admin_refund_pending" },
    });
    emitAdminRideUpdate(ride, "ride:status_changed", {
      status: ride.status,
      action: "technical_failure",
      updatedAt: ride.endedAt || ride.updatedAt,
    });
    return res.json({ success: true, ride: rideDto(ride) });
  } catch (error) {
    return fail(res, error);
  }
};

export const resolveRideDispute = async (req, res) => {
  try {
    const rideId = requireRideId(req.params.rideId);
    const resolution = String(req.body?.resolution || "").trim();
    if (!["completed", "cancelled_by_admin"].includes(resolution)) {
      throw new RideTransitionError(
        "Resolution must be completed or cancelled_by_admin",
        400,
        "INVALID_DISPUTE_RESOLUTION"
      );
    }
    const reason = requireReason(req.body?.reason);
    const ride = await transitionRideState({
      rideId,
      principal: principalFor(req),
      nextStatus: resolution,
      idempotencyKey: requireKey(req),
      reason,
      note: String(req.body?.note || "").trim().slice(0, 1000),
      overrideReason: reason,
    });
    emitAdminRideUpdate(ride, "ride:status_changed", {
      status: ride.status,
      action: "dispute_resolved",
      updatedAt: ride.endedAt || ride.updatedAt,
    });
    return res.json({ success: true, ride: rideDto(ride) });
  } catch (error) {
    return fail(res, error);
  }
};

export const unlockRideParticipants = async (req, res) => {
  try {
    const rideId = requireRideId(req.params.rideId);
    const key = requireKey(req);
    const reason = requireReason(req.body?.reason);
    let ride;
    let idempotent = false;
    await mongoose.connection.transaction(async (session) => {
      const existing = await RideAudit.findOne({
        rideId,
        actorId: req.admin._id,
        action: "ride_participants_unlocked",
        idempotencyKey: key,
      }).session(session);
      ride = await Ride.findById(rideId).session(session);
      if (!ride) {
        throw new RideTransitionError("Ride not found", 404, "RIDE_NOT_FOUND");
      }
      if (existing) {
        idempotent = true;
        return;
      }
      if (
        !TERMINAL_RIDE_STATUSES.includes(ride.status) &&
        ride.status !== "disputed"
      ) {
        throw new RideTransitionError(
          "Only a terminal or disputed ride can be unlocked",
          409,
          "RIDE_UNLOCK_FORBIDDEN"
        );
      }
      const driver = await Driver.findById(ride.driverId)
        .select("isOnline")
        .session(session);
      await Promise.all([
        Driver.updateOne(
          { _id: ride.driverId, activeRideId: ride._id },
          {
            $set: {
              activeRideId: null,
              activeRideStartedAt: null,
              availabilityStatus: driver?.isOnline ? "Online" : "Offline",
            },
          },
          { session }
        ),
        User.updateOne(
          { _id: ride.passengerId, activeRideId: ride._id },
          { $set: { activeRideId: null, activeRideStartedAt: null } },
          { session }
        ),
        RideAudit.create(
          [
            {
              rideId,
              action: "ride_participants_unlocked",
              fromStatus: ride.status,
              toStatus: ride.status,
              actorId: req.admin._id,
              actorRole: "admin",
              reasonCode: reason,
              metadata: {
                note: String(req.body?.note || "").trim().slice(0, 1000),
              },
              idempotencyKey: key,
            },
          ],
          { session }
        ),
      ]);
    });
    emitAdminRideUpdate(ride, "ride:participants_unlocked", {
      action: "participants_unlocked",
      idempotent,
      updatedAt: new Date(),
    });
    return res.json({ success: true, ride: rideDto(ride), idempotent });
  } catch (error) {
    return fail(res, error);
  }
};

export const refundRidePoints = async (req, res) => {
  try {
    const rideId = requireRideId(req.params.rideId);
    const key = requireKey(req);
    const reason = requireReason(req.body?.reason);
    const requestedPoints =
      req.body?.points === undefined || req.body?.points === null
        ? null
        : Number(req.body.points);
    let rideRef = null;
    const result = await runPointsTransaction(async (session) => {
      const ride = await Ride.findById(rideId).session(session);
      if (!ride) {
        throw new RideTransitionError("Ride not found", 404, "RIDE_NOT_FOUND");
      }
      rideRef = ride;
      const refund = await refundRidePointsInSession({
        driverId: ride.driverId,
        rideId,
        points: requestedPoints,
        adminId: req.admin._id,
        reason,
        idempotencyKey: `ride-refund:${req.admin._id}:${key}`,
        session,
      });
      if (!refund.idempotent) {
        await RideAudit.create(
          [
            {
              rideId,
              action: "ride_points_refunded",
              fromStatus: ride.status,
              toStatus: ride.status,
              actorId: req.admin._id,
              actorRole: "admin",
              reasonCode: reason,
              metadata: {
                points: refund.transaction.points,
                transactionId: String(refund.transaction._id),
                note: String(req.body?.note || "").trim().slice(0, 1000),
              },
              idempotencyKey: key,
            },
          ],
          { session }
        );
      }
      return refund;
    });
    emitAdminRideUpdate(rideRef, "ride:points_refunded", {
      action: "points_refunded",
      points: result.transaction?.points ?? null,
      transactionId: result.transaction ? String(result.transaction._id) : null,
      idempotent: result.idempotent,
      updatedAt: new Date(),
    });
    return res.status(result.idempotent ? 200 : 201).json({
      success: true,
      wallet: toWalletDto(result.wallet),
      transaction: result.transaction,
      idempotent: result.idempotent,
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const addRideInternalNote = async (req, res) => {
  try {
    const rideId = requireRideId(req.params.rideId);
    const key = requireKey(req);
    const text = String(req.body?.text || "").trim();
    if (text.length < 3 || text.length > 2000) {
      throw new RideTransitionError(
        "Internal note must be between 3 and 2000 characters",
        400,
        "ADMIN_RIDE_NOTE_REQUIRED"
      );
    }
    let note;
    let idempotent = false;
    await mongoose.connection.transaction(async (session) => {
      const ride = await Ride.findById(rideId).session(session);
      if (!ride) {
        throw new RideTransitionError("Ride not found", 404, "RIDE_NOT_FOUND");
      }
      const existing = await RideInternalNote.findOne({
        rideId,
        adminId: req.admin._id,
        idempotencyKey: key,
      }).session(session);
      if (existing) {
        idempotent = true;
        note = existing;
        return;
      }
      const admin = await mongoose
        .model("Admin")
        .findById(req.admin._id)
        .select("name fullName firstName lastName email")
        .session(session);
      const adminName =
        admin?.fullName ||
        [admin?.firstName, admin?.lastName].filter(Boolean).join(" ").trim() ||
        admin?.name ||
        admin?.email ||
        "";
      [note] = await RideInternalNote.create(
        [
          {
            rideId,
            adminId: req.admin._id,
            adminName,
            text,
            idempotencyKey: key,
          },
        ],
        { session }
      );
      await RideAudit.create(
        [
          {
            rideId,
            action: "ride_internal_note_added",
            fromStatus: ride.status,
            toStatus: ride.status,
            actorId: req.admin._id,
            actorRole: "admin",
            reasonCode: "",
            metadata: { noteId: String(note._id) },
            idempotencyKey: key,
          },
        ],
        { session }
      );
    });
    emitAdminRideUpdate(
      { _id: rideId },
      "ride:internal_note_added",
      { noteId: note ? String(note._id) : null, idempotent }
    );
    return res.status(idempotent ? 200 : 201).json({
      success: true,
      note: note
        ? {
            id: String(note._id),
            adminId: String(note.adminId),
            adminName: note.adminName,
            text: note.text,
            createdAt: note.createdAt,
          }
        : null,
      idempotent,
    });
  } catch (error) {
    return fail(res, error);
  }
};

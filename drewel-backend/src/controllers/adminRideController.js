import mongoose from "mongoose";
import Ride, {
  ACTIVE_RIDE_STATUSES,
  TERMINAL_RIDE_STATUSES,
} from "../models/Ride.js";
import RideAudit from "../models/RideAudit.js";
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

    const [rides, total] = await Promise.all([
      Ride.find(filter)
        .populate("passengerId", "fullName")
        .populate("driverId", "firstName lastName fullName vehicleType")
        .sort({ updatedAt: -1, _id: -1 })
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
    const [auditTrail, points] = await Promise.all([
      RideAudit.find({ rideId }).sort({ occurredAt: -1, _id: -1 }).limit(250),
      PointTransaction.find({ rideId }).sort({ createdAt: -1, _id: -1 }),
    ]);
    return res.json({
      success: true,
      ride: {
        ...rideDto(ride),
        auditTrail,
        pointsTransaction: points,
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
    const result = await runPointsTransaction(async (session) => {
      const ride = await Ride.findById(rideId).session(session);
      if (!ride) {
        throw new RideTransitionError("Ride not found", 404, "RIDE_NOT_FOUND");
      }
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

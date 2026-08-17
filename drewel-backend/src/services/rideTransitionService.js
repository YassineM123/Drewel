import crypto from "node:crypto";
import mongoose from "mongoose";
import Ride, {
  ACTIVE_RIDE_STATUSES,
  TERMINAL_RIDE_STATUSES,
} from "../models/Ride.js";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import RideAudit from "../models/RideAudit.js";
import { distanceKmBetween } from "../utils/availableDrivers.js";

const TRANSITIONS = Object.freeze({
  accepted: ["driver_on_the_way", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"],
  confirmed: ["driver_on_the_way", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"],
  driver_arriving: ["driver_arrived", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"],
  driver_on_the_way: ["driver_arrived", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"],
  driver_arrived: ["pickup_confirmed", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"],
  pickup_confirmed: ["in_progress", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"],
  in_progress: ["completed", "disputed"],
  disputed: ["completed", "cancelled_by_admin"],
});

const ROLE_ACTIONS = Object.freeze({
  driver_on_the_way: ["driver"],
  driver_arrived: ["driver"],
  pickup_confirmed: ["driver"],
  in_progress: ["driver"],
  completed: ["driver", "admin"],
  cancelled_by_user: ["passenger", "admin"],
  cancelled_by_driver: ["driver", "admin"],
  cancelled_by_admin: ["admin"],
  disputed: ["passenger", "driver", "admin"],
});

export class RideTransitionError extends Error {
  constructor(message, statusCode = 409, code = "RIDE_TRANSITION_INVALID") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const boundedInt = (name, fallback, min, max) => {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

const geofenceMeters = (kind) =>
  boundedInt(
    kind === "pickup" ? "PICKUP_GEOFENCE_METERS" : "DESTINATION_GEOFENCE_METERS",
    kind === "pickup" ? 150 : 200,
    20,
    5000
  );

const validPoint = (point) =>
  Number.isFinite(point?.lat) &&
  point.lat >= -90 &&
  point.lat <= 90 &&
  Number.isFinite(point?.long) &&
  point.long >= -180 &&
  point.long <= 180;

const assertParticipant = (ride, principal) => {
  if (principal.role === "admin") return;
  const participant =
    (principal.role === "driver" && String(ride.driverId) === String(principal.id)) ||
    (principal.role === "passenger" && String(ride.passengerId) === String(principal.id));
  if (!participant) {
    throw new RideTransitionError("You are not a participant of this ride", 403, "NOT_RIDE_PARTICIPANT");
  }
};

const assertProximity = (ride, target, location, principal, overrideReason) => {
  if (principal.role === "admin" && String(overrideReason || "").trim().length >= 8) return true;
  if (!validPoint(location) || !validPoint(ride[target])) {
    throw new RideTransitionError("A valid current location is required", 400, "LOCATION_REQUIRED");
  }
  const meters =
    distanceKmBetween(location.lat, location.long, ride[target].lat, ride[target].long) * 1000;
  if (meters > geofenceMeters(target)) {
    throw new RideTransitionError(
      `Ride action is outside the ${target} geofence`,
      409,
      target === "pickup" ? "OUTSIDE_PICKUP_GEOFENCE" : "OUTSIDE_DESTINATION_GEOFENCE"
    );
  }
  return false;
};

export const createPickupPin = () => {
  const pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  const iv = crypto.randomBytes(12);
  const key = crypto
    .createHash("sha256")
    .update(String(process.env.PICKUP_PIN_ENCRYPTION_KEY || process.env.JWT_SECRET || ""))
    .digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  const encrypted = [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
  return { pin, salt, hash, encrypted };
};

export const decryptPickupPin = (encrypted) => {
  try {
    const [ivValue, tagValue, ciphertextValue] = String(encrypted || "").split(".");
    const key = crypto
      .createHash("sha256")
      .update(String(process.env.PICKUP_PIN_ENCRYPTION_KEY || process.env.JWT_SECRET || ""))
      .digest();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivValue, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
};

const pinMatches = (pin, salt, expectedHash) => {
  if (!/^\d{4}$/.test(String(pin || "")) || !salt || !expectedHash) return false;
  const actual = crypto.scryptSync(String(pin), salt, 32);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

export const verifyPickupPin = async ({ rideId, driverId, pin }) => {
  const maxAttempts = boundedInt("PICKUP_PIN_MAX_ATTEMPTS", 5, 2, 20);
  const lockMs = boundedInt(
    "PICKUP_PIN_RATE_WINDOW_MS",
    300000,
    10000,
    3600000
  );
  const ride = await Ride.findById(rideId).select(
    "+pickupPinHash +pickupPinSalt +pickupPinAttempts +pickupPinLockedUntil"
  );
  if (!ride) throw new RideTransitionError("Ride not found", 404, "RIDE_NOT_FOUND");
  if (String(ride.driverId) !== String(driverId)) {
    throw new RideTransitionError("Only the assigned driver may verify pickup", 403, "NOT_ASSIGNED_DRIVER");
  }
  if (ride.status === "pickup_confirmed" || ride.status === "in_progress") return { verified: true };
  if (ride.status !== "driver_arrived") {
    throw new RideTransitionError("Pickup PIN is not available in this state", 409, "INVALID_RIDE_TRANSITION");
  }
  if (ride.pickupPinLockedUntil && ride.pickupPinLockedUntil > new Date()) {
    throw new RideTransitionError("Pickup PIN verification is temporarily locked", 429, "PICKUP_PIN_LOCKED");
  }
  if (!pinMatches(pin, ride.pickupPinSalt, ride.pickupPinHash)) {
    const attempted = await Ride.findOneAndUpdate(
      { _id: ride._id, status: "driver_arrived" },
      { $inc: { pickupPinAttempts: 1 } },
      { new: true }
    ).select("+pickupPinAttempts");
    if (attempted && attempted.pickupPinAttempts >= maxAttempts) {
      await Ride.updateOne(
        {
          _id: ride._id,
          status: "driver_arrived",
          pickupPinAttempts: { $gte: maxAttempts },
        },
        {
          $set: {
            pickupPinAttempts: 0,
            pickupPinLockedUntil: new Date(Date.now() + lockMs),
          },
        }
      );
    }
    throw new RideTransitionError("Pickup PIN is incorrect", 422, "PICKUP_PIN_INVALID");
  }
  await Ride.updateOne(
    { _id: ride._id },
    { $set: { pickupPinAttempts: 0, pickupPinLockedUntil: null } }
  );
  return { verified: true };
};

const terminalCleanup = async (ride, now, session) => {
  const currentDriver = await Driver.findById(ride.driverId).select("isOnline").session(session);
  await Promise.all([
    Driver.updateOne(
      { _id: ride.driverId, activeRideId: ride._id },
      {
        $set: {
          activeRideId: null,
          activeRideStartedAt: null,
          availabilityStatus: currentDriver?.isOnline ? "Online" : "Offline",
        },
      },
      { session }
    ),
    User.updateOne(
      { _id: ride.passengerId, activeRideId: ride._id },
      { $set: { activeRideId: null, activeRideStartedAt: null } },
      { session }
    ),
  ]);
};

export const transitionRideState = async ({
  rideId,
  principal,
  nextStatus,
  idempotencyKey,
  location = null,
  reason = "",
  note = "",
  overrideReason = "",
  pickupPinVerified = false,
  metadata = {},
}) => {
  if (!mongoose.isValidObjectId(rideId)) {
    throw new RideTransitionError("Invalid ride id", 400, "INVALID_RIDE_ID");
  }
  const key = String(idempotencyKey || "").trim();
  if (key.length < 8 || key.length > 200) {
    throw new RideTransitionError("A valid Idempotency-Key header is required", 400, "IDEMPOTENCY_KEY_REQUIRED");
  }

  let result;
  await mongoose.connection.transaction(async (session) => {
    const existingAudit = await RideAudit.findOne({
      rideId,
      actorId: principal.id,
      action: `ride_${nextStatus}`,
      idempotencyKey: key,
    }).session(session);
    if (existingAudit) {
      result = await Ride.findById(rideId).session(session);
      return;
    }

    const ride = await Ride.findById(rideId).session(session);
    if (!ride) throw new RideTransitionError("Ride not found", 404, "RIDE_NOT_FOUND");
    assertParticipant(ride, principal);
    if (!(ROLE_ACTIONS[nextStatus] || []).includes(principal.role)) {
      throw new RideTransitionError("Actor cannot perform this ride action", 403, "RIDE_ACTION_FORBIDDEN");
    }
    const transitionAllowed = (TRANSITIONS[ride.status] || []).includes(nextStatus);
    const adminOpensDispute =
      principal.role === "admin" &&
      nextStatus === "disputed" &&
      ACTIVE_RIDE_STATUSES.includes(ride.status);
    if (!transitionAllowed && !adminOpensDispute) {
      throw new RideTransitionError(
        `Cannot transition ride from ${ride.status} to ${nextStatus}`,
        409,
        "INVALID_RIDE_TRANSITION"
      );
    }
    if (nextStatus === "driver_arrived") {
      assertProximity(ride, "pickup", location, principal, overrideReason);
    }
    if (nextStatus === "completed") {
      assertProximity(ride, "destination", location, principal, overrideReason);
    }
    if (nextStatus === "pickup_confirmed" && !pickupPinVerified) {
      throw new RideTransitionError("Pickup PIN verification is required", 409, "PICKUP_PIN_REQUIRED");
    }

    const now = new Date();
    const set = { status: nextStatus };
    if (nextStatus === "driver_on_the_way") set.driverOnTheWayAt = now;
    if (nextStatus === "driver_arrived") set.driverArrivedAt = now;
    if (nextStatus === "pickup_confirmed") set.pickupConfirmedAt = now;
    if (nextStatus === "in_progress") set.startedAt = now;
    if (TERMINAL_RIDE_STATUSES.includes(nextStatus)) {
      set.endedAt = now;
      set.contactEndsAt =
        nextStatus === "completed"
          ? new Date(now.getTime() + boundedInt("RIDE_CONTACT_GRACE_PERIOD_MINUTES", 30, 0, 1440) * 60000)
          : now;
    }
    if (nextStatus.startsWith("cancelled_")) {
      const normalizedReason = String(reason || "").trim();
      if (normalizedReason.length < 3 || normalizedReason.length > 120) {
        throw new RideTransitionError("Cancellation reason is required", 400, "CANCELLATION_REASON_REQUIRED");
      }
      set.cancellation = {
        cancelledBy: principal.id,
        actorRole: principal.role,
        reason: normalizedReason,
        note: String(note || "").trim().slice(0, 1000),
        stateBeforeCancellation: ride.status,
        location: validPoint(location) ? location : { lat: null, long: null },
        timestamp: now,
        pointsDecision: "captured_no_refund",
        adminReviewStatus: principal.role === "admin" || overrideReason ? "pending" : "not_required",
      };
    }

    result = await Ride.findOneAndUpdate(
      { _id: ride._id, status: ride.status, stateVersion: ride.stateVersion },
      { $set: set, $inc: { stateVersion: 1 } },
      { new: true, session, runValidators: true }
    );
    if (!result) {
      throw new RideTransitionError("Ride state changed concurrently", 409, "RIDE_STATE_CONFLICT");
    }
    await RideAudit.create(
      [
        {
          rideId: ride._id,
          action: `ride_${nextStatus}`,
          fromStatus: ride.status,
          toStatus: nextStatus,
          actorId: principal.id,
          actorRole: principal.role,
          reasonCode: nextStatus.startsWith("cancelled_") ? String(reason).trim() : "",
          metadata: {
            ...(overrideReason ? { overrideReason: String(overrideReason).trim().slice(0, 500) } : {}),
            ...(validPoint(location) ? { location } : {}),
            ...metadata,
          },
          idempotencyKey: key,
        },
      ],
      { session }
    );
    if (TERMINAL_RIDE_STATUSES.includes(nextStatus)) {
      await terminalCleanup(result, now, session);
    }
  });
  return result;
};

export const isActiveRideStatus = (status) => ACTIVE_RIDE_STATUSES.includes(status);

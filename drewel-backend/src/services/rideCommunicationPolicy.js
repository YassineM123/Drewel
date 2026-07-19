import mongoose from "mongoose";
import Ride from "../models/Ride.js";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import Admin from "../models/Admin.js";
import CommunicationAudit from "../models/CommunicationAudit.js";

export const CONTACT_RIDE_STATUSES = ["accepted", "driver_arriving", "driver_arrived", "in_progress"];

export class CommunicationPolicyError extends Error {
  constructor(message, statusCode = 403, code = "COMMUNICATION_FORBIDDEN") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const resolvePrincipal = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new CommunicationPolicyError("Invalid authenticated principal", 401, "INVALID_PRINCIPAL");
  }
  const [user, driver, admin] = await Promise.all([
    User.findById(userId).select("_id isRestricted").lean(),
    Driver.findById(userId).select("_id isRestricted isDeleted status isApproved").lean(),
    Admin.findById(userId).select("_id role").lean(),
  ]);
  if (admin?.role === "admin") return { id: admin._id, role: "admin", subject: admin };
  if (driver) {
    if (driver.isRestricted || driver.isDeleted) throw new CommunicationPolicyError("Account unavailable", 403, "ACCOUNT_UNAVAILABLE");
    return { id: driver._id, role: "driver", subject: driver };
  }
  if (user) {
    if (user.isRestricted) throw new CommunicationPolicyError("Account unavailable", 403, "ACCOUNT_UNAVAILABLE");
    return { id: user._id, role: "passenger", subject: user };
  }
  throw new CommunicationPolicyError("Authenticated account not found", 401, "PRINCIPAL_NOT_FOUND");
};

export const isRideContactAllowed = (ride, now = new Date()) => {
  if (ride.communicationBlockedAt) return false;
  if (CONTACT_RIDE_STATUSES.includes(ride.status)) return true;
  return ride.status === "completed" && ride.contactEndsAt && new Date(ride.contactEndsAt) > now;
};

export const assertRideParticipant = async (principal, rideOrId, { requireContact = false } = {}) => {
  if (!(typeof rideOrId === "object" && rideOrId?._id) && !mongoose.isValidObjectId(rideOrId)) {
    throw new CommunicationPolicyError("Invalid ride id", 400, "INVALID_RIDE_ID");
  }
  const ride = typeof rideOrId === "object" && rideOrId?._id
    ? rideOrId
    : await Ride.findById(rideOrId);
  if (!ride) throw new CommunicationPolicyError("Ride not found", 404, "RIDE_NOT_FOUND");

  const isPassenger = principal.role === "passenger" && String(ride.passengerId) === String(principal.id);
  const isDriver = principal.role === "driver" && String(ride.driverId) === String(principal.id);
  if (!isPassenger && !isDriver) {
    await CommunicationAudit.create({
      rideId: ride._id,
      action: "communication_denied",
      actorId: principal.id,
      actorRole: principal.role,
      outcome: "denied",
      reasonCode: "NOT_RIDE_PARTICIPANT",
    }).catch((error) => console.error("Communication denial audit failed", error.message));
    throw new CommunicationPolicyError("You are not a participant of this ride", 403, "NOT_RIDE_PARTICIPANT");
  }
  if (requireContact && !isRideContactAllowed(ride)) {
    if (ride.communicationBlockedAt) {
      await CommunicationAudit.create({
        rideId: ride._id, action: "communication_denied", actorId: principal.id,
        actorRole: principal.role, outcome: "denied", reasonCode: "RIDE_COMMUNICATION_BLOCKED",
      }).catch((error) => console.error("Communication denial audit failed", error.message));
      throw new CommunicationPolicyError("Ride communication is blocked", 403, "RIDE_COMMUNICATION_BLOCKED");
    }
    const expired = ride.status === "completed" || ride.status === "cancelled";
    const reasonCode = expired ? "RIDE_CONTACT_EXPIRED" : "RIDE_CONTACT_NOT_ACTIVE";
    await CommunicationAudit.create({
      rideId: ride._id, action: "communication_denied", actorId: principal.id,
      actorRole: principal.role, outcome: "denied", reasonCode,
    }).catch((error) => console.error("Communication denial audit failed", error.message));
    throw new CommunicationPolicyError(
      expired ? "Ride contact period has expired" : "Ride does not allow contact yet",
      expired ? 410 : 409,
      reasonCode
    );
  }
  return { ride, participantRole: isPassenger ? "passenger" : "driver" };
};

export const counterpartFor = (ride, participantRole) => participantRole === "passenger"
  ? { id: ride.driverId, role: "driver" }
  : { id: ride.passengerId, role: "passenger" };

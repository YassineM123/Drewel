import crypto from "node:crypto";
import mongoose from "mongoose";
import Ride from "../models/Ride.js";
import Driver from "../models/Driver.js";
import RideMessage from "../models/RideMessage.js";
import CommunicationAudit from "../models/CommunicationAudit.js";
import { io } from "../socket/index.js";
import {
  CommunicationPolicyError,
  assertRideParticipant,
  isRideContactAllowed,
  resolvePrincipal,
} from "../services/rideCommunicationPolicy.js";
import { endActiveCallsForRide, toCallDto } from "../services/callSessionService.js";
import CallSession from "../models/CallSession.js";
import User from "../models/User.js";
import RideSafetyAction from "../models/RideSafetyAction.js";
import { counterpartFor } from "../services/rideCommunicationPolicy.js";

const ACTIVE_RIDE_STATUSES = ["accepted", "driver_arriving", "driver_arrived", "in_progress"];
const DRIVER_TRANSITIONS = {
  requested: ["accepted", "cancelled"],
  accepted: ["driver_arriving", "cancelled"],
  driver_arriving: ["driver_arrived", "cancelled"],
  driver_arrived: ["in_progress", "cancelled"],
  in_progress: ["completed"],
};

const rideDto = (ride) => ({
  id: String(ride._id),
  reference: ride.reference,
  passengerId: String(ride.passengerId),
  driverId: String(ride.driverId),
  status: ride.status,
  requestedAt: ride.requestedAt,
  acceptedAt: ride.acceptedAt,
  startedAt: ride.startedAt,
  endedAt: ride.endedAt,
  contactEndsAt: ride.contactEndsAt,
  contactExpiresAt: ride.contactEndsAt,
  blocked: Boolean(ride.communicationBlockedAt),
  contactAllowed: isRideContactAllowed(ride),
  createdAt: ride.createdAt,
  updatedAt: ride.updatedAt,
});

const publicParticipantDto = (participant, role) => {
  if (!participant) return null;
  const fullName = participant.fullName || [participant.firstName, participant.lastName].filter(Boolean).join(" ").trim();
  return {
    id: String(participant._id),
    firstName: participant.firstName || fullName.split(/\s+/)[0] || "",
    fullName,
    profileImageUrl: role === "driver" ? participant.profileImageUrl || "" : participant.profilePicture || "",
    role,
    ...(role === "driver" ? { vehicleDescription: participant.vehicleType || "" } : {}),
  };
};

const publicRideDto = async (ride) => {
  const [passenger, driver] = await Promise.all([
    User.findById(ride.passengerId).select("fullName profilePicture").lean(),
    Driver.findById(ride.driverId).select("firstName lastName fullName profileImageUrl vehicleType").lean(),
  ]);
  return { ...rideDto(ride), passenger: publicParticipantDto(passenger, "passenger"), driver: publicParticipantDto(driver, "driver") };
};

const sendError = (res, error) => res.status(error.statusCode || 500).json({
  success: false,
  code: error.code || "INTERNAL_ERROR",
  message: error.statusCode ? error.message : "Internal server error",
});

export const createRideRequest = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (principal.role !== "passenger") throw new CommunicationPolicyError("Only passengers can request a ride", 403, "PASSENGER_REQUIRED");
    const { driverId } = req.body || {};
    if (!mongoose.isValidObjectId(driverId)) throw new CommunicationPolicyError("Valid driverId is required", 400, "INVALID_DRIVER_ID");
    const driver = await Driver.findOne({
      _id: driverId, isOnline: true, isApproved: true, isRestricted: false, isDeleted: { $ne: true },
      $or: [{ status: "completed" }, { status: null, profileRequestStatus: null }],
    }).select("_id");
    if (!driver) throw new CommunicationPolicyError("Driver is not available", 409, "DRIVER_NOT_AVAILABLE");
    const existing = await Ride.findOne({ passengerId: principal.id, driverId, status: { $in: ["requested", ...ACTIVE_RIDE_STATUSES] } });
    if (existing) return res.status(200).json({ success: true, ride: await publicRideDto(existing), idempotent: true });
    const ride = await Ride.create({
      passengerId: principal.id,
      driverId,
      reference: `DRW-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    });
    await CommunicationAudit.create({ rideId: ride._id, action: "ride_requested", actorId: principal.id, actorRole: "passenger", outcome: "success" });
    io.to(String(driverId)).emit("ride:requested", { rideId: String(ride._id), status: ride.status });
    return res.status(201).json({ success: true, ride: await publicRideDto(ride) });
  } catch (error) {
    console.error("Create ride request failed", error.message);
    return sendError(res, error);
  }
};

export const getRide = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { ride } = await assertRideParticipant(principal, req.params.rideId);
    return res.json({ success: true, ride: await publicRideDto(ride) });
  } catch (error) { return sendError(res, error); }
};

export const getActiveRide = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const filter = {
      $or: [
        { status: { $in: ACTIVE_RIDE_STATUSES } },
        { status: "completed", contactEndsAt: { $gt: new Date() }, communicationBlockedAt: null },
      ],
    };
    if (principal.role === "passenger") {
      filter.passengerId = principal.id;
      if (req.query.driverId) {
        if (!mongoose.isValidObjectId(req.query.driverId)) throw new CommunicationPolicyError("Invalid driverId", 400, "INVALID_DRIVER_ID");
        filter.driverId = req.query.driverId;
      }
    } else if (principal.role === "driver") {
      filter.driverId = principal.id;
    } else {
      throw new CommunicationPolicyError("Ride participant required", 403, "RIDE_PARTICIPANT_REQUIRED");
    }
    const ride = await Ride.findOne(filter).sort({ updatedAt: -1 });
    return res.json({ success: true, ride: ride ? await publicRideDto(ride) : null });
  } catch (error) { return sendError(res, error); }
};

export const listMyRides = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (!["passenger", "driver"].includes(principal.role)) {
      throw new CommunicationPolicyError("Ride participant required", 403, "RIDE_PARTICIPANT_REQUIRED");
    }
    const status = String(req.query.status || "active").trim().toLowerCase();
    if (!["requested", "active", "all"].includes(status)) {
      throw new CommunicationPolicyError("status must be requested, active, or all", 400, "INVALID_RIDE_FILTER");
    }
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || "20", 10) || 20));
    const filter = principal.role === "passenger"
      ? { passengerId: principal.id }
      : { driverId: principal.id };
    if (status === "requested") filter.status = "requested";
    if (status === "active") filter.status = { $in: ACTIVE_RIDE_STATUSES };

    const [rides, total] = await Promise.all([
      Ride.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
      Ride.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      rides: await Promise.all(rides.map(publicRideDto)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) { return sendError(res, error); }
};

export const transitionRide = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (principal.role !== "driver") throw new CommunicationPolicyError("Only the assigned driver can transition a ride", 403, "DRIVER_REQUIRED");
    if (!mongoose.isValidObjectId(req.params.rideId)) throw new CommunicationPolicyError("Invalid ride id", 400, "INVALID_RIDE_ID");
    const ride = await Ride.findById(req.params.rideId);
    if (!ride) throw new CommunicationPolicyError("Ride not found", 404, "RIDE_NOT_FOUND");
    if (String(ride.driverId) !== String(principal.id)) throw new CommunicationPolicyError("You are not assigned to this ride", 403, "NOT_ASSIGNED_DRIVER");
    const nextStatus = String(req.body?.status || "").trim();
    if (!(DRIVER_TRANSITIONS[ride.status] || []).includes(nextStatus)) {
      throw new CommunicationPolicyError(`Cannot transition ride from ${ride.status} to ${nextStatus}`, 409, "INVALID_RIDE_TRANSITION");
    }
    const now = new Date();
    const set = { status: nextStatus };
    if (nextStatus === "accepted") set.acceptedAt = now;
    if (nextStatus === "in_progress") set.startedAt = now;
    if (["completed", "cancelled"].includes(nextStatus)) {
      const grace = Math.min(1440, Math.max(0, Number.parseInt(process.env.RIDE_CONTACT_GRACE_PERIOD_MINUTES || "30", 10) || 0));
      set.endedAt = now;
      set.contactEndsAt = nextStatus === "completed" ? new Date(now.getTime() + grace * 60000) : now;
    }
    const updated = await Ride.findOneAndUpdate(
      { _id: ride._id, status: ride.status }, { $set: set }, { new: true }
    );
    if (!updated) throw new CommunicationPolicyError("Ride state changed concurrently", 409, "RIDE_STATE_CONFLICT");
    if (["completed", "cancelled"].includes(nextStatus)) await endActiveCallsForRide(updated._id, `ride_${nextStatus}`);
    await CommunicationAudit.create({ rideId: updated._id, action: `ride_${nextStatus}`, actorId: principal.id, actorRole: "driver", outcome: "success" });
    io.to(String(updated.passengerId)).to(String(updated.driverId)).emit("ride:state", { rideId: String(updated._id), status: updated.status });
    return res.json({ success: true, ride: await publicRideDto(updated) });
  } catch (error) {
    if (error?.code === 11000) return sendError(res, new CommunicationPolicyError("Passenger or driver already has an active ride", 409, "ACTIVE_RIDE_CONFLICT"));
    return sendError(res, error);
  }
};

export const listRideCalls = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { ride } = await assertRideParticipant(principal, req.params.rideId);
    const calls = await CallSession.find({ rideId: ride._id }).sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, calls: calls.map(toCallDto) });
  } catch (error) { return sendError(res, error); }
};

export const listRideMessages = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { ride } = await assertRideParticipant(principal, req.params.rideId);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || "50", 10) || 50));
    const filter = { rideId: ride._id };
    if (req.query.before) {
      if (!mongoose.isValidObjectId(req.query.before)) throw new CommunicationPolicyError("Invalid message cursor", 400, "INVALID_MESSAGE_CURSOR");
      filter._id = { $lt: req.query.before };
    }
    const messages = await RideMessage.find(filter).sort({ _id: -1 }).limit(limit).lean();
    return res.json({ success: true, messages: messages.reverse() });
  } catch (error) { return sendError(res, error); }
};

export const sendRideMessage = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { ride, participantRole } = await assertRideParticipant(principal, req.params.rideId, { requireContact: true });
    const text = String(req.body?.text || "").trim();
    const clientMessageId = String(req.body?.clientMessageId || "").trim();
    if (!text || text.length > 2000 || !clientMessageId || clientMessageId.length > 100) {
      throw new CommunicationPolicyError("text and clientMessageId are required", 400, "INVALID_MESSAGE");
    }
    let message;
    let created = true;
    try {
      message = await RideMessage.create({ rideId: ride._id, senderId: principal.id, senderRole: participantRole, text, clientMessageId });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      created = false;
      message = await RideMessage.findOne({ rideId: ride._id, senderId: principal.id, clientMessageId });
    }
    io.to(String(ride.passengerId)).to(String(ride.driverId)).emit("ride:message", { rideId: String(ride._id), messageId: String(message._id), status: message.status });
    return res.status(created ? 201 : 200).json({ success: true, message, idempotent: !created });
  } catch (error) { return sendError(res, error); }
};

export const updateMessageReceipt = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { ride } = await assertRideParticipant(principal, req.params.rideId);
    if (!mongoose.isValidObjectId(req.params.messageId)) throw new CommunicationPolicyError("Invalid message id", 400, "INVALID_MESSAGE_ID");
    const status = String(req.body?.status || "");
    if (!["delivered", "read"].includes(status)) throw new CommunicationPolicyError("Invalid receipt status", 400, "INVALID_RECEIPT_STATUS");
    const message = await RideMessage.findOne({ _id: req.params.messageId, rideId: ride._id, senderId: { $ne: principal.id } });
    if (!message) throw new CommunicationPolicyError("Message not found", 404, "MESSAGE_NOT_FOUND");
    if (status === "delivered" && message.status === "sent") {
      message.status = "delivered"; message.deliveredAt = new Date();
    }
    if (status === "read" && message.status !== "read") {
      message.status = "read"; message.deliveredAt ||= new Date(); message.readAt = new Date();
    }
    await message.save();
    io.to(String(message.senderId)).emit("ride:message:receipt", { messageId: String(message._id), status: message.status, deliveredAt: message.deliveredAt, readAt: message.readAt });
    return res.json({ success: true, message });
  } catch (error) { return sendError(res, error); }
};

export const createSafetyAction = (type) => async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { ride, participantRole } = await assertRideParticipant(principal, req.params.rideId);
    const target = counterpartFor(ride, participantRole);
    const reason = String(req.body?.reason || "").trim();
    if (reason.length > 1000 || (type === "report" && !reason)) {
      throw new CommunicationPolicyError("A valid reason is required", 400, "INVALID_SAFETY_REASON");
    }
    const action = await RideSafetyAction.create({
      rideId: ride._id, actorId: principal.id, actorRole: participantRole,
      targetId: target.id, targetRole: target.role, type, reason,
    });
    if (type === "block") {
      await Ride.updateOne(
        { _id: ride._id, communicationBlockedAt: null },
        { $set: { communicationBlockedAt: new Date(), communicationBlockedBy: principal.id } }
      );
      await endActiveCallsForRide(ride._id, "participant_blocked");
      io.to(String(ride.passengerId)).to(String(ride.driverId)).emit("ride:state", { rideId: String(ride._id), blocked: true, contactAllowed: false });
    }
    if (type === "report") {
      await CallSession.findOneAndUpdate({ rideId: ride._id }, { $set: { reported: true } }, { sort: { createdAt: -1 } });
    }
    await CommunicationAudit.create({ rideId: ride._id, action: `ride_${type}`, actorId: principal.id, actorRole: participantRole, outcome: "success" });
    return res.status(201).json({ success: true, action: { id: String(action._id), rideId: String(action.rideId), type: action.type, reason: action.reason, createdAt: action.createdAt } });
  } catch (error) { return sendError(res, error); }
};

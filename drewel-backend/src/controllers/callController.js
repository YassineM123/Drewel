import mongoose from "mongoose";
import CallSession from "../models/CallSession.js";
import CommunicationAudit from "../models/CommunicationAudit.js";
import { io } from "../socket/index.js";
import { resolvePrincipal } from "../services/rideCommunicationPolicy.js";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import { CALL_STATUSES } from "../models/CallSession.js";
import { getAuthorizedCall, initiateCall, issueCallToken, toCallDto, transitionCall } from "../services/callSessionService.js";

const sendError = (res, error) => res.status(error.statusCode || 500).json({ success: false, code: error.code || "INTERNAL_ERROR", message: error.statusCode ? error.message : "Internal server error" });
const emitCall = (call) => io.to(String(call.callerId)).to(String(call.receiverId)).emit("call:state", {
  callId: String(call._id), rideId: String(call.rideId), status: call.status, stateVersion: call.stateVersion,
});

export const initiate = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (!mongoose.isValidObjectId(req.body?.rideId)) return res.status(400).json({ success: false, code: "INVALID_RIDE_ID", message: "Valid rideId is required" });
    const result = await initiateCall({ principal, rideId: req.body.rideId, idempotencyKey: req.get("Idempotency-Key") });
    emitCall(result.call);
    return res.status(result.created ? 201 : 200).json({ success: true, call: toCallDto(result.call), idempotent: !result.created });
  } catch (error) { console.error("Call initiation failed", error.message); return sendError(res, error); }
};

export const getCall = async (req, res) => {
  try { const principal = await resolvePrincipal(req.user?._id); const call = await getAuthorizedCall(principal, req.params.callId); return res.json({ success: true, call: toCallDto(call) }); }
  catch (error) { return sendError(res, error); }
};

export const actOnCall = (action) => async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const call = await transitionCall({ principal, callId: req.params.callId, action, reason: req.body?.reason });
    emitCall(call);
    return res.json({ success: true, call: toCallDto(call) });
  } catch (error) { return sendError(res, error); }
};

export const token = async (req, res) => {
  try { const principal = await resolvePrincipal(req.user?._id); const credentials = await issueCallToken(principal, req.params.callId); return res.json({ success: true, credentials }); }
  catch (error) { return sendError(res, error); }
};

export const listMyCalls = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (!["passenger", "driver"].includes(principal.role)) {
      return res.status(403).json({ success: false, code: "PARTICIPANT_REQUIRED", message: "Ride participant required" });
    }
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || "20", 10) || 20));
    const filter = { $or: [{ callerId: principal.id }, { receiverId: principal.id }] };
    if (req.query.rideId) {
      if (!mongoose.isValidObjectId(req.query.rideId)) {
        return res.status(400).json({ success: false, code: "INVALID_RIDE_ID", message: "Invalid rideId" });
      }
      filter.rideId = req.query.rideId;
    }
    const [calls, total] = await Promise.all([
      CallSession.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CallSession.countDocuments(filter),
    ]);
    const otherIds = calls.map((call) =>
      String(call.callerId) === String(principal.id)
        ? [call.receiverId, call.receiverRole]
        : [call.callerId, call.callerRole]
    );
    const passengerIds = otherIds.filter(([, role]) => role === "passenger").map(([id]) => id);
    const driverIds = otherIds.filter(([, role]) => role === "driver").map(([id]) => id);
    const rideIds = calls.map((call) => call.rideId);
    const [users, drivers, rides] = await Promise.all([
      User.find({ _id: { $in: passengerIds } }).select("fullName profilePicture").lean(),
      Driver.find({ _id: { $in: driverIds } }).select("firstName lastName fullName profileImageUrl vehicleType vehicleModel registration").lean(),
      mongoose.model("Ride").find({ _id: { $in: rideIds } }).select("reference status").lean(),
    ]);
    const names = new Map([
      ...users.map((subject) => [String(subject._id), { displayName: subject.fullName || "Passenger", role: "passenger", profileImageUrl: subject.profilePicture || "" }]),
      ...drivers.map((subject) => [String(subject._id), {
        displayName: subject.fullName || [subject.firstName, subject.lastName].filter(Boolean).join(" ").trim() || "Driver",
        role: "driver",
        profileImageUrl: subject.profileImageUrl || "",
        vehicle: [subject.vehicleType, subject.vehicleModel].filter(Boolean).join(" "),
        plate: subject.registration || "",
      }]),
    ]);
    const rideMap = new Map(rides.map((ride) => [String(ride._id), ride]));
    return res.json({
      success: true,
      calls: calls.map((call) => {
        const counterpartId = String(call.callerId) === String(principal.id) ? call.receiverId : call.callerId;
        const counterpart = names.get(String(counterpartId)) || { displayName: "Ride participant", role: "unknown" };
        const ride = rideMap.get(String(call.rideId));
        return {
          ...toCallDto(call),
          direction: String(call.callerId) === String(principal.id) ? "outgoing" : "incoming",
          counterpart,
          rideReference: ride?.reference || "",
          rideStatus: ride?.status || "",
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const listAdminCalls = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || "25", 10) || 25));
    const filter = {};
    if (req.query.status) {
      const status = String(req.query.status);
      if (!CALL_STATUSES.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });
      filter.status = status;
    }
    if (req.query.reported !== undefined) {
      if (!["true", "false"].includes(String(req.query.reported))) return res.status(400).json({ success: false, message: "Invalid reported filter" });
      filter.reported = String(req.query.reported) === "true";
    }
    if (req.query.rideId) {
      if (!mongoose.isValidObjectId(req.query.rideId)) return res.status(400).json({ success: false, message: "Invalid rideId" });
      filter.rideId = req.query.rideId;
    }
    if (req.query.search) {
      if (!mongoose.isValidObjectId(req.query.search)) return res.status(400).json({ success: false, message: "Search must be an exact Call ID or Ride ID" });
      filter.$or = [{ _id: req.query.search }, { rideId: req.query.search }];
    }
    const [calls, total] = await Promise.all([
      CallSession.find(filter).select("rideId callerId receiverId callerRole receiverRole status startedAt connectedAt endedAt durationSeconds endReason reported createdAt").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CallSession.countDocuments(filter),
    ]);
    const userIds = calls.flatMap((call) => [[call.callerId, call.callerRole], [call.receiverId, call.receiverRole]]).filter(([, role]) => role === "passenger").map(([id]) => id);
    const driverIds = calls.flatMap((call) => [[call.callerId, call.callerRole], [call.receiverId, call.receiverRole]]).filter(([, role]) => role === "driver").map(([id]) => id);
    const [users, drivers] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select("fullName").lean(),
      Driver.find({ _id: { $in: driverIds } }).select("firstName lastName fullName").lean(),
    ]);
    const names = new Map([...users, ...drivers].map((subject) => [String(subject._id), subject.fullName || [subject.firstName, subject.lastName].filter(Boolean).join(" ").trim() || "Unknown"]));
    if (calls.length) await CommunicationAudit.insertMany(calls.map((call) => ({ rideId: call.rideId, callId: call._id, action: "admin_call_viewed", actorId: req.user._id, actorRole: "admin", outcome: "success" })));
    const totalPages = Math.ceil(total / limit);
    return res.json({ success: true, calls: calls.map((call) => ({ callId: String(call._id), rideId: String(call.rideId), caller: { displayName: names.get(String(call.callerId)) || "Unknown", role: call.callerRole }, receiver: { displayName: names.get(String(call.receiverId)) || "Unknown", role: call.receiverRole }, status: call.status, startedAt: call.startedAt, connectedAt: call.connectedAt, endedAt: call.endedAt, durationSeconds: call.durationSeconds, endReason: call.endReason, reported: call.reported, createdAt: call.createdAt })), pagination: { page, limit, total, totalPages } });
  } catch (error) { console.error("Admin call list failed", error.message); return res.status(500).json({ success: false, message: "Failed to fetch calls" }); }
};

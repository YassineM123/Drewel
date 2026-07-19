import CallSession, { ACTIVE_CALL_STATUSES } from "../models/CallSession.js";
import mongoose from "mongoose";
import CommunicationAudit from "../models/CommunicationAudit.js";
import { assertRideParticipant, counterpartFor } from "./rideCommunicationPolicy.js";
import { buildAgoraToken, generateAgoraChannelName, generateAgoraUid } from "./agoraTokenService.js";

export class CallStateError extends Error {
  constructor(message, statusCode = 409, code = "INVALID_CALL_STATE") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const audit = (values) => CommunicationAudit.create(values).catch((error) => {
  console.error("Communication audit write failed", error.message);
});

export const toCallDto = (call) => ({
  id: String(call._id),
  rideId: String(call.rideId),
  callerId: String(call.callerId),
  receiverId: String(call.receiverId),
  callerRole: call.callerRole,
  receiverRole: call.receiverRole,
  provider: call.provider,
  status: call.status,
  stateVersion: call.stateVersion,
  startedAt: call.startedAt,
  ringingAt: call.ringingAt,
  answeredAt: call.answeredAt,
  connectedAt: call.connectedAt,
  endedAt: call.endedAt,
  durationSeconds: call.durationSeconds,
  endReason: call.endReason,
  reported: call.reported,
  createdAt: call.createdAt,
  updatedAt: call.updatedAt,
});

export const initiateCall = async ({ principal, rideId, idempotencyKey = "" }) => {
  const { ride, participantRole } = await assertRideParticipant(principal, rideId, { requireContact: true });
  const counterpart = counterpartFor(ride, participantRole);
  const key = String(idempotencyKey || "").trim().slice(0, 100);
  if (key) {
    const existing = await CallSession.findOne({ rideId: ride._id, callerId: principal.id, idempotencyKey: key });
    if (existing) return { call: existing, created: false };
  }
  const now = new Date();
  const timeout = Math.min(60, Math.max(15, Number.parseInt(process.env.CALL_RING_TIMEOUT_SECONDS || "30", 10) || 30));
  try {
    let call = await CallSession.create({
      rideId: ride._id,
      callerId: principal.id,
      receiverId: counterpart.id,
      callerRole: participantRole,
      receiverRole: counterpart.role,
      channelName: generateAgoraChannelName(),
      callerAgoraUid: generateAgoraUid(),
      receiverAgoraUid: generateAgoraUid(),
      status: "initiating",
      idempotencyKey: key,
      startedAt: now,
    });
    call = await CallSession.findOneAndUpdate(
      { _id: call._id, status: "initiating" },
      { $set: { status: "ringing", ringingAt: now, ringingDeadline: new Date(now.getTime() + timeout * 1000) }, $inc: { stateVersion: 1 } },
      { new: true }
    );
    await audit({ rideId: ride._id, callId: call._id, action: "call_initiated", actorId: principal.id, actorRole: participantRole, outcome: "success" });
    return { call, created: true };
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await CallSession.findOne({ rideId: ride._id, status: { $in: ACTIVE_CALL_STATUSES } }).select("+idempotencyKey");
      if (existing && key && existing.idempotencyKey === key && String(existing.callerId) === String(principal.id)) {
        return { call: existing, created: false };
      }
      throw new CallStateError("A call is already active for this ride", 409, "CALL_ALREADY_ACTIVE");
    }
    throw error;
  }
};

export const getAuthorizedCall = async (principal, callId, options = {}) => {
  if (!mongoose.isValidObjectId(callId)) {
    throw new CallStateError("Invalid call id", 400, "INVALID_CALL_ID");
  }
  const call = await CallSession.findById(callId).select("+channelName +callerAgoraUid +receiverAgoraUid +idempotencyKey");
  if (!call) throw new CallStateError("Call not found", 404, "CALL_NOT_FOUND");
  await assertRideParticipant(principal, call.rideId, options);
  if (![String(call.callerId), String(call.receiverId)].includes(String(principal.id))) {
    throw new CallStateError("You are not a call participant", 403, "NOT_CALL_PARTICIPANT");
  }
  return call;
};

const transitionRules = {
  accept: { from: ["ringing"], to: "accepted", actor: "receiver" },
  connected: { from: ["accepted"], to: "connected", actor: "either" },
  decline: { from: ["ringing"], to: "declined", actor: "receiver" },
  cancel: { from: ["initiating", "ringing"], to: "cancelled", actor: "caller" },
  end: { from: ["accepted", "connected"], to: "ended", actor: "either" },
};

export const transitionCall = async ({ principal, callId, action, reason = "" }) => {
  const rule = transitionRules[action];
  if (!rule) throw new CallStateError("Unsupported call action", 400, "UNSUPPORTED_CALL_ACTION");
  const current = await getAuthorizedCall(principal, callId, { requireContact: action === "accept" || action === "connected" });
  const isCaller = String(current.callerId) === String(principal.id);
  if ((rule.actor === "caller" && !isCaller) || (rule.actor === "receiver" && isCaller)) {
    throw new CallStateError("This participant cannot perform the call action", 403, "CALL_ACTION_FORBIDDEN");
  }
  if (!rule.from.includes(current.status)) {
    if (current.status === rule.to) return current;
    throw new CallStateError(`Cannot ${action} a call in ${current.status} state`);
  }
  const now = new Date();
  const set = { status: rule.to };
  if (action === "accept") set.answeredAt = now;
  if (action === "connected") set.connectedAt = now;
  if (["decline", "cancel", "end"].includes(action)) {
    set.endedAt = now;
    set.endedBy = principal.id;
    set.endReason = String(reason || action).trim().slice(0, 200);
    if (current.connectedAt) set.durationSeconds = Math.max(0, Math.floor((now - current.connectedAt) / 1000));
  }
  const updated = await CallSession.findOneAndUpdate(
    { _id: current._id, status: { $in: rule.from } },
    { $set: set, $inc: { stateVersion: 1 } },
    { new: true }
  );
  if (!updated) throw new CallStateError("Call state changed concurrently", 409, "CALL_STATE_CONFLICT");
  await audit({ rideId: updated.rideId, callId: updated._id, action: `call_${action}`, actorId: principal.id, actorRole: principal.role, outcome: "success" });
  return updated;
};

export const issueCallToken = async (principal, callId) => {
  const call = await getAuthorizedCall(principal, callId, { requireContact: true });
  if (!["accepted", "connected"].includes(call.status)) {
    throw new CallStateError("Call token is not available in this state", 409, "CALL_TOKEN_NOT_AVAILABLE");
  }
  const isCaller = String(call.callerId) === String(principal.id);
  return buildAgoraToken({ channelName: call.channelName, uid: isCaller ? call.callerAgoraUid : call.receiverAgoraUid });
};

export const expireMissedCalls = async (now = new Date()) => {
  const candidates = await CallSession.find({ status: "ringing", ringingDeadline: { $lte: now } }).select("_id rideId").lean();
  const expired = [];
  for (const candidate of candidates) {
    const updated = await CallSession.findOneAndUpdate(
      { _id: candidate._id, status: "ringing", ringingDeadline: { $lte: now } },
      { $set: { status: "missed", endedAt: now, endReason: "no_answer" }, $inc: { stateVersion: 1 } },
      { new: true }
    );
    if (updated) {
      expired.push(updated);
      await audit({ rideId: updated.rideId, callId: updated._id, action: "call_missed", actorRole: "system", outcome: "success", reasonCode: "NO_ANSWER" });
    }
  }
  return expired;
};

export const endActiveCallsForRide = async (rideId, reason = "ride_ended") => {
  const now = new Date();
  const calls = await CallSession.find({ rideId, status: { $in: ACTIVE_CALL_STATUSES } }).select("_id connectedAt");
  for (const call of calls) {
    await CallSession.updateOne(
      { _id: call._id, status: { $in: ACTIVE_CALL_STATUSES } },
      { $set: { status: "ended", endedAt: now, endReason: reason, durationSeconds: call.connectedAt ? Math.max(0, Math.floor((now - call.connectedAt) / 1000)) : 0 }, $inc: { stateVersion: 1 } }
    );
    await audit({ rideId, callId: call._id, action: "call_auto_ended", actorRole: "system", outcome: "success", reasonCode: reason.toUpperCase() });
  }
  return calls.length;
};

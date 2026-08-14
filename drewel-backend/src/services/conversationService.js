import mongoose from "mongoose";
import RideConversation from "../models/RideConversation.js";
import RideMessage from "../models/RideMessage.js";
import Notification from "../models/Notification.js";
import CommunicationAudit from "../models/CommunicationAudit.js";
import Ride from "../models/Ride.js";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import { assertRideParticipant } from "./rideCommunicationPolicy.js";

export class ConversationError extends Error {
  constructor(message, statusCode = 404, code = "CONVERSATION_NOT_FOUND") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const conversationStatusForRide = (ride) => {
  const status = String(ride.status || "");
  if (status === "completed") return "completed";
  if (status === "cancelled" || status.startsWith("cancelled_")) return "cancelled";
  return "active";
};

const audit = (values) => CommunicationAudit.create(values).catch((error) => {
  console.error("Conversation audit write failed", error.message);
});

const participantDisplayName = (participant) => {
  const fullName = String(
    participant?.fullName ||
      [participant?.firstName, participant?.lastName].filter(Boolean).join(" ").trim() ||
      ""
  );
  return { fullName, firstName: fullName.split(/\s+/)[0] || "" };
};

/**
 * Derives the counterpart view for a requesting principal. Only the snapshot
 * fields are exposed — never phone numbers, tokens or contact identifiers.
 */
export const toConversationDto = (conversation, principal) => {
  const isPassenger =
    principal.role === "passenger" &&
    String(conversation.passengerId) === String(principal.id);
  const isDriver =
    principal.role === "driver" && String(conversation.driverId) === String(principal.id);
  const role = isPassenger ? "driver" : isDriver ? "passenger" : null;
  const name = role === "driver" ? conversation.driverName : conversation.passengerName;
  const image = role === "driver" ? conversation.driverImage : conversation.passengerImage;
  return {
    id: String(conversation._id),
    rideId: String(conversation.rideId),
    rideReference: conversation.rideReference,
    status: conversation.status,
    counterpart: {
      id: String(role === "driver" ? conversation.driverId : conversation.passengerId),
      role,
      firstName: String(name || "").split(/\s+/)[0] || "",
      fullName: String(name || ""),
      profileImageUrl: String(image || ""),
      vehicleType: role === "driver" ? String(conversation.driverVehicleType || "") : undefined,
      vehicleModel: role === "driver" ? String(conversation.driverVehicleModel || "") : undefined,
      registration:
        role === "driver" && conversation.driverRegistrationVisible
          ? String(conversation.driverRegistration || "")
          : undefined,
      rating:
        role === "driver" && conversation.driverRating != null
          ? conversation.driverRating
          : undefined,
    },
    lastMessage: conversation.lastMessageAt
      ? {
          preview: String(conversation.lastMessagePreview || ""),
          senderRole: conversation.lastMessageSenderRole,
          status: conversation.lastMessageStatus,
          at: conversation.lastMessageAt,
        }
      : null,
    myUnreadCount: isPassenger
      ? conversation.passengerUnreadCount
      : isDriver
        ? conversation.driverUnreadCount
        : 0,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

const buildConversationUpdate = async (ride) => {
  const [passenger, driver] = await Promise.all([
    User.findById(ride.passengerId).select("fullName profilePicture").lean(),
    Driver.findById(ride.driverId)
      .select(
        "firstName lastName fullName profileImageUrl vehicleType vehicleModel registration registrationVisible rating"
      )
      .lean(),
  ]);
  const passengerName = participantDisplayName(passenger).fullName;
  const driverName = participantDisplayName(driver).fullName;
  return {
    rideId: ride._id,
    rideReference: String(ride.reference || ""),
    passengerId: ride.passengerId,
    driverId: ride.driverId,
    passengerName,
    passengerImage: String(passenger?.profilePicture || ""),
    driverName,
    driverImage: String(driver?.profileImageUrl || ""),
    driverVehicleType: String(driver?.vehicleType || ""),
    driverVehicleModel: String(driver?.vehicleModel || ""),
    driverRegistration: String(driver?.registration || ""),
    driverRegistrationVisible: Boolean(driver?.registrationVisible),
    driverRating: driver?.rating ?? null,
    status: conversationStatusForRide(ride),
  };
};

/**
 * Materializes (or refreshes) the ride-linked conversation. It is idempotent
 * and safe to call on every ride creation and transition.
 */
export const ensureConversationForRide = async (ride) => {
  const update = await buildConversationUpdate(ride);
  return RideConversation.findOneAndUpdate(
    { rideId: ride._id },
    { $set: update },
    { new: true, upsert: true, runValidators: true }
  );
};

export const syncConversationForRideId = async (rideId) => {
  if (!mongoose.isValidObjectId(rideId)) return null;
  const ride = await Ride.findById(rideId).select("+status");
  if (!ride) return null;
  return ensureConversationForRide(ride);
};

export const getConversationForPrincipal = async ({ principal, rideId }) => {
  if (!mongoose.isValidObjectId(rideId)) {
    throw new ConversationError("Invalid ride id", 400, "INVALID_RIDE_ID");
  }
  const { ride } = await assertRideParticipant(principal, rideId);
  // Refresh the privacy-safe participant snapshot as accounts/vehicles can
  // change after the conversation was first created. This also repairs legacy
  // rows with blank names instead of leaving the client with a generic title.
  const conversation = await ensureConversationForRide(ride);
  return toConversationDto(conversation, principal);
};

export const markConversationRead = async ({ principal, rideId }) => {
  if (!mongoose.isValidObjectId(rideId)) {
    throw new ConversationError("Invalid ride id", 400, "INVALID_RIDE_ID");
  }
  const { ride } = await assertRideParticipant(principal, rideId);
  const unreadField =
    principal.role === "passenger" ? "passengerUnreadCount" : "driverUnreadCount";
  const previous = await RideConversation.findOne({ rideId: ride._id });
  if (!previous) {
    const created = await ensureConversationForRide(ride);
    return toConversationDto(created, principal);
  }
  const updated = await RideConversation.findOneAndUpdate(
    { rideId: ride._id, [unreadField]: { $gt: 0 } },
    { $set: { [unreadField]: 0 } },
    { new: true }
  );
  if (!updated) return toConversationDto(previous, principal);
  await audit({
    rideId: ride._id,
    action: "conversation_marked_read",
    actorId: principal.id,
    actorRole: principal.role,
    outcome: "success",
  });
  return toConversationDto(updated, principal);
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listConversations = async ({
  principal,
  status,
  unread = false,
  query = "",
  page = 1,
  limit = 20,
}) => {
  if (!["passenger", "driver"].includes(principal.role)) {
    throw new ConversationError("Ride participant required", 403, "RIDE_PARTICIPANT_REQUIRED");
  }
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
  const participantField =
    principal.role === "passenger" ? "passengerId" : "driverId";
  const unreadField =
    principal.role === "passenger" ? "passengerUnreadCount" : "driverUnreadCount";

  const filter = { [participantField]: principal.id };
  if (status === "active") filter.status = "active";
  else if (status === "completed") filter.status = "completed";
  else if (status === "cancelled") filter.status = "cancelled";
  else {
    // Default "all": active conversations always show; completed/cancelled
    // conversations only when they contain actual history.
    filter.$or = [{ status: "active" }, { lastMessageAt: { $ne: null } }];
  }
  if (unread) filter[unreadField] = { $gt: 0 };
  if (String(query).trim()) {
    const pattern = new RegExp(escapeRegex(String(query).trim()), "i");
    const searchClause = { $or: [{ lastMessagePreview: pattern }, { rideReference: pattern }] };
    if (filter.$or) filter.$or = [...filter.$or, searchClause];
    else filter.$or = [searchClause];
  }

  const [conversations, total, unreadTotal] = await Promise.all([
    RideConversation.find(filter)
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    RideConversation.countDocuments(filter),
    RideConversation.countDocuments({
      [participantField]: principal.id,
      [unreadField]: { $gt: 0 },
    }),
  ]);

  const latest = await RideConversation.findOne({
    [participantField]: principal.id,
    lastMessageAt: { $ne: null },
  }).sort({ lastMessageAt: -1 });

  return {
    conversations: conversations.map((conversation) =>
      toConversationDto(conversation, principal)
    ),
    unreadTotal,
    lastMessageAt: latest?.lastMessageAt ?? null,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

export const getUnreadSummary = async ({ principal }) => {
  if (!["passenger", "driver"].includes(principal.role)) {
    throw new ConversationError("Ride participant required", 403, "RIDE_PARTICIPANT_REQUIRED");
  }
  const participantField =
    principal.role === "passenger" ? "passengerId" : "driverId";
  const unreadField =
    principal.role === "passenger" ? "passengerUnreadCount" : "driverUnreadCount";
  const [unreadTotal, latest] = await Promise.all([
    RideConversation.countDocuments({
      [participantField]: principal.id,
      [unreadField]: { $gt: 0 },
    }),
    RideConversation.findOne({
      [participantField]: principal.id,
      lastMessageAt: { $ne: null },
    }).sort({ lastMessageAt: -1 }),
  ]);
  return { unreadTotal, lastMessageAt: latest?.lastMessageAt ?? null };
};

/**
 * Updates the conversation when a ride message is sent: bumps the counterpart's
 * unread counter, refreshes the preview and persists the ride message
 * notification for the recipient.
 */
export const touchConversationWithMessage = async ({ ride, message, participantRole }) => {
  let conversation = await RideConversation.findOne({ rideId: ride._id });
  const updates = {
    rideId: ride._id,
    rideReference: String(ride.reference || ""),
    passengerId: ride.passengerId,
    driverId: ride.driverId,
    lastMessageAt: message.createdAt,
    lastMessagePreview: String(message.text || "").slice(0, 140),
    lastMessageSenderRole: participantRole,
    lastMessageStatus: message.status,
    status: conversationStatusForRide(ride),
  };
  const unreadField =
    participantRole === "passenger" ? "driverUnreadCount" : "passengerUnreadCount";
  conversation = await RideConversation.findOneAndUpdate(
    { rideId: ride._id },
    { $set: updates, $inc: { [unreadField]: 1 } },
    { new: true, upsert: true, runValidators: true }
  );
  if (!conversation.rideReference) {
    const rideSnapshot = await Ride.findById(ride._id).select("reference").lean();
    if (rideSnapshot?.reference) {
      conversation = await RideConversation.findOneAndUpdate(
        { rideId: ride._id },
        { $set: { rideReference: rideSnapshot.reference } },
        { new: true }
      );
    }
  }

  const recipientId =
    participantRole === "passenger" ? conversation.driverId : conversation.passengerId;
  const recipientType = participantRole === "passenger" ? "driver" : "user";
  const senderName =
    participantRole === "passenger" ? conversation.passengerName : conversation.driverName;
  const senderDisplayName = String(senderName || "").split(/\s+/)[0] || "Your ride participant";
  const eventKey = `ride-message:${ride._id}:${message._id}:${recipientId}`;
  const notification = await Notification.findOneAndUpdate(
    { eventKey },
    {
      $setOnInsert: {
        userId: recipientId,
        recipientType,
        type: "RIDE_MESSAGE",
        title: senderDisplayName,
        message: `${senderDisplayName}: ${String(message.text || "").slice(0, 120)}`,
        eventKey,
        rideId: ride._id,
        conversationId: conversation._id,
        messageId: String(message._id),
        deepLink: `drewel://chat/ride?conversationId=${String(conversation._id)}`,
        data: {
          rideId: String(ride._id),
          rideReference: conversation.rideReference,
          messageId: String(message._id),
          conversationId: String(conversation._id),
          senderRole: participantRole,
          senderName: senderDisplayName,
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).catch((error) => {
    if (error?.code !== 11000) {
      console.error("Ride message notification failed", error.message);
    }
    return null;
  });

  return { conversation, recipientId, recipientRole: recipientType, notification };
};

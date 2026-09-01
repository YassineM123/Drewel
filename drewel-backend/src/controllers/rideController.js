import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import Ride, { ACTIVE_RIDE_STATUSES } from "../models/Ride.js";
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
import {
  ensureConversationForRide,
  markConversationRead,
  syncConversationForRideId,
  touchConversationWithMessage,
} from "../services/conversationService.js";
import RideConversation from "../models/RideConversation.js";
import User from "../models/User.js";
import RideSafetyAction from "../models/RideSafetyAction.js";
import RideAudit from "../models/RideAudit.js";
import { counterpartFor } from "../services/rideCommunicationPolicy.js";
import { buildFreshDubaiMarketplaceAvailabilityFilter } from "../utils/availableDrivers.js";
import {
  RideTransitionError,
  decryptPickupPin,
  transitionRideState,
  verifyPickupPin,
} from "../services/rideTransitionService.js";
import { computeRideRoute } from "../services/googleRoutesService.js";
import { updateActiveRideLocation } from "../services/rideLocationService.js";
import { emitNotificationNew, sendPushToUser } from "../services/notificationService.js";
import {
  notifyDriverOfNewRideRequest,
  notifyRideTransition,
} from "../services/rideNotificationService.js";
import { chargeRideCommissionInSession, runPointsTransaction } from "../services/pointsWalletService.js";
import { calculateRideCommission } from "../services/commissionService.js";
import PointsSettings from "../models/PointsSettings.js";
import {
  CHAT_AUDIO_MAX_DURATION_SECONDS,
  chatAudioRootPath,
  removeChatAudioUpload,
} from "../utils/chatAudioUpload.js";
import { deleteS3Object, getS3Bucket, getS3Client, isS3StorageEnabled } from "../utils/s3Storage.js";

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
  stateVersion: ride.stateVersion || 0,
  driverOnTheWayAt: ride.driverOnTheWayAt,
  driverArrivedAt: ride.driverArrivedAt,
  pickupConfirmedAt: ride.pickupConfirmedAt,
  lastDriverLocation: ride.lastDriverLocation,
  cancellation: ride.cancellation,
  reviews: {
    passenger: ride.reviews?.passenger
      ? {
          rating: ride.reviews.passenger.rating,
          comment: ride.reviews.passenger.comment || "",
          submittedAt: ride.reviews.passenger.submittedAt,
        }
      : null,
    driver: ride.reviews?.driver
      ? {
          rating: ride.reviews.driver.rating,
          comment: ride.reviews.driver.comment || "",
          submittedAt: ride.reviews.driver.submittedAt,
        }
      : null,
  },
  ...(ride.status !== "contacting"
    ? {
        pickup: ride.pickup,
        destination: ride.destination,
        vehicleType: ride.vehicleType || "",
        agreedPrice: ride.agreedPrice ?? null,
        confirmedAt: ride.confirmedAt,
      }
    : {}),
  ...(ride.commission?.ridePriceAED != null
    ? { commission: ride.commission }
    : {}),
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
    ...(role === "driver"
      ? {
          vehicleDescription: participant.vehicleType || "",
          vehicleModel: participant.vehicleModel || "",
          registration: participant.registrationVisible ? participant.registration || "" : "",
          rating: participant.rating ?? null,
        }
      : {}),
  };
};

export const emitConversationUpdated = async (conversation) => {
  if (!conversation) return;
  const [passengerTotal, driverTotal] = await Promise.all([
    RideConversation.countDocuments({
      passengerId: conversation.passengerId,
      passengerUnreadCount: { $gt: 0 },
    }),
    RideConversation.countDocuments({
      driverId: conversation.driverId,
      driverUnreadCount: { $gt: 0 },
    }),
  ]);
  const base = {
    conversationId: String(conversation._id),
    rideId: String(conversation.rideId),
    status: conversation.status,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageSenderRole: conversation.lastMessageSenderRole,
  };
  io.to(String(conversation.passengerId)).emit("conversation:updated", {
    ...base,
    unreadCount: conversation.passengerUnreadCount,
    unreadTotal: passengerTotal,
  });
  io.to(String(conversation.driverId)).emit("conversation:updated", {
    ...base,
    unreadCount: conversation.driverUnreadCount,
    unreadTotal: driverTotal,
  });
};

export { emitNotificationNew }; // re-exported for existing call sites

const publicRideDto = async (ride) => {
  const [passenger, driver] = await Promise.all([
    User.findById(ride.passengerId).select("fullName profilePicture").lean(),
    Driver.findById(ride.driverId).select("firstName lastName fullName profileImageUrl vehicleType vehicleModel registration registrationVisible rating").lean(),
  ]);
  return { ...rideDto(ride), passenger: publicParticipantDto(passenger, "passenger"), driver: publicParticipantDto(driver, "driver") };
};

const participantRideDto = async (ride, principal) => {
  const dto = await publicRideDto(ride);
  // Exact route data is visible only to the two participants of their own
  // requested contact, never through marketplace/list DTOs.
  if (ride.status === "contacting" && principal?.role !== "admin") {
    dto.pickup = ride.pickup;
    dto.destination = ride.destination;
  }
  if (principal?.role === "passenger" && String(ride.passengerId) === String(principal.id)) {
    const secret = await Ride.findById(ride._id).select("+pickupPinEncrypted").lean();
    const pickupPin = decryptPickupPin(secret?.pickupPinEncrypted);
    if (pickupPin && !["completed", "cancelled", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"].includes(ride.status)) {
      dto.pickupPin = pickupPin;
    }
  }
  return dto;
};

const sendError = (res, error) => res.status(error.statusCode || 500).json({
  success: false,
  code: error.code || "INTERNAL_ERROR",
  message: error.statusCode ? error.message : "Internal server error",
});

// ---------------------------------------------------------------------------
// Voice messages
// ---------------------------------------------------------------------------

/**
 * Client-facing serialization for ride messages. Voice rows never expose the
 * raw storage key — playback always goes through the participant-gated audio
 * endpoint on this API.
 */
const toRideMessageDto = (message) => {
  const plain = typeof message?.toObject === "function" ? message.toObject() : { ...message };
  // Storage internals stay server-side; playback goes through the gated
  // audio endpoint below.
  delete plain.audioKey;
  delete plain.audioStorage;
  if (plain?.messageType === "voice" && plain?._id && plain?.rideId) {
    plain.audioUrl = `/api/rides/${String(plain.rideId)}/messages/${String(plain._id)}/audio`;
  }
  return plain;
};

const rideMessageEventPayload = (message) => ({
  rideId: String(message.rideId),
  messageId: String(message._id),
  senderId: String(message.senderId),
  senderRole: message.senderRole,
  text: message.text,
  messageType: message.messageType,
  metadata: message.metadata,
  status: message.status,
  clientMessageId: message.clientMessageId,
  createdAt: message.createdAt,
  ...(message.messageType === "voice"
    ? {
        audioUrl: `/api/rides/${String(message.rideId)}/messages/${String(message._id)}/audio`,
        audioDuration: message.audioDuration,
        audioMimeType: message.audioMimeType,
        audioSize: message.audioSize,
      }
    : {}),
});

const normalizeReviewInput = (body = {}) => {
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new CommunicationPolicyError("Rating must be a whole number from 1 to 5", 400, "INVALID_RATING");
  }
  const comment = String(body.comment || "").trim().replace(/\s+/g, " ");
  if (comment.length > 500) {
    throw new CommunicationPolicyError("Review comment must be 500 characters or less", 400, "REVIEW_COMMENT_TOO_LONG");
  }
  return { rating, comment };
};

const recalculateDriverRating = async (driverId) => {
  const [summary] = await Ride.aggregate([
    {
      $match: {
        driverId: new mongoose.Types.ObjectId(String(driverId)),
        "reviews.passenger.rating": { $gte: 1, $lte: 5 },
      },
    },
    {
      $group: {
        _id: "$driverId",
        averageRating: { $avg: "$reviews.passenger.rating" },
      },
    },
  ]);
  await Driver.updateOne(
    { _id: driverId },
    { $set: { rating: summary ? Math.round(summary.averageRating * 10) / 10 : null } }
  );
};

const hasMissionPointInput = (value) =>
  value && (value.lat !== undefined || value.long !== undefined || value.address !== undefined);

const CONTACT_COOLDOWN_SECONDS = 45;

export const createDriverContact = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (principal.role !== "passenger") throw new CommunicationPolicyError("Only passengers can contact a driver", 403, "PASSENGER_REQUIRED");
    const passengerAvailable = await User.exists({
      _id: principal.id,
      activeRideId: null,
      isRestricted: false,
    });
    if (!passengerAvailable) {
      throw new CommunicationPolicyError(
        "Passenger already has an active ride",
        409,
        "ACTIVE_RIDE_CONFLICT"
      );
    }
    const { driverId } = req.body || {};
    if (!mongoose.isValidObjectId(driverId)) throw new CommunicationPolicyError("Valid driverId is required", 400, "INVALID_DRIVER_ID");
    const driver = await Driver.findOne({
      _id: driverId,
      ...buildFreshDubaiMarketplaceAvailabilityFilter(),
    }).select("_id");
    if (!driver) throw new CommunicationPolicyError("Driver is not available", 409, "DRIVER_NOT_AVAILABLE");
    const now = new Date();
    const blockingContact = await Ride.findOne({
      passengerId: principal.id,
      driverId: { $ne: driverId },
      status: "contacting",
      contactEndsAt: { $gt: now },
    }).select("_id driverId contactEndsAt");
    if (blockingContact) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((blockingContact.contactEndsAt.getTime() - now.getTime()) / 1000)
      );
      return res.status(429).json({
        success: false,
        code: "DRIVER_REQUEST_COOLDOWN",
        message: "Waiting for driver's response. Please try another driver after the countdown.",
        retryAfterSeconds,
        activeDriverId: String(blockingContact.driverId),
        rideId: String(blockingContact._id),
      });
    }
    const pickup = hasMissionPointInput(req.body?.pickup)
      ? parseMissionPoint(req.body.pickup, "pickup")
      : null;
    const destination = hasMissionPointInput(req.body?.destination)
      ? parseMissionPoint(req.body.destination, "destination")
      : null;
    const existing = await Ride.findOne({
      passengerId: principal.id,
      driverId,
      status: { $in: ["contacting", ...ACTIVE_RIDE_STATUSES] },
    });
    if (existing) {
      const routeRequested = pickup && destination;
      const existingHasRoute = [existing.pickup?.lat, existing.pickup?.long, existing.destination?.lat, existing.destination?.long]
        .every(Number.isFinite);
      const sameRoute = !routeRequested || !existingHasRoute || (
        Number(existing.pickup?.lat) === pickup.lat &&
        Number(existing.pickup?.long) === pickup.long &&
        Number(existing.destination?.lat) === destination.lat &&
        Number(existing.destination?.long) === destination.long
      );
      if (routeRequested && existingHasRoute && !sameRoute) {
        throw new CommunicationPolicyError(
          "This driver already has an open request with a different route",
          409,
          "CONTACT_ROUTE_CONFLICT"
        );
      }
      if (routeRequested && !existingHasRoute) {
        existing.pickup = pickup;
        existing.destination = destination;
        await existing.save();
      }
      return res.status(200).json({ success: true, ride: await publicRideDto(existing), idempotent: true });
    }
    const ridePayload = {
      passengerId: principal.id,
      driverId,
      status: "contacting",
      contactEndsAt: new Date(now.getTime() + CONTACT_COOLDOWN_SECONDS * 1000),
      reference: `DRW-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    };
    if (pickup && destination) {
      ridePayload.pickup = pickup;
      ridePayload.destination = destination;
    }
    const ride = await Ride.create(ridePayload);
    await CommunicationAudit.create({ rideId: ride._id, action: "driver_contact_created", actorId: principal.id, actorRole: "passenger", outcome: "success" });
    io.to(String(driverId)).emit("driver:contact", { rideId: String(ride._id), status: ride.status });
    const conversation = await ensureConversationForRide(ride);
    await emitConversationUpdated(conversation);
    // High-priority realtime + push + in-app "New ride request" for the driver.
    await notifyDriverOfNewRideRequest({ ride, passenger: principal.subject });
    // Opening a secure chat is not a booking. Re-assert the driver's current
    // marketplace projection only when they still satisfy the same fresh-GPS
    // availability predicate used by Find Now. A later accepted offer is the
    // only path that publishes Busy/unavailable.
    const stillAvailable = await Driver.findOne({
      _id: driverId,
      ...buildFreshDubaiMarketplaceAvailabilityFilter(),
    }).select("_id isOnline availabilityStatus updatedAt").lean();
    if (stillAvailable) {
      io.emit("driver:availability", {
        driverId: String(stillAvailable._id),
        status: "Online",
        isAvailable: true,
        updatedAt: stillAvailable.updatedAt,
      });
    }
    return res.status(201).json({ success: true, ride: await publicRideDto(ride) });
  } catch (error) {
    if (error?.code === 11000) {
      const principal = await resolvePrincipal(req.user?._id);
      const existing = await Ride.findOne({
        passengerId: principal.id,
        driverId: req.body?.driverId,
        status: "contacting",
      });
      if (existing) {
        return res.status(200).json({
          success: true,
          ride: await publicRideDto(existing),
          idempotent: true,
        });
      }
    }
    console.error("Create driver contact failed", error.message);
    return sendError(res, error);
  }
};

const parseMissionPoint = (value, field) => {
  const lat = Number(value?.lat);
  const long = Number(value?.long);
  const address = String(value?.address || "").trim();
  if (
    !Number.isFinite(lat) || lat < -90 || lat > 90 ||
    !Number.isFinite(long) || long < -180 || long > 180 ||
    address.length > 300
  ) {
    throw new CommunicationPolicyError(
      `${field} must contain valid lat and long`,
      400,
      "INVALID_MISSION_LOCATION"
    );
  }
  return { lat, long, address };
};

const parseTripRequestMetadata = (body = {}) => {
  const pickup = parseMissionPoint(body.pickup, "pickup");
  const destination = parseMissionPoint(body.destination, "destination");
  const proposedPrice =
    body.proposedPrice === undefined || body.proposedPrice === null || body.proposedPrice === ""
      ? null
      : Number(body.proposedPrice);
  if (proposedPrice !== null && (!Number.isFinite(proposedPrice) || proposedPrice < 0 || proposedPrice > 1_000_000_000)) {
    throw new CommunicationPolicyError("proposedPrice is invalid", 400, "INVALID_TRIP_REQUEST");
  }
  const currency = String(body.currency || "AED").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new CommunicationPolicyError("currency is invalid", 400, "INVALID_TRIP_REQUEST");
  }
  const note = String(body.note || "").trim().slice(0, 500);
  return { pickup, destination, proposedPrice, currency, note };
};

const cancelSupersededTripRequests = async ({ rideId, latestMessage, now = new Date() }) => {
  if (!latestMessage) return;
  await RideMessage.updateMany(
    {
      rideId,
      _id: { $ne: latestMessage._id },
      messageType: "trip_request",
      "metadata.tripRequestStatus": { $ne: "cancelled" },
    },
    [
      {
        $set: {
          metadata: {
            $mergeObjects: [
              { $ifNull: ["$metadata", {}] },
              {
                tripRequestStatus: "cancelled",
                cancellationReason: "superseded",
                cancelledAt: now,
                supersededByMessageId: String(latestMessage._id),
                supersededByClientMessageId: latestMessage.clientMessageId,
              },
            ],
          },
        },
      },
    ]
  );
};

export const confirmMission = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (!["passenger", "driver"].includes(principal.role)) {
      throw new CommunicationPolicyError("Ride participant required", 403, "RIDE_PARTICIPANT_REQUIRED");
    }
    if (!mongoose.isValidObjectId(req.params.rideId)) {
      throw new CommunicationPolicyError("Invalid ride id", 400, "INVALID_RIDE_ID");
    }
    const pickup = parseMissionPoint(req.body?.pickup, "pickup");
    const destination = parseMissionPoint(req.body?.destination, "destination");
    const vehicleType = String(req.body?.vehicleType || "").trim();
    if (vehicleType.length > 120) {
      throw new CommunicationPolicyError("Invalid vehicle type", 400, "INVALID_VEHICLE_TYPE");
    }
    const agreedPrice = req.body?.price === undefined || req.body?.price === null
      ? null
      : Number(req.body.price);
    if (agreedPrice !== null && (!Number.isFinite(agreedPrice) || agreedPrice < 0 || agreedPrice > 1_000_000)) {
      throw new CommunicationPolicyError("Invalid mission price", 400, "INVALID_MISSION_PRICE");
    }

    let confirmedRide;
    let missionCreated = false;
    const cancelledContacts = [];
    await mongoose.connection.transaction(async (session) => {
      const contact = await Ride.findById(req.params.rideId).session(session);
      if (!contact) throw new CommunicationPolicyError("Contact not found", 404, "RIDE_NOT_FOUND");
      const isPassenger = principal.role === "passenger" && String(contact.passengerId) === String(principal.id);
      const isDriver = principal.role === "driver" && String(contact.driverId) === String(principal.id);
      if (!isPassenger && !isDriver) {
        throw new CommunicationPolicyError("You are not a participant of this contact", 403, "NOT_RIDE_PARTICIPANT");
      }
      if (contact.status !== "contacting") {
        if (ACTIVE_RIDE_STATUSES.includes(contact.status)) {
          confirmedRide = contact;
          return;
        }
        throw new CommunicationPolicyError("Contact cannot be confirmed", 409, "INVALID_RIDE_TRANSITION");
      }
      throw new CommunicationPolicyError(
        "A contacting ride can only be confirmed by accepting its active Trip Offer",
        409,
        "TRIP_OFFER_REQUIRED"
      );

      const driver = await Driver.findOneAndUpdate(
        {
          _id: contact.driverId,
          ...buildFreshDubaiMarketplaceAvailabilityFilter(),
        },
        { $set: { availabilityStatus: "Busy" } },
        { new: true, session }
      );
      if (!driver) {
        throw new CommunicationPolicyError("Driver is no longer available", 409, "DRIVER_NOT_AVAILABLE");
      }
      const now = new Date();
      confirmedRide = await Ride.findOneAndUpdate(
        { _id: contact._id, status: "contacting" },
        {
          $set: {
            status: "accepted",
            acceptedAt: now,
            confirmedAt: now,
            confirmedBy: principal.id,
            pickup,
            destination,
            vehicleType: vehicleType || driver.vehicleType || "",
            agreedPrice,
          },
        },
        { new: true, session, runValidators: true }
      );
      if (!confirmedRide) {
        throw new CommunicationPolicyError("Contact state changed concurrently", 409, "RIDE_STATE_CONFLICT");
      }
      missionCreated = true;
      const otherContacts = await Ride.find({
        _id: { $ne: contact._id },
        status: "contacting",
        $or: [
          { passengerId: contact.passengerId },
          { driverId: contact.driverId },
        ],
      }).select("_id passengerId driverId").session(session).lean();
      if (otherContacts.length) {
        await Ride.updateMany(
          { _id: { $in: otherContacts.map((item) => item._id) }, status: "contacting" },
          { $set: { status: "cancelled", endedAt: now, contactEndsAt: now } },
          { session }
        );
        cancelledContacts.push(...otherContacts);
      }
      await CommunicationAudit.create([{
        rideId: confirmedRide._id,
        action: "mission_confirmed",
        actorId: principal.id,
        actorRole: principal.role,
        outcome: "success",
      }], { session });
    });

    io.to(String(confirmedRide.passengerId)).to(String(confirmedRide.driverId)).emit(
      "ride:state",
      { rideId: String(confirmedRide._id), status: confirmedRide.status }
    );
    io.emit("driver:availability", {
      driverId: String(confirmedRide.driverId),
      status: "Busy",
      isAvailable: false,
    });
    const conversation = await ensureConversationForRide(confirmedRide);
    await emitConversationUpdated(conversation);
    await notifyRideTransition({
      ride: confirmedRide,
      toStatus: confirmedRide.status,
      actorRole: principal.role,
    });
    for (const contact of cancelledContacts) {
      await endActiveCallsForRide(contact._id, "contact_closed");
      io.to(String(contact.passengerId)).to(String(contact.driverId)).emit(
        "ride:state",
        { rideId: String(contact._id), status: "cancelled" }
      );
      const cancelledConversation = await syncConversationForRideId(contact._id);
      await emitConversationUpdated(cancelledConversation);
    }
    return res.json({
      success: true,
      ride: await publicRideDto(confirmedRide),
      idempotent: !missionCreated,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(res, new CommunicationPolicyError(
        "Passenger or driver already has an active ride",
        409,
        "ACTIVE_RIDE_CONFLICT"
      ));
    }
    return sendError(res, error);
  }
};

export const getRide = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { ride } = await assertRideParticipant(principal, req.params.rideId);
    return res.json({ success: true, ride: await participantRideDto(ride, principal) });
  } catch (error) { return sendError(res, error); }
};

export const getActiveRide = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const filter = { status: { $in: ACTIVE_RIDE_STATUSES } };
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
    return res.json({ success: true, ride: ride ? await participantRideDto(ride, principal) : null });
  } catch (error) { return sendError(res, error); }
};

export const listMyRides = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (!["passenger", "driver"].includes(principal.role)) {
      throw new CommunicationPolicyError("Ride participant required", 403, "RIDE_PARTICIPANT_REQUIRED");
    }
    const status = String(req.query.status || "active").trim().toLowerCase();
    if (!["requested", "contacting", "active", "all"].includes(status)) {
      throw new CommunicationPolicyError("status must be requested, contacting, active, or all", 400, "INVALID_RIDE_FILTER");
    }
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || "20", 10) || 20));
    const filter = principal.role === "passenger"
      ? { passengerId: principal.id }
      : { driverId: principal.id };
    if (status === "requested") filter.status = "requested";
    if (status === "contacting") filter.status = "contacting";
    if (status === "active") filter.status = { $in: ACTIVE_RIDE_STATUSES };
    if (status === "all") filter.status = { $ne: "contacting" };

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
    if (!mongoose.isValidObjectId(req.params.rideId)) {
      throw new CommunicationPolicyError("Invalid ride id", 400, "INVALID_RIDE_ID");
    }
    const existingRide = await Ride.findById(req.params.rideId).select("_id");
    if (!existingRide) {
      throw new CommunicationPolicyError("Ride not found", 404, "RIDE_NOT_FOUND");
    }
    const nextStatus = String(req.body?.status || "").trim();
    let pickupPinVerified = false;
    if (nextStatus === "pickup_confirmed") {
      await verifyPickupPin({
        rideId: req.params.rideId,
        driverId: principal.id,
        pin: req.body?.pickupPin,
      });
      pickupPinVerified = true;
    }
    const updated = await transitionRideState({
      rideId: req.params.rideId,
      principal,
      nextStatus,
      idempotencyKey: req.get("Idempotency-Key") || req.body?.idempotencyKey,
      location: req.body?.location,
      reason: req.body?.reason,
      note: req.body?.note,
      overrideReason: req.body?.overrideReason,
      pickupPinVerified,
    });
    const terminal = ["completed", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"].includes(nextStatus);

    let commissionResult = null;
    if (nextStatus === "completed" && updated.agreedPrice) {
      try {
        const settings = await PointsSettings.getEffective();
        const commission = calculateRideCommission(updated.agreedPrice, settings);
        const chargeIdempotencyKey = `ride-commission:${updated._id}:${req.get("Idempotency-Key") || req.body?.idempotencyKey}`;
        commissionResult = await runPointsTransaction(async (session) => {
          return chargeRideCommissionInSession({
            driverId: updated.driverId,
            rideId: updated._id,
            ridePriceAED: updated.agreedPrice,
            settings,
            idempotencyKey: chargeIdempotencyKey,
            session,
          });
        });
        await Ride.updateOne(
          { _id: updated._id },
          {
            $set: {
              "commission.ridePriceAED": commission.ridePriceAED,
              "commission.commissionRate": commission.commissionRate,
              "commission.commissionAED": commission.commissionAED,
              "commission.pointsPerAED": commission.pointsPerAED,
              "commission.pointsCharged": commission.pointsToDeduct,
              "commission.driverNetAED": commission.driverNetAED,
              "commission.chargedAt": new Date(),
              "commission.transactionId": commissionResult.transaction?._id,
            },
          }
        );
      } catch (commissionError) {
        console.error("[ride] commission charge failed", commissionError.message);
      }
    }

    if (terminal) await endActiveCallsForRide(updated._id, `ride_${nextStatus}`);
    const room = `ride:${updated._id}`;
    const event = nextStatus === "completed"
      ? "ride:completed"
      : nextStatus.startsWith("cancelled_")
        ? "ride:cancelled"
        : "ride:status_changed";
    const payload = { rideId: String(updated._id), status: updated.status, stateVersion: updated.stateVersion };
    io.to(room).to(String(updated.passengerId)).to(String(updated.driverId)).emit(event, payload);
    io.to(String(updated.passengerId)).to(String(updated.driverId)).emit("ride:state", payload);
    const conversation = await ensureConversationForRide(updated);
    await emitConversationUpdated(conversation);
    await notifyRideTransition({
      ride: updated,
      toStatus: updated.status,
      actorRole: principal.role,
    });
    if (terminal) {
      const driver = await Driver.findById(updated.driverId).select("_id isOnline availabilityStatus updatedAt");
      if (driver) {
        io.emit("driver:availability", {
          driverId: String(driver._id),
          status: driver.availabilityStatus,
          isAvailable: driver.isOnline === true,
          updatedAt: driver.updatedAt,
        });
      }
    }
    return res.json({ success: true, ride: await participantRideDto(updated, principal) });
  } catch (error) {
    if (error?.code === 11000) return sendError(res, new CommunicationPolicyError("Passenger or driver already has an active ride", 409, "ACTIVE_RIDE_CONFLICT"));
    return sendError(res, error);
  }
};

export const cancelRide = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const nextStatus =
      principal.role === "passenger"
        ? "cancelled_by_user"
        : principal.role === "driver"
          ? "cancelled_by_driver"
          : "cancelled_by_admin";
    req.body = { ...req.body, status: nextStatus };
    return transitionRide(req, res);
  } catch (error) {
    return sendError(res, error);
  }
};

export const submitRideReview = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (principal.role === "admin") {
      throw new CommunicationPolicyError("Admins cannot submit participant ride reviews", 403, "PARTICIPANT_REQUIRED");
    }
    const { ride, participantRole } = await assertRideParticipant(principal, req.params.rideId);
    if (ride.status !== "completed") {
      throw new CommunicationPolicyError("Ride reviews are available after completion only", 409, "RIDE_NOT_COMPLETED");
    }
    const reviewPath = `reviews.${participantRole}`;
    if (ride.reviews?.[participantRole]?.rating != null) {
      throw new CommunicationPolicyError("You already reviewed this ride", 409, "REVIEW_ALREADY_SUBMITTED");
    }
    const input = normalizeReviewInput(req.body);
    const updated = await Ride.findOneAndUpdate(
      {
        _id: ride._id,
        status: "completed",
        [reviewPath]: null,
      },
      {
        $set: {
          [reviewPath]: {
            rating: input.rating,
            comment: input.comment,
            submittedBy: principal.id,
            submittedAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true }
    );
    if (!updated) {
      throw new CommunicationPolicyError("You already reviewed this ride", 409, "REVIEW_ALREADY_SUBMITTED");
    }
    if (participantRole === "passenger") {
      await recalculateDriverRating(updated.driverId);
    }
    io.to(String(updated.passengerId)).to(String(updated.driverId)).emit("ride:reviewed", {
      rideId: String(updated._id),
      reviewerRole: participantRole,
    });
    return res.json({ success: true, ride: await participantRideDto(updated, principal) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getRideRoute = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { ride } = await assertRideParticipant(principal, req.params.rideId);
    if (!ACTIVE_RIDE_STATUSES.includes(ride.status)) {
      throw new RideTransitionError("Route data is only available for an active ride", 409, "RIDE_NOT_ACTIVE");
    }
    const phase = String(req.query.phase || "").trim();
    if (!["pickup", "destination"].includes(phase)) {
      throw new RideTransitionError("phase must be pickup or destination", 400, "INVALID_ROUTE_PHASE");
    }
    const route = await computeRideRoute({ ride, phase });
    await Ride.updateOne(
      { _id: ride._id, status: { $in: ACTIVE_RIDE_STATUSES } },
      {
        $set: {
          "routeSnapshot.phase": phase,
          "routeSnapshot.distanceMeters": route.distanceMeters,
          "routeSnapshot.durationSeconds": route.durationSeconds,
          "routeSnapshot.encodedPolyline": route.encodedPolyline || "",
          "routeSnapshot.updatedAt": route.calculatedAt || new Date(),
          routeUpdatedAt: route.calculatedAt || new Date(),
        },
      }
    );
    io.to(`ride:${ride._id}`)
      .to(String(ride.passengerId))
      .to(String(ride.driverId))
      .emit("ride:eta_updated", {
        rideId: String(ride._id),
        phase,
        distanceMeters: route.distanceMeters,
        duration: route.duration,
        calculatedAt: route.calculatedAt,
      });
    return res.json({ success: true, route });
  } catch (error) {
    return sendError(res, error);
  }
};

export const postRideLocation = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (principal.role !== "driver") {
      throw new RideTransitionError("Only drivers may update ride location", 403, "DRIVER_REQUIRED");
    }
    const ride = await updateActiveRideLocation({
      rideId: req.params.rideId,
      driverId: principal.id,
      payload: req.body,
    });
    const payload = {
      rideId: String(ride._id),
      status: ride.status,
      location: ride.lastDriverLocation,
    };
    io.to(`ride:${ride._id}`).to(String(ride.passengerId)).emit("ride:driver_location", payload);
    return res.json({ success: true, ...payload });
  } catch (error) {
    return sendError(res, error);
  }
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
    return res.json({
      success: true,
      messages: messages.reverse().map(toRideMessageDto),
    });
  } catch (error) { return sendError(res, error); }
};

export const sendRideMessage = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { ride, participantRole } = await assertRideParticipant(principal, req.params.rideId, { requireContact: true });
    // A contact has already been authorized for these two participants.  GPS
    // freshness controls discovery and creating a *new* contact, not message
    // delivery in an existing private conversation.  Requiring a fresh
    // location here made valid chats fail whenever the driver was stationary,
    // backgrounded, or temporarily offline.
    const messageType = String(req.body?.messageType || "text").trim().toLowerCase();
    if (!["text", "trip_request"].includes(messageType)) {
      throw new CommunicationPolicyError("Unsupported message type", 400, "INVALID_MESSAGE_TYPE");
    }
    const text = String(req.body?.text || "").trim();
    const clientMessageId = String(req.body?.clientMessageId || "").trim();
    if (!text || text.length > 2000 || !clientMessageId || clientMessageId.length > 100) {
      throw new CommunicationPolicyError("text and clientMessageId are required", 400, "INVALID_MESSAGE");
    }
    let metadata = null;
    if (messageType === "trip_request") {
      if (participantRole !== "passenger") {
        throw new CommunicationPolicyError("Only passengers can send trip requests", 403, "PASSENGER_REQUIRED");
      }
      metadata = {
        ...parseTripRequestMetadata(req.body?.metadata || {}),
        tripRequestStatus: "active",
      };
    }
    let message;
    let created = true;
    try {
      message = await RideMessage.create({ rideId: ride._id, senderId: principal.id, senderRole: participantRole, text, clientMessageId, messageType, metadata });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      created = false;
      message = await RideMessage.findOne({ rideId: ride._id, senderId: principal.id, clientMessageId });
    }
    if (created && messageType === "trip_request") {
      await cancelSupersededTripRequests({ rideId: ride._id, latestMessage: message });
    }
    const messageEvent = rideMessageEventPayload(message);
    io.to(String(ride.passengerId)).to(String(ride.driverId)).emit("ride:message", messageEvent);
    const { conversation, recipientId, notification } = await touchConversationWithMessage({
      ride,
      message,
      participantRole,
    });
    await emitConversationUpdated(conversation);
    if (String(recipientId) === String(notification?.userId)) {
      emitNotificationNew(notification);
      await sendPushToUser({
        userId: recipientId,
        title: "New message",
        body: notification?.message || message.text || "",
        data: notification
          ? {
              id: String(notification._id),
              type: "RIDE_MESSAGE",
              rideId: String(ride._id),
              conversationId: String(notification.conversationId || ""),
              messageId: String(notification.messageId || message._id),
              deepLink: `drewel://chat/ride?conversationId=${String(notification.conversationId || "")}`,
            }
          : {},
        type: "RIDE_MESSAGE",
      });
    } else {
      io.to(String(recipientId)).emit("notification:new", {
        id: notification?._id ? String(notification._id) : "",
        type: "RIDE_MESSAGE",
        message: notification?.message || "",
        read: Boolean(notification?.read),
        data: notification?.data || { rideId: String(ride._id) },
        createdAt: notification?.createdAt || new Date(),
      });
    }
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
    if (status === "read") {
      const conversation = await markConversationRead({ principal, rideId: String(ride._id) });
      const conversationDoc = await RideConversation.findById(conversation.id);
      await emitConversationUpdated(conversationDoc);
    }
    return res.json({ success: true, message });
  } catch (error) { return sendError(res, error); }
};

/**
 * Sends a voice note inside an authorized ride conversation.
 *
 * Flow: authenticated principal → ride participant + contact policy →
 * multipart audio already stored by the upload middleware → idempotent
 * RideMessage row (clientMessageId unique index keeps retries duplicate-free)
 * → realtime `ride:message` event → conversation preview/unread bump →
 * notification + push. The database only ever stores the storage reference.
 */
export const sendRideVoiceMessage = async (req, res) => {
  let uploadedFile = null;
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { ride, participantRole } = await assertRideParticipant(principal, req.params.rideId, { requireContact: true });

    uploadedFile = req.file;
    if (!uploadedFile) {
      throw new CommunicationPolicyError("A recorded voice file is required", 400, "VOICE_FILE_REQUIRED");
    }
    const clientMessageId = String(req.body?.clientMessageId || "").trim();
    if (!clientMessageId || clientMessageId.length > 100) {
      throw new CommunicationPolicyError("clientMessageId is required", 400, "INVALID_MESSAGE");
    }
    // The recorder enforces the cap client-side; the server clamps and rejects
    // clearly over-limit payloads so a tampered client cannot bypass it.
    const requestedDuration = Number.parseFloat(req.body?.durationSeconds);
    if (Number.isFinite(requestedDuration) && requestedDuration > CHAT_AUDIO_MAX_DURATION_SECONDS + 2) {
      throw new CommunicationPolicyError(
        `Voice message must not exceed ${CHAT_AUDIO_MAX_DURATION_SECONDS} seconds`,
        413,
        "VOICE_TOO_LONG"
      );
    }
    const durationSeconds = Number.isFinite(requestedDuration) && requestedDuration > 0
      ? Math.min(requestedDuration, CHAT_AUDIO_MAX_DURATION_SECONDS)
      : null;

    const storageKind = uploadedFile.storage || (isS3StorageEnabled() ? "s3" : "local");
    const storageKey = uploadedFile.key || uploadedFile.filename;
    const mimeType = String(uploadedFile.mimetype || "audio/mp4");

    let message;
    let created = true;
    try {
      message = await RideMessage.create({
        rideId: ride._id,
        senderId: principal.id,
        senderRole: participantRole,
        text: "",
        clientMessageId,
        messageType: "voice",
        metadata: null,
        audioUrl: null,
        audioKey: storageKey,
        audioStorage: storageKind,
        audioMimeType: mimeType,
        audioDuration: durationSeconds,
        audioSize: Number(uploadedFile.size) || null,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      // Idempotent retry: the message already exists, so discard the freshly
      // uploaded bytes and return the original row — never a duplicate.
      created = false;
      await removeChatAudioUpload({ storage: storageKind, key: storageKey }).catch((cleanupError) => {
        console.error("Voice retry cleanup failed", cleanupError.message);
      });
      message = await RideMessage.findOne({ rideId: ride._id, senderId: principal.id, clientMessageId });
    }
    uploadedFile = null; // Ownership transferred to the message row / cleanup.

    io.to(String(ride.passengerId)).to(String(ride.driverId)).emit("ride:message", rideMessageEventPayload(message));
    const { conversation, recipientId, notification } = await touchConversationWithMessage({
      ride,
      message,
      participantRole,
    });
    await emitConversationUpdated(conversation);
    if (String(recipientId) === String(notification?.userId)) {
      emitNotificationNew(notification);
      await sendPushToUser({
        userId: recipientId,
        title: "New message",
        body: notification?.message || "sent you a voice message",
        data: notification
          ? {
              id: String(notification._id),
              type: "RIDE_MESSAGE",
              rideId: String(ride._id),
              conversationId: String(notification.conversationId || ""),
              messageId: String(notification.messageId || message._id),
              deepLink: `drewel://chat/ride?conversationId=${String(notification.conversationId || "")}`,
            }
          : {},
        type: "RIDE_MESSAGE",
      });
    } else {
      io.to(String(recipientId)).emit("notification:new", {
        id: notification?._id ? String(notification._id) : "",
        type: "RIDE_MESSAGE",
        message: notification?.message || "",
        read: Boolean(notification?.read),
        data: notification?.data || { rideId: String(ride._id) },
        createdAt: notification?.createdAt || new Date(),
      });
    }

    return res.status(created ? 201 : 200).json({
      success: true,
      message: toRideMessageDto(message),
      idempotent: !created,
    });
  } catch (error) {
    // A rejected upload must not leave orphaned bytes behind.
    if (uploadedFile) {
      await removeChatAudioUpload({
        storage: uploadedFile.storage || (isS3StorageEnabled() ? "s3" : "local"),
        key: uploadedFile.key || uploadedFile.filename,
      }).catch((cleanupError) => {
        console.error("Voice upload cleanup failed", cleanupError.message);
      });
    }
    return sendError(res, error);
  }
};

/**
 * Streams a voice note to an authenticated ride participant. This is the ONLY
 * way chat audio leaves storage: there is no public/static path for these
 * files, and every request re-verifies conversation membership, so guessing a
 * URL or message id from another chat always fails with 403/404.
 */
export const getRideMessageAudio = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { ride } = await assertRideParticipant(principal, req.params.rideId);
    if (!mongoose.isValidObjectId(req.params.messageId)) {
      throw new CommunicationPolicyError("Invalid message id", 400, "INVALID_MESSAGE_ID");
    }
    const message = await RideMessage.findOne({
      _id: req.params.messageId,
      rideId: ride._id,
      messageType: "voice",
    }).select("audioKey audioStorage audioMimeType audioSize").lean();
    if (!message?.audioKey) {
      throw new CommunicationPolicyError("Voice message not found", 404, "MESSAGE_NOT_FOUND");
    }

    const contentType = message.audioMimeType || "audio/mp4";
    const safeFileName = path.basename(String(message.audioKey));
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("Content-Disposition", `inline; filename="${safeFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`);

    if (message.audioStorage === "s3") {
      const rangeHeader = String(req.headers.range || "");
      const command = new GetObjectCommand({
        Bucket: getS3Bucket(),
        Key: message.audioKey,
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      });
      const object = await getS3Client().send(command);
      if (object.ContentType) res.setHeader("Content-Type", object.ContentType);
      if (object.ContentLength != null) res.setHeader("Content-Length", String(object.ContentLength));
      if (object.ContentRange) res.setHeader("Content-Range", object.ContentRange);
      res.status(object.ContentRange ? 206 : 200);
      object.Body.pipe(res);
      return;
    }

    const localPath = path.join(chatAudioRootPath, safeFileName);
    if (!fs.existsSync(localPath)) {
      throw new CommunicationPolicyError("Voice message not found", 404, "MESSAGE_NOT_FOUND");
    }
    // sendFile honors Range requests for seeking automatically.
    res.sendFile(localPath);
  } catch (error) {
    if (res.headersSent) return res.end();
    return sendError(res, error);
  }
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
      io.to(String(ride.passengerId)).to(String(ride.driverId)).emit("ride:state", { rideId: String(ride._id), blocked: true, contactAllowed: false });
    }
    if (type === "report") {
      if (ride.status === "in_progress") {
        const disputed = await Ride.findOneAndUpdate(
          { _id: ride._id, status: "in_progress" },
          { $set: { status: "disputed" }, $inc: { stateVersion: 1 } },
          { new: true }
        );
        if (disputed) {
          await RideAudit.create({
            rideId: disputed._id,
            action: "ride_disputed",
            fromStatus: "in_progress",
            toStatus: "disputed",
            actorId: principal.id,
            actorRole: participantRole,
            reasonCode: reason.slice(0, 120),
          });
          const payload = {
            rideId: String(disputed._id),
            status: disputed.status,
            stateVersion: disputed.stateVersion,
          };
          io.to(`ride:${disputed._id}`)
            .to(String(disputed.passengerId))
            .to(String(disputed.driverId))
            .emit("ride:status_changed", payload);
        }
      }
    }
    await CommunicationAudit.create({ rideId: ride._id, action: `ride_${type}`, actorId: principal.id, actorRole: participantRole, outcome: "success" });
    return res.status(201).json({ success: true, action: { id: String(action._id), rideId: String(action.rideId), type: action.type, reason: action.reason, createdAt: action.createdAt } });
  } catch (error) { return sendError(res, error); }
};

import crypto from "node:crypto";
import mongoose from "mongoose";
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
import { endActiveCallsForRide, toCallDto } from "../services/callSessionService.js";
import CallSession from "../models/CallSession.js";
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
  ...(ride.status !== "contacting"
    ? {
        pickup: ride.pickup,
        destination: ride.destination,
        vehicleType: ride.vehicleType || "",
        agreedPrice: ride.agreedPrice ?? null,
        confirmedAt: ride.confirmedAt,
      }
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

export const emitNotificationNew = (notification) => {
  if (!notification) return;
  io.to(String(notification.userId)).emit("notification:new", {
    id: String(notification._id),
    type: notification.type,
    message: notification.message,
    read: Boolean(notification.read),
    data: notification.data || {},
    createdAt: notification.createdAt,
  });
};

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

const hasMissionPointInput = (value) =>
  value && (value.lat !== undefined || value.long !== undefined || value.address !== undefined);

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
    // A contact has already been authorized for these two participants.  GPS
    // freshness controls discovery and creating a *new* contact, not message
    // delivery in an existing private conversation.  Requiring a fresh
    // location here made valid chats fail whenever the driver was stationary,
    // backgrounded, or temporarily offline.
    const messageType = String(req.body?.messageType || "text").trim().toLowerCase();
    if (!["text", "trip_request"].includes(messageType)) {
      throw new CommunicationPolicyError("Unsupported message type", 400, "INVALID_MESSAGE_TYPE");
    }
    let metadata = null;
    if (messageType === "trip_request") {
      if (participantRole !== "passenger") {
        throw new CommunicationPolicyError("Only passengers can send trip requests", 403, "PASSENGER_REQUIRED");
      }
      if (ride.status !== "contacting") {
        throw new CommunicationPolicyError("Trip requests are only available while contacting", 409, "TRIP_REQUEST_CLOSED");
      }
      metadata = parseTripRequestMetadata(req.body?.metadata || {});
      ride.pickup = metadata.pickup;
      ride.destination = metadata.destination;
      await ride.save();
    }
    const text = String(req.body?.text || "").trim();
    const clientMessageId = String(req.body?.clientMessageId || "").trim();
    if (!text || text.length > 2000 || !clientMessageId || clientMessageId.length > 100) {
      throw new CommunicationPolicyError("text and clientMessageId are required", 400, "INVALID_MESSAGE");
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
    const messageEvent = {
      rideId: String(ride._id),
      messageId: String(message._id),
      senderId: String(message.senderId),
      senderRole: message.senderRole,
      text: message.text,
      messageType: message.messageType,
      metadata: message.metadata,
      status: message.status,
      clientMessageId: message.clientMessageId,
      createdAt: message.createdAt,
    };
    io.to(String(ride.passengerId)).to(String(ride.driverId)).emit("ride:message", messageEvent);
    const { conversation, recipientId, notification } = await touchConversationWithMessage({
      ride,
      message,
      participantRole,
    });
    await emitConversationUpdated(conversation);
    if (String(recipientId) === String(notification?.userId)) {
      emitNotificationNew(notification);
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

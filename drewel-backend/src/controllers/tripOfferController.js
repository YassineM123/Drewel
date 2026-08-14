import TripOffer from "../models/TripOffer.js";
import Ride from "../models/Ride.js";
import { io } from "../socket/index.js";
import { resolvePrincipal } from "../services/rideCommunicationPolicy.js";
import {
  ensureConversationForRide,
  syncConversationForRideId,
} from "../services/conversationService.js";
import { emitConversationUpdated } from "./rideController.js";
import { dispatchNotification } from "../services/notificationService.js";
import {
  acceptTripOffer,
  closeTripOffer,
  createTripOffer,
  getOfferWalletDto,
  toTripOfferDto,
} from "../services/tripOfferService.js";
import {
  PointsValidationError,
  hashIdempotencyPayload,
  pointsValidationErrorResponse,
  requireBoundedString,
  requireIdempotencyKey,
  requireObjectId,
} from "../helpers/pointsValidation.js";

const sendError = (res, error) => {
  if (pointsValidationErrorResponse(error, res)) return;
  return res.status(error.statusCode || error.status || 500).json({
    success: false,
    code: error.code || "TRIP_OFFER_INTERNAL_ERROR",
    message: error.statusCode || error.status ? error.message : "Internal server error",
  });
};

const parseOfferPayload = (body = {}) => {
  const offeredPrice = Number(body.offeredPrice);
  if (!Number.isFinite(offeredPrice) || offeredPrice < 0 || offeredPrice > 1_000_000_000) {
    throw new PointsValidationError("offeredPrice is invalid");
  }
  const currency = requireBoundedString(body.currency, "currency", {
    min: 3,
    max: 3,
    pattern: /^[A-Za-z]{3}$/,
  }).toUpperCase();
  return {
    contactRideId: requireObjectId(body.contactRideId, "contactRideId"),
    clientOfferId: requireBoundedString(body.clientOfferId, "clientOfferId", {
      min: 8,
      max: 200,
      pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]+$/,
    }),
    offeredPrice,
    currency,
    vehicleType: String(body.vehicleType || "").trim().slice(0, 120),
    note: String(body.note || "").trim().slice(0, 1000),
  };
};

export const sendTripOffer = async (req, res) => {
  let authenticatedDriverId = null;
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (principal.role !== "driver") {
      return res.status(403).json({
        success: false,
        code: "DRIVER_REQUIRED",
        message: "Only drivers can send trip offers",
      });
    }
    authenticatedDriverId = principal.id;
    const idempotencyKey = requireIdempotencyKey(req);
    const payload = parseOfferPayload(req.body);
    const requestFingerprint = hashIdempotencyPayload(payload);
    const result = await createTripOffer({
      driverId: principal.id,
      ...payload,
      idempotencyKey,
      requestFingerprint,
    });
    return res.status(result.idempotent ? 200 : 201).json({
      success: true,
      offer: toTripOfferDto(result.offer),
      wallet: getOfferWalletDto(result.wallet, result.offer.pointsCost),
      idempotent: result.idempotent,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        code: "TRIP_OFFER_CONFLICT",
        message: "A pending offer already exists for this conversation",
      });
    }
    if (error?.code === "INSUFFICIENT_AVAILABLE_POINTS" && authenticatedDriverId) {
      await dispatchNotification({
        userId: authenticatedDriverId,
        recipientType: "driver",
        type: "POINTS_INSUFFICIENT_BALANCE",
        title: "Not enough points",
        message: "You do not have enough available points to send this offer",
        deepLink: "drewel://driver/points",
        data: { action: "send_trip_offer" },
      });
    }
    return sendError(res, error);
  }
};

export const listMyTripOffers = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (!["driver", "passenger"].includes(principal.role)) {
      return res.status(403).json({ success: false, code: "OFFER_ACCESS_FORBIDDEN" });
    }
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || "20", 10) || 20));
    const filter =
      principal.role === "driver"
        ? { driverId: principal.id }
        : { passengerId: principal.id };
    if (req.query.status) {
      const status = String(req.query.status).trim().toLowerCase();
      if (
        !["pending", "accepted", "declined", "expired", "cancelled", "delivery_failed"].includes(
          status
        )
      ) {
        throw new PointsValidationError("status is invalid");
      }
      filter.status = status;
    }
    if (req.query.before) filter._id = { $lt: requireObjectId(req.query.before, "before") };
    const offers = await TripOffer.find(filter)
      .sort({ _id: -1 })
      .limit(limit);
    return res.json({
      success: true,
      offers: offers.map(toTripOfferDto),
      pagination: {
        limit,
        nextCursor: offers.length === limit ? String(offers[offers.length - 1]._id) : null,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getTripOffer = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const offerId = requireObjectId(req.params.offerId, "offerId");
    const offer = await TripOffer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ success: false, code: "TRIP_OFFER_NOT_FOUND" });
    }
    const owns =
      (principal.role === "driver" && String(offer.driverId) === String(principal.id)) ||
      (principal.role === "passenger" &&
        String(offer.passengerId) === String(principal.id));
    if (!owns) {
      return res.status(403).json({ success: false, code: "TRIP_OFFER_FORBIDDEN" });
    }
    return res.json({ success: true, offer: toTripOfferDto(offer) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const acceptOffer = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    if (principal.role !== "passenger") {
      return res.status(403).json({
        success: false,
        code: "PASSENGER_REQUIRED",
        message: "Only the target passenger can accept an offer",
      });
    }
    const result = await acceptTripOffer({
      offerId: requireObjectId(req.params.offerId, "offerId"),
      passengerId: principal.id,
      idempotencyKey: requireIdempotencyKey(req),
    });
    if (result.expired) {
      return res.status(410).json({
        success: false,
        code: "TRIP_OFFER_EXPIRED",
        offer: toTripOfferDto(result.offer),
      });
    }
    const rideEvent = {
      rideId: String(result.ride._id),
      offerId: String(result.offer._id),
      status: result.ride.status,
    };
    io.to(`ride:${result.ride._id}`)
      .to(String(result.offer.driverId))
      .to(String(result.offer.passengerId))
      .emit(result.idempotent ? "ride:status_changed" : "ride:created", rideEvent);
    io.to(String(result.offer.driverId))
      .to(String(result.offer.passengerId))
      .emit("ride:state", rideEvent);
    io.emit("driver:availability", {
      driverId: String(result.offer.driverId),
      status: "Busy",
      isAvailable: false,
    });
    const conversation = await ensureConversationForRide(result.ride);
    await emitConversationUpdated(conversation);
    await notifyTripOfferAccepted({ ride: result.ride });
    const cancelledContacts = await Ride.find({
      _id: { $ne: result.ride._id },
      $or: [{ passengerId: principal.id }, { driverId: result.offer.driverId }],
      status: { $regex: /^cancelled/ },
    })
      .select("_id")
      .lean();
    for (const contact of cancelledContacts) {
      const synced = await syncConversationForRideId(contact._id);
      await emitConversationUpdated(synced);
    }
    return res.json({
      success: true,
      offer: toTripOfferDto(result.offer),
      ride: result.ride,
      wallet: result.wallet
        ? getOfferWalletDto(result.wallet, result.offer.pointsCost)
        : null,
      idempotent: result.idempotent,
      pickupPin: result.pickupPin,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        code: "ACTIVE_RIDE_CONFLICT",
        message: "Passenger or driver already has an active ride",
      });
    }
    return sendError(res, error);
  }
};

const closeAs = (actorRole, terminalStatus, reason) => async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    requireIdempotencyKey(req);
    if (principal.role !== actorRole) {
      return res.status(403).json({
        success: false,
        code: actorRole === "driver" ? "DRIVER_REQUIRED" : "PASSENGER_REQUIRED",
      });
    }
    const result = await closeTripOffer({
      offerId: requireObjectId(req.params.offerId, "offerId"),
      actorId: principal.id,
      actorRole,
      terminalStatus,
      reason,
    });
    return res.json({
      success: true,
      offer: toTripOfferDto(result.offer),
      wallet: result.wallet
        ? getOfferWalletDto(result.wallet, result.offer.pointsCost)
        : null,
      idempotent: result.idempotent,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const declineOffer = closeAs(
  "passenger",
  "declined",
  "Trip offer declined by passenger"
);
export const cancelOffer = closeAs(
  "driver",
  "cancelled",
  "Trip offer cancelled by driver"
);

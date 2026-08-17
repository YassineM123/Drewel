import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import Ride from "../models/Ride.js";
import RideAudit from "../models/RideAudit.js";
import TripOffer from "../models/TripOffer.js";
import PointsSettings from "../models/PointsSettings.js";
import {
  PointsError,
  captureOfferPointsInSession,
  queuePointsEvents,
  releaseOfferPointsInSession,
  reservePointsInSession,
  runPointsTransaction,
  toWalletDto,
} from "./pointsWalletService.js";
import { createPickupPin, decryptPickupPin } from "./rideTransitionService.js";
import { buildFreshDubaiMarketplaceAvailabilityFilter } from "../utils/availableDrivers.js";
import { notifyRideTransition } from "./rideNotificationService.js";

const offerTtlMs = (seconds) => seconds * 1000;

const driverOfferFilter = (driverId) => ({
  _id: driverId,
  ...buildFreshDubaiMarketplaceAvailabilityFilter(),
  status: "completed",
  profileRequestStatus: "approved",
});

export const toTripOfferDto = (offer) => ({
  id: String(offer._id),
  driverId: String(offer.driverId),
  passengerId: String(offer.passengerId),
  contactRideId: String(offer.contactRideId),
  rideId: offer.rideId ? String(offer.rideId) : null,
  clientOfferId: offer.clientOfferId,
  offeredPrice: offer.offeredPrice,
  currency: offer.currency,
  pickup: offer.pickup,
  destination: offer.destination,
  vehicleType: offer.vehicleType,
  note: offer.note,
  pointsCost: offer.pointsCost,
  status: offer.status,
  reservationState: offer.reservationState,
  expiresAt: offer.expiresAt,
  resolvedAt: offer.resolvedAt,
  stateVersion: offer.stateVersion,
  createdAt: offer.createdAt,
  updatedAt: offer.updatedAt,
});

export const createTripOffer = async ({
  driverId,
  contactRideId,
  clientOfferId,
  idempotencyKey,
  requestFingerprint,
  pickup: requestedPickup,
  destination: requestedDestination,
  offeredPrice,
  currency,
  vehicleType,
  note,
}) =>
  runPointsTransaction(async (session) => {
    const existing = await TripOffer.findOne({
      driverId,
      $or: [{ clientOfferId }, { idempotencyKey }],
    }).session(session);
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        throw new PointsError(
          "Offer idempotency key was reused with different fields",
          409,
          "IDEMPOTENCY_KEY_REUSED"
        );
      }
      return { offer: existing, wallet: null, idempotent: true };
    }

    const [driver, contact, settings] = await Promise.all([
      Driver.findOne(driverOfferFilter(driverId)).session(session),
      Ride.findOne({
        _id: contactRideId,
        driverId,
        status: "contacting",
      }).session(session),
      PointsSettings.getEffective({ session }),
    ]);
    if (!driver) {
      throw new PointsError(
        "Only an approved online driver can send an offer",
        403,
        "DRIVER_NOT_ELIGIBLE_FOR_OFFERS"
      );
    }
    if (!contact) {
      throw new PointsError(
        "The driver does not belong to this active conversation",
        403,
        "OFFER_CONVERSATION_FORBIDDEN"
      );
    }
    let pickup = contact.pickup;
    let destination = contact.destination;
    let hasRequestedRoute = [pickup?.lat, pickup?.long, destination?.lat, destination?.long]
      .every(Number.isFinite);
    if (!hasRequestedRoute && requestedPickup && requestedDestination) {
      pickup = requestedPickup;
      destination = requestedDestination;
      if (pickup && destination) {
        contact.pickup = pickup;
        contact.destination = destination;
        await contact.save({ session });
        hasRequestedRoute = true;
      }
    }
    if (!hasRequestedRoute) {
      throw new PointsError(
        "The passenger must choose pickup and destination before an offer can be sent",
        409,
        "ROUTE_REQUEST_REQUIRED"
      );
    }

    const concurrentOffers = await TripOffer.countDocuments({
      driverId,
      status: "pending",
      reservationState: "reserved",
      expiresAt: { $gt: new Date() },
    }).session(session);
    if (concurrentOffers >= settings.maximumConcurrentOffers) {
      throw new PointsError(
        "The maximum number of concurrent trip offers has been reached",
        409,
        "MAXIMUM_CONCURRENT_OFFERS_REACHED"
      );
    }

    const offerId = new mongoose.Types.ObjectId();
    const reservation = await reservePointsInSession({
      driverId,
      points: settings.rideOfferPointsCost,
      offerId,
      rideId: contact._id,
      idempotencyKey: `offer-reserve:${driverId}:${idempotencyKey}`,
      session,
    });
    const expiresAt = new Date(
      Date.now() + offerTtlMs(settings.offerExpirationSeconds)
    );
    const [offer] = await TripOffer.create(
      [
        {
          _id: offerId,
          driverId,
          passengerId: contact.passengerId,
          contactRideId: contact._id,
          clientOfferId,
          idempotencyKey,
          requestFingerprint,
          offeredPrice,
          currency,
          pickup,
          destination,
          vehicleType,
          note,
          pointsCost: settings.rideOfferPointsCost,
          reservedBonusPoints: reservation.bonusPoints,
          reservedPurchasedPoints: reservation.purchasedPoints,
          status: "pending",
          reservationState: "reserved",
          expiresAt,
        },
      ],
      { session }
    );

    const outboxEvents = [
        {
          eventKey: `offer:${offer._id}:created`,
          type: "points:notification",
          aggregateType: "trip_offer",
          aggregateId: offer._id,
          recipientId: offer.passengerId,
          recipientType: "User",
          payload: {
            offerId: String(offer._id),
            rideId: String(contact._id),
            status: offer.status,
            notification: {
              type: "TRIP_OFFER_RECEIVED",
              title: "New trip offer",
              message: "You received a new trip offer",
              deepLink: `drewel://chat/ride?rideId=${String(contact._id)}`,
            },
          },
        },
        {
          eventKey: `offer:${offer._id}:reserved`,
          type: "points:reserved",
          aggregateType: "wallet",
          aggregateId: reservation.wallet._id,
          recipientId: driverId,
          recipientType: "Driver",
          payload: {
            offerId: String(offer._id),
            points: offer.pointsCost,
            walletVersion: reservation.wallet.version,
            notification: {
              type: "POINTS_RESERVED",
              title: "Points reserved",
              message: `${offer.pointsCost} points reserved for the trip offer`,
              deepLink: "drewel://driver/points",
            },
          },
        },
      ];
    if (
      reservation.wallet.availableBonusPoints +
        reservation.wallet.availablePurchasedPoints <
      settings.lowBalanceThreshold
    ) {
      outboxEvents.push({
        eventKey: `offer:${offer._id}:low-balance`,
        type: "points:notification",
        aggregateType: "wallet",
        aggregateId: reservation.wallet._id,
        recipientId: driverId,
        recipientType: "Driver",
        payload: {
          walletVersion: reservation.wallet.version,
          notification: {
            type: "POINTS_LOW_BALANCE",
            title: "Points getting low",
            message: "Your available points are too low to send another offer",
            deepLink: "drewel://driver/points",
          },
        },
      });
    }
    await queuePointsEvents(outboxEvents, session);
    return { offer, wallet: reservation.wallet, idempotent: false };
  });

const releaseCompetingOffers = async (acceptedOffer, session) => {
  const competitors = await TripOffer.find({
    _id: { $ne: acceptedOffer._id },
    status: "pending",
    reservationState: "reserved",
    $or: [
      { passengerId: acceptedOffer.passengerId },
      { driverId: acceptedOffer.driverId },
    ],
  }).session(session);

  for (const competitor of competitors) {
    const release = await releaseOfferPointsInSession({
      offer: competitor,
      reason: "Competing offer closed after ride confirmation",
      idempotencyKey: `offer-release:${competitor._id}:competing`,
      session,
    });
    await TripOffer.updateOne(
      { _id: competitor._id, status: "pending", reservationState: "reserved" },
      {
        $set: {
          status: "cancelled",
          reservationState: "released",
          cancelledAt: new Date(),
          resolvedAt: new Date(),
        },
        $inc: { stateVersion: 1 },
      },
      { session, runValidators: true }
    );
    await queuePointsEvents(
      [
        {
          eventKey: `offer:${competitor._id}:competing-release`,
          type: "points:released",
          aggregateType: "wallet",
          aggregateId: release.wallet._id,
          recipientId: competitor.driverId,
          recipientType: "Driver",
          payload: {
            offerId: String(competitor._id),
            status: "cancelled",
            points: competitor.pointsCost,
            walletVersion: release.wallet.version,
          },
        },
      ],
      session
    );
  }
};

export const acceptTripOffer = async ({
  offerId,
  passengerId,
  idempotencyKey,
  confirmedBy,
  actorRole = "passenger",
}) =>
  runPointsTransaction(async (session) => {
    const offer = await TripOffer.findById(offerId).session(session);
    if (!offer) throw new PointsError("Trip offer not found", 404, "TRIP_OFFER_NOT_FOUND");
    if (String(offer.passengerId) !== String(passengerId)) {
      throw new PointsError("You do not own this offer", 403, "TRIP_OFFER_FORBIDDEN");
    }
    if (offer.status === "accepted") {
      const [ride, wallet] = await Promise.all([
        Ride.findById(offer.rideId).select("+pickupPinEncrypted").session(session),
        mongoose.model("DriverPointsWallet").findOne({ driverId: offer.driverId }).session(session),
      ]);
      return {
        offer,
        ride,
        wallet,
        pickupPin: decryptPickupPin(ride?.pickupPinEncrypted),
        idempotent: true,
      };
    }
    if (offer.status !== "pending" || offer.reservationState !== "reserved") {
      throw new PointsError("Trip offer is no longer active", 409, "TRIP_OFFER_NOT_ACTIVE");
    }
    if (offer.expiresAt <= new Date()) {
      const released = await closeTripOfferInSession({
        offer,
        terminalStatus: "expired",
        reason: "Trip offer expired before acceptance",
        session,
      });
      return { ...released, expired: true };
    }

    const driver = await Driver.findOneAndUpdate(
      driverOfferFilter(offer.driverId),
      {
        $set: {
          availabilityStatus: "Busy",
          activeRideId: offer.contactRideId,
          activeRideStartedAt: new Date(),
        },
      },
      { new: true, session }
    );
    if (!driver) {
      throw new PointsError(
        "Driver is no longer available",
        409,
        "DRIVER_NOT_AVAILABLE"
      );
    }
    const passenger = await User.findOneAndUpdate(
      { _id: passengerId, activeRideId: null, isRestricted: false },
      {
        $set: {
          activeRideId: offer.contactRideId,
          activeRideStartedAt: new Date(),
        },
      },
      { new: true, session }
    );
    if (!passenger) {
      throw new PointsError(
        "Passenger already has an active ride",
        409,
        "ACTIVE_RIDE_CONFLICT"
      );
    }
    const now = new Date();
    const pickupPin = createPickupPin();
    const ride = await Ride.findOneAndUpdate(
      {
        _id: offer.contactRideId,
        passengerId,
        driverId: offer.driverId,
        status: "contacting",
      },
      {
        $set: {
          status: "confirmed",
          acceptedAt: now,
          acceptanceIdempotencyKey: idempotencyKey,
          confirmedAt: now,
          confirmedBy: confirmedBy || passengerId,
          pickup: offer.pickup,
          destination: offer.destination,
          vehicleType: offer.vehicleType || driver.vehicleType || "",
          agreedPrice: offer.offeredPrice,
          pickupPinHash: pickupPin.hash,
          pickupPinSalt: pickupPin.salt,
          pickupPinEncrypted: pickupPin.encrypted,
          pickupPinAttempts: 0,
          pickupPinLockedUntil: null,
        },
      },
      { new: true, session, runValidators: true }
    );
    if (!ride) {
      throw new PointsError(
        "The offer conversation is no longer confirmable",
        409,
        "RIDE_STATE_CONFLICT"
      );
    }

    const charge = await captureOfferPointsInSession({
      offer,
      rideId: ride._id,
      idempotencyKey: `offer-charge:${offer._id}`,
      session,
    });
    const accepted = await TripOffer.findOneAndUpdate(
      {
        _id: offer._id,
        status: "pending",
        reservationState: "reserved",
        expiresAt: { $gt: now },
      },
      {
        $set: {
          status: "accepted",
          reservationState: "captured",
          rideId: ride._id,
          acceptedAt: now,
          resolvedAt: now,
        },
        $inc: { stateVersion: 1 },
      },
      { new: true, session, runValidators: true }
    );
    if (!accepted) {
      throw new PointsError("Offer changed concurrently", 409, "OFFER_STATE_CONFLICT");
    }
    await releaseCompetingOffers(accepted, session);
    await RideAudit.create(
      [
        {
          rideId: ride._id,
          action: "ride_confirmed",
          fromStatus: "contacting",
          toStatus: "confirmed",
          actorId: confirmedBy || passengerId,
          actorRole,
          idempotencyKey: offer.idempotencyKey,
        },
      ],
      { session }
    );

    await Ride.updateMany(
      {
        _id: { $ne: ride._id },
        status: "contacting",
        $or: [{ passengerId }, { driverId: offer.driverId }],
      },
      { $set: { status: "cancelled", endedAt: now, contactEndsAt: now } },
      { session }
    );

    await queuePointsEvents(
      [
        {
          eventKey: `offer:${offer._id}:charged`,
          type: "points:charged",
          aggregateType: "wallet",
          aggregateId: charge.wallet._id,
          recipientId: offer.driverId,
          recipientType: "Driver",
          payload: {
            offerId: String(offer._id),
            rideId: String(ride._id),
            status: "accepted",
            points: offer.pointsCost,
            walletVersion: charge.wallet.version,
            notification: {
              type: "RIDE_POINTS_CHARGED",
              title: "Points charged",
              message: `${offer.pointsCost} points charged for the confirmed ride`,
              deepLink: "drewel://driver/points",
            },
          },
        },
        {
          eventKey: `offer:${offer._id}:accepted-passenger`,
          type: "points:notification",
          aggregateType: "trip_offer",
          aggregateId: offer._id,
          recipientId: passengerId,
          recipientType: "User",
          payload: {
            offerId: String(offer._id),
            rideId: String(ride._id),
            status: "accepted",
            notification: {
              type: "TRIP_OFFER_ACCEPTED",
              title: "Trip offer accepted",
              message: "Trip offer accepted",
              deepLink: `drewel://chat/ride?rideId=${String(ride._id)}`,
            },
          },
        },
      ],
      session
    );
    return {
      offer: accepted,
      ride,
      wallet: charge.wallet,
      pickupPin: pickupPin.pin,
      idempotent: false,
    };
  });

/**
 * Notifies both participants once a trip offer is accepted and the ride is
 * confirmed. Invoked outside the points transaction so notification failures
 * can never roll back a successful ride confirmation.
 */
export const notifyTripOfferAccepted = async ({ ride, actorRole = "passenger" }) => {
  try {
    await notifyRideTransition({ ride, toStatus: "confirmed", actorRole });
  } catch (error) {
    console.error("[notification] trip offer accepted notification failed", error.message);
  }
};

const terminalTimestamp = (status) => ({
  ...(status === "declined" ? { declinedAt: new Date() } : {}),
  ...(status === "cancelled" ? { cancelledAt: new Date() } : {}),
  ...(status === "expired" ? { expiredAt: new Date() } : {}),
  ...(status === "delivery_failed" ? { deliveryFailedAt: new Date() } : {}),
});

export const closeTripOfferInSession = async ({
  offer,
  terminalStatus,
  reason,
  session,
}) => {
  if (offer.status !== "pending" || offer.reservationState !== "reserved") {
    return { offer, wallet: null, idempotent: true };
  }
  const release = await releaseOfferPointsInSession({
    offer,
    reason,
    idempotencyKey: `offer-release:${offer._id}:${terminalStatus}`,
    session,
  });
  const now = new Date();
  const closed = await TripOffer.findOneAndUpdate(
    { _id: offer._id, status: "pending", reservationState: "reserved" },
    {
      $set: {
        status: terminalStatus,
        reservationState: "released",
        resolvedAt: now,
        ...terminalTimestamp(terminalStatus),
      },
      $inc: { stateVersion: 1 },
    },
    { new: true, session, runValidators: true }
  );
  if (!closed) {
    throw new PointsError("Offer changed concurrently", 409, "OFFER_STATE_CONFLICT");
  }
  await queuePointsEvents(
    [
      {
        eventKey: `offer:${offer._id}:${terminalStatus}`,
        type: "points:released",
        aggregateType: "wallet",
        aggregateId: release.wallet._id,
        recipientId: offer.driverId,
        recipientType: "Driver",
        payload: {
          offerId: String(offer._id),
          status: terminalStatus,
          points: offer.pointsCost,
          walletVersion: release.wallet.version,
          notification: {
            type: "OFFER_POINTS_RELEASED",
            title: "Points released",
            message: `${offer.pointsCost} reserved points released`,
            deepLink: "drewel://driver/points",
          },
        },
      },
      {
        eventKey: `offer:${offer._id}:${terminalStatus}:passenger`,
        type: "points:notification",
        aggregateType: "trip_offer",
        aggregateId: offer._id,
        recipientId: offer.passengerId,
        recipientType: "User",
        payload: {
          offerId: String(offer._id),
          status: terminalStatus,
          notification: {
            type: "TRIP_OFFER_UPDATED",
            title: "Trip offer updated",
            message: `Trip offer ${terminalStatus}`,
            deepLink: "drewel://rides",
          },
        },
      },
    ],
    session
  );
  return { offer: closed, wallet: release.wallet, idempotent: false };
};

export const closeTripOffer = async ({
  offerId,
  actorId = null,
  actorRole,
  terminalStatus,
  reason,
}) =>
  runPointsTransaction(async (session) => {
    const offer = await TripOffer.findById(offerId).session(session);
    if (!offer) throw new PointsError("Trip offer not found", 404, "TRIP_OFFER_NOT_FOUND");
    if (
      (actorRole === "passenger" && String(offer.passengerId) !== String(actorId)) ||
      (actorRole === "driver" && String(offer.driverId) !== String(actorId)) ||
      !["passenger", "driver", "system"].includes(actorRole)
    ) {
      throw new PointsError("Trip offer action is forbidden", 403, "TRIP_OFFER_FORBIDDEN");
    }
    return closeTripOfferInSession({ offer, terminalStatus, reason, session });
  });

export const expireTripOffers = async ({ limit = 100 } = {}) => {
  const ids = await TripOffer.find({
    status: "pending",
    reservationState: "reserved",
    expiresAt: { $lte: new Date() },
  })
    .select("_id")
    .sort({ expiresAt: 1, _id: 1 })
    .limit(limit)
    .lean();
  let released = 0;
  for (const item of ids) {
    const result = await closeTripOffer({
      offerId: item._id,
      actorRole: "system",
      terminalStatus: "expired",
      reason: "Trip offer expired",
    });
    if (!result.idempotent) released += 1;
  }
  return released;
};

export const getOfferWalletDto = (wallet, pointsCost) =>
  wallet ? toWalletDto(wallet, pointsCost) : null;

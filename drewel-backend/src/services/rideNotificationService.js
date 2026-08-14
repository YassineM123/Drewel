import User from "../models/User.js";
import Driver from "../models/Driver.js";
import { dispatchNotification } from "./notificationService.js";

/**
 * ============================================================================
 * RIDE NOTIFICATION SERVICE
 * ============================================================================
 *
 * Turns ride lifecycle events into passenger and driver notifications. The
 * recipient is always the ride participant the backend knows is affected —
 * never a client-supplied id — and the body never contains private data such
 * as phone numbers or the pickup PIN.
 */

const displayFirstName = (participant) => {
  const fullName = String(
    participant?.fullName ||
      [participant?.firstName, participant?.lastName].filter(Boolean).join(" ").trim() ||
      ""
  );
  return fullName.split(/\s+/)[0] || "";
};

const reference = (ride) => `#${String(ride.reference || "").toUpperCase()}`;

const loadParticipants = async (ride) => {
  const [passenger, driver] = await Promise.all([
    User.findById(ride.passengerId).select("fullName firstName lastName").lean(),
    Driver.findById(ride.driverId)
      .select("firstName lastName fullName")
      .lean(),
  ]);
  return {
    passengerFirstName: displayFirstName(passenger),
    driverFirstName: displayFirstName(driver),
  };
};

/**
 * Passenger contacted the driver — the driver receives a high-priority
 * "New ride request" notification with a deep link into the request screen.
 */
export const notifyDriverOfNewRideRequest = async ({ ride, passenger }) => {
  const passengerFirstName = displayFirstName(passenger);
  return dispatchNotification({
    recipientId: ride.driverId,
    recipientType: "driver",
    type: "RIDE_REQUEST",
    title: "New ride request",
    message: `${passengerFirstName || "A passenger"} requested a ride with you.`,
    rideId: ride._id,
    deepLink: "drewel://driver/ride-request",
    data: {
      rideId: String(ride._id),
      rideReference: reference(ride),
      passengerName: passengerFirstName,
    },
    eventKey: `ride:${ride._id}:new-request:${ride.driverId}`,
  });
};

export const notifyRideConfirmed = async ({ ride, actorRole }) => {
  const { passengerFirstName, driverFirstName } = await loadParticipants(ride);
  const driverNotification = dispatchNotification({
    recipientId: ride.driverId,
    recipientType: "driver",
    type: "RIDE_CONFIRMED",
    title: "Ride accepted",
    message: `Head to ${passengerFirstName || "the passenger"}'s pickup location.`,
    rideId: ride._id,
    deepLink: "drewel://driver/active-ride",
    data: {
      rideId: String(ride._id),
      rideReference: reference(ride),
    },
    eventKey: `ride:${ride._id}:confirmed:${ride.driverId}`,
  });
  const passengerNotification = dispatchNotification({
    recipientId: ride.passengerId,
    recipientType: "user",
    type: "RIDE_ACCEPTED",
    title: "Driver found",
    message: `${driverFirstName || "Your driver"} accepted your ride and is heading to your pickup location.`,
    rideId: ride._id,
    deepLink: "drewel://passenger/active-ride",
    data: {
      rideId: String(ride._id),
      rideReference: reference(ride),
      driverName: driverFirstName,
    },
    eventKey: `ride:${ride._id}:accepted:${ride.passengerId}`,
  });
  await Promise.all([driverNotification, passengerNotification]);
};

export const notifyDriverOnTheWay = async ({ ride }) => {
  const { driverFirstName } = await loadParticipants(ride);
  return dispatchNotification({
    recipientId: ride.passengerId,
    recipientType: "user",
    type: "RIDE_ON_THE_WAY",
    title: "Your driver is on the way",
    message: `${driverFirstName || "Your driver"} is heading to your pickup point.`,
    rideId: ride._id,
    deepLink: "drewel://passenger/active-ride",
    data: { rideId: String(ride._id), driverName: driverFirstName },
    eventKey: `ride:${ride._id}:on-the-way:${ride.passengerId}`,
  });
};

export const notifyDriverArrived = async ({ ride }) => {
  const { driverFirstName } = await loadParticipants(ride);
  return dispatchNotification({
    recipientId: ride.passengerId,
    recipientType: "user",
    type: "DRIVER_ARRIVED",
    title: "Your driver has arrived",
    message: `${driverFirstName || "Your driver"} is waiting at the pickup point.`,
    rideId: ride._id,
    deepLink: "drewel://passenger/active-ride",
    data: { rideId: String(ride._id), driverName: driverFirstName },
    eventKey: `ride:${ride._id}:driver-arrived:${ride.passengerId}`,
  });
};

export const notifyRideStarted = async ({ ride }) => {
  const destinationAddress = String(ride.destination?.address || "").trim();
  return dispatchNotification({
    recipientId: ride.passengerId,
    recipientType: "user",
    type: "RIDE_STARTED",
    title: "Your ride has started",
    message: destinationAddress
      ? `You're now heading to ${destinationAddress}.`
      : "You're now on your way to your destination.",
    rideId: ride._id,
    deepLink: "drewel://passenger/active-ride",
    data: { rideId: String(ride._id) },
    eventKey: `ride:${ride._id}:started:${ride.passengerId}`,
  });
};

export const notifyRideCompleted = async ({ ride }) => {
  const { passengerFirstName, driverFirstName } = await loadParticipants(ride);
  const [passengerNotification, driverNotification] = await Promise.all([
    dispatchNotification({
      recipientId: ride.passengerId,
      recipientType: "user",
      type: "RIDE_COMPLETED",
      title: "You've arrived",
      message: "Your ride is complete.",
      rideId: ride._id,
      deepLink: "drewel://passenger/ride-summary",
      data: { rideId: String(ride._id), rideReference: reference(ride) },
      eventKey: `ride:${ride._id}:completed:${ride.passengerId}`,
    }),
    dispatchNotification({
      recipientId: ride.driverId,
      recipientType: "driver",
      type: "RIDE_COMPLETED",
      title: "Ride completed",
      message: `You've completed the ride with ${passengerFirstName || "the passenger"}.`,
      rideId: ride._id,
      deepLink: "drewel://driver/rides",
      data: { rideId: String(ride._id), rideReference: reference(ride) },
      eventKey: `ride:${ride._id}:completed:${ride.driverId}`,
    }),
  ]);
  return { passengerNotification, driverNotification };
};

/**
 * Cancellation notification. The canceller receives a short confirmation; the
 * counterpart receives a contextual "cancelled by other party" alert.
 */
export const notifyRideCancelled = async ({ ride, cancelledByRole }) => {
  const { passengerFirstName, driverFirstName } = await loadParticipants(ride);
  const ref = reference(ride);
  const tasks = [];
  if (cancelledByRole === "driver") {
    tasks.push(
      dispatchNotification({
        recipientId: ride.passengerId,
        recipientType: "user",
        type: "RIDE_DRIVER_CANCELLED",
        title: "Your driver cancelled",
        message: "We're helping you find another driver.",
        rideId: ride._id,
        deepLink: "drewel://rides",
        data: { rideId: String(ride._id), rideReference: ref },
        eventKey: `ride:${ride._id}:driver-cancelled:${ride.passengerId}`,
      }),
      dispatchNotification({
        recipientId: ride.driverId,
        recipientType: "driver",
        type: "RIDE_CANCELLED",
        title: "Ride cancelled",
        message: `Ride ${ref} has been cancelled successfully.`,
        rideId: ride._id,
        deepLink: "drewel://driver/rides",
        data: { rideId: String(ride._id), rideReference: ref },
        eventKey: `ride:${ride._id}:cancelled:${ride.driverId}`,
      })
    );
  } else if (cancelledByRole === "passenger") {
    tasks.push(
      dispatchNotification({
        recipientId: ride.driverId,
        recipientType: "driver",
        type: "RIDE_PASSENGER_CANCELLED",
        title: "Passenger cancelled the ride",
        message: `Ride ${ref} has been cancelled.`,
        rideId: ride._id,
        deepLink: "drewel://driver/rides",
        data: { rideId: String(ride._id), rideReference: ref },
        eventKey: `ride:${ride._id}:passenger-cancelled:${ride.driverId}`,
      }),
      dispatchNotification({
        recipientId: ride.passengerId,
        recipientType: "user",
        type: "RIDE_CANCELLED",
        title: "Ride cancelled",
        message: "Your ride has been cancelled successfully.",
        rideId: ride._id,
        deepLink: "drewel://rides",
        data: { rideId: String(ride._id), rideReference: ref },
        eventKey: `ride:${ride._id}:cancelled:${ride.passengerId}`,
      })
    );
  } else {
    tasks.push(
      dispatchNotification({
        recipientId: ride.passengerId,
        recipientType: "user",
        type: "RIDE_CANCELLED",
        title: "Ride cancelled",
        message: "Your ride has been cancelled.",
        rideId: ride._id,
        deepLink: "drewel://rides",
        data: { rideId: String(ride._id), rideReference: ref },
        eventKey: `ride:${ride._id}:cancelled-admin:${ride.passengerId}`,
      }),
      dispatchNotification({
        recipientId: ride.driverId,
        recipientType: "driver",
        type: "RIDE_CANCELLED",
        title: "Ride cancelled",
        message: `Ride ${ref} has been cancelled.`,
        rideId: ride._id,
        deepLink: "drewel://driver/rides",
        data: { rideId: String(ride._id), rideReference: ref },
        eventKey: `ride:${ride._id}:cancelled-admin:${ride.driverId}`,
      })
    );
  }
  await Promise.all(tasks);
};

export const notifyRideDisputed = async ({ ride }) => {
  const ref = reference(ride);
  await Promise.all([
    dispatchNotification({
      recipientId: ride.passengerId,
      recipientType: "user",
      type: "RIDE_DISPUTED",
      title: "Ride under review",
      message: "Your ride has been flagged for review by our support team.",
      rideId: ride._id,
      deepLink: "drewel://support",
      data: { rideId: String(ride._id), rideReference: ref },
      eventKey: `ride:${ride._id}:disputed:${ride.passengerId}`,
    }),
    dispatchNotification({
      recipientId: ride.driverId,
      recipientType: "driver",
      type: "RIDE_DISPUTED",
      title: "Ride under review",
      message: "This ride has been flagged for review by our support team.",
      rideId: ride._id,
      deepLink: "drewel://support",
      data: { rideId: String(ride._id), rideReference: ref },
      eventKey: `ride:${ride._id}:disputed:${ride.driverId}`,
    }),
  ]);
};

/**
 * Routes a ride transition to the correct notification set. Returns nothing;
 * failures are swallowed by dispatchNotification and logged independently.
 */
export const notifyRideTransition = async ({ ride, toStatus, actorRole }) => {
  try {
    switch (toStatus) {
      case "confirmed":
        return notifyRideConfirmed({ ride, actorRole });
      case "driver_on_the_way":
        return notifyDriverOnTheWay({ ride });
      case "driver_arrived":
        return notifyDriverArrived({ ride });
      case "pickup_confirmed":
      case "in_progress":
        return notifyRideStarted({ ride });
      case "completed":
        return notifyRideCompleted({ ride });
      case "cancelled_by_user":
      case "cancelled_by_driver":
      case "cancelled_by_admin":
        return notifyRideCancelled({
          ride,
          cancelledByRole:
            toStatus === "cancelled_by_user"
              ? "passenger"
              : toStatus === "cancelled_by_driver"
                ? "driver"
                : "admin",
        });
      case "disputed":
        return notifyRideDisputed({ ride });
      default:
        return null;
    }
  } catch (error) {
    // Ride transitions must never fail because a notification could not be
    // built — the ride itself already succeeded.
    console.error("[notification] ride transition notification failed", error.message);
    return null;
  }
};

export default {
  notifyDriverOfNewRideRequest,
  notifyRideTransition,
};

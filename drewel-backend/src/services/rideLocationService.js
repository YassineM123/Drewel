import Ride, { ACTIVE_RIDE_STATUSES } from "../models/Ride.js";
import { distanceKmBetween } from "../utils/availableDrivers.js";
import { RideTransitionError } from "./rideTransitionService.js";

const lastAcceptedByRide = new Map();

const envInt = (name, fallback, min, max) => {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
};

export const validateDriverLocation = (payload = {}) => {
  const lat = Number(payload.lat);
  const long = Number(payload.long);
  const accuracy = payload.accuracy == null ? null : Number(payload.accuracy);
  const heading = payload.heading == null ? null : Number(payload.heading);
  const speed = payload.speed == null ? null : Number(payload.speed);
  const recordedAt = payload.recordedAt ? new Date(payload.recordedAt) : new Date();
  const maxAccuracy = envInt(
    "RIDE_LOCATION_MAX_ACCURACY_METERS",
    100,
    10,
    1000
  );
  const maxSpeedMps =
    envInt("RIDE_LOCATION_MAX_SPEED_KPH", 220, 30, 400) / 3.6;
  if (
    !Number.isFinite(lat) || lat < -90 || lat > 90 ||
    !Number.isFinite(long) || long < -180 || long > 180 ||
    (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > maxAccuracy)) ||
    (heading !== null && (!Number.isFinite(heading) || heading < 0 || heading > 360)) ||
    (speed !== null && (!Number.isFinite(speed) || speed < 0 || speed > maxSpeedMps)) ||
    Number.isNaN(recordedAt.getTime()) ||
    recordedAt.getTime() > Date.now() + 30000 ||
    recordedAt.getTime() < Date.now() - 300000
  ) {
    throw new RideTransitionError("Invalid driver location", 400, "INVALID_COORDINATES");
  }
  return { lat, long, accuracy, heading, speed, recordedAt };
};

export const updateActiveRideLocation = async ({ rideId, driverId, payload }) => {
  const location = validateDriverLocation(payload);
  const ride = await Ride.findOne({
    _id: rideId,
    driverId,
    status: { $in: ACTIVE_RIDE_STATUSES },
  }).select("_id passengerId driverId status lastDriverLocation");
  if (!ride) {
    throw new RideTransitionError("Active assigned ride not found", 403, "RIDE_LOCATION_FORBIDDEN");
  }
  const previous = lastAcceptedByRide.get(String(ride._id)) || ride.lastDriverLocation;
  const minInterval = envInt("RIDE_LOCATION_MIN_INTERVAL_MS", 3000, 500, 60000);
  if (previous?.recordedAt) {
    const elapsed = location.recordedAt.getTime() - new Date(previous.recordedAt).getTime();
    if (elapsed < minInterval) {
      throw new RideTransitionError("Location updates are too frequent", 429, "LOCATION_THROTTLED");
    }
    if (elapsed > 0 && Number.isFinite(previous.lat) && Number.isFinite(previous.long)) {
      const meters = distanceKmBetween(previous.lat, previous.long, location.lat, location.long) * 1000;
      const inferredMps = meters / (elapsed / 1000);
      const maxInferredMps =
        envInt("RIDE_LOCATION_MAX_SPEED_KPH", 220, 30, 400) / 3.6;
      if (inferredMps > maxInferredMps) {
        throw new RideTransitionError("Impossible location movement rejected", 422, "IMPOSSIBLE_LOCATION");
      }
    }
  }
  const updated = await Ride.findOneAndUpdate(
    { _id: ride._id, driverId, status: { $in: ACTIVE_RIDE_STATUSES } },
    { $set: { lastDriverLocation: location } },
    { new: true }
  ).select("_id passengerId driverId status lastDriverLocation");
  if (!updated) {
    throw new RideTransitionError("Ride location state changed", 409, "RIDE_STATE_CONFLICT");
  }
  lastAcceptedByRide.set(String(ride._id), location);
  return updated;
};

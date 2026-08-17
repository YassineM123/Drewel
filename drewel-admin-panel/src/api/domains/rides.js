import apiClient from "../client";
import { buildListParams, compactParams, toPagination } from "../query";

const encode = (value) => encodeURIComponent(value);

/**
 * Ride operations — GET /api/admin/rides (paginated) and per-ride actions.
 */
export const getRides = async (params, signal) => {
  const data = await apiClient.get("/admin/rides", {
    params: compactParams(buildListParams(params)),
    signal,
  });
  return { rides: data.rides || [], pagination: toPagination(data) };
};

/** Ride detail with audit trail + points transaction — GET /api/admin/rides/:rideId */
export const getRideDetail = async (rideId, signal) => {
  const data = await apiClient.get(`/admin/rides/${encode(rideId)}`, { signal });
  return data.ride || data;
};

const rideAction = (rideId, action, payload, idempotencyKey, signal) =>
  apiClient.post(
    `/admin/rides/${encode(rideId)}/${action}`,
    { ...payload, idempotencyKey },
    {
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );

export const cancelRide = (rideId, payload, idempotencyKey, signal) =>
  rideAction(rideId, "cancel", payload, idempotencyKey, signal);

export const openDispute = (rideId, payload, idempotencyKey, signal) =>
  rideAction(rideId, "dispute", payload, idempotencyKey, signal);

export const resolveRideDispute = (rideId, payload, idempotencyKey, signal) =>
  rideAction(rideId, "dispute/resolve", payload, idempotencyKey, signal);

export const markTechnicalFailure = (rideId, payload, idempotencyKey, signal) =>
  rideAction(rideId, "failure", payload, idempotencyKey, signal);

export const unlockRide = (rideId, payload, idempotencyKey, signal) =>
  rideAction(rideId, "unlock", payload, idempotencyKey, signal);

export const refundRidePoints = (rideId, payload, idempotencyKey, signal) =>
  rideAction(rideId, "refund-points", payload, idempotencyKey, signal);

export const addRideNote = (rideId, payload, idempotencyKey, signal) =>
  rideAction(rideId, "note", payload, idempotencyKey, signal);

/** Client-side idempotency key generator for safe retries of ride actions. */
export const createRideActionKey = (action) => {
  const random =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `admin-ride-${action}-${random}`;
};

export const ridesErrorMessage = (error, fallback = "Unable to load rides.") =>
  error?.response?.data?.message || error?.message || fallback;
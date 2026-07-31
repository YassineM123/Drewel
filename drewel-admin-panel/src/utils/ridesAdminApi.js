import { API_URL, apiClient } from "./api";

const compact = (values = {}) =>
  Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== "" && value != null),
  );

const request = async (config) => {
  const response = await apiClient.request(config);
  return response.data;
};

export const listAdminRides = (params, signal) =>
  request({
    method: "GET",
    url: `${API_URL}/admin/rides`,
    params: compact(params),
    signal,
  });

export const getAdminRide = (rideId, signal) =>
  request({
    method: "GET",
    url: `${API_URL}/admin/rides/${encodeURIComponent(rideId)}`,
    signal,
  });

const rideAction = (rideId, action, payload, idempotencyKey) =>
  request({
    method: "POST",
    url: `${API_URL}/admin/rides/${encodeURIComponent(rideId)}/${action}`,
    data: { ...payload, idempotencyKey },
    headers: { "Idempotency-Key": idempotencyKey },
  });

export const cancelAdminRide = (rideId, payload, key) =>
  rideAction(rideId, "cancel", payload, key);

export const resolveRideDispute = (rideId, payload, key) =>
  rideAction(rideId, "dispute/resolve", payload, key);

export const unlockRideParticipants = (rideId, payload, key) =>
  rideAction(rideId, "unlock", payload, key);

export const refundRidePoints = (rideId, payload, key) =>
  rideAction(rideId, "refund-points", payload, key);

export const createRideActionKey = (action) => {
  const random =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `admin-ride-${action}-${random}`;
};

export const rideApiError = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

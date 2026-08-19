import apiClient from "../client";
import { buildListParams, compactParams, toPagination } from "../query";

const encode = (value: string) => encodeURIComponent(value);

export const getRides = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/rides", {
    params: compactParams(buildListParams(params)),
    signal,
  });
  return { rides: data.rides || [], pagination: toPagination(data) };
};

export const getRideDetail = async (rideId: string, signal?: AbortSignal) => {
  const data = await apiClient.get(`/admin/rides/${encode(rideId)}`, { signal });
  return data.ride || data;
};

const rideAction = (rideId: string, action: string, payload: Record<string, unknown>, idempotencyKey: string, signal?: AbortSignal) =>
  apiClient.post(
    `/admin/rides/${encode(rideId)}/${action}`,
    { ...payload, idempotencyKey },
    {
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );

export const cancelRide = (rideId: string, payload: Record<string, unknown>, idempotencyKey: string, signal?: AbortSignal) =>
  rideAction(rideId, "cancel", payload, idempotencyKey, signal);

export const openDispute = (rideId: string, payload: Record<string, unknown>, idempotencyKey: string, signal?: AbortSignal) =>
  rideAction(rideId, "dispute", payload, idempotencyKey, signal);

export const resolveRideDispute = (rideId: string, payload: Record<string, unknown>, idempotencyKey: string, signal?: AbortSignal) =>
  rideAction(rideId, "dispute/resolve", payload, idempotencyKey, signal);

export const markTechnicalFailure = (rideId: string, payload: Record<string, unknown>, idempotencyKey: string, signal?: AbortSignal) =>
  rideAction(rideId, "failure", payload, idempotencyKey, signal);

export const unlockRide = (rideId: string, payload: Record<string, unknown>, idempotencyKey: string, signal?: AbortSignal) =>
  rideAction(rideId, "unlock", payload, idempotencyKey, signal);

export const refundRidePoints = (rideId: string, payload: Record<string, unknown>, idempotencyKey: string, signal?: AbortSignal) =>
  rideAction(rideId, "refund-points", payload, idempotencyKey, signal);

export const addRideNote = (rideId: string, payload: Record<string, unknown>, idempotencyKey: string, signal?: AbortSignal) =>
  rideAction(rideId, "note", payload, idempotencyKey, signal);

export const createRideActionKey = (action: string): string => {
  const random =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `admin-ride-${action}-${random}`;
};

export const ridesErrorMessage = (error: unknown, fallback = "Unable to load rides."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

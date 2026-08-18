import apiClient from "../client";
import { compactParams, dateRangeParams, toPagination } from "../query";

/**
 * Secure-call metadata — GET /api/admin/secure-calls
 * Backend returns CallLog metadata (call id, ride id, participants, timing,
 * duration, status, failure reason, provider reference). Recording status is
 * surfaced only as a boolean — recording URLs are never projected.
 */
export const getSecureCalls = async (params, signal) => {
  const data = await apiClient.get("/admin/secure-calls", {
    params: compactParams({
      page: params?.page,
      limit: params?.limit,
      rideId: params?.rideId,
      status: params?.status,
      ...dateRangeParams(params),
    }),
    signal,
  });
  return {
    events: data.items || data.events || [],
    summary: data.summary || {},
    pagination: toPagination(data),
  };
};

export const secureCallsErrorMessage = (error, fallback = "Unable to load secure-call metadata.") =>
  error?.response?.data?.message || error?.message || fallback;
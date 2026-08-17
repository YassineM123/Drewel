import apiClient from "../client";
import { compactParams, dateRangeParams, toPagination } from "../query";

/**
 * Secure-call metadata — GET /api/admin/secure-calls
 * Backend aggregates call-related communication events (contact created,
 * communication denied/blocked, ride reported) from the append-only
 * CommunicationAudit trail.
 */
export const getSecureCalls = async (params, signal) => {
  const data = await apiClient.get("/admin/secure-calls", {
    params: compactParams({
      page: params?.page,
      limit: params?.limit,
      rideId: params?.rideId,
      action: params?.action,
      outcome: params?.outcome,
      ...dateRangeParams(params),
    }),
    signal,
  });
  return {
    events: data.events || data.items || [],
    summary: data.summary || {},
    pagination: toPagination(data),
  };
};

export const secureCallsErrorMessage = (error, fallback = "Unable to load secure-call metadata.") =>
  error?.response?.data?.message || error?.message || fallback;
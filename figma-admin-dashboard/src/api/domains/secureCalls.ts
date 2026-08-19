import apiClient from "../client";
import { compactParams, dateRangeParams, toPagination } from "../query";

export const getSecureCalls = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/secure-calls", {
    params: compactParams({
      page: params?.page,
      limit: params?.limit,
      rideId: params?.rideId,
      status: params?.status,
      ...dateRangeParams(params as never),
    }),
    signal,
  });
  return {
    events: data.items || data.events || [],
    summary: data.summary || {},
    pagination: toPagination(data),
  };
};

export const secureCallsErrorMessage = (error: unknown, fallback = "Unable to load secure-call metadata."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

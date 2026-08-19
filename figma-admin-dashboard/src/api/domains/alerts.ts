import apiClient from "../client";
import { compactParams, toPagination } from "../query";

export const getAlerts = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/alerts", {
    params: compactParams(params),
    signal,
  });
  return {
    alerts: data.alerts || data.items || [],
    summary: data.summary || {},
    pagination: toPagination(data),
  };
};

export const alertsErrorMessage = (error: unknown, fallback = "Unable to load alerts."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

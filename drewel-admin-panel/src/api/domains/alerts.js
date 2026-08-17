import apiClient from "../client";
import { compactParams, toPagination } from "../query";

/**
 * Alerts — GET /api/admin/alerts
 * Backend derives operational queues (stuck rides, disputes, pending
 * approvals, low-balance drivers, support reports) from live counters.
 */
export const getAlerts = async (params, signal) => {
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

export const alertsErrorMessage = (error, fallback = "Unable to load alerts.") =>
  error?.response?.data?.message || error?.message || fallback;
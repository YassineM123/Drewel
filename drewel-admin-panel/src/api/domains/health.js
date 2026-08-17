import apiClient from "../client";

/**
 * System health — GET /api/admin/health
 * Backend reports API/database/socket/notifications/storage status plus
 * latency, mirroring the health object embedded in the dashboard.
 */
export const getSystemHealth = async (signal) => {
  const data = await apiClient.get("/admin/health", { signal });
  return data.health || data;
};

export const healthErrorMessage = (error, fallback = "Unable to load system health.") =>
  error?.response?.data?.message || error?.message || fallback;
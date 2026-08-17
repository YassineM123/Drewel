import apiClient from "../client";

/**
 * Dashboard metrics — GET /api/admin/dashboard
 * The backend returns `{ success, message, dashBoardData }` plus recent
 * reservations and an embedded health object.
 */
export const getDashboard = async (params, signal) => {
  const data = await apiClient.get("/admin/dashboard", { params, signal });
  const dashBoardData = data.dashBoardData || data.data || {};
  return {
    ...dashBoardData,
    health: dashBoardData.health || {},
    recentReservations: dashBoardData.recentReservations || [],
  };
};

/**
 * Dashboard KPI + queue snapshot used by the alerts page. Reuses the same
 * backend endpoint so counts are always consistent with the dashboard.
 */
export const getDashboardQueue = async (signal) => getDashboard({}, signal);
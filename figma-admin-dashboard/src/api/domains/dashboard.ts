import apiClient from "../client";

export const getDashboard = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/dashboard", { params, signal });
  const dashBoardData = data.dashBoardData || data.data || {};
  return {
    ...dashBoardData,
    health: dashBoardData.health || {},
    recentReservations: dashBoardData.recentReservations || [],
  };
};

export const getDashboardQueue = async (signal?: AbortSignal) => getDashboard({}, signal);

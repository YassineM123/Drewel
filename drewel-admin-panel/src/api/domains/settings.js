import apiClient from "../client";

/**
 * Settings — points runtime settings + legal content.
 */

/** Points settings — GET /api/admin/points/settings (points.read) */
export const getPointSettings = async (signal) => {
  const data = await apiClient.get("/admin/points/settings", { signal });
  return data.settings || data;
};

/** Update points settings — PATCH /api/admin/points/settings (owner only) */
export const updatePointSettings = async (payload, signal) => {
  const data = await apiClient.patch(
    "/admin/points/settings",
    { ...payload, confirmation: true },
    { signal },
  );
  return data.settings || data;
};

/** Legal content (privacy/terms) — GET /api/account/legal/:type */
export const getLegalContent = async (type, signal) => {
  const data = await apiClient.get(`/account/legal/${encodeURIComponent(type)}`, { signal });
  return data.legal || data;
};

/** Admin account settings surface — /api/admin/settings (extended contract). */
export const getAdminSettings = async (signal) => {
  const data = await apiClient.get("/admin/settings", { signal });
  return data.settings || data;
};

export const settingsErrorMessage = (error, fallback = "Unable to load settings.") =>
  error?.response?.data?.message || error?.message || fallback;
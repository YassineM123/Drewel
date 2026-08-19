import apiClient from "../client";
import { buildListParams, compactParams, toPagination } from "../query";

/**
 * Drivers — GET /api/admin/drivers (review list, paginated + filterable)
 */
export const getDrivers = async (params, signal) => {
  const data = await apiClient.get("/admin/drivers", {
    params: compactParams(buildListParams(params)),
    signal,
  });
  return { drivers: data.drivers || [], pagination: toPagination(data) };
};

/** Driver detail for review — GET /api/admin/driver/:id */
export const getDriverDetail = async (driverId, signal) => {
  const data = await apiClient.get(`/admin/driver/${encodeURIComponent(driverId)}`, { signal });
  return data.driver || data;
};

/**
 * Online drivers — GET /api/admin/drivers/online
 * Presence/lease based, no pagination (the driver map renders live).
 */
export const getOnlineDrivers = async (signal) => {
  const data = await apiClient.get("/admin/drivers/online", { signal });
  return data.drivers || [];
};

/** Drivers with a live location — GET /api/admin/drivers/location */
export const getDriversWithLocation = async (signal) => {
  const data = await apiClient.get("/admin/drivers/location", { signal });
  return data.drivers || [];
};

/**
 * Driver review status — PUT /api/admin/driver/:id/status
 * The backend transition service persists a RequestAudit for every change.
 */
export const updateDriverStatus = async (driverId, payload, signal) => {
  const data = await apiClient.put(
    `/admin/driver/${encodeURIComponent(driverId)}/status`,
    payload,
    { signal },
  );
  return data.driver || data;
};

/**
 * Suspend / restore — POST /api/admin/driver/:id/suspend | :id/restore
 * Owner/Finance-Admin only, confirmed by the caller, written to RequestAudit.
 */
export const updateDriverRestriction = async (driverId, action, payload, signal) => {
  const data = await apiClient.post(
    `/admin/driver/${encodeURIComponent(driverId)}/${action}`,
    { ...payload, confirmation: true },
    { signal },
  );
  return data.driver || data;
};

/** Driver add (admin-created fully-approved driver) — POST /api/driver/addDriver */
export const addDriver = async (formData, signal) => {
  const data = await apiClient.post("/driver/addDriver", formData, {
    signal,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.driver || data;
};

export const driversErrorMessage = (error, fallback = "Unable to load drivers.") =>
  error?.response?.data?.message || error?.message || fallback;

/**
 * Driver rankings — GET /api/driver-profile/rankings
 * Monthly leaderboard with weighted rating, trips, and ranking score.
 */
export const getDriverRankings = async (params, signal) => {
  const data = await apiClient.get("/driver-profile/rankings", {
    params: compactParams(params),
    signal,
  });
  return {
    drivers: data.drivers || [],
    pagination: toPagination(data),
  };
};
import apiClient from "../client";
import { buildListParams, compactParams, dateRangeParams, toPagination } from "../query";

/**
 * Driver points — read overview/wallets under /api/admin/points (points.read).
 */
export const getPointsOverview = async (params, signal) => {
  const data = await apiClient.get("/admin/points/overview", {
    params: compactParams({ ...dateRangeParams(params), ...(params?.filters || {}) }),
    signal,
  });
  return data.overview || data;
};

export const getDriverWallets = async (params, signal) => {
  const data = await apiClient.get("/admin/points/drivers", {
    params: compactParams(buildListParams(params)),
    signal,
  });
  return { drivers: data.drivers || [], pagination: toPagination(data) };
};

export const getDriverWallet = async (driverId, signal) => {
  const data = await apiClient.get(`/admin/points/drivers/${encodeURIComponent(driverId)}`, { signal });
  return data;
};

/**
 * Point transactions — GET /api/admin/points/transactions (paginated).
 */
export const getPointTransactions = async (params, signal) => {
  const data = await apiClient.get("/admin/points/transactions", {
    params: compactParams({
      ...buildListParams(params),
      ...dateRangeParams(params),
    }),
    signal,
  });
  return { transactions: data.transactions || [], pagination: toPagination(data) };
};

/** Point packs (owner-only surface) — GET /api/admin/points/packs */
export const getPointPacks = async (signal) => {
  const data = await apiClient.get("/admin/points/packs", { signal });
  return data.packs || [];
};

export const pointsErrorMessage = (error, fallback = "Unable to load points data.") =>
  error?.response?.data?.message || error?.message || fallback;

export const createIdempotencyKey = (prefix = "points") => {
  const random =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
};
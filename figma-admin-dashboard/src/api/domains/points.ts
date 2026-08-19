import apiClient from "../client";
import { buildListParams, compactParams, dateRangeParams, toPagination } from "../query";

export const getPointsOverview = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/points/overview", {
    params: compactParams({ ...dateRangeParams(params as never), ...(params?.filters || {}) as Record<string, unknown> }),
    signal,
  });
  return data.overview || data;
};

export const getDriverWallets = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/points/drivers", {
    params: compactParams(buildListParams(params)),
    signal,
  });
  return { drivers: data.drivers || [], pagination: toPagination(data) };
};

export const getDriverWallet = async (driverId: string, signal?: AbortSignal) => {
  const data = await apiClient.get(`/admin/points/drivers/${encodeURIComponent(driverId)}`, { signal });
  return data;
};

export const getPointTransactions = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/points/transactions", {
    params: compactParams({
      ...buildListParams(params),
      ...dateRangeParams(params as never),
    }),
    signal,
  });
  return { transactions: data.transactions || [], pagination: toPagination(data) };
};

export const getPointPacks = async (signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/points/packs", { signal });
  return data.packs || [];
};

export const pointsErrorMessage = (error: unknown, fallback = "Unable to load points data."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

export const createIdempotencyKey = (prefix = "points"): string => {
  const random =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
};

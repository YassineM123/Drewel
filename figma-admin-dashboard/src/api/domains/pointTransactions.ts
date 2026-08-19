import apiClient from "../client";
import { compactParams, dateRangeParams, toPagination } from "../query";

export const getTransactions = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/points/transactions", {
    params: compactParams({
      page: params?.page,
      limit: params?.limit,
      driverId: params?.driverId,
      type: params?.type,
      status: params?.status,
      ...dateRangeParams(params as never),
      ...(params?.filters || {}) as Record<string, unknown>,
    }),
    signal,
  });
  return { transactions: data.transactions || [], pagination: toPagination(data) };
};

export const transactionsErrorMessage = (error: unknown, fallback = "Unable to load transactions."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

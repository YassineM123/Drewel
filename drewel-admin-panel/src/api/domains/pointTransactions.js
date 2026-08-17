import apiClient from "../client";
import { compactParams, dateRangeParams, toPagination } from "../query";

/**
 * Point transactions feed — GET /api/admin/points/transactions
 * A dedicated module keeps transaction lists (used on Dashboard + Points
 * pages) consistent with the points domain.
 */
export const getTransactions = async (params, signal) => {
  const data = await apiClient.get("/admin/points/transactions", {
    params: compactParams({
      page: params?.page,
      limit: params?.limit,
      driverId: params?.driverId,
      type: params?.type,
      status: params?.status,
      ...dateRangeParams(params),
      ...(params?.filters || {}),
    }),
    signal,
  });
  return { transactions: data.transactions || [], pagination: toPagination(data) };
};

export const transactionsErrorMessage = (error, fallback = "Unable to load transactions.") =>
  error?.response?.data?.message || error?.message || fallback;
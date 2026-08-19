import apiClient from "../client";
import { buildListParams, compactParams, toPagination } from "../query";

export const getPurchaseRequests = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/points/purchase-requests", {
    params: compactParams(buildListParams(params)),
    signal,
  });
  return { requests: data.requests || [], pagination: toPagination(data) };
};

export const transitionPurchaseRequest = async (requestId: string, payload: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.patch(
    `/admin/points/purchase-requests/${encodeURIComponent(requestId)}`,
    { ...payload, confirmation: true },
    { signal },
  );
  return data.request || data;
};

export const creditPurchaseRequest = async (requestId: string, payload: Record<string, unknown>, idempotencyKey: string, signal?: AbortSignal) => {
  const data = await apiClient.post(
    `/admin/points/purchase-requests/${encodeURIComponent(requestId)}/credit`,
    { ...payload, confirmation: true },
    {
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
    },
  );
  return data;
};

export const purchaseRequestsErrorMessage = (error: unknown, fallback = "Unable to load point purchase requests."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

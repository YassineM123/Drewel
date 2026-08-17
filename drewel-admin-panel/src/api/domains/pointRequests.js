import apiClient from "../client";
import { buildListParams, compactParams, toPagination } from "../query";

/**
 * Point purchase requests — /api/admin/points/purchase-requests
 * (requires points.purchase_requests.manage).
 */
export const getPurchaseRequests = async (params, signal) => {
  const data = await apiClient.get("/admin/points/purchase-requests", {
    params: compactParams(buildListParams(params)),
    signal,
  });
  return { requests: data.requests || [], pagination: toPagination(data) };
};

/** Transitions a purchase request (confirm/verified/rejected...) — PATCH */
export const transitionPurchaseRequest = async (requestId, payload, signal) => {
  const data = await apiClient.patch(
    `/admin/points/purchase-requests/${encodeURIComponent(requestId)}`,
    { ...payload, confirmation: true },
    { signal },
  );
  return data.request || data;
};

/** Credits a verified purchase request into the wallet — POST (idempotent). */
export const creditPurchaseRequest = async (requestId, payload, idempotencyKey, signal) => {
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

export const purchaseRequestsErrorMessage = (error, fallback = "Unable to load point purchase requests.") =>
  error?.response?.data?.message || error?.message || fallback;
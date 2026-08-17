import apiClient from "../client";
import { buildListParams, compactParams, toPagination } from "../query";

/**
 * Verification requests — GET /api/admin/requests (paginated, stage-aware)
 */
export const getRequests = async (params, signal) => {
  const data = await apiClient.get("/admin/requests", {
    params: compactParams(buildListParams(params)),
    signal,
  });
  return {
    requests: data.requests || [],
    requestStage: data.requestStage,
    kpis: data.kpis,
    filterOptions: data.filterOptions,
    pagination: toPagination(data),
  };
};

/** Request details — GET /api/admin/requests/:id */
export const getRequestDetails = async (requestId, signal) => {
  const data = await apiClient.get(`/admin/requests/${encodeURIComponent(requestId)}`, { signal });
  return data.request || data.data || data;
};

/** Request history — GET /api/admin/requests/:id/history */
export const getRequestHistory = async (requestId, stage, signal) => {
  const data = await apiClient.get(
    `/admin/requests/${encodeURIComponent(requestId)}/history`,
    { params: stage ? { stage } : undefined, signal },
  );
  return data.history || data;
};

/** Approve a verification request (basic stage) — PATCH /admin/requests/:id/approve */
export const approveRequest = async (requestId, payload = {}, signal) => {
  const data = await apiClient.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/approve`,
    payload,
    { signal },
  );
  return data.driver || data;
};

/** Reopen a rejected request — PATCH /admin/requests/:id/reopen */
export const reopenRequest = async (requestId, reason, signal) => {
  const data = await apiClient.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/reopen`,
    { confirmed: true, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
    { signal },
  );
  return data.driver || data;
};

/** Profile-stage approve/reject/reopen — PATCH /admin/requests/:id/profile/* */
export const approveProfileRequest = async (requestId, signal) => {
  const data = await apiClient.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/profile/approve`,
    {},
    { signal },
  );
  return data.driver || data;
};

export const rejectProfileRequest = async (requestId, reason, signal) => {
  const data = await apiClient.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/profile/reject`,
    { reason: String(reason || "").trim() },
    { signal },
  );
  return data.driver || data;
};

export const reopenProfileRequest = async (requestId, reason, signal) => {
  const data = await apiClient.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/profile/reopen`,
    { confirmed: true, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
    { signal },
  );
  return data.driver || data;
};

export const requestsErrorMessage = (error, fallback = "Unable to load requests.") =>
  error?.response?.data?.message || error?.message || fallback;
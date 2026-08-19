import apiClient from "../client";
import { buildListParams, compactParams, toPagination } from "../query";

export const getRequests = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
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

export const getRequestDetails = async (requestId: string, signal?: AbortSignal) => {
  const data = await apiClient.get(`/admin/requests/${encodeURIComponent(requestId)}`, { signal });
  return data.request || data.data || data;
};

export const getRequestHistory = async (requestId: string, stage?: string, signal?: AbortSignal) => {
  const data = await apiClient.get(
    `/admin/requests/${encodeURIComponent(requestId)}/history`,
    { params: stage ? { stage } : undefined, signal },
  );
  return data.history || data;
};

export const approveRequest = async (requestId: string, payload: Record<string, unknown> = {}, signal?: AbortSignal) => {
  const data = await apiClient.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/approve`,
    payload,
    { signal },
  );
  return data.driver || data;
};

export const reopenRequest = async (requestId: string, reason?: string, signal?: AbortSignal) => {
  const data = await apiClient.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/reopen`,
    { confirmed: true, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
    { signal },
  );
  return data.driver || data;
};

export const approveProfileRequest = async (requestId: string, signal?: AbortSignal) => {
  const data = await apiClient.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/profile/approve`,
    {},
    { signal },
  );
  return data.driver || data;
};

export const rejectProfileRequest = async (requestId: string, reason?: string, signal?: AbortSignal) => {
  const data = await apiClient.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/profile/reject`,
    { reason: String(reason || "").trim() },
    { signal },
  );
  return data.driver || data;
};

export const reopenProfileRequest = async (requestId: string, reason?: string, signal?: AbortSignal) => {
  const data = await apiClient.patch(
    `/admin/requests/${encodeURIComponent(requestId)}/profile/reopen`,
    { confirmed: true, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
    { signal },
  );
  return data.driver || data;
};

export const requestsErrorMessage = (error: unknown, fallback = "Unable to load requests."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

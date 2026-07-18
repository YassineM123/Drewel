import { API_URL, apiClient } from "./api";
import { isTrustedApiAssetUrl, normalizeAssetUrl } from "./media";

const requestUrl = `${API_URL}/admin/requests`;

export const getRequests = async (params, signal) => {
  const response = await apiClient.get(requestUrl, { params, signal });
  return response.data;
};

export const getRequestDetails = async (requestId) => {
  const response = await apiClient.get(`${requestUrl}/${requestId}`);
  return response.data;
};

export const getRequestHistory = async (requestId, stage) => {
  const response = await apiClient.get(`${requestUrl}/${requestId}/history`, {
    params: stage ? { stage } : undefined,
  });
  return response.data;
};

export const approveRequest = async (requestId) => {
  const response = await apiClient.patch(`${requestUrl}/${requestId}/approve`);
  return response.data;
};

export const reopenRequest = async (requestId) => {
  const response = await apiClient.patch(`${requestUrl}/${requestId}/reopen`, { confirmed: true });
  return response.data;
};

export const approveProfileRequest = async (requestId) => {
  const response = await apiClient.patch(`${requestUrl}/${requestId}/profile/approve`);
  return response.data;
};

export const rejectProfileRequest = async (requestId, reason = "") => {
  const response = await apiClient.patch(`${requestUrl}/${requestId}/profile/reject`, { reason });
  return response.data;
};

export const reopenProfileRequest = async (requestId, reason = "") => {
  const response = await apiClient.patch(`${requestUrl}/${requestId}/profile/reopen`, {
    confirmed: true,
    ...(reason.trim() ? { reason: reason.trim() } : {}),
  });
  return response.data;
};

export const getProtectedDocumentBlob = async (assetUrl) => {
  const normalizedUrl = normalizeAssetUrl(assetUrl);
  if (!isTrustedApiAssetUrl(normalizedUrl)) {
    const error = new Error("This document is not hosted by the protected API.");
    error.code = "UNTRUSTED_DOCUMENT_URL";
    throw error;
  }

  const response = await apiClient.get(normalizedUrl, { responseType: "blob" });
  return {
    blob: response.data,
    contentType: response.headers?.["content-type"] || response.data?.type || "application/octet-stream",
  };
};

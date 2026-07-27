import { API_URL, apiClient } from "./api";
import { isTrustedApiAssetUrl, normalizeAssetUrl } from "./media";

const requestUrl = `${API_URL}/admin/requests`;

const fallbackMessageForStatus = (status) => {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to open this document.";
  if (status === 404) return "The document file could not be found.";
  if (status === 409) return "This legacy document cannot be opened from its current storage location.";
  if (status === 503) return "Document storage is temporarily unavailable. Please try again later.";
  return "The document could not be opened.";
};

export const getDocumentErrorMessage = async (error) => {
  const status = error?.response?.status;
  const payload = error?.response?.data;

  if (payload && typeof payload === "object" && !(payload instanceof Blob)) {
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
  }

  if (payload instanceof Blob) {
    try {
      const text = (await payload.text()).trim();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed?.message === "string" && parsed.message.trim()) {
            return parsed.message.trim();
          }
        } catch {
          // Only show short plain-text API responses. HTML proxy responses are
          // intentionally replaced with the status-specific safe fallback.
          if (!/<(?:!doctype|html|body)\b/i.test(text) && text.length <= 300) {
            return text;
          }
        }
      }
    } catch {
      // Fall through to the status-specific message.
    }
  }

  if (!error?.response && typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  return fallbackMessageForStatus(status);
};

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

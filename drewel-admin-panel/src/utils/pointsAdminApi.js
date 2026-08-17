import { API_URL, apiClient } from "./api";

const compactParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );

const request = async (config) => {
  const response = await apiClient.request(config);
  return response.data;
};

export const getPointsOverview = (params, signal) =>
  request({
    method: "GET",
    url: `${API_URL}/admin/points/overview`,
    params: compactParams(params),
    signal,
  });

export const getDriverWallets = (params, signal) =>
  request({
    method: "GET",
    url: `${API_URL}/admin/points/drivers`,
    params: compactParams(params),
    signal,
  });

export const getDriverWallet = (driverId, signal) =>
  request({
    method: "GET",
    url: `${API_URL}/admin/points/drivers/${encodeURIComponent(driverId)}`,
    signal,
  });

export const getPointTransactions = (params, signal) =>
  request({
    method: "GET",
    url: `${API_URL}/admin/points/transactions`,
    params: compactParams(params),
    signal,
  });

export const getPointsAdminAudits = (params, signal) =>
  request({
    method: "GET",
    url: `${API_URL}/admin/points/audits`,
    params: compactParams(params),
    signal,
  });

export const getPurchaseRequests = (params, signal) =>
  request({
    method: "GET",
    url: `${API_URL}/admin/points/purchase-requests`,
    params: compactParams(params),
    signal,
  });

export const transitionPurchaseRequest = (requestId, payload) =>
  request({
    method: "PATCH",
    url: `${API_URL}/admin/points/purchase-requests/${encodeURIComponent(requestId)}`,
    data: { ...payload, confirmation: true },
  });

export const creditPurchaseRequest = (requestId, payload, idempotencyKey) =>
  request({
    method: "POST",
    url: `${API_URL}/admin/points/purchase-requests/${encodeURIComponent(requestId)}/credit`,
    data: { ...payload, confirmation: true },
    headers: { "Idempotency-Key": idempotencyKey },
  });

export const adjustDriverPoints = (
  kind,
  payload,
  idempotencyKey,
) => {
  if (!["credit", "debit"].includes(kind)) {
    throw new TypeError("Point adjustment kind must be credit or debit.");
  }
  const safePayload = { ...payload };
  delete safePayload.newBalance;
  return request({
    method: "POST",
    url: `${API_URL}/admin/points/${kind}`,
    data: { ...safePayload, confirmation: true },
    headers: { "Idempotency-Key": idempotencyKey },
  });
};

export const getPointPacks = (signal) =>
  request({
    method: "GET",
    url: `${API_URL}/admin/points/packs`,
    signal,
  });

export const createPointPack = (payload) =>
  request({
    method: "POST",
    url: `${API_URL}/admin/points/packs`,
    data: { ...payload, confirmation: true },
  });

export const updatePointPack = (packId, payload) =>
  request({
    method: "PATCH",
    url: `${API_URL}/admin/points/packs/${encodeURIComponent(packId)}`,
    data: { ...payload, confirmation: true },
  });

export const getPointSettings = (signal) =>
  request({
    method: "GET",
    url: `${API_URL}/admin/points/settings`,
    signal,
  });

export const updatePointSettings = (payload) =>
  request({
    method: "PATCH",
    url: `${API_URL}/admin/points/settings`,
    data: { ...payload, confirmation: true },
  });

export const pointsErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

export const createIdempotencyKey = (prefix = "points") => {
  const random =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
};

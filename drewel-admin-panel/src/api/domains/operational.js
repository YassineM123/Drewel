import apiClient from "../client";
import { compactParams, dateRangeParams, toPagination } from "../query";

const OPS = "/admin/ops";

// --- Alerts ---
export const getOperationalAlerts = async (params, signal) => {
  const data = await apiClient.get(`${OPS}/alerts`, {
    params: compactParams({
      page: params?.page,
      limit: params?.limit,
      status: params?.status,
      severity: params?.severity,
      alertType: params?.alertType,
      search: params?.search,
      ...dateRangeParams(params),
    }),
    signal,
  });
  return {
    alerts: data.alerts || [],
    summary: data.summary || {},
    pagination: toPagination(data),
  };
};

export const getOperationalAlert = async (id, signal) => {
  const data = await apiClient.get(`${OPS}/alerts/${id}`, { signal });
  return data.alert;
};

export const acknowledgeAlert = async (id) =>
  apiClient.post(`${OPS}/alerts/${id}/acknowledge`);

export const assignAlert = async (id, adminId, adminName) =>
  apiClient.post(`${OPS}/alerts/${id}/assign`, { adminId, adminName });

export const investigateAlert = async (id) =>
  apiClient.post(`${OPS}/alerts/${id}/investigate`);

export const resolveOperationalAlert = async (id, { note, outcome }) =>
  apiClient.post(`${OPS}/alerts/${id}/resolve`, { note, outcome });

// --- Disputes ---
export const getOperationalDisputes = async (params, signal) => {
  const data = await apiClient.get(`${OPS}/disputes`, {
    params: compactParams({
      page: params?.page,
      limit: params?.limit,
      status: params?.status,
      reason: params?.reason,
      priority: params?.priority,
      rideId: params?.rideId,
      driverId: params?.driverId,
      userId: params?.userId,
      search: params?.search,
      ...dateRangeParams(params),
    }),
    signal,
  });
  return {
    disputes: data.disputes || [],
    summary: data.summary || {},
    pagination: toPagination(data),
  };
};

export const getOperationalDispute = async (id, signal) => {
  const data = await apiClient.get(`${OPS}/disputes/${id}`, { signal });
  return data.dispute;
};

export const createOperationalDispute = async (payload) =>
  apiClient.post(`${OPS}/disputes`, payload);

export const updateDisputeStatus = async (id, status) =>
  apiClient.patch(`${OPS}/disputes/${id}/status`, { status });

export const assignDispute = async (id, adminId, adminName) =>
  apiClient.post(`${OPS}/disputes/${id}/assign`, { adminId, adminName });

export const addDisputeNote = async (id, text, isInternal = true) =>
  apiClient.post(`${OPS}/disputes/${id}/notes`, { text, isInternal });

export const resolveOperationalDispute = async (id, { decision, note, pointsAdjustment }) =>
  apiClient.post(`${OPS}/disputes/${id}/resolve`, { decision, note, pointsAdjustment });

// --- System Health ---
export const getOperationalHealth = async (signal) => {
  const data = await apiClient.get(`${OPS}/health`, { signal });
  return data.health || data;
};

export const getOperationalHealthTrend = async (range, signal) => {
  const data = await apiClient.get(`${OPS}/health/trend`, { params: { range }, signal });
  return data.trend || [];
};

export const createIncident = async (payload) =>
  apiClient.post(`${OPS}/incidents`, payload);

export const updateIncident = async (incidentId, payload) =>
  apiClient.patch(`${OPS}/incidents/${incidentId}`, payload);

// --- Cross-domain Audit Logs ---
export const getOperationalAuditLogs = async (params, signal) => {
  const { types, ...rest } = params || {};
  const query = compactParams({
    page: rest?.page,
    limit: rest?.limit,
    action: rest?.action,
    actorId: rest?.actorId,
    search: rest?.search,
    ...dateRangeParams(rest),
  });
  if (Array.isArray(types) && types.length) query.types = types.join(",");
  else if (typeof types === "string" && types.trim()) query.types = types.trim();

  const data = await apiClient.get(`${OPS}/audit-logs`, { params: query, signal });
  return {
    items: data.items || [],
    sources: data.sources || [],
    pagination: toPagination(data),
  };
};

export const operationalErrorMessage = (error, fallback = "An error occurred.") =>
  error?.response?.data?.message || error?.message || fallback;

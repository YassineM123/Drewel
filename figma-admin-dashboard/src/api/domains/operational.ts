import apiClient from "../client";
import { compactParams, dateRangeParams, toPagination } from "../query";

const OPS = "/admin/ops";

export const getOperationalAlerts = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get(`${OPS}/alerts`, {
    params: compactParams({
      page: params?.page,
      limit: params?.limit,
      status: params?.status,
      severity: params?.severity,
      alertType: params?.alertType,
      search: params?.search,
      ...dateRangeParams(params as never),
    }),
    signal,
  });
  return {
    alerts: data.alerts || [],
    summary: data.summary || {},
    pagination: toPagination(data),
  };
};

export const getOperationalAlert = async (id: string, signal?: AbortSignal) => {
  const data = await apiClient.get(`${OPS}/alerts/${id}`, { signal });
  return data.alert;
};

export const acknowledgeAlert = async (id: string) =>
  apiClient.post(`${OPS}/alerts/${id}/acknowledge`);

export const assignAlert = async (id: string, adminId: string, adminName: string) =>
  apiClient.post(`${OPS}/alerts/${id}/assign`, { adminId, adminName });

export const investigateAlert = async (id: string) =>
  apiClient.post(`${OPS}/alerts/${id}/investigate`);

export const resolveOperationalAlert = async (id: string, { note, outcome }: { note: string; outcome: string }) =>
  apiClient.post(`${OPS}/alerts/${id}/resolve`, { note, outcome });

export const getOperationalDisputes = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
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
      ...dateRangeParams(params as never),
    }),
    signal,
  });
  return {
    disputes: data.disputes || [],
    summary: data.summary || {},
    pagination: toPagination(data),
  };
};

export const getOperationalDispute = async (id: string, signal?: AbortSignal) => {
  const data = await apiClient.get(`${OPS}/disputes/${id}`, { signal });
  return data.dispute;
};

export const createOperationalDispute = async (payload: Record<string, unknown>) =>
  apiClient.post(`${OPS}/disputes`, payload);

export const updateDisputeStatus = async (id: string, status: string) =>
  apiClient.patch(`${OPS}/disputes/${id}/status`, { status });

export const assignDispute = async (id: string, adminId: string, adminName: string) =>
  apiClient.post(`${OPS}/disputes/${id}/assign`, { adminId, adminName });

export const addDisputeNote = async (id: string, text: string, isInternal = true) =>
  apiClient.post(`${OPS}/disputes/${id}/notes`, { text, isInternal });

export const resolveOperationalDispute = async (id: string, { decision, note, pointsAdjustment }: { decision: string; note: string; pointsAdjustment?: number }) =>
  apiClient.post(`${OPS}/disputes/${id}/resolve`, { decision, note, pointsAdjustment });

export const getOperationalHealth = async (signal?: AbortSignal) => {
  const data = await apiClient.get(`${OPS}/health`, { signal });
  return data.health || data;
};

export const createIncident = async (payload: Record<string, unknown>) =>
  apiClient.post(`${OPS}/incidents`, payload);

export const updateIncident = async (incidentId: string, payload: Record<string, unknown>) =>
  apiClient.patch(`${OPS}/incidents/${incidentId}`, payload);

export const getOperationalAuditLogs = async (params?: Record<string, unknown> & { types?: string | string[] }, signal?: AbortSignal) => {
  const { types, ...rest } = params || {};
  const query: Record<string, unknown> = compactParams({
    page: rest.page,
    limit: rest.limit,
    action: rest.action,
    actorId: rest.actorId,
    search: rest.search,
    ...dateRangeParams(rest as never),
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

export const operationalErrorMessage = (error: unknown, fallback = "An error occurred."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

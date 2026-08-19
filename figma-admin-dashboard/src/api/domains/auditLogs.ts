import apiClient from "../client";
import { compactParams, dateRangeParams, toPagination } from "../query";

export const getAuditLogs = async (params?: Record<string, unknown> & { types?: string | string[] }, signal?: AbortSignal) => {
  const { types, ...rest } = params || {};
  const query: Record<string, unknown> = compactParams({
    page: rest.page,
    limit: rest.limit,
    action: rest.action,
    actorId: rest.actorId,
    search: rest.search,
    ...dateRangeParams(rest as never),
    ...(rest.filters || {}) as Record<string, unknown>,
  });
  if (Array.isArray(types) && types.length) query.types = types.join(",");
  else if (typeof types === "string" && types.trim()) query.types = types.trim();

  const data = await apiClient.get("/admin/audit-logs", {
    params: query,
    signal,
  });
  return {
    items: data.items || data.logs || [],
    domains: data.domains || {},
    pagination: toPagination(data),
  };
};

export const getPointsAdminAudits = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/points/audits", {
    params: compactParams({
      page: params?.page,
      limit: params?.limit,
      driverId: params?.driverId,
      adminId: params?.adminId,
      purchaseRequestId: params?.purchaseRequestId,
      action: params?.action,
      ...dateRangeParams(params as never),
    }),
    signal,
  });
  return { audits: data.audits || [], pagination: toPagination(data) };
};

export const auditLogsErrorMessage = (error: unknown, fallback = "Unable to load audit logs."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

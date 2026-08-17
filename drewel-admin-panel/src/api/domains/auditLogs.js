import apiClient from "../client";
import { compactParams, dateRangeParams, toPagination } from "../query";

/**
 * Cross-domain audit logs — GET /api/admin/audit-logs
 * Backend unions the append-only points / request / ride / communication audit
 * trails into one normalized, paginated feed.
 */
export const getAuditLogs = async (params, signal) => {
  const { types, ...rest } = params || {};
  const query = compactParams({
    page: rest.page,
    limit: rest.limit,
    action: rest.action,
    actorId: rest.actorId,
    search: rest.search,
    ...dateRangeParams(rest),
    ...(rest.filters || {}),
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

/** Points-admin-only audit trail — GET /api/admin/points/audits */
export const getPointsAdminAudits = async (params, signal) => {
  const data = await apiClient.get("/admin/points/audits", {
    params: compactParams({
      page: params?.page,
      limit: params?.limit,
      driverId: params?.driverId,
      adminId: params?.adminId,
      purchaseRequestId: params?.purchaseRequestId,
      action: params?.action,
      ...dateRangeParams(params),
    }),
    signal,
  });
  return { audits: data.audits || [], pagination: toPagination(data) };
};

export const auditLogsErrorMessage = (error, fallback = "Unable to load audit logs.") =>
  error?.response?.data?.message || error?.message || fallback;
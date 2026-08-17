import apiClient from "../client";
import { compactParams, toPagination } from "../query";

/**
 * Roles and permissions — /api/admin/roles, /api/admin/team
 * Backend serves the role catalog, the current admin's effective permissions
 * and the team roster (no credentials ever returned).
 */
export const getRolesCatalog = async (signal) => {
  const data = await apiClient.get("/admin/roles", { signal });
  return {
    roles: data.roles || [],
    permissions: data.permissions || {},
    current: data.current || null,
  };
};

export const getTeam = async (params, signal) => {
  const data = await apiClient.get("/admin/team", {
    params: compactParams(params),
    signal,
  });
  return { admins: data.admins || data.team || [], pagination: toPagination(data) };
};

export const rolesErrorMessage = (error, fallback = "Unable to load roles.") =>
  error?.response?.data?.message || error?.message || fallback;
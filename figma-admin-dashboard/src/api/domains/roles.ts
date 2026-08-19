import apiClient from "../client";
import { compactParams, toPagination } from "../query";

export const getRolesCatalog = async (signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/roles", { signal });
  return {
    roles: data.roles || [],
    permissions: data.permissions || {},
    current: data.current || null,
  };
};

export const getTeam = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/team", {
    params: compactParams(params),
    signal,
  });
  return { admins: data.admins || data.team || [], pagination: toPagination(data) };
};

export const rolesErrorMessage = (error: unknown, fallback = "Unable to load roles."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

import apiClient from "../client";
import { buildListParams, compactParams, toPagination } from "../query";

export const getUsers = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/users/get-all", {
    params: compactParams(buildListParams(params)),
    signal,
  });
  return { users: data.users || [], pagination: toPagination(data) };
};

export const getUserDetail = async (userId: string, signal?: AbortSignal) => {
  const data = await apiClient.get(`/users/get-user-details/${encodeURIComponent(userId)}`, { signal });
  return data.user || data;
};

export const getRestrictedUsers = async (signal?: AbortSignal) => {
  const data = await apiClient.get("/users/restricted", { signal });
  return data.users || [];
};

export const toggleUserRestriction = async (userId: string, signal?: AbortSignal) => {
  const data = await apiClient.post("/users/toggle-restriction", { userId }, { signal });
  return data.user || data;
};

export const deleteUser = async (userId: string, signal?: AbortSignal) => {
  const data = await apiClient.delete(`/users/${encodeURIComponent(userId)}`, { signal });
  return data;
};

export const usersErrorMessage = (error: unknown, fallback = "Unable to load users."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

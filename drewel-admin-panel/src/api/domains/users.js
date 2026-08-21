import apiClient from "../client";
import { buildListParams, compactParams, toPagination } from "../query";

/**
 * Users — GET /api/users/get-all (paginated, admin)
 */
export const getUsers = async (params, signal) => {
  const data = await apiClient.get("/users/get-all", {
    params: compactParams(buildListParams(params)),
    signal,
  });
  return { users: data.users || [], pagination: toPagination(data) };
};

/** User detail — GET /api/users/get-user-details/:id */
export const getUserDetail = async (userId, signal) => {
  const data = await apiClient.get(`/users/get-user-details/${encodeURIComponent(userId)}`, { signal });
  return data.user || data;
};

/** Restricted users — GET /api/users/restricted */
export const getRestrictedUsers = async (signal) => {
  const data = await apiClient.get("/users/restricted", { signal });
  return data.users || [];
};

/** Toggle account restriction — POST /api/users/toggle-restriction */
export const toggleUserRestriction = async (userId, reason, signal) => {
  const data = await apiClient.post("/users/toggle-restriction", { userId, reason }, { signal });
  if (data.success === false) throw new Error(data.message || "Could not update this account.");
  return data.user || data;
};

export const deleteUser = async (userId, signal) => {
  const data = await apiClient.delete(`/users/${encodeURIComponent(userId)}`, { signal });
  return data;
};

export const usersErrorMessage = (error, fallback = "Unable to load users.") =>
  error?.response?.data?.message || error?.message || fallback;
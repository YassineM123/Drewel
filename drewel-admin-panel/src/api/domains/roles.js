import apiClient from "../client";

/**
 * Roles and permissions — /api/admin/roles serves the role catalog, the
 * current admin's effective permissions, and the full team roster together.
 */
export const getRolesCatalog = async (signal) => {
  const data = await apiClient.get("/admin/roles", { signal });
  const permissionPayload = data.permissions;
  return {
    roles: data.roles || [],
    // Older/current servers return a flat capability-name array here, while
    // the Team & Roles page can only render an explicit per-role matrix. Do
    // not reinterpret array indexes as permission labels.
    permissions:
      permissionPayload &&
      typeof permissionPayload === "object" &&
      !Array.isArray(permissionPayload)
        ? permissionPayload
        : {},
    permissionNames: Array.isArray(permissionPayload) ? permissionPayload : [],
    current: data.current || null,
    team: data.team || [],
  };
};

export const createAdmin = async (payload) => {
  const data = await apiClient.post("/admin/register", payload);
  return { success: Boolean(data.success), message: data.message };
};

export const updateAdminRole = async (id, role) => {
  const data = await apiClient.patch(`/admin/team/${id}/role`, { role });
  return data.admin;
};

export const updateAdminStatus = async (id, isActive) => {
  const data = await apiClient.patch(`/admin/team/${id}/status`, { isActive });
  return data.admin;
};

export const resetAdminPassword = async (id, newPassword) => {
  const data = await apiClient.patch(`/admin/team/${id}/password`, { newPassword });
  return { success: Boolean(data.success), message: data.message };
};

export const rolesErrorMessage = (error, fallback = "Unable to load roles.") =>
  error?.response?.data?.message || error?.message || fallback;

const normalize = (value) => String(value || "").trim().toLowerCase();

export const getStoredAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("admin") || "null");
  } catch {
    return null;
  }
};

export const getPointsAccess = (admin = getStoredAdmin()) => {
  const role = normalize(admin?.role);
  const isOwner = role === "owner";
  const isFinanceAdmin = role === "finance_admin";
  return {
    role,
    isOwner,
    isFinanceAdmin,
    canRead: isOwner || isFinanceAdmin,
    canAdjust: isOwner || isFinanceAdmin,
    canManageRequests: isOwner || isFinanceAdmin,
    canManagePacks: isOwner,
    canManageSettings: isOwner,
  };
};

export const canAccessDriverPoints = (admin) =>
  getPointsAccess(admin).canRead;


import { resolvePermissions } from "./permissions";

export const getStoredAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("admin") || "null");
  } catch {
    return null;
  }
};

export const getPointsAccess = (admin = getStoredAdmin()) => {
  const perms = resolvePermissions(admin);
  return {
    role: perms.role,
    isOwner: perms.isOwner,
    isFinanceAdmin: perms.isFinanceAdmin,
    canRead: perms["points.read"],
    canAdjust: perms["points.adjust"],
    canAddPurchasedPoints: perms.isOwner,
    canManageRequests: perms["points.purchase_requests.manage"],
    canManagePacks: perms["points.packs.manage"],
    canManageSettings: perms["points.settings.manage"],
  };
};

export const canAccessDriverPoints = (admin) => getPointsAccess(admin).canRead;

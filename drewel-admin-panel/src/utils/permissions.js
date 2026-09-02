// Generalized permission resolver, mirroring the backend's real role model
// (src/models/Admin.js ADMIN_ROLES + src/middlewares/pointsAuthorization.js).
// Backend `isAdmin` only ever lets "owner" | "finance_admin" | "admin" reach
// the admin panel (support/analyst are rejected at login), so any logged-in
// admin here is one of those three.
const normalize = (value) => String(value || "").trim().toLowerCase();

export const resolvePermissions = (admin) => {
  const role = normalize(admin?.role);
  const isOwner = role === "owner";
  const isFinanceAdmin = role === "finance_admin";
  const isAdmin = role === "owner" || role === "finance_admin" || role === "admin";

  return {
    role,
    isOwner,
    isFinanceAdmin,
    isAdmin,
    // General admin sections: any authenticated admin role.
    "drivers.view": isAdmin,
    "drivers.manage": isAdmin,
    "users.view": isAdmin,
    "users.manage": isAdmin,
    "verification.view": isAdmin,
    "verification.approve": isAdmin,
    "rides.view": isAdmin,
    "rides.manage": isAdmin,
    "chat.view": isAdmin,
    "banners.manage": isAdmin,
    "alerts.view": isAdmin,
    "audit-logs.view": isAdmin,
    "system-health.view": isAdmin,
    "team-roles.view": isAdmin,
    "team-roles.manage": isOwner,
    "settings.view": isAdmin,
    // Points/wallet subsystem: matches src/middlewares/pointsAuthorization.js exactly.
    "points.read": isAdmin,
    "points.adjust": isAdmin,
    "points.purchase_requests.manage": isOwner || isFinanceAdmin,
    "points.packs.manage": isOwner,
    "points.settings.manage": isOwner,
  };
};

export const canAccess = (admin, permission) => Boolean(resolvePermissions(admin)[permission]);

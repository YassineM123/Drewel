import mongoose from "mongoose";
import Admin from "../models/Admin.js";

export const POINTS_PERMISSIONS = Object.freeze({
  READ: "points.read",
  PURCHASE_REQUESTS: "points.purchase_requests.manage",
  ADJUST: "points.adjust",
  SETTINGS: "points.settings.manage",
});

const ALL_POINTS_PERMISSIONS = new Set(Object.values(POINTS_PERMISSIONS));
const FINANCE_DEFAULT_PERMISSIONS = new Set([
  POINTS_PERMISSIONS.READ,
  POINTS_PERMISSIONS.PURCHASE_REQUESTS,
  POINTS_PERMISSIONS.ADJUST,
]);

const normalize = (value) => String(value ?? "").trim().toLowerCase();

const envSet = (name) =>
  new Set(
    String(process.env[name] || "")
      .split(",")
      .map(normalize)
      .filter(Boolean)
  );

const valuesFrom = (...values) =>
  values
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") {
        return Object.entries(value)
          .filter(([, enabled]) => enabled === true)
          .map(([name]) => name);
      }
      return value == null ? [] : [value];
    })
    .map(normalize)
    .filter(Boolean);

const hasIdentityMatch = (admin, prefix) => {
  const ids = envSet(`${prefix}_ADMIN_IDS`);
  const emails = envSet(`${prefix}_ADMIN_EMAILS`);
  return ids.has(normalize(admin?._id)) || emails.has(normalize(admin?.email));
};

const isOwner = (admin) => {
  const classifications = valuesFrom(
    admin?.role,
    admin?.adminRole,
    admin?.adminType,
    admin?.accountType
  );
  return (
    admin?.isOwner === true ||
    classifications.includes("owner") ||
    classifications.includes("super_owner") ||
    classifications.includes("super-owner") ||
    hasIdentityMatch(admin, "DREWEL_OWNER")
  );
};

const isFinanceAdmin = (admin) => {
  const classifications = valuesFrom(
    admin?.role,
    admin?.adminRole,
    admin?.adminType,
    admin?.accountType,
    admin?.departments
  );
  return (
    admin?.isFinanceAdmin === true ||
    classifications.includes("finance") ||
    classifications.includes("finance_admin") ||
    classifications.includes("finance-admin") ||
    hasIdentityMatch(admin, "DREWEL_FINANCE")
  );
};

const explicitPermissions = (admin) =>
  new Set(
    valuesFrom(
      admin?.capabilities,
      admin?.permissions,
      admin?.pointPermissions,
      admin?.pointsPermissions
    )
  );

export const resolvePointsPermissions = (admin) => {
  if (!admin || normalize(admin.role) === "user") return new Set();
  if (isOwner(admin)) return new Set(ALL_POINTS_PERMISSIONS);
  if (!isFinanceAdmin(admin)) return new Set();

  const permissions = explicitPermissions(admin);
  for (const permission of FINANCE_DEFAULT_PERMISSIONS) {
    permissions.add(permission);
  }

  return new Set(
    [...permissions].filter(
      (permission) =>
        ALL_POINTS_PERMISSIONS.has(permission) ||
        permission === "points.*"
    )
  );
};

const deny = (res, status, code, message) =>
  res.status(status).json({ success: false, code, message });

/**
 * Re-loads the administrator from MongoDB for every sensitive request.
 * Admin.collection is intentional: it keeps this compatible with future
 * capability fields before they are added to the current strict schema.
 */
export const requirePointsPermission = (permission) => {
  if (!ALL_POINTS_PERMISSIONS.has(permission)) {
    throw new TypeError(`Unknown points permission: ${permission}`);
  }

  return async function pointsPermissionMiddleware(req, res, next) {
    try {
      const adminId = req.user?._id || req.user?.id || req.user?.sub;
      if (!adminId || !mongoose.isValidObjectId(adminId)) {
        return deny(res, 401, "POINTS_AUTH_REQUIRED", "Authentication required");
      }

      const admin = await Admin.collection.findOne(
        { _id: new mongoose.Types.ObjectId(String(adminId)) },
        {
          projection: {
            password: 0,
            otpCode: 0,
            resetPasswordToken: 0,
            resetPasswordExpires: 0,
          },
        }
      );

      if (!admin || normalize(admin.role) === "user" || admin.isActive === false) {
        return deny(res, 403, "POINTS_ADMIN_FORBIDDEN", "Points permission denied");
      }

      const permissions = resolvePointsPermissions(admin);
      if (!permissions.has(permission) && !permissions.has("points.*")) {
        return deny(res, 403, "POINTS_ADMIN_FORBIDDEN", "Points permission denied");
      }

      req.pointsAdmin = {
        id: admin._id,
        email: admin.email || "",
        fullName: admin.fullName || "",
        role: normalize(admin.role) || "admin",
        isOwner: isOwner(admin),
        isFinanceAdmin: isFinanceAdmin(admin),
        permissions: [...permissions],
      };
      return next();
    } catch (error) {
      console.error("Points authorization failed:", error);
      return deny(
        res,
        500,
        "POINTS_AUTHORIZATION_UNAVAILABLE",
        "Unable to verify points permission"
      );
    }
  };
};

export const requirePointsRead = requirePointsPermission(POINTS_PERMISSIONS.READ);
export const requirePointsPurchaseRequestManagement = requirePointsPermission(
  POINTS_PERMISSIONS.PURCHASE_REQUESTS
);
export const requirePointsAdjustment = requirePointsPermission(
  POINTS_PERMISSIONS.ADJUST
);
export const requirePointsSettingsManagement = requirePointsPermission(
  POINTS_PERMISSIONS.SETTINGS
);

/**
 * Settings and point-pack mutations are deliberately owner-only. Explicit
 * capability grants must not turn a finance or general admin into an owner.
 */
export const requirePointsOwner = [
  requirePointsRead,
  function pointsOwnerMiddleware(req, res, next) {
    if (!req.pointsAdmin?.isOwner) {
      return deny(
        res,
        403,
        "POINTS_OWNER_REQUIRED",
        "Only a Drewel owner may perform this action"
      );
    }
    return next();
  },
];

export const requireRecentAdminAuthentication = ({
  maxAgeSeconds = 15 * 60,
} = {}) =>
  function recentAdminAuthentication(req, res, next) {
    const authenticatedAt = Number(req.user?.auth_time || req.user?.iat);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isFinite(authenticatedAt) ||
      authenticatedAt <= 0 ||
      nowSeconds - authenticatedAt > maxAgeSeconds ||
      authenticatedAt > nowSeconds + 60
    ) {
      return deny(
        res,
        403,
        "ADMIN_REAUTHENTICATION_REQUIRED",
        "Recent administrator authentication required"
      );
    }
    return next();
  };

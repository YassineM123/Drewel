import PointsAdminAudit, {
  POINTS_ADMIN_AUDIT_ACTIONS,
} from "../models/PointsAdminAudit.js";
import {
  PointsValidationError,
  optionalEnum,
  pointsValidationErrorResponse,
  requireObjectId,
} from "../helpers/pointsValidation.js";

const pagination = (req, max = 100) => ({
  page: Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1),
  limit: Math.min(
    max,
    Math.max(1, Number.parseInt(req.query.limit || "25", 10) || 25)
  ),
});

const parseDate = (value, field) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new PointsValidationError(`${field} must be a valid date`);
  }
  return parsed;
};

export const listPointsAdminAudits = async (req, res) => {
  try {
    const { page, limit } = pagination(req);
    const filter = {};
    if (req.query.driverId) {
      filter.driverId = requireObjectId(req.query.driverId, "driverId");
    }
    if (req.query.adminId) {
      filter.adminId = requireObjectId(req.query.adminId, "adminId");
    }
    if (req.query.purchaseRequestId) {
      filter.purchaseRequestId = requireObjectId(
        req.query.purchaseRequestId,
        "purchaseRequestId"
      );
    }
    if (req.query.action) {
      const action = optionalEnum(
        req.query.action,
        POINTS_ADMIN_AUDIT_ACTIONS.map((value) => value.toLowerCase()),
        "action"
      );
      filter.action = action.toUpperCase();
    }
    const from = parseDate(req.query.from, "from");
    const to = parseDate(req.query.to, "to");
    if (from || to) {
      filter.createdAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }
    if (from && to && from > to) {
      throw new PointsValidationError("from must not be later than to");
    }

    const [audits, total] = await Promise.all([
      PointsAdminAudit.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PointsAdminAudit.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      audits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (pointsValidationErrorResponse(error, res)) return;
    return res.status(error.statusCode || error.status || 500).json({
      success: false,
      code: error.code || "POINTS_ADMIN_AUDIT_INTERNAL_ERROR",
      message:
        error.statusCode || error.status ? error.message : "Internal server error",
    });
  }
};

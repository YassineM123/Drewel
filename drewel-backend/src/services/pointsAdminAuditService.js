import crypto from "crypto";
import PointsAdminAudit from "../models/PointsAdminAudit.js";
import {
  maskPaymentReference,
  toSafePointsAuditDetails,
} from "../utils/pointsSensitiveData.js";

const bounded = (value, max) => String(value ?? "").trim().slice(0, max);

export const pointsAuditRequestContext = (req) => ({
  requestId: bounded(
    req.id ||
      req.headers?.["x-request-id"] ||
      req.headers?.["x-correlation-id"] ||
      crypto.randomUUID(),
    200
  ),
  ipAddress: bounded(
    req.ip ||
      req.headers?.["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress,
    100
  ),
  userAgent: bounded(req.get?.("user-agent") || req.headers?.["user-agent"], 500),
});

export const paymentReferenceAuditFields = (paymentReference) => {
  const normalized = bounded(paymentReference, 200);
  if (!normalized) {
    return { paymentReferenceMasked: "", paymentReferenceHash: "" };
  }
  return {
    paymentReferenceMasked: maskPaymentReference(normalized),
    paymentReferenceHash: crypto
      .createHash("sha256")
      .update(normalized)
      .digest("hex"),
  };
};

export const createPointsAdminAuditInSession = async ({
  req,
  action,
  driverId = null,
  previousAvailableBalance = null,
  newAvailableBalance = null,
  pointsChange = 0,
  reason,
  paymentReference = "",
  purchaseRequestId = null,
  pointTransactionId = null,
  pointPackId = null,
  idempotencyKey,
  metadata = {},
  session,
}) => {
  const [audit] = await PointsAdminAudit.create(
    [
      {
        action,
        adminId: req.pointsAdmin.id,
        adminRole:
          req.pointsAdmin.role ||
          (req.pointsAdmin.isOwner
            ? "owner"
            : req.pointsAdmin.isFinanceAdmin
              ? "finance_admin"
              : "authorized_admin"),
        driverId,
        previousAvailableBalance,
        newAvailableBalance,
        pointsChange,
        reason: bounded(reason, 1000),
        ...paymentReferenceAuditFields(paymentReference),
        purchaseRequestId,
        pointTransactionId,
        pointPackId,
        idempotencyKey,
        ...pointsAuditRequestContext(req),
        metadata: toSafePointsAuditDetails(metadata),
      },
    ],
    { session }
  );
  return audit;
};

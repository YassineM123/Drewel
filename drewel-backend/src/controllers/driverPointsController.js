import Driver from "../models/Driver.js";
import DriverPointsWallet from "../models/DriverPointsWallet.js";
import PointTransaction, {
  POINT_TRANSACTION_TYPES,
} from "../models/PointTransaction.js";
import PointPurchaseRequest from "../models/PointPurchaseRequest.js";
import PointPack from "../models/PointPack.js";
import PointsSettings from "../models/PointsSettings.js";
import { resolvePrincipal } from "../services/rideCommunicationPolicy.js";
import {
  ensureWallet,
  grantWelcomeBonus,
  toWalletDto,
} from "../services/pointsWalletService.js";
import {
  PointsValidationError,
  optionalEnum,
  pointsValidationErrorResponse,
  requireBoundedString,
  requireObjectId,
  requirePositiveInteger,
} from "../helpers/pointsValidation.js";

const sendError = (res, error) => {
  if (pointsValidationErrorResponse(error, res)) return;
  return res.status(error.statusCode || error.status || 500).json({
    success: false,
    code: error.code || "POINTS_INTERNAL_ERROR",
    message: error.statusCode || error.status ? error.message : "Internal server error",
  });
};

const requireDriver = async (req) => {
  const principal = await resolvePrincipal(req.user?._id);
  if (principal.role !== "driver") {
    const error = new Error("Driver authentication required");
    error.statusCode = 403;
    error.code = "DRIVER_REQUIRED";
    throw error;
  }
  return principal;
};

export const getMyPointsWallet = async (req, res) => {
  try {
    const principal = await requireDriver(req);
    const driver = await Driver.findById(principal.id);
    const existingWallet = await DriverPointsWallet.findOne({
      driverId: principal.id,
    });
    let wallet = existingWallet;
    if (!wallet?.welcomeBonusGranted) {
      try {
        const bonus = await grantWelcomeBonus(driver, { source: "wallet_access" });
        wallet = bonus.wallet;
      } catch (error) {
        if (error?.code !== "POINTS_TRANSACTION_UNAVAILABLE") {
          throw error;
        }
        console.warn(
          `Serving driver wallet without welcome grant because transactions are unavailable for driver ${principal.id}`
        );
      }
    }
    const settings = await PointsSettings.getEffective();
    wallet ??= await ensureWallet(principal.id);
    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      wallet: toWalletDto(wallet, settings),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const listMyPointTransactions = async (req, res) => {
  try {
    const principal = await requireDriver(req);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || "25", 10) || 25));
    const filter = { driverId: principal.id };
    const type = optionalEnum(
      req.query.type,
      POINT_TRANSACTION_TYPES.map((value) => value.toLowerCase()),
      "type"
    );
    if (type) filter.type = type.toUpperCase();
    if (req.query.before) {
      filter._id = { $lt: requireObjectId(req.query.before, "before") };
    }
    const transactions = await PointTransaction.find(filter)
      .select(
        "type status points bonusPoints purchasedPoints previousAvailableBalance newAvailableBalance previousReservedBalance newReservedBalance offerId rideId purchaseRequestId reason createdAt"
      )
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      transactions,
      pagination: {
        limit,
        nextCursor:
          transactions.length === limit
            ? String(transactions[transactions.length - 1]._id)
            : null,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const createPointPurchaseRequest = async (req, res) => {
  try {
    const principal = await requireDriver(req);
    const clientRequestId = requireBoundedString(
      req.body?.clientRequestId,
      "clientRequestId",
      { min: 8, max: 200, pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]+$/ }
    );
    const existing = await PointPurchaseRequest.findOne({
      driverId: principal.id,
      clientRequestId,
    });
    if (existing) {
      return res.json({ success: true, request: existing, idempotent: true });
    }

    const requestedPackId = req.body?.requestedPackId
      ? requireObjectId(req.body.requestedPackId, "requestedPackId")
      : null;
    const requestedPoints =
      req.body?.requestedPoints === undefined || req.body?.requestedPoints === null
        ? null
        : requirePositiveInteger(req.body.requestedPoints, "requestedPoints");
    if (Boolean(requestedPackId) === Boolean(requestedPoints)) {
      throw new PointsValidationError(
        "Exactly one of requestedPackId or requestedPoints is required"
      );
    }
    let selectedPack = null;
    if (requestedPackId) {
      selectedPack = await PointPack.findOne({ _id: requestedPackId, active: true });
      if (!selectedPack) {
        throw new PointsValidationError("requestedPackId is not an active point pack");
      }
    }
    const driver = await Driver.findById(principal.id)
      .select("phone countryCode whatsappNumber email")
      .lean();
    const request = await PointPurchaseRequest.create({
      driverId: principal.id,
      requestedPackId,
      requestedPoints,
      packSnapshot: selectedPack
        ? {
            name: selectedPack.name,
            points: selectedPack.points,
            price: selectedPack.price,
            currency: selectedPack.currency,
          }
        : undefined,
      clientRequestId,
      status: "pending",
      contactSnapshot: {
        phone: `${driver?.countryCode || ""}${driver?.phone || ""}`,
        whatsappNumber: driver?.whatsappNumber || "",
        email: driver?.email || "",
      },
    });
    return res.status(201).json({ success: true, request, idempotent: false });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await PointPurchaseRequest.findOne({
        driverId: req.user?._id,
        clientRequestId: req.body?.clientRequestId,
      });
      if (existing) {
        return res.json({ success: true, request: existing, idempotent: true });
      }
    }
    return sendError(res, error);
  }
};

export const listMyPointPurchaseRequests = async (req, res) => {
  try {
    const principal = await requireDriver(req);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || "20", 10) || 20));
    const filter = { driverId: principal.id };
    if (req.query.before) filter._id = { $lt: requireObjectId(req.query.before, "before") };
    const requests = await PointPurchaseRequest.find(filter)
      .select(
        "driverId requestedPackId requestedPoints packSnapshot clientRequestId status contactSnapshot contactedAt paymentVerifiedAt creditedAt rejectedAt cancelledAt createdAt updatedAt"
      )
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
    return res.json({
      success: true,
      requests,
      pagination: {
        limit,
        nextCursor:
          requests.length === limit ? String(requests[requests.length - 1]._id) : null,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const listActivePointPacks = async (req, res) => {
  try {
    await requireDriver(req);
    const packs = await PointPack.find({ active: true })
      .select("name points price currency displayOrder")
      .sort({ displayOrder: 1, _id: 1 })
      .lean();
    return res.json({ success: true, packs });
  } catch (error) {
    return sendError(res, error);
  }
};

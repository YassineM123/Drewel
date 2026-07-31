import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import Admin from "../models/Admin.js";
import DriverPointsWallet from "../models/DriverPointsWallet.js";
import PointTransaction, {
  POINT_TRANSACTION_TYPES,
} from "../models/PointTransaction.js";
import PointPurchaseRequest, {
  POINT_PURCHASE_REQUEST_STATUSES,
} from "../models/PointPurchaseRequest.js";
import PointPack from "../models/PointPack.js";
import PointsSettings, {
  GLOBAL_POINTS_SETTINGS_KEY,
} from "../models/PointsSettings.js";
import {
  creditPointsInSession,
  debitPointsInSession,
  ensureWallet,
  queuePointsEvents,
  runPointsTransaction,
  toWalletDto,
} from "../services/pointsWalletService.js";
import {
  PointsValidationError,
  assertIdempotencyPayloadMatches,
  assertNoDirectBalanceMutation,
  hashIdempotencyPayload,
  optionalEnum,
  optionalMoneyAmount,
  pointsValidationErrorResponse,
  requireBoundedString,
  requireExplicitConfirmation,
  requireIdempotencyKey,
  requireObjectId,
  requirePaymentReference,
  requirePositiveInteger,
  sanitizePointsMetadata,
} from "../helpers/pointsValidation.js";
import {
  maskPaymentReference,
  maskPhone,
} from "../utils/pointsSensitiveData.js";
import { createPointsAdminAuditInSession } from "../services/pointsAdminAuditService.js";

const sendError = (res, error) => {
  if (pointsValidationErrorResponse(error, res)) return;
  if (
    error?.code === 11000 &&
    (error?.keyPattern?.paymentReference ||
      error?.keyValue?.paymentReference)
  ) {
    return res.status(409).json({
      success: false,
      code: "DUPLICATE_PAYMENT_REFERENCE",
      message: "Payment reference has already been used",
    });
  }
  return res.status(error.statusCode || error.status || 500).json({
    success: false,
    code: error.code || "POINTS_ADMIN_INTERNAL_ERROR",
    message: error.statusCode || error.status ? error.message : "Internal server error",
  });
};

const pagination = (req, max = 100) => ({
  page: Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1),
  limit: Math.min(max, Math.max(1, Number.parseInt(req.query.limit || "25", 10) || 25)),
});

const dateFilter = (req, field = "createdAt") => {
  const range = {};
  for (const [queryName, operator] of [
    ["from", "$gte"],
    ["to", "$lte"],
  ]) {
    if (!req.query?.[queryName]) continue;
    const value = new Date(String(req.query[queryName]));
    if (Number.isNaN(value.getTime())) {
      throw new PointsValidationError(`${queryName} is invalid`);
    }
    range[operator] = value;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) {
    throw new PointsValidationError("from must not be after to");
  }
  return Object.keys(range).length ? { [field]: range } : {};
};

const driverSummary = (driver) => ({
  id: String(driver._id),
  fullName:
    driver.fullName ||
    [driver.firstName, driver.lastName].filter(Boolean).join(" "),
  phone: maskPhone(`${driver.countryCode || ""}${driver.phone || ""}`),
  status: driver.status,
  profileRequestStatus: driver.profileRequestStatus,
  isApproved: driver.isApproved,
  verificationStatus:
    driver.isApproved === true &&
    driver.status === "completed" &&
    driver.profileRequestStatus === "approved"
      ? "verified"
      : "unverified",
});

export const getPointsOverview = async (req, res) => {
  try {
    const createdAt = dateFilter(req).createdAt;
    const transactionMatch = createdAt ? { createdAt } : {};
    const requestMatch = createdAt ? { createdAt } : {};
    const settings = await PointsSettings.getEffective();
    const [
      ledger,
      walletTotals,
      activeWallets,
      pendingPurchaseRequests,
      suspiciousAdjustments,
    ] = await Promise.all([
      PointTransaction.aggregate([
        { $match: transactionMatch },
        {
          $project: {
            type: 1,
            points: 1,
            netChange: {
              $subtract: [
                { $add: ["$newAvailableBalance", "$newReservedBalance"] },
                {
                  $add: [
                    "$previousAvailableBalance",
                    "$previousReservedBalance",
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalPointsIssued: {
              $sum: { $cond: [{ $gt: ["$netChange", 0] }, "$netChange", 0] },
            },
            welcomePointsGranted: {
              $sum: {
                $cond: [{ $eq: ["$type", "WELCOME_BONUS"] }, "$points", 0],
              },
            },
            purchasedPointsCredited: {
              $sum: {
                $cond: [{ $eq: ["$type", "POINTS_PURCHASE"] }, "$points", 0],
              },
            },
            pointsConsumed: {
              $sum: {
                $cond: [{ $eq: ["$type", "RIDE_CHARGE"] }, "$points", 0],
              },
            },
            refunds: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$type",
                      ["OFFER_RELEASE", "TECHNICAL_REFUND"],
                    ],
                  },
                  "$points",
                  0,
                ],
              },
            },
          },
        },
      ]),
      DriverPointsWallet.aggregate([
        {
          $group: {
            _id: null,
            pointsCurrentlyReserved: {
              $sum: {
                $add: ["$reservedBonusPoints", "$reservedPurchasedPoints"],
              },
            },
          },
        },
      ]),
      DriverPointsWallet.countDocuments({}),
      PointPurchaseRequest.countDocuments({
        ...requestMatch,
        status: {
          $in: ["pending", "contacted", "payment_pending", "payment_verified"],
        },
      }),
      PointTransaction.countDocuments({
        ...transactionMatch,
        type: { $in: ["ADMIN_CREDIT", "ADMIN_DEBIT", "CORRECTION", "PENALTY"] },
        points: { $gte: settings.largeAdjustmentThreshold },
      }),
    ]);
    const totals = ledger[0] || {};
    return res.json({
      success: true,
      overview: {
        totalPointsIssued: totals.totalPointsIssued || 0,
        welcomePointsGranted: totals.welcomePointsGranted || 0,
        purchasedPointsCredited: totals.purchasedPointsCredited || 0,
        pointsConsumed: totals.pointsConsumed || 0,
        pointsCurrentlyReserved:
          walletTotals[0]?.pointsCurrentlyReserved || 0,
        refunds: totals.refunds || 0,
        activeWallets,
        pendingPurchaseRequests,
        suspiciousAdjustments,
      },
      filters: {
        from: req.query?.from || null,
        to: req.query?.to || null,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const requireRecentAuthForLargeAdjustment = async (req, points) => {
  const { largeAdjustmentThreshold: threshold } =
    await PointsSettings.getEffective();
  if (points < threshold) return;
  const authenticatedAt = Number(req.user?.auth_time || req.user?.iat);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authenticatedAt) || now - authenticatedAt > 15 * 60) {
    const error = new PointsValidationError(
      "Recent administrator authentication is required for a large adjustment",
      { code: "ADMIN_REAUTHENTICATION_REQUIRED", status: 403 }
    );
    throw error;
  }
};

export const listDriverPointWallets = async (req, res) => {
  try {
    const { page, limit } = pagination(req);
    const driverFilter = { isDeleted: { $ne: true } };
    if (req.query.status) {
      driverFilter.status = requireBoundedString(req.query.status, "status", {
        min: 2,
        max: 40,
      });
    }
    if (req.query.verificationStatus) {
      const verificationStatus = optionalEnum(
        req.query.verificationStatus,
        ["verified", "unverified"],
        "verificationStatus"
      );
      if (verificationStatus === "verified") {
        Object.assign(driverFilter, {
          isApproved: true,
          status: "completed",
          profileRequestStatus: "approved",
        });
      } else {
        driverFilter.$nor = [
          {
            isApproved: true,
            status: "completed",
            profileRequestStatus: "approved",
          },
        ];
      }
    }
    if (req.query.search) {
      const escaped = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      driverFilter.$or = [
        { fullName: { $regex: escaped, $options: "i" } },
        { firstName: { $regex: escaped, $options: "i" } },
        { lastName: { $regex: escaped, $options: "i" } },
        { phone: { $regex: escaped } },
      ];
      if (mongoose.isValidObjectId(String(req.query.search).trim())) {
        driverFilter.$or.push({
          _id: new mongoose.Types.ObjectId(String(req.query.search).trim()),
        });
      }
    }
    const balanceState = optionalEnum(
      req.query.balanceState,
      ["normal", "low", "zero", "reserved"],
      "balanceState"
    );
    if (balanceState) {
      const settings = await PointsSettings.getEffective();
      const availableExpression = {
        $add: ["$availableBonusPoints", "$availablePurchasedPoints"],
      };
      const reservedExpression = {
        $add: ["$reservedBonusPoints", "$reservedPurchasedPoints"],
      };
      const expression =
        balanceState === "zero"
          ? { $eq: [availableExpression, 0] }
          : balanceState === "low"
            ? {
                $and: [
                  { $gt: [availableExpression, 0] },
                  {
                    $lte: [
                      availableExpression,
                      settings.lowBalanceThreshold,
                    ],
                  },
                ],
              }
            : balanceState === "reserved"
              ? { $gt: [reservedExpression, 0] }
              : {
                  $gt: [
                    availableExpression,
                    settings.lowBalanceThreshold,
                  ],
                };
      const matchingWallets = await DriverPointsWallet.find({ $expr: expression })
        .select("driverId")
        .lean();
      driverFilter._id = {
        $in: matchingWallets.map((wallet) => wallet.driverId),
      };
    }
    const [drivers, total] = await Promise.all([
      Driver.find(driverFilter)
        .select(
          "firstName lastName fullName phone countryCode status profileRequestStatus isApproved"
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Driver.countDocuments(driverFilter),
    ]);
    const driverIds = drivers.map((driver) => driver._id);
    const [wallets, lastTransactions, rideCharges] = await Promise.all([
      DriverPointsWallet.find({ driverId: { $in: driverIds } }),
      PointTransaction.aggregate([
        { $match: { driverId: { $in: driverIds } } },
        { $sort: { createdAt: -1, _id: -1 } },
        { $group: { _id: "$driverId", transaction: { $first: "$$ROOT" } } },
      ]),
      PointTransaction.aggregate([
        {
          $match: {
            driverId: { $in: driverIds },
            type: "RIDE_CHARGE",
            status: "COMPLETED",
          },
        },
        { $group: { _id: "$driverId", count: { $sum: 1 } } },
      ]),
    ]);
    const walletByDriver = new Map(
      wallets.map((wallet) => [String(wallet.driverId), wallet])
    );
    const lastTransactionByDriver = new Map(
      lastTransactions.map((entry) => [
        String(entry._id),
        entry.transaction
          ? {
              id: String(entry.transaction._id),
              type: entry.transaction.type,
              points: entry.transaction.points,
              status: entry.transaction.status,
              createdAt: entry.transaction.createdAt,
            }
          : null,
      ])
    );
    const chargesByDriver = new Map(
      rideCharges.map((entry) => [String(entry._id), entry.count])
    );
    return res.json({
      success: true,
      drivers: drivers.map((driver) => ({
        ...driverSummary(driver),
        wallet: walletByDriver.has(String(driver._id))
          ? toWalletDto(walletByDriver.get(String(driver._id)))
          : null,
        confirmedRidesCharged: chargesByDriver.get(String(driver._id)) || 0,
        lastTransaction: lastTransactionByDriver.get(String(driver._id)) || null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getDriverPointDetails = async (req, res) => {
  try {
    const driverId = requireObjectId(req.params.driverId, "driverId");
    const driver = await Driver.findById(driverId)
      .select(
        "firstName lastName fullName phone countryCode status profileRequestStatus isApproved"
      )
      .lean();
    if (!driver) return res.status(404).json({ success: false, code: "DRIVER_NOT_FOUND" });
    const wallet = await ensureWallet(driverId);
    const transactions = await PointTransaction.find({ driverId })
      .select(
        "type status points bonusPoints purchasedPoints previousAvailableBalance newAvailableBalance previousReservedBalance newReservedBalance offerId rideId purchaseRequestId adminId reason createdAt"
      )
      .sort({ _id: -1 })
      .limit(100)
      .lean();
    return res.json({
      success: true,
      driver: driverSummary(driver),
      wallet: toWalletDto(wallet),
      transactions,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const listPointTransactions = async (req, res) => {
  try {
    const { page, limit } = pagination(req);
    const filter = { ...dateFilter(req) };
    if (req.query.driverId) filter.driverId = requireObjectId(req.query.driverId, "driverId");
    const type = optionalEnum(
      req.query.type,
      POINT_TRANSACTION_TYPES.map((value) => value.toLowerCase()),
      "type"
    );
    if (type) filter.type = type.toUpperCase();
    const status = optionalEnum(
      req.query.status,
      ["pending", "completed", "failed"],
      "status"
    );
    if (status) filter.status = status.toUpperCase();
    const [transactions, total] = await Promise.all([
      PointTransaction.find(filter)
        .select(
          "driverId type status points bonusPoints purchasedPoints previousAvailableBalance newAvailableBalance previousReservedBalance newReservedBalance offerId rideId purchaseRequestId adminId reason createdAt"
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PointTransaction.countDocuments(filter),
    ]);
    const [drivers, admins] = await Promise.all([
      Driver.find({
        _id: { $in: transactions.map((transaction) => transaction.driverId) },
      })
        .select(
          "firstName lastName fullName phone countryCode status profileRequestStatus isApproved"
        )
        .lean(),
      Admin.find({
        _id: {
          $in: transactions
            .map((transaction) => transaction.adminId)
            .filter(Boolean),
        },
      })
        .select("fullName role")
        .lean(),
    ]);
    const driversById = new Map(
      drivers.map((driver) => [String(driver._id), driverSummary(driver)])
    );
    const adminsById = new Map(
      admins.map((admin) => [
        String(admin._id),
        {
          id: String(admin._id),
          fullName: admin.fullName,
          role: admin.role,
        },
      ])
    );
    return res.json({
      success: true,
      transactions: transactions.map((transaction) => ({
        ...transaction,
        driver: driversById.get(String(transaction.driverId)) || null,
        admin: transaction.adminId
          ? adminsById.get(String(transaction.adminId)) || null
          : null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const listPointPurchaseRequests = async (req, res) => {
  try {
    const { page, limit } = pagination(req);
    const filter = { ...dateFilter(req) };
    if (req.query.status) {
      filter.status = optionalEnum(
        req.query.status,
        POINT_PURCHASE_REQUEST_STATUSES,
        "status"
      );
    }
    if (req.query.driverId) filter.driverId = requireObjectId(req.query.driverId, "driverId");
    if (req.query.search) {
      const raw = String(req.query.search).trim();
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { clientRequestId: { $regex: escaped, $options: "i" } },
        { paymentReference: { $regex: escaped, $options: "i" } },
      ];
      if (mongoose.isValidObjectId(raw)) {
        filter.$or.push({ _id: new mongoose.Types.ObjectId(raw) });
      }
    }
    const [requests, total] = await Promise.all([
      PointPurchaseRequest.find(filter)
        .select(
          "+paymentReference +processedBy"
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PointPurchaseRequest.countDocuments(filter),
    ]);
    const [drivers, admins] = await Promise.all([
      Driver.find({ _id: { $in: requests.map((request) => request.driverId) } })
        .select(
          "firstName lastName fullName phone countryCode status profileRequestStatus isApproved"
        )
        .lean(),
      Admin.find({
        _id: {
          $in: requests.map((request) => request.processedBy).filter(Boolean),
        },
      })
        .select("fullName role")
        .lean(),
    ]);
    const driversById = new Map(
      drivers.map((driver) => [String(driver._id), driverSummary(driver)])
    );
    const adminsById = new Map(
      admins.map((admin) => [
        String(admin._id),
        {
          id: String(admin._id),
          fullName: admin.fullName,
          role: admin.role,
        },
      ])
    );
    return res.json({
      success: true,
      requests: requests.map((request) => ({
        ...request,
        paymentReference: maskPaymentReference(request.paymentReference),
        driver: driversById.get(String(request.driverId)) || null,
        assignedAdmin: request.processedBy
          ? adminsById.get(String(request.processedBy)) || null
          : null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const PURCHASE_TRANSITIONS = {
  pending: ["contacted", "rejected", "cancelled"],
  contacted: ["payment_pending", "rejected", "cancelled"],
  payment_pending: ["payment_verified", "rejected", "cancelled"],
  payment_verified: ["rejected", "cancelled"],
};

export const updatePointPurchaseRequest = async (req, res) => {
  try {
    assertNoDirectBalanceMutation(req.body || {});
    requireExplicitConfirmation(req.body?.confirmation);
    const requestId = requireObjectId(req.params.id, "purchaseRequestId");
    const status = optionalEnum(
      req.body?.status,
      POINT_PURCHASE_REQUEST_STATUSES,
      "status"
    );
    if (!status || status === "credited") {
      throw new PointsValidationError(
        "credited status is only set by the credit endpoint"
      );
    }
    const updated = await runPointsTransaction(async (session) => {
      const request = await PointPurchaseRequest.findById(requestId)
        .select("+ownerAdminNote +paymentReference +paymentAmount +currency +paymentMethod")
        .session(session);
      if (!request) {
        throw new PointsValidationError("Purchase request not found", {
          code: "PURCHASE_REQUEST_NOT_FOUND",
          status: 404,
        });
      }
      if (!(PURCHASE_TRANSITIONS[request.status] || []).includes(status)) {
        throw new PointsValidationError(
          `Cannot transition purchase request from ${request.status} to ${status}`,
          { code: "PURCHASE_REQUEST_STATE_CONFLICT", status: 409 }
        );
      }
      const now = new Date();
      const terminalReason =
        status === "rejected" || status === "cancelled"
          ? requireBoundedString(
              req.body?.reason || req.body?.ownerAdminNote,
              "reason",
              { min: 3, max: 2000 }
            )
          : String(req.body?.ownerAdminNote || "").trim().slice(0, 2000);
      const set = {
        status,
        processedBy: req.pointsAdmin.id,
        ownerAdminNote: terminalReason,
      };
      if (status === "contacted") set.contactedAt = now;
      if (status === "payment_verified") {
        set.paymentReference = requirePaymentReference(req.body?.paymentReference);
        set.paymentAmount = optionalMoneyAmount(req.body?.paymentAmount);
        if (set.paymentAmount === null) {
          throw new PointsValidationError("paymentAmount is required");
        }
        set.currency = requireBoundedString(req.body?.currency, "currency", {
          min: 3,
          max: 3,
          pattern: /^[A-Za-z]{3}$/,
        }).toUpperCase();
        set.paymentMethod = requireBoundedString(req.body?.paymentMethod, "paymentMethod", {
          min: 2,
          max: 100,
        });
        if (
          request.requestedPackId &&
          (set.paymentAmount !== request.packSnapshot?.price ||
            set.currency !== request.packSnapshot?.currency)
        ) {
          throw new PointsValidationError(
            "Verified payment does not match the requested point pack",
            { code: "POINT_PACK_PAYMENT_MISMATCH", status: 409 }
          );
        }
        set.paymentVerifiedAt = now;
      }
      if (status === "rejected") set.rejectedAt = now;
      if (status === "cancelled") set.cancelledAt = now;
      const transitioned = await PointPurchaseRequest.findOneAndUpdate(
        { _id: request._id, status: request.status },
        { $set: set },
        { new: true, runValidators: true, session }
      );
      if (!transitioned) {
        throw new PointsValidationError("Purchase request changed concurrently", {
          code: "PURCHASE_REQUEST_STATE_CONFLICT",
          status: 409,
        });
      }
      await createPointsAdminAuditInSession({
        req,
        action: "PURCHASE_REQUEST_TRANSITION",
        driverId: request.driverId,
        pointsChange: 0,
        reason:
          terminalReason || `Purchase request transitioned to ${status}`,
        purchaseRequestId: request._id,
        idempotencyKey: `audit:purchase-request:${request._id}:${status}`,
        metadata: { previousStatus: request.status, newStatus: status },
        session,
      });
      await queuePointsEvents(
        [
          {
            eventKey: `purchase-request:${request._id}:${status}`,
            type: "points:purchase_request_updated",
            aggregateType: "purchase_request",
            aggregateId: request._id,
            recipientId: request.driverId,
            recipientType: "Driver",
            payload: {
              purchaseRequestId: String(request._id),
              status,
              notification: {
                type: "POINT_PURCHASE_REQUEST_UPDATED",
                message: `Point purchase request updated to ${status}`,
              },
            },
          },
        ],
        session
      );
      return transitioned;
    });
    return res.json({ success: true, request: updated });
  } catch (error) {
    if (
      error?.code === 11000 &&
      (error?.keyPattern?.paymentReference ||
        error?.keyValue?.paymentReference)
    ) {
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_PAYMENT_REFERENCE",
        message: "Payment reference has already been used",
      });
    }
    return sendError(res, error);
  }
};

export const creditVerifiedPointPurchaseRequest = async (req, res) => {
  try {
    assertNoDirectBalanceMutation(req.body || {});
    requireExplicitConfirmation(req.body?.confirmation);
    const requestId = requireObjectId(req.params.id, "purchaseRequestId");
    const clientIdempotencyKey = requireIdempotencyKey(req);
    const reason = requireBoundedString(req.body?.reason, "reason", {
      min: 3,
      max: 1000,
    });
    const result = await runPointsTransaction(async (session) => {
      const purchaseRequest = await PointPurchaseRequest.findById(requestId)
        .select(
          "+paymentReference +paymentAmount +currency +paymentMethod +processedBy"
        )
        .session(session);
      if (!purchaseRequest) {
        throw new PointsValidationError("Purchase request not found", {
          code: "PURCHASE_REQUEST_NOT_FOUND",
          status: 404,
        });
      }
      const existing = await PointTransaction.findOne({
        purchaseRequestId: purchaseRequest._id,
        type: "POINTS_PURCHASE",
      }).session(session);
      if (existing) {
        return {
          wallet: await DriverPointsWallet.findOne({
            driverId: purchaseRequest.driverId,
          }).session(session),
          transaction: existing,
          idempotent: true,
        };
      }
      if (purchaseRequest.status !== "payment_verified") {
        throw new PointsValidationError(
          "A payment-verified purchase request is required",
          { code: "PURCHASE_REQUEST_NOT_VERIFIED", status: 409 }
        );
      }
      const points = purchaseRequest.requestedPackId
        ? purchaseRequest.packSnapshot?.points
        : purchaseRequest.requestedPoints;
      if (!Number.isSafeInteger(points) || points <= 0) {
        throw new PointsValidationError("Purchase request points are invalid", {
          code: "PURCHASE_POINTS_INVALID",
          status: 409,
        });
      }
      const credit = await creditPointsInSession({
        driverId: purchaseRequest.driverId,
        points,
        purchased: true,
        type: "POINTS_PURCHASE",
        adminId: req.pointsAdmin.id,
        purchaseRequestId: purchaseRequest._id,
        paymentReference: purchaseRequest.paymentReference,
        reason,
        idempotencyKey: `purchase-credit:${purchaseRequest._id}`,
        metadata: {
          source: "purchase_request",
          paymentAmount: purchaseRequest.paymentAmount,
          currency: purchaseRequest.currency,
          paymentMethod: purchaseRequest.paymentMethod,
          clientIdempotencyKey,
        },
        session,
      });
      await createPointsAdminAuditInSession({
        req,
        action: "POINTS_CREDIT",
        driverId: purchaseRequest.driverId,
        previousAvailableBalance:
          credit.transaction.previousAvailableBalance,
        newAvailableBalance: credit.transaction.newAvailableBalance,
        pointsChange: points,
        reason: credit.transaction.reason,
        paymentReference: purchaseRequest.paymentReference,
        purchaseRequestId: purchaseRequest._id,
        pointTransactionId: credit.transaction._id,
        idempotencyKey: `audit:${credit.transaction._id}`,
        metadata: { source: "purchase_request" },
        session,
      });
      const transition = await PointPurchaseRequest.updateOne(
        { _id: purchaseRequest._id, status: "payment_verified" },
        {
          $set: {
            status: "credited",
            creditedAt: new Date(),
            processedBy: req.pointsAdmin.id,
          },
        },
        { session, runValidators: true }
      );
      if (transition.modifiedCount !== 1) {
        throw new PointsValidationError(
          "Purchase request changed concurrently",
          { code: "PURCHASE_REQUEST_STATE_CONFLICT", status: 409 }
        );
      }
      await queuePointsEvents(
        [
          {
            eventKey: `purchase-request:${purchaseRequest._id}:credited`,
            type: "points:credited",
            aggregateType: "wallet",
            aggregateId: credit.wallet._id,
            recipientId: purchaseRequest.driverId,
            recipientType: "Driver",
            payload: {
              points,
              walletVersion: credit.wallet.version,
              purchaseRequestId: String(purchaseRequest._id),
              notification: {
                type: "PURCHASED_POINTS_CREDITED",
                message: `${points} points credited`,
              },
            },
          },
        ],
        session
      );
      return credit;
    });
    return res.status(result.idempotent ? 200 : 201).json({
      success: true,
      wallet: toWalletDto(result.wallet),
      transactionId: String(result.transaction._id),
      purchaseRequestId: requestId,
      idempotent: result.idempotent,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const transaction = await PointTransaction.findOne({
        purchaseRequestId: req.params.id,
        type: "POINTS_PURCHASE",
      });
      if (transaction) {
        const wallet = await DriverPointsWallet.findOne({
          driverId: transaction.driverId,
        });
        return res.json({
          success: true,
          wallet: toWalletDto(wallet),
          transactionId: String(transaction._id),
          purchaseRequestId: String(req.params.id),
          idempotent: true,
        });
      }
    }
    return sendError(res, error);
  }
};

const parseAdjustment = async (req, kind) => {
  assertNoDirectBalanceMutation(req.body || {});
  const driverId = requireObjectId(req.body?.driverId, "driverId");
  const points = requirePositiveInteger(req.body?.points, "points");
  const reason = requireBoundedString(req.body?.reason, "reason", {
    min: 3,
    max: 1000,
  });
  requireExplicitConfirmation(req.body?.confirmation);
  await requireRecentAuthForLargeAdjustment(req, points);
  const idempotencyKey = requireIdempotencyKey(req);
  const source = requireBoundedString(req.body?.source, "source", {
    min: 3,
    max: 40,
    pattern: /^[A-Za-z][A-Za-z0-9_-]+$/,
  }).toLowerCase();
  const allowedSources =
    kind === "credit"
      ? ["admin", "bonus", "correction"]
      : ["admin", "penalty", "correction"];
  if (!allowedSources.includes(source)) {
    throw new PointsValidationError("source is invalid");
  }
  if (
    kind === "credit" &&
    [
      req.body?.purchaseRequestId,
      req.body?.paymentAmount,
      req.body?.currency,
      req.body?.paymentReference,
      req.body?.paymentMethod,
    ].some((value) => value !== undefined && value !== null && value !== "")
  ) {
    throw new PointsValidationError(
      "Purchased points must use the verified purchase request credit endpoint",
      { code: "PURCHASE_CREDIT_ENDPOINT_REQUIRED", status: 409 }
    );
  }
  const metadata = sanitizePointsMetadata(req.body?.metadata);
  const payload = {
    kind,
    driverId,
    points,
    reason,
    source,
    purchaseRequestId: req.body?.purchaseRequestId || null,
    paymentAmount: req.body?.paymentAmount ?? null,
    currency: req.body?.currency || "",
    paymentReference: req.body?.paymentReference || "",
    paymentMethod: req.body?.paymentMethod || "",
    metadata,
  };
  return {
    ...payload,
    idempotencyKey,
    requestFingerprint: hashIdempotencyPayload(payload),
  };
};

export const creditDriverPoints = async (req, res) => {
  let input;
  try {
    input = await parseAdjustment(req, "credit");
    const purchased = input.source === "purchase";
    let purchaseRequestId = null;
    let paymentReference = "";
    let paymentAmount = null;
    let currency = "";
    let paymentMethod = "";
    if (purchased) {
      purchaseRequestId = requireObjectId(
        input.purchaseRequestId,
        "purchaseRequestId"
      );
      paymentReference = requirePaymentReference(input.paymentReference);
      paymentAmount = optionalMoneyAmount(input.paymentAmount);
      if (paymentAmount === null) {
        throw new PointsValidationError(
          "paymentAmount is required for purchased points"
        );
      }
      currency = requireBoundedString(input.currency, "currency", {
        min: 3,
        max: 3,
        pattern: /^[A-Za-z]{3}$/,
      }).toUpperCase();
      paymentMethod = requireBoundedString(input.paymentMethod, "paymentMethod", {
        min: 2,
        max: 100,
      });
    }

    const result = await runPointsTransaction(async (session) => {
      const existing = await PointTransaction.findOne({
        idempotencyKey: `admin-credit:${req.pointsAdmin.id}:${input.idempotencyKey}`,
      }).session(session);
      if (existing) {
        assertIdempotencyPayloadMatches(
          existing.metadata?.requestFingerprint,
          {
            kind: input.kind,
            driverId: input.driverId,
            points: input.points,
            reason: input.reason,
            source: input.source,
            purchaseRequestId: input.purchaseRequestId,
            paymentAmount: input.paymentAmount,
            currency: input.currency,
            paymentReference: input.paymentReference,
            paymentMethod: input.paymentMethod,
            metadata: input.metadata,
          }
        );
        return {
          wallet: await DriverPointsWallet.findOne({
            driverId: input.driverId,
          }).session(session),
          transaction: existing,
          idempotent: true,
        };
      }
      const driver = await Driver.exists({
        _id: input.driverId,
        isDeleted: { $ne: true },
      }).session(session);
      if (!driver) throw new PointsValidationError("Driver not found", { status: 404 });

      let purchaseRequest = null;
      if (purchased) {
        purchaseRequest = await PointPurchaseRequest.findOne({
          _id: purchaseRequestId,
          driverId: input.driverId,
          status: "payment_verified",
        })
          .select("+paymentReference +paymentAmount +currency +paymentMethod")
          .session(session);
        if (!purchaseRequest) {
          throw new PointsValidationError(
            "A payment-verified purchase request is required",
            { code: "PURCHASE_REQUEST_NOT_VERIFIED", status: 409 }
          );
        }
        let expectedPoints = purchaseRequest.requestedPoints;
        if (purchaseRequest.requestedPackId) {
          expectedPoints = purchaseRequest.packSnapshot?.points;
        }
        if (expectedPoints !== input.points) {
          throw new PointsValidationError(
            "Credit points do not match the verified purchase request",
            { code: "PURCHASE_POINTS_MISMATCH", status: 409 }
          );
        }
        if (
          purchaseRequest.paymentReference !== paymentReference ||
          purchaseRequest.paymentAmount !== paymentAmount ||
          purchaseRequest.currency !== currency ||
          purchaseRequest.paymentMethod !== paymentMethod
        ) {
          throw new PointsValidationError(
            "Credit payment details do not match the verified purchase request",
            { code: "PURCHASE_PAYMENT_MISMATCH", status: 409 }
          );
        }
      }

      const credit = await creditPointsInSession({
        driverId: input.driverId,
        points: input.points,
        purchased,
        type:
          purchased
            ? "POINTS_PURCHASE"
            : input.source === "correction"
              ? "CORRECTION"
              : "ADMIN_CREDIT",
        adminId: req.pointsAdmin.id,
        purchaseRequestId,
        paymentReference,
        reason: input.reason,
        idempotencyKey: `admin-credit:${req.pointsAdmin.id}:${input.idempotencyKey}`,
        metadata: {
          ...input.metadata,
          source: input.source,
          paymentAmount,
          currency,
          paymentMethod,
          requestFingerprint: input.requestFingerprint,
        },
        session,
      });
      if (purchaseRequest && purchaseRequest.status !== "credited") {
        await PointPurchaseRequest.updateOne(
          { _id: purchaseRequest._id, status: "payment_verified" },
          {
            $set: {
              status: "credited",
              creditedAt: new Date(),
              processedBy: req.pointsAdmin.id,
              paymentReference,
              paymentAmount,
              currency,
              paymentMethod,
            },
          },
          { session, runValidators: true }
        );
      }
      if (!credit.idempotent) {
        await createPointsAdminAuditInSession({
          req,
          action: "POINTS_CREDIT",
          driverId: input.driverId,
          previousAvailableBalance:
            credit.transaction.previousAvailableBalance,
          newAvailableBalance: credit.transaction.newAvailableBalance,
          pointsChange: input.points,
          reason: input.reason,
          paymentReference,
          purchaseRequestId,
          pointTransactionId: credit.transaction._id,
          idempotencyKey: `audit:${credit.transaction._id}`,
          metadata: { source: input.source },
          session,
        });
        await queuePointsEvents(
          [
            {
              eventKey: `admin-credit:${credit.transaction._id}:wallet`,
              type: "points:credited",
              aggregateType: "wallet",
              aggregateId: credit.wallet._id,
              recipientId: input.driverId,
              recipientType: "Driver",
              payload: {
                points: input.points,
                walletVersion: credit.wallet.version,
                purchaseRequestId,
                notification: {
                  type: purchased ? "PURCHASED_POINTS_CREDITED" : "POINTS_CREDITED",
                  message: `${input.points} points credited`,
                },
              },
            },
          ],
          session
        );
      }
      return credit;
    });

    return res.status(result.idempotent ? 200 : 201).json({
      success: true,
      wallet: toWalletDto(result.wallet),
      transactionId: String(result.transaction._id),
      idempotent: result.idempotent,
    });
  } catch (error) {
    if (error?.code === 11000 && input) {
      const transaction = await PointTransaction.findOne({
        idempotencyKey: `admin-credit:${req.pointsAdmin.id}:${input.idempotencyKey}`,
      });
      if (transaction) {
        try {
          assertIdempotencyPayloadMatches(
            transaction.metadata?.requestFingerprint,
            {
              kind: input.kind,
              driverId: input.driverId,
              points: input.points,
              reason: input.reason,
              source: input.source,
              purchaseRequestId: input.purchaseRequestId,
              paymentAmount: input.paymentAmount,
              currency: input.currency,
              paymentReference: input.paymentReference,
              paymentMethod: input.paymentMethod,
              metadata: input.metadata,
            }
          );
        } catch (validationError) {
          return sendError(res, validationError);
        }
        const wallet = await DriverPointsWallet.findOne({
          driverId: input.driverId,
        });
        return res.json({
          success: true,
          wallet: toWalletDto(wallet),
          transactionId: String(transaction._id),
          idempotent: true,
        });
      }
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_PAYMENT_REFERENCE",
        message: "Payment reference has already been used",
      });
    }
    return sendError(res, error);
  }
};

export const debitDriverPoints = async (req, res) => {
  let input;
  try {
    input = await parseAdjustment(req, "debit");
    const type =
      input.source === "penalty"
        ? "PENALTY"
        : input.source === "correction"
          ? "CORRECTION"
          : "ADMIN_DEBIT";
    const result = await runPointsTransaction(async (session) => {
      const scopedKey = `admin-debit:${req.pointsAdmin.id}:${input.idempotencyKey}`;
      const existing = await PointTransaction.findOne({
        idempotencyKey: scopedKey,
      }).session(session);
      if (existing) {
        assertIdempotencyPayloadMatches(
          existing.metadata?.requestFingerprint,
          {
            kind: input.kind,
            driverId: input.driverId,
            points: input.points,
            reason: input.reason,
            source: input.source,
            purchaseRequestId: input.purchaseRequestId,
            paymentAmount: input.paymentAmount,
            currency: input.currency,
            paymentReference: input.paymentReference,
            paymentMethod: input.paymentMethod,
            metadata: input.metadata,
          }
        );
        return {
          wallet: await DriverPointsWallet.findOne({
            driverId: input.driverId,
          }).session(session),
          transaction: existing,
          idempotent: true,
        };
      }
      const debit = await debitPointsInSession({
        driverId: input.driverId,
        points: input.points,
        type,
        adminId: req.pointsAdmin.id,
        reason: input.reason,
        idempotencyKey: scopedKey,
        metadata: {
          ...input.metadata,
          source: input.source,
          requestFingerprint: input.requestFingerprint,
        },
        session,
      });
      if (!debit.idempotent) {
        await createPointsAdminAuditInSession({
          req,
          action: "POINTS_DEBIT",
          driverId: input.driverId,
          previousAvailableBalance:
            debit.transaction.previousAvailableBalance,
          newAvailableBalance: debit.transaction.newAvailableBalance,
          pointsChange: -input.points,
          reason: input.reason,
          purchaseRequestId: null,
          pointTransactionId: debit.transaction._id,
          idempotencyKey: `audit:${debit.transaction._id}`,
          metadata: { source: input.source },
          session,
        });
      }
      if (!debit.idempotent) {
        await queuePointsEvents(
          [
            {
              eventKey: `admin-debit:${debit.transaction._id}:wallet`,
              type: "points:wallet_updated",
              aggregateType: "wallet",
              aggregateId: debit.wallet._id,
              recipientId: input.driverId,
              recipientType: "Driver",
              payload: {
                points: input.points,
                walletVersion: debit.wallet.version,
                reason: input.reason,
                notification: {
                  type: "POINTS_ADJUSTED",
                  message: `${input.points} points deducted by Drewel`,
                },
              },
            },
          ],
          session
        );
      }
      return debit;
    });
    return res.status(result.idempotent ? 200 : 201).json({
      success: true,
      wallet: toWalletDto(result.wallet),
      transactionId: String(result.transaction._id),
      idempotent: result.idempotent,
    });
  } catch (error) {
    if (error?.code === 11000 && input) {
      const transaction = await PointTransaction.findOne({
        idempotencyKey: `admin-debit:${req.pointsAdmin.id}:${input.idempotencyKey}`,
      });
      if (transaction) {
        try {
          assertIdempotencyPayloadMatches(
            transaction.metadata?.requestFingerprint,
            {
              kind: input.kind,
              driverId: input.driverId,
              points: input.points,
              reason: input.reason,
              source: input.source,
              purchaseRequestId: input.purchaseRequestId,
              paymentAmount: input.paymentAmount,
              currency: input.currency,
              paymentReference: input.paymentReference,
              paymentMethod: input.paymentMethod,
              metadata: input.metadata,
            }
          );
        } catch (validationError) {
          return sendError(res, validationError);
        }
        const wallet = await DriverPointsWallet.findOne({
          driverId: input.driverId,
        });
        return res.json({
          success: true,
          wallet: toWalletDto(wallet),
          transactionId: String(transaction._id),
          idempotent: true,
        });
      }
    }
    return sendError(res, error);
  }
};

export const getPointSettings = async (_req, res) => {
  const effective = await PointsSettings.getEffective();
  const stored = await PointsSettings.findOne({ key: GLOBAL_POINTS_SETTINGS_KEY })
    .select("updatedAt updatedBy updateReason")
    .lean();
  return res.json({ success: true, settings: { ...effective, ...stored } });
};

const parseSettingsInteger = (
  value,
  fieldName,
  { min, max = 1_000_000 } = {}
) => {
  const parsed =
    typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new PointsValidationError(
      `${fieldName} must be an integer between ${min} and ${max}`
    );
  }
  return parsed;
};

export const updatePointSettings = async (req, res) => {
  try {
    assertNoDirectBalanceMutation(req.body || {});
    requireExplicitConfirmation(req.body?.confirmation);
    const updateReason = requireBoundedString(req.body?.reason, "reason", {
      min: 3,
      max: 1000,
    });
    const definitions = {
      welcomeDriverPoints: { min: 0 },
      rideOfferPointsCost: { min: 1 },
      lowBalanceThreshold: { min: 0 },
      offerExpirationSeconds: { min: 30, max: 86400 },
      maximumConcurrentOffers: { min: 1, max: 100 },
      largeAdjustmentThreshold: { min: 1 },
    };
    const values = {};
    for (const [fieldName, bounds] of Object.entries(definitions)) {
      if (req.body?.[fieldName] !== undefined) {
        values[fieldName] = parseSettingsInteger(
          req.body[fieldName],
          fieldName,
          bounds
        );
      }
    }
    if (Object.keys(values).length === 0) {
      throw new PointsValidationError(
        "At least one point setting must be provided"
      );
    }
    const auditId = new mongoose.Types.ObjectId();
    const { settings, effective } = await runPointsTransaction(async (session) => {
      const updated = await PointsSettings.findOneAndUpdate(
        { key: GLOBAL_POINTS_SETTINGS_KEY },
        {
          $set: {
            ...values,
            updateReason,
            updatedBy: req.pointsAdmin.id,
          },
          $setOnInsert: { key: GLOBAL_POINTS_SETTINGS_KEY },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
          session,
        }
      );
      await createPointsAdminAuditInSession({
        req,
        action: "POINTS_SETTINGS_UPDATE",
        pointsChange: 0,
        reason: updateReason,
        idempotencyKey: `audit:settings:${auditId}`,
        metadata: { changedFields: Object.keys(values) },
        session,
      });
      return {
        settings: updated,
        effective: await PointsSettings.getEffective({ session }),
      };
    });
    return res.json({
      success: true,
      settings: {
        ...effective,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy,
        updateReason: settings.updateReason,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const createPointPack = async (req, res) => {
  try {
    requireExplicitConfirmation(req.body?.confirmation);
    const price = optionalMoneyAmount(req.body?.price, "price");
    if (price === null) throw new PointsValidationError("price is required");
    const values = {
      name: requireBoundedString(req.body?.name, "name", { min: 2, max: 120 }),
      points: requirePositiveInteger(req.body?.points, "points"),
      price,
      currency: requireBoundedString(req.body?.currency, "currency", {
        min: 3,
        max: 3,
        pattern: /^[A-Za-z]{3}$/,
      }).toUpperCase(),
      active: req.body?.active === true,
      displayOrder:
        req.body?.displayOrder === undefined
          ? 0
          : Math.max(0, Number.parseInt(req.body.displayOrder, 10) || 0),
    };
    const auditId = new mongoose.Types.ObjectId();
    const pack = await runPointsTransaction(async (session) => {
      const [created] = await PointPack.create([values], { session });
      await createPointsAdminAuditInSession({
        req,
        action: "POINT_PACK_CREATE",
        pointsChange: 0,
        reason: `Point pack created: ${created.name}`,
        pointPackId: created._id,
        idempotencyKey: `audit:pack-create:${auditId}`,
        metadata: {
          points: created.points,
          currency: created.currency,
          active: created.active,
          displayOrder: created.displayOrder,
        },
        session,
      });
      return created;
    });
    return res.status(201).json({ success: true, pack });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updatePointPack = async (req, res) => {
  try {
    requireExplicitConfirmation(req.body?.confirmation);
    const packId = requireObjectId(req.params.id, "packId");
    const allowed = {};
    if (req.body?.name !== undefined) {
      allowed.name = requireBoundedString(req.body.name, "name", { min: 2, max: 120 });
    }
    if (req.body?.points !== undefined) {
      allowed.points = requirePositiveInteger(req.body.points, "points");
    }
    if (req.body?.price !== undefined) allowed.price = optionalMoneyAmount(req.body.price, "price");
    if (req.body?.currency !== undefined) {
      allowed.currency = requireBoundedString(req.body.currency, "currency", {
        min: 3,
        max: 3,
        pattern: /^[A-Za-z]{3}$/,
      }).toUpperCase();
    }
    if (req.body?.active !== undefined) allowed.active = req.body.active === true;
    if (req.body?.displayOrder !== undefined) {
      allowed.displayOrder = Math.max(0, Number.parseInt(req.body.displayOrder, 10) || 0);
    }
    if (Object.keys(allowed).length === 0) {
      throw new PointsValidationError(
        "At least one point pack field must be provided"
      );
    }
    const auditId = new mongoose.Types.ObjectId();
    const pack = await runPointsTransaction(async (session) => {
      const updated = await PointPack.findByIdAndUpdate(
        packId,
        { $set: allowed },
        { new: true, runValidators: true, session }
      );
      if (!updated) return null;
      await createPointsAdminAuditInSession({
        req,
        action: "POINT_PACK_UPDATE",
        pointsChange: 0,
        reason: `Point pack updated: ${updated.name}`,
        pointPackId: updated._id,
        idempotencyKey: `audit:pack-update:${auditId}`,
        metadata: { changedFields: Object.keys(allowed) },
        session,
      });
      return updated;
    });
    if (!pack) return res.status(404).json({ success: false, code: "POINT_PACK_NOT_FOUND" });
    return res.json({ success: true, pack });
  } catch (error) {
    return sendError(res, error);
  }
};

export const listPointPacks = async (_req, res) => {
  const packs = await PointPack.find({}).sort({ displayOrder: 1, _id: 1 });
  return res.json({ success: true, packs });
};

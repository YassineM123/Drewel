import mongoose from "mongoose";
import DriverPointsWallet from "../models/DriverPointsWallet.js";
import PointTransaction from "../models/PointTransaction.js";
import PointsOutboxEvent from "../models/PointsOutboxEvent.js";
import PointsSettings from "../models/PointsSettings.js";
import { calculateRideCommission } from "./commissionService.js";

export class PointsError extends Error {
  constructor(message, statusCode = 409, code = "POINTS_CONFLICT") {
    super(message);
    this.name = "PointsError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const totalAvailable = (wallet) =>
  wallet.availableBonusPoints + wallet.availablePurchasedPoints;
const totalReserved = (wallet) =>
  wallet.reservedBonusPoints + wallet.reservedPurchasedPoints;

export const toWalletDto = (wallet, settings = null) => {
  const availablePoints = totalAvailable(wallet);
  const reservedPoints = totalReserved(wallet);
  const pointsPerAED = settings?.pointsPerAED ?? 10;
  const commissionRate = settings?.commissionRate ?? 0.10;
  const equivalentAED = availablePoints / pointsPerAED;
  return {
    driverId: String(wallet.driverId),
    availableBonusPoints: wallet.availableBonusPoints,
    availablePurchasedPoints: wallet.availablePurchasedPoints,
    reservedBonusPoints: wallet.reservedBonusPoints,
    reservedPurchasedPoints: wallet.reservedPurchasedPoints,
    availablePoints,
    reservedPoints,
    totalPoints: availablePoints + reservedPoints,
    totalEarnedBonus: wallet.totalEarnedBonus,
    totalPurchased: wallet.totalPurchased,
    totalConsumed: wallet.totalConsumed,
    totalRefunded: wallet.totalRefunded,
    welcomeBonusGranted: wallet.welcomeBonusGranted,
    welcomeBonusGrantedAt: wallet.welcomeBonusGrantedAt,
    version: wallet.version,
    updatedAt: wallet.updatedAt,
    pointsPerAED,
    commissionRate,
    equivalentAED: Math.round(equivalentAED * 100) / 100,
  };
};

export const isWelcomeBonusEligible = (driver) =>
  Boolean(driver && driver.isDeleted !== true);

export const ensureWallet = async (driverId, session = null) =>
  DriverPointsWallet.findOneAndUpdate(
    { driverId },
    {
      $setOnInsert: {
        driverId,
        availableBonusPoints: 0,
        availablePurchasedPoints: 0,
        reservedBonusPoints: 0,
        reservedPurchasedPoints: 0,
        totalEarnedBonus: 0,
        totalPurchased: 0,
        totalConsumed: 0,
        totalRefunded: 0,
        welcomeBonusGranted: false,
        welcomeBonusGrantedAt: null,
        version: 0,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );

const addOutboxEvents = async (events, session) => {
  if (!events.length) return;
  await PointsOutboxEvent.create(events, { session, ordered: true });
};

export const queuePointsEvents = addOutboxEvents;

const addLedgerEntry = async (entry, session) => {
  const [transaction] = await PointTransaction.create([entry], { session });
  return transaction;
};

export const runPointsTransaction = async (operation, { maxRetries = 4 } = {}) => {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch (error) {
      lastError = error;
      const message = String(error?.message || "");
      if (
        message.includes("Transaction numbers are only allowed") ||
        message.includes("replica set member or mongos")
      ) {
        throw new PointsError(
          "Driver points operations require MongoDB transaction support",
          503,
          "POINTS_TRANSACTION_UNAVAILABLE"
        );
      }
      const retryable =
        error?.code === "WALLET_STATE_CONFLICT" ||
        error?.errorLabels?.includes?.("TransientTransactionError") ||
        error?.errorLabels?.includes?.("UnknownTransactionCommitResult");
      if (!retryable || attempt === maxRetries - 1) throw error;
    } finally {
      await session.endSession();
    }
  }
  throw lastError;
};

export const grantWelcomeBonusInSession = async (
  driver,
  session,
  { source = "approval" } = {}
) => {
  if (!isWelcomeBonusEligible(driver)) {
    return { granted: false, reason: "DRIVER_NOT_ELIGIBLE", wallet: null };
  }

  await ensureWallet(driver._id, session);
  const settings = await PointsSettings.getEffective({ session });
  const points = settings.welcomeDriverPoints;
  const now = new Date();
  const previous = await DriverPointsWallet.findOneAndUpdate(
    { driverId: driver._id, welcomeBonusGranted: false },
    {
      $inc: {
        availableBonusPoints: points,
        totalEarnedBonus: points,
        version: 1,
      },
      $set: {
        welcomeBonusGranted: true,
        welcomeBonusGrantedAt: now,
      },
    },
    { new: false, session }
  );

  if (!previous) {
    return {
      granted: false,
      reason: "ALREADY_GRANTED",
      wallet: await DriverPointsWallet.findOne({ driverId: driver._id }).session(session),
    };
  }

  const wallet = await DriverPointsWallet.findOne({ driverId: driver._id }).session(session);
  if (points > 0) {
    await addLedgerEntry(
      {
        driverId: driver._id,
        type: "WELCOME_BONUS",
        status: "COMPLETED",
        points,
        bonusPoints: points,
        purchasedPoints: 0,
        previousAvailableBalance: totalAvailable(previous),
        newAvailableBalance: totalAvailable(wallet),
        previousReservedBalance: totalReserved(previous),
        newReservedBalance: totalReserved(wallet),
        reason: "One-time driver account welcome bonus",
        idempotencyKey: `welcome:${driver._id}`,
        metadata: { source },
      },
      session
    );
  }
  await addOutboxEvents(
    [
      {
        eventKey: `welcome:${driver._id}:wallet`,
        type: "points:credited",
        aggregateType: "wallet",
        aggregateId: wallet._id,
        recipientId: driver._id,
        recipientType: "Driver",
        payload: {
          driverId: String(driver._id),
          points,
          walletVersion: wallet.version,
          notification: {
            type: "WELCOME_POINTS_RECEIVED",
            title: "Welcome bonus",
            message: `${points} welcome points received`,
            deepLink: "drewel://driver/points",
          },
        },
      },
    ],
    session
  );
  return { granted: true, wallet };
};

export const grantWelcomeBonus = (driver, options = {}) =>
  runPointsTransaction((session) =>
    grantWelcomeBonusInSession(driver, session, options)
  );

const updateWalletWithVersion = async (wallet, update, session) => {
  const updated = await DriverPointsWallet.findOneAndUpdate(
    { _id: wallet._id, version: wallet.version },
    { ...update, $inc: { ...(update.$inc || {}), version: 1 } },
    { new: true, session, runValidators: true }
  );
  if (!updated) {
    throw new PointsError(
      "Wallet changed concurrently",
      409,
      "WALLET_STATE_CONFLICT"
    );
  }
  return updated;
};

export const reservePointsInSession = async ({
  driverId,
  points,
  offerId,
  rideId,
  idempotencyKey,
  session,
}) => {
  const wallet = await ensureWallet(driverId, session);
  if (totalAvailable(wallet) < points) {
    throw new PointsError(
      "Insufficient available points",
      409,
      "INSUFFICIENT_AVAILABLE_POINTS"
    );
  }

  const bonusPoints = Math.min(wallet.availableBonusPoints, points);
  const purchasedPoints = points - bonusPoints;
  const updated = await updateWalletWithVersion(
    wallet,
    {
      $inc: {
        availableBonusPoints: -bonusPoints,
        availablePurchasedPoints: -purchasedPoints,
        reservedBonusPoints: bonusPoints,
        reservedPurchasedPoints: purchasedPoints,
      },
    },
    session
  );

  await addLedgerEntry(
    {
      driverId,
      type: "OFFER_RESERVE",
      status: "COMPLETED",
      points,
      bonusPoints,
      purchasedPoints,
      previousAvailableBalance: totalAvailable(wallet),
      newAvailableBalance: totalAvailable(updated),
      previousReservedBalance: totalReserved(wallet),
      newReservedBalance: totalReserved(updated),
      offerId,
      rideId,
      reason: "Trip offer points reserved",
      idempotencyKey,
    },
    session
  );
  return { wallet: updated, bonusPoints, purchasedPoints };
};

export const releaseOfferPointsInSession = async ({
  offer,
  reason,
  idempotencyKey,
  session,
  technicalRefund = false,
}) => {
  const existing = await PointTransaction.findOne({ idempotencyKey }).session(session);
  if (existing) {
    const wallet = await DriverPointsWallet.findOne({ driverId: offer.driverId }).session(session);
    return { wallet, idempotent: true, transaction: existing };
  }
  const wallet = await DriverPointsWallet.findOne({ driverId: offer.driverId }).session(session);
  if (
    !wallet ||
    wallet.reservedBonusPoints < offer.reservedBonusPoints ||
    wallet.reservedPurchasedPoints < offer.reservedPurchasedPoints
  ) {
    throw new PointsError(
      "Reserved wallet balance is inconsistent",
      409,
      "RESERVATION_BALANCE_MISMATCH"
    );
  }
  const updated = await updateWalletWithVersion(
    wallet,
    {
      $inc: {
        availableBonusPoints: offer.reservedBonusPoints,
        availablePurchasedPoints: offer.reservedPurchasedPoints,
        reservedBonusPoints: -offer.reservedBonusPoints,
        reservedPurchasedPoints: -offer.reservedPurchasedPoints,
        ...(technicalRefund ? { totalRefunded: offer.pointsCost } : {}),
      },
    },
    session
  );
  const transaction = await addLedgerEntry(
    {
      driverId: offer.driverId,
      type: technicalRefund ? "TECHNICAL_REFUND" : "OFFER_RELEASE",
      status: "COMPLETED",
      points: offer.pointsCost,
      bonusPoints: offer.reservedBonusPoints,
      purchasedPoints: offer.reservedPurchasedPoints,
      previousAvailableBalance: totalAvailable(wallet),
      newAvailableBalance: totalAvailable(updated),
      previousReservedBalance: totalReserved(wallet),
      newReservedBalance: totalReserved(updated),
      offerId: offer._id,
      rideId: offer.contactRideId,
      reason,
      idempotencyKey,
    },
    session
  );
  return { wallet: updated, idempotent: false, transaction };
};

export const captureOfferPointsInSession = async ({
  offer,
  rideId,
  idempotencyKey,
  session,
}) => {
  const existing = await PointTransaction.findOne({ idempotencyKey }).session(session);
  if (existing) {
    const wallet = await DriverPointsWallet.findOne({ driverId: offer.driverId }).session(session);
    return { wallet, idempotent: true, transaction: existing };
  }
  const wallet = await DriverPointsWallet.findOne({ driverId: offer.driverId }).session(session);
  if (
    !wallet ||
    wallet.reservedBonusPoints < offer.reservedBonusPoints ||
    wallet.reservedPurchasedPoints < offer.reservedPurchasedPoints
  ) {
    throw new PointsError(
      "Reserved wallet balance is inconsistent",
      409,
      "RESERVATION_BALANCE_MISMATCH"
    );
  }
  const updated = await updateWalletWithVersion(
    wallet,
    {
      $inc: {
        reservedBonusPoints: -offer.reservedBonusPoints,
        reservedPurchasedPoints: -offer.reservedPurchasedPoints,
        totalConsumed: offer.pointsCost,
      },
    },
    session
  );
  const transaction = await addLedgerEntry(
    {
      driverId: offer.driverId,
      type: "RIDE_CHARGE",
      status: "COMPLETED",
      points: offer.pointsCost,
      bonusPoints: offer.reservedBonusPoints,
      purchasedPoints: offer.reservedPurchasedPoints,
      previousAvailableBalance: totalAvailable(wallet),
      newAvailableBalance: totalAvailable(updated),
      previousReservedBalance: totalReserved(wallet),
      newReservedBalance: totalReserved(updated),
      offerId: offer._id,
      rideId,
      reason: "Confirmed ride charge",
      idempotencyKey,
    },
    session
  );
  return { wallet: updated, idempotent: false, transaction };
};

export const chargeRideCommissionInSession = async ({
  driverId,
  rideId,
  ridePriceAED,
  settings,
  idempotencyKey,
  session,
}) => {
  const existing = await PointTransaction.findOne({ idempotencyKey }).session(session);
  if (existing) {
    const wallet = await DriverPointsWallet.findOne({ driverId }).session(session);
    return { wallet, idempotent: true, transaction: existing };
  }

  const commission = calculateRideCommission(ridePriceAED, settings);
  const pointsToCharge = Math.ceil(commission.pointsToDeduct);

  const wallet = await ensureWallet(driverId, session);
  if (totalAvailable(wallet) < pointsToCharge) {
    throw new PointsError(
      "Insufficient points for ride commission",
      409,
      "INSUFFICIENT_AVAILABLE_POINTS"
    );
  }

  const bonusPoints = Math.min(wallet.availableBonusPoints, pointsToCharge);
  const purchasedPoints = pointsToCharge - bonusPoints;
  const updated = await updateWalletWithVersion(
    wallet,
    {
      $inc: {
        availableBonusPoints: -bonusPoints,
        availablePurchasedPoints: -purchasedPoints,
        totalConsumed: pointsToCharge,
      },
    },
    session
  );

  const transaction = await addLedgerEntry(
    {
      driverId,
      type: "RIDE_COMMISSION",
      status: "COMPLETED",
      points: pointsToCharge,
      bonusPoints,
      purchasedPoints,
      previousAvailableBalance: totalAvailable(wallet),
      newAvailableBalance: totalAvailable(updated),
      previousReservedBalance: totalReserved(wallet),
      newReservedBalance: totalReserved(updated),
      rideId,
      reason: "Ride commission charge",
      idempotencyKey,
      metadata: {
        ridePriceAED: commission.ridePriceAED,
        commissionRate: commission.commissionRate,
        commissionAED: commission.commissionAED,
        pointsPerAED: commission.pointsPerAED,
        pointsToDeduct: commission.pointsToDeduct,
        driverNetAED: commission.driverNetAED,
      },
    },
    session
  );

  return { wallet: updated, idempotent: false, transaction, commission };
};

export const estimateCommissionBalance = async (driverId, ridePriceAED, session = null) => {
  const settings = await PointsSettings.getEffective(session ? { session } : {});
  const commission = calculateRideCommission(ridePriceAED, settings);
  const pointsRequired = Math.ceil(commission.pointsToDeduct);
  const wallet = await ensureWallet(driverId, session);
  const available = totalAvailable(wallet);
  return {
    availablePoints: available,
    pointsRequired,
    hasEnoughPoints: available >= pointsRequired,
    commission,
    settings,
  };
};

export const creditPointsInSession = async ({
  driverId,
  points,
  purchased,
  type,
  adminId,
  purchaseRequestId = null,
  paymentReference = "",
  reason,
  idempotencyKey,
  metadata = {},
  session,
}) => {
  const existing = await PointTransaction.findOne({ idempotencyKey })
    .select("+paymentReference")
    .session(session);
  if (existing) {
    const wallet = await DriverPointsWallet.findOne({ driverId }).session(session);
    return { wallet, transaction: existing, idempotent: true };
  }
  const wallet = await ensureWallet(driverId, session);
  const updated = await updateWalletWithVersion(
    wallet,
    {
      $inc: {
        [purchased ? "availablePurchasedPoints" : "availableBonusPoints"]: points,
        [purchased ? "totalPurchased" : "totalEarnedBonus"]: points,
      },
    },
    session
  );
  const transaction = await addLedgerEntry(
    {
      driverId,
      type,
      status: "COMPLETED",
      points,
      bonusPoints: purchased ? 0 : points,
      purchasedPoints: purchased ? points : 0,
      previousAvailableBalance: totalAvailable(wallet),
      newAvailableBalance: totalAvailable(updated),
      previousReservedBalance: totalReserved(wallet),
      newReservedBalance: totalReserved(updated),
      purchaseRequestId,
      adminId,
      paymentReference,
      reason,
      idempotencyKey,
      metadata,
    },
    session
  );
  return { wallet: updated, transaction, idempotent: false };
};

export const refundRidePointsInSession = async ({
  driverId,
  rideId,
  points,
  adminId,
  reason,
  idempotencyKey,
  session,
}) => {
  const existing = await PointTransaction.findOne({ idempotencyKey }).session(session);
  if (existing) {
    const wallet = await DriverPointsWallet.findOne({ driverId }).session(session);
    return { wallet, transaction: existing, idempotent: true };
  }
  const charge = await PointTransaction.findOne({
    driverId,
    rideId,
    type: "RIDE_CHARGE",
    status: "COMPLETED",
  }).session(session);
  if (!charge) {
    throw new PointsError("No captured ride charge exists", 409, "RIDE_CHARGE_NOT_FOUND");
  }
  const priorRefunds = await PointTransaction.find({
    driverId,
    rideId,
    type: "TECHNICAL_REFUND",
    status: "COMPLETED",
  })
    .select("points")
    .session(session);
  const refundedPoints = priorRefunds.reduce(
    (total, transaction) => total + transaction.points,
    0
  );
  const refundablePoints = charge.points - refundedPoints;
  if (refundablePoints < 1) {
    throw new PointsError(
      "Ride points have already been fully refunded",
      409,
      "RIDE_CHARGE_ALREADY_REFUNDED"
    );
  }
  const refundPoints = points == null ? refundablePoints : Number(points);
  if (
    !Number.isSafeInteger(refundPoints) ||
    refundPoints < 1 ||
    refundPoints > refundablePoints
  ) {
    throw new PointsError("Refund points are invalid", 400, "INVALID_REFUND_POINTS");
  }
  const wallet = await ensureWallet(driverId, session);
  const bonusPoints = Math.min(charge.bonusPoints, refundPoints);
  const purchasedPoints = refundPoints - bonusPoints;
  const updated = await updateWalletWithVersion(
    wallet,
    {
      $inc: {
        availableBonusPoints: bonusPoints,
        availablePurchasedPoints: purchasedPoints,
        totalRefunded: refundPoints,
      },
    },
    session
  );
  const transaction = await addLedgerEntry(
    {
      driverId,
      type: "TECHNICAL_REFUND",
      status: "COMPLETED",
      points: refundPoints,
      bonusPoints,
      purchasedPoints,
      previousAvailableBalance: totalAvailable(wallet),
      newAvailableBalance: totalAvailable(updated),
      previousReservedBalance: totalReserved(wallet),
      newReservedBalance: totalReserved(updated),
      rideId,
      adminId,
      reason,
      idempotencyKey,
    },
    session
  );
  return { wallet: updated, transaction, idempotent: false };
};

export const debitPointsInSession = async ({
  driverId,
  points,
  type = "ADMIN_DEBIT",
  adminId,
  reason,
  idempotencyKey,
  metadata = {},
  session,
}) => {
  const existing = await PointTransaction.findOne({ idempotencyKey }).session(session);
  if (existing) {
    const wallet = await DriverPointsWallet.findOne({ driverId }).session(session);
    return { wallet, transaction: existing, idempotent: true };
  }
  const wallet = await ensureWallet(driverId, session);
  if (totalAvailable(wallet) < points) {
    throw new PointsError(
      "Insufficient available points for debit",
      409,
      "INSUFFICIENT_AVAILABLE_POINTS"
    );
  }
  const bonusPoints = Math.min(wallet.availableBonusPoints, points);
  const purchasedPoints = points - bonusPoints;
  const updated = await updateWalletWithVersion(
    wallet,
    {
      $inc: {
        availableBonusPoints: -bonusPoints,
        availablePurchasedPoints: -purchasedPoints,
        totalConsumed: points,
      },
    },
    session
  );
  const transaction = await addLedgerEntry(
    {
      driverId,
      type,
      status: "COMPLETED",
      points,
      bonusPoints,
      purchasedPoints,
      previousAvailableBalance: totalAvailable(wallet),
      newAvailableBalance: totalAvailable(updated),
      previousReservedBalance: totalReserved(wallet),
      newReservedBalance: totalReserved(updated),
      adminId,
      reason,
      idempotencyKey,
      metadata,
    },
    session
  );
  return { wallet: updated, transaction, idempotent: false };
};

export const queueWalletEvent = async ({
  eventKey,
  type,
  wallet,
  recipientId,
  payload,
  session,
}) =>
  addOutboxEvents(
    [
      {
        eventKey,
        type,
        aggregateType: "wallet",
        aggregateId: wallet._id,
        recipientId,
        recipientType: "Driver",
        payload: {
          ...payload,
          driverId: String(recipientId),
          walletVersion: wallet.version,
        },
      },
    ],
    session
  );

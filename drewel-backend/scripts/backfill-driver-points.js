import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import connectDB from "../src/connection.js";
import { loadEnv } from "../src/utils/loadEnv.js";

export const WELCOME_BONUS_IDEMPOTENCY_PREFIX = "welcome:";
export const DEFAULT_WELCOME_DRIVER_POINTS = 50;

const asPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const resolveWelcomePoints = (environment = process.env) =>
  asPositiveInteger(
    environment.WELCOME_DRIVER_POINTS,
    DEFAULT_WELCOME_DRIVER_POINTS
  );

export const normalizedDriverIdentity = (driver = {}) => {
  const countryCode = String(driver.countryCode || "").replace(/\D/g, "");
  const phone = String(driver.phone || "").replace(/\D/g, "");
  if (!phone) return "";
  return `${countryCode}:${phone}`;
};

export const getBackfillEligibility = (driver = {}, duplicateIdentities = new Set()) => {
  if (driver.isDeleted === true) return { eligible: false, reason: "deleted" };
  return { eligible: true, reason: "eligible" };
};

export const findDuplicateIdentityKeys = (drivers = []) => {
  const counts = new Map();
  for (const driver of drivers) {
    const key = normalizedDriverIdentity(driver);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key)
  );
};

export const createBackfillReport = ({ dryRun, welcomePoints }) => ({
  mode: dryRun ? "dry-run" : "apply",
  welcomePoints,
  scanned: 0,
  eligible: 0,
  walletsToCreate: 0,
  walletsCreated: 0,
  bonusesToGrant: 0,
  bonusesGranted: 0,
  alreadyGranted: 0,
  inconsistentWallets: 0,
  skipped: {
    deleted: 0,
    not_approved: 0,
    documents_not_verified: 0,
    missing_identity: 0,
    duplicate_identity: 0,
    welcome_bonus_disabled: 0,
  },
  errors: [],
  records: [],
});

const idString = (value) => String(value || "");

const inspectExistingState = async ({
  driver,
  Wallet,
  PointTransaction,
  session,
}) => {
  const idempotencyKey = `${WELCOME_BONUS_IDEMPOTENCY_PREFIX}${driver._id}`;
  const queryOptions = session ? { session } : {};
  const [wallet, transaction] = await Promise.all([
    Wallet.findOne({ driverId: driver._id }, null, queryOptions).lean(),
    PointTransaction.findOne(
      { idempotencyKey },
      { _id: 1, type: 1 },
      queryOptions
    ).lean(),
  ]);
  return { wallet, transaction, idempotencyKey };
};

export const runDriverPointsBackfill = async ({
  Driver,
  Wallet,
  PointTransaction,
  PointsOutboxEvent = null,
  dryRun = false,
  welcomePoints = DEFAULT_WELCOME_DRIVER_POINTS,
  startSession = () => mongoose.startSession(),
  now = () => new Date(),
}) => {
  const report = createBackfillReport({ dryRun, welcomePoints });
  const drivers = await Driver.collection
    .find(
      {},
      {
        projection: {
          countryCode: 1,
          phone: 1,
          status: 1,
          profileRequestStatus: 1,
          isApproved: 1,
          isDeleted: 1,
        },
      }
    )
    .toArray();
  const duplicateIdentities = findDuplicateIdentityKeys(drivers);
  report.scanned = drivers.length;

  for (const driver of drivers) {
    const eligibility = getBackfillEligibility(driver, duplicateIdentities);
    const record = {
      driverId: idString(driver._id),
      outcome: eligibility.reason,
    };
    if (!eligibility.eligible) {
      report.skipped[eligibility.reason] += 1;
      report.records.push(record);
      continue;
    }

    report.eligible += 1;
    if (welcomePoints === 0) {
      report.skipped.welcome_bonus_disabled += 1;
      record.outcome = "welcome_bonus_disabled";
      report.records.push(record);
      continue;
    }
    try {
      if (dryRun) {
        const state = await inspectExistingState({
          driver,
          Wallet,
          PointTransaction,
        });
        if (!state.wallet) report.walletsToCreate += 1;

        if (state.wallet?.welcomeBonusGranted || state.transaction) {
          report.alreadyGranted += 1;
          record.outcome = "already_granted";
          if (Boolean(state.wallet?.welcomeBonusGranted) !== Boolean(state.transaction)) {
            report.inconsistentWallets += 1;
            record.outcome = "inconsistent_existing_bonus";
          }
        } else {
          report.bonusesToGrant += 1;
          record.outcome = "would_grant";
        }
        report.records.push(record);
        continue;
      }

      const session = await startSession();
      try {
        let outcome = "already_granted";
        let createdWallet = false;
        await session.withTransaction(async () => {
          const state = await inspectExistingState({
            driver,
            Wallet,
            PointTransaction,
            session,
          });

          // A mismatch is never repaired automatically: without both records
          // there is no safe proof that adding points would not double-credit.
          if (Boolean(state.wallet?.welcomeBonusGranted) !== Boolean(state.transaction)) {
            outcome = "inconsistent_existing_bonus";
            return;
          }
          if (state.wallet?.welcomeBonusGranted && state.transaction) return;

          if (!state.wallet) {
            await Wallet.create([{ driverId: driver._id }], { session });
            createdWallet = true;
          }

          const grantTime = now();
          const previousAvailableBalance = state.wallet
            ? (state.wallet.availableBonusPoints || 0) +
              (state.wallet.availablePurchasedPoints || 0)
            : 0;
          const previousReservedBalance = state.wallet
            ? (state.wallet.reservedBonusPoints || 0) +
              (state.wallet.reservedPurchasedPoints || 0)
            : 0;
          const updatedWallet = await Wallet.findOneAndUpdate(
            {
              driverId: driver._id,
              welcomeBonusGranted: { $ne: true },
            },
            {
              $inc: {
                availableBonusPoints: welcomePoints,
                totalEarnedBonus: welcomePoints,
                version: 1,
              },
              $set: {
                welcomeBonusGranted: true,
                welcomeBonusGrantedAt: grantTime,
              },
            },
            {
              new: true,
              runValidators: true,
              session,
            }
          );
          if (!updatedWallet) {
            outcome = "already_granted";
            return;
          }

          await PointTransaction.create(
            [
              {
                driverId: driver._id,
                type: "WELCOME_BONUS",
                status: "COMPLETED",
                points: welcomePoints,
                bonusPoints: welcomePoints,
                purchasedPoints: 0,
                previousAvailableBalance,
                newAvailableBalance: previousAvailableBalance + welcomePoints,
                previousReservedBalance,
                newReservedBalance: previousReservedBalance,
                reason: "Welcome bonus backfill for an existing driver account",
                idempotencyKey: state.idempotencyKey,
                metadata: {
                  source: "backfill-driver-points",
                  version: 1,
                },
                createdAt: grantTime,
              },
            ],
            { session }
          );
          if (PointsOutboxEvent) {
            await PointsOutboxEvent.create(
              [
                {
                  eventKey: `welcome:${driver._id}:wallet`,
                  type: "points:credited",
                  aggregateType: "wallet",
                  aggregateId: updatedWallet._id,
                  recipientId: driver._id,
                  recipientType: "Driver",
                  payload: {
                    driverId: String(driver._id),
                    points: welcomePoints,
                    walletVersion: updatedWallet.version,
                    notification: {
                      type: "WELCOME_POINTS_RECEIVED",
                      message: `${welcomePoints} welcome points received`,
                    },
                  },
                },
              ],
              { session }
            );
          }
          outcome = "granted";
        });

        record.outcome = outcome;
        if (outcome === "granted") {
          report.bonusesGranted += 1;
          if (createdWallet) report.walletsCreated += 1;
        }
        else if (outcome === "inconsistent_existing_bonus") {
          report.inconsistentWallets += 1;
        } else {
          report.alreadyGranted += 1;
        }
      } finally {
        await session.endSession();
      }
    } catch (error) {
      // Duplicate-key races are treated as idempotent success only after the
      // next run observes both the wallet flag and unique ledger entry.
      report.errors.push({
        driverId: idString(driver._id),
        code: error?.code || "BACKFILL_ERROR",
        message: String(error?.message || error),
      });
      record.outcome = "error";
    }
    report.records.push(record);
  }

  return report;
};

const run = async () => {
  loadEnv();
  const dryRun = process.argv.includes("--dry-run");
  const welcomePoints = resolveWelcomePoints();
  await connectDB();

  const [
    { default: Driver },
    { default: Wallet },
    { default: PointTransaction },
    { default: PointsSettings },
    { default: PointsOutboxEvent },
  ] = await Promise.all([
    import("../src/models/Driver.js"),
    import("../src/models/DriverPointsWallet.js"),
    import("../src/models/PointTransaction.js"),
    import("../src/models/PointsSettings.js"),
    import("../src/models/PointsOutboxEvent.js"),
  ]);
  const effectiveSettings = await PointsSettings.getEffective();

  const report = await runDriverPointsBackfill({
    Driver,
    Wallet,
    PointTransaction,
    PointsOutboxEvent,
    dryRun,
    welcomePoints: effectiveSettings.welcomeDriverPoints ?? welcomePoints,
  });

  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length > 0 || report.inconsistentWallets > 0) {
    process.exitCode = 2;
  }
  await mongoose.connection.close();
};

if (
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
) {
  run().catch(async (error) => {
    console.error("Driver points backfill failed:", error);
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
    process.exit(1);
  });
}

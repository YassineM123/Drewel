import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_WELCOME_DRIVER_POINTS,
  findDuplicateIdentityKeys,
  getBackfillEligibility,
  normalizedDriverIdentity,
  resolveWelcomePoints,
  runDriverPointsBackfill,
} from "../scripts/backfill-driver-points.js";

const completedDriver = (overrides = {}) => ({
  _id: "driver-1",
  countryCode: "+216",
  phone: "22111222",
  status: "completed",
  profileRequestStatus: "approved",
  isApproved: true,
  isDeleted: false,
  ...overrides,
});

const queryResult = (value) => ({
  lean: async () => value,
});

const createDryRunDependencies = ({ drivers, wallets = {}, transactions = {} }) => ({
  Driver: {
    collection: {
      find: () => ({ toArray: async () => drivers }),
    },
  },
  Wallet: {
    findOne: ({ driverId }) => queryResult(wallets[String(driverId)] || null),
  },
  PointTransaction: {
    findOne: ({ idempotencyKey }) =>
      queryResult(transactions[idempotencyKey] || null),
  },
});

test("welcome points default safely and only accept positive integers", () => {
  assert.equal(resolveWelcomePoints({}), DEFAULT_WELCOME_DRIVER_POINTS);
  assert.equal(resolveWelcomePoints({ WELCOME_DRIVER_POINTS: "125" }), 125);
  assert.equal(resolveWelcomePoints({ WELCOME_DRIVER_POINTS: "0" }), 50);
  assert.equal(resolveWelcomePoints({ WELCOME_DRIVER_POINTS: "12.5" }), 50);
  assert.equal(resolveWelcomePoints({ WELCOME_DRIVER_POINTS: "invalid" }), 50);
});

test("backfill eligibility includes every non-deleted driver account", () => {
  assert.deepEqual(getBackfillEligibility(completedDriver()), {
    eligible: true,
    reason: "eligible",
  });
  assert.equal(
    getBackfillEligibility(completedDriver({ status: "approved" })).reason,
    "eligible"
  );
  assert.equal(
    getBackfillEligibility(
      completedDriver({ profileRequestStatus: "pending" })
    ).reason,
    "eligible"
  );
  assert.equal(
    getBackfillEligibility(completedDriver({ isApproved: false })).reason,
    "eligible"
  );
  assert.equal(
    getBackfillEligibility(completedDriver({ isDeleted: true })).reason,
    "deleted"
  );
});

test("identity helpers detect duplicates without excluding driver accounts", () => {
  const first = completedDriver({ _id: "one", countryCode: "+216", phone: "22 111 222" });
  const second = completedDriver({ _id: "two", countryCode: "216", phone: "22111222" });
  assert.equal(normalizedDriverIdentity(first), "216:22111222");
  const duplicates = findDuplicateIdentityKeys([first, second]);
  assert.deepEqual([...duplicates], ["216:22111222"]);
  assert.equal(getBackfillEligibility(first, duplicates).reason, "eligible");
});

test("dry run reports work without creating or mutating wallets", async () => {
  const calls = [];
  const deps = createDryRunDependencies({
    drivers: [
      completedDriver(),
      completedDriver({
        _id: "driver-pending",
        phone: "33111333",
        status: "approved",
      }),
    ],
  });
  deps.Wallet.create = async (...args) => calls.push(["create", ...args]);
  deps.Wallet.findOneAndUpdate = async (...args) => calls.push(["update", ...args]);
  deps.PointTransaction.create = async (...args) => calls.push(["ledger", ...args]);

  const report = await runDriverPointsBackfill({
    ...deps,
    dryRun: true,
    welcomePoints: 100,
  });

  assert.equal(report.scanned, 2);
  assert.equal(report.eligible, 2);
  assert.equal(report.walletsToCreate, 2);
  assert.equal(report.bonusesToGrant, 2);
  assert.equal(report.skipped.documents_not_verified, 0);
  assert.deepEqual(calls, []);
});

test("a zero configured welcome bonus performs no wallet or ledger write", async () => {
  const calls = [];
  const deps = createDryRunDependencies({
    drivers: [completedDriver()],
  });
  deps.Wallet.findOne = (...args) => {
    calls.push(["find-wallet", ...args]);
    return queryResult(null);
  };

  const report = await runDriverPointsBackfill({
    ...deps,
    dryRun: false,
    welcomePoints: 0,
    startSession: async () => {
      calls.push(["session"]);
      throw new Error("must not start a transaction");
    },
  });

  assert.equal(report.eligible, 1);
  assert.equal(report.skipped.welcome_bonus_disabled, 1);
  assert.equal(report.bonusesGranted, 0);
  assert.deepEqual(calls, []);
});

test("dry run is idempotent when wallet and immutable ledger already record bonus", async () => {
  const deps = createDryRunDependencies({
    drivers: [completedDriver()],
    wallets: {
      "driver-1": { welcomeBonusGranted: true },
    },
    transactions: {
      "welcome:driver-1": {
        _id: "transaction-1",
        type: "WELCOME_BONUS",
      },
    },
  });

  const report = await runDriverPointsBackfill({
    ...deps,
    dryRun: true,
  });

  assert.equal(report.bonusesToGrant, 0);
  assert.equal(report.alreadyGranted, 1);
  assert.equal(report.inconsistentWallets, 0);
  assert.equal(report.records[0].outcome, "already_granted");
});

test("dry run flags partial historical bonus state instead of risking double credit", async () => {
  const deps = createDryRunDependencies({
    drivers: [completedDriver()],
    wallets: {
      "driver-1": { welcomeBonusGranted: true },
    },
  });

  const report = await runDriverPointsBackfill({
    ...deps,
    dryRun: true,
  });

  assert.equal(report.alreadyGranted, 1);
  assert.equal(report.inconsistentWallets, 1);
  assert.equal(report.records[0].outcome, "inconsistent_existing_bonus");
});

test("applied backfill creates one wallet and one bonus across repeated runs", async () => {
  let wallet = null;
  let transaction = null;
  let walletCreates = 0;
  let ledgerCreates = 0;
  const deps = {
    Driver: {
      collection: {
        find: () => ({ toArray: async () => [completedDriver()] }),
      },
    },
    Wallet: {
      findOne: () => queryResult(wallet),
      create: async () => {
        walletCreates += 1;
        wallet = {
          driverId: "driver-1",
          availableBonusPoints: 0,
          availablePurchasedPoints: 0,
          reservedBonusPoints: 0,
          reservedPurchasedPoints: 0,
          totalEarnedBonus: 0,
          welcomeBonusGranted: false,
          version: 0,
        };
      },
      findOneAndUpdate: async () => {
        if (wallet.welcomeBonusGranted) return null;
        wallet.availableBonusPoints += 50;
        wallet.totalEarnedBonus += 50;
        wallet.version += 1;
        wallet.welcomeBonusGranted = true;
        wallet.welcomeBonusGrantedAt = new Date("2026-07-29T00:00:00.000Z");
        return wallet;
      },
    },
    PointTransaction: {
      findOne: () => queryResult(transaction),
      create: async ([entry]) => {
        ledgerCreates += 1;
        transaction = entry;
      },
    },
    startSession: async () => ({
      withTransaction: async (work) => work(),
      endSession: async () => {},
    }),
    now: () => new Date("2026-07-29T00:00:00.000Z"),
  };

  const first = await runDriverPointsBackfill(deps);
  const second = await runDriverPointsBackfill(deps);

  assert.equal(first.bonusesGranted, 1);
  assert.equal(first.walletsCreated, 1);
  assert.equal(second.bonusesGranted, 0);
  assert.equal(second.alreadyGranted, 1);
  assert.equal(walletCreates, 1);
  assert.equal(ledgerCreates, 1);
  assert.equal(wallet.availableBonusPoints, 50);
  assert.equal(transaction.idempotencyKey, "welcome:driver-1");
  assert.equal(transaction.newAvailableBalance, 50);
});

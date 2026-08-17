import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { loadEnv } from "../src/utils/loadEnv.js";
import Driver from "../src/models/Driver.js";
import User from "../src/models/User.js";
import Admin from "../src/models/Admin.js";
import Ride from "../src/models/Ride.js";
import RideMessage from "../src/models/RideMessage.js";
import DriverPointsWallet from "../src/models/DriverPointsWallet.js";
import PointTransaction from "../src/models/PointTransaction.js";
import TripOffer from "../src/models/TripOffer.js";
import PointPurchaseRequest from "../src/models/PointPurchaseRequest.js";
import PointsOutboxEvent from "../src/models/PointsOutboxEvent.js";
import PointsSettings from "../src/models/PointsSettings.js";
import PointsAdminAudit from "../src/models/PointsAdminAudit.js";
import {
  grantWelcomeBonus,
  isWelcomeBonusEligible,
  runPointsTransaction,
  creditPointsInSession,
} from "../src/services/pointsWalletService.js";
import {
  acceptTripOffer,
  closeTripOffer,
  createTripOffer,
  expireTripOffers,
} from "../src/services/tripOfferService.js";
import { transitionDriverRequest } from "../src/services/driverRequestTransitionService.js";
import {
  requirePointsAdjustment,
  requirePointsOwner,
  resolvePointsPermissions,
} from "../src/middlewares/pointsAuthorization.js";
import { getMyPointsWallet } from "../src/controllers/driverPointsController.js";
import {
  creditDriverPoints,
  creditVerifiedPointPurchaseRequest,
  debitDriverPoints,
  getPointsOverview,
  updatePointPurchaseRequest,
} from "../src/controllers/adminPointsController.js";
import { assertNoDirectBalanceMutation } from "../src/helpers/pointsValidation.js";
import { issueAppAuthToken } from "../src/controllers/authController.js";

const testDbName = process.env.POINTS_INTEGRATION_TEST_DB || "";
const integrationEnabled = /^drewel-points-test-[a-z0-9-]+$/i.test(testDbName);

const driverData = (suffix, overrides = {}) => ({
  countryCode: "+216",
  phone: `22${String(suffix).padStart(6, "0")}`,
  firstName: "Points",
  lastName: `Driver ${suffix}`,
  fullName: `Points Driver ${suffix}`,
  isVerified: true,
  isApproved: true,
  status: "completed",
  profileRequestStatus: "approved",
  profileApprovedAt: new Date(),
  completedAt: new Date(),
  isOnline: true,
  availabilityStatus: "Online",
  ...overrides,
});

const offerPayload = ({ driver, contact, suffix = "00000001" }) => ({
  driverId: driver._id,
  contactRideId: contact._id,
  clientOfferId: `client-${suffix}`,
  idempotencyKey: `idem-${suffix}`,
  requestFingerprint: "a".repeat(64),
  offeredPrice: 50,
  currency: "TND",
  pickup: { lat: 36.8, long: 10.18, address: "Pickup" },
  destination: { lat: 36.81, long: 10.2, address: "Destination" },
  vehicleType: "car",
  note: "",
});

before(async () => {
  if (!integrationEnabled) return;
  loadEnv();
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri, {
    dbName: testDbName,
    serverSelectionTimeoutMS: 30_000,
  });
  await Promise.all(
    [
      Driver,
      User,
      Admin,
      Ride,
      DriverPointsWallet,
      PointTransaction,
      TripOffer,
      PointPurchaseRequest,
      PointsOutboxEvent,
      PointsSettings,
      PointsAdminAudit,
    ].map((model) => model.syncIndexes())
  );
});

after(async () => {
  if (!integrationEnabled || mongoose.connection.readyState === 0) return;
  if (!mongoose.connection.name.startsWith("drewel-points-test-")) {
    throw new Error("Refusing to clean a non-test MongoDB database");
  }
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

test("welcome eligibility includes every non-deleted driver account", () => {
  assert.equal(isWelcomeBonusEligible(driverData(1)), true);
  assert.equal(isWelcomeBonusEligible(driverData(2, { status: "approved" })), true);
  assert.equal(
    isWelcomeBonusEligible(driverData(3, { profileRequestStatus: "pending" })),
    true
  );
  assert.equal(isWelcomeBonusEligible(driverData(4, { isDeleted: true })), false);
});

test(
  "welcome bonus is granted once under concurrent requests",
  { skip: !integrationEnabled },
  async () => {
    const driver = await Driver.create(driverData(10));
    const results = await Promise.all(
      Array.from({ length: 10 }, () => grantWelcomeBonus(driver))
    );
    const [wallet, ledgerCount] = await Promise.all([
      DriverPointsWallet.findOne({ driverId: driver._id }),
      PointTransaction.countDocuments({
        driverId: driver._id,
        type: "WELCOME_BONUS",
      }),
    ]);
    assert.equal(results.filter((result) => result.granted).length, 1);
    assert.equal(wallet.availableBonusPoints, 100);
    assert.equal(wallet.welcomeBonusGranted, true);
    assert.equal(ledgerCount, 1);
  }
);

test(
  "repeated final approval requests still create one welcome bonus",
  { skip: !integrationEnabled },
  async () => {
    const [driver, admin] = await Promise.all([
      Driver.create(
        driverData(15, {
          status: "approved",
          profileRequestStatus: "pending",
          profileApprovedAt: null,
          completedAt: null,
        })
      ),
      Admin.create({
        fullName: "Approval Admin",
        email: "approval-admin@points.test",
        password: "not-used-in-test",
        role: "admin",
      }),
    ]);
    const operation = () =>
      transitionDriverRequest({
        requestId: driver._id,
        newStatus: "approved",
        requestStage: "profile",
        actor: {
          _id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          actorType: "admin",
        },
      });
    const settled = await Promise.allSettled([operation(), operation()]);
    assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1);
    const wallet = await DriverPointsWallet.findOne({ driverId: driver._id });
    assert.equal(wallet.availableBonusPoints, 100);
    assert.equal(
      await PointTransaction.countDocuments({
        driverId: driver._id,
        type: "WELCOME_BONUS",
      }),
      1
    );
  }
);

test(
  "offer requires 20 available points and duplicate send reserves once",
  { skip: !integrationEnabled },
  async () => {
    const [driver, passenger] = await Promise.all([
      Driver.create(driverData(20)),
      User.create({ phone: "55000020", countryCode: "+216", isVerified: true }),
    ]);
    const contact = await Ride.create({
      passengerId: passenger._id,
      driverId: driver._id,
      status: "contacting",
      reference: "POINTS-20",
    });
    await DriverPointsWallet.create({
      driverId: driver._id,
      availableBonusPoints: 19,
    });
    await assert.rejects(
      createTripOffer(offerPayload({ driver, contact, suffix: "00000020" })),
      (error) => error.code === "INSUFFICIENT_AVAILABLE_POINTS"
    );
    await DriverPointsWallet.updateOne(
      { driverId: driver._id },
      { $inc: { availableBonusPoints: 81, totalEarnedBonus: 100, version: 1 } }
    );
    const payload = offerPayload({ driver, contact, suffix: "00000021" });
    const first = await createTripOffer(payload);
    const retry = await createTripOffer(payload);
    const wallet = await DriverPointsWallet.findOne({ driverId: driver._id });
    assert.equal(first.idempotent, false);
    assert.equal(retry.idempotent, true);
    assert.equal(wallet.availableBonusPoints, 80);
    assert.equal(wallet.reservedBonusPoints, 20);
    assert.equal(
      await PointTransaction.countDocuments({
        offerId: first.offer._id,
        type: "OFFER_RESERVE",
      }),
      1
    );
  }
);

test(
  "offer can use the passenger trip request route when the contact ride is missing route fields",
  { skip: !integrationEnabled },
  async () => {
    const [driver, passenger] = await Promise.all([
      Driver.create(driverData(22)),
      User.create({ phone: "55000022", countryCode: "+216", isVerified: true }),
    ]);
    await DriverPointsWallet.create({
      driverId: driver._id,
      availableBonusPoints: 100,
      totalEarnedBonus: 100,
    });
    const contact = await Ride.create({
      passengerId: passenger._id,
      driverId: driver._id,
      status: "contacting",
      reference: "POINTS-22",
    });
    await RideMessage.create({
      rideId: contact._id,
      senderId: passenger._id,
      senderRole: "passenger",
      text: "Trip request: 45 TND",
      clientMessageId: "trip-request-22",
      messageType: "trip_request",
      metadata: {
        pickup: { lat: 36.8, long: 10.18, address: "Passenger pickup" },
        destination: { lat: 36.81, long: 10.2, address: "Passenger destination" },
        proposedPrice: 45,
        currency: "TND",
        tripRequestStatus: "active",
      },
    });
    const created = await createTripOffer(
      offerPayload({ driver, contact, suffix: "00000022" })
    );
    const reloadedContact = await Ride.findById(contact._id);

    assert.equal(created.offer.pickup.address, "Passenger pickup");
    assert.equal(created.offer.destination.address, "Passenger destination");
    assert.equal(reloadedContact.pickup.address, "Passenger pickup");
    assert.equal(reloadedContact.destination.address, "Passenger destination");
  }
);

test(
  "offer route must match the latest passenger trip request",
  { skip: !integrationEnabled },
  async () => {
    const [driver, passenger] = await Promise.all([
      Driver.create(driverData(23)),
      User.create({ phone: "55000023", countryCode: "+216", isVerified: true }),
    ]);
    await DriverPointsWallet.create({
      driverId: driver._id,
      availableBonusPoints: 100,
      totalEarnedBonus: 100,
    });
    const contact = await Ride.create({
      passengerId: passenger._id,
      driverId: driver._id,
      status: "contacting",
      reference: "POINTS-23",
    });
    await RideMessage.create({
      rideId: contact._id,
      senderId: passenger._id,
      senderRole: "passenger",
      text: "Trip request: 45 TND",
      clientMessageId: "trip-request-23",
      messageType: "trip_request",
      metadata: {
        pickup: { lat: 35, long: 10, address: "Different pickup" },
        destination: { lat: 35.1, long: 10.1, address: "Different destination" },
        proposedPrice: 45,
        currency: "TND",
        tripRequestStatus: "active",
      },
    });

    await assert.rejects(
      createTripOffer(offerPayload({ driver, contact, suffix: "00000023" })),
      (error) => error.code === "ROUTE_REQUEST_REQUIRED"
    );
  }
);

test(
  "a technical offer creation failure rolls reservation and ledger back",
  { skip: !integrationEnabled },
  async () => {
    const [driver, passenger] = await Promise.all([
      Driver.create(driverData(25)),
      User.create({ phone: "55000025", countryCode: "+216", isVerified: true }),
    ]);
    await DriverPointsWallet.create({
      driverId: driver._id,
      availableBonusPoints: 100,
      totalEarnedBonus: 100,
    });
    const contact = await Ride.create({
      passengerId: passenger._id,
      driverId: driver._id,
      status: "contacting",
      reference: "POINTS-25",
    });
    await assert.rejects(
      createTripOffer({
        ...offerPayload({ driver, contact, suffix: "00000025" }),
        currency: "INVALID",
      })
    );
    const wallet = await DriverPointsWallet.findOne({ driverId: driver._id });
    assert.equal(wallet.availableBonusPoints, 100);
    assert.equal(wallet.reservedBonusPoints, 0);
    assert.equal(await TripOffer.countDocuments({ driverId: driver._id }), 0);
    assert.equal(
      await PointTransaction.countDocuments({
        driverId: driver._id,
        type: "OFFER_RESERVE",
      }),
      0
    );
  }
);

test(
  "decline and expiration release reservations exactly once",
  { skip: !integrationEnabled },
  async () => {
    const [driver, passenger] = await Promise.all([
      Driver.create(driverData(30)),
      User.create({ phone: "55000030", countryCode: "+216", isVerified: true }),
    ]);
    await DriverPointsWallet.create({
      driverId: driver._id,
      availableBonusPoints: 100,
      totalEarnedBonus: 100,
    });
    const contact = await Ride.create({
      passengerId: passenger._id,
      driverId: driver._id,
      status: "contacting",
      reference: "POINTS-30",
    });
    const created = await createTripOffer(
      offerPayload({ driver, contact, suffix: "00000030" })
    );
    await Promise.all([
      closeTripOffer({
        offerId: created.offer._id,
        actorId: passenger._id,
        actorRole: "passenger",
        terminalStatus: "declined",
        reason: "Declined",
      }),
      closeTripOffer({
        offerId: created.offer._id,
        actorId: passenger._id,
        actorRole: "passenger",
        terminalStatus: "declined",
        reason: "Declined",
      }),
    ]);
    const wallet = await DriverPointsWallet.findOne({ driverId: driver._id });
    assert.equal(wallet.availableBonusPoints, 100);
    assert.equal(wallet.reservedBonusPoints, 0);
    assert.equal(
      await PointTransaction.countDocuments({
        offerId: created.offer._id,
        type: "OFFER_RELEASE",
      }),
      1
    );

    const expiring = await createTripOffer(
      offerPayload({ driver, contact, suffix: "00000031" })
    );
    await TripOffer.collection.updateOne(
      { _id: expiring.offer._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
    assert.equal(await expireTripOffers(), 1);
    assert.equal(await expireTripOffers(), 0);
  }
);

test(
  "double acceptance creates one ride charge and never a negative balance",
  { skip: !integrationEnabled },
  async () => {
    const [driver, passenger] = await Promise.all([
      Driver.create(driverData(40)),
      User.create({ phone: "55000040", countryCode: "+216", isVerified: true }),
    ]);
    await DriverPointsWallet.create({
      driverId: driver._id,
      availableBonusPoints: 10,
      availablePurchasedPoints: 10,
      totalEarnedBonus: 10,
      totalPurchased: 10,
    });
    const contact = await Ride.create({
      passengerId: passenger._id,
      driverId: driver._id,
      status: "contacting",
      reference: "POINTS-40",
    });
    const created = await createTripOffer(
      offerPayload({ driver, contact, suffix: "00000040" })
    );
    const accepted = await Promise.all([
      acceptTripOffer({ offerId: created.offer._id, passengerId: passenger._id }),
      acceptTripOffer({ offerId: created.offer._id, passengerId: passenger._id }),
    ]);
    const wallet = await DriverPointsWallet.findOne({ driverId: driver._id });
    assert.equal(new Set(accepted.map((result) => String(result.ride._id))).size, 1);
    assert.equal(wallet.availableBonusPoints, 0);
    assert.equal(wallet.availablePurchasedPoints, 0);
    assert.equal(wallet.reservedBonusPoints, 0);
    assert.equal(wallet.reservedPurchasedPoints, 0);
    assert.equal(wallet.totalConsumed, 20);
    assert.equal(
      await PointTransaction.countDocuments({
        offerId: created.offer._id,
        type: "RIDE_CHARGE",
      }),
      1
    );
  }
);

test(
  "concurrent distinct offers cannot overspend one 20 point wallet",
  { skip: !integrationEnabled },
  async () => {
    const [driver, passenger1, passenger2] = await Promise.all([
      Driver.create(driverData(50)),
      User.create({ phone: "55000050", countryCode: "+216", isVerified: true }),
      User.create({ phone: "55000051", countryCode: "+216", isVerified: true }),
    ]);
    await DriverPointsWallet.create({
      driverId: driver._id,
      availableBonusPoints: 20,
      totalEarnedBonus: 20,
    });
    const [contact1, contact2] = await Promise.all([
      Ride.create({
        passengerId: passenger1._id,
        driverId: driver._id,
        status: "contacting",
        reference: "POINTS-50",
      }),
      Ride.create({
        passengerId: passenger2._id,
        driverId: driver._id,
        status: "contacting",
        reference: "POINTS-51",
      }),
    ]);
    const settled = await Promise.allSettled([
      createTripOffer(offerPayload({ driver, contact: contact1, suffix: "00000050" })),
      createTripOffer(offerPayload({ driver, contact: contact2, suffix: "00000051" })),
    ]);
    assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(settled.filter((item) => item.status === "rejected").length, 1);
    const wallet = await DriverPointsWallet.findOne({ driverId: driver._id });
    assert.equal(wallet.availableBonusPoints, 0);
    assert.equal(wallet.reservedBonusPoints, 20);
    assert.equal(await TripOffer.countDocuments({ driverId: driver._id }), 1);
  }
);

test(
  "duplicate admin credit idempotency key credits once",
  { skip: !integrationEnabled },
  async () => {
    const driver = await Driver.create(driverData(60));
    const adminId = new mongoose.Types.ObjectId();
    const operation = () =>
      runPointsTransaction((session) =>
        creditPointsInSession({
          driverId: driver._id,
          points: 50,
          purchased: true,
          type: "ADMIN_CREDIT",
          adminId,
          paymentReference: "PAY-POINTS-60",
          reason: "Verified manual payment",
          idempotencyKey: "integration-admin-credit-60",
          metadata: { source: "integration-test" },
          session,
        })
      );
    const settled = await Promise.allSettled([operation(), operation()]);
    assert.equal(settled.filter((item) => item.status === "fulfilled").length >= 1, true);
    const wallet = await DriverPointsWallet.findOne({ driverId: driver._id });
    assert.equal(wallet.availablePurchasedPoints, 50);
    assert.equal(
      await PointTransaction.countDocuments({
        idempotencyKey: "integration-admin-credit-60",
      }),
      1
    );
  }
);

const responseRecorder = () => {
  const result = { statusCode: 200, body: null };
  return {
    result,
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
    set() {
      return this;
    },
  };
};

test("point settings and pack mutations require an owner", () => {
  const ownerGuard = requirePointsOwner[1];
  const denied = responseRecorder();
  let nextCalled = false;
  ownerGuard(
    { pointsAdmin: { isOwner: false, isFinanceAdmin: true } },
    denied,
    () => {
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, false);
  assert.equal(denied.result.statusCode, 403);
  assert.equal(denied.result.body.code, "POINTS_OWNER_REQUIRED");

  ownerGuard(
    { pointsAdmin: { isOwner: true } },
    responseRecorder(),
    () => {
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, true);
});

test("plain administrators cannot gain points access through capability fields", () => {
  assert.equal(
    resolvePointsPermissions({
      role: "admin",
      permissions: ["points.*"],
    }).size,
    0
  );
  assert.equal(
    resolvePointsPermissions({ role: "finance_admin" }).has("points.adjust"),
    true
  );
});

test("verified purchase credit requires an explicit administrator reason", async () => {
  const response = responseRecorder();
  await creditVerifiedPointPurchaseRequest(
    {
      params: { id: String(new mongoose.Types.ObjectId()) },
      body: { confirmation: true },
      headers: { "idempotency-key": "purchase-credit-reason-required-0001" },
      get(name) {
        return this.headers[String(name).toLowerCase()];
      },
      pointsAdmin: {
        id: new mongoose.Types.ObjectId(),
        role: "owner",
        isOwner: true,
      },
    },
    response
  );
  assert.equal(response.result.statusCode, 400);
  assert.equal(response.result.body.code, "POINTS_VALIDATION_ERROR");
  assert.match(response.result.body.message, /reason/i);
});

test(
  "plain admins cannot adjust points and passengers cannot read driver wallets",
  { skip: !integrationEnabled },
  async () => {
    const [admin, passenger] = await Promise.all([
      Admin.create({
        fullName: "Plain Admin",
        email: "plain-admin@points.test",
        password: "not-used-in-test",
        role: "admin",
      }),
      User.create({ phone: "55000070", countryCode: "+216", isVerified: true }),
    ]);
    const adminResponse = responseRecorder();
    let nextCalled = false;
    await requirePointsAdjustment(
      { user: { _id: admin._id } },
      adminResponse,
      () => {
        nextCalled = true;
      }
    );
    assert.equal(nextCalled, false);
    assert.equal(adminResponse.result.statusCode, 403);

    const passengerResponse = responseRecorder();
    await getMyPointsWallet(
      { user: { _id: passenger._id } },
      passengerResponse
    );
    assert.equal(passengerResponse.result.statusCode, 403);
    assert.equal(passengerResponse.result.body.code, "DRIVER_REQUIRED");
  }
);

test(
  "purchase request lifecycle never credits points until the credit operation",
  { skip: !integrationEnabled },
  async () => {
    const driver = await Driver.create(driverData(80));
    const owner = await Admin.create({
      fullName: "Points Owner",
      email: "owner@points.test",
      password: "not-used-in-test",
      role: "owner",
    });
    const request = await PointPurchaseRequest.create({
      driverId: driver._id,
      requestedPoints: 75,
      clientRequestId: "purchase-00000080",
      status: "pending",
    });
    for (const transition of [
      { status: "contacted", confirmation: true },
      { status: "payment_pending", confirmation: true },
      {
        status: "payment_verified",
        confirmation: true,
        paymentReference: "PAY-REQUEST-80",
        paymentAmount: 25,
        currency: "TND",
        paymentMethod: "cash",
      },
    ]) {
      const response = responseRecorder();
      await updatePointPurchaseRequest(
        {
          params: { id: String(request._id) },
          body: transition,
          pointsAdmin: { id: owner._id },
        },
        response
      );
      assert.equal(response.result.statusCode, 200);
      assert.equal(response.result.body.request.status, transition.status);
    }
    assert.equal(
      await DriverPointsWallet.countDocuments({ driverId: driver._id }),
      0
    );
    assert.equal(
      await PointTransaction.countDocuments({ driverId: driver._id }),
      0
    );
  }
);

test(
  "verified purchase credit endpoint is idempotent and creates immutable audit evidence",
  { skip: !integrationEnabled },
  async () => {
    const [driver, owner] = await Promise.all([
      Driver.create(driverData(85)),
      Admin.create({
        fullName: "Purchase Credit Owner",
        email: "purchase-credit-owner@points.test",
        password: "not-used-in-test",
        role: "owner",
      }),
    ]);
    const purchaseRequest = await PointPurchaseRequest.create({
      driverId: driver._id,
      requestedPoints: 60,
      clientRequestId: "purchase-credit-00000085",
      status: "payment_verified",
      paymentReference: "PAY-CREDIT-85",
      paymentAmount: 30,
      currency: "TND",
      paymentMethod: "cash",
      paymentVerifiedAt: new Date(),
    });
    const invoke = async () => {
      const response = responseRecorder();
      await creditVerifiedPointPurchaseRequest(
        {
          params: { id: String(purchaseRequest._id) },
          body: { confirmation: true, reason: "Payment verified by owner" },
          headers: {
            "idempotency-key": "purchase-credit-request-00000085",
            "user-agent": "node-test",
          },
          get(name) {
            return this.headers[String(name).toLowerCase()];
          },
          ip: "127.0.0.1",
          pointsAdmin: {
            id: owner._id,
            role: "owner",
            isOwner: true,
          },
        },
        response
      );
      return response.result;
    };
    const first = await invoke();
    const replay = await invoke();
    assert.equal(first.statusCode, 201);
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.body.idempotent, true);
    const [wallet, request, ledgerCount, audits] = await Promise.all([
      DriverPointsWallet.findOne({ driverId: driver._id }),
      PointPurchaseRequest.findById(purchaseRequest._id),
      PointTransaction.countDocuments({
        purchaseRequestId: purchaseRequest._id,
        type: "POINTS_PURCHASE",
      }),
      PointsAdminAudit.find({
        purchaseRequestId: purchaseRequest._id,
        action: "POINTS_CREDIT",
      }),
    ]);
    assert.equal(wallet.availablePurchasedPoints, 60);
    assert.equal(request.status, "credited");
    assert.equal(ledgerCount, 1);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].previousAvailableBalance, 0);
    assert.equal(audits[0].newAvailableBalance, 60);
    assert.equal(audits[0].pointsChange, 60);
  }
);

test(
  "generic administrator credit endpoint cannot credit purchased points",
  { skip: !integrationEnabled },
  async () => {
    const [driver, owner] = await Promise.all([
      Driver.create(driverData(86)),
      Admin.create({
        fullName: "Generic Credit Owner",
        email: "generic-credit-owner@points.test",
        password: "not-used-in-test",
        role: "owner",
      }),
    ]);
    const response = responseRecorder();
    await creditDriverPoints(
      {
        body: {
          driverId: String(driver._id),
          points: 60,
          source: "purchase",
          purchaseRequestId: String(new mongoose.Types.ObjectId()),
          paymentReference: "PAY-BYPASS-86",
          paymentAmount: 30,
          currency: "TND",
          paymentMethod: "cash",
          reason: "Attempted generic purchase credit",
          confirmation: true,
        },
        headers: { "idempotency-key": "generic-purchase-bypass-00000086" },
        get(name) {
          return this.headers[String(name).toLowerCase()];
        },
        user: { iat: Math.floor(Date.now() / 1000) },
        pointsAdmin: { id: owner._id, role: "owner", isOwner: true },
      },
      response
    );

    assert.equal(response.result.statusCode, 400);
    assert.equal(response.result.body.code, "POINTS_VALIDATION_ERROR");
    assert.equal(
      await PointTransaction.countDocuments({ driverId: driver._id }),
      0
    );
    assert.equal(
      await PointsAdminAudit.countDocuments({ driverId: driver._id }),
      0
    );
  }
);

test(
  "literal lifecycle declines one offer, charges five rides, reaches zero, and blocks the sixth",
  { skip: !integrationEnabled },
  async () => {
    const [driver, passenger] = await Promise.all([
      Driver.create(driverData(91)),
      User.create({ phone: "55000091", countryCode: "+216", isVerified: true }),
    ]);
    await grantWelcomeBonus(driver);
    let contact = await Ride.create({
      passengerId: passenger._id,
      driverId: driver._id,
      status: "contacting",
      reference: "POINTS-LITERAL-DECLINE",
    });
    const declined = await createTripOffer(
      offerPayload({ driver, contact, suffix: "00000191" })
    );
    await closeTripOffer({
      offerId: declined.offer._id,
      actorId: passenger._id,
      actorRole: "passenger",
      terminalStatus: "declined",
      reason: "Literal lifecycle decline",
    });
    let wallet = await DriverPointsWallet.findOne({ driverId: driver._id });
    assert.equal(wallet.availableBonusPoints, 100);
    assert.equal(wallet.reservedBonusPoints, 0);

    const acceptedRideIds = [];
    for (let index = 0; index < 5; index += 1) {
      if (index > 0) {
        contact = await Ride.create({
          passengerId: passenger._id,
          driverId: driver._id,
          status: "contacting",
          reference: `POINTS-LITERAL-${index}`,
        });
      }
      const offer = await createTripOffer(
        offerPayload({
          driver,
          contact,
          suffix: `0000019${index + 2}`,
        })
      );
      const accepted = await acceptTripOffer({
        offerId: offer.offer._id,
        passengerId: passenger._id,
      });
      acceptedRideIds.push(String(accepted.ride._id));
      await Promise.all([
        Ride.updateOne(
          { _id: accepted.ride._id },
          { $set: { status: "completed", endedAt: new Date() } }
        ),
        Driver.updateOne(
          { _id: driver._id },
          { $set: { availabilityStatus: "Online", isOnline: true } }
        ),
      ]);
    }
    wallet = await DriverPointsWallet.findOne({ driverId: driver._id });
    assert.equal(new Set(acceptedRideIds).size, 5);
    assert.equal(wallet.availableBonusPoints, 0);
    assert.equal(wallet.reservedBonusPoints, 0);
    assert.equal(wallet.totalConsumed, 100);
    assert.equal(
      await PointTransaction.countDocuments({
        driverId: driver._id,
        type: "RIDE_CHARGE",
      }),
      5
    );
    const blockedContact = await Ride.create({
      passengerId: passenger._id,
      driverId: driver._id,
      status: "contacting",
      reference: "POINTS-LITERAL-BLOCKED",
    });
    await assert.rejects(
      createTripOffer(
        offerPayload({
          driver,
          contact: blockedContact,
          suffix: "00000199",
        })
      ),
      (error) => error.code === "INSUFFICIENT_AVAILABLE_POINTS"
    );
    assert.equal(
      await PointTransaction.countDocuments({
        driverId: driver._id,
        type: "WELCOME_BONUS",
      }),
      1
    );
  }
);

test(
  "payment verification rejects an already-used payment reference",
  { skip: !integrationEnabled },
  async () => {
    const [driver, owner] = await Promise.all([
      Driver.create(driverData(87)),
      Admin.create({
        fullName: "Duplicate Payment Owner",
        email: "duplicate-payment-owner@points.test",
        password: "not-used-in-test",
        role: "owner",
      }),
    ]);
    const requests = await PointPurchaseRequest.create([
      {
        driverId: driver._id,
        requestedPoints: 20,
        clientRequestId: "duplicate-payment-00000087-a",
        status: "payment_pending",
      },
      {
        driverId: driver._id,
        requestedPoints: 20,
        clientRequestId: "duplicate-payment-00000087-b",
        status: "payment_pending",
      },
    ]);
    const verify = async (request) => {
      const response = responseRecorder();
      await updatePointPurchaseRequest(
        {
          params: { id: String(request._id) },
          body: {
            status: "payment_verified",
            confirmation: true,
            paymentReference: "PAY-DUPLICATE-87",
            paymentAmount: 10,
            currency: "TND",
            paymentMethod: "cash",
          },
          pointsAdmin: { id: owner._id, role: "owner", isOwner: true },
        },
        response
      );
      return response.result;
    };

    assert.equal((await verify(requests[0])).statusCode, 200);
    const duplicate = await verify(requests[1]);
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.body.code, "DUPLICATE_PAYMENT_REFERENCE");
    assert.equal(
      await PointPurchaseRequest.countDocuments({
        paymentReference: "PAY-DUPLICATE-87",
      }),
      1
    );
  }
);

test("modified clients cannot submit balances at any nesting depth", () => {
  for (const payload of [
    { newBalance: 999999 },
    { metadata: { available_points: 999999 } },
    { nested: { RESERVED_POINTS: -20 } },
  ]) {
    assert.throws(
      () => assertNoDirectBalanceMutation(payload),
      (error) => error.code === "DIRECT_BALANCE_MUTATION_FORBIDDEN"
    );
  }
});

test("driver and passenger authentication tokens have a configurable expiry", () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousExpiry = process.env.APP_JWT_EXPIRES_IN;
  try {
    process.env.JWT_SECRET = "test-only-jwt-secret-with-sufficient-entropy";
    process.env.APP_JWT_EXPIRES_IN = "15m";
    const decoded = jwt.verify(
      issueAppAuthToken(new mongoose.Types.ObjectId()),
      process.env.JWT_SECRET
    );
    assert.equal(decoded.exp - decoded.iat, 15 * 60);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousExpiry === undefined) delete process.env.APP_JWT_EXPIRES_IN;
    else process.env.APP_JWT_EXPIRES_IN = previousExpiry;
  }
});

test(
  "negative debit is rejected and an idempotent debit replay queues one update",
  { skip: !integrationEnabled },
  async () => {
    const [driver, owner] = await Promise.all([
      Driver.create(driverData(88)),
      Admin.create({
        fullName: "Debit Replay Owner",
        email: "debit-replay-owner@points.test",
        password: "not-used-in-test",
        role: "owner",
      }),
    ]);
    await DriverPointsWallet.create({
      driverId: driver._id,
      availablePurchasedPoints: 20,
      totalPurchased: 20,
    });
    const invoke = async (points, key) => {
      const response = responseRecorder();
      const headers = {
        "idempotency-key": key,
        "user-agent": "node-debit-test",
      };
      await debitDriverPoints(
        {
          body: {
            driverId: String(driver._id),
            points,
            source: "correction",
            reason: "Audited correction",
            confirmation: true,
          },
          headers,
          get(name) {
            return headers[String(name).toLowerCase()];
          },
          ip: "127.0.0.1",
          user: { iat: Math.floor(Date.now() / 1000) },
          pointsAdmin: { id: owner._id, role: "owner", isOwner: true },
        },
        response
      );
      return response.result;
    };
    const rejected = await invoke(21, "negative-debit-attempt-00000088");
    assert.equal(rejected.statusCode, 409);
    assert.equal(rejected.body.code, "INSUFFICIENT_AVAILABLE_POINTS");
    const first = await invoke(10, "debit-replay-00000088");
    const replay = await invoke(10, "debit-replay-00000088");
    assert.equal(first.statusCode, 201);
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.body.idempotent, true);
    const transaction = await PointTransaction.findOne({
      idempotencyKey: `admin-debit:${owner._id}:debit-replay-00000088`,
    });
    assert.equal(
      await PointsOutboxEvent.countDocuments({
        eventKey: `admin-debit:${transaction._id}:wallet`,
      }),
      1
    );
  }
);

test(
  "ledger and points administrator audit records reject mutation and deletion",
  { skip: !integrationEnabled },
  async () => {
    const driver = await Driver.create(driverData(89));
    const ledger = await PointTransaction.create({
      driverId: driver._id,
      type: "ADMIN_CREDIT",
      status: "COMPLETED",
      points: 1,
      bonusPoints: 1,
      purchasedPoints: 0,
      previousAvailableBalance: 0,
      newAvailableBalance: 1,
      previousReservedBalance: 0,
      newReservedBalance: 0,
      reason: "Immutability check",
      idempotencyKey: "immutable-ledger-check-00000089",
    });
    await assert.rejects(
      PointTransaction.updateOne(
        { _id: ledger._id },
        { $set: { points: 999 } }
      ),
      /append-only/
    );
    await assert.rejects(
      PointTransaction.deleteOne({ _id: ledger._id }),
      /append-only/
    );
    await assert.rejects(
      PointTransaction.findOneAndReplace(
        { _id: ledger._id },
        ledger.toObject()
      ),
      /append-only/
    );
    const audit = await PointsAdminAudit.create({
      action: "PURCHASE_REQUEST_TRANSITION",
      adminId: new mongoose.Types.ObjectId(),
      adminRole: "owner",
      driverId: driver._id,
      pointsChange: 0,
      reason: "Immutability check",
      idempotencyKey: "immutable-audit-check-00000089",
    });
    await assert.rejects(
      PointsAdminAudit.updateOne(
        { _id: audit._id },
        { $set: { reason: "changed" } }
      ),
      /append-only/
    );
    await assert.rejects(
      PointsAdminAudit.deleteOne({ _id: audit._id }),
      /append-only/
    );
    await assert.rejects(
      PointsAdminAudit.findOneAndReplace(
        { _id: audit._id },
        audit.toObject()
      ),
      /append-only/
    );
  }
);

test(
  "points overview returns server-side metrics and validates date filters",
  { skip: !integrationEnabled },
  async () => {
    const response = responseRecorder();
    await getPointsOverview(
      {
        query: {
          from: "2020-01-01T00:00:00.000Z",
          to: "2030-01-01T00:00:00.000Z",
        },
      },
      response
    );
    assert.equal(response.result.statusCode, 200);
    assert.equal(
      Number.isSafeInteger(response.result.body.overview.totalPointsIssued),
      true
    );
    assert.equal(
      Number.isSafeInteger(response.result.body.overview.activeWallets),
      true
    );

    const invalid = responseRecorder();
    await getPointsOverview(
      { query: { from: "2030-01-01", to: "2020-01-01" } },
      invalid
    );
    assert.equal(invalid.result.statusCode, 400);
  }
);

test("points routes and ledger expose no mutation/delete API", async () => {
  const [
    driverRoutes,
    adminRoutes,
    offerRoutes,
    transactionSource,
  ] = await Promise.all([
    import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/routes/driverPointsRoutes.js", import.meta.url), "utf8")
    ),
    import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/routes/adminPointsRoutes.js", import.meta.url), "utf8")
    ),
    import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/routes/tripOfferRoutes.js", import.meta.url), "utf8")
    ),
    import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/models/PointTransaction.js", import.meta.url), "utf8")
    ),
  ]);
  assert.match(driverRoutes, /router\.get\("\/wallet"/);
  assert.match(adminRoutes, /requirePointsAdjustment/);
  assert.match(offerRoutes, /pointsOfferRateLimit/);
  assert.doesNotMatch(driverRoutes + adminRoutes, /transactions\/:.*(?:delete|patch|put)/i);
  assert.match(transactionSource, /Point transaction records are append-only/);
});

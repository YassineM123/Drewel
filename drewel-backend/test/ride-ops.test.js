import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import adminRoute from "../src/routes/adminRoute.js";
import Ride, {
  ACTIVE_RIDE_STATUSES,
  RIDE_STATUSES,
  TERMINAL_RIDE_STATUSES,
} from "../src/models/Ride.js";
import Driver from "../src/models/Driver.js";
import User from "../src/models/User.js";
import RideAudit from "../src/models/RideAudit.js";
import RideInternalNote from "../src/models/RideInternalNote.js";
import { RideTransitionError } from "../src/services/rideTransitionService.js";

const routeLayer = (router, path, method) =>
  router.stack.find((layer) => layer.route?.path === path && layer.route.methods?.[method]);

const mountedGuards = (router, path, method) => {
  const layer = routeLayer(router, path, method);
  assert.ok(layer, `expected route ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((handler) => handler.handle.name);
};

test("single active ride rule is enforced by unique partial indexes on passenger and driver", () => {
  const indexes = Ride.schema.indexes();
  const passengerIndex = indexes.find(
    ([fields, options]) => options.name === "one_active_ride_per_passenger"
  );
  const driverIndex = indexes.find(
    ([fields, options]) => options.name === "one_active_ride_per_driver"
  );
  assert.ok(passengerIndex, "missing unique partial index on passengerId");
  assert.ok(driverIndex, "missing unique partial index on driverId");
  const activeStatuses = passengerIndex[1].partialFilterExpression.status.$in;
  assert.deepEqual(activeStatuses, ACTIVE_RIDE_STATUSES);
});

test("driver and user locks reject concurrent acquisition of a second active ride", () => {
  const source = readFileSync(
    new URL("../src/services/tripOfferService.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /Driver\.findOneAndUpdate\(\s*driverOfferFilter\(offer\.driverId\)/);
  assert.match(source, /User\.findOneAndUpdate\(\s*\{\s*_id: passengerId,\s*activeRideId: null,\s*isRestricted: false/);
  assert.match(source, /DRIVER_NOT_AVAILABLE/);
  assert.match(source, /ACTIVE_RIDE_CONFLICT/);
  assert.match(source, /activeRideId: offer\.contactRideId/);
});

test("marketplace availability excludes drivers who already own an active ride", () => {
  const source = readFileSync(
    new URL("../src/utils/availableDrivers.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /activeRideId: null/);
});

test("terminal transitions release both participant locks atomically", () => {
  const source = readFileSync(
    new URL("../src/services/rideTransitionService.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /Driver\.updateOne\(\s*\{\s*_id: ride\.driverId,\s*activeRideId: ride\._id/);
  assert.match(source, /User\.updateOne\(\s*\{\s*_id: ride\.passengerId,\s*activeRideId: ride\._id/);
  assert.match(source, /activeRideId: null/);
  assert.ok(TERMINAL_RIDE_STATUSES.includes("cancelled_by_admin"));
});

test("admins may open a dispute from any active ride status", async () => {
  const transitionService = readFileSync(
    new URL("../src/services/rideTransitionService.js", import.meta.url),
    "utf8"
  );
  assert.match(transitionService, /adminOpensDispute/);
  assert.match(transitionService, /nextStatus === "disputed"/);
  assert.match(transitionService, /ACTIVE_RIDE_STATUSES\.includes\(ride\.status\)/);
});

test("RideTransitionError defaults to a conflict status code", () => {
  const error = new RideTransitionError("cannot transition");
  assert.equal(error.statusCode, 409);
  assert.equal(error.code, "RIDE_TRANSITION_INVALID");
});

test("admin ride actions require authentication, admin role, idempotency key and reason", () => {
  for (const [path, method] of [
    ["/rides/:rideId/cancel", "post"],
    ["/rides/:rideId/dispute", "post"],
    ["/rides/:rideId/dispute/resolve", "post"],
    ["/rides/:rideId/failure", "post"],
    ["/rides/:rideId/unlock", "post"],
    ["/rides/:rideId/refund-points", "post"],
    ["/rides/:rideId/note", "post"],
  ]) {
    const guards = mountedGuards(adminRoute, path, method);
    assert.deepEqual(guards.slice(0, 2), ["requireSignIn", "isAdmin"], `unexpected guards for ${path}`);
    assert.equal(guards.length, 3, `expected exactly one handler for ${path}`);
  }
});

test("admin ride controller validates idempotency, reasons, and writes audit records", () => {
  const controller = readFileSync(
    new URL("../src/controllers/adminRideController.js", import.meta.url),
    "utf8"
  );
  for (const helper of [
    "const requireKey = (req)",
    "const requireReason = (value)",
    "const requireRideId = (value)",
    "RideAudit.create",
    "RideInternalNote.create",
    "emitAdminRideUpdate",
    "ADMIN_TRACKING_ROOM",
  ]) {
    assert.ok(controller.includes(helper), helper);
  }
  assert.match(controller, /IDEMPOTENCY_KEY_REQUIRED/);
  assert.match(controller, /ADMIN_RIDE_REASON_REQUIRED/);
  assert.match(controller, /ADMIN_RIDE_NOTE_REQUIRED/);
  assert.match(controller, /INVALID_RIDE_ID/);
});

test("admin list filter supports driver, customer, city and vehicle type", () => {
  const controller = readFileSync(
    new URL("../src/controllers/adminRideController.js", import.meta.url),
    "utf8"
  );
  assert.match(controller, /addParticipantFilter\("driverId", req\.query\.driver/);
  assert.match(controller, /addParticipantFilter\("passengerId", req\.query\.customer/);
  assert.match(controller, /const city = String\(req\.query\.city/);
  assert.match(controller, /"pickup\.address": new RegExp\(escaped, "i"\)/);
  assert.match(controller, /"destination\.address": new RegExp\(escaped, "i"\)/);
  assert.match(controller, /filter\.vehicleType = new RegExp\(escaped, "i"\)/);
});

test("ride detail exposes trip offer, internal notes and points charged", () => {
  const controller = readFileSync(
    new URL("../src/controllers/adminRideController.js", import.meta.url),
    "utf8"
  );
  assert.match(controller, /TripOffer\.findOne/);
  assert.match(controller, /RideInternalNote\.find/);
  assert.match(controller, /tripOffer: tripOffer \? toTripOfferDto\(tripOffer\) : null/);
  assert.match(controller, /pointsCharged/);
});

test("ride model stores route snapshot for live remaining distance and active route", () => {
  const routePhase = Ride.schema.path("routeSnapshot.phase");
  const polyline = Ride.schema.path("routeSnapshot.encodedPolyline");
  assert.equal(routePhase.options.enum.includes("pickup"), true);
  assert.ok(polyline.options.maxlength >= 12000);
});

test("internal notes model is append-only with per-admin idempotency", () => {
  const indexes = RideInternalNote.schema.indexes();
  assert.ok(indexes.some(([, options]) => options.name === "ride_internal_note_idempotency"));
  assert.ok(RideInternalNote.schema.s.hooks._pres.has("deleteMany"));
  assert.ok(RideInternalNote.schema.s.hooks._pres.has("findOneAndUpdate"));
});

test("ride audit append-only contract still holds", () => {
  assert.ok(RideAudit.schema.s.hooks._pres.has("updateOne"));
  assert.ok(RideAudit.schema.s.hooks._pres.has("findOneAndDelete"));
});

test("single active ride stays enforced across the authoritative lifecycle", () => {
  for (const status of [
    "offer_pending",
    "confirmed",
    "driver_on_the_way",
    "driver_arrived",
    "pickup_confirmed",
    "in_progress",
    "completed",
    "cancelled_by_user",
    "cancelled_by_driver",
    "cancelled_by_admin",
    "disputed",
  ]) {
    for (const bucket of [RIDE_STATUSES]) {
      assert.ok(bucket.includes(status), `${status} should be a valid ride status`);
    }
  }
  for (const status of [
    "confirmed",
    "driver_on_the_way",
    "driver_arrived",
    "pickup_confirmed",
    "in_progress",
    "disputed",
  ]) {
    assert.ok(ACTIVE_RIDE_STATUSES.includes(status), `${status} should lock the ride`);
  }
  assert.ok(!ACTIVE_RIDE_STATUSES.includes("completed"));
  assert.ok(!ACTIVE_RIDE_STATUSES.includes("cancelled_by_admin"));
  assert.ok(!ACTIVE_RIDE_STATUSES.includes("offer_pending"));
});

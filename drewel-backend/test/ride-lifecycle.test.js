import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Ride, { ACTIVE_RIDE_STATUSES, RIDE_STATUSES } from "../src/models/Ride.js";
import RideAudit from "../src/models/RideAudit.js";
import {
  createPickupPin,
  decryptPickupPin,
  RideTransitionError,
} from "../src/services/rideTransitionService.js";
import { validateDriverLocation } from "../src/services/rideLocationService.js";

test("authoritative ride lifecycle includes every required state", () => {
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
    assert.ok(RIDE_STATUSES.includes(status), status);
  }
  assert.ok(ACTIVE_RIDE_STATUSES.includes("confirmed"));
  assert.ok(!ACTIVE_RIDE_STATUSES.includes("completed"));
});

test("pickup PIN is four digits, hashed, and recoverable only with server encryption", () => {
  process.env.JWT_SECRET ||= "test-only-secret";
  const generated = createPickupPin();
  assert.match(generated.pin, /^\d{4}$/);
  assert.notEqual(generated.hash, generated.pin);
  assert.ok(!generated.encrypted.includes(generated.pin));
  assert.equal(decryptPickupPin(generated.encrypted), generated.pin);
});

test("driver ride locations reject malformed, stale, future and impossible values", () => {
  assert.throws(
    () => validateDriverLocation({ lat: 91, long: 10 }),
    (error) => error instanceof RideTransitionError && error.code === "INVALID_COORDINATES"
  );
  assert.throws(
    () =>
      validateDriverLocation({
        lat: 36.8,
        long: 10.1,
        recordedAt: new Date(Date.now() - 600000).toISOString(),
      }),
    /Invalid driver location/
  );
  const valid = validateDriverLocation({ lat: 36.8, long: 10.1, accuracy: 12 });
  assert.equal(valid.accuracy, 12);
});

test("active ride indexes cover passenger and driver locks", () => {
  const indexes = Ride.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.passengerId === 1 && options.unique));
  assert.ok(indexes.some(([fields, options]) => fields.driverId === 1 && options.unique));
});

test("ride audit is append-only and has action idempotency", () => {
  const indexes = RideAudit.schema.indexes();
  assert.ok(indexes.some(([, options]) => options.name === "ride_action_idempotency"));
  assert.ok(RideAudit.schema.s.hooks._pres.has("deleteMany"));
  assert.ok(RideAudit.schema.s.hooks._pres.has("findOneAndUpdate"));
});

test("REST and Socket.IO expose protected lifecycle contracts", () => {
  const routes = fs.readFileSync(new URL("../src/routes/rideRoutes.js", import.meta.url), "utf8");
  const socket = fs.readFileSync(new URL("../src/socket/index.js", import.meta.url), "utf8");
  for (const fragment of [
    'router.get("/:rideId/route"',
    'router.post("/:rideId/location"',
    'router.post("/:rideId/cancel"',
  ]) {
    assert.match(routes, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const event of ["ride:join", "ride:leave", "ride:driver_location", "ride:error"]) {
    assert.ok(socket.includes(`"${event}"`), event);
  }
  assert.match(socket, /status:\s*\{\s*\$in:\s*ACTIVE_RIDE_STATUSES\s*\}/);
});

test("admin ride operations are authenticated and refunds are capped", () => {
  const routes = fs.readFileSync(
    new URL("../src/routes/adminRoute.js", import.meta.url),
    "utf8"
  );
  const controller = fs.readFileSync(
    new URL("../src/controllers/adminRideController.js", import.meta.url),
    "utf8"
  );
  const walletService = fs.readFileSync(
    new URL("../src/services/pointsWalletService.js", import.meta.url),
    "utf8"
  );
  for (const action of [
    "/rides",
    "/rides/:rideId/cancel",
    "/rides/:rideId/dispute/resolve",
    "/rides/:rideId/unlock",
    "/rides/:rideId/refund-points",
  ]) {
    assert.ok(routes.includes(action), action);
  }
  assert.match(
    routes,
    /router\.post\('\/rides\/:rideId\/refund-points', requireSignIn, isAdmin/
  );
  assert.match(controller, /requireKey\(req\)/);
  assert.match(controller, /RideAudit\.create/);
  assert.match(walletService, /RIDE_CHARGE_ALREADY_REFUNDED/);
  assert.match(walletService, /refundPoints > refundablePoints/);
});

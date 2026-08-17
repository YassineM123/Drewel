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
import { computeRideRoute } from "../src/services/googleRoutesService.js";

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
    'router.post("/:rideId/review"',
  ]) {
    assert.match(routes, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const event of ["ride:join", "ride:leave", "ride:driver_location", "ride:error"]) {
    assert.ok(socket.includes(`"${event}"`), event);
  }
  assert.match(socket, /status:\s*\{\s*\$in:\s*ACTIVE_RIDE_STATUSES\s*\}/);
});

test("completed rides persist one bounded review per participant", () => {
  const passengerRating = Ride.schema.path("reviews.passenger.rating");
  const passengerComment = Ride.schema.path("reviews.passenger.comment");
  const driverRating = Ride.schema.path("reviews.driver.rating");

  assert.equal(passengerRating.options.min, 1);
  assert.equal(passengerRating.options.max, 5);
  assert.equal(passengerComment.options.maxlength, 500);
  assert.equal(driverRating.options.min, 1);
  assert.equal(driverRating.options.max, 5);
});

test("ride route falls back to an OSRM road polyline when Google Routes is not configured", async () => {
  const previousKey = process.env.GOOGLE_ROUTES_API_KEY;
  const previousFetch = globalThis.fetch;
  delete process.env.GOOGLE_ROUTES_API_KEY;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        return {
          routes: [
            {
              distance: 1260.4,
              duration: 220.2,
              geometry: "gfo}EtohhUxD@bAxJmGF",
              legs: [{ steps: [] }],
            },
          ],
        };
      },
    };
  };
  try {
    const route = await computeRideRoute({
      phase: "pickup",
      ride: {
        lastDriverLocation: { lat: 36.4515, long: 10.7382 },
        pickup: { lat: 36.4489, long: 10.7425 },
        destination: { lat: 36.45, long: 10.75 },
      },
    });
    assert.match(requestedUrl, /router\.project-osrm\.org/);
    assert.equal(route.provider, "osrm");
    assert.equal(route.fallback, true);
    assert.equal(route.distanceMeters, 1260);
    assert.equal(route.duration, "220s");
    assert.ok(route.encodedPolyline);
  } finally {
    if (previousKey == null) {
      delete process.env.GOOGLE_ROUTES_API_KEY;
    } else {
      process.env.GOOGLE_ROUTES_API_KEY = previousKey;
    }
    globalThis.fetch = previousFetch;
  }
});

test("destination route follows the live driver location after pickup", async () => {
  const previousKey = process.env.GOOGLE_ROUTES_API_KEY;
  const previousFetch = globalThis.fetch;
  delete process.env.GOOGLE_ROUTES_API_KEY;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        return {
          routes: [
            {
              distance: 600,
              duration: 120,
              geometry: "gfo}EtohhUxD@bAxJmGF",
              legs: [{ steps: [] }],
            },
          ],
        };
      },
    };
  };
  try {
    await computeRideRoute({
      phase: "destination",
      ride: {
        lastDriverLocation: { lat: 36.4521, long: 10.7399 },
        pickup: { lat: 36.4489, long: 10.7425 },
        destination: { lat: 36.45, long: 10.75 },
      },
    });
    assert.match(requestedUrl, /10\.7399,36\.4521;10\.75,36\.45/);
    assert.doesNotMatch(requestedUrl, /10\.7425,36\.4489;10\.75,36\.45/);
  } finally {
    if (previousKey == null) {
      delete process.env.GOOGLE_ROUTES_API_KEY;
    } else {
      process.env.GOOGLE_ROUTES_API_KEY = previousKey;
    }
    globalThis.fetch = previousFetch;
  }
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

test("admin ride list exposes operational aliases and bounded sorting", () => {
  const controller = fs.readFileSync(
    new URL("../src/controllers/adminRideController.js", import.meta.url),
    "utf8"
  );
  assert.match(controller, /live:\s*\[/);
  assert.match(controller, /stuck:\s*ACTIVE_RIDE_STATUSES/);
  assert.match(controller, /status === "stuck"/);
  assert.match(controller, /sortFields = new Set/);
  assert.match(controller, /INVALID_RIDE_SORT/);
  assert.match(controller, /\.sort\(\{ \[sortKey\]: sortDir, _id: sortDir \}\)/);
});

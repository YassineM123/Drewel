import test from "node:test";
import assert from "node:assert/strict";

import Driver from "../src/models/Driver.js";
import {
  buildDubaiDiscoveryAggregation,
  buildAvailableDriverFilter,
  buildFreshDubaiMarketplaceAvailabilityFilter,
  parseDriverDiscoveryQuery,
  toAvailableDriverDto,
} from "../src/utils/availableDrivers.js";
import {
  buildDriverLocationUpdate,
  discoveryRoom,
  DUBAI_SERVICE_AREA,
  DUBAI_SERVICE_MULTIPOLYGON,
  getDriverLocationFutureSkewMs,
  getDriverLocationMaxFixAgeMs,
  getMarketplaceLocationMaxAccuracyM,
  pointInPolygon,
  serviceAreaForCoordinates,
  validateCoordinates,
} from "../src/utils/dubaiLocation.js";

test("pinned Dubai MultiPolygon includes Dubai and Hatta but excludes Sharjah", () => {
  assert.equal(DUBAI_SERVICE_MULTIPOLYGON.length, 9);
  assert.equal(serviceAreaForCoordinates(25.2048, 55.2708), DUBAI_SERVICE_AREA);
  assert.equal(serviceAreaForCoordinates(24.8, 56.12), DUBAI_SERVICE_AREA);
  assert.equal(serviceAreaForCoordinates(25.337, 55.391), null); // Al Majaz
  assert.equal(serviceAreaForCoordinates(25.326, 55.369), null); // Al Khan
  assert.equal(pointInPolygon(55.2708, 25.2048), true);
  assert.throws(() => validateCoordinates(91, 55), /valid GPS/);
});

test("driver GPS updates dual-write GeoJSON in longitude-latitude order", () => {
  const now = new Date("2026-08-03T12:00:00.000Z");
  const update = buildDriverLocationUpdate({
    lat: 25.2048,
    long: 55.2708,
    accuracyM: 8,
    recordedAt: now.toISOString(),
  }, now);
  assert.deepEqual(update.currentLocation, {
    type: "Point",
    coordinates: [55.2708, 25.2048],
  });
  assert.equal(update.locationUpdatedAt.getTime(), now.getTime());
  assert.equal(update.currentServiceArea, "dubai");
  assert.equal(update.locationAccuracyM, 8);
  assert.throws(
    () => buildDriverLocationUpdate({
      lat: 25.2048,
      long: 55.2708,
      accuracyM: -1,
      recordedAt: now,
    }, now),
    /accuracyM/
  );
});

test("GPS measurement time cannot be refreshed by replaying a cached heartbeat", () => {
  const recordedAt = new Date("2026-08-03T11:59:50.000Z");
  const firstReceipt = new Date("2026-08-03T12:00:00.000Z");
  const laterReceipt = new Date("2026-08-03T12:00:20.000Z");
  const payload = { lat: 25.2048, long: 55.2708, recordedAt: recordedAt.toISOString() };
  payload.accuracyM = 8;
  assert.equal(buildDriverLocationUpdate(payload, firstReceipt).locationUpdatedAt.getTime(), recordedAt.getTime());
  assert.equal(buildDriverLocationUpdate(payload, laterReceipt).locationUpdatedAt.getTime(), recordedAt.getTime());
});

test("GPS fix timestamps are required and reject stale or future measurements", () => {
  const now = new Date("2026-08-03T12:00:00.000Z");
  assert.throws(
    () => buildDriverLocationUpdate({ lat: 25.2048, long: 55.2708 }, now),
    (error) => error.code === "LOCATION_TIMESTAMP_REQUIRED"
  );
  assert.throws(
    () => buildDriverLocationUpdate({
      lat: 25.2048,
      long: 55.2708,
      accuracyM: 8,
      recordedAt: new Date(now.getTime() - getDriverLocationMaxFixAgeMs() - 1),
    }, now),
    (error) => error.code === "STALE_LOCATION_FIX"
  );
  assert.throws(
    () => buildDriverLocationUpdate({
      lat: 25.2048,
      long: 55.2708,
      accuracyM: 8,
      recordedAt: new Date(now.getTime() + getDriverLocationFutureSkewMs() + 1),
    }, now),
    (error) => error.code === "FUTURE_LOCATION_FIX"
  );
});

test("marketplace accuracy is required, bounded at runtime, and boundary uncertainty is excluded", () => {
  const now = new Date("2026-08-03T12:00:00.000Z");
  assert.throws(
    () => buildDriverLocationUpdate({ lat: 25.2048, long: 55.2708, recordedAt: now }, now),
    (error) => error.code === "LOCATION_ACCURACY_REQUIRED"
  );
  assert.throws(
    () => buildDriverLocationUpdate({
      lat: 25.2048,
      long: 55.2708,
      accuracyM: getMarketplaceLocationMaxAccuracyM() + 1,
      recordedAt: now,
    }, now),
    (error) => error.code === "INVALID_LOCATION_ACCURACY"
  );
  assert.equal(serviceAreaForCoordinates(24.7534103, 55.7391785, 5), null);
});

test("location policy environment values are resolved at call time", () => {
  const original = process.env.DRIVER_LOCATION_FUTURE_SKEW_MS;
  try {
    process.env.DRIVER_LOCATION_FUTURE_SKEW_MS = "12345";
    assert.equal(getDriverLocationFutureSkewMs(), 12345);
    process.env.DRIVER_LOCATION_FUTURE_SKEW_MS = "999999";
    assert.equal(getDriverLocationFutureSkewMs(), 30000);
  } finally {
    if (original === undefined) delete process.env.DRIVER_LOCATION_FUTURE_SKEW_MS;
    else process.env.DRIVER_LOCATION_FUTURE_SKEW_MS = original;
  }
});

test("available drivers require exact Online status and no active ride", () => {
  const filter = buildAvailableDriverFilter();
  assert.equal(filter.isOnline, true);
  assert.equal(filter.availabilityStatus, "Online");
  assert.equal(filter.activeRideId, null);
});

test("action-time marketplace predicate requires fresh accurate Dubai GPS", () => {
  const now = new Date("2026-08-03T12:00:00.000Z");
  const filter = buildFreshDubaiMarketplaceAvailabilityFilter({}, now);
  assert.equal(filter.currentServiceArea, "dubai");
  assert.equal(filter["currentLocation.type"], "Point");
  assert.ok(filter.locationUpdatedAt.$gte < now);
  assert.ok(filter.locationUpdatedAt.$lte > now);
  assert.deepEqual(filter.locationAccuracyM, {
    $gte: 0,
    $lte: getMarketplaceLocationMaxAccuracyM(),
  });
});

test("Dubai discovery aggregation filters freshness and sorts before limiting", () => {
  const now = new Date("2026-08-03T12:00:00.000Z");
  const options = parseDriverDiscoveryQuery({
    lat: "25.2048",
    long: "55.2708",
    maxDistanceKm: "25",
    limit: "10",
  });
  const pipeline = buildDubaiDiscoveryAggregation({ vehicleType: "Small Pickup" }, options, now);
  assert.deepEqual(pipeline[0].$geoNear.near.coordinates, [55.2708, 25.2048]);
  assert.equal(pipeline[0].$geoNear.maxDistance, 25_000);
  assert.equal(pipeline[0].$geoNear.query.currentServiceArea, "dubai");
  assert.ok(pipeline[0].$geoNear.query.locationUpdatedAt.$gte < now);
  assert.deepEqual(pipeline[1], { $sort: { distanceMeters: 1, _id: 1 } });
  assert.deepEqual(pipeline[2], { $limit: 10 });
});

test("public location DTO exposes service area and database distance without private data", () => {
  const dto = toAvailableDriverDto({
    _id: "driver-1",
    fullName: "Dubai Driver",
    phone: "secret",
    currentServiceArea: "dubai",
    distanceMeters: 1234,
    isOnline: true,
    availabilityStatus: "Online",
  });
  assert.equal(dto.distanceKm, 1.2);
  assert.equal(dto.currentServiceArea, "dubai");
  assert.equal(Object.hasOwn(dto, "phone"), false);
  const inconsistent = toAvailableDriverDto({
    _id: "driver-2",
    isOnline: true,
    availabilityStatus: "Offline",
  });
  assert.equal(inconsistent.isAvailable, false);
  assert.equal(inconsistent.status, "Offline");
});

test("Driver schema declares sparse 2dsphere location index", () => {
  const locationIndex = Driver.schema.indexes().find(([keys]) => keys.currentLocation === "2dsphere");
  assert.ok(locationIndex);
  assert.equal(locationIndex[1].sparse, true);
  assert.equal(locationIndex[1].name, "currentLocation_2dsphere");
  assert.equal(discoveryRoom("dubai", " Small Pickup "), "discovery:dubai:small pickup");
});

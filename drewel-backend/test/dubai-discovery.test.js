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
  UAE_SERVICE_AREA,
  UAE_SERVICE_MULTIPOLYGON,
  getDriverLocationFutureSkewMs,
  getDriverLocationMaxFixAgeMs,
  getMarketplaceLocationMaxAccuracyM,
  pointInPolygon,
  serviceAreaForCoordinates,
  validateCoordinates,
} from "../src/utils/dubaiLocation.js";

test("pinned UAE MultiPolygon includes every supported city and excludes neighboring countries", () => {
  assert.equal(UAE_SERVICE_MULTIPOLYGON.length, 46);
  for (const [lat, long] of [
    [24.4539, 54.3773], // Abu Dhabi
    [25.2048, 55.2708], // Dubai
    [25.3562, 55.4272], // Sharjah
    [25.4052, 55.5136], // Ajman
    [24.2232, 55.7229], // Al Ain
    [25.8007, 55.9762], // Ras Al Khaimah
    [25.5508, 55.5524], // Umm Al Quwain
    [25.1221, 56.3345], // Fujairah
  ]) {
    assert.equal(serviceAreaForCoordinates(lat, long), UAE_SERVICE_AREA);
  }
  assert.equal(serviceAreaForCoordinates(23.588, 58.3829), null); // Muscat
  assert.equal(serviceAreaForCoordinates(25.2854, 51.531), null); // Doha
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
  assert.equal(update.currentServiceArea, "uae");
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
  assert.equal(serviceAreaForCoordinates(24.092714276043068, 52.453150217708412, 5), null);
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

test("action-time marketplace predicate requires fresh accurate UAE GPS", () => {
  const now = new Date("2026-08-03T12:00:00.000Z");
  const filter = buildFreshDubaiMarketplaceAvailabilityFilter({}, now);
  assert.equal(filter.currentServiceArea, "uae");
  assert.equal(filter["currentLocation.type"], "Point");
  assert.ok(filter.locationUpdatedAt.$gte < now);
  assert.ok(filter.locationUpdatedAt.$lte > now);
  assert.deepEqual(filter.locationAccuracyM, {
    $gte: 0,
    $lte: getMarketplaceLocationMaxAccuracyM(),
  });
});

test("UAE discovery aggregation filters freshness and sorts before limiting", () => {
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
  assert.equal(pipeline[0].$geoNear.query.currentServiceArea, "uae");
  assert.ok(pipeline[0].$geoNear.query.locationUpdatedAt.$gte < now);
  assert.deepEqual(pipeline[1], { $sort: { distanceMeters: 1, _id: 1 } });
  assert.deepEqual(pipeline[2], { $limit: 10 });
});

test("public location DTO exposes service area and database distance without private data", () => {
  const dto = toAvailableDriverDto({
    _id: "driver-1",
    fullName: "UAE Driver",
    phone: "secret",
    currentServiceArea: "uae",
    distanceMeters: 1234,
    isOnline: true,
    availabilityStatus: "Online",
  });
  assert.equal(dto.distanceKm, 1.2);
  assert.equal(dto.currentServiceArea, "uae");
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
  assert.equal(discoveryRoom("uae", " Small Pickup "), "discovery:uae:small pickup");
});

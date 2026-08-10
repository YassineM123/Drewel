import test from "node:test";
import assert from "node:assert/strict";

import Driver from "../src/models/Driver.js";
import {
  buildDubaiDiscoveryAggregation,
  buildAvailableDriverFilter,
  buildFreshAdminMarketplaceAvailabilityFilter,
  buildFreshDubaiMarketplaceAvailabilityFilter,
  buildFreshMarketplaceAvailabilityFilter,
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
  getTunisiaTestLocationMaxAccuracyM,
  pointInPolygon,
  TUNISIA_TEST_SERVICE_AREA,
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

test("Tunisia test marketplace is disabled by default and requires per-role allowlists", () => {
  const names = [
    "DREWEL_TUNISIA_TEST_MODE",
    "DREWEL_TUNISIA_TEST_DRIVER_IDS",
    "DREWEL_TUNISIA_TEST_USER_IDS",
  ];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    delete process.env.DREWEL_TUNISIA_TEST_MODE;
    process.env.DREWEL_TUNISIA_TEST_DRIVER_IDS = "driver-allowed";
    assert.equal(
      serviceAreaForCoordinates(36.8065, 10.1815, 8, {
        actorId: "driver-allowed",
        actorType: "driver",
      }),
      null
    );

    process.env.DREWEL_TUNISIA_TEST_MODE = "true";
    process.env.DREWEL_TUNISIA_TEST_USER_IDS = "user-allowed";
    assert.equal(
      serviceAreaForCoordinates(36.8065, 10.1815, 8, {
        actorId: "driver-allowed",
        actorType: "driver",
      }),
      TUNISIA_TEST_SERVICE_AREA
    );
    assert.equal(
      serviceAreaForCoordinates(36.8065, 10.1815, 0, {
        actorId: "user-allowed",
        actorType: "user",
      }),
      TUNISIA_TEST_SERVICE_AREA
    );
    assert.equal(
      serviceAreaForCoordinates(36.8065, 10.1815, 0, {
        actorId: "not-allowed",
        actorType: "user",
      }),
      null
    );
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});

test("allowlisted Tunisia driver GPS and discovery use the isolated test service area", () => {
  const originalMode = process.env.DREWEL_TUNISIA_TEST_MODE;
  const originalDrivers = process.env.DREWEL_TUNISIA_TEST_DRIVER_IDS;
  try {
    process.env.DREWEL_TUNISIA_TEST_MODE = "true";
    process.env.DREWEL_TUNISIA_TEST_DRIVER_IDS = "driver-1";
    const now = new Date("2026-08-03T12:00:00.000Z");
    const update = buildDriverLocationUpdate({
      lat: 36.8065,
      long: 10.1815,
      accuracyM: 8,
      recordedAt: now,
    }, now, { actorId: "driver-1" });
    assert.equal(update.currentServiceArea, TUNISIA_TEST_SERVICE_AREA);
    assert.deepEqual(update.currentLocation.coordinates, [10.1815, 36.8065]);

    const filter = buildFreshMarketplaceAvailabilityFilter(
      {},
      now,
      TUNISIA_TEST_SERVICE_AREA
    );
    assert.equal(filter.currentServiceArea, TUNISIA_TEST_SERVICE_AREA);
    const options = parseDriverDiscoveryQuery({ lat: 36.8065, long: 10.1815 });
    const pipeline = buildDubaiDiscoveryAggregation(
      {},
      options,
      now,
      TUNISIA_TEST_SERVICE_AREA
    );
    assert.equal(pipeline[0].$geoNear.query.currentServiceArea, TUNISIA_TEST_SERVICE_AREA);
    assert.deepEqual(pipeline[0].$geoNear.near.coordinates, [10.1815, 36.8065]);
  } finally {
    if (originalMode === undefined) delete process.env.DREWEL_TUNISIA_TEST_MODE;
    else process.env.DREWEL_TUNISIA_TEST_MODE = originalMode;
    if (originalDrivers === undefined) delete process.env.DREWEL_TUNISIA_TEST_DRIVER_IDS;
    else process.env.DREWEL_TUNISIA_TEST_DRIVER_IDS = originalDrivers;
  }
});

test("allowlisted Tunisia QA accepts coarse GPS consistently in writes and discovery", () => {
  const names = [
    "DREWEL_TUNISIA_TEST_MODE",
    "DREWEL_TUNISIA_TEST_DRIVER_IDS",
    "DREWEL_TUNISIA_TEST_LOCATION_MAX_ACCURACY_METERS",
  ];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.DREWEL_TUNISIA_TEST_MODE = "true";
    process.env.DREWEL_TUNISIA_TEST_DRIVER_IDS = "driver-coarse";
    process.env.DREWEL_TUNISIA_TEST_LOCATION_MAX_ACCURACY_METERS = "25000";
    const now = new Date("2026-08-03T12:00:00.000Z");
    const update = buildDriverLocationUpdate({
      lat: 36.8065,
      long: 10.1815,
      accuracyM: 12_500,
      recordedAt: now,
    }, now, { actorId: "driver-coarse" });

    assert.equal(update.currentServiceArea, TUNISIA_TEST_SERVICE_AREA);
    assert.equal(update.locationAccuracyM, 12_500);
    assert.equal(getTunisiaTestLocationMaxAccuracyM(), 25_000);

    const filter = buildFreshMarketplaceAvailabilityFilter(
      {}, now, TUNISIA_TEST_SERVICE_AREA
    );
    assert.deepEqual(filter.locationAccuracyM, { $gte: 0, $lte: 25_000 });
    const options = parseDriverDiscoveryQuery({ lat: 36.8065, long: 10.1815 });
    const pipeline = buildDubaiDiscoveryAggregation(
      {}, options, now, TUNISIA_TEST_SERVICE_AREA
    );
    assert.deepEqual(
      pipeline[0].$geoNear.query.locationAccuracyM,
      { $gte: 0, $lte: 25_000 }
    );
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});

test("UAE production still rejects GPS worse than its strict accuracy limit", () => {
  const now = new Date("2026-08-03T12:00:00.000Z");
  assert.throws(
    () => buildDriverLocationUpdate({
      lat: 25.2048,
      long: 55.2708,
      accuracyM: getMarketplaceLocationMaxAccuracyM() + 1,
      recordedAt: now,
    }, now),
    (error) => error.code === "INVALID_LOCATION_ACCURACY"
  );
});

test("Tunisia discovery keeps every matching vehicle in nearest-first order before the bounded cap", () => {
  const now = new Date("2026-08-03T12:00:00.000Z");
  const options = parseDriverDiscoveryQuery({
    lat: "36.8065",
    long: "10.1815",
  });
  const pipeline = buildDubaiDiscoveryAggregation(
    { vehicleType: " Small Pickup " },
    options,
    now,
    TUNISIA_TEST_SERVICE_AREA
  );

  const geoNear = pipeline[0].$geoNear;
  assert.equal(geoNear.query.currentServiceArea, TUNISIA_TEST_SERVICE_AREA);
  assert.deepEqual(geoNear.near.coordinates, [10.1815, 36.8065]);
  assert.equal(Object.hasOwn(geoNear, "maxDistance"), false);
  assert.match("small pickup", geoNear.query.vehicleType.$regex);
  assert.doesNotMatch("Large Pickup", geoNear.query.vehicleType.$regex);
  assert.deepEqual(pipeline[1], { $sort: { distanceMeters: 1, _id: 1 } });
  assert.deepEqual(pipeline[2], { $limit: 50 });
});

test("admin availability includes only allowlisted Tunisia test drivers when enabled", () => {
  const names = ["DREWEL_TUNISIA_TEST_MODE", "DREWEL_TUNISIA_TEST_DRIVER_IDS"];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const now = new Date("2026-08-03T12:00:00.000Z");
  try {
    delete process.env.DREWEL_TUNISIA_TEST_MODE;
    process.env.DREWEL_TUNISIA_TEST_DRIVER_IDS = "driver-1,driver-2";
    const defaultFilter = buildFreshAdminMarketplaceAvailabilityFilter({}, now);
    assert.equal(defaultFilter.currentServiceArea, UAE_SERVICE_AREA);
    assert.equal(defaultFilter.$or.length, 2); // staged approval compatibility only

    process.env.DREWEL_TUNISIA_TEST_MODE = "true";
    const testFilter = buildFreshAdminMarketplaceAvailabilityFilter({}, now);
    assert.equal(testFilter.$or.length, 2);
    assert.equal(testFilter.$or[0].currentServiceArea, UAE_SERVICE_AREA);
    assert.equal(
      testFilter.$or[1].currentServiceArea,
      TUNISIA_TEST_SERVICE_AREA
    );
    assert.deepEqual(testFilter.$or[1]._id, {
      $in: ["driver-1", "driver-2"],
    });
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
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

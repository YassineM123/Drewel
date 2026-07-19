import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AVAILABLE_DRIVER_FIELDS,
  buildAvailableDriverFilter,
  canDriverSetOnlineStatus,
} from "../src/controllers/driverController.js";
import { sanitizeAuthSubject } from "../src/utils/authResponse.js";
import driverRoutes from "../src/routes/driverRoutes.js";
import userRoutes from "../src/routes/userRoutes.js";
import {
  configureMongoSrvDns,
  parseMongoDnsServers,
} from "../src/connection.js";
import {
  buildAvailableDriverFilter as buildSharedAvailableDriverFilter,
} from "../src/utils/availableDrivers.js";

const routeLayer = (router, path, method) =>
  router.stack.find((layer) => layer.route?.path === path && layer.route.methods?.[method]);

test("available-driver filter only returns online approved unrestricted drivers", () => {
  const filter = buildAvailableDriverFilter({
    city: "Tunis.*",
    vehicleType: "Small Pickup",
  });

  assert.equal(filter.isOnline, true);
  assert.equal(filter.isApproved, true);
  assert.equal(filter.isRestricted, false);
  assert.deepEqual(filter.isDeleted, { $ne: true });
  assert.deepEqual(filter.$or, [
    { status: "completed" },
    { status: null, profileRequestStatus: null },
  ]);
  assert.equal(filter.city.$regex.test("Tunis.*"), true);
  assert.equal(filter.city.$regex.test("Tunis-anything"), false);
  assert.equal(filter.vehicleType.$regex.test("small pickup"), true);
});

test("available-driver status compatibility only admits completed and pre-workflow legacy records", () => {
  const filter = buildSharedAvailableDriverFilter();
  const matchesStatus = (driver) =>
    filter.$or.some((clause) =>
      Object.entries(clause).every(([field, expected]) =>
        expected === null
          ? driver[field] === null || driver[field] === undefined
          : driver[field] === expected
      )
    );

  assert.equal(matchesStatus({ status: "completed", profileRequestStatus: "approved" }), true);
  assert.equal(matchesStatus({}), true);
  assert.equal(matchesStatus({ status: null, profileRequestStatus: null }), true);
  assert.equal(matchesStatus({ status: "approved", profileRequestStatus: "not_submitted" }), false);
  assert.equal(matchesStatus({ status: "pending", profileRequestStatus: "pending" }), false);
  assert.equal(matchesStatus({ status: "rejected", profileRequestStatus: "rejected" }), false);
  assert.equal(matchesStatus({ status: null, profileRequestStatus: "pending" }), false);
});

test("driver eligibility is enforced when going online but never blocks going offline", () => {
  const eligible = {
    status: "completed",
    isApproved: true,
    isRestricted: false,
    isDeleted: false,
  };
  assert.equal(canDriverSetOnlineStatus(eligible, true), true);
  assert.equal(canDriverSetOnlineStatus({ ...eligible, status: "approved" }, true), false);
  assert.equal(canDriverSetOnlineStatus({ ...eligible, isApproved: false }, true), false);
  assert.equal(canDriverSetOnlineStatus({ ...eligible, isRestricted: true }, true), false);
  assert.equal(canDriverSetOnlineStatus({ ...eligible, isDeleted: true }, true), false);
  assert.equal(canDriverSetOnlineStatus({ status: "rejected" }, false), true);
  assert.equal(canDriverSetOnlineStatus({}, false), true);
});

test("available-driver matching is trimmed, exact, case-insensitive, and escaped", () => {
  const filter = buildSharedAvailableDriverFilter({
    city: "  Tunis.*  ",
    vehicleType: " Small (Pickup) ",
  });

  assert.equal(filter.city.$regex.test("tunis.*"), true);
  assert.equal(filter.city.$regex.test("Tunis-anything"), false);
  assert.equal(filter.vehicleType.$regex.test("small (pickup)"), true);
  assert.equal(filter.vehicleType.$regex.test("Small Pickup"), false);
});

test("controller preserves the shared available-driver filter contract", () => {
  assert.equal(buildAvailableDriverFilter, buildSharedAvailableDriverFilter);
});

test("socket discovery mirrors vehicle-wide REST availability and supports leaving rooms", () => {
  const source = readFileSync(
    new URL("../src/socket/index.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /socket\.join\(normalizeVehicleRoom\(vehicleType\)\)/);
  assert.match(source, /buildAvailableDriverFilter\(\{\s*vehicleType,/);
  assert.doesNotMatch(
    source,
    /buildAvailableDriverFilter\(\{\s*city: trimmedCity,\s*vehicleType,/
  );
  assert.match(source, /socket\.on\("leave-city-room"/);
});

test("socket location tracking exposes post-auth readiness and event acknowledgements", () => {
  const source = readFileSync(
    new URL("../src/socket/index.js", import.meta.url),
    "utf8"
  );

  assert.match(
    source,
    /socket\.on\("driver-location-update",[\s\S]*?acknowledgeSocketEvent\(acknowledge, \{\s*ok: true,/
  );
  assert.match(
    source,
    /socket\.on\("join-city-room",[\s\S]*?acknowledgeSocketEvent\(acknowledge, \{\s*ok: true,/
  );
  assert.match(source, /socket\.on\("location-tracking-status"/);
  assert.match(source, /socket\.emit\("location-tracking-ready", \{ ready: true \}\)/);

  const driverHandlerIndex = source.indexOf('socket.on("driver-location-update"');
  const joinHandlerIndex = source.indexOf('socket.on("join-city-room"');
  const readyEventIndex = source.indexOf('socket.emit("location-tracking-ready"');
  assert.ok(driverHandlerIndex >= 0 && driverHandlerIndex < readyEventIndex);
  assert.ok(joinHandlerIndex >= 0 && joinHandlerIndex < readyEventIndex);
});

test("available-driver projection excludes OTP and private documents", () => {
  const fields = new Set(AVAILABLE_DRIVER_FIELDS.split(/\s+/));
  for (const privateField of [
    "otpCode",
    "password",
    "idDocumentUrl",
    "passportCopyUrl",
    "licenseDriverUrl",
    "licenseCarUrl",
  ]) {
    assert.equal(fields.has(privateField), false);
  }
  for (const personalField of ["phone", "countryCode", "whatsappNumber"]) {
    assert.equal(fields.has(personalField), false);
  }
  for (const mobileField of ["fullName", "lat", "long", "vehicleType"]) {
    assert.equal(fields.has(mobileField), true);
  }
});

test("authentication responses strip secrets without mutating source", () => {
  const source = { _id: "abc", phone: "123", otpCode: "999999", password: "hash" };
  const safe = sanitizeAuthSubject(source);

  assert.deepEqual(safe, { _id: "abc", phone: "123" });
  assert.equal(source.otpCode, "999999");
});

test("mobile available-driver endpoint requires authentication", () => {
  const layer = routeLayer(driverRoutes, "/available", "get");
  assert.ok(layer);
  assert.deepEqual(layer.route.stack.map((handler) => handler.handle.name), [
    "requireSignIn",
    "getAvailableDrivers",
  ]);
});

test("driver deletion preserves requests and profile staging joins the audit transaction", () => {
  const source = readFileSync(
    new URL("../src/controllers/driverController.js", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /Driver\.findByIdAndDelete/);
  assert.match(source, /isDeleted:\s*true/);
  assert.match(source, /DriverLogs\.findOneAndUpdate\([\s\S]*?session\s*}/);
});

test("user enumeration endpoint requires authentication and admin role", () => {
  const layer = routeLayer(userRoutes, "/get-all", "get");
  assert.ok(layer);
  assert.deepEqual(layer.route.stack.map((handler) => handler.handle.name), [
    "requireSignIn",
    "isAdmin",
    "getAllUsers",
  ]);
});

test("MongoDB SRV DNS override is opt-in and parses multiple resolvers", () => {
  assert.deepEqual(parseMongoDnsServers(" 1.1.1.1, 8.8.8.8 ,, "), [
    "1.1.1.1",
    "8.8.8.8",
  ]);

  const calls = [];
  const adapter = { setServers: (servers) => calls.push(servers) };
  assert.deepEqual(
    configureMongoSrvDns("mongodb+srv://cluster.example", "1.1.1.1,8.8.8.8", adapter),
    ["1.1.1.1", "8.8.8.8"]
  );
  assert.deepEqual(calls, [["1.1.1.1", "8.8.8.8"]]);

  assert.deepEqual(
    configureMongoSrvDns("mongodb://localhost:27017", "1.1.1.1", adapter),
    []
  );
  assert.equal(calls.length, 1);
});

test("MongoDB SRV DNS override reports invalid resolver configuration", () => {
  const adapter = {
    setServers: () => {
      throw new Error("invalid IP address");
    },
  };
  assert.throws(
    () => configureMongoSrvDns("mongodb+srv://cluster.example", "not-an-ip", adapter),
    /Invalid MONGO_DNS_SERVERS configuration/
  );
});

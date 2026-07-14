import test from "node:test";
import assert from "node:assert/strict";

import {
  AVAILABLE_DRIVER_FIELDS,
  buildAvailableDriverFilter,
} from "../src/controllers/driverController.js";
import { sanitizeAuthSubject } from "../src/utils/authResponse.js";
import driverRoutes from "../src/routes/driverRoutes.js";
import userRoutes from "../src/routes/userRoutes.js";

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
  assert.equal(filter.status, "completed");
  assert.equal(filter.city.$regex.test("Tunis.*"), true);
  assert.equal(filter.city.$regex.test("Tunis-anything"), false);
  assert.equal(filter.vehicleType.$regex.test("small pickup"), true);
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
  for (const mobileField of ["fullName", "phone", "lat", "long", "vehicleType"]) {
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

test("user enumeration endpoint requires authentication and admin role", () => {
  const layer = routeLayer(userRoutes, "/get-all", "get");
  assert.ok(layer);
  assert.deepEqual(layer.route.stack.map((handler) => handler.handle.name), [
    "requireSignIn",
    "isAdmin",
    "getAllUsers",
  ]);
});

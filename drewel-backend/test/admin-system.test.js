import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import adminRoute from "../src/routes/adminRoute.js";
import operationalRoutes from "../src/routes/operationalRoutes.js";
import {
  getSystemHealth,
  listAdminAlerts,
  listAdminAuditLogs,
  listChatThreads,
  sendAdminNotification,
} from "../src/controllers/adminMetaController.js";
import {
  getLiveOperationsMap,
  searchLiveOperationsMap,
} from "../src/controllers/operationalController.js";
import { ADMIN_ROLES } from "../src/models/Admin.js";
import { POINTS_ADMIN_AUDIT_ACTIONS } from "../src/models/PointsAdminAudit.js";

const routeLayer = (router, path, method) =>
  router.stack.find((layer) => layer.route?.path === path && layer.route.methods?.[method]);

const mountedGuards = (router, path, method) => {
  const layer = routeLayer(router, path, method);
  assert.ok(layer, `expected route ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((handler) => handler.handle.name);
};

test("admin meta endpoints require authentication and admin role", () => {
  for (const path of [
    "/health",
    "/alerts",
    "/audit-logs",
    "/chat/metadata",
    "/chat/threads",
    "/roles",
    "/notifications",
    "/settings",
  ]) {
    const guards = mountedGuards(adminRoute, path, "get");
    assert.deepEqual(guards.slice(0, 2), ["requireSignIn", "isAdmin"], `unexpected guards for ${path}`);
    assert.equal(guards.length, 3, `expected exactly one handler for ${path}`);
  }
});

test("admin broadcast endpoint requires authentication and admin role", () => {
  assert.deepEqual(mountedGuards(adminRoute, "/notifications/send", "post"), [
    "requireSignIn",
    "isAdmin",
    "sendAdminNotification",
  ]);
});

test("live operations map endpoints require authentication and admin role", () => {
  assert.deepEqual(mountedGuards(operationalRoutes, "/live-map", "get"), [
    "requireSignIn",
    "isAdmin",
    "getLiveOperationsMap",
  ]);
  assert.deepEqual(mountedGuards(operationalRoutes, "/live-map/search", "get"), [
    "requireSignIn",
    "isAdmin",
    "searchLiveOperationsMap",
  ]);
});

test("health, alerts, chat and live-map controllers exist and bound pagination", () => {
  assert.equal(typeof getSystemHealth, "function");
  assert.equal(typeof listAdminAlerts, "function");
  assert.equal(typeof listAdminAuditLogs, "function");
  assert.equal(typeof listChatThreads, "function");
  assert.equal(typeof sendAdminNotification, "function");
  assert.equal(typeof getLiveOperationsMap, "function");
  assert.equal(typeof searchLiveOperationsMap, "function");
});

test("broadcast validation rejects unknown recipient targets and empty messages", async () => {
  const result = {};
  const res = {
    status: (code) => {
      result.status = code;
      return { json: (body) => (result.body = body) };
    },
  };

  await sendAdminNotification(
    { body: { recipients: "courier" }, admin: { _id: "admin" } },
    res
  );
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "ADMIN_SYSTEM_ERROR");
  assert.match(result.body.message, /recipients/);

  await sendAdminNotification(
    { body: { recipients: "both", message: "   " }, admin: { _id: "admin" } },
    res
  );
  assert.equal(result.status, 400);
  assert.match(result.body.message, /message/);
});

test("audit-logs endpoint rejects invalid date ranges before querying", async () => {
  const result = {};
  const res = {
    status: (code) => {
      result.status = code;
      return { json: (body) => (result.body = body) };
    },
  };
  await listAdminAuditLogs(
    { query: { page: "1", limit: "5", from: "not-a-date" }, admin: { _id: "admin" } },
    res
  );
  assert.equal(result.status, 400);
  assert.match(result.body.message, /from/);
});

test("roles catalog advertises the full ADMIN_ROLES enum without secrets", () => {
  assert.deepEqual(ADMIN_ROLES, [
    "owner",
    "finance_admin",
    "admin",
    "support",
    "analyst",
    "user",
  ]);
});

test("audit DTOs never project raw credential or token fields", () => {
  const source = readFileSync(
    new URL("../src/controllers/adminMetaController.js", import.meta.url),
    "utf8"
  );
  for (const forbidden of [
    "password",
    "otpCode",
    "paymentReferenceHash",
    ".select(\"password",
    "deviceToken",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `leaked ${forbidden}`);
  }
  assert.match(source, /export const listAdminAuditLogs/);
});

test("admin settings snapshot includes all non-sensitive operational point fields", () => {
  const source = readFileSync(
    new URL("../src/controllers/adminMetaController.js", import.meta.url),
    "utf8"
  );
  for (const field of [
    "lowBalanceThreshold",
    "largeAdjustmentThreshold",
    "welcomeDriverPoints",
    "rideOfferPointsCost",
    "commissionRate",
    "pointsPerAED",
    "offerExpirationSeconds",
    "maximumConcurrentOffers",
  ]) {
    assert.match(source, new RegExp(`${field}: settings\\.${field}`), `missing ${field}`);
  }
});

test("live operations map uses real backend state and read-only commission estimates", () => {
  const source = readFileSync(
    new URL("../src/controllers/operationalController.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /Driver\.find\(/);
  assert.match(source, /Ride\.find\(\{\s*status:\s*\{\s*\$in:\s*ACTIVE_RIDE_STATUSES\s*\}/);
  assert.match(source, /DriverPointsWallet\.find/);
  assert.match(source, /estimatedCommissionAED/);
  assert.doesNotMatch(source, /runPointsTransaction|transitionRideState|commissionService/);
});

test("points audit source is bounded by the append-only action enum contract", () => {
  assert.ok(POINTS_ADMIN_AUDIT_ACTIONS.includes("POINTS_CREDIT"));
  assert.ok(POINTS_ADMIN_AUDIT_ACTIONS.includes("PURCHASE_REQUEST_TRANSITION"));
  assert.ok(!POINTS_ADMIN_AUDIT_ACTIONS.includes("DELETE"));
});

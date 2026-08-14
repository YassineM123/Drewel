import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildActiveDriverPresenceFilter,
  getDriverPresenceConfig,
  toDriverPresenceEvent,
} from "../src/services/driverPresenceService.js";

const read = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("admin presence is lease based and independent from marketplace GPS freshness", () => {
  const now = new Date("2026-08-10T12:00:00.000Z");
  const filter = buildActiveDriverPresenceFilter(now);
  assert.equal(filter.presenceStatus, "Online");
  assert.deepEqual(filter.presenceLeaseExpiresAt, { $gt: now });
  assert.equal(filter.isApproved, true);
  assert.equal(filter.isRestricted, false);
  assert.equal(Object.hasOwn(filter, "locationUpdatedAt"), false);
  assert.equal(Object.hasOwn(filter, "currentLocation"), false);
});

test("admin location snapshot includes lease metadata for realtime reconciliation", () => {
  const adminController = read("../src/controllers/adminController.js");
  const locationHandler = adminController.slice(
    adminController.indexOf("export const getDriversWithLocation"),
    adminController.indexOf("export const getDriversForReview")
  );
  for (const field of [
    "isOnline",
    "presenceStatus",
    "presenceLeaseExpiresAt",
    "presenceLastHeartbeatAt",
    "presenceVersion",
  ]) {
    assert.match(locationHandler, new RegExp(`\\.select\\([\\s\\S]*?${field}`));
  }
});

test("presence timing is configurable and timeout cannot be shorter than two heartbeats", () => {
  const previous = {
    heartbeat: process.env.DRIVER_PRESENCE_HEARTBEAT_INTERVAL_MS,
    timeout: process.env.DRIVER_PRESENCE_TIMEOUT_MS,
    sweep: process.env.DRIVER_PRESENCE_SWEEP_INTERVAL_MS,
  };
  process.env.DRIVER_PRESENCE_HEARTBEAT_INTERVAL_MS = "30000";
  process.env.DRIVER_PRESENCE_TIMEOUT_MS = "45000";
  process.env.DRIVER_PRESENCE_SWEEP_INTERVAL_MS = "2000";
  try {
    assert.deepEqual(getDriverPresenceConfig(), {
      heartbeatIntervalMs: 30000,
      timeoutMs: 600000,
      sweepIntervalMs: 2000,
    });
  } finally {
    if (previous.heartbeat === undefined) delete process.env.DRIVER_PRESENCE_HEARTBEAT_INTERVAL_MS;
    else process.env.DRIVER_PRESENCE_HEARTBEAT_INTERVAL_MS = previous.heartbeat;
    if (previous.timeout === undefined) delete process.env.DRIVER_PRESENCE_TIMEOUT_MS;
    else process.env.DRIVER_PRESENCE_TIMEOUT_MS = previous.timeout;
    if (previous.sweep === undefined) delete process.env.DRIVER_PRESENCE_SWEEP_INTERVAL_MS;
    else process.env.DRIVER_PRESENCE_SWEEP_INTERVAL_MS = previous.sweep;
  }
});

test("presence timeout has a bounded network-loss grace period", () => {
  const previous = {
    heartbeat: process.env.DRIVER_PRESENCE_HEARTBEAT_INTERVAL_MS,
    timeout: process.env.DRIVER_PRESENCE_TIMEOUT_MS,
  };
  process.env.DRIVER_PRESENCE_HEARTBEAT_INTERVAL_MS = "20000";
  process.env.DRIVER_PRESENCE_TIMEOUT_MS = String(7 * 24 * 60 * 60 * 1000);
  try {
    assert.equal(getDriverPresenceConfig().timeoutMs, 1800000);
  } finally {
    if (previous.heartbeat === undefined) delete process.env.DRIVER_PRESENCE_HEARTBEAT_INTERVAL_MS;
    else process.env.DRIVER_PRESENCE_HEARTBEAT_INTERVAL_MS = previous.heartbeat;
    if (previous.timeout === undefined) delete process.env.DRIVER_PRESENCE_TIMEOUT_MS;
    else process.env.DRIVER_PRESENCE_TIMEOUT_MS = previous.timeout;
  }
});

test("android foreground presence requests battery optimization exemption", (t) => {
  const manifestUrl = new URL("../../android/app/src/main/AndroidManifest.xml", import.meta.url);
  const serviceUrl = new URL("../../lib/common/driver_online_service.dart", import.meta.url);
  if (!existsSync(manifestUrl) || !existsSync(serviceUrl)) {
    t.skip("Flutter source is not present in this backend-only checkout");
    return;
  }
  const manifest = read("../../android/app/src/main/AndroidManifest.xml");
  const service = read("../../lib/common/driver_online_service.dart");
  assert.match(
    manifest,
    /android\.permission\.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS/
  );
  assert.match(service, /isIgnoringBatteryOptimizations/);
  assert.match(service, /requestIgnoreBatteryOptimization\(\)/);
});

test("presence events expose a monotonic version and no session secret", () => {
  const event = toDriverPresenceEvent(
    {
      _id: "driver-1",
      presenceStatus: "Online",
      presenceSessionId: "secret",
      presenceLeaseExpiresAt: new Date("2026-08-10T12:02:00.000Z"),
      presenceLastHeartbeatAt: new Date("2026-08-10T12:00:00.000Z"),
      presenceVersion: 7,
      updatedAt: new Date("2026-08-10T12:00:00.000Z"),
    },
    "ONLINE_REQUEST"
  );
  assert.equal(event.version, 7);
  assert.equal(event.isOnline, true);
  assert.equal(event.reason, "ONLINE_REQUEST");
  assert.equal(Object.hasOwn(event, "sessionId"), false);
  assert.equal(Object.hasOwn(event, "presenceSessionId"), false);
});

test("socket disconnect records diagnostics but never forces offline", () => {
  const socketSource = read("../src/socket/index.js");
  const disconnectHandler = socketSource.slice(socketSource.indexOf('socket.on("disconnect"'));
  assert.match(disconnectHandler, /noteDriverSocketDisconnect\(userId\)/);
  assert.doesNotMatch(
    disconnectHandler.slice(0, disconnectHandler.indexOf('socket.on("location-tracking-status"')),
    /isOnline:\s*false|availabilityStatus:\s*"Offline"/
  );
});

test("heartbeat and explicit offline are authenticated session-bound operations", () => {
  const routes = read("../src/routes/driverRoutes.js");
  const controller = read("../src/controllers/driverController.js");
  const service = read("../src/services/driverPresenceService.js");
  assert.match(routes, /post\("\/presence\/heartbeat", requireSignIn, heartbeatPresence\)/);
  assert.match(service, /presenceSessionId:\s*sessionId[\s\S]*?presenceLeaseExpiresAt:\s*\{ \$gt: now \}/);
  assert.match(controller, /suppliedSessionId[\s\S]*?PRESENCE_SESSION_STALE/);
  assert.match(controller, /heartbeatPresence[\s\S]*?sessionId:\s*req\.body\?\.sessionId/);
  assert.match(
    service,
    /heartbeatDriverPresence[\s\S]*?isApproved:\s*true[\s\S]*?isRestricted:\s*false[\s\S]*?isDeleted:\s*\{ \$ne: true \}[\s\S]*?status:\s*"completed"/
  );
});

test("timeout sweep uses a compare-and-set session guard and emits one transition", () => {
  const service = read("../src/services/driverPresenceService.js");
  assert.match(
    service,
    /expireStaleDriverPresences[\s\S]*?presenceSessionId:\s*candidate\.presenceSessionId[\s\S]*?presenceLeaseExpiresAt:\s*\{ \$lte: now \}/
  );
  assert.match(
    service,
    /expireStaleDriverPresences[\s\S]*?heartbeatCutoff[\s\S]*?presenceLastHeartbeatAt:\s*\{ \$lte: heartbeatCutoff \}/
  );
  assert.match(service, /\$inc:\s*\{ presenceVersion: 1 \}/);
  assert.match(service, /HEARTBEAT_TIMEOUT/);
  const job = read("../src/jobs/driverPresenceJob.js");
  assert.match(job, /driver:presence/);
  assert.match(job, /driver:availability/);
});

test("rollout bridge grants only recently located legacy online drivers one bounded lease", () => {
  const service = read("../src/services/driverPresenceService.js");
  const job = read("../src/jobs/driverPresenceJob.js");
  assert.match(
    service,
    /seedRecentLegacyDriverPresences[\s\S]*?isOnline:\s*true[\s\S]*?locationUpdatedAt:\s*\{ \$gt:[\s\S]*?legacy-bootstrap-/
  );
  assert.match(job, /seedRecentLegacyDriverPresences\(\)[\s\S]*?\.then\(sweep\)/);
});

test("eligibility revocations force an immediate atomic offline transition", () => {
  const presenceService = read("../src/services/driverPresenceService.js");
  const transitionService = read("../src/services/driverRequestTransitionService.js");
  const driverController = read("../src/controllers/driverController.js");
  const socket = read("../src/socket/index.js");

  assert.match(
    presenceService,
    /forceEndDriverPresence[\s\S]*?findOneAndUpdate\([\s\S]*?presenceStatus:\s*"Offline"[\s\S]*?\$inc:\s*\{ presenceVersion: 1 \}/
  );
  assert.match(presenceService, /emitDriverPresenceTransition[\s\S]*?driver:presence[\s\S]*?driver:availability/);
  assert.match(socket, /configureDriverPresenceEmitter\([\s\S]*?io\.emit/);
  assert.match(
    transitionService,
    /applyForcedOfflinePresence\(driver, now\)[\s\S]*?emitDriverPresenceTransition\(/
  );
  assert.match(driverController, /toggleDriverRestriction[\s\S]*?DRIVER_RESTRICTED/);
  assert.match(driverController, /deleteDriver[\s\S]*?DRIVER_DELETED/);
});

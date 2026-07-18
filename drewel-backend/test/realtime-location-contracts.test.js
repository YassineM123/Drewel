import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readProjectFile = (relativePath) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("socket readiness is emitted only after realtime handlers are registered", () => {
  const source = readProjectFile("drewel-backend/src/socket/index.js");
  const readinessIndex = source.lastIndexOf('socket.emit("location-tracking-ready"');

  assert.ok(readinessIndex > source.indexOf('socket.on("driver-location-update"'));
  assert.ok(readinessIndex > source.indexOf('socket.on("join-city-room"'));
  assert.ok(readinessIndex > source.indexOf('socket.on("location-tracking-status"'));
  assert.match(source, /socket\.emit\("location-tracking-ready",\s*\{\s*ready:\s*true\s*\}\)/);
});

test("realtime location commands provide success and structured error acknowledgements", () => {
  const source = readProjectFile("drewel-backend/src/socket/index.js");

  assert.match(
    source,
    /socket\.on\("driver-location-update",[\s\S]*?acknowledgeSocketEvent\(acknowledge,\s*\{\s*ok:\s*true,[\s\S]*?driverId:[\s\S]*?updatedAt:/
  );
  assert.match(
    source,
    /socket\.on\("join-city-room",[\s\S]*?acknowledgeSocketEvent\(acknowledge,\s*\{\s*ok:\s*true,\s*count:/
  );
  assert.match(source, /ok:\s*false,\s*error:/);
});

test("mobile socket retains the latest driver fix and resends after server readiness", () => {
  const source = readProjectFile("lib/common/socket_services.dart");

  assert.match(source, /Map<String,\s*dynamic>\?\s+_pendingDriverLocation/);
  assert.match(source, /['"]location-tracking-ready['"]/);
  assert.match(
    source,
    /location-tracking-ready[\s\S]*?_flushPendingDriverLocation\(\)/
  );
  assert.match(
    source,
    /_flushPendingDriverLocation\(\)[\s\S]*?_pendingDriverLocation[\s\S]*?driver-location-update/
  );
  assert.match(source, /['"]disconnect['"][\s\S]*?_locationTrackingReady\s*=\s*false/);
});

test("accepted driver GPS movement is pushed immediately as well as by heartbeat", () => {
  const source = readProjectFile(
    "lib/app/modules/driver_home/controllers/driver_home_controller.dart"
  );

  assert.match(source, /Timer\.periodic\([\s\S]*?_emitCurrentLocation\(\)/);
  assert.match(
    source,
    /if \(hasPositionChanged\) \{[\s\S]*?if \(_isDriverOnline\) \{[\s\S]*?_emitCurrentLocation\(\)/
  );
});

test("map driver marker identity is based on driver id, not list position", () => {
  const source = readProjectFile(
    "lib/app/modules/user_home/controllers/user_home_controller.dart"
  );

  assert.doesNotMatch(source, /MarkerId\(['"]driver_\$i['"]\)/);
  assert.match(source, /MarkerId\([\s\S]{0,250}driver\.sId/);
});

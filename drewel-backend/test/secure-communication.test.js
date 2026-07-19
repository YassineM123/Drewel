import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import CallSession, { ACTIVE_CALL_STATUSES } from "../src/models/CallSession.js";
import CommunicationAudit from "../src/models/CommunicationAudit.js";
import Ride from "../src/models/Ride.js";
import RideMessage from "../src/models/RideMessage.js";
import RideSafetyAction from "../src/models/RideSafetyAction.js";
import { generateAgoraChannelName, agoraConfig } from "../src/services/agoraTokenService.js";
import { isRideContactAllowed } from "../src/services/rideCommunicationPolicy.js";
import { toCallDto } from "../src/services/callSessionService.js";
import callRoutes from "../src/routes/callRoutes.js";
import rideRoutes from "../src/routes/rideRoutes.js";
import adminRoutes from "../src/routes/adminRoute.js";

const routeLayer = (router, path, method) => router.stack.find(
  (layer) => layer.route?.path === path && layer.route.methods?.[method]
);

test("ride contact policy permits assigned lifecycle states and bounded completion grace", () => {
  for (const status of ["accepted", "driver_arriving", "driver_arrived", "in_progress"]) {
    assert.equal(isRideContactAllowed({ status }), true);
  }
  assert.equal(isRideContactAllowed({ status: "requested" }), false);
  assert.equal(isRideContactAllowed({ status: "cancelled", contactEndsAt: new Date(Date.now() + 60_000) }), false);
  assert.equal(isRideContactAllowed({ status: "completed", contactEndsAt: new Date(Date.now() + 60_000) }), true);
  assert.equal(isRideContactAllowed({ status: "completed", contactEndsAt: new Date(Date.now() - 1) }), false);
  assert.equal(isRideContactAllowed({ status: "in_progress", communicationBlockedAt: new Date() }), false);
});

test("ride policy records denial reason codes without request payloads", () => {
  const source = fs.readFileSync(new URL("../src/services/rideCommunicationPolicy.js", import.meta.url), "utf8");
  assert.match(source, /action: "communication_denied"/);
  for (const reason of ["NOT_RIDE_PARTICIPANT", "RIDE_COMMUNICATION_BLOCKED", "RIDE_CONTACT_EXPIRED", "RIDE_CONTACT_NOT_ACTIVE"]) {
    assert.match(source, new RegExp(reason));
  }
  for (const sensitive of ["channelName", "token", "phone", "whatsappNumber"]) assert.equal(source.includes(sensitive), false);
});

test("ride and message identifiers are validated before database lookups", () => {
  const policySource = fs.readFileSync(new URL("../src/services/rideCommunicationPolicy.js", import.meta.url), "utf8");
  const policyStart = policySource.indexOf("export const assertRideParticipant");
  const policyBlock = policySource.slice(policyStart, policySource.indexOf("export const counterpartFor", policyStart));
  assert.ok(policyBlock.indexOf("mongoose.isValidObjectId(rideOrId)") < policyBlock.indexOf("Ride.findById(rideOrId)"));
  assert.match(policyBlock, /INVALID_RIDE_ID/);

  const controllerSource = fs.readFileSync(new URL("../src/controllers/rideController.js", import.meta.url), "utf8");
  assert.match(controllerSource, /INVALID_MESSAGE_CURSOR/);
  assert.match(controllerSource, /INVALID_MESSAGE_ID/);
  const transitionStart = controllerSource.indexOf("export const transitionRide");
  const transitionBlock = controllerSource.slice(transitionStart, controllerSource.indexOf("export const listRideCalls", transitionStart));
  assert.ok(transitionBlock.indexOf("mongoose.isValidObjectId(req.params.rideId)") < transitionBlock.indexOf("Ride.findById(req.params.rideId)"));
});

test("call session has a database-enforced single active call per ride", () => {
  const indexes = CallSession.schema.indexes();
  const active = indexes.find(([, options]) => options.name === "one_active_call_per_ride");
  assert.ok(active);
  assert.deepEqual(active[0], { rideId: 1 });
  assert.equal(active[1].unique, true);
  assert.deepEqual(active[1].partialFilterExpression.status.$in, ACTIVE_CALL_STATUSES);
  const idempotency = indexes.find(([, options]) => options.name === "ride_caller_idempotency");
  assert.ok(idempotency);
  assert.deepEqual(idempotency[0], { rideId: 1, callerId: 1, idempotencyKey: 1 });
  assert.equal(idempotency[1].unique, true);
});

test("call authorization rejects malformed ids before querying MongoDB", () => {
  const source = fs.readFileSync(new URL("../src/services/callSessionService.js", import.meta.url), "utf8");
  const start = source.indexOf("export const getAuthorizedCall");
  const end = source.indexOf("const transitionRules", start);
  const block = source.slice(start, end);
  assert.ok(block.indexOf("mongoose.isValidObjectId(callId)") < block.indexOf("CallSession.findById(callId)"));
  assert.match(block, /INVALID_CALL_ID/);
});

test("call idempotency lookup is scoped to ride, caller and key", () => {
  const source = fs.readFileSync(new URL("../src/services/callSessionService.js", import.meta.url), "utf8");
  assert.match(source, /findOne\(\{ rideId: ride\._id, callerId: principal\.id, idempotencyKey: key \}\)/);
});

test("call DTO never exposes Agora credentials or idempotency data", () => {
  const call = new CallSession({
    rideId: "69ca8d07657eef3a66dd6a11",
    callerId: "69ca8d07657eef3a66dd6a12",
    receiverId: "69ca8d07657eef3a66dd6a13",
    callerRole: "passenger",
    receiverRole: "driver",
    channelName: "secret-channel",
    callerAgoraUid: 11,
    receiverAgoraUid: 12,
    idempotencyKey: "secret-key",
  });
  const dto = toCallDto(call);
  for (const secret of ["channelName", "callerAgoraUid", "receiverAgoraUid", "idempotencyKey", "token", "appCertificate"]) {
    assert.equal(Object.hasOwn(dto, secret), false);
  }
});

test("Agora channels are random, opaque and config rejects missing server secrets", () => {
  const first = generateAgoraChannelName();
  const second = generateAgoraChannelName();
  assert.match(first, /^dw_[A-Za-z0-9_-]{32}$/);
  assert.notEqual(first, second);
  const previousId = process.env.AGORA_APP_ID;
  const previousCertificate = process.env.AGORA_APP_CERTIFICATE;
  delete process.env.AGORA_APP_ID;
  delete process.env.AGORA_APP_CERTIFICATE;
  assert.throws(() => agoraConfig(), /not configured/);
  if (previousId === undefined) delete process.env.AGORA_APP_ID; else process.env.AGORA_APP_ID = previousId;
  if (previousCertificate === undefined) delete process.env.AGORA_APP_CERTIFICATE; else process.env.AGORA_APP_CERTIFICATE = previousCertificate;
});

test("communication collections provide participant, status and pagination indexes", () => {
  assert.ok(Ride.schema.indexes().some(([keys]) => keys.passengerId === 1 && keys.status === 1));
  assert.ok(Ride.schema.indexes().some(([keys]) => keys.driverId === 1 && keys.status === 1));
  assert.ok(RideMessage.schema.indexes().some(([keys]) => keys.rideId === 1 && keys.createdAt === -1));
  assert.equal(CommunicationAudit.schema.path("action").options.immutable, true);
  assert.equal(CommunicationAudit.schema.s.hooks.hasHooks("findOneAndUpdate"), true);
  assert.equal(RideSafetyAction.schema.path("targetId").options.immutable, true);
  assert.equal(RideSafetyAction.schema.s.hooks.hasHooks("deleteMany"), true);
});

test("secure call routes require JWT and expose the complete state API", () => {
  for (const [path, method] of [
    ["/initiate", "post"], ["/:callId", "get"], ["/:callId/accept", "post"],
    ["/:callId/connected", "post"], ["/:callId/decline", "post"],
    ["/:callId/cancel", "post"], ["/:callId/end", "post"], ["/:callId/token", "post"],
  ]) {
    const layer = routeLayer(callRoutes, path, method);
    assert.ok(layer, `${method.toUpperCase()} ${path}`);
  }
  assert.equal(callRoutes.stack[0].handle.name, "requireSignIn");
});

test("ride REST API includes active lookup and ride-scoped paginated chat", () => {
  for (const [path, method] of [
    ["/", "post"], ["/active", "get"], ["/mine", "get"], ["/:rideId", "get"],
    ["/:rideId/status", "patch"], ["/:rideId/calls", "get"],
    ["/:rideId/messages", "get"], ["/:rideId/messages", "post"],
    ["/:rideId/messages/:messageId/receipt", "patch"],
    ["/:rideId/report", "post"], ["/:rideId/block", "post"],
  ]) assert.ok(routeLayer(rideRoutes, path, method), `${method.toUpperCase()} ${path}`);
  assert.equal(rideRoutes.stack[0].handle.name, "requireSignIn");
  const mineIndex = rideRoutes.stack.findIndex((layer) => layer.route?.path === "/mine");
  const parameterIndex = rideRoutes.stack.findIndex((layer) => layer.route?.path === "/:rideId");
  assert.ok(mineIndex >= 0 && mineIndex < parameterIndex, "/mine must be registered before /:rideId");
});

test("my rides endpoint derives ownership and bounds its public list", () => {
  const source = fs.readFileSync(new URL("../src/controllers/rideController.js", import.meta.url), "utf8");
  const start = source.indexOf("export const listMyRides");
  const end = source.indexOf("export const transitionRide", start);
  const block = source.slice(start, end);
  assert.match(block, /principal\.role === "passenger"/);
  assert.match(block, /passengerId: principal\.id/);
  assert.match(block, /driverId: principal\.id/);
  assert.match(block, /Math\.min\(50/);
  assert.match(block, /Promise\.all\(rides\.map\(publicRideDto\)\)/);
  for (const pii of ["phone", "countryCode", "whatsappNumber"]) assert.equal(block.includes(pii), false);
});

test("admin call view is protected by JWT plus admin role", () => {
  const layer = routeLayer(adminRoutes, "/calls", "get");
  assert.ok(layer);
  assert.deepEqual(layer.route.stack.slice(0, 2).map((entry) => entry.handle.name), ["requireSignIn", "isAdmin"]);
});

test("admin call response contract uses public names and exact filters", () => {
  const source = fs.readFileSync(new URL("../src/controllers/callController.js", import.meta.url), "utf8");
  assert.match(source, /callId:/);
  assert.match(source, /caller: \{ displayName:/);
  assert.match(source, /receiver: \{ displayName:/);
  assert.match(source, /totalPages/);
  assert.match(source, /Search must be an exact Call ID or Ride ID/);
  for (const pii of ["select(\"email", "select(\"phone", "whatsappNumber"]) assert.equal(source.includes(pii), false);
});

test("watchdog and realtime payload contracts are mounted without sensitive call credentials", () => {
  const indexSource = fs.readFileSync(new URL("../index.js", import.meta.url), "utf8");
  const callSource = fs.readFileSync(new URL("../src/controllers/callController.js", import.meta.url), "utf8");
  const rideSource = fs.readFileSync(new URL("../src/controllers/rideController.js", import.meta.url), "utf8");
  assert.match(indexSource, /startCallExpiryWatchdog\(\)/);
  assert.match(callSource, /emit\("call:state"/);
  assert.match(rideSource, /emit\("ride:message"/);
  const emitBlock = callSource.slice(callSource.indexOf("const emitCall"), callSource.indexOf("export const initiate"));
  for (const secret of ["channelName", "AgoraUid", "token", "appCertificate"]) assert.equal(emitBlock.includes(secret), false);
});

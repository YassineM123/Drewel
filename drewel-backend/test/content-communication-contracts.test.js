import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import adminRoute from "../src/routes/adminRoute.js";
import bannerRoute from "../src/routes/bannerRoute.js";
import CallLog, { CALL_STATUSES } from "../src/models/CallLog.js";
import ContentAudit, {
  CONTENT_ACTIONS,
  CONTENT_ENTITY_TYPES,
} from "../src/models/ContentAudit.js";
import Banner from "../src/models/Banner.js";
import RideConversation from "../src/models/RideConversation.js";
import {
  addAdminConversationNote,
  getAdminConversationMessages,
} from "../src/controllers/adminMetaController.js";
import {
  toggleBannerStatus,
  deleteBanner,
} from "../src/controllers/bannerController.js";

const routeLayer = (router, path, method) =>
  router.stack.find((layer) => layer.route?.path === path && layer.route.methods?.[method]);

const mountedGuards = (router, path, method) => {
  const layer = routeLayer(router, path, method);
  assert.ok(layer, `expected route ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((handler) => handler.handle.name);
};

const capture = () => {
  const result = {};
  const res = {
    status(code) {
      result.status = code;
      return { json: (body) => (result.body = body), send: (body) => (result.body = body) };
    },
  };
  return { res, result };
};

test("admin chat and content-audit endpoints require authentication and admin role", () => {
  for (const [path, method, handler] of [
    ["/chat/threads/:id/messages", "get", "getAdminConversationMessages"],
    ["/chat/threads/:id/note", "post", "addAdminConversationNote"],
    ["/content-audits", "get", "listContentAudits"],
  ]) {
    const guards = mountedGuards(adminRoute, path, method);
    assert.deepEqual(guards.slice(0, 2), ["requireSignIn", "isAdmin"], `unexpected guards for ${method.toUpperCase()} ${path}`);
    assert.equal(guards.length, 3, `expected exactly one handler for ${path}`);
    assert.equal(guards[2], handler);
  }
});

test("banner mutation routes require admin while impressions and clicks stay public", () => {
  for (const [path, method] of [
    ["/add-banner", "post"],
    ["/update/:id", "put"],
    ["/delete/:id", "delete"],
    ["/status/:id", "patch"],
  ]) {
    const guards = mountedGuards(bannerRoute, path, method);
    assert.deepEqual(guards.slice(0, 2), ["requireSignIn", "isAdmin"], `unexpected guards for ${method.toUpperCase()} ${path}`);
  }
  assert.deepEqual(mountedGuards(bannerRoute, "/:id/impression", "post"), [
    "validateBannerId",
    "recordBannerImpression",
  ]);
  assert.deepEqual(mountedGuards(bannerRoute, "/:id/click", "post"), [
    "validateBannerId",
    "recordBannerClick",
  ]);
});

test("call logs are metadata-only with a bounded status enum and no contact secrets", () => {
  assert.deepEqual(CALL_STATUSES, [
    "planned",
    "ringing",
    "in_call",
    "completed",
    "missed",
    "failed",
    "cancelled",
  ]);
  const schema = CallLog.schema;
  assert.equal(schema.path("callId").options.unique, true);
  assert.equal(schema.path("recordingEnabled").instance, "Boolean");
  assert.equal(schema.path("recordingEnabled").defaultValue, false);
  assert.equal(schema.path("durationSec").options.min, 0);
  for (const secret of ["phone", "whatsappNumber", "token", "email", "countryCode"]) {
    assert.equal(Boolean(schema.path(secret)), false, `CallLog leaked ${secret}`);
  }
  assert.ok(schema.indexes().some(([keys]) => keys.rideId === 1 && keys.startedAt === -1));
  assert.ok(schema.indexes().some(([keys]) => keys.status === 1 && keys.startedAt === -1));
  assert.equal(routeLayer(adminRoute, "/secure-calls", "get"), undefined);
});

test("ride message notifications navigate with the canonical ride id", () => {
  const conversationSource = readFileSync(
    new URL("../src/services/conversationService.js", import.meta.url),
    "utf8"
  );
  const rideSource = readFileSync(
    new URL("../src/controllers/rideController.js", import.meta.url),
    "utf8"
  );

  assert.match(conversationSource, /conversationId: ride\._id/);
  assert.match(conversationSource, /deepLink: `drewel:\/\/chat\/ride\?rideId=\$\{String\(ride\._id\)\}`/);
  assert.doesNotMatch(conversationSource, /chat\/ride\?conversationId=/);
  assert.equal((rideSource.match(/deepLink: `drewel:\/\/chat\/ride\?rideId=/g) || []).length, 2);
  assert.doesNotMatch(rideSource, /chat\/ride\?conversationId=/);
});

test("retired calls are excluded from active health checks while history remains schema-compatible", () => {
  const healthModel = readFileSync(
    new URL("../src/models/OperationalHealth.js", import.meta.url),
    "utf8"
  );
  const healthJob = readFileSync(
    new URL("../src/jobs/operationalJobs.js", import.meta.url),
    "utf8"
  );
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  );

  assert.equal(packageJson.dependencies["agora-token"], undefined);
  assert.match(healthModel, /HEALTH_SERVICE_SCHEMA_IDS = \[\.\.\.HEALTH_SERVICE_IDS, "secure_calls"\]/);
  assert.doesNotMatch(healthJob, /AGORA_|secure_calls|Secure Calls/);
});

test("passenger details keep recentCalls as an empty compatibility field", () => {
  const source = readFileSync(
    new URL("../src/controllers/userController.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /recentCalls:\s*\[\]/);
  assert.doesNotMatch(source, /[^:]\brecentCalls,/);
});

test("content audits are append-only and bounded to content entity types and actions", () => {
  assert.deepEqual(CONTENT_ENTITY_TYPES, ["banner", "conversation"]);
  assert.deepEqual(CONTENT_ACTIONS, [
    "created",
    "updated",
    "activated",
    "deactivated",
    "deleted",
    "note_added",
  ]);
  const schema = ContentAudit.schema;
  assert.equal(schema.path("entityType").options.immutable, true);
  assert.equal(schema.path("entityId").options.immutable, true);
  assert.equal(schema.path("action").options.immutable, true);
  assert.equal(schema.path("occurredAt").options.immutable, true);
  const source = readFileSync(new URL("../src/models/ContentAudit.js", import.meta.url), "utf8");
  for (const hook of [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "replaceOne",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
  ]) {
    assert.match(source, new RegExp(`"${hook}"`), `missing append-only guard for ${hook}`);
  }
  assert.match(source, /pre\("save"[\s\S]*?rejectExistingSave/);
});

test("banner model exposes scheduling, placement and monotonic counters", () => {
  const schema = Banner.schema;
  assert.equal(schema.path("title").options.maxlength, 120);
  assert.deepEqual(schema.path("placement").enumValues, ["home", "splash", "ride", "checkout", "promo"]);
  assert.equal(schema.path("active").instance, "Boolean");
  assert.equal(schema.path("impressionCount").options.min, 0);
  assert.equal(schema.path("clickCount").options.min, 0);
  for (const hidden of ["imageFileName", "imageStorage", "imageKey"]) {
    assert.equal(schema.path(hidden).options.select, false, `${hidden} should not be projected by default`);
  }
});

test("ride conversations expose an admin note but never participant contact details", () => {
  const schema = RideConversation.schema;
  assert.equal(schema.path("adminNote").instance, "String");
  assert.equal(schema.path("adminNote").options.maxlength, 2000);
  for (const secret of ["phone", "whatsappNumber", "countryCode"]) {
    assert.equal(Boolean(schema.path(secret)), false, `RideConversation leaked ${secret}`);
  }
});

test("admin conversation message inspection validates the conversation id before querying", async () => {
  const { res, result } = capture();
  await getAdminConversationMessages(
    { params: { id: "not-an-id" }, query: {}, admin: { _id: "admin" } },
    res
  );
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "ADMIN_SYSTEM_ERROR");
  assert.match(result.body.message, /conversation id/i);
});

test("conversation notes require content and cap at 2000 characters", async () => {
  const { res, result } = capture();

  await addAdminConversationNote(
    { params: { id: "not-an-id" }, body: { note: "hello" }, admin: { _id: "admin" } },
    res
  );
  assert.equal(result.status, 400);
  assert.match(result.body.message, /conversation id/i);

  await addAdminConversationNote(
    { params: { id: "64c9a5b8a1b2c3d4e5f6a7b8" }, body: { note: "   " }, admin: { _id: "admin" } },
    res
  );
  assert.equal(result.status, 400);
  assert.match(result.body.message, /note/);

  await addAdminConversationNote(
    { params: { id: "64c9a5b8a1b2c3d4e5f6a7b8" }, body: { note: "x".repeat(2001) }, admin: { _id: "admin" } },
    res
  );
  assert.equal(result.status, 400);
  assert.match(result.body.message, /2000/);
});

test("banner toggle requires an explicit boolean before touching storage", async () => {
  const { res, result } = capture();
  await toggleBannerStatus(
    { params: { id: "not-an-id" }, body: { active: true }, admin: { _id: "admin" } },
    res
  );
  assert.equal(result.status, 400);
  assert.match(result.body.message, /Invalid banner id/);

  await toggleBannerStatus(
    { params: { id: "64c9a5b8a1b2c3d4e5f6a7b8" }, body: {}, admin: { _id: "admin" } },
    res
  );
  assert.equal(result.status, 400);
  assert.match(result.body.message, /active must be a boolean/);
});

test("banner delete rejects invalid ids before touching storage", async () => {
  const { res, result } = capture();
  await deleteBanner(
    { params: { id: "not-an-id" }, admin: { _id: "admin" } },
    res
  );
  assert.equal(result.status, 400);
  assert.match(result.body.message, /Invalid banner id/);
});

test("banner serialization rewrites image urls through the public asset helper", () => {
  const source = readFileSync(
    new URL("../src/controllers/bannerController.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /buildPublicAssetUrl/);
  assert.match(source, /get-image\//);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import rideRoute from "../src/routes/rideRoutes.js";
import RideMessage from "../src/models/RideMessage.js";
import {
  CHAT_AUDIO_MAX_FILE_SIZE,
  CHAT_AUDIO_MAX_DURATION_SECONDS,
  removeChatAudioUpload,
} from "../src/utils/chatAudioUpload.js";

const routeLayer = (router, path, method) =>
  router.stack.find((layer) => layer.route?.path === path && layer.route.methods?.[method]);

const mountedGuards = (router, path, method) => {
  const layer = routeLayer(router, path, method);
  assert.ok(layer, `expected route ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((handler) => handler.handle.name);
};

test("every ride route sits behind authentication at the router level", () => {
  const source = readFileSync(new URL("../src/routes/rideRoutes.js", import.meta.url), "utf8");
  assert.match(source, /router\.use\(requireSignIn\)/, "rideRoutes must require sign-in globally");
});

test("voice message upload is rate limited, multipart-parsed and participant-guarded", () => {
  const guards = mountedGuards(rideRoute, "/:rideId/messages/voice", "post");
  // rate limit + multer wrapper are anonymous middlewares; the terminal
  // handler must be the voice controller.
  assert.equal(guards.length, 3, "expected upload + handler chain after router auth");
  assert.equal(guards[2], "sendRideVoiceMessage");
});

test("voice audio streaming re-checks participation in its own handler", () => {
  const guards = mountedGuards(rideRoute, "/:rideId/messages/:messageId/audio", "get");
  assert.deepEqual(guards, ["getRideMessageAudio"]);
});

test("text messaging routes are unchanged by the voice feature", () => {
  const textGuards = mountedGuards(rideRoute, "/:rideId/messages", "post");
  assert.equal(textGuards[textGuards.length - 1], "sendRideMessage");
  const listLayer = routeLayer(rideRoute, "/:rideId/messages", "get");
  assert.ok(listLayer, "message listing route must remain mounted");
});

test("RideMessage schema stores voice notes without inline media", () => {
  const schema = RideMessage.schema;
  assert.deepEqual([...schema.path("messageType").enumValues], ["text", "trip_request", "voice"]);
  assert.equal(schema.path("text").defaultValue, "", "text must stay optional for voice rows");
  assert.deepEqual(JSON.parse(JSON.stringify(schema.path("audioStorage").enumValues)), [
    null,
    "s3",
    "local",
  ]);
  assert.equal(schema.path("audioDuration").options.min, 0);
  assert.ok(
    schema.indexes().some(
      ([keys, options]) =>
        keys.rideId === 1 && keys.senderId === 1 && keys.clientMessageId === 1 && options.unique,
    ),
    "idempotency unique index is required",
  );
});

test("client-facing DTOs never leak storage internals", () => {
  const source = readFileSync(new URL("../src/controllers/rideController.js", import.meta.url), "utf8");
  const dtoBody = source.match(/const toRideMessageDto = \(message\) => \{([\s\S]*?)\n\};/);
  assert.ok(dtoBody, "toRideMessageDto must exist");
  assert.match(dtoBody[1], /delete plain\.audioKey/, "DTO must strip the storage key");
  assert.match(dtoBody[1], /delete plain\.audioStorage/, "DTO must strip the storage driver");
  // The realtime payload is an allowlist and never contained them.
  const eventBody = source.match(/const rideMessageEventPayload = \(message\) => \(\{([\s\S]*?)\}\);/);
  assert.ok(eventBody, "rideMessageEventPayload must exist");
  assert.doesNotMatch(eventBody[1], /audioKey|audioStorage/, "socket payload must stay allowlisted");
});

test("voice upload policy defaults are speech-friendly and bounded", () => {
  assert.equal(CHAT_AUDIO_MAX_FILE_SIZE, 5 * 1024 * 1024);
  assert.equal(CHAT_AUDIO_MAX_DURATION_SECONDS, 120);
  const source = readFileSync(new URL("../src/utils/chatAudioUpload.js", import.meta.url), "utf8");
  for (const mime of ["audio/mp4", "audio/mpeg", "audio/3gpp", "audio/aac"]) {
    assert.match(source, new RegExp(mime.replace("/", "\\/")), `allowlist missing ${mime}`);
  }
  assert.doesNotMatch(source, /video\//, "video must never be accepted as a voice note");
});

test("cleaning up an already-missing voice file resolves instead of throwing", async () => {
  await assert.doesNotReject(
    removeChatAudioUpload({ storage: "local", key: "chat-audio/definitely-missing.m4a" }),
  );
});

test("conversation previews and notifications describe voice notes", () => {
  const source = readFileSync(new URL("../src/services/conversationService.js", import.meta.url), "utf8");
  assert.match(source, /Voice message/, "conversation preview must label voice notes");
  assert.match(source, /voice message/, "notification body must mention voice messages");
});

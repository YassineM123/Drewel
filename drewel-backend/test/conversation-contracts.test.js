import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import RideConversation, { CONVERSATION_STATUSES } from "../src/models/RideConversation.js";
import Notification from "../src/models/Notification.js";
import CommunicationAudit from "../src/models/CommunicationAudit.js";
import {
  conversationStatusForRide,
  toConversationDto,
} from "../src/services/conversationService.js";
import conversationRoutes from "../src/routes/conversationRoutes.js";
import { messageRateLimit } from "../src/middlewares/marketplaceRateLimit.js";

const routeLayer = (router, path, method) => router.stack.find(
  (layer) => layer.route?.path === path && layer.route.methods?.[method]
);

const makeConversation = (overrides = {}) => new RideConversation({
  rideId: "69ca8d07657eef3a66dd6a11",
  rideReference: "DRW-TEST",
  passengerId: "69ca8d07657eef3a66dd6a12",
  driverId: "69ca8d07657eef3a66dd6a13",
  passengerName: "Amira K",
  passengerImage: "https://cdn.example/passenger.png",
  driverName: "Tariq A",
  driverImage: "https://cdn.example/driver.png",
  driverVehicleType: "Sedan",
  driverVehicleModel: "Toyota Camry",
  driverRegistration: "DUK-7777",
  driverRegistrationVisible: true,
  driverRating: 4.8,
  status: "active",
  passengerUnreadCount: 0,
  driverUnreadCount: 2,
  lastMessageAt: new Date("2026-08-01T10:00:00.000Z"),
  lastMessagePreview: "I am outside",
  lastMessageSenderRole: "driver",
  lastMessageStatus: "sent",
  ...overrides,
});

test("ride lifecycle statuses map to a bounded conversation status set", () => {
  assert.deepEqual(CONVERSATION_STATUSES, ["active", "completed", "cancelled"]);
  for (const status of [
    "contacting", "accepted", "driver_arriving", "driver_on_the_way",
    "driver_arrived", "pickup_confirmed", "in_progress", "disputed", "offer_pending",
  ]) assert.equal(conversationStatusForRide({ status }), "active");
  assert.equal(conversationStatusForRide({ status: "completed" }), "completed");
  for (const status of ["cancelled", "cancelled_by_passenger", "cancelled_by_driver", "cancelled_timeout"]) {
    assert.equal(conversationStatusForRide({ status }), "cancelled");
  }
  assert.equal(conversationStatusForRide({}), "active");
});

test("conversation model enforces one ride and participant inbox indexes", () => {
  const indexes = RideConversation.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.rideId === 1 && options.unique === true));
  assert.ok(indexes.some(([keys]) => keys.passengerId === 1 && keys.status === 1 && keys.lastMessageAt === -1));
  assert.ok(indexes.some(([keys]) => keys.driverId === 1 && keys.status === 1 && keys.lastMessageAt === -1));
  assert.equal(RideConversation.schema.path("passengerUnreadCount").instance, "Number");
  assert.equal(RideConversation.schema.path("passengerUnreadCount").options.min, 0);
  assert.equal(RideConversation.schema.path("driverUnreadCount").options.min, 0);
  assert.equal(RideConversation.schema.path("rideId").options.unique, true);
});

test("conversation DTO shows only the counterpart and never leaks contact secrets", () => {
  const passenger = { id: "69ca8d07657eef3a66dd6a12", role: "passenger" };
  const driver = { id: "69ca8d07657eef3a66dd6a13", role: "driver" };

  const passengerView = toConversationDto(makeConversation(), passenger);
  assert.equal(passengerView.counterpart.role, "driver");
  assert.equal(passengerView.counterpart.id, "69ca8d07657eef3a66dd6a13");
  assert.equal(passengerView.counterpart.fullName, "Tariq A");
  assert.equal(passengerView.counterpart.vehicleType, "Sedan");
  assert.equal(passengerView.counterpart.vehicleModel, "Toyota Camry");
  assert.equal(passengerView.counterpart.registration, "DUK-7777");
  assert.equal(passengerView.counterpart.rating, 4.8);
  assert.equal(passengerView.myUnreadCount, 0);

  const driverView = toConversationDto(makeConversation(), driver);
  assert.equal(driverView.counterpart.role, "passenger");
  assert.equal(driverView.counterpart.id, "69ca8d07657eef3a66dd6a12");
  assert.equal(driverView.counterpart.fullName, "Amira K");
  assert.equal(driverView.myUnreadCount, 2);
  assert.equal(driverView.counterpart.vehicleType, undefined);
  assert.equal(driverView.counterpart.registration, undefined);
  assert.equal(driverView.counterpart.rating, undefined);

  for (const view of [passengerView, driverView]) {
    for (const secret of ["phone", "whatsappNumber", "token", "countryCode", "email"]) {
      assert.equal(JSON.stringify(view).includes(secret), false);
    }
    assert.equal(view.lastMessage.preview, "I am outside");
    assert.equal(view.lastMessage.senderRole, "driver");
  }
});

test("driver registration is hidden unless the driver opted in", () => {
  const passenger = { id: "69ca8d07657eef3a66dd6a12", role: "passenger" };
  const hidden = toConversationDto(
    makeConversation({ driverRegistrationVisible: false, driverRegistration: "SECRET-1111" }),
    passenger
  );
  assert.equal(hidden.counterpart.registration, undefined);
});

test("conversation routes require JWT and expose the thread API", () => {
  for (const [path, method] of [
    ["/", "get"], ["/summary", "get"], ["/:rideId", "get"], ["/:rideId/read", "post"],
  ]) assert.ok(routeLayer(conversationRoutes, path, method), `${method.toUpperCase()} ${path}`);
  assert.equal(conversationRoutes.stack[0].handle.name, "requireSignIn");
  const summaryIndex = conversationRoutes.stack.findIndex((layer) => layer.route?.path === "/summary");
  const parameterIndex = conversationRoutes.stack.findIndex((layer) => layer.route?.path === "/:rideId");
  assert.ok(summaryIndex >= 0 && summaryIndex < parameterIndex, "/summary must be registered before /:rideId");
  const readLayer = routeLayer(conversationRoutes, "/:rideId/read", "post");
  assert.equal(readLayer.route.stack.length, 2);
  assert.equal(readLayer.route.stack[0].handle, messageRateLimit);
});

test("inbox lists are participant-scoped and bounded by the server", () => {
  const source = fs.readFileSync(new URL("../src/services/conversationService.js", import.meta.url), "utf8");
  const start = source.indexOf("export const listConversations");
  const end = source.indexOf("export const getUnreadSummary", start);
  const block = source.slice(start, end);
  assert.match(block, /principal\.role === "passenger" \? "passengerId" : "driverId"/);
  assert.match(block, /\[participantField\]: principal\.id/);
  assert.match(block, /Math\.min\(50, Math\.max\(1/);
  assert.match(block, /filter\.\$or = \[\{ status: "active" \}, \{ lastMessageAt: \{ \$ne: null \} \}\]/);
  assert.match(block, /new RegExp\(escapeRegex/);
  assert.equal(block.includes("req.body.passengerId"), false);
  assert.equal(block.includes("req.body.driverId"), false);
  assert.equal(block.includes("req.query.passengerId"), false);
  assert.equal(block.includes("req.query.driverId"), false);
});

test("marking read zeroes only the caller's own unread counter and audits", () => {
  const source = fs.readFileSync(new URL("../src/services/conversationService.js", import.meta.url), "utf8");
  const start = source.indexOf("export const markConversationRead");
  const end = source.indexOf("const escapeRegex", start);
  const block = source.slice(start, end);
  assert.match(block, /principal\.role === "passenger" \? "passengerUnreadCount" : "driverUnreadCount"/);
  assert.match(block, /\$set: \{ \[unreadField\]: 0 \}/);
  assert.match(block, /action: "conversation_marked_read"/);
  assert.match(block, /assertRideParticipant/);
});

test("new messages bump the counterpart unread counter and notify once per recipient", () => {
  const source = fs.readFileSync(new URL("../src/services/conversationService.js", import.meta.url), "utf8");
  const start = source.indexOf("export const touchConversationWithMessage");
  const block = source.slice(start);
  assert.match(block, /participantRole === "passenger" \? "driverUnreadCount" : "passengerUnreadCount"/);
  assert.match(block, /\$inc: \{ \[unreadField\]: 1 \}/);
  assert.match(block, /participantRole === "passenger" \? conversation\.driverId : conversation\.passengerId/);
  assert.match(block, /recipientType = participantRole === "passenger" \? "driver" : "user"/);
  assert.match(block, /eventKey = `ride-message:\$\{ride\._id\}:\$\{message\._id\}:\$\{recipientId\}`/);
  assert.match(block, /findOneAndUpdate\(\s*\{ eventKey \}/s);
  assert.match(block, /\$setOnInsert/);
  assert.match(block, /error\?\.code !== 11000/);
  assert.equal(Notification.schema.indexes().some(([keys, options]) => keys.eventKey === 1 && options.unique === true), true);
});

test("conversation materialization is idempotent via upsert on ride id", () => {
  const source = fs.readFileSync(new URL("../src/services/conversationService.js", import.meta.url), "utf8");
  const start = source.indexOf("export const ensureConversationForRide");
  const end = source.indexOf("export const syncConversationForRideId", start);
  const block = source.slice(start, end);
  assert.match(block, /findOneAndUpdate\(/);
  assert.match(block, /\{ rideId: ride\._id \}/);
  assert.match(block, /upsert: true, runValidators: true/);
});

test("ride lifecycle wiring materializes conversations and keeps the inbox in sync", () => {
  const rideSource = fs.readFileSync(new URL("../src/controllers/rideController.js", import.meta.url), "utf8");
  assert.ok((rideSource.match(/ensureConversationForRide\(/g) || []).length >= 3);
  assert.ok(rideSource.includes("syncConversationForRideId(contact._id)"));
  assert.ok(rideSource.includes("touchConversationWithMessage({"));
  assert.ok(rideSource.includes("markConversationRead({"));
  assert.ok(rideSource.includes('emit("conversation:updated"'));
  assert.ok(rideSource.includes('emit("notification:new"'));

  const offerSource = fs.readFileSync(new URL("../src/controllers/tripOfferController.js", import.meta.url), "utf8");
  assert.ok(offerSource.includes("ensureConversationForRide(result.ride)"));
  assert.ok(offerSource.includes("syncConversationForRideId(contact._id)"));
});

test("real-time conversation payloads carry no contact secrets", () => {
  const rideSource = fs.readFileSync(new URL("../src/controllers/rideController.js", import.meta.url), "utf8");
  const start = rideSource.indexOf("export const emitConversationUpdated");
  const end = rideSource.indexOf("export const emitNotificationNew", start);
  const block = rideSource.slice(start, end);
  for (const secret of ["phone", "whatsappNumber", "channelName", "token", "email"]) {
    assert.equal(block.includes(secret), false);
  }
  assert.match(block, /unreadCount: conversation\.passengerUnreadCount/);
  assert.match(block, /unreadCount: conversation\.driverUnreadCount/);
});

test("public participant DTO exposes vehicle info but never driver secrets", () => {
  const rideSource = fs.readFileSync(new URL("../src/controllers/rideController.js", import.meta.url), "utf8");
  const start = rideSource.indexOf("const publicParticipantDto");
  const end = rideSource.indexOf("const emitConversationUpdated", start);
  const block = rideSource.slice(start, end);
  assert.match(block, /vehicleModel: participant\.vehicleModel \|\| ""/);
  assert.match(block, /participant\.registrationVisible \? participant\.registration \|\| "" : ""/);
  assert.match(block, /rating: participant\.rating \?\? null/);
  for (const secret of ["phone", "whatsappNumber", "countryCode", "token"]) {
    assert.equal(block.includes(secret), false);
  }
  assert.match(rideSource, /\.select\("firstName lastName fullName profileImageUrl vehicleType vehicleModel registration registrationVisible rating"\)/);
});

test("conversation API is mounted and auditable end to end", () => {
  const indexSource = fs.readFileSync(new URL("../index.js", import.meta.url), "utf8");
  assert.match(indexSource, /app\.use\("\/api\/conversations", conversationRoutes\)/);
  assert.equal(CommunicationAudit.schema.path("action").options.immutable, true);
  assert.match(rideSourceForAudit(), /action: "conversation_marked_read"/);
});

function rideSourceForAudit() {
  return fs.readFileSync(new URL("../src/services/conversationService.js", import.meta.url), "utf8");
}

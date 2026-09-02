import test from "node:test";
import assert from "node:assert/strict";
import {
  notificationChannelForType,
  notificationSoundForType,
  pushPriorityForType,
  isActionableType,
  deepLinkFor,
  NOTIFICATION_PRIORITIES,
} from "../src/services/notificationService.js";
import DeviceToken from "../src/models/DeviceToken.js";
import Notification from "../src/models/Notification.js";

test("notificationChannelForType maps all Drewel event types to proper Android channels", () => {
  assert.equal(notificationChannelForType("RIDE_REQUEST"), "drewel_ride_requests");
  assert.equal(notificationChannelForType("NEW_RIDE"), "drewel_ride_requests");
  assert.equal(notificationChannelForType("RIDE_MESSAGE"), "drewel_messages");
  assert.equal(notificationChannelForType("CHAT"), "drewel_messages");
  assert.equal(notificationChannelForType("CALL_INCOMING"), "drewel_calls");
  assert.equal(notificationChannelForType("CALL"), "drewel_calls");
  assert.equal(notificationChannelForType("POINTS_LOW_BALANCE"), "drewel_payments");
  assert.equal(notificationChannelForType("POINTS_CREDITED"), "drewel_payments");
  assert.equal(notificationChannelForType("POINT_PURCHASE_REQUEST_UPDATED"), "drewel_payments");
  assert.equal(notificationChannelForType("RIDE_ACCEPTED"), "drewel_ride_updates");
  assert.equal(notificationChannelForType("DRIVER_ARRIVED"), "drewel_ride_updates");
  assert.equal(notificationChannelForType("RIDE_COMPLETED"), "drewel_ride_updates");
  assert.equal(notificationChannelForType("RIDE_CANCELLED"), "drewel_ride_updates");
  assert.equal(notificationChannelForType("GENERAL"), "drewel_general");
  assert.equal(notificationChannelForType("DOCUMENT_APPROVED"), "drewel_general");
  assert.equal(notificationChannelForType("DRIVER_ACCOUNT_APPROVED"), "drewel_general");
});

test("notificationSoundForType maps Drewel event types to matching branded WAV sound names", () => {
  assert.equal(notificationSoundForType("RIDE_REQUEST"), "drewel_ride_request");
  assert.equal(notificationSoundForType("RIDE_MESSAGE"), "drewel_message");
  assert.equal(notificationSoundForType("DRIVER_ARRIVED"), "drewel_driver_arrived");
  assert.equal(notificationSoundForType("CALL_INCOMING"), "drewel_call");
  assert.equal(notificationSoundForType("POINTS_LOW_BALANCE"), "drewel_warning");
  assert.equal(notificationSoundForType("POINTS_INSUFFICIENT_BALANCE"), "drewel_warning");
  assert.equal(notificationSoundForType("POINTS_CREDITED"), "drewel_success");
  assert.equal(notificationSoundForType("WELCOME_POINTS_RECEIVED"), "drewel_success");
  assert.equal(notificationSoundForType("RIDE_COMPLETED"), "drewel_success");
  assert.equal(notificationSoundForType("GENERAL"), "drewel_notification");
  assert.equal(notificationSoundForType("DOCUMENT_APPROVED"), "drewel_notification");
});

test("pushPriorityForType assigns critical priority to urgent operational events", () => {
  assert.equal(pushPriorityForType("RIDE_REQUEST"), NOTIFICATION_PRIORITIES.CRITICAL);
  assert.equal(pushPriorityForType("NEW_RIDE"), NOTIFICATION_PRIORITIES.CRITICAL);
  assert.equal(pushPriorityForType("DRIVER_ARRIVED"), NOTIFICATION_PRIORITIES.CRITICAL);
  assert.equal(pushPriorityForType("CALL_INCOMING"), NOTIFICATION_PRIORITIES.CRITICAL);
  assert.equal(pushPriorityForType("RIDE_ACCEPTED"), NOTIFICATION_PRIORITIES.HIGH);
  assert.equal(pushPriorityForType("RIDE_ON_THE_WAY"), NOTIFICATION_PRIORITIES.HIGH);
  assert.equal(pushPriorityForType("RIDE_CANCELLED"), NOTIFICATION_PRIORITIES.HIGH);
  assert.equal(pushPriorityForType("POINTS_LOW_BALANCE"), NOTIFICATION_PRIORITIES.HIGH);
  assert.equal(pushPriorityForType("DOCUMENT_APPROVED"), NOTIFICATION_PRIORITIES.HIGH);
  assert.equal(pushPriorityForType("RIDE_MESSAGE"), NOTIFICATION_PRIORITIES.NORMAL);
});

test("deepLinkFor constructs valid drewel:// URIs for all actionable event types", () => {
  assert.equal(deepLinkFor({ type: "RIDE_REQUEST" }), "drewel://driver/ride-request");
  assert.equal(deepLinkFor({ type: "RIDE_ACCEPTED" }), "drewel://passenger/active-ride");
  assert.equal(deepLinkFor({ type: "DRIVER_ARRIVED" }), "drewel://passenger/active-ride");
  assert.equal(deepLinkFor({ type: "RIDE_COMPLETED" }), "drewel://passenger/ride-summary");
  assert.equal(deepLinkFor({ type: "RIDE_MESSAGE", conversationId: "conv123" }), "drewel://chat/ride?conversationId=conv123");
  assert.equal(deepLinkFor({ type: "POINTS_LOW_BALANCE" }), "drewel://driver/points");
  assert.equal(deepLinkFor({ type: "DOCUMENT_APPROVED" }), "drewel://documents");
  assert.equal(deepLinkFor({ type: "DRIVER_ACCOUNT_APPROVED" }), "drewel://driver/status");
  assert.equal(deepLinkFor({ type: "GENERAL" }), "drewel://notifications");
});

test("DeviceToken and Notification schemas enforce unique constraints and indexes", () => {
  const tokenIndexes = DeviceToken.schema.indexes();
  assert.ok(tokenIndexes.some(([keys, opts]) => keys.userId === 1 && keys.deviceId === 1 && keys.token === 1 && opts?.unique));
  assert.ok(tokenIndexes.some(([keys]) => keys.token === 1 && keys.isActive === 1));

  const noteIndexes = Notification.schema.indexes();
  assert.ok(noteIndexes.some(([keys, opts]) => keys.eventKey === 1 && opts?.unique));
  assert.ok(noteIndexes.some(([keys]) => keys.userId === 1 && keys.recipientType === 1 && keys.createdAt === -1));
});

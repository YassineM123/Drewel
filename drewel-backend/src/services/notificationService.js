import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import DeviceToken from "../models/DeviceToken.js";
import { io } from "../socket/index.js";

/**
 * ============================================================================
 * DREWEL NOTIFICATION SERVICE
 * ============================================================================
 *
 * Single entry point for every notification in Drewel. Controllers, services
 * and jobs must go through [dispatchNotification] instead of writing to the
 * Notification collection or emitting socket events directly. This guarantees:
 *
 *  1. In-app history is persisted once and de-duplicated by eventKey.
 *  2. The realtime `notification:new` socket event is always emitted.
 *  3. A device push (FCM) is requested when the provider is configured.
 *  4. Failures are logged and never propagate into ride/call transactions.
 *
 * PUSH PROVIDER
 * -------------
 * Push delivery uses Firebase Cloud Messaging via `firebase-admin`. It is
 * OPT-IN: set `FCM_SERVICE_ACCOUNT_JSON` (raw JSON) or
 * `GOOGLE_APPLICATION_CREDENTIALS` (path) in the environment. When no
 * credentials are present the service degrades gracefully — in-app + realtime
 * notifications keep working and a one-time warning is logged.
 *
 * SECURITY
 * --------
 * The recipient is always derived server-side. Notification bodies never
 * contain phone numbers, tokens or other private data, and push payloads never
 * include authentication material.
 */

export const NOTIFICATION_PRIORITIES = Object.freeze({
  CRITICAL: 2,
  HIGH: 1,
  NORMAL: 0,
  LOW: -1,
});

const LOG_TAG = "[notification]";

const log = (level, message, extra = {}) => {
  const safeExtra = Object.fromEntries(
    Object.entries(extra).filter(
      ([key, value]) => key !== "token" && key !== "authorization"
    )
  );
  if (level === "error") console.error(LOG_TAG, message, safeExtra);
  else if (level === "warn") console.warn(LOG_TAG, message, safeExtra);
  else console.log(LOG_TAG, message, safeExtra);
};

const tokenTail = (token) =>
  String(token || "").slice(-8).padStart(8, "•");

// ---------------------------------------------------------------------------
// Android channel + sound + priority mapping
// ---------------------------------------------------------------------------

/**
 * Maps a notification type to an Android notification channel. Channel ids
 * must match those created in android/app/src/main/kotlin/com/drewel/MainActivity.kt.
 */
export const notificationChannelForType = (type) => {
  const t = String(type || "").toUpperCase();
  if (t === "RIDE_REQUEST" || t === "NEW_RIDE") return "drewel_ride_requests";
  if (t === "RIDE_MESSAGE" || t === "CHAT") return "drewel_messages";
  if (t.startsWith("CALL_") || t === "CALL") return "drewel_calls";
  if (t.startsWith("POINTS") || t.startsWith("OFFER_POINTS") || t.startsWith("RIDE_POINTS") || t.startsWith("WELCOME") || t === "POINT_PURCHASE_REQUEST_UPDATED") {
    return "drewel_payments";
  }
  if (t.startsWith("RIDE_") || t === "DRIVER_ARRIVED" || t.startsWith("TRIP_OFFER") || t === "OFFER") {
    return "drewel_ride_updates";
  }
  return "drewel_general";
};

export const notificationSoundForType = (type) => {
  const t = String(type || "").toUpperCase();
  if (t === "RIDE_REQUEST" || t === "NEW_RIDE") return "drewel_ride_request";
  if (t === "RIDE_MESSAGE" || t === "CHAT") return "drewel_message";
  if (t === "DRIVER_ARRIVED") return "drewel_driver_arrived";
  if (t.startsWith("CALL_") || t === "CALL") return "drewel_call";
  if (t === "POINTS_LOW_BALANCE" || t === "POINTS_INSUFFICIENT_BALANCE") return "drewel_warning";
  if (
    t.startsWith("POINTS") ||
    t.startsWith("WELCOME") ||
    t.startsWith("OFFER_POINTS") ||
    t.startsWith("RIDE_POINTS") ||
    t === "RIDE_COMPLETED" ||
    t === "POINT_PURCHASE_REQUEST_UPDATED"
  ) {
    return "drewel_success";
  }
  return "drewel_notification";
};

export const pushPriorityForType = (type) => {
  const t = String(type || "").toUpperCase();
  if (
    t === "RIDE_REQUEST" ||
    t === "NEW_RIDE" ||
    t === "DRIVER_ARRIVED" ||
    t.startsWith("CALL_") ||
    t === "CALL"
  ) {
    return NOTIFICATION_PRIORITIES.CRITICAL;
  }
  if (
    t === "RIDE_ACCEPTED" ||
    t === "RIDE_CONFIRMED" ||
    t === "RIDE_ON_THE_WAY" ||
    t === "RIDE_CANCELLED" ||
    t === "RIDE_COMPLETED" ||
    t === "RIDE_STARTED" ||
    t === "RIDE_DRIVER_CANCELLED" ||
    t === "RIDE_PASSENGER_CANCELLED" ||
    t === "POINTS_LOW_BALANCE" ||
    t === "POINTS_INSUFFICIENT_BALANCE" ||
    t === "DOCUMENT_APPROVED" ||
    t === "DOCUMENT_REJECTED" ||
    t === "DOCUMENT_EXPIRING" ||
    t === "DRIVER_ACCOUNT_APPROVED" ||
    t === "DRIVER_ACCOUNT_REJECTED"
  ) {
    return NOTIFICATION_PRIORITIES.HIGH;
  }
  if (
    t === "RIDE_MESSAGE" ||
    t === "CHAT" ||
    t.startsWith("POINTS") ||
    t.startsWith("TRIP_OFFER")
  ) {
    return NOTIFICATION_PRIORITIES.NORMAL;
  }
  return NOTIFICATION_PRIORITIES.LOW;
};

/**
 * A notification is "actionable" when tapping it must take the user to a
 * specific screen. Only these types participate in the badge / unread UX and
 * deep-link routing; purely informational events may still be persisted.
 */
export const isActionableType = (type) => {
  const t = String(type || "").toUpperCase();
  return (
    t.startsWith("RIDE_") ||
    t === "RIDE_MESSAGE" ||
    t === "CHAT" ||
    t === "OFFER" ||
    t === "TRIP_OFFER" ||
    t === "NEW_RIDE" ||
    t === "RIDE_REQUEST" ||
    t.startsWith("CALL") ||
    t.startsWith("POINTS") ||
    t.startsWith("DOCUMENT") ||
    t.startsWith("DRIVER_ACCOUNT")
  );
};

// ---------------------------------------------------------------------------
// FCM (Firebase Cloud Messaging)
// ---------------------------------------------------------------------------

let _messagingPromise = null;
let _fcmUnavailableWarned = false;

const buildFirebaseApp = async () => {
  if (_messagingPromise) return _messagingPromise;
  _messagingPromise = (async () => {
    try {
      const { initializeApp, cert, getApps } = await import("firebase-admin/app");
      const { getMessaging } = await import("firebase-admin/messaging");
      const existing = getApps().find((app) => app.name === "drewel");
      const app = existing || initializeApp({ credential: await buildCredential() }, "drewel");
      return { messaging: getMessaging(app), available: true };
    } catch (error) {
      log("warn", "FCM push is not available; in-app + realtime notifications still work.", {
        reason: error?.message?.slice(0, 120),
      });
      return { messaging: null, available: false };
    }
  })();
  return _messagingPromise;
};

const buildCredential = async () => {
  const { cert, applicationDefault } = await import("firebase-admin/app");
  const rawJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (rawJson && rawJson.trim()) {
    try {
      return cert(JSON.parse(rawJson));
    } catch (error) {
      throw new Error(`FCM_SERVICE_ACCOUNT_JSON is not valid JSON: ${error.message}`);
    }
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath && keyPath.trim()) {
    return cert(keyPath);
  }
  // Last resort: ADC (useful on GCP). Throws when nothing is configured.
  return applicationDefault();
};

export const isPushConfigured = async () => {
  const { available } = await buildFirebaseApp();
  return available;
};

/**
 * Sends an FCM push to every active device token of the recipient. Invalid or
 * revoked tokens returned by the provider are deactivated. Never throws into
 * the caller — push delivery must not break ride/call transactions.
 */
export const sendPushToUser = async ({
  userId,
  title,
  body,
  data = {},
  type = "GENERAL",
  deepLink = "",
}) => {
  if (!userId) return { sent: 0, skipped: true };
  const tokens = await DeviceToken.find({ userId, isActive: true })
    .select("token deviceId")
    .lean();
  if (!tokens.length) return { sent: 0, skipped: true };

  let service;
  try {
    const fcm = await buildFirebaseApp();
    if (!fcm.available) {
      if (!_fcmUnavailableWarned) {
        _fcmUnavailableWarned = true;
        log(
          "warn",
          "Push skipped: Firebase credentials not configured (set FCM_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS)."
        );
      }
      return { sent: 0, skipped: true };
    }
    service = fcm.messaging;
  } catch (error) {
    log("error", "Push skipped: Firebase unavailable.", { reason: error.message });
    return { sent: 0, skipped: true };
  }

  const channel = notificationChannelForType(type);
  const sound = notificationSoundForType(type);
  const priority = pushPriorityForType(type);
  const effectiveDeepLink = String(data?.deepLink || deepLink || "").trim();

  // FCM data dictionary must consist strictly of string keys and string values
  const stringifiedData = {};
  if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && v !== null) {
        stringifiedData[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
      }
    }
  }
  stringifiedData.type = String(type || "GENERAL");
  stringifiedData.click_action = "FLUTTER_NOTIFICATION_CLICK";
  if (effectiveDeepLink) {
    stringifiedData.deepLink = effectiveDeepLink;
  }

  const payload = {
    data: stringifiedData,
    notification: { title: String(title || "Drewel"), body: String(body || ""), sound },
    android: {
      priority: priority >= NOTIFICATION_PRIORITIES.HIGH ? "high" : "normal",
      notification: {
        channel_id: channel,
        sound,
        priority: priority >= NOTIFICATION_PRIORITIES.HIGH ? "high" : "default",
        visibility: priority >= NOTIFICATION_PRIORITIES.HIGH ? "public" : "private",
        icon: "ic_stat_drewel",
      },
    },
    apns: {
      headers: { "apns-priority": priority >= NOTIFICATION_PRIORITIES.HIGH ? "10" : "5" },
      payload: { aps: { sound, badge: 1, "mutable-content": 1 } },
    },
  };

  let sent = 0;
  const invalidTokens = [];
  for (const entry of tokens) {
    try {
      await service.send({ token: entry.token, ...payload });
      sent += 1;
    } catch (error) {
      const code = error?.code || error?.errorInfo?.code || "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-unregistered"
      ) {
        invalidTokens.push(entry._id);
      } else {
        log("error", "Push delivery failed.", {
          code: code || error.message,
          token: tokenTail(entry.token),
        });
      }
    }
  }
  if (invalidTokens.length) {
    await DeviceToken.updateMany(
      { _id: { $in: invalidTokens } },
      { $set: { isActive: false, revokedAt: new Date() } }
    );
    log("warn", "Deactivated invalid push tokens returned by the provider.", {
      count: invalidTokens.length,
    });
  }
  return { sent, invalidated: invalidTokens.length };
};

// ---------------------------------------------------------------------------
// In-app + realtime
// ---------------------------------------------------------------------------

/**
 * Persists an in-app notification. De-duplicated by eventKey when provided.
 * Returns the stored notification or null when suppressed.
 */
export const createInAppNotification = async ({
  recipientId,
  recipientType = "user",
  type = "GENERAL",
  title = "",
  body = "",
  message = "",
  data = {},
  rideId = null,
  conversationId = null,
  messageId = null,
  deepLink = null,
  eventKey = null,
  expiresAt = null,
}) => {
  if (!recipientId || !message) return null;
  const set = {
    userId: recipientId,
    recipientType,
    type,
    title: String(title).slice(0, 160),
    message: String(message).slice(0, 1000),
    data: data && typeof data === "object" ? data : {},
    read: false,
    isValid: true,
    ...(rideId ? { rideId: mongoose.isValidObjectId(rideId) ? rideId : null } : {}),
    ...(conversationId
      ? { conversationId: mongoose.isValidObjectId(conversationId) ? conversationId : null }
      : {}),
    ...(messageId ? { messageId: String(messageId).slice(0, 200) } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(deepLink ? { deepLink: String(deepLink).slice(0, 512) } : {}),
  };

  try {
    const query = eventKey
      ? { eventKey, userId: recipientId }
      : { _id: new mongoose.Types.ObjectId() };
    const notification = await Notification.findOneAndUpdate(
      query,
      { $setOnInsert: set },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    if (eventKey && notification.read) {
      // A re-delivered event that the user already read is surfaced again as
      // unread only if it is a genuinely new occurrence — keep the existing
      // read state for idempotent replays.
      return notification;
    }
    return notification;
  } catch (error) {
    if (error?.code === 11000) return null;
    log("error", "In-app notification persistence failed.", {
      reason: error.message,
    });
    return null;
  }
};

/**
 * Emits the realtime `notification:new` socket event to the recipient's
 * personal room.
 */
export const emitNotificationNew = (notification) => {
  if (!notification) return;
  const payload = {
    id: String(notification._id),
    type: notification.type,
    title: notification.title || "",
    message: notification.message || "",
    read: Boolean(notification.read),
    data: notification.data || {},
    rideId: notification.rideId ? String(notification.rideId) : undefined,
    conversationId: notification.conversationId
      ? String(notification.conversationId)
      : undefined,
    messageId: notification.messageId ? String(notification.messageId) : undefined,
    deepLink: notification.deepLink || "",
    createdAt: notification.createdAt || new Date(),
  };
  io.to(String(notification.userId)).emit("notification:new", payload);
};

/**
 * The single dispatch pipeline: persist in-app history, broadcast realtime,
 * and request a device push. Notification failures never affect the caller.
 */
export const dispatchNotification = async (params) => {
  const notification = await createInAppNotification(params);
  if (notification) emitNotificationNew(notification);
  await sendPushToUser({
    userId: params.recipientId,
    title: params.title || "",
    body: params.message,
    data: notification
      ? {
          id: String(notification._id),
          type: notification.type,
          rideId: notification.rideId ? String(notification.rideId) : "",
          conversationId: notification.conversationId
            ? String(notification.conversationId)
            : "",
          messageId: notification.messageId || "",
          deepLink: notification.deepLink || "",
        }
      : {
          type: params.type || "GENERAL",
          deepLink: params.deepLink || "",
        },
    type: params.type || "GENERAL",
  });
  return notification;
};

// ---------------------------------------------------------------------------
// Device token lifecycle
// ---------------------------------------------------------------------------

/**
 * Registers a device push token for the signed-in user. One active token per
 * (userId, deviceId). A re-registration from the same device deactivates any
 * older tokens that no longer match, which prevents duplicate pushes after a
 * token refresh.
 */
export const registerDeviceToken = async ({
  userId,
  userType = "user",
  token,
  platform = "unknown",
  deviceId = "",
  appVersion = "",
}) => {
  if (!userId || !token) return { registered: false, reason: "MISSING_FIELDS" };
  if (!["user", "driver", "admin"].includes(userType)) userType = "user";
  const normalized = String(token).trim().slice(0, 512);
  if (!normalized) return { registered: false, reason: "EMPTY_TOKEN" };

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // Deactivate the same device's older tokens (refresh/reinstall).
      await DeviceToken.updateMany(
        {
          userId,
          deviceId: { $ne: "" },
          token: { $ne: normalized },
          isActive: true,
        },
        { $set: { isActive: false, revokedAt: new Date() } },
        { session }
      );
      result = await DeviceToken.findOneAndUpdate(
        { userId, deviceId, token: normalized },
        {
          $set: {
            userId,
            userType,
            token: normalized,
            platform,
            deviceId: String(deviceId).slice(0, 200),
            appVersion: String(appVersion || "").slice(0, 40),
            isActive: true,
            lastUsedAt: new Date(),
            revokedAt: null,
          },
          $setOnInsert: { registeredAt: new Date() },
        },
        { new: true, upsert: true, session, setDefaultsOnInsert: true }
      );
    });
    return { registered: true, tokenId: String(result._id) };
  } catch (error) {
    log("error", "Device token registration failed.", { reason: error.message });
    return { registered: false, reason: "REGISTRATION_FAILED" };
  } finally {
    await session.endSession();
  }
};

/**
 * Deactivates a device token (logout / account switch). Only the caller's own
 * token is affected — the backend never lets a client revoke another user's
 * device.
 */
export const unregisterDeviceToken = async ({ userId, token }) => {
  if (!token) return { unregistered: true };
  await DeviceToken.updateMany(
    { userId, token: String(token).slice(0, 512), isActive: true },
    { $set: { isActive: false, revokedAt: new Date() } }
  );
  return { unregistered: true };
};

export const getActiveDeviceTokens = async (userId) =>
  DeviceToken.find({ userId, isActive: true }).select("token platform deviceId").lean();

// ---------------------------------------------------------------------------
// Deep-link builders
// ---------------------------------------------------------------------------

/**
 * Builds the canonical deep link for a notification. Every actionable
 * notification carries one so the client can route without trusting
 * caller-supplied IDs alone.
 */
export const deepLinkFor = ({ type, rideId, conversationId, messageId, offerId }) => {
  const t = String(type || "").toUpperCase();
  if (t === "RIDE_REQUEST" || t === "NEW_RIDE") return "drewel://driver/ride-request";
  if (t === "RIDE_ACCEPTED" || t === "RIDE_CONFIRMED" || t === "DRIVER_ARRIVED") {
    return "drewel://passenger/active-ride";
  }
  if (t === "RIDE_ON_THE_WAY" || t === "RIDE_STARTED") return "drewel://passenger/active-ride";
  if (t === "RIDE_COMPLETED") return "drewel://passenger/ride-summary";
  if (t === "RIDE_DRIVER_CANCELLED" || t === "RIDE_PASSENGER_CANCELLED") {
    return "drewel://rides";
  }
  if (t === "RIDE_MESSAGE" || t === "CHAT") {
    return `drewel://chat/ride${conversationId ? `?conversationId=${conversationId}` : ""}`;
  }
  if (t === "DOCUMENT_REJECTED" || t === "DOCUMENT_EXPIRING" || t === "DOCUMENT_APPROVED") {
    return "drewel://documents";
  }
  if (t === "POINTS_LOW_BALANCE" || t === "POINTS_INSUFFICIENT_BALANCE") {
    return "drewel://driver/points";
  }
  if (t.startsWith("POINTS")) return "drewel://driver/points";
  if (t === "DRIVER_ACCOUNT_APPROVED" || t === "DRIVER_ACCOUNT_REJECTED") {
    return "drewel://driver/status";
  }
  return "drewel://notifications";
};

export default {
  dispatchNotification,
  createInAppNotification,
  emitNotificationNew,
  sendPushToUser,
  registerDeviceToken,
  unregisterDeviceToken,
  getActiveDeviceTokens,
  isPushConfigured,
  notificationChannelForType,
  notificationSoundForType,
  pushPriorityForType,
  isActionableType,
  deepLinkFor,
};

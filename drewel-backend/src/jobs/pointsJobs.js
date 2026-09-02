import crypto from "node:crypto";
import Notification from "../models/Notification.js";
import PointsOutboxEvent from "../models/PointsOutboxEvent.js";
import { io } from "../socket/index.js";
import { sendPushToUser } from "../services/notificationService.js";
import { closeTripOffer, expireTripOffers } from "../services/tripOfferService.js";

const workerId = `${process.pid}:${crypto.randomBytes(4).toString("hex")}`;

const safeEventPayload = (payload = {}) => {
  const { notification, ...safe } = payload || {};
  return safe;
};

export const dispatchNextPointsOutboxEvent = async () => {
  const now = new Date();
  const staleLock = new Date(now.getTime() - 5 * 60_000);
  const event = await PointsOutboxEvent.findOneAndUpdate(
    {
      $or: [
        { status: { $in: ["pending", "failed"] }, nextAttemptAt: { $lte: now } },
        { status: "processing", lockedAt: { $lte: staleLock } },
      ],
    },
    {
      $set: { status: "processing", lockedAt: now, lockedBy: workerId },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { createdAt: 1, _id: 1 } }
  ).select("+lastError");
  if (!event) return false;

  try {
    let storedNotification = null;
    if (notification?.message) {
      storedNotification = await Notification.findOneAndUpdate(
        { eventKey: `${event.eventKey}:notification` },
        {
          $setOnInsert: {
            userId: event.recipientId,
            recipientType: event.recipientType.toLowerCase(),
            type: notification.type || "POINTS_UPDATE",
            title: String(notification.title || "Points update").slice(0, 120),
            message: String(notification.message).slice(0, 1000),
            deepLink: String(notification.deepLink || "drewel://driver/points"),
            eventKey: `${event.eventKey}:notification`,
            data: safeEventPayload(event.payload),
            read: false,
            isValid: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    const socketEvent =
      event.type === "points:notification" ? "notification:new" : event.type;
    io.to(String(event.recipientId)).emit(socketEvent, safeEventPayload(event.payload));
    if (storedNotification && socketEvent !== "notification:new") {
      io.to(String(event.recipientId)).emit("notification:new", {
        id: String(storedNotification._id),
        type: storedNotification.type,
        title: storedNotification.title,
        message: storedNotification.message,
        read: Boolean(storedNotification.read),
        data: storedNotification.data || {},
        deepLink: storedNotification.deepLink,
        createdAt: storedNotification.createdAt,
      });
    }
    if (notification?.message) {
      sendPushToUser({
        userId: event.recipientId,
        type: notification.type || "POINTS_UPDATE",
        title: String(notification.title || "Points update").slice(0, 120),
        body: String(notification.message).slice(0, 1000),
        deepLink: String(notification.deepLink || "drewel://driver/points"),
        data: {
          deepLink: String(notification.deepLink || "drewel://driver/points"),
          ...(safeEventPayload(event.payload) || {}),
        },
      }).catch((error) =>
        console.error("Points notification push failed", error.message)
      );
    }
    await PointsOutboxEvent.updateOne(
      { _id: event._id, status: "processing", lockedBy: workerId },
      {
        $set: {
          status: "delivered",
          deliveredAt: new Date(),
          lockedAt: null,
          lockedBy: "",
          lastError: "",
        },
      }
    );
    return true;
  } catch (error) {
    const maxAttempts = Math.max(
      3,
      Number.parseInt(process.env.POINTS_OUTBOX_MAX_ATTEMPTS || "10", 10) || 10
    );
    const permanentlyFailed = event.attempts >= maxAttempts;
    const backoffMs = Math.min(60 * 60_000, 2 ** Math.min(event.attempts, 10) * 1000);
    await PointsOutboxEvent.updateOne(
      { _id: event._id, lockedBy: workerId },
      {
        $set: {
          status: "failed",
          nextAttemptAt: new Date(Date.now() + backoffMs),
          lockedAt: null,
          lockedBy: "",
          lastError: String(error.message || error).slice(0, 2000),
        },
      }
    );
    if (
      permanentlyFailed &&
      event.aggregateType === "trip_offer" &&
      event.payload?.status === "pending"
    ) {
      await closeTripOffer({
        offerId: event.aggregateId,
        actorRole: "system",
        terminalStatus: "delivery_failed",
        reason: "Trip offer delivery failed after retries",
      }).catch((releaseError) =>
        console.error("Failed to release undeliverable trip offer", releaseError.message)
      );
    }
    throw error;
  }
};

export const runPointsOutboxSweep = async ({ limit = 100 } = {}) => {
  let delivered = 0;
  for (let index = 0; index < limit; index += 1) {
    const processed = await dispatchNextPointsOutboxEvent();
    if (!processed) break;
    delivered += 1;
  }
  return delivered;
};

export const runPointsMaintenanceSweep = async () => {
  const [expired, delivered] = await Promise.all([
    expireTripOffers(),
    runPointsOutboxSweep(),
  ]);
  return { expired, delivered };
};

export const startPointsJobs = () => {
  const intervalMs = Math.min(
    60_000,
    Math.max(
      5_000,
      Number.parseInt(process.env.POINTS_JOB_INTERVAL_MS || "10000", 10) || 10_000
    )
  );
  runPointsMaintenanceSweep().catch((error) =>
    console.error("Initial points maintenance sweep failed", error.message)
  );
  const timer = setInterval(() => {
    runPointsMaintenanceSweep().catch((error) =>
      console.error("Points maintenance sweep failed", error.message)
    );
  }, intervalMs);
  timer.unref?.();
  return timer;
};


import crypto from "crypto";
import Driver from "../models/Driver.js";

let presenceEmitter = () => {};

export const configureDriverPresenceEmitter = (emit) => {
  presenceEmitter = typeof emit === "function" ? emit : () => {};
};

const parsePositiveInt = (value, fallback, minimum, maximum = Number.POSITIVE_INFINITY) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum) return fallback;
  return Math.min(parsed, maximum);
};

export const DEFAULT_DRIVER_PRESENCE_TIMEOUT_MS = 600_000;
export const MAX_DRIVER_PRESENCE_TIMEOUT_MS = 1_800_000;

export const getDriverPresenceConfig = () => {
  const heartbeatIntervalMs = parsePositiveInt(
    process.env.DRIVER_PRESENCE_HEARTBEAT_INTERVAL_MS,
    20_000,
    5_000
  );
  const timeoutMs = parsePositiveInt(
    process.env.DRIVER_PRESENCE_TIMEOUT_MS,
    DEFAULT_DRIVER_PRESENCE_TIMEOUT_MS,
    heartbeatIntervalMs * 2,
    Math.max(MAX_DRIVER_PRESENCE_TIMEOUT_MS, heartbeatIntervalMs * 2)
  );
  const sweepIntervalMs = parsePositiveInt(
    process.env.DRIVER_PRESENCE_SWEEP_INTERVAL_MS,
    5_000,
    1_000
  );
  return { heartbeatIntervalMs, timeoutMs, sweepIntervalMs };
};

export const buildActiveDriverPresenceFilter = (now = new Date()) => ({
  presenceStatus: "Online",
  presenceLeaseExpiresAt: { $gt: now },
  isApproved: true,
  isRestricted: false,
  isDeleted: { $ne: true },
  $or: [
    { status: "completed" },
    { status: null, profileRequestStatus: null },
  ],
});

const publicPresence = (driver, { includeSessionId = false } = {}) => {
  const config = getDriverPresenceConfig();
  const presence = {
    status: driver.presenceStatus,
    leaseExpiresAt: driver.presenceLeaseExpiresAt,
    lastHeartbeatAt: driver.presenceLastHeartbeatAt,
    version: driver.presenceVersion,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    timeoutMs: config.timeoutMs,
  };
  if (includeSessionId) presence.sessionId = driver.presenceSessionId;
  return presence;
};

export const toDriverPresenceEvent = (driver, reason) => ({
  driverId: String(driver._id),
  status: driver.presenceStatus,
  isOnline: driver.presenceStatus === "Online",
  leaseExpiresAt: driver.presenceLeaseExpiresAt,
  lastHeartbeatAt: driver.presenceLastHeartbeatAt,
  version: driver.presenceVersion,
  reason,
  updatedAt: driver.updatedAt || new Date(),
});

export const emitDriverPresenceTransition = (driver, reason) => {
  presenceEmitter("driver:presence", toDriverPresenceEvent(driver, reason));
  presenceEmitter("driver:availability", {
    driverId: String(driver._id),
    status: driver.availabilityStatus,
    isAvailable: false,
    updatedAt: driver.updatedAt || new Date(),
  });
};

export const applyForcedOfflinePresence = (driver, now = new Date()) => {
  const wasOnline = driver?.presenceStatus === "Online" || driver?.isOnline === true;
  if (!wasOnline) return false;
  driver.isOnline = false;
  driver.presenceStatus = "Offline";
  driver.presenceSessionId = null;
  driver.presenceLeaseExpiresAt = now;
  driver.presenceLastHeartbeatAt = now;
  driver.availabilityStatus = driver.activeRideId ? "Busy" : "Offline";
  driver.presenceVersion = Number(driver.presenceVersion || 0) + 1;
  return true;
};

export const forceEndDriverPresence = async ({
  driverId,
  reason = "ELIGIBILITY_REVOKED",
  now = new Date(),
}) => {
  const current = await Driver.findOne({
    _id: driverId,
    $or: [{ presenceStatus: "Online" }, { isOnline: true }],
  }).select("_id activeRideId");
  if (!current) return null;
  const driver = await Driver.findOneAndUpdate(
    {
      _id: driverId,
      $or: [{ presenceStatus: "Online" }, { isOnline: true }],
    },
    {
      $set: {
        isOnline: false,
        presenceStatus: "Offline",
        presenceSessionId: null,
        presenceLeaseExpiresAt: now,
        presenceLastHeartbeatAt: now,
        availabilityStatus: current.activeRideId ? "Busy" : "Offline",
      },
      $inc: { presenceVersion: 1 },
    },
    { new: true }
  );
  if (driver) emitDriverPresenceTransition(driver, reason);
  return driver;
};

export const establishDriverPresence = async (driverId, now = new Date()) => {
  const { timeoutMs } = getDriverPresenceConfig();
  const sessionId = crypto.randomUUID();
  const driver = await Driver.findByIdAndUpdate(
    driverId,
    {
      $set: {
        presenceStatus: "Online",
        presenceSessionId: sessionId,
        presenceLastHeartbeatAt: now,
        presenceLeaseExpiresAt: new Date(now.getTime() + timeoutMs),
        presenceDisconnectedAt: null,
        isOnline: true,
      },
      $inc: { presenceVersion: 1 },
    },
    { new: true }
  ).select("+presenceSessionId");
  return { driver, presence: publicPresence(driver, { includeSessionId: true }) };
};

export const heartbeatDriverPresence = async ({ driverId, sessionId, now = new Date() }) => {
  if (!sessionId || typeof sessionId !== "string") return null;
  const { timeoutMs } = getDriverPresenceConfig();
  const driver = await Driver.findOneAndUpdate(
    {
      _id: driverId,
      presenceStatus: "Online",
      presenceSessionId: sessionId,
      presenceLeaseExpiresAt: { $gt: now },
      isApproved: true,
      isRestricted: false,
      isDeleted: { $ne: true },
      $or: [
        { status: "completed" },
        { status: null, profileRequestStatus: null },
      ],
    },
    {
      $set: {
        presenceLastHeartbeatAt: now,
        presenceLeaseExpiresAt: new Date(now.getTime() + timeoutMs),
      },
    },
    { new: true }
  );
  return driver ? { driver, presence: publicPresence(driver) } : null;
};

export const endDriverPresence = async ({ driverId, sessionId, now = new Date() }) => {
  if (sessionId !== undefined && typeof sessionId !== "string") return null;
  const sessionFilter =
    sessionId !== undefined ? { presenceSessionId: sessionId } : {};
  const current = await Driver.findOne({
    _id: driverId,
    presenceStatus: "Online",
    ...sessionFilter,
  }).select("_id activeRideId");
  if (!current) return null;

  const availabilityStatus = current.activeRideId ? "Busy" : "Offline";
  const driver = await Driver.findOneAndUpdate(
    {
      _id: driverId,
      presenceStatus: "Online",
      ...sessionFilter,
    },
    {
      $set: {
        presenceStatus: "Offline",
        presenceLeaseExpiresAt: now,
        presenceLastHeartbeatAt: now,
        presenceSessionId: null,
        isOnline: false,
        availabilityStatus,
      },
      $inc: { presenceVersion: 1 },
    },
    { new: true }
  );
  return driver ? { driver, presence: publicPresence(driver) } : null;
};

export const noteDriverSocketDisconnect = async (driverId, now = new Date()) =>
  Driver.updateOne(
    { _id: driverId, presenceStatus: "Online" },
    { $set: { presenceDisconnectedAt: now } }
  );

export const seedRecentLegacyDriverPresences = async (now = new Date()) => {
  const { timeoutMs } = getDriverPresenceConfig();
  // This one-time compatibility bridge avoids an empty admin dashboard during
  // a coordinated backend/mobile rollout. Only drivers with a fresh GPS write
  // receive one bounded lease; old persisted online flags remain offline.
  return Driver.updateMany(
    {
      isOnline: true,
      presenceStatus: { $ne: "Online" },
      locationUpdatedAt: { $gt: new Date(now.getTime() - timeoutMs) },
    },
    {
      $set: {
        presenceStatus: "Online",
        presenceSessionId: `legacy-bootstrap-${crypto.randomUUID()}`,
        presenceLastHeartbeatAt: now,
        presenceLeaseExpiresAt: new Date(now.getTime() + timeoutMs),
      },
      $inc: { presenceVersion: 1 },
    }
  );
};

export const expireStaleDriverPresences = async ({
  now = new Date(),
  emit = () => {},
} = {}) => {
  const { timeoutMs } = getDriverPresenceConfig();
  const heartbeatCutoff = new Date(now.getTime() - timeoutMs);
  const stale = await Driver.find({
    presenceStatus: "Online",
    $or: [
      { presenceLeaseExpiresAt: { $lte: now } },
      { presenceLastHeartbeatAt: { $lte: heartbeatCutoff } },
      { presenceLastHeartbeatAt: null },
    ],
  }).select("_id +presenceSessionId activeRideId").lean();
  const expired = [];
  for (const candidate of stale) {
    const driver = await Driver.findOneAndUpdate(
      {
        _id: candidate._id,
        presenceStatus: "Online",
        presenceSessionId: candidate.presenceSessionId,
        $or: [
          { presenceLeaseExpiresAt: { $lte: now } },
          { presenceLastHeartbeatAt: { $lte: heartbeatCutoff } },
          { presenceLastHeartbeatAt: null },
        ],
      },
      {
        $set: {
          presenceStatus: "Offline",
          presenceSessionId: null,
          isOnline: false,
          availabilityStatus: candidate.activeRideId ? "Busy" : "Offline",
        },
        $inc: { presenceVersion: 1 },
      },
      { new: true }
    );
    if (driver) {
      expired.push(driver);
      emit(toDriverPresenceEvent(driver, "HEARTBEAT_TIMEOUT"), driver);
    }
  }
  return expired;
};

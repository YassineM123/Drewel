import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const boundedEnvInt = (name, fallback, min = 1, max = 10_000) => {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const principalAndIpKey = (req) => {
  const principal =
    req.user?._id || req.user?.id || req.user?.sub || "anonymous";
  return `${String(principal)}:${ipKeyGenerator(req.ip)}`;
};

export const createPointsRateLimiter = ({
  windowMs,
  limit,
  code,
  message,
  store,
}) =>
  rateLimit({
    windowMs,
    limit,
    ...(store ? { store } : {}),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: principalAndIpKey,
    message: { success: false, code, message },
  });

export const pointsOfferRateLimit = createPointsRateLimiter({
  windowMs: 60_000,
  limit: boundedEnvInt("POINTS_OFFER_RATE_LIMIT_PER_MINUTE", 10, 1, 120),
  code: "POINTS_OFFER_RATE_LIMITED",
  message: "Too many trip offer attempts",
});

export const pointsPurchaseRequestRateLimit = createPointsRateLimiter({
  windowMs: 60 * 60_000,
  limit: boundedEnvInt("POINTS_PURCHASE_REQUEST_RATE_LIMIT_PER_HOUR", 5, 1, 50),
  code: "POINTS_PURCHASE_REQUEST_RATE_LIMITED",
  message: "Too many point purchase requests",
});

export const pointsAdminReadRateLimit = createPointsRateLimiter({
  windowMs: 60_000,
  limit: boundedEnvInt("POINTS_ADMIN_READ_RATE_LIMIT_PER_MINUTE", 120, 10, 600),
  code: "POINTS_ADMIN_READ_RATE_LIMITED",
  message: "Too many points administration requests",
});

export const pointsAdminAdjustmentRateLimit = createPointsRateLimiter({
  windowMs: 15 * 60_000,
  limit: boundedEnvInt(
    "POINTS_ADMIN_ADJUSTMENT_RATE_LIMIT_PER_15_MINUTES",
    20,
    1,
    100
  ),
  code: "POINTS_ADMIN_ADJUSTMENT_RATE_LIMITED",
  message: "Too many point adjustment attempts",
});

export const pointsSettingsMutationRateLimit = createPointsRateLimiter({
  windowMs: 15 * 60_000,
  limit: boundedEnvInt(
    "POINTS_SETTINGS_MUTATION_RATE_LIMIT_PER_15_MINUTES",
    10,
    1,
    50
  ),
  code: "POINTS_SETTINGS_RATE_LIMITED",
  message: "Too many points settings changes",
});

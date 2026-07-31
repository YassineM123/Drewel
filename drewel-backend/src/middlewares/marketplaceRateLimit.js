import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const authenticatedKey = (req) =>
  `${req.user?._id || "anonymous"}:${ipKeyGenerator(req.ip)}`;

export const contactRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: authenticatedKey,
  message: {
    success: false,
    code: "CONTACT_RATE_LIMITED",
    message: "Too many driver contact requests",
  },
});

export const messageRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: authenticatedKey,
  message: {
    success: false,
    code: "MESSAGE_RATE_LIMITED",
    message: "Too many messages",
  },
});

import crypto from "node:crypto";
import mongoose from "mongoose";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const PAYMENT_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{2,99}$/;
const FORBIDDEN_BALANCE_FIELDS = new Set([
  "balance",
  "availablepoints",
  "reservedpoints",
  "totalpoints",
  "availablebonuspoints",
  "availablepurchasedpoints",
  "reservedbonuspoints",
  "reservedpurchasedpoints",
  "newbalance",
]);
const FORBIDDEN_METADATA_FIELDS = new Set([
  "password",
  "otp",
  "otpcode",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "secret",
  "cardnumber",
  "cvv",
  "bankaccount",
]);

const normalizedFieldName = (value) =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export class PointsValidationError extends Error {
  constructor(message, { code = "POINTS_VALIDATION_ERROR", status = 400 } = {}) {
    super(message);
    this.name = "PointsValidationError";
    this.code = code;
    this.status = status;
  }
}

export const requireObjectId = (value, fieldName = "id") => {
  const normalized = String(value ?? "").trim();
  if (!mongoose.isValidObjectId(normalized)) {
    throw new PointsValidationError(`${fieldName} is invalid`);
  }
  return normalized;
};

export const requirePositiveInteger = (
  value,
  fieldName = "points",
  { max = 1_000_000 } = {}
) => {
  const parsed =
    typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new PointsValidationError(
      `${fieldName} must be a positive integer not greater than ${max}`
    );
  }
  return parsed;
};

export const optionalMoneyAmount = (
  value,
  fieldName = "paymentAmount",
  { max = 1_000_000_000 } = {}
) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed =
    typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
    throw new PointsValidationError(`${fieldName} is invalid`);
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

export const requireBoundedString = (
  value,
  fieldName,
  { min = 1, max = 500, pattern } = {}
) => {
  const normalized = String(value ?? "").trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    (pattern && !pattern.test(normalized))
  ) {
    throw new PointsValidationError(`${fieldName} is invalid`);
  }
  return normalized;
};

export const optionalEnum = (value, allowed, fieldName) => {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!new Set(allowed).has(normalized)) {
    throw new PointsValidationError(`${fieldName} is invalid`);
  }
  return normalized;
};

export const requirePaymentReference = (value) =>
  requireBoundedString(value, "paymentReference", {
    min: 3,
    max: 100,
    pattern: PAYMENT_REFERENCE_PATTERN,
  });

export const requireExplicitConfirmation = (value) => {
  if (value !== true) {
    throw new PointsValidationError(
      "Explicit confirmation is required",
      { code: "POINTS_CONFIRMATION_REQUIRED" }
    );
  }
  return true;
};

export const requireIdempotencyKey = (reqOrValue) => {
  const raw =
    typeof reqOrValue === "string"
      ? reqOrValue
      : reqOrValue?.get?.("Idempotency-Key") ||
        reqOrValue?.headers?.["idempotency-key"];
  const key = String(raw ?? "").trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new PointsValidationError(
      "A valid Idempotency-Key header is required",
      { code: "IDEMPOTENCY_KEY_REQUIRED" }
    );
  }
  return key;
};

const canonicalize = (value, seen = new WeakSet()) => {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new PointsValidationError("Payload contains an invalid number");
    }
    return value;
  }
  if (seen.has(value)) {
    throw new PointsValidationError("Payload contains a circular reference");
  }
  seen.add(value);
  const result = Array.isArray(value)
    ? value.map((entry) => canonicalize(entry, seen))
    : Object.keys(value)
        .sort()
        .reduce((object, key) => {
          if (key === "__proto__" || key === "constructor" || key === "prototype") {
            throw new PointsValidationError("Payload contains a forbidden key");
          }
          object[key] = canonicalize(value[key], seen);
          return object;
        }, {});
  seen.delete(value);
  return result;
};

export const hashIdempotencyPayload = (payload) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");

export const assertIdempotencyPayloadMatches = (expectedHash, payload) => {
  const actualHash = hashIdempotencyPayload(payload);
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  const actual = Buffer.from(actualHash, "hex");
  if (
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(expected, actual)
  ) {
    throw new PointsValidationError(
      "Idempotency key was already used with a different payload",
      { code: "IDEMPOTENCY_KEY_REUSED", status: 409 }
    );
  }
  return actualHash;
};

export const assertNoDirectBalanceMutation = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new PointsValidationError("Request body must be an object");
  }
  let forbidden;
  const inspect = (value) => {
    if (forbidden || !value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_BALANCE_FIELDS.has(normalizedFieldName(key))) {
        forbidden = key;
        return;
      }
      inspect(entry);
    }
  };
  inspect(payload);
  if (forbidden) {
    throw new PointsValidationError(
      `${forbidden} cannot be supplied by the client`,
      { code: "DIRECT_BALANCE_MUTATION_FORBIDDEN" }
    );
  }
  return payload;
};

export const sanitizePointsMetadata = (metadata, { maxBytes = 4_096 } = {}) => {
  if (metadata === undefined || metadata === null) return {};
  if (
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    Object.getPrototypeOf(metadata) !== Object.prototype
  ) {
    throw new PointsValidationError("metadata must be a plain object");
  }
  const sanitized = canonicalize(metadata);
  const inspect = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_METADATA_FIELDS.has(normalizedFieldName(key))) {
        throw new PointsValidationError(
          `metadata.${key} contains sensitive data`
        );
      }
      inspect(entry);
    }
  };
  inspect(sanitized);
  const encoded = JSON.stringify(sanitized);
  if (Buffer.byteLength(encoded, "utf8") > maxBytes) {
    throw new PointsValidationError("metadata is too large");
  }
  return sanitized;
};

export const pointsValidationErrorResponse = (error, res) => {
  if (!(error instanceof PointsValidationError)) return false;
  res.status(error.status).json({
    success: false,
    code: error.code,
    message: error.message,
  });
  return true;
};

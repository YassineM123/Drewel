const SENSITIVE_KEYS = new Set([
  "password",
  "otp",
  "otpcode",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "secret",
  "paymentamount",
  "paymentmethod",
  "paymentreference",
  "idempotencykey",
  "bankaccount",
  "cardnumber",
  "cvv",
]);

export const maskEmail = (value) => {
  const email = String(value || "").trim();
  const separator = email.indexOf("@");
  if (separator <= 0) return "***";
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  return `${local.slice(0, 1)}${"*".repeat(Math.min(5, Math.max(2, local.length - 1)))}@${domain}`;
};

export const maskPhone = (value) => {
  const phone = String(value || "").trim();
  if (!phone) return "";
  const visible = phone.replace(/\D/g, "").slice(-4);
  return visible ? `***${visible}` : "***";
};

export const maskPaymentReference = (value) => {
  const reference = String(value || "").trim();
  if (!reference) return "";
  if (reference.length <= 4) return "****";
  return `${"*".repeat(Math.min(8, reference.length - 4))}${reference.slice(-4)}`;
};

const maskedForKey = (key, value) => {
  const normalized = String(key).toLowerCase();
  if (normalized === "email") return maskEmail(value);
  if (
    normalized === "phone" ||
    normalized === "phonenumber" ||
    normalized === "contactphone"
  ) {
    return maskPhone(value);
  }
  if (normalized === "paymentreference") return maskPaymentReference(value);
  return "[REDACTED]";
};

export const maskPointsSensitiveData = (value, seen = new WeakSet()) => {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  const masked = Array.isArray(value)
    ? value.map((entry) => maskPointsSensitiveData(entry, seen))
    : Object.entries(value).reduce((result, [key, entry]) => {
        const normalized = key.toLowerCase();
        if (
          SENSITIVE_KEYS.has(normalized) ||
          normalized === "email" ||
          normalized === "phone" ||
          normalized === "phonenumber" ||
          normalized === "contactphone"
        ) {
          result[key] = maskedForKey(key, entry);
        } else {
          result[key] = maskPointsSensitiveData(entry, seen);
        }
        return result;
      }, {});

  seen.delete(value);
  return masked;
};

export const toSafePointsAuditDetails = (details) =>
  maskPointsSensitiveData(details && typeof details === "object" ? details : {});

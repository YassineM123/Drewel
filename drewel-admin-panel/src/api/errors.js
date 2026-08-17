import { redirectToLogin } from "../utils/session";

/**
 * Consistent API error surfaced to every page. The axios error is preserved on
 * `.originalError` so callers that still depend on `error.response.status` or
 * `error.response.data.message` keep working during the migration.
 */
export class ApiError extends Error {
  constructor(message, { code, status, data, originalError } = {}) {
    super(message || "Request failed");
    this.name = "ApiError";
    this.code = code || "API_ERROR";
    this.status = status || 0;
    this.data = data ?? null;
    this.originalError = originalError ?? null;
  }

  /** HTTP 4xx/5xx status when the server answered, otherwise 0. */
  get isHttpError() {
    return this.status >= 400;
  }

  get isAuthFailure() {
    return (
      this.status === 401 ||
      [
        "AUTH_REQUIRED",
        "INVALID_TOKEN",
        "TOKEN_EXPIRED",
        "ADMIN_AUTH_REQUIRED",
      ].includes(this.code)
    );
  }

  get isNetworkError() {
    return !this.originalError?.response && !this.originalError?.request && !this.originalError?.code;
  }

  get isCancelled() {
    return this.originalError?.code === "ERR_CANCELED" || this.originalError?.name === "AbortError";
  }
}

/** Returns true for axios cancellation errors and AbortError instances. */
export const isCancelledError = (error) =>
  Boolean(error) &&
  (error?.name === "AbortError" ||
    error?.code === "ERR_CANCELED" ||
    error?.originalError?.code === "ERR_CANCELED" ||
    error?.originalError?.name === "AbortError");

const AUTH_CODES = new Set([
  "AUTH_REQUIRED",
  "INVALID_TOKEN",
  "TOKEN_EXPIRED",
  "ADMIN_AUTH_REQUIRED",
]);

/** Normalizes an arbitrary thrown value into an ApiError. */
export const toApiError = (error, fallback = "Request failed") => {
  if (error instanceof ApiError) return error;

  const status = error?.response?.status || 0;
  const payload = error?.response?.data;
  const code = String(payload?.code || error?.code || "").toUpperCase();
  const message =
    (typeof payload?.message === "string" && payload.message.trim()) ||
    (typeof error?.message === "string" && error.message.trim()) ||
    fallback;

  return new ApiError(message, {
    code: code || "API_ERROR",
    status,
    data: payload ?? null,
    originalError: error,
  });
};

/** Best-effort human-readable message from any error shape. */
export const apiErrorMessage = (error, fallback = "Request failed") => {
  if (error instanceof ApiError) return error.message;
  return (
    error?.response?.data?.message ||
    error?.message ||
    (typeof error === "string" ? error : "") ||
    fallback
  );
};

/** True when the response failed authentication (401 or an auth code). */
export const isAuthFailure = (error) => {
  if (error instanceof ApiError) return error.isAuthFailure;
  return error?.response?.status === 401 || AUTH_CODES.has(String(error?.response?.data?.code || "").toUpperCase());
};

/**
 * Shared 401 handler. Kept here so the client, socket and pages all use the
 * same session-expiration path.
 */
export const handleAuthFailure = () => {
  redirectToLogin();
  return true;
};

import { redirectToLogin } from "../lib/session";

export class ApiError extends Error {
  code: string;
  status: number;
  data: unknown;
  originalError: unknown;

  constructor(message: string, opts?: { code?: string; status?: number; data?: unknown; originalError?: unknown }) {
    super(message || "Request failed");
    this.name = "ApiError";
    this.code = opts?.code || "API_ERROR";
    this.status = opts?.status || 0;
    this.data = opts?.data ?? null;
    this.originalError = opts?.originalError ?? null;
  }

  get isHttpError() {
    return this.status >= 400;
  }

  get isAuthFailure() {
    return (
      this.status === 401 ||
      ["AUTH_REQUIRED", "INVALID_TOKEN", "TOKEN_EXPIRED", "ADMIN_AUTH_REQUIRED"].includes(this.code)
    );
  }

  get isNetworkError() {
    const orig = this.originalError as { response?: unknown; request?: unknown; code?: unknown } | null;
    return !orig?.response && !orig?.request && !orig?.code;
  }

  get isCancelled() {
    const orig = this.originalError as { code?: string; name?: string } | null;
    return orig?.code === "ERR_CANCELED" || orig?.name === "AbortError";
  }
}

export const isCancelledError = (error: unknown): boolean => {
  if (!error) return false;
  const e = error as Record<string, unknown>;
  const orig = e.originalError as Record<string, unknown> | undefined;
  return (
    e.name === "AbortError" ||
    e.code === "ERR_CANCELED" ||
    orig?.code === "ERR_CANCELED" ||
    orig?.name === "AbortError"
  );
};

const AUTH_CODES = new Set(["AUTH_REQUIRED", "INVALID_TOKEN", "TOKEN_EXPIRED", "ADMIN_AUTH_REQUIRED"]);

export const toApiError = (error: unknown, fallback = "Request failed"): ApiError => {
  if (error instanceof ApiError) return error;

  const e = error as Record<string, unknown>;
  const resp = e?.response as Record<string, unknown> | undefined;
  const status = (resp?.status as number) || 0;
  const payload = resp?.data as Record<string, unknown> | undefined;
  const code = String(payload?.code || e?.code || "").toUpperCase();
  const message =
    (typeof payload?.message === "string" && (payload.message as string).trim()) ||
    (typeof e?.message === "string" && (e.message as string).trim()) ||
    fallback;

  return new ApiError(message, {
    code: code || "API_ERROR",
    status,
    data: payload ?? null,
    originalError: error,
  });
};

export const apiErrorMessage = (error: unknown, fallback = "Request failed"): string => {
  if (error instanceof ApiError) return error.message;
  const e = error as Record<string, unknown>;
  const resp = e?.response as Record<string, unknown> | undefined;
  const payload = resp?.data as Record<string, unknown> | undefined;
  return (
    (payload?.message as string) ||
    (e?.message as string) ||
    (typeof error === "string" ? error : "") ||
    fallback
  );
};

export const isAuthFailure = (error: unknown): boolean => {
  if (error instanceof ApiError) return error.isAuthFailure;
  const e = error as Record<string, unknown>;
  const resp = e?.response as Record<string, unknown> | undefined;
  const payload = resp?.data as Record<string, unknown> | undefined;
  return resp?.status === 401 || AUTH_CODES.has(String(payload?.code || "").toUpperCase());
};

export const handleAuthFailure = () => {
  redirectToLogin();
  return true;
};

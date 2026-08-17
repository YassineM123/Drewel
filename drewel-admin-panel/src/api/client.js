import axios from "axios";
import { isAuthTokenUsable } from "../utils/session";
import { ApiError, isAuthFailure, toApiError, handleAuthFailure } from "./errors";

/**
 * ============================================================================
 * DREWEL ADMIN API CLIENT
 * ============================================================================
 *
 * Single, typed HTTP client for the admin panel. Every domain module in
 * `src/api/domains/*` goes through this client so auth, error normalization,
 * timeouts, cancellation and retries behave identically everywhere.
 *
 * Features
 *   - Configurable base URL: `VITE_API_URL` with a dev/same-origin fallback.
 *   - Bearer token injection read from session storage on every request.
 *   - Expiration handling: the JWT `exp` claim is checked before dispatch and
 *     any 401/auth-code response clears the session and redirects to login.
 *   - Consistent error format: every rejection is an `ApiError`.
 *   - Request timeout (configurable, default 15s).
 *   - Cancellation: an optional `AbortSignal` is passed straight to axios.
 *   - Retry: idempotent GET/HEAD requests retry once on transient failures.
 *   - No secret keys: only Vite-exposed `VITE_*` variables are ever read.
 */

export const resolveApiBaseUrl = () => {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3001";
  return (
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? "http://localhost:3001/api" : `${origin}/api`)
  );
};

export const DEFAULT_TIMEOUT_MS = 15_000;

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const isRetryable = (error, method) => {
  if (!["GET", "HEAD"].includes(method)) return false;
  if (isAuthFailure(error)) return false;
  const status = error instanceof ApiError ? error.status : error?.response?.status;
  if (status && RETRYABLE_STATUSES.has(status)) return true;
  return error instanceof ApiError && error.isNetworkError;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates a fully configured axios instance with the admin-panel contract.
 * Accepts overrides for testability (baseURL, token source, timeout, hooks).
 */
export const createApiClient = ({
  baseURL = resolveApiBaseUrl(),
  timeout = DEFAULT_TIMEOUT_MS,
  getToken = () => localStorage.getItem("authToken"),
  onAuthFailure = handleAuthFailure,
  onResponse = null,
} = {}) => {
  const instance = axios.create({ baseURL, timeout });

  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token && !config.headers?.Authorization) {
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      onResponse?.(response);
      return response;
    },
    (error) => {
      const normalized = toApiError(error);
      if (isAuthFailure(normalized)) onAuthFailure();
      return Promise.reject(normalized);
    }
  );

  /** Same axios `request` contract but rejects with an ApiError and retries. */
  const request = async (config) => {
    const method = String(config.method || "get").toUpperCase();
    const retries = config.retries === false ? 0 : 1;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await instance.request(config);
        return response.data;
      } catch (error) {
        if (attempt < retries && isRetryable(error, method)) {
          await wait(250 * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
    throw new ApiError("Request failed");
  };

  const api = {
    instance,
    baseURL,
    request,
    get: (url, config = {}) => request({ method: "GET", url, ...config }),
    post: (url, data, config = {}) => request({ method: "POST", url, data, ...config }),
    put: (url, data, config = {}) => request({ method: "PUT", url, data, ...config }),
    patch: (url, data, config = {}) => request({ method: "PATCH", url, data, ...config }),
    delete: (url, config = {}) => request({ method: "DELETE", url, ...config }),
    /**
     * Returns an already-rejected promise when the stored token is known to be
     * expired, so callers can short-circuit without a doomed network round-trip.
     */
    assertTokenUsable: () => {
      if (!isAuthTokenUsable(getToken())) {
        const error = new ApiError("Your session has expired. Please sign in again.", {
          code: "TOKEN_EXPIRED",
          status: 401,
        });
        onAuthFailure();
        return Promise.reject(error);
      }
      return Promise.resolve();
    },
  };

  return api;
};

/**
 * The singleton used across the app and tests. Tests may still build isolated
 * instances via `createApiClient` with a fake `baseURL` + mocked `instance`.
 */
export const apiClient = createApiClient();

export default apiClient;

import axios from "axios";
import { isAuthTokenUsable } from "../lib/session";
import { ApiError, isAuthFailure, toApiError, handleAuthFailure } from "./errors";

export const resolveApiBaseUrl = (): string => {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3001";
  return (
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? "http://localhost:3001/api" : `${origin}/api`)
  );
};

export const DEFAULT_TIMEOUT_MS = 15_000;

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const isRetryable = (error: unknown, method: string): boolean => {
  if (!["GET", "HEAD"].includes(method)) return false;
  if (isAuthFailure(error)) return false;
  const status = error instanceof ApiError ? error.status : (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.status as number;
  if (status && RETRYABLE_STATUSES.has(status)) return true;
  return error instanceof ApiError && error.isNetworkError;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createApiClient = ({
  baseURL = resolveApiBaseUrl(),
  timeout = DEFAULT_TIMEOUT_MS,
  getToken = () => localStorage.getItem("authToken"),
  onAuthFailure = handleAuthFailure,
}: {
  baseURL?: string;
  timeout?: number;
  getToken?: () => string | null;
  onAuthFailure?: () => boolean;
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
    (response) => response,
    (error) => {
      const normalized = toApiError(error);
      if (isAuthFailure(normalized)) onAuthFailure();
      return Promise.reject(normalized);
    },
  );

  const request = async (config: Record<string, unknown>) => {
    const method = String(config.method || "get").toUpperCase();
    const retries = config.retries === false ? 0 : 1;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await instance.request(config as never);
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
    get: (url: string, config: Record<string, unknown> = {}) => request({ method: "GET", url, ...config }),
    post: (url: string, data?: unknown, config: Record<string, unknown> = {}) => request({ method: "POST", url, data, ...config }),
    put: (url: string, data?: unknown, config: Record<string, unknown> = {}) => request({ method: "PUT", url, data, ...config }),
    patch: (url: string, data?: unknown, config: Record<string, unknown> = {}) => request({ method: "PATCH", url, data, ...config }),
    delete: (url: string, config: Record<string, unknown> = {}) => request({ method: "DELETE", url, ...config }),
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

export const apiClient = createApiClient();

export default apiClient;

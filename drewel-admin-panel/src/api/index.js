/**
 * ============================================================================
 * DREWEL ADMIN TYPED API LAYER
 * ============================================================================
 *
 * The single entry point for all backend access in the admin panel. Pages and
 * components import from `../api`, never from low-level axios calls.
 *
 *   import { getDrivers, getUsers } from "../api";
 *
 * Capabilities (see client.js / errors.js / query.js):
 *   - Configurable base URL via VITE_API_URL.
 *   - Bearer token injection + session-expiration redirect.
 *   - Consistent ApiError format with code/status/message/data.
 *   - Request timeout, AbortSignal cancellation and idempotent-GET retry.
 *   - Shared pagination + filter serialization helpers.
 *   - No client secrets — only VITE_* variables are read.
 */

export * from "./errors";
export { default as apiClient, createApiClient, resolveApiBaseUrl, DEFAULT_TIMEOUT_MS } from "./client";
export * from "./query";

export * from "./domains/dashboard";
export * from "./domains/drivers";
export * from "./domains/users";
export * from "./domains/requests";
export * from "./domains/rides";
export * from "./domains/points";
export * from "./domains/pointRequests";
export * from "./domains/pointTransactions";
export * from "./domains/alerts";
export * from "./domains/auditLogs";
export * from "./domains/chat";
export * from "./domains/secureCalls";
export * from "./domains/banners";
export * from "./domains/settings";
export * from "./domains/health";
export * from "./domains/roles";
export * from "./domains/notifications";
export * from "./domains/operational";
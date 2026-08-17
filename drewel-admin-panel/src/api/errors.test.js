import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, toApiError, isAuthFailure, apiErrorMessage, isCancelledError } from "./errors";

describe("errors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("normalizes an axios response error into an ApiError", () => {
    const error = toApiError({
      response: { status: 400, data: { code: "BAD_REQUEST", message: "Invalid input" } },
    });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("Invalid input");
    expect(error.isHttpError).toBe(true);
    expect(error.isAuthFailure).toBe(false);
  });

  it("treats 401 and auth codes as auth failures so sessions redirect", () => {
    expect(isAuthFailure(toApiError({ response: { status: 401, data: {} } }))).toBe(true);
    expect(isAuthFailure(toApiError({ response: { status: 403, data: { code: "AUTH_REQUIRED" } } }))).toBe(true);
    expect(isAuthFailure(toApiError({ response: { status: 500, data: {} } }))).toBe(false);
  });

  it("flags cancelled and network failures distinctly", () => {
    const cancelled = toApiError({ code: "ERR_CANCELED" });
    const network = toApiError(new TypeError("Network Error"));
    expect(isCancelledError(cancelled)).toBe(true);
    expect(cancelled.isCancelled).toBe(true);
    expect(network.isNetworkError).toBe(true);
    expect(network.isCancelled).toBe(false);
  });

  it("falls back to a readable message for arbitrary throws", () => {
    expect(apiErrorMessage(new Error("boom"))).toBe("boom");
    expect(apiErrorMessage(undefined, "fallback")).toBe("fallback");
  });
});
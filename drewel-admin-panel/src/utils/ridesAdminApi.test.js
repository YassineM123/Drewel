import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./api";
import {
  cancelAdminRide,
  listAdminRides,
  resolveRideDispute,
} from "./ridesAdminApi";

vi.mock("./api", () => ({
  API_URL: "http://test/api",
  apiClient: { request: vi.fn() },
}));

describe("Admin ride API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.request.mockResolvedValue({ data: { success: true } });
  });

  it("uses bounded server-side list filters", async () => {
    await listAdminRides({ status: "active", search: "", page: 2, limit: 20 });
    expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      url: "http://test/api/admin/rides",
      params: { status: "active", page: 2, limit: 20 },
    }));
  });

  it("sends idempotency in both the header and action body", async () => {
    await cancelAdminRide("ride/unsafe", { reason: "Technical problem" }, "cancel-key");
    expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      url: "http://test/api/admin/rides/ride%2Funsafe/cancel",
      headers: { "Idempotency-Key": "cancel-key" },
      data: { reason: "Technical problem", idempotencyKey: "cancel-key" },
    }));
  });

  it("uses the controlled dispute resolution endpoint", async () => {
    await resolveRideDispute("ride-1", { resolution: "Resolved" }, "resolve-key");
    expect(apiClient.request.mock.calls[0][0].url).toBe(
      "http://test/api/admin/rides/ride-1/dispute/resolve",
    );
  });
});

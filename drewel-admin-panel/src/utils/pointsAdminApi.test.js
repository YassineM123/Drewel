import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./api";
import {
  adjustDriverPoints,
  creditPurchaseRequest,
  getDriverWallets,
  updatePointSettings,
} from "./pointsAdminApi";

vi.mock("./api", () => ({
  API_URL: "http://test/api",
  apiClient: { request: vi.fn() },
}));

describe("Driver Points API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.request.mockResolvedValue({ data: { success: true } });
  });

  it("passes filters and pagination to the wallet API", async () => {
    await getDriverWallets({ search: "D-42", page: 3, limit: 10 });
    expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      params: { search: "D-42", page: 3, limit: 10 },
    }));
  });

  it("never sends a client-computed newBalance", async () => {
    await adjustDriverPoints("credit", { driverId: "driver", points: 50, reason: "Correction", source: "admin", newBalance: 9999 }, "stable-key");
    const request = apiClient.request.mock.calls[0][0];
    expect(request.data).not.toHaveProperty("newBalance");
    expect(request.headers["Idempotency-Key"]).toBe("stable-key");
    expect(request.data.confirmation).toBe(true);
  });

  it("uses the secure idempotent purchase credit endpoint", async () => {
    await creditPurchaseRequest("request-1", { reason: "Payment verified" }, "purchase-key");
    expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      url: "http://test/api/admin/points/purchase-requests/request-1/credit",
      headers: { "Idempotency-Key": "purchase-key" },
    }));
  });

  it("requires explicit confirmation on settings updates", async () => {
    await updatePointSettings({ welcomeDriverPoints: 100, reason: "Policy update" });
    expect(apiClient.request.mock.calls[0][0].data.confirmation).toBe(true);
  });
});

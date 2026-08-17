import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "./client";
import { getAlerts } from "./domains/alerts";
import { getAuditLogs } from "./domains/auditLogs";
import { getChatThreads } from "./domains/chat";
import { getSecureCalls } from "./domains/secureCalls";
import { getRolesCatalog } from "./domains/roles";
import { getSystemHealth } from "./domains/health";
import { sendAdminNotification } from "./domains/notifications";

vi.mock("./client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("admin meta domain contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests the alerts feed with pagination", async () => {
    apiClient.get.mockResolvedValue({ success: true, alerts: [], summary: {} });
    await getAlerts({ page: 1, limit: 20 });
    expect(apiClient.get).toHaveBeenCalledWith(
      "/admin/alerts",
      expect.objectContaining({ params: { page: 1, limit: 20 } })
    );
  });

  it("requests the cross-domain audit log feed", async () => {
    apiClient.get.mockResolvedValue({ success: true, items: [], pagination: {} });
    await getAuditLogs({ page: 2, limit: 25, types: ["ride", "points"] });
    expect(apiClient.get).toHaveBeenCalledWith(
      "/admin/audit-logs",
      expect.objectContaining({ params: { page: 2, limit: 25, types: "ride,points" } })
    );
  });

  it("requests chat threads with a status filter", async () => {
    apiClient.get.mockResolvedValue({ success: true, threads: [], pagination: {} });
    await getChatThreads({ status: "active" });
    expect(apiClient.get).toHaveBeenCalledWith(
      "/admin/chat/threads",
      expect.objectContaining({ params: { status: "active" } })
    );
  });

  it("requests the secure-call audit feed", async () => {
    apiClient.get.mockResolvedValue({ success: true, items: [], pagination: {} });
    await getSecureCalls({ page: 1 });
    expect(apiClient.get).toHaveBeenCalledWith(
      "/admin/secure-calls",
      expect.objectContaining({ params: { page: 1 } })
    );
  });

  it("requests the roles catalog and team", async () => {
    apiClient.get.mockResolvedValue({ success: true, roles: [], permissions: {}, current: null, team: [] });
    await getRolesCatalog();
    expect(apiClient.get).toHaveBeenCalledWith(
      "/admin/roles",
      expect.objectContaining({})
    );
  });

  it("requests system health", async () => {
    apiClient.get.mockResolvedValue({ success: true, health: { api: "operational" } });
    await getSystemHealth();
    expect(apiClient.get).toHaveBeenCalledWith("/admin/health", expect.any(Object));
  });

  it("posts a broadcast notification payload", async () => {
    apiClient.post.mockResolvedValue({ success: true, queued: 5 });
    await sendAdminNotification({ recipients: "both", title: "System", message: "Maintenance tonight" });
    expect(apiClient.post).toHaveBeenCalledWith(
      "/admin/notifications/send",
      { recipients: "both", title: "System", message: "Maintenance tonight" },
      expect.any(Object)
    );
  });
});
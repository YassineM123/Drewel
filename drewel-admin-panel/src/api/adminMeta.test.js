import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "./client";
import { getAlerts } from "./domains/alerts";
import { getAuditLogs } from "./domains/auditLogs";
import {
  getChatThreads,
  getConversationMessageAudioBlob,
  normalizeConversationAudioUrl,
} from "./domains/chat";
import { getRolesCatalog } from "./domains/roles";
import { getSystemHealth } from "./domains/health";
import { sendAdminNotification } from "./domains/notifications";
import { getAdminSettings } from "./domains/settings";

vi.mock("./client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    instance: {
      get: vi.fn(),
    },
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

  it("normalizes voice-audio paths through the configured admin API base", async () => {
    expect(normalizeConversationAudioUrl("/api/rides/ride-1/messages/msg-1/audio"))
      .toBe("/rides/ride-1/messages/msg-1/audio");
    expect(normalizeConversationAudioUrl("/rides/ride-1/messages/msg-1/audio"))
      .toBe("/rides/ride-1/messages/msg-1/audio");
    expect(normalizeConversationAudioUrl("https://cdn.example.com/audio.m4a"))
      .toBe("https://cdn.example.com/audio.m4a");

    apiClient.instance.get.mockResolvedValue({
      data: new Blob(["voice"], { type: "audio/mp4" }),
      headers: { "content-type": "audio/mp4" },
    });
    await getConversationMessageAudioBlob("/api/rides/ride-1/messages/msg-1/audio");
    expect(apiClient.instance.get).toHaveBeenCalledWith(
      "/rides/ride-1/messages/msg-1/audio",
      expect.objectContaining({ responseType: "blob" })
    );
  });

  it("requests the roles catalog and team", async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      roles: ["owner", "admin"],
      permissions: ["rides_read", "rides_manage"],
      current: null,
      team: [],
    });
    const result = await getRolesCatalog();
    expect(apiClient.get).toHaveBeenCalledWith(
      "/admin/roles",
      expect.objectContaining({})
    );
    expect(result.permissions).toEqual({});
    expect(result.permissionNames).toEqual(["rides_read", "rides_manage"]);
  });

  it("requests system health", async () => {
    apiClient.get.mockResolvedValue({ success: true, health: { api: "operational" } });
    await getSystemHealth();
    expect(apiClient.get).toHaveBeenCalledWith("/admin/health", expect.any(Object));
  });

  it("requests the admin settings snapshot", async () => {
    apiClient.get.mockResolvedValue({ success: true, settings: { pointsPerAED: 10 } });
    const result = await getAdminSettings();
    expect(result).toEqual({ pointsPerAED: 10 });
    expect(apiClient.get).toHaveBeenCalledWith("/admin/settings", expect.any(Object));
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

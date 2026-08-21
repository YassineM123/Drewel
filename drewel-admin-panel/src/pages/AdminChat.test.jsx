import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addConversationNote,
  getChatMetadata,
  getChatThreads,
  getConversationMessages,
} from "../api/domains/chat";
import AdminChat from "./AdminChat";

vi.mock("../api/domains/chat", () => ({
  getChatMetadata: vi.fn(),
  getChatThreads: vi.fn(),
  getConversationMessages: vi.fn(),
  addConversationNote: vi.fn(),
  chatErrorMessage: (error, fallback) => error?.message || fallback,
}));

const thread = {
  id: "thread-1",
  rideId: "ride-1",
  rideReference: "RIDE-001",
  status: "active",
  passenger: { id: "p1", fullName: "Amira K" },
  driver: { id: "d1", fullName: "Tariq A", vehicleType: "Sedan", vehicleModel: "Camry" },
  passengerUnreadCount: 1,
  driverUnreadCount: 0,
  lastMessageAt: "2026-08-15T10:00:00.000Z",
  lastMessagePreview: "I am outside",
  lastMessageSenderRole: "driver",
  reportedCount: 2,
  adminNote: "",
};

describe("Chat admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getChatMetadata.mockResolvedValue({
      metadata: {
        totalConversations: 12,
        activeConversations: 3,
        totalMessages: 250,
        unreadMessages: 4,
        messagesToday: 18,
      },
    });
    getChatThreads.mockResolvedValue({
      threads: [thread],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
    getConversationMessages.mockResolvedValue({
      conversation: { ...thread, adminNote: "" },
      messages: [{
        id: "msg-1",
        senderRole: "driver",
        text: "I am outside",
        messageType: "text",
        status: "read",
        createdAt: "2026-08-15T10:00:00.000Z",
      }],
      supports: [{
        id: "support-1",
        actorRole: "driver",
        category: "harassment",
        description: "Reported content",
        status: "open",
        createdAt: "2026-08-15T09:00:00.000Z",
      }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    addConversationNote.mockResolvedValue({
      conversation: { id: "thread-1", adminNote: "Contacted both sides", updatedAt: "2026-08-15T11:00:00.000Z" },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders conversation KPIs, thread metadata and reported flags from the backend", async () => {
    render(<MemoryRouter><AdminChat /></MemoryRouter>);

    expect(await screen.findByText("RIDE-001")).toBeInTheDocument();
    expect(screen.getByText("Amira K")).toBeInTheDocument();
    expect(screen.getByText("Tariq A")).toBeInTheDocument();
    expect(screen.getByText("I am outside")).toBeInTheDocument();
    expect(screen.getAllByText("Reported").length).toBeGreaterThanOrEqual(1);
    expect(getChatThreads).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 25 }));
  });

  it("passes server-side filters for search, unread and reported", async () => {
    render(<MemoryRouter><AdminChat /></MemoryRouter>);
    await screen.findByText("RIDE-001");

    await userEvent.selectOptions(screen.getByRole("combobox"), "active");
    await waitFor(() => {
      expect(getChatThreads).toHaveBeenLastCalledWith(expect.objectContaining({ status: "active" }));
    });

    await userEvent.click(screen.getByLabelText("Reported only"));
    await waitFor(() => {
      expect(getChatThreads).toHaveBeenLastCalledWith(expect.objectContaining({ reported: "true" }));
    });

    await userEvent.click(screen.getByLabelText("Unread only"));
    await waitFor(() => {
      expect(getChatThreads).toHaveBeenLastCalledWith(expect.objectContaining({ unread: "true" }));
    });
  });

  it("inspects messages and support reports and saves an audited note", async () => {
    render(<MemoryRouter><AdminChat /></MemoryRouter>);
    await screen.findByText("RIDE-001");

    await userEvent.click(screen.getByRole("button", { name: /Inspect/ }));
    expect(await screen.findByText("Reported content")).toBeInTheDocument();
    expect(screen.getAllByText(/Driver/).length).toBeGreaterThanOrEqual(1);
    expect(getConversationMessages).toHaveBeenCalledWith("thread-1", expect.objectContaining({ page: 1, limit: 100 }));

    await userEvent.type(screen.getByPlaceholderText(/Add an internal note/), "Contacted both sides");
    await userEvent.click(screen.getByRole("button", { name: /Save/i }));
    await waitFor(() => {
      expect(addConversationNote).toHaveBeenCalledWith("thread-1", "Contacted both sides");
    });
  });

  it("labels voice notes with their duration instead of rendering empty text", async () => {
    getConversationMessages.mockResolvedValue({
      conversation: { ...thread, adminNote: "" },
      messages: [
        {
          id: "msg-voice",
          senderRole: "passenger",
          text: "",
          messageType: "voice",
          audioDuration: 7.5,
          status: "delivered",
          createdAt: "2026-08-15T10:01:00.000Z",
        },
        {
          id: "msg-text",
          senderRole: "driver",
          text: "On my way",
          messageType: "text",
          status: "read",
          createdAt: "2026-08-15T10:02:00.000Z",
        },
      ],
      supports: [],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });
    render(<MemoryRouter><AdminChat /></MemoryRouter>);
    await screen.findByText("RIDE-001");

    await userEvent.click(screen.getByRole("button", { name: /Inspect/ }));
    expect(await screen.findByText("Voice message")).toBeInTheDocument();
    expect(screen.getByText("0:08")).toBeInTheDocument();
    expect(screen.getByText("On my way")).toBeInTheDocument();
  });
});
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSecureCalls } from "../api/domains/secureCalls";
import SecureCalls from "./SecureCalls";

vi.mock("../api/domains/secureCalls", () => ({
  getSecureCalls: vi.fn(),
  secureCallsErrorMessage: (error, fallback) => error?.message || fallback,
}));

describe("Secure calls admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSecureCalls.mockResolvedValue({
      events: [
        {
          id: "call-log-1",
          callId: "CALL-ABC-123",
          rideId: "ride-1",
          participants: { passenger: { name: "Amira K" }, driver: { name: "Tariq A" } },
          startedAt: "2026-08-15T09:30:00.000Z",
          endedAt: "2026-08-15T09:31:30.000Z",
          durationSec: 90,
          status: "completed",
          failureReason: "",
          providerReference: "prov-ref-1",
          recordingEnabled: false,
        },
      ],
      summary: { total: 1, completed: 1, failed: 0, missed: 0, totalDurationSec: 90 },
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders call metadata without exposing recording or contact details", async () => {
    render(<MemoryRouter><SecureCalls /></MemoryRouter>);

    expect(await screen.findByText("CALL-ABC-123")).toBeInTheDocument();
    expect(screen.getByText("Amira K")).toBeInTheDocument();
    expect(screen.getByText("Tariq A")).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("prov-ref-1")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/whatsapp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recording\./i)).not.toBeInTheDocument();
  });

  it("passes ride id and status filters to the backend", async () => {
    render(<MemoryRouter><SecureCalls /></MemoryRouter>);
    await screen.findByText("CALL-ABC-123");

    await userEvent.type(screen.getByPlaceholderText("Ride reference / ID"), "ride-1");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "" }), "completed");
    await waitFor(() => {
      expect(getSecureCalls).toHaveBeenLastCalledWith(expect.objectContaining({
        page: 1,
        limit: 25,
        rideId: "ride-1",
        status: "completed",
      }));
    });
  });
});
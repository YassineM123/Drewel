import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRides } from "../../api/domains/rides";
import Rides from "./Rides";

vi.mock("../../api/domains/rides", () => ({
  getRides: vi.fn(),
  ridesErrorMessage: (error, fallback) => error?.message || fallback,
}));

vi.mock("../../context/SocketContext", () => ({
  useSocket: () => ({ socket: null, isConnected: false }),
}));

describe("Admin ride list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRides.mockResolvedValue({
      rides: [{
        id: "ride-1",
        status: "in_progress",
        user: { fullName: "Assigned User" },
        driver: { fullName: "Assigned Driver" },
        pickup: { address: "Pickup" },
        destination: { address: "Destination" },
        etaMinutes: 12,
        distanceMeters: 2450,
        lastGpsAt: "2026-07-29T10:00:00.000Z",
        updatedAt: "2026-07-29T10:00:00.000Z",
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders lifecycle and participant evidence", async () => {
    render(<MemoryRouter><Rides /></MemoryRouter>);
    expect(await screen.findByText("Assigned User")).toBeInTheDocument();
    expect(screen.getByText("Assigned Driver")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument();
  });

  it("defaults to the active operational filter", async () => {
    render(<MemoryRouter><Rides /></MemoryRouter>);
    await waitFor(() => expect(getRides).toHaveBeenCalled());
    expect(getRides.mock.calls[0][0]).toEqual(expect.objectContaining({
      status: "active",
      page: 1,
      limit: 20,
      sort: "updatedAt",
      dir: "desc",
    }));
  });

  it("sends city and participant filters", async () => {
    render(<MemoryRouter><Rides /></MemoryRouter>);
    await screen.findByText("Assigned User");
    const cityInput = screen.getByPlaceholderText("Dubai, Abu Dhabi…");
    await userEvent.type(cityInput, "Dubai");
    await waitFor(() => expect(getRides.mock.calls.at(-1)[0].filters).toEqual(
      expect.objectContaining({ city: "Dubai" }),
    ));
  });

  it("supports locked operational views without duplicating ride logic", async () => {
    render(<MemoryRouter><Rides initialFilter="stuck" lockedFilter /></MemoryRouter>);
    expect(await screen.findByText("Stuck Rides")).toBeInTheDocument();
    await waitFor(() => expect(getRides).toHaveBeenCalled());
    expect(getRides.mock.calls[0][0]).toEqual(expect.objectContaining({
      status: "stuck",
    }));
    expect(screen.queryByRole("button", { name: "Active" })).not.toBeInTheDocument();
  });

  it("exports the loaded filtered records as CSV", async () => {
    const createObjectURL = vi.fn(() => "blob:reservations");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === "a") element.click = click;
      return element;
    });

    render(<MemoryRouter><Rides /></MemoryRouter>);
    await screen.findByText("Assigned User");
    await userEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:reservations");
  });
});
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAdminRides } from "../../utils/ridesAdminApi";
import Rides from "./Rides";

vi.mock("../../utils/ridesAdminApi", () => ({
  listAdminRides: vi.fn(),
  rideApiError: (error, fallback) => error?.message || fallback,
}));

describe("Admin ride list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAdminRides.mockResolvedValue({
      rides: [{
        id: "ride-1",
        status: "in_progress",
        user: { fullName: "Assigned User" },
        driver: { fullName: "Assigned Driver" },
        pickup: { address: "Pickup" },
        destination: { address: "Destination" },
        etaMinutes: 12,
        updatedAt: "2026-07-29T10:00:00.000Z",
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("renders lifecycle and participant evidence", async () => {
    render(<MemoryRouter><Rides /></MemoryRouter>);
    expect(await screen.findByText("Assigned User")).toBeInTheDocument();
    expect(screen.getByText("Assigned Driver")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute("href", "/reservations/ride-1");
  });

  it("defaults to the active operational filter", async () => {
    render(<MemoryRouter><Rides /></MemoryRouter>);
    await waitFor(() => expect(listAdminRides).toHaveBeenCalled());
    expect(listAdminRides.mock.calls[0][0]).toEqual(expect.objectContaining({
      status: "active",
      page: 1,
      limit: 20,
    }));
  });
});

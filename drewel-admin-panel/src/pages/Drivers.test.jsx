import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDriverList } from "../utils/api";
import Drivers from "./Drivers";

vi.mock("../utils/api", () => ({
  getDriverList: vi.fn(),
  updateDriverReviewStatus: vi.fn(),
}));

vi.mock("../api/domains/drivers", () => ({
  addDriver: vi.fn(),
  getDriverDetail: vi.fn(),
  updateDriverRestriction: vi.fn(),
}));

describe("Drivers admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDriverList.mockResolvedValue({
      drivers: [
        {
          _id: "driver-1",
          firstName: "Amina",
          lastName: "Ready",
          whatsappNumber: "971501234567",
          status: "completed",
          availabilityStatus: "Online",
          isDiscoverable: true,
          vehicleType: "sedan",
          vehicleModel: "Camry",
          pointsWallet: { availablePoints: 45 },
          rideSummary: { completed: 12, activeRide: null },
          documentSummary: { available: 9, total: 9 },
          locationAgeSeconds: 30,
          lastActivityAt: "2026-08-15T10:00:00.000Z",
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders operational driver evidence from the backend", async () => {
    render(<MemoryRouter><Drivers /></MemoryRouter>);

    expect(await screen.findByText("Amina Ready")).toBeInTheDocument();
    expect(screen.getAllByText("DISCOVERABLE").length).toBeGreaterThan(1);
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("12 completed")).toBeInTheDocument();
    expect(screen.getByText("9/9")).toBeInTheDocument();
    expect(getDriverList).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      limit: 20,
      sort: "updatedAt",
      dir: "desc",
    }));
  });

  it("sends server-side filters instead of filtering only in React", async () => {
    render(<MemoryRouter><Drivers /></MemoryRouter>);
    await screen.findByText("Amina Ready");

    await userEvent.selectOptions(screen.getByLabelText("Availability filter"), "Online");
    await waitFor(() => {
      expect(getDriverList).toHaveBeenLastCalledWith(expect.objectContaining({
        availability: "Online",
      }));
    });
  });
});

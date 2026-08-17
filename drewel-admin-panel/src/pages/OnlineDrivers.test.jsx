import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOnlineDriverList } from "../utils/api";
import OnlineDrivers from "./OnlineDrivers";

vi.mock("../context/SocketContext", () => ({
  useSocket: () => ({ socket: null, isConnected: false }),
}));

vi.mock("../utils/api", () => ({
  getOnlineDriverList: vi.fn(),
  updateDriverReviewStatus: vi.fn(),
}));

describe("OnlineDrivers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOnlineDriverList.mockResolvedValue([
      {
        _id: "driver-1",
        firstName: "Amina",
        lastName: "Ready",
        whatsappNumber: "+971501234567",
        status: "completed",
        vehicleType: "sedan",
        vehicleModel: "Camry",
        presenceStatus: "Online",
        presenceLastHeartbeatAt: "2026-08-15T10:00:00.000Z",
        availabilityStatus: "Online",
        isDiscoverable: true,
        discoverabilityReasons: [],
        locationAgeSeconds: 22,
        locationAccuracyM: 8,
      },
      {
        _id: "driver-2",
        firstName: "Omar",
        lastName: "Blocked",
        whatsappNumber: "+971509998888",
        status: "completed",
        vehicleType: "suv",
        vehicleModel: "Patrol",
        presenceStatus: "Online",
        availabilityStatus: "Online",
        isDiscoverable: false,
        discoverabilityReasons: ["stale_gps", "low_accuracy"],
        locationAgeSeconds: 3600,
        locationAccuracyM: 7000,
      },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders marketplace discoverability and GPS diagnostics from the backend", async () => {
    render(<MemoryRouter><OnlineDrivers /></MemoryRouter>);

    expect(await screen.findByText("Amina Ready")).toBeInTheDocument();
    expect(screen.getByText("Omar Blocked")).toBeInTheDocument();
    expect(screen.getAllByText("Discoverable").length).toBeGreaterThan(0);
    expect(screen.getByText("GPS warnings")).toBeInTheDocument();
    expect(screen.getByText("Stale GPS +1")).toBeInTheDocument();
    expect(screen.getByText("+971***567")).toBeInTheDocument();
    expect(screen.getByText("+971***888")).toBeInTheDocument();
  });

  it("filters to drivers blocked from discovery", async () => {
    render(<MemoryRouter><OnlineDrivers /></MemoryRouter>);
    await screen.findByText("Amina Ready");

    await userEvent.selectOptions(
      screen.getByLabelText("Discoverability filter"),
      "blocked"
    );

    await waitFor(() => {
      expect(screen.queryByText("Amina Ready")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Omar Blocked")).toBeInTheDocument();
  });
});

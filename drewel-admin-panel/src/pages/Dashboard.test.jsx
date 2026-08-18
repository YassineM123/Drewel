import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

vi.mock("../context/SocketContext", () => ({
  useSocket: () => ({ socket: null, isConnected: false }),
}));

vi.mock("../api/domains/dashboard", () => ({
  getDashboard: vi.fn(async () => ({
      totalUsers: 12,
      totalDrivers: 8,
      onlineDrivers: 4,
      discoverableDrivers: 3,
      pendingApproval1: 2,
      pendingApproval2: 1,
      activeReservations: 5,
      pendingTripOffers: 6,
      openDisputes: 1,
      lowBalanceDrivers: 2,
      openSupportReports: 2,
      health: {
        api: "operational",
        database: "operational",
        socketIo: "unavailable",
        notifications: "not_configured",
        storage: "configured",
        generatedAt: "2026-08-15T10:00:00.000Z",
      },
      recentReservations: [
        {
          id: "ride-1",
          reference: "DRW-1",
          status: "confirmed",
          passengerName: "Passenger One",
          driverName: "Driver One",
          vehicleType: "Large Pickup",
          updatedAt: "2026-08-15T10:00:00.000Z",
        },
      ],
  })),
}));

vi.mock("../api/domains/points", () => ({
  getPointTransactions: vi.fn(async () => ({ transactions: [] })),
}));

describe("Dashboard", () => {
  it("renders real operations counters and recent reservations", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText("Operations Overview")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Discoverable")).toBeInTheDocument();
      expect(screen.getByText("DRW-1")).toBeInTheDocument();
    });

    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Passenger One/).length).toBeGreaterThan(0);
    expect(screen.getByText("Ride Volume Trend")).toBeInTheDocument();
    expect(screen.getByText("Profile Reports")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("System Health")).toBeInTheDocument();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUserDetail } from "../utils/api";
import UserDetail from "./UserDetail";

vi.mock("../utils/api", () => ({
  getUserDetail: vi.fn(),
}));

describe("UserDetail admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserDetail.mockResolvedValue({
      _id: "user-1",
      fullName: "Maya Passenger",
      countryCode: "+971",
      phone: "501234567",
      email: "maya@example.com",
      isRestricted: false,
      isVerified: true,
      createdAt: "2026-08-15T09:00:00.000Z",
      updatedAt: "2026-08-15T10:00:00.000Z",
      rideSummary: { total: 4, completed: 3, cancelled: 1, disputed: 0 },
      preferences: {
        language: "ar",
        notifications: { rideUpdates: true, messages: true },
      },
      savedPlaces: [
        {
          id: "place-1",
          type: "home",
          name: "Home",
          address: "Tunis Centre",
          lat: 36.8065,
          long: 10.1815,
        },
      ],
      recentRides: [
        {
          _id: "ride-1",
          reference: "RIDE-1",
          status: "completed",
          pickup: { address: "A" },
          destination: { address: "B" },
          updatedAt: "2026-08-15T10:00:00.000Z",
        },
      ],
      recentMessages: [{ _id: "message-1" }],
      supportReports: [
        {
          _id: "report-1",
          category: "app",
          status: "open",
          description: "Profile screen did not save correctly.",
          createdAt: "2026-08-15T10:00:00.000Z",
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders passenger profile evidence from the dashboard detail endpoint", async () => {
    render(
      <MemoryRouter initialEntries={["/users/user-1"]}>
        <Routes>
          <Route path="/users/:id" element={<UserDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Maya Passenger")).length).toBeGreaterThan(0);
    expect(screen.getByText("Tunis Centre")).toBeInTheDocument();
    expect(screen.getByText("RIDE-1 / completed")).toBeInTheDocument();
    expect(screen.getByText("Profile screen did not save correctly.")).toBeInTheDocument();
    expect(screen.getByText("AR")).toBeInTheDocument();
    expect(screen.getByText("Recent messages")).toBeInTheDocument();
    expect(getUserDetail).toHaveBeenCalledWith("user-1");
  });
});

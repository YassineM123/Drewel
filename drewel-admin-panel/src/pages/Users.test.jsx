import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUserList } from "../utils/api";
import Users from "./Users";

vi.mock("../utils/api", () => ({
  API_URL: "http://localhost:3001/api",
  getUserList: vi.fn(),
}));

describe("Users admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserList.mockResolvedValue({
      users: [
        {
          _id: "user-1",
          fullName: "Maya Passenger",
          phone: "971501234567",
          isRestricted: false,
          rideSummary: {
            completed: 7,
            cancelled: 1,
            disputed: 0,
            activeRide: { reference: "RIDE-1", status: "in_progress" },
          },
          supportSummary: { messagesSent: 3, reportedCalls: 0 },
          lastActivityAt: "2026-08-15T10:00:00.000Z",
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders backend user operations summaries", async () => {
    render(<MemoryRouter><Users /></MemoryRouter>);

    expect(await screen.findByText("Maya Passenger")).toBeInTheDocument();
    expect(screen.getByText("7 completed")).toBeInTheDocument();
    expect(screen.getByText("RIDE-1")).toBeInTheDocument();
    expect(screen.getByText("3 messages")).toBeInTheDocument();
    expect(screen.getByText("971501234567")).toBeInTheDocument();
    expect(getUserList).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      limit: 10,
      sort: "updatedAt",
    }));
  });

  it("sends status filters to the backend", async () => {
    render(<MemoryRouter><Users /></MemoryRouter>);
    await screen.findByText("Maya Passenger");

    await userEvent.selectOptions(screen.getByLabelText("User status filter"), "restricted");

    await waitFor(() => {
      expect(getUserList).toHaveBeenLastCalledWith(expect.objectContaining({
        status: "restricted",
      }));
    });
  });
});

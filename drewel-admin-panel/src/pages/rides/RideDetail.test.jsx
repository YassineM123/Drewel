import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addRideNote,
  getRideDetail,
  markTechnicalFailure,
  openDispute,
} from "../../api/domains/rides";
import RideDetail from "./RideDetail";

vi.mock("../../api/domains/rides", () => ({
  addRideNote: vi.fn(),
  cancelRide: vi.fn(),
  createRideActionKey: (action) => `key-${action}-${Date.now()}`,
  getRideDetail: vi.fn(),
  markTechnicalFailure: vi.fn(),
  openDispute: vi.fn(),
  refundRidePoints: vi.fn(),
  resolveRideDispute: vi.fn(),
  ridesErrorMessage: (error, fallback) => error?.message || fallback,
  unlockRide: vi.fn(),
}));

vi.mock("../../context/SocketContext", () => ({
  useSocket: () => ({ socket: null, isConnected: false }),
}));

const baseRide = {
  id: "ride-1",
  reference: "RIDE-XYZ",
  status: "in_progress",
  user: { fullName: "Assigned User" },
  driver: { fullName: "Assigned Driver" },
  pickup: { address: "Pickup Street" },
  destination: { address: "Destination Avenue" },
  agreedPrice: 45,
  pointsCharged: 20,
  etaMinutes: 10,
  distanceMeters: 1200,
  updatedAt: "2026-07-29T10:00:00.000Z",
  createdAt: "2026-07-29T09:00:00.000Z",
  tripOffer: {
    offeredPrice: 45,
    pointsCost: 20,
    status: "accepted",
    reservationState: "captured",
    vehicleType: "Large Pickup",
    clientOfferId: "offer-client-1",
  },
  internalNotes: [{ id: "note-1", adminName: "Operations Lead", text: "Customer called about ETA.", createdAt: "2026-07-29T09:30:00.000Z" }],
  auditTrail: [
    { id: "a-1", action: "ride_in_progress", actorRole: "driver", occurredAt: "2026-07-29T09:45:00.000Z" },
    { id: "a-2", action: "ride_confirmed", actorRole: "admin", occurredAt: "2026-07-29T09:15:00.000Z" },
  ],
};

describe("Admin ride detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRideDetail.mockResolvedValue({ ...baseRide, internalNotes: [...baseRide.internalNotes] });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders ride summary, trip offer, price and points", async () => {
    render(<MemoryRouter initialEntries={["/reservations/ride-1"]}><Routes><Route path="/reservations/:rideId" element={<RideDetail />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("Assigned User")).toBeInTheDocument();
    expect(screen.getAllByText("45 AED").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("20 points").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Offer status")).toBeInTheDocument();
    expect(screen.getByText("accepted")).toBeInTheDocument();
  });

  it("shows dispute action for an active ride and resolves it on demand", async () => {
    render(<MemoryRouter initialEntries={["/reservations/ride-1"]}><Routes><Route path="/reservations/:rideId" element={<RideDetail />} /></Routes></MemoryRouter>);
    await screen.findByText("Assigned User");
    expect(screen.getByRole("button", { name: "Open dispute" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark technical failure" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve dispute" })).not.toBeInTheDocument();
  });

  it("shows resolve overlay for a disputed ride only", async () => {
    getRideDetail.mockResolvedValue({ ...baseRide, status: "disputed" });
    render(<MemoryRouter initialEntries={["/reservations/ride-1"]}><Routes><Route path="/reservations/:rideId" element={<RideDetail />} /></Routes></MemoryRouter>);
    await screen.findByText("Assigned User");
    expect(screen.getByRole("button", { name: "Resolve dispute" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open dispute" })).not.toBeInTheDocument();
  });

  it("opens a dispute with a reason and refreshes ride state", async () => {
    openDispute.mockResolvedValue({ ride: { ...baseRide, status: "disputed" } });
    render(<MemoryRouter initialEntries={["/reservations/ride-1"]}><Routes><Route path="/reservations/:rideId" element={<RideDetail />} /></Routes></MemoryRouter>);
    await screen.findByText("Assigned User");
    await userEvent.click(screen.getByRole("button", { name: "Open dispute" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Reason/ }), "Driver refused service");
    await userEvent.click(within(dialog).getByRole("button", { name: /Open dispute$/ }));
    await waitFor(() => expect(openDispute).toHaveBeenCalled());
    expect(openDispute.mock.calls[0][2]).toMatch(/^key-dispute-/);
  });

  it("marks a technical failure with a reason", async () => {
    markTechnicalFailure.mockResolvedValue({ ride: { ...baseRide, status: "cancelled_by_admin" } });
    render(<MemoryRouter initialEntries={["/reservations/ride-1"]}><Routes><Route path="/reservations/:rideId" element={<RideDetail />} /></Routes></MemoryRouter>);
    await screen.findByText("Assigned User");
    await userEvent.click(screen.getByRole("button", { name: "Mark technical failure" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Reason/ }), "GPS tracking service degraded");
    await userEvent.click(within(dialog).getByRole("button", { name: /Mark technical failure$/ }));
    await waitFor(() => expect(markTechnicalFailure).toHaveBeenCalled());
    expect(markTechnicalFailure.mock.calls[0][2]).toMatch(/^key-failure-/);
  });

  it("adds an internal note and refreshes the list", async () => {
    addRideNote.mockResolvedValue({ note: { id: "note-2" }, idempotent: false });
    const refreshed = { ...baseRide, internalNotes: [...baseRide.internalNotes, { id: "note-2", adminName: "Ops", text: "Wireframe DPS flow approved", createdAt: "2026-07-29T10:30:00.000Z" }] };
    getRideDetail.mockResolvedValue(refreshed);
    render(<MemoryRouter initialEntries={["/reservations/ride-1"]}><Routes><Route path="/reservations/:rideId" element={<RideDetail />} /></Routes></MemoryRouter>);
    await screen.findByText("Customer called about ETA.");
    await userEvent.click(screen.getByRole("button", { name: "Add note" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Note/ }), "Wireframe DPS flow approved");
    await userEvent.click(within(dialog).getByRole("button", { name: /Add note$/ }));
    await waitFor(() => expect(addRideNote).toHaveBeenCalled());
    expect(await screen.findByText("Wireframe DPS flow approved")).toBeInTheDocument();
  });

  it("hides cancellation-invalid actions after terminal state", async () => {
    getRideDetail.mockResolvedValue({ ...baseRide, status: "cancelled_by_admin", agreedPrice: 45 });
    render(<MemoryRouter initialEntries={["/reservations/ride-1"]}><Routes><Route path="/reservations/:rideId" element={<RideDetail />} /></Routes></MemoryRouter>);
    await screen.findByText("Assigned User");
    expect(screen.queryByText("Cancel reservation")).not.toBeInTheDocument();
    expect(screen.queryByText("Open dispute")).not.toBeInTheDocument();
    expect(screen.getByText("Controlled unlock")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import AdjustmentModal from "./AdjustmentModal";
import { adjustDriverPoints } from "../../utils/pointsAdminApi";

vi.mock("../../utils/pointsAdminApi", () => ({
  adjustDriverPoints: vi.fn(),
  createIdempotencyKey: () => "one-key",
  pointsErrorMessage: (error) => error.message,
}));

const driver = { id: "driver-1", fullName: "Amina Driver", wallet: { availablePoints: 20 } };
describe("Adjustment modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adjustDriverPoints.mockResolvedValue({ success: true });
  });
  afterEach(cleanup);

  it("prevents a debit that would create a negative balance", () => {
    render(<AdjustmentModal driver={driver} mode="debit" onClose={() => {}} onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText("Points"), { target: { value: "21" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Correction required" } });
    expect(screen.getByRole("alert")).toHaveTextContent("negative");
    expect(screen.getByRole("button", { name: "Review adjustment" })).toBeDisabled();
  });

  it("blocks repeated confirmation taps while crediting", async () => {
    let resolve;
    adjustDriverPoints.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<AdjustmentModal driver={driver} mode="credit" onClose={() => {}} onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText("Points"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Manual correction" } });
    fireEvent.click(screen.getByRole("button", { name: "Review adjustment" }));
    const confirm = screen.getByRole("button", { name: "Confirm credit" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(adjustDriverPoints).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    resolve({ success: true });
    await waitFor(() => expect(adjustDriverPoints).toHaveBeenCalledTimes(1));
  });

  it("does not expose purchased-point crediting through a generic adjustment", () => {
    render(<AdjustmentModal driver={driver} mode="credit" onClose={() => {}} onSuccess={() => {}} />);

    expect(screen.queryByRole("option", { name: /purchase/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/payment reference/i)).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "payment-verified purchase request",
    );
  });
});

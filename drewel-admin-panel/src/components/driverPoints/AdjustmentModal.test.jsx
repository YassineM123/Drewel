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
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "Correction required" } });
    expect(screen.getByRole("alert")).toHaveTextContent("negative");
    expect(screen.getByRole("button", { name: "Review debit" })).toBeDisabled();
  });

  it("blocks repeated confirmation taps while crediting purchased points", async () => {
    let resolve;
    adjustDriverPoints.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<AdjustmentModal driver={driver} mode="credit-purchase" onClose={() => {}} onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText("Points"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Payment reference"), { target: { value: "PAY-001" } });
    fireEvent.change(screen.getByLabelText("Payment method"), { target: { value: "bank transfer" } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "Owner recorded payment" } });
    fireEvent.click(screen.getByRole("button", { name: "Review add" }));
    const confirm = screen.getByRole("button", { name: "Review and confirm" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(adjustDriverPoints).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    resolve({ success: true });
    await waitFor(() => expect(adjustDriverPoints).toHaveBeenCalledTimes(1));
    expect(adjustDriverPoints).toHaveBeenLastCalledWith(
      "credit",
      expect.objectContaining({
        source: "purchase",
        paymentReference: "PAY-001",
        paymentMethod: "bank transfer",
      }),
      "one-key",
    );
  });

  it("keeps the purchased-points form separate from free credit", () => {
    const { unmount } = render(<AdjustmentModal driver={driver} mode="credit-free" onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.queryByLabelText(/payment reference/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Source")).toBeInTheDocument();
    unmount();

    render(<AdjustmentModal driver={driver} mode="credit-purchase" onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.getByLabelText(/payment reference/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Source")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /bonus/i })).not.toBeInTheDocument();
  });
});
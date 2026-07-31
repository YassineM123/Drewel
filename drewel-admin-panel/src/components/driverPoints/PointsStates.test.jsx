import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PointsEmpty, PointsError, PointsLoading } from "./PointsStates";

describe("Driver Points table states", () => {
  it("announces loading accessibly", () => {
    render(<PointsLoading label="Loading wallets..." />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading wallets");
  });
  it("exposes API errors as alerts", () => {
    render(<PointsError message="Network unavailable" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Network unavailable");
  });
  it("renders an empty state", () => {
    render(<PointsEmpty title="No transactions" message="Nothing matches." />);
    expect(screen.getByText("No transactions")).toBeInTheDocument();
  });
});

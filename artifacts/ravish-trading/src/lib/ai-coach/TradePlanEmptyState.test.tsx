// v1.5.0 Sprint 10 — Institutional Trade Planner. Thin-wrapper coverage —
// confirms the trade-plan-flavoured copy renders and the optional action
// callback fires, mirroring StrategyEmptyState.test.tsx's own established
// pattern (Sprint 9).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradePlanEmptyState } from "./TradePlanEmptyState";

describe("TradePlanEmptyState", () => {
  it("renders the default title and description", () => {
    render(<TradePlanEmptyState />);
    expect(screen.getByText("No trade plans yet")).toBeInTheDocument();
  });

  it("renders a custom action label and calls onAction when clicked", () => {
    const onAction = vi.fn();
    render(<TradePlanEmptyState actionLabel="Create your first trade plan" onAction={onAction} testId="empty" />);
    fireEvent.click(screen.getByText("Create your first trade plan"));
    expect(onAction).toHaveBeenCalled();
  });
});

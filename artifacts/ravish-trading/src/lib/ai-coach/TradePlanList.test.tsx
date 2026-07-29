// v1.5.0 Sprint 10 — Institutional Trade Planner. Rendering coverage for
// the pure list-rendering component — loading, honest empty, and
// populated states, mirroring StrategyList.test.tsx's own established
// pattern (Sprint 9).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradePlanList } from "./TradePlanList";
import type { TradePlan } from "./tradePlansApi";

function plan(overrides: Partial<TradePlan> = {}): TradePlan {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    strategyId: null,
    title: "Plan A",
    plannedAsset: "AAPL",
    assetClass: null,
    direction: "long",
    status: "draft",
    pinned: false,
    tags: [],
    currentVersion: 1,
    executedTradeRef: null,
    executedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const noop = () => {};

describe("TradePlanList", () => {
  it("shows a loading message while isLoading is true", () => {
    render(<TradePlanList plans={[]} isLoading activePlanId={null} onSelectPlan={noop} />);
    expect(screen.getByTestId("trade-plan-list-loading")).toBeInTheDocument();
  });

  it("shows an honest empty state with no plans", () => {
    render(<TradePlanList plans={[]} isLoading={false} activePlanId={null} onSelectPlan={noop} />);
    expect(screen.getByText("No trade plans yet")).toBeInTheDocument();
  });

  it("calls onCreateFirst when the empty state's action is clicked", () => {
    const onCreateFirst = vi.fn();
    render(<TradePlanList plans={[]} isLoading={false} activePlanId={null} onSelectPlan={noop} onCreateFirst={onCreateFirst} />);
    fireEvent.click(screen.getByText("Create your first trade plan"));
    expect(onCreateFirst).toHaveBeenCalled();
  });

  it("renders one card per plan", () => {
    render(
      <TradePlanList
        plans={[plan({ id: 1, title: "Plan A" }), plan({ id: 2, title: "Plan B" })]}
        isLoading={false}
        activePlanId={2}
        onSelectPlan={noop}
      />,
    );
    expect(screen.getByText("Plan A")).toBeInTheDocument();
    expect(screen.getByText("Plan B")).toBeInTheDocument();
    expect(screen.getByTestId("trade-plan-list-card-2")).toHaveAttribute("data-active", "true");
  });
});

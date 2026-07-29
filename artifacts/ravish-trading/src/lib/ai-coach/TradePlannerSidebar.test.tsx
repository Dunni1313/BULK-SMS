// v1.5.0 Sprint 10 — Institutional Trade Planner. Rendering/interaction
// coverage for the trade plan library sidebar — create, search, status
// filter, select, clear selection, and the empty state, mirroring
// StrategySidebar.test.tsx's own established pattern (Sprint 9).
// Direction-select option-picking is not simulated here (matching this
// codebase's own established convention of not driving shadcn/ui Select
// option-picking through jsdom) — only the title-only create path is
// exercised for create-form submission.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradePlannerSidebar, type TradePlannerSidebarProps } from "./TradePlannerSidebar";
import type { TradePlan } from "./tradePlansApi";

function plan(overrides: Partial<TradePlan> = {}): TradePlan {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    strategyId: null,
    title: "Breakout Long",
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

function baseProps(overrides: Partial<TradePlannerSidebarProps> = {}) {
  return {
    plans: [] as TradePlan[],
    isLoading: false,
    activePlanId: null,
    searchTerm: "",
    onSearchChange: noop,
    statusFilter: null,
    onStatusFilterChange: noop,
    includeArchived: false,
    onIncludeArchivedChange: noop,
    onCreatePlan: noop,
    onSelectPlan: noop,
    onClearSelection: noop,
    ...overrides,
  };
}

describe("TradePlannerSidebar — empty / loading state", () => {
  it("shows a loading message while isLoading is true", () => {
    render(<TradePlannerSidebar {...baseProps({ isLoading: true })} />);
    expect(screen.getByTestId("trade-planner-sidebar-list-loading")).toBeInTheDocument();
  });

  it("shows the empty state when there are no plans", () => {
    render(<TradePlannerSidebar {...baseProps()} />);
    expect(screen.getByTestId("trade-planner-sidebar-list-empty")).toBeInTheDocument();
  });
});

describe("TradePlannerSidebar — listing / selection", () => {
  it("renders one card per plan", () => {
    render(<TradePlannerSidebar {...baseProps({ plans: [plan({ id: 1, title: "Alpha" }), plan({ id: 2, title: "Beta" })] })} />);
    expect(screen.getByTestId("trade-planner-sidebar-list-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("trade-planner-sidebar-list-card-2")).toBeInTheDocument();
  });

  it("calls onSelectPlan when a plan card is clicked", () => {
    const onSelectPlan = vi.fn();
    render(<TradePlannerSidebar {...baseProps({ plans: [plan({ id: 3, title: "Pick me" })], onSelectPlan })} />);
    fireEvent.click(screen.getByTestId("trade-planner-sidebar-list-card-3-select"));
    expect(onSelectPlan).toHaveBeenCalledWith(3);
  });

  it("shows a clear-selection link only when a plan is active, and calls onClearSelection", () => {
    const onClearSelection = vi.fn();
    const { rerender } = render(<TradePlannerSidebar {...baseProps({ plans: [plan()], onClearSelection })} />);
    expect(screen.queryByTestId("trade-planner-sidebar-clear-selection")).not.toBeInTheDocument();

    rerender(<TradePlannerSidebar {...baseProps({ plans: [plan()], activePlanId: 1, onClearSelection })} />);
    fireEvent.click(screen.getByTestId("trade-planner-sidebar-clear-selection"));
    expect(onClearSelection).toHaveBeenCalled();
  });
});

describe("TradePlannerSidebar — search / filters", () => {
  it("calls onSearchChange as the user types", () => {
    const onSearchChange = vi.fn();
    render(<TradePlannerSidebar {...baseProps({ onSearchChange })} />);
    fireEvent.change(screen.getByTestId("trade-planner-sidebar-search"), { target: { value: "breakout" } });
    expect(onSearchChange).toHaveBeenCalledWith("breakout");
  });

  it("calls onIncludeArchivedChange when the checkbox is toggled", () => {
    const onIncludeArchivedChange = vi.fn();
    render(<TradePlannerSidebar {...baseProps({ onIncludeArchivedChange })} />);
    fireEvent.click(screen.getByTestId("trade-planner-sidebar-include-archived"));
    expect(onIncludeArchivedChange).toHaveBeenCalledWith(true);
  });
});

describe("TradePlannerSidebar — create plan", () => {
  it("opens the create form, then submits title + planned asset and closes it", async () => {
    const onCreatePlan = vi.fn().mockResolvedValue(undefined);
    render(<TradePlannerSidebar {...baseProps({ onCreatePlan })} />);
    fireEvent.click(screen.getByTestId("trade-planner-sidebar-new-plan"));
    expect(screen.getByTestId("trade-planner-sidebar-create-form")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("trade-planner-sidebar-create-title"), { target: { value: "New plan" } });
    fireEvent.change(screen.getByTestId("trade-planner-sidebar-create-asset"), { target: { value: "MSFT" } });
    await fireEvent.click(screen.getByTestId("trade-planner-sidebar-create-save"));

    expect(onCreatePlan).toHaveBeenCalledWith({ title: "New plan", plannedAsset: "MSFT" });
  });

  it("never creates a plan with an empty title", () => {
    const onCreatePlan = vi.fn();
    render(<TradePlannerSidebar {...baseProps({ onCreatePlan })} />);
    fireEvent.click(screen.getByTestId("trade-planner-sidebar-new-plan"));
    fireEvent.click(screen.getByTestId("trade-planner-sidebar-create-save"));
    expect(onCreatePlan).not.toHaveBeenCalled();
  });

  it("cancel closes the create form without calling onCreatePlan", () => {
    const onCreatePlan = vi.fn();
    render(<TradePlannerSidebar {...baseProps({ onCreatePlan })} />);
    fireEvent.click(screen.getByTestId("trade-planner-sidebar-new-plan"));
    fireEvent.change(screen.getByTestId("trade-planner-sidebar-create-title"), { target: { value: "Abandoned" } });
    fireEvent.click(screen.getByTestId("trade-planner-sidebar-create-cancel"));
    expect(screen.queryByTestId("trade-planner-sidebar-create-form")).not.toBeInTheDocument();
    expect(onCreatePlan).not.toHaveBeenCalled();
  });

  it("the empty state's own action button also opens the create form", () => {
    render(<TradePlannerSidebar {...baseProps()} />);
    fireEvent.click(screen.getByTestId("trade-planner-sidebar-list-empty-action"));
    expect(screen.getByTestId("trade-planner-sidebar-create-form")).toBeInTheDocument();
  });
});

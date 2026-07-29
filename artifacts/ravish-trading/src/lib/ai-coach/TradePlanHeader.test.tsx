// v1.5.0 Sprint 10 — Institutional Trade Planner. Rendering/interaction
// coverage for the trade plan header — title/planned asset/asset
// class/direction/status display and inline edit, pin/delete actions,
// and the version badge, mirroring StrategyHeader.test.tsx's own
// established pattern (Sprint 9). Direction/status-select
// option-picking is not simulated here (matching this codebase's own
// established convention of not driving shadcn/ui Select option-picking
// through jsdom) — the edit form is submitted with its pre-filled
// default direction/status.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradePlanHeader } from "./TradePlanHeader";
import type { TradePlanDetail } from "./tradePlansApi";

function detail(overrides: Partial<TradePlanDetail> = {}): TradePlanDetail {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    strategyId: null,
    title: "Breakout Long",
    plannedAsset: "AAPL",
    assetClass: "equities",
    direction: "long",
    status: "draft",
    pinned: false,
    tags: ["momentum"],
    currentVersion: 2,
    executedTradeRef: null,
    executedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    sections: [],
    versions: [],
    checklistItems: [],
    checklistProgress: { totalItems: 0, completedItems: 0, requiredItems: 0, completedRequiredItems: 0, progressPct: 0, readyForEntry: false },
    ...overrides,
  };
}

const noop = () => {};

describe("TradePlanHeader — rendering", () => {
  it("renders the title, planned asset/direction/asset class, tags, and version", () => {
    render(<TradePlanHeader plan={detail()} onUpdate={noop} onTogglePin={noop} onDelete={noop} />);
    expect(screen.getByTestId("trade-plan-header-title")).toHaveTextContent("Breakout Long");
    expect(screen.getByTestId("trade-plan-header-meta")).toHaveTextContent("AAPL · Long · equities");
    expect(screen.getByText("momentum")).toBeInTheDocument();
    expect(screen.getByTestId("trade-plan-header-version")).toHaveTextContent("v2");
  });

  it("shows the status badge", () => {
    render(<TradePlanHeader plan={detail({ status: "ready" })} onUpdate={noop} onTogglePin={noop} onDelete={noop} />);
    expect(screen.getByTestId("trade-plan-header-status-badge")).toHaveTextContent("Ready");
  });
});

describe("TradePlanHeader — actions", () => {
  it("calls onTogglePin with the toggled value", () => {
    const onTogglePin = vi.fn();
    render(<TradePlanHeader plan={detail({ pinned: false })} onUpdate={noop} onTogglePin={onTogglePin} onDelete={noop} />);
    fireEvent.click(screen.getByTestId("trade-plan-header-pin-toggle"));
    expect(onTogglePin).toHaveBeenCalledWith(true);
  });

  it("calls onDelete", () => {
    const onDelete = vi.fn();
    render(<TradePlanHeader plan={detail()} onUpdate={noop} onTogglePin={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("trade-plan-header-delete"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("calls onOpenVersionHistory when the version badge is clicked", () => {
    const onOpenVersionHistory = vi.fn();
    render(<TradePlanHeader plan={detail()} onUpdate={noop} onTogglePin={noop} onDelete={noop} onOpenVersionHistory={onOpenVersionHistory} />);
    fireEvent.click(screen.getByTestId("trade-plan-header-version"));
    expect(onOpenVersionHistory).toHaveBeenCalled();
  });
});

describe("TradePlanHeader — inline edit", () => {
  it("opens the edit form pre-filled, then submits an update with every field", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<TradePlanHeader plan={detail()} onUpdate={onUpdate} onTogglePin={noop} onDelete={noop} />);

    fireEvent.click(screen.getByTestId("trade-plan-header-edit-toggle"));
    expect(screen.getByTestId("trade-plan-header-edit-title")).toHaveValue("Breakout Long");
    expect(screen.getByTestId("trade-plan-header-edit-asset")).toHaveValue("AAPL");

    fireEvent.change(screen.getByTestId("trade-plan-header-edit-title"), { target: { value: "Renamed plan" } });
    fireEvent.change(screen.getByTestId("trade-plan-header-edit-asset"), { target: { value: "MSFT" } });
    await fireEvent.click(screen.getByTestId("trade-plan-header-edit-save"));

    expect(onUpdate).toHaveBeenCalledWith({
      title: "Renamed plan",
      plannedAsset: "MSFT",
      assetClass: "equities",
      direction: "long",
      status: "draft",
    });
  });

  it("never submits with an empty title", () => {
    const onUpdate = vi.fn();
    render(<TradePlanHeader plan={detail()} onUpdate={onUpdate} onTogglePin={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTestId("trade-plan-header-edit-toggle"));
    fireEvent.change(screen.getByTestId("trade-plan-header-edit-title"), { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("trade-plan-header-edit-save"));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("cancel closes the edit form without calling onUpdate", () => {
    const onUpdate = vi.fn();
    render(<TradePlanHeader plan={detail()} onUpdate={onUpdate} onTogglePin={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTestId("trade-plan-header-edit-toggle"));
    fireEvent.change(screen.getByTestId("trade-plan-header-edit-title"), { target: { value: "Abandoned" } });
    fireEvent.click(screen.getByTestId("trade-plan-header-edit-cancel"));
    expect(screen.queryByTestId("trade-plan-header-edit-form")).not.toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

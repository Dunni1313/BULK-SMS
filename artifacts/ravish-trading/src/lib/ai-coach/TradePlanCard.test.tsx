// v1.5.0 Sprint 10 — Institutional Trade Planner. Rendering/interaction
// coverage for the single-trade-plan summary card, mirroring
// StrategyCard.test.tsx's own established pattern (Sprint 9).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradePlanCard } from "./TradePlanCard";
import type { TradePlan } from "./tradePlansApi";

function plan(overrides: Partial<TradePlan> = {}): TradePlan {
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
    tags: ["momentum", "earnings"],
    currentVersion: 1,
    executedTradeRef: null,
    executedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const noop = () => {};

describe("TradePlanCard — rendering", () => {
  it("renders the title, planned asset, asset class, tags, and version", () => {
    render(<TradePlanCard plan={plan()} onSelect={noop} />);
    expect(screen.getByText("Breakout Long")).toBeInTheDocument();
    expect(screen.getByText(/AAPL · equities/)).toBeInTheDocument();
    expect(screen.getByText("momentum")).toBeInTheDocument();
    expect(screen.getByText("earnings")).toBeInTheDocument();
    expect(screen.getByTestId("trade-plan-card-1-version")).toHaveTextContent("v1");
  });

  it("shows the status badge reflecting the plan's own status", () => {
    render(<TradePlanCard plan={plan({ status: "ready" })} onSelect={noop} />);
    expect(screen.getByTestId("trade-plan-card-1-status-badge")).toHaveTextContent("Ready");
  });

  it("shows a pin icon for a pinned plan", () => {
    render(<TradePlanCard plan={plan({ pinned: true })} onSelect={noop} />);
    expect(screen.getByTestId("trade-plan-card-1-pinned-icon")).toBeInTheDocument();
  });

  it("reflects isActive via a data-active attribute", () => {
    render(<TradePlanCard plan={plan()} onSelect={noop} isActive />);
    expect(screen.getByTestId("trade-plan-card-1")).toHaveAttribute("data-active", "true");
  });
});

describe("TradePlanCard — actions", () => {
  it("calls onSelect with the plan id when clicked", () => {
    const onSelect = vi.fn();
    render(<TradePlanCard plan={plan()} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("trade-plan-card-1-select"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("calls onTogglePin with the toggled value", () => {
    const onTogglePin = vi.fn();
    render(<TradePlanCard plan={plan({ pinned: false })} onSelect={noop} onTogglePin={onTogglePin} />);
    fireEvent.click(screen.getByTestId("trade-plan-card-1-pin-toggle"));
    expect(onTogglePin).toHaveBeenCalledWith(1, true);
  });

  it("calls onDelete with the plan id", () => {
    const onDelete = vi.fn();
    render(<TradePlanCard plan={plan()} onSelect={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("trade-plan-card-1-delete"));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("renders no quick-action buttons when their handlers are omitted", () => {
    render(<TradePlanCard plan={plan()} onSelect={noop} />);
    expect(screen.queryByTestId("trade-plan-card-1-pin-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trade-plan-card-1-delete")).not.toBeInTheDocument();
  });
});

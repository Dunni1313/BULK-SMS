// v1.5.0 Sprint 9 — AI Strategy Builder. Rendering/interaction coverage
// for the single-strategy summary card, mirroring NotebookCard.test.tsx's
// own established pattern (Sprint 8).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategyCard } from "./StrategyCard";
import type { AiStrategy } from "./strategiesApi";

function strategy(overrides: Partial<AiStrategy> = {}): AiStrategy {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "Breakout playbook",
    description: null,
    strategyType: "Breakout",
    assetClass: "equities",
    folder: "Trading",
    status: "draft",
    pinned: false,
    archived: false,
    tags: ["momentum", "swing"],
    currentVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const noop = () => {};

describe("StrategyCard — rendering", () => {
  it("renders the title, strategy type, asset class, folder, tags, and version", () => {
    render(<StrategyCard strategy={strategy()} onSelect={noop} />);
    expect(screen.getByText("Breakout playbook")).toBeInTheDocument();
    expect(screen.getByText(/Breakout · equities · Trading/)).toBeInTheDocument();
    expect(screen.getByText("momentum")).toBeInTheDocument();
    expect(screen.getByText("swing")).toBeInTheDocument();
    expect(screen.getByTestId("strategy-card-1-version")).toHaveTextContent("v1");
  });

  it("shows the status badge reflecting the strategy's own status", () => {
    render(<StrategyCard strategy={strategy({ status: "active" })} onSelect={noop} />);
    expect(screen.getByTestId("strategy-card-1-status-badge")).toHaveTextContent("Active");
  });

  it("shows a pin icon and no archived badge for a pinned (favourite) strategy", () => {
    render(<StrategyCard strategy={strategy({ pinned: true })} onSelect={noop} />);
    expect(screen.getByTestId("strategy-card-1-pinned-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("strategy-card-1-archived-badge")).not.toBeInTheDocument();
  });

  it("shows an archived badge for an archived strategy", () => {
    render(<StrategyCard strategy={strategy({ archived: true })} onSelect={noop} />);
    expect(screen.getByTestId("strategy-card-1-archived-badge")).toBeInTheDocument();
  });

  it("reflects isActive via a data-active attribute", () => {
    render(<StrategyCard strategy={strategy()} onSelect={noop} isActive />);
    expect(screen.getByTestId("strategy-card-1")).toHaveAttribute("data-active", "true");
  });
});

describe("StrategyCard — actions", () => {
  it("calls onSelect with the strategy id when clicked", () => {
    const onSelect = vi.fn();
    render(<StrategyCard strategy={strategy()} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("strategy-card-1-select"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("calls onTogglePin with the toggled value", () => {
    const onTogglePin = vi.fn();
    render(<StrategyCard strategy={strategy({ pinned: false })} onSelect={noop} onTogglePin={onTogglePin} />);
    fireEvent.click(screen.getByTestId("strategy-card-1-pin-toggle"));
    expect(onTogglePin).toHaveBeenCalledWith(1, true);
  });

  it("calls onToggleArchive with the toggled value", () => {
    const onToggleArchive = vi.fn();
    render(<StrategyCard strategy={strategy({ archived: false })} onSelect={noop} onToggleArchive={onToggleArchive} />);
    fireEvent.click(screen.getByTestId("strategy-card-1-archive-toggle"));
    expect(onToggleArchive).toHaveBeenCalledWith(1, true);
  });

  it("calls onDelete with the strategy id", () => {
    const onDelete = vi.fn();
    render(<StrategyCard strategy={strategy()} onSelect={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("strategy-card-1-delete"));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("renders no quick-action buttons when their handlers are omitted", () => {
    render(<StrategyCard strategy={strategy()} onSelect={noop} />);
    expect(screen.queryByTestId("strategy-card-1-pin-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("strategy-card-1-archive-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("strategy-card-1-delete")).not.toBeInTheDocument();
  });
});

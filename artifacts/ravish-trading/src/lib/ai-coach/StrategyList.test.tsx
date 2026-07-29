// v1.5.0 Sprint 9 — AI Strategy Builder. Rendering coverage for the pure
// list-rendering component — loading, empty, and populated states —
// independent of StrategySidebar's own search/create-form/filter
// plumbing, mirroring NotebookList.test.tsx's own established pattern
// (Sprint 8).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategyList } from "./StrategyList";
import type { AiStrategy } from "./strategiesApi";

function strategy(overrides: Partial<AiStrategy> = {}): AiStrategy {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "Breakout playbook",
    description: null,
    strategyType: "Breakout",
    assetClass: null,
    folder: null,
    status: "draft",
    pinned: false,
    archived: false,
    tags: [],
    currentVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const noop = () => {};

describe("StrategyList", () => {
  it("shows a loading message while isLoading is true", () => {
    render(<StrategyList strategies={[]} isLoading activeStrategyId={null} onSelectStrategy={noop} />);
    expect(screen.getByTestId("strategy-list-loading")).toBeInTheDocument();
  });

  it("shows the empty state when there are no strategies", () => {
    render(<StrategyList strategies={[]} isLoading={false} activeStrategyId={null} onSelectStrategy={noop} />);
    expect(screen.getByTestId("strategy-list-empty")).toBeInTheDocument();
  });

  it("wires the empty state's action button to onCreateFirst when provided", () => {
    const onCreateFirst = vi.fn();
    render(<StrategyList strategies={[]} isLoading={false} activeStrategyId={null} onSelectStrategy={noop} onCreateFirst={onCreateFirst} />);
    fireEvent.click(screen.getByTestId("strategy-list-empty-action"));
    expect(onCreateFirst).toHaveBeenCalled();
  });

  it("renders one card per strategy and marks the active one", () => {
    render(
      <StrategyList
        strategies={[strategy({ id: 1, title: "Alpha" }), strategy({ id: 2, title: "Beta" })]}
        isLoading={false}
        activeStrategyId={2}
        onSelectStrategy={noop}
      />,
    );
    expect(screen.getByTestId("strategy-list-card-1")).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("strategy-list-card-2")).toHaveAttribute("data-active", "true");
  });

  it("calls onSelectStrategy when a card is clicked", () => {
    const onSelectStrategy = vi.fn();
    render(
      <StrategyList strategies={[strategy({ id: 5, title: "Pick me" })]} isLoading={false} activeStrategyId={null} onSelectStrategy={onSelectStrategy} />,
    );
    fireEvent.click(screen.getByTestId("strategy-list-card-5-select"));
    expect(onSelectStrategy).toHaveBeenCalledWith(5);
  });
});

// v1.5.0 Sprint 9 — AI Strategy Builder. Rendering/interaction coverage
// for the side-by-side comparison view — this component owns only the
// A/B picker UI and rendering, never fetches its own data (the caller's
// page fetches via GET /ai-strategies/compare and passes the result in).
// Select-based A/B picking is not simulated here, matching this
// codebase's own established convention of not driving shadcn/ui Select
// option-picking through jsdom.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategyComparisonView } from "./StrategyComparisonView";
import type { AiStrategy, StrategyComparison } from "./strategiesApi";

function strategy(overrides: Partial<AiStrategy> = {}): AiStrategy {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "Strategy A",
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

function comparison(): StrategyComparison {
  return {
    strategyA: { ...strategy({ id: 1, title: "Strategy A" }), sections: [{ id: 1, strategyId: 1, kind: "entry", content: "A's entry rule", notebook: null, conversation: null, file: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }] },
    strategyB: { ...strategy({ id: 2, title: "Strategy B", strategyType: "Mean Reversion" }), sections: [] },
  };
}

const noop = () => {};

describe("StrategyComparisonView — no comparison loaded yet", () => {
  it("renders the A/B selects but no comparison content when comparison is null", () => {
    render(
      <StrategyComparisonView
        strategies={[strategy({ id: 1, title: "Strategy A" }), strategy({ id: 2, title: "Strategy B" })]}
        selectedIdA={null}
        selectedIdB={null}
        onSelectA={noop}
        onSelectB={noop}
        comparison={null}
        onGenerateAiComparison={vi.fn()}
        testId="compare"
      />,
    );
    expect(screen.getByTestId("compare-select-a")).toBeInTheDocument();
    expect(screen.getByTestId("compare-select-b")).toBeInTheDocument();
    expect(screen.queryByTestId("compare-sections")).not.toBeInTheDocument();
  });

  it("shows a loading message while the comparison is loading", () => {
    render(
      <StrategyComparisonView
        strategies={[]}
        selectedIdA={1}
        selectedIdB={2}
        onSelectA={noop}
        onSelectB={noop}
        comparison={null}
        isLoadingComparison
        onGenerateAiComparison={vi.fn()}
        testId="compare"
      />,
    );
    expect(screen.getByTestId("compare-loading")).toBeInTheDocument();
  });
});

describe("StrategyComparisonView — comparison loaded", () => {
  it("renders both strategies' titles and their section content side by side", () => {
    render(
      <StrategyComparisonView
        strategies={[]}
        selectedIdA={1}
        selectedIdB={2}
        onSelectA={noop}
        onSelectB={noop}
        comparison={comparison()}
        onGenerateAiComparison={vi.fn()}
        testId="compare"
      />,
    );
    expect(screen.getByTestId("compare-strategy-a-header")).toHaveTextContent("Strategy A");
    expect(screen.getByTestId("compare-strategy-b-header")).toHaveTextContent("Strategy B");
    expect(screen.getByTestId("compare-section-entry")).toHaveTextContent("A's entry rule");
  });

  it("does not call onGenerateAiComparison automatically, only on explicit click", async () => {
    const onGenerateAiComparison = vi.fn().mockResolvedValue({ text: "A comparison narrative.", source: "template" });
    render(
      <StrategyComparisonView
        strategies={[]}
        selectedIdA={1}
        selectedIdB={2}
        onSelectA={noop}
        onSelectB={noop}
        comparison={comparison()}
        onGenerateAiComparison={onGenerateAiComparison}
        testId="compare"
      />,
    );
    expect(onGenerateAiComparison).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("compare-generate-ai"));
    expect(onGenerateAiComparison).toHaveBeenCalled();
    expect(await screen.findByTestId("compare-ai-result")).toHaveTextContent("A comparison narrative.");
  });
});

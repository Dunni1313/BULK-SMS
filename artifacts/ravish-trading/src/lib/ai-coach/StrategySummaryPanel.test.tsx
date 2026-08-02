// v1.5.0 Sprint 9 — AI Strategy Builder. Rendering/interaction coverage
// for the strategy's AI actions panel — the deterministic missing-
// sections strip (loaded once, never re-polled), the 5 prose narration
// actions (explicit, never auto-run), and the 3 checklist-shaped actions
// (delegated to StrategyChecklist, already covered by its own dedicated
// test file — only wiring is asserted here).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategySummaryPanel } from "./StrategySummaryPanel";

function noopMissing() {
  return Promise.resolve({ missing: [], present: [], completenessPct: 100 });
}

describe("StrategySummaryPanel — missing sections strip", () => {
  it("loads missing sections once on mount and shows the completeness banner when incomplete", async () => {
    const onLoadMissingSections = vi.fn().mockResolvedValue({ missing: ["risk", "stop"], present: [], completenessPct: 40 });
    render(
      <StrategySummaryPanel
        onLoadMissingSections={onLoadMissingSections}
        onSummarize={vi.fn()}
        onSuggestImprovements={vi.fn()}
        onGenerateExecutiveSummary={vi.fn()}
        onGenerateLearningNotes={vi.fn()}
        onGenerateRiskHighlights={vi.fn()}
        onGenerateSetupChecklist={vi.fn()}
        onGenerateTradePrepChecklist={vi.fn()}
        onGenerateReviewQuestions={vi.fn()}
        testId="panel"
      />,
    );
    expect(await screen.findByTestId("panel-completeness")).toHaveTextContent("40% complete");
    expect(onLoadMissingSections).toHaveBeenCalledTimes(1);
  });

  it("hides the completeness banner once the strategy is 100% complete", async () => {
    render(
      <StrategySummaryPanel
        onLoadMissingSections={noopMissing}
        onSummarize={vi.fn()}
        onSuggestImprovements={vi.fn()}
        onGenerateExecutiveSummary={vi.fn()}
        onGenerateLearningNotes={vi.fn()}
        onGenerateRiskHighlights={vi.fn()}
        onGenerateSetupChecklist={vi.fn()}
        onGenerateTradePrepChecklist={vi.fn()}
        onGenerateReviewQuestions={vi.fn()}
        testId="panel"
      />,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("panel-completeness")).not.toBeInTheDocument();
  });
});

describe("StrategySummaryPanel — narration actions", () => {
  it("none of the 5 narration actions is called automatically on mount", () => {
    const onSummarize = vi.fn();
    const onSuggestImprovements = vi.fn();
    const onGenerateExecutiveSummary = vi.fn();
    const onGenerateLearningNotes = vi.fn();
    const onGenerateRiskHighlights = vi.fn();
    render(
      <StrategySummaryPanel
        onLoadMissingSections={noopMissing}
        onSummarize={onSummarize}
        onSuggestImprovements={onSuggestImprovements}
        onGenerateExecutiveSummary={onGenerateExecutiveSummary}
        onGenerateLearningNotes={onGenerateLearningNotes}
        onGenerateRiskHighlights={onGenerateRiskHighlights}
        onGenerateSetupChecklist={vi.fn()}
        onGenerateTradePrepChecklist={vi.fn()}
        onGenerateReviewQuestions={vi.fn()}
      />,
    );
    expect(onSummarize).not.toHaveBeenCalled();
    expect(onSuggestImprovements).not.toHaveBeenCalled();
    expect(onGenerateExecutiveSummary).not.toHaveBeenCalled();
    expect(onGenerateLearningNotes).not.toHaveBeenCalled();
    expect(onGenerateRiskHighlights).not.toHaveBeenCalled();
  });

  it("clicking Summarise calls onSummarize and renders the honest result", async () => {
    const onSummarize = vi.fn().mockResolvedValue({ text: "A breakout strategy.", source: "template" });
    render(
      <StrategySummaryPanel
        onLoadMissingSections={noopMissing}
        onSummarize={onSummarize}
        onSuggestImprovements={vi.fn()}
        onGenerateExecutiveSummary={vi.fn()}
        onGenerateLearningNotes={vi.fn()}
        onGenerateRiskHighlights={vi.fn()}
        onGenerateSetupChecklist={vi.fn()}
        onGenerateTradePrepChecklist={vi.fn()}
        onGenerateReviewQuestions={vi.fn()}
        testId="panel"
      />,
    );
    fireEvent.click(screen.getByTestId("panel-summarize-button"));
    expect(onSummarize).toHaveBeenCalled();
    expect(await screen.findByTestId("panel-summary-result")).toHaveTextContent("A breakout strategy.");
  });

  it("clicking Highlight risks calls onGenerateRiskHighlights and renders the honest result", async () => {
    const onGenerateRiskHighlights = vi.fn().mockResolvedValue({ text: "No stop-loss section is defined yet.", source: "template" });
    render(
      <StrategySummaryPanel
        onLoadMissingSections={noopMissing}
        onSummarize={vi.fn()}
        onSuggestImprovements={vi.fn()}
        onGenerateExecutiveSummary={vi.fn()}
        onGenerateLearningNotes={vi.fn()}
        onGenerateRiskHighlights={onGenerateRiskHighlights}
        onGenerateSetupChecklist={vi.fn()}
        onGenerateTradePrepChecklist={vi.fn()}
        onGenerateReviewQuestions={vi.fn()}
        testId="panel"
      />,
    );
    fireEvent.click(screen.getByTestId("panel-risk-highlights-button"));
    expect(onGenerateRiskHighlights).toHaveBeenCalled();
    expect(await screen.findByTestId("panel-risk-highlights-result")).toHaveTextContent("No stop-loss section is defined yet.");
  });
});

describe("StrategySummaryPanel — checklist actions wiring", () => {
  it("wires all 3 checklist-shaped generators through to their own StrategyChecklist instance", () => {
    render(
      <StrategySummaryPanel
        onLoadMissingSections={noopMissing}
        onSummarize={vi.fn()}
        onSuggestImprovements={vi.fn()}
        onGenerateExecutiveSummary={vi.fn()}
        onGenerateLearningNotes={vi.fn()}
        onGenerateRiskHighlights={vi.fn()}
        onGenerateSetupChecklist={vi.fn()}
        onGenerateTradePrepChecklist={vi.fn()}
        onGenerateReviewQuestions={vi.fn()}
        testId="panel"
      />,
    );
    expect(screen.getByTestId("panel-setup-checklist-generate")).toBeInTheDocument();
    expect(screen.getByTestId("panel-trade-prep-checklist-generate")).toBeInTheDocument();
    expect(screen.getByTestId("panel-review-questions-generate")).toBeInTheDocument();
  });
});

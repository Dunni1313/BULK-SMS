// v1.5.0 Sprint 10 — Institutional Trade Planner. Rendering/interaction
// coverage for the trade plan's AI actions panel — the deterministic
// missing-information strip (loaded once, never re-polled), the 6 prose
// narration actions (explicit, never auto-run, never recommending
// execution), and the 2 checklist-shaped actions (delegated to the
// existing, reused StrategyChecklist component — only wiring is asserted
// here), mirroring StrategySummaryPanel.test.tsx's own established
// pattern (Sprint 9).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradePlanSummary } from "./TradePlanSummary";

function noopMissing() {
  return Promise.resolve({ missing: [], present: [], completenessPct: 100 });
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    onLoadMissingInformation: noopMissing,
    onReview: vi.fn(),
    onSummarize: vi.fn(),
    onGenerateRiskHighlights: vi.fn(),
    onReviewRiskReward: vi.fn(),
    onGenerateExecutiveSummary: vi.fn(),
    onGeneratePreparationNotes: vi.fn(),
    onGeneratePreTradeChecklist: vi.fn(),
    onGenerateVerificationQuestions: vi.fn(),
    ...overrides,
  };
}

describe("TradePlanSummary — missing information strip", () => {
  it("loads missing information once on mount and shows the completeness banner when incomplete", async () => {
    const onLoadMissingInformation = vi.fn().mockResolvedValue({ missing: ["stop_loss", "entry_zone"], present: [], completenessPct: 40 });
    render(<TradePlanSummary {...baseProps({ onLoadMissingInformation, testId: "panel" })} testId="panel" />);
    expect(await screen.findByTestId("panel-completeness")).toHaveTextContent("40% complete");
    expect(onLoadMissingInformation).toHaveBeenCalledTimes(1);
  });

  it("hides the completeness banner once the plan is 100% complete", async () => {
    render(<TradePlanSummary {...baseProps()} testId="panel" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("panel-completeness")).not.toBeInTheDocument();
  });
});

describe("TradePlanSummary — narration actions", () => {
  it("none of the 6 narration actions is called automatically on mount", () => {
    const props = baseProps();
    render(<TradePlanSummary {...props} />);
    expect(props.onReview).not.toHaveBeenCalled();
    expect(props.onSummarize).not.toHaveBeenCalled();
    expect(props.onGenerateRiskHighlights).not.toHaveBeenCalled();
    expect(props.onReviewRiskReward).not.toHaveBeenCalled();
    expect(props.onGenerateExecutiveSummary).not.toHaveBeenCalled();
    expect(props.onGeneratePreparationNotes).not.toHaveBeenCalled();
  });

  it("clicking Review plan calls onReview and renders the honest result", async () => {
    const onReview = vi.fn().mockResolvedValue({ text: "This plan is missing a stop loss.", source: "template" });
    render(<TradePlanSummary {...baseProps({ onReview })} testId="panel" />);
    fireEvent.click(screen.getByTestId("panel-review-button"));
    expect(onReview).toHaveBeenCalled();
    expect(await screen.findByTestId("panel-review-result")).toHaveTextContent("This plan is missing a stop loss.");
  });

  it("clicking Summarise calls onSummarize and renders the honest result", async () => {
    const onSummarize = vi.fn().mockResolvedValue({ text: "A long plan on AAPL.", source: "template" });
    render(<TradePlanSummary {...baseProps({ onSummarize })} testId="panel" />);
    fireEvent.click(screen.getByTestId("panel-summarize-button"));
    expect(onSummarize).toHaveBeenCalled();
    expect(await screen.findByTestId("panel-summary-result")).toHaveTextContent("A long plan on AAPL.");
  });

  it("clicking Highlight risks calls onGenerateRiskHighlights and renders the honest result", async () => {
    const onGenerateRiskHighlights = vi.fn().mockResolvedValue({ text: "No stop loss is defined yet.", source: "template" });
    render(<TradePlanSummary {...baseProps({ onGenerateRiskHighlights })} testId="panel" />);
    fireEvent.click(screen.getByTestId("panel-risk-highlights-button"));
    expect(onGenerateRiskHighlights).toHaveBeenCalled();
    expect(await screen.findByTestId("panel-risk-highlights-result")).toHaveTextContent("No stop loss is defined yet.");
  });

  it("clicking Review risk/reward calls onReviewRiskReward and renders the honest result", async () => {
    const onReviewRiskReward = vi.fn().mockResolvedValue({ text: "Risk/reward cannot be assessed yet.", source: "template" });
    render(<TradePlanSummary {...baseProps({ onReviewRiskReward })} testId="panel" />);
    fireEvent.click(screen.getByTestId("panel-risk-reward-button"));
    expect(onReviewRiskReward).toHaveBeenCalled();
    expect(await screen.findByTestId("panel-risk-reward-result")).toHaveTextContent("Risk/reward cannot be assessed yet.");
  });
});

describe("TradePlanSummary — checklist actions wiring", () => {
  it("wires both checklist-shaped generators through to their own reused StrategyChecklist instance", () => {
    render(<TradePlanSummary {...baseProps()} testId="panel" />);
    expect(screen.getByTestId("panel-pre-trade-checklist-generate")).toBeInTheDocument();
    expect(screen.getByTestId("panel-verification-questions-generate")).toBeInTheDocument();
  });
});

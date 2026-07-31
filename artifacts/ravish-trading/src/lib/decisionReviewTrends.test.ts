// v1.5.0, Sprint 19 — Institutional Decision Quality & Review Engine.
// Direct unit coverage for trend/aggregate logic over already-computed
// DecisionReview objects — never a fabricated pattern from too little
// evidence.

import { describe, it, expect } from "vitest";
import { computeDecisionQualityTrends, computeRecurringPlaybookDeviations } from "./decisionReviewTrends";
import type { DecisionReview, DecisionReviewField, DecisionReviewFieldId } from "./decisionReview";

function field(id: DecisionReviewFieldId, confidence: number | null): DecisionReviewField {
  return { id, label: id, status: confidence === null ? "not-applicable" : confidence >= 80 ? "strong" : confidence >= 40 ? "adequate" : "weak", confidence, evidenceSummary: "x", evidenceHref: null };
}

function review(id: number, overrides: Partial<DecisionReview> = {}): DecisionReview {
  return {
    tradePlanId: id,
    tradePlanTitle: `Plan ${id}`,
    coachId: "trading",
    symbol: "AAPL",
    currentStage: "reviewed",
    executedAt: `2026-0${id}-01T00:00:00Z`,
    updatedAt: `2026-0${id}-05T00:00:00Z`,
    fields: [
      field("research-quality", 100),
      field("evidence-completeness", 100),
      field("alternative-scenarios", 100),
      field("risk-planning", 100),
      field("position-sizing", 100),
      field("execution-discipline", 100),
      field("journal-completeness", 100),
      field("post-trade-reflection", 100),
      field("strategy-alignment", 100),
      field("decision-rationale", 100),
      field("portfolio-impact", null),
    ],
    processQuality: { score: 100, label: "Excellent Process", componentFieldIds: [] },
    outcome: { state: "closed", realizedPnl: 100, unrealizedPnl: null, openRisk: null },
    playbookAdherence: [],
    learningEngaged: true,
    ...overrides,
  };
}

describe("computeDecisionQualityTrends", () => {
  it("honestly reports insufficient-data with fewer than 4 reviewed decisions", () => {
    const trends = computeDecisionQualityTrends([review(1), review(2), review(3)]);
    expect(trends.every((t) => t.direction === "insufficient-data")).toBe(true);
    expect(trends.every((t) => t.earlierAverage === null && t.laterAverage === null)).toBe(true);
  });

  it("detects a genuine improvement across the earlier vs. later half", () => {
    const reviews = [
      review(1, { fields: [field("research-quality", 20), field("evidence-completeness", 20), field("alternative-scenarios", 20)] }),
      review(2, { fields: [field("research-quality", 20), field("evidence-completeness", 20), field("alternative-scenarios", 20)] }),
      review(3, { fields: [field("research-quality", 90), field("evidence-completeness", 90), field("alternative-scenarios", 90)] }),
      review(4, { fields: [field("research-quality", 90), field("evidence-completeness", 90), field("alternative-scenarios", 90)] }),
    ];
    const trends = computeDecisionQualityTrends(reviews);
    const research = trends.find((t) => t.id === "research-discipline")!;
    expect(research.direction).toBe("improving");
    expect(research.earlierAverage).toBe(20);
    expect(research.laterAverage).toBe(90);
  });

  it("detects a genuine decline, never inflating a small dip into a false decline", () => {
    const improving = [
      review(1, { fields: [field("research-quality", 90)] }),
      review(2, { fields: [field("research-quality", 90)] }),
      review(3, { fields: [field("research-quality", 30)] }),
      review(4, { fields: [field("research-quality", 30)] }),
    ];
    const declining = computeDecisionQualityTrends(improving).find((t) => t.id === "research-discipline")!;
    expect(declining.direction).toBe("declining");

    const noisy = [
      review(1, { fields: [field("research-quality", 80)] }),
      review(2, { fields: [field("research-quality", 82)] }),
      review(3, { fields: [field("research-quality", 78)] }),
      review(4, { fields: [field("research-quality", 81)] }),
    ];
    const stable = computeDecisionQualityTrends(noisy).find((t) => t.id === "research-discipline")!;
    expect(stable.direction).toBe("stable");
  });

  it("every trend cites the exact decisions behind it — never a fabricated pattern with no evidence", () => {
    const reviews = [review(1), review(2), review(3), review(4)];
    const trends = computeDecisionQualityTrends(reviews);
    for (const t of trends) {
      expect(t.evidence).toHaveLength(4);
      expect(t.evidence.map((e) => e.tradePlanId)).toEqual([1, 2, 3, 4]);
    }
  });
});

describe("computeRecurringPlaybookDeviations", () => {
  it("never reports a single, one-off incomplete stage as 'recurring'", () => {
    const reviews = [review(1, { playbookAdherence: [{ playbookId: "trade-planning", playbookName: "Trade Planning", completedStages: 2, totalStages: 4, incompleteStageTitles: ["Run the Pre-Trade Checklist"] }] })];
    expect(computeRecurringPlaybookDeviations(reviews)).toHaveLength(0);
  });

  it("surfaces a genuinely repeated deviation across 2+ reviewed decisions, with the real decisions cited", () => {
    const reviews = [
      review(1, { playbookAdherence: [{ playbookId: "trade-planning", playbookName: "Trade Planning", completedStages: 2, totalStages: 4, incompleteStageTitles: ["Run the Pre-Trade Checklist"] }] }),
      review(2, { playbookAdherence: [{ playbookId: "trade-planning", playbookName: "Trade Planning", completedStages: 2, totalStages: 4, incompleteStageTitles: ["Run the Pre-Trade Checklist"] }] }),
    ];
    const deviations = computeRecurringPlaybookDeviations(reviews);
    expect(deviations).toHaveLength(1);
    expect(deviations[0].occurrenceCount).toBe(2);
    expect(deviations[0].tradePlanIds).toEqual([1, 2]);
  });

  it("never conflates two different playbooks' own stages sharing the same title text", () => {
    const reviews = [
      review(1, { playbookAdherence: [{ playbookId: "trade-planning", playbookName: "Trade Planning", completedStages: 2, totalStages: 4, incompleteStageTitles: ["Confirm Readiness"] }] }),
      review(2, { playbookAdherence: [{ playbookId: "execution-preparation", playbookName: "Execution Preparation", completedStages: 2, totalStages: 4, incompleteStageTitles: ["Confirm Readiness"] }] }),
    ];
    expect(computeRecurringPlaybookDeviations(reviews)).toHaveLength(0);
  });

  it("sorts by occurrence count, most frequent first", () => {
    const reviews = [
      review(1, { playbookAdherence: [{ playbookId: "trade-planning", playbookName: "Trade Planning", completedStages: 2, totalStages: 4, incompleteStageTitles: ["A"] }] }),
      review(2, { playbookAdherence: [{ playbookId: "trade-planning", playbookName: "Trade Planning", completedStages: 2, totalStages: 4, incompleteStageTitles: ["A", "B"] }] }),
      review(3, { playbookAdherence: [{ playbookId: "trade-planning", playbookName: "Trade Planning", completedStages: 2, totalStages: 4, incompleteStageTitles: ["A", "B"] }] }),
    ];
    const deviations = computeRecurringPlaybookDeviations(reviews);
    expect(deviations[0].stageTitle).toBe("A");
    expect(deviations[0].occurrenceCount).toBe(3);
    expect(deviations[1].stageTitle).toBe("B");
    expect(deviations[1].occurrenceCount).toBe(2);
  });
});

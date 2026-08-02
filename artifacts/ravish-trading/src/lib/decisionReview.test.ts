// v1.5.0, Sprint 19 — Institutional Decision Quality & Review Engine.
// Direct unit coverage for the one genuinely new piece of logic this
// sprint introduces — scoring a completed decision's own process quality
// against real, already-computed platform state. Every reused signal
// (DecisionStage confidence, TradeLifecycleRecord journal/performance
// status, PlaybookProgress) already has its own dedicated test suite
// elsewhere and is not re-tested here.

import { describe, it, expect } from "vitest";
import { computeDecisionReview, buildDecisionReviewCoachNarrative, type ComputeDecisionReviewInput } from "./decisionReview";
import type { DecisionStage } from "./decisionWorkflow";
import type { TradePlanDetail, TradePlanSection } from "./ai-coach/tradePlansApi";
import type { TradeLifecycleRecord } from "./tradeLifecycle";
import type { JournalEntry } from "@workspace/api-client-react";
import type { PlaybookProgress } from "./playbookProgress";
import { getPlaybook } from "./playbooks";

function section(kind: TradePlanSection["kind"], content: string | null): TradePlanSection {
  return { id: 1, tradePlanId: 42, kind, content, notebook: null, conversation: null, file: null, createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z" };
}

function tradePlan(overrides: Partial<TradePlanDetail> = {}): TradePlanDetail {
  return {
    id: 42,
    coachId: "trading",
    workspaceId: null,
    strategyId: null,
    title: "AAPL breakout",
    plannedAsset: "AAPL",
    assetClass: "equity",
    direction: "long",
    status: "executed",
    pinned: false,
    tags: ["AAPL"],
    currentVersion: 1,
    executedTradeRef: "500",
    executedAt: "2026-07-05T00:00:00Z",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-05T00:00:00Z",
    sections: [],
    versions: [],
    checklistItems: [],
    checklistProgress: { totalItems: 0, completedItems: 0, requiredItems: 0, completedRequiredItems: 0, progressPct: 0, readyForEntry: false },
    ...overrides,
  };
}

function stage(id: DecisionStage["id"], overrides: Partial<DecisionStage> = {}): DecisionStage {
  return { id, label: id, status: "complete", confidence: 100, missingInfo: [], recommendedAction: "Documented.", href: "/assistant", ...overrides };
}

function fullCoreStages(overrides: Partial<Record<DecisionStage["id"], Partial<DecisionStage>>> = {}): DecisionStage[] {
  const ids: DecisionStage["id"][] = ["research", "evidence", "thesis", "risk", "strategy", "tradePlan", "execution", "review", "portfolio"];
  return ids.map((id) => stage(id, overrides[id]));
}

function lifecycleRecord(overrides: Partial<TradeLifecycleRecord> = {}): TradeLifecycleRecord {
  return {
    tradePlan: { ...tradePlan() },
    outcome: "active",
    currentStage: "reviewed",
    previousStage: "journal-pending",
    nextStage: "archived",
    completionPct: 90,
    openRisk: 250,
    timeInTradeDays: 3,
    outstandingTasks: [],
    journalStatus: { state: "reviewed", label: "Reviewed — lesson learned recorded.", journalEntryId: 900 },
    performanceStatus: { state: "closed", unrealizedPnl: null, realizedPnl: 300 },
    learning: { engagedWithRecommendedLesson: true, recommendedPathKey: "trading-engine", recommendedTopicKey: "trading-risk-management", recommendedLabel: "Risk Management" },
    linkedExecution: {
      kind: "trading-position",
      status: "closed",
      openedAt: "2026-07-02T00:00:00Z",
      closedAt: "2026-07-05T00:00:00Z",
      symbol: "AAPL",
      quantity: 10,
      riskDollars: 250,
      unrealizedPnl: null,
      realizedPnl: 300,
      detailUnavailable: false,
    },
    canMarkExecuted: false,
    canArchive: true,
    blockedReasons: { markExecuted: null, archive: null },
    ...overrides,
  };
}

function journalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 900,
    tradeId: 500,
    title: "AAPL trade review",
    content: "Held the plan.",
    mood: "confident",
    lessonLearned: "Respect the stop.",
    thesis: "Breakout above resistance with volume confirmation.",
    entryReasoning: "Confirmed breakout on daily close.",
    tags: ["AAPL"],
    createdAt: "2026-07-05T00:00:00Z",
    ...overrides,
  } as JournalEntry;
}

function playbookProgress(playbookId: string, allComplete: boolean): PlaybookProgress {
  const playbook = getPlaybook(playbookId)!;
  const stages = playbook.stages.map((s) => ({ stage: s, status: (allComplete ? "complete" : "not-started") as const, detail: "x" }));
  return {
    playbook,
    boundEntityLabel: "AAPL breakout",
    stages,
    completedCount: allComplete ? stages.length : 0,
    totalCount: stages.length,
    progressPct: allComplete ? 100 : 0,
    blockedStages: [],
    recommendedNextStage: allComplete ? null : stages[0] ?? null,
    overallStatus: allComplete ? "complete" : "not-started",
  };
}

function baseInput(overrides: Partial<ComputeDecisionReviewInput> = {}): ComputeDecisionReviewInput {
  return {
    tradePlan: tradePlan(),
    coreStages: fullCoreStages(),
    record: lifecycleRecord(),
    journalEntry: journalEntry(),
    playbookProgresses: [playbookProgress("trade-planning", true), playbookProgress("post-trade-review", true)],
    ...overrides,
  };
}

describe("computeDecisionReview — eligibility", () => {
  it("honestly returns null when the plan was never executed — nothing to review yet", () => {
    const review = computeDecisionReview(baseInput({ record: lifecycleRecord({ linkedExecution: null }) }));
    expect(review).toBeNull();
  });

  it("computes a real review once the decision has genuinely been executed", () => {
    const review = computeDecisionReview(baseInput());
    expect(review).not.toBeNull();
    expect(review!.tradePlanId).toBe(42);
  });
});

describe("computeDecisionReview — direct reuse of Decision Engine stages", () => {
  it("reuses research/evidence/strategy/risk DecisionStage confidence directly, never re-scoring", () => {
    const coreStages = fullCoreStages({ research: { confidence: 40, status: "partial" }, evidence: { confidence: 0, status: "missing" } });
    const review = computeDecisionReview(baseInput({ coreStages }))!;
    const research = review.fields.find((f) => f.id === "research-quality")!;
    const evidence = review.fields.find((f) => f.id === "evidence-completeness")!;
    expect(research.confidence).toBe(40);
    expect(research.status).toBe("adequate");
    expect(evidence.confidence).toBe(0);
    expect(evidence.status).toBe("weak");
  });
});

describe("computeDecisionReview — the 4 genuinely new fields", () => {
  it("Alternative Scenarios Considered: reads the confirmation_rules section honestly, present vs. absent", () => {
    const withRules = computeDecisionReview(baseInput({ tradePlan: tradePlan({ sections: [section("confirmation_rules", "Break and hold above $190.")] }) }))!;
    expect(withRules.fields.find((f) => f.id === "alternative-scenarios")!.status).toBe("strong");

    const withoutRules = computeDecisionReview(baseInput({ tradePlan: tradePlan({ sections: [] }) }))!;
    expect(withoutRules.fields.find((f) => f.id === "alternative-scenarios")!.status).toBe("weak");
  });

  it("Position Sizing: reads the position_size_notes section honestly, present vs. absent", () => {
    const withNotes = computeDecisionReview(baseInput({ tradePlan: tradePlan({ sections: [section("position_size_notes", "1% risk, 100 shares.")] }) }))!;
    expect(withNotes.fields.find((f) => f.id === "position-sizing")!.status).toBe("strong");

    const withoutNotes = computeDecisionReview(baseInput({ tradePlan: tradePlan({ sections: [] }) }))!;
    expect(withoutNotes.fields.find((f) => f.id === "position-sizing")!.status).toBe("weak");
  });

  it("Decision Rationale: strong only when BOTH pre-trade thesis and post-trade journal rationale exist", () => {
    const both = computeDecisionReview(baseInput({ coreStages: fullCoreStages({ thesis: { confidence: 100 } }), journalEntry: journalEntry({ thesis: "x", entryReasoning: null }) }))!;
    expect(both.fields.find((f) => f.id === "decision-rationale")!.status).toBe("strong");

    const onlyPreTrade = computeDecisionReview(baseInput({ coreStages: fullCoreStages({ thesis: { confidence: 100 } }), journalEntry: journalEntry({ thesis: null, entryReasoning: null }) }))!;
    expect(onlyPreTrade.fields.find((f) => f.id === "decision-rationale")!.status).toBe("adequate");

    const neither = computeDecisionReview(baseInput({ coreStages: fullCoreStages({ thesis: { confidence: 0 } }), journalEntry: journalEntry({ thesis: null, entryReasoning: null }) }))!;
    expect(neither.fields.find((f) => f.id === "decision-rationale")!.status).toBe("weak");
  });

  it("Decision Rationale: never fabricates rationale when there's no journal entry at all", () => {
    const review = computeDecisionReview(baseInput({ coreStages: fullCoreStages({ thesis: { confidence: 0 } }), journalEntry: null }))!;
    expect(review.fields.find((f) => f.id === "decision-rationale")!.status).toBe("weak");
  });

  it("Execution Discipline: honestly not-applicable when no checklist template was ever applied", () => {
    const review = computeDecisionReview(
      baseInput({ tradePlan: tradePlan({ checklistProgress: { totalItems: 0, completedItems: 0, requiredItems: 0, completedRequiredItems: 0, progressPct: 0, readyForEntry: false } }) }),
    )!;
    const field = review.fields.find((f) => f.id === "execution-discipline")!;
    expect(field.status).toBe("not-applicable");
    expect(field.confidence).toBeNull();
  });

  it("Execution Discipline: reflects the real required-items-completed ratio", () => {
    const review = computeDecisionReview(
      baseInput({ tradePlan: tradePlan({ checklistProgress: { totalItems: 4, completedItems: 3, requiredItems: 4, completedRequiredItems: 2, progressPct: 75, readyForEntry: false } }) }),
    )!;
    const field = review.fields.find((f) => f.id === "execution-discipline")!;
    expect(field.confidence).toBe(50);
    expect(field.status).toBe("adequate");
  });
});

describe("computeDecisionReview — journal/reflection reuse TradeLifecycleRecord directly", () => {
  it("Journal Completeness and Post-Trade Reflection are honestly not-applicable before the trade is closed", () => {
    const review = computeDecisionReview(baseInput({ record: lifecycleRecord({ journalStatus: { state: "not-yet-applicable", label: "Not yet applicable — this trade isn't closed.", journalEntryId: null } }) }))!;
    expect(review.fields.find((f) => f.id === "journal-completeness")!.status).toBe("not-applicable");
    expect(review.fields.find((f) => f.id === "post-trade-reflection")!.status).toBe("not-applicable");
  });

  it("distinguishes 'journal logged but no lesson' from 'fully reflected' — two different fields, two different readings", () => {
    const review = computeDecisionReview(baseInput({ record: lifecycleRecord({ journalStatus: { state: "pending-reflection", label: "x", journalEntryId: 900 } }) }))!;
    expect(review.fields.find((f) => f.id === "journal-completeness")!.status).toBe("adequate");
    expect(review.fields.find((f) => f.id === "post-trade-reflection")!.status).toBe("weak");
  });
});

describe("computeDecisionReview — never rewards lucky outcomes, never punishes disciplined losses", () => {
  it("Portfolio Impact always carries a null confidence — excluded from process-quality scoring regardless of P&L", () => {
    const winner = computeDecisionReview(baseInput({ record: lifecycleRecord({ performanceStatus: { state: "closed", unrealizedPnl: null, realizedPnl: 5000 } }) }))!;
    const loser = computeDecisionReview(baseInput({ record: lifecycleRecord({ performanceStatus: { state: "closed", unrealizedPnl: null, realizedPnl: -5000 } }) }))!;
    expect(winner.fields.find((f) => f.id === "portfolio-impact")!.confidence).toBeNull();
    expect(loser.fields.find((f) => f.id === "portfolio-impact")!.confidence).toBeNull();
  });

  it("a disciplined, fully-documented process scores identically regardless of whether the trade won or lost", () => {
    const winner = computeDecisionReview(baseInput({ record: lifecycleRecord({ performanceStatus: { state: "closed", unrealizedPnl: null, realizedPnl: 5000 } }) }))!;
    const loser = computeDecisionReview(baseInput({ record: lifecycleRecord({ performanceStatus: { state: "closed", unrealizedPnl: null, realizedPnl: -5000 } }) }))!;
    expect(winner.processQuality.score).toBe(loser.processQuality.score);
  });
});

describe("computeDecisionReview — playbook adherence", () => {
  it("surfaces incomplete playbook stages honestly, never silently dropping a skipped one", () => {
    const review = computeDecisionReview(baseInput({ playbookProgresses: [playbookProgress("trade-planning", false)] }))!;
    expect(review.playbookAdherence[0].incompleteStageTitles.length).toBeGreaterThan(0);
  });

  it("reports zero incomplete stages when the playbook was genuinely followed in full", () => {
    const review = computeDecisionReview(baseInput({ playbookProgresses: [playbookProgress("trade-planning", true)] }))!;
    expect(review.playbookAdherence[0].incompleteStageTitles).toHaveLength(0);
  });
});

describe("buildDecisionReviewCoachNarrative — coaches, never judges", () => {
  it("never describes an actual process field using outcome/P&L language — only the meta coaching philosophy is allowed to mention it", () => {
    const review = computeDecisionReview(baseInput())!;
    const narrative = buildDecisionReviewCoachNarrative(review, null);
    // strongParts/weakParts/missedOpportunities describe THIS decision's own
    // process fields — none of them may ever be judged by P&L/outcome
    // language. institutionalBestPractice is deliberately excluded from
    // this check: it's the one place the coach explains WHY outcome is
    // never scored, and legitimately uses "won"/"lost" as the explanation.
    const fieldLevelText = JSON.stringify({ strongParts: narrative.strongParts, weakParts: narrative.weakParts, missedOpportunities: narrative.missedOpportunities }).toLowerCase();
    expect(fieldLevelText).not.toMatch(/\bwon\b|\blost\b|good trade|bad trade|realized p&l|unrealized p&l/);
  });

  it("honestly reports no recurring pattern when none was supplied", () => {
    const review = computeDecisionReview(baseInput())!;
    const narrative = buildDecisionReviewCoachNarrative(review, null);
    expect(narrative.recurringPatterns).toMatch(/not enough reviewed decisions/i);
  });

  it("surfaces a supplied recurring-pattern summary verbatim rather than inventing its own", () => {
    const review = computeDecisionReview(baseInput())!;
    const narrative = buildDecisionReviewCoachNarrative(review, "Position sizing has been skipped in 3 of your last 5 decisions.");
    expect(narrative.recurringPatterns).toBe("Position sizing has been skipped in 3 of your last 5 decisions.");
  });
});

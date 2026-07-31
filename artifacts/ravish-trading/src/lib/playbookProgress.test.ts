// v1.5.0, Sprint 18 — Institutional Playbooks & Operating Procedures Engine.
// Direct unit coverage for the one genuinely new piece of logic this
// sprint introduces — scoring lib/playbooks.ts's static content against
// real platform state. Every reused signal (lifecycle stage, health/risk)
// already has its own dedicated test suite elsewhere and is not
// re-tested here.

import { describe, it, expect } from "vitest";
import {
  computeStageStatus,
  computePlaybookProgress,
  computeAllPlaybooksProgress,
  currentPlaybook,
  recommendedNextPlaybook,
  buildPlaybookCoachNarrative,
  type PlaybookProgressContext,
} from "./playbookProgress";
import { getPlaybook, PLAYBOOKS } from "./playbooks";
import { playbookStageAckKey } from "./playbook-acknowledgements";
import type { TradeLifecycleRecord } from "./tradeLifecycle";
import type { AiStrategy } from "./ai-coach/strategiesApi";
import type { AiNotebook } from "./ai-coach/notebooksApi";
import type { PortfolioHealthScore, RiskIntelligenceReport, HealthFactor } from "./portfolioRiskIntelligence";
import type { JournalEntry } from "@workspace/api-client-react";
import { buildKnowledgeGraph, type KnowledgeGraph } from "./knowledgeGraph";

function emptyGraph(): KnowledgeGraph {
  return buildKnowledgeGraph({
    notebooks: [],
    strategies: [],
    lifecycleRecords: [],
    journalEntries: [],
    portfolioHealth: null,
    riskReport: null,
  });
}

function emptyContext(overrides: Partial<PlaybookProgressContext> = {}): PlaybookProgressContext {
  return {
    notebooksByCoach: {},
    strategiesByCoach: {},
    lifecycleRecords: [],
    portfolioHealth: null,
    portfolioRisk: null,
    weakestPortfolioFactor: null,
    journalEntries: [],
    learningPathsInProgress: 0,
    graph: emptyGraph(),
    manualAcks: new Set(),
    boundTradePlanId: null,
    ...overrides,
  };
}

function notebook(overrides: Partial<AiNotebook> = {}): AiNotebook {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "AAPL research",
    description: null,
    pinned: false,
    archived: false,
    tags: ["AAPL"],
    version: 1,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function strategy(overrides: Partial<AiStrategy> = {}): AiStrategy {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "Breakout momentum",
    description: null,
    strategyType: "momentum",
    assetClass: "equity",
    folder: null,
    status: "draft",
    pinned: false,
    archived: false,
    tags: [],
    currentVersion: 1,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function lifecycleRecord(overrides: Partial<TradeLifecycleRecord> = {}): TradeLifecycleRecord {
  return {
    tradePlan: {
      id: 42,
      coachId: "trading",
      workspaceId: null,
      strategyId: null,
      title: "AAPL breakout",
      plannedAsset: "AAPL",
      assetClass: "equity",
      direction: "long",
      status: "draft",
      pinned: false,
      tags: [],
      currentVersion: 1,
      executedTradeRef: null,
      executedAt: null,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-01T00:00:00Z",
    },
    outcome: "active",
    currentStage: "research",
    previousStage: null,
    nextStage: null,
    completionPct: 20,
    openRisk: null,
    timeInTradeDays: null,
    outstandingTasks: [],
    journalStatus: { state: "not-yet-applicable", label: "Not yet applicable — this trade isn't closed.", journalEntryId: null },
    performanceStatus: { state: "not-yet-applicable", unrealizedPnl: null, realizedPnl: null },
    learning: { engagedWithRecommendedLesson: false, recommendedPathKey: null, recommendedTopicKey: null, recommendedLabel: null },
    linkedExecution: null,
    canMarkExecuted: false,
    canArchive: false,
    blockedReasons: { markExecuted: null, archive: null },
    ...overrides,
  };
}

function healthScore(overrides: Partial<PortfolioHealthScore> = {}): PortfolioHealthScore {
  return { overall: 60, label: "Moderate", factors: [], confidenceLevel: "Moderate", generatedAt: "2026-07-30T00:00:00Z", ...overrides };
}

function riskReport(overrides: Partial<RiskIntelligenceReport> = {}): RiskIntelligenceReport {
  return { signals: [], generatedAt: "2026-07-30T00:00:00Z", ...overrides };
}

function journalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 900,
    tradeId: 500,
    title: "AAPL trade review",
    content: "Stopped out at plan.",
    mood: "confident",
    lessonLearned: "Respect the stop loss level.",
    tags: ["AAPL"],
    createdAt: new Date().toISOString(),
  } as JournalEntry;
}

describe("lib/playbooks.ts — content integrity", () => {
  it("declares exactly the 12 required playbooks", () => {
    expect(PLAYBOOKS).toHaveLength(12);
    const ids = PLAYBOOKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(12);
  });

  it("every playbook stage has a non-empty title, purpose, whyItMatters, moduleHref, and at least one required action", () => {
    for (const p of PLAYBOOKS) {
      for (const s of p.stages) {
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.purpose.length).toBeGreaterThan(0);
        expect(s.whyItMatters.length).toBeGreaterThan(0);
        expect(s.moduleHref.startsWith("/")).toBe(true);
        expect(s.requiredActions.length).toBeGreaterThan(0);
      }
    }
  });

  it("getPlaybook() resolves a real id and honestly returns null for an unknown one", () => {
    expect(getPlaybook("trade-planning")?.name).toBe("Trade Planning");
    expect(getPlaybook("not-a-real-playbook")).toBeNull();
  });
});

describe("computeStageStatus — entity-bound (trade-plan) playbooks", () => {
  it("reports not-started for every stage when no trade plan is bound", () => {
    const playbook = getPlaybook("trade-planning")!;
    for (const stage of playbook.stages) {
      const result = computeStageStatus(playbook, stage, emptyContext());
      expect(result.status).toBe("not-started");
    }
  });

  it("reports complete for a stage the bound record has already moved past", () => {
    const playbook = getPlaybook("trade-planning")!;
    const record = lifecycleRecord({ currentStage: "planning" });
    const ctx = emptyContext({ lifecycleRecords: [record], boundTradePlanId: record.tradePlan.id });
    const captureIdea = playbook.stages.find((s) => s.id === "capture-plan-idea")!;
    expect(computeStageStatus(playbook, captureIdea, ctx).status).toBe("complete");
  });

  it("reports in-progress for the stage the bound record currently sits at, with no outstanding tasks", () => {
    const playbook = getPlaybook("trade-planning")!;
    const record = lifecycleRecord({ currentStage: "planning", outstandingTasks: [] });
    const ctx = emptyContext({ lifecycleRecords: [record], boundTradePlanId: record.tradePlan.id });
    const riskStage = playbook.stages.find((s) => s.id === "set-risk-parameters")!;
    expect(computeStageStatus(playbook, riskStage, ctx).status).toBe("in-progress");
  });

  it("reports blocked (never a fabricated pass) for the stage the record is stuck at with real outstanding tasks", () => {
    const playbook = getPlaybook("trade-planning")!;
    const record = lifecycleRecord({ currentStage: "planning", outstandingTasks: ["Document a one-sentence thesis."] });
    const ctx = emptyContext({ lifecycleRecords: [record], boundTradePlanId: record.tradePlan.id });
    const riskStage = playbook.stages.find((s) => s.id === "set-risk-parameters")!;
    const result = computeStageStatus(playbook, riskStage, ctx);
    expect(result.status).toBe("blocked");
    expect(result.detail).toContain("Document a one-sentence thesis.");
  });

  it("reports not-started for a stage the bound record hasn't reached yet", () => {
    const playbook = getPlaybook("trade-planning")!;
    const record = lifecycleRecord({ currentStage: "ideas" });
    const ctx = emptyContext({ lifecycleRecords: [record], boundTradePlanId: record.tradePlan.id });
    const checklistStage = playbook.stages.find((s) => s.id === "run-checklist")!;
    expect(computeStageStatus(playbook, checklistStage, ctx).status).toBe("not-started");
  });

  it("treats an archived plan as having completed every earlier stage", () => {
    const playbook = getPlaybook("decision-review")!;
    const record = lifecycleRecord({ currentStage: "archived" });
    const ctx = emptyContext({ lifecycleRecords: [record], boundTradePlanId: record.tradePlan.id });
    for (const stage of playbook.stages) {
      expect(computeStageStatus(playbook, stage, ctx).status).toBe("complete");
    }
  });

  it("Trade Management's track-open-risk stage honestly distinguishes no-stop-yet from a real tracked figure", () => {
    const playbook = getPlaybook("trade-management")!;
    const trackStage = playbook.stages.find((s) => s.id === "track-open-risk")!;

    const noStop = lifecycleRecord({ currentStage: "open-position", openRisk: null });
    const ctxNoStop = emptyContext({ lifecycleRecords: [noStop], boundTradePlanId: noStop.tradePlan.id });
    expect(computeStageStatus(playbook, trackStage, ctxNoStop).status).toBe("in-progress");

    const withStop = lifecycleRecord({ currentStage: "open-position", openRisk: 250 });
    const ctxWithStop = emptyContext({ lifecycleRecords: [withStop], boundTradePlanId: withStop.tradePlan.id });
    const result = computeStageStatus(playbook, trackStage, ctxWithStop);
    expect(result.status).toBe("complete");
    expect(result.detail).toContain("250");
  });
});

describe("computeStageStatus — manual stages, honestly self-certified", () => {
  it("is not-started until acknowledged, and clearly discloses it isn't automatically verified", () => {
    const playbook = getPlaybook("trade-management")!;
    const manageStage = playbook.stages.find((s) => s.id === "manage-actively")!;
    expect(manageStage.signalType).toBe("manual");
    const result = computeStageStatus(playbook, manageStage, emptyContext());
    expect(result.status).toBe("not-started");
    expect(result.detail).toMatch(/not tracked automatically/i);
  });

  it("becomes complete once the exact playbookId:stageId key is acknowledged", () => {
    const playbook = getPlaybook("trade-management")!;
    const manageStage = playbook.stages.find((s) => s.id === "manage-actively")!;
    const acks = new Set([playbookStageAckKey(playbook.id, manageStage.id)]);
    const result = computeStageStatus(playbook, manageStage, emptyContext({ manualAcks: acks }));
    expect(result.status).toBe("complete");
    expect(result.detail).toMatch(/not automatically verified/i);
  });

  it("never bleeds an acknowledgement across two different stages", () => {
    const playbook = getPlaybook("trade-management")!;
    const manageStage = playbook.stages.find((s) => s.id === "manage-actively")!;
    const previewStage = playbook.stages.find((s) => s.id === "preview-adjustments")!;
    const acks = new Set([playbookStageAckKey(playbook.id, manageStage.id)]);
    expect(computeStageStatus(playbook, previewStage, emptyContext({ manualAcks: acks })).status).toBe("not-started");
  });
});

describe("computeStageStatus — aggregate playbooks", () => {
  it("Investment Research: capture-idea completes once any notebook exists across any coach", () => {
    const playbook = getPlaybook("investment-research")!;
    const captureStage = playbook.stages.find((s) => s.id === "capture-idea")!;
    expect(computeStageStatus(playbook, captureStage, emptyContext()).status).toBe("not-started");
    const ctx = emptyContext({ notebooksByCoach: { trading: [notebook()] } });
    expect(computeStageStatus(playbook, captureStage, ctx).status).toBe("complete");
  });

  it("Investment Research: document-evidence distinguishes an untagged notebook from a tagged one", () => {
    const playbook = getPlaybook("investment-research")!;
    const docStage = playbook.stages.find((s) => s.id === "document-evidence")!;
    const untagged = emptyContext({ notebooksByCoach: { trading: [notebook({ tags: [] })] } });
    expect(computeStageStatus(playbook, docStage, untagged).status).toBe("in-progress");
    const tagged = emptyContext({ notebooksByCoach: { trading: [notebook({ tags: ["AAPL"] })] } });
    expect(computeStageStatus(playbook, docStage, tagged).status).toBe("complete");
  });

  it("Strategy Development: never claims complete for a strategy stuck in draft", () => {
    const playbook = getPlaybook("strategy-development")!;
    const approveStage = playbook.stages.find((s) => s.id === "approve-strategy")!;
    const ctx = emptyContext({ strategiesByCoach: { trading: [strategy({ status: "draft" })] } });
    expect(computeStageStatus(playbook, approveStage, ctx).status).toBe("in-progress");
  });

  it("Strategy Development: reports complete once a strategy is genuinely active", () => {
    const playbook = getPlaybook("strategy-development")!;
    const approveStage = playbook.stages.find((s) => s.id === "approve-strategy")!;
    const ctx = emptyContext({ strategiesByCoach: { trading: [strategy({ status: "active" })] } });
    expect(computeStageStatus(playbook, approveStage, ctx).status).toBe("complete");
  });

  it("Portfolio Review: never fabricates a health reading for a brand-new user with Low confidence", () => {
    const playbook = getPlaybook("portfolio-review")!;
    const healthStage = playbook.stages.find((s) => s.id === "review-health-score")!;
    const ctx = emptyContext({ portfolioHealth: healthScore({ confidenceLevel: "Low" }) });
    expect(computeStageStatus(playbook, healthStage, ctx).status).toBe("not-started");
  });

  it("Portfolio Review: reports in-progress (needs attention) for an elevated-risk reading, complete for a healthy one", () => {
    const playbook = getPlaybook("portfolio-review")!;
    const healthStage = playbook.stages.find((s) => s.id === "review-health-score")!;
    const elevated = emptyContext({ portfolioHealth: healthScore({ label: "Elevated Risk", confidenceLevel: "Moderate" }) });
    expect(computeStageStatus(playbook, healthStage, elevated).status).toBe("in-progress");
    const healthy = emptyContext({ portfolioHealth: healthScore({ label: "Strong", confidenceLevel: "Moderate" }) });
    expect(computeStageStatus(playbook, healthStage, healthy).status).toBe("complete");
  });

  it("Risk Review: reads the real single-position-risk signal, never inventing one", () => {
    const playbook = getPlaybook("risk-review")!;
    const stage = playbook.stages.find((s) => s.id === "review-single-position-risk")!;
    expect(computeStageStatus(playbook, stage, emptyContext()).status).toBe("not-started");
    const breached = emptyContext({
      portfolioRisk: riskReport({ signals: [{ code: "single_position_risk", label: "Single-Position Risk", available: true, headline: "AAPL: 30%", detail: "AAPL is above the 25% single-position cap.", sourceModule: "x" }] }),
    });
    expect(computeStageStatus(playbook, stage, breached).status).toBe("in-progress");
    const fine = emptyContext({
      portfolioRisk: riskReport({ signals: [{ code: "single_position_risk", label: "Single-Position Risk", available: true, headline: "AAPL: 10%", detail: "Within limits.", sourceModule: "x" }] }),
    });
    expect(computeStageStatus(playbook, stage, fine).status).toBe("complete");
  });

  it("Weekly Investment Committee: honestly reports nothing to review for a brand-new user", () => {
    const playbook = getPlaybook("weekly-investment-committee")!;
    const stage = playbook.stages.find((s) => s.id === "review-pipeline")!;
    expect(computeStageStatus(playbook, stage, emptyContext()).status).toBe("not-started");
  });

  it("Quarterly Performance Review: review-patterns reuses discoverPatterns(), never a second formula", () => {
    const playbook = getPlaybook("quarterly-performance-review")!;
    const stage = playbook.stages.find((s) => s.id === "review-patterns")!;
    expect(computeStageStatus(playbook, stage, emptyContext()).status).toBe("not-started");
    const ctx = emptyContext({ journalEntries: [journalEntry()] });
    expect(computeStageStatus(playbook, stage, ctx).status).toBe("complete");
  });

  it("Quarterly Performance Review: review-learning-progress reflects real Learning Centre progress", () => {
    const playbook = getPlaybook("quarterly-performance-review")!;
    const stage = playbook.stages.find((s) => s.id === "review-learning-progress")!;
    expect(computeStageStatus(playbook, stage, emptyContext()).status).toBe("not-started");
    expect(computeStageStatus(playbook, stage, emptyContext({ learningPathsInProgress: 2 })).status).toBe("complete");
  });
});

describe("computePlaybookProgress", () => {
  it("computes an honest 0% for a completely untouched playbook", () => {
    const progress = computePlaybookProgress(getPlaybook("investment-research")!, emptyContext());
    expect(progress.completedCount).toBe(0);
    expect(progress.progressPct).toBe(0);
    expect(progress.overallStatus).toBe("not-started");
  });

  it("computes 100% and overallStatus complete once every stage is complete", () => {
    const playbook = getPlaybook("investment-research")!;
    const ctx = emptyContext({ notebooksByCoach: { trading: [notebook({ tags: ["AAPL"] })] }, manualAcks: new Set([playbookStageAckKey(playbook.id, "check-existing-knowledge")]) });
    const progress = computePlaybookProgress(playbook, ctx);
    expect(progress.completedCount).toBe(progress.totalCount);
    expect(progress.progressPct).toBe(100);
    expect(progress.overallStatus).toBe("complete");
  });

  it("surfaces the blocked stage and never silently drops it", () => {
    const playbook = getPlaybook("trade-planning")!;
    const record = lifecycleRecord({ currentStage: "planning", outstandingTasks: ["Document a one-sentence thesis."] });
    const ctx = emptyContext({ lifecycleRecords: [record], boundTradePlanId: record.tradePlan.id });
    const progress = computePlaybookProgress(playbook, ctx);
    expect(progress.blockedStages.length).toBeGreaterThan(0);
  });

  it("recommendedNextStage prefers a not-started/in-progress/blocked stage over a completed one", () => {
    const playbook = getPlaybook("trade-planning")!;
    const record = lifecycleRecord({ currentStage: "planning" });
    const ctx = emptyContext({ lifecycleRecords: [record], boundTradePlanId: record.tradePlan.id });
    const progress = computePlaybookProgress(playbook, ctx);
    expect(progress.recommendedNextStage?.status).not.toBe("complete");
  });

  it("carries the bound entity's own title only for trade-plan-bound playbooks", () => {
    const record = lifecycleRecord({ currentStage: "planning" });
    const boundCtx = emptyContext({ lifecycleRecords: [record], boundTradePlanId: record.tradePlan.id });
    const tradePlanProgress = computePlaybookProgress(getPlaybook("trade-planning")!, boundCtx);
    expect(tradePlanProgress.boundEntityLabel).toBe("AAPL breakout");
    const aggregateProgress = computePlaybookProgress(getPlaybook("investment-research")!, boundCtx);
    expect(aggregateProgress.boundEntityLabel).toBeNull();
  });
});

describe("computeAllPlaybooksProgress / currentPlaybook / recommendedNextPlaybook", () => {
  it("computes progress for all 12 playbooks", () => {
    expect(computeAllPlaybooksProgress(emptyContext())).toHaveLength(12);
  });

  it("currentPlaybook honestly returns null when nothing is in progress anywhere", () => {
    expect(currentPlaybook(computeAllPlaybooksProgress(emptyContext()))).toBeNull();
  });

  it("currentPlaybook picks the in-progress playbook furthest along (most completed stages)", () => {
    const ctx = emptyContext({ notebooksByCoach: { trading: [notebook({ tags: ["AAPL"] })] } });
    const progresses = computeAllPlaybooksProgress(ctx);
    const current = currentPlaybook(progresses);
    expect(current).not.toBeNull();
    expect(current!.overallStatus).toBe("in-progress");
  });

  it("recommendedNextPlaybook returns a genuinely not-started playbook, in the content's own declared order", () => {
    const next = recommendedNextPlaybook(computeAllPlaybooksProgress(emptyContext()));
    expect(next?.overallStatus).toBe("not-started");
    expect(next?.playbook.id).toBe(PLAYBOOKS[0].id);
  });
});

describe("buildPlaybookCoachNarrative — the AI Playbook Coach", () => {
  it("falls back to playbook-level guidance when no stage is selected, never inventing a step", () => {
    const playbook = getPlaybook("decision-review")!;
    const narrative = buildPlaybookCoachNarrative(playbook, null);
    expect(narrative.commonErrors).toEqual(playbook.commonMistakes);
    expect(narrative.relatedLessons).toEqual(playbook.relatedLearning);
  });

  it("surfaces the exact selected stage's own purpose/whyItMatters — never fabricated prose", () => {
    const playbook = getPlaybook("decision-review")!;
    const stage = playbook.stages[0];
    const narrative = buildPlaybookCoachNarrative(playbook, { stage, status: "in-progress", detail: "x" });
    expect(narrative.whyThisStageExists).toBe(stage.purpose);
    expect(narrative.professionalExpectations).toBe(stage.whyItMatters);
  });

  it("tells the user to stop and resolve the blocker when the stage is genuinely blocked", () => {
    const playbook = getPlaybook("decision-review")!;
    const stage = playbook.stages[0];
    const narrative = buildPlaybookCoachNarrative(playbook, { stage, status: "blocked", detail: "x" });
    expect(narrative.whenToStopAndReassess).toMatch(/blocked/i);
  });
});

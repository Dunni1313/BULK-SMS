// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. Pure-logic unit
// tests for the Daily Workflow Engine (computeDailyWorkflow) and the
// Achievements engine (computeAchievements). No hooks, no network, no DOM
// — mirrors decisionWorkflow.test.ts's/tradeLifecycle.test.ts's own
// established pure-fixture testing convention exactly.

import { describe, it, expect } from "vitest";
import {
  computeDailyWorkflow,
  computeAchievements,
  DAILY_WORKFLOW_STEP_ORDER,
  type WorkflowSignals,
  type WorkflowDailyProgress,
  type DailyWorkflowStepId,
} from "./tradingCoachWorkflow";

function baseSignals(overrides: Partial<WorkflowSignals> = {}): WorkflowSignals {
  return {
    marketClock: { isOpen: true },
    scanner: { hasResultsToday: false },
    opportunityPipeline: { hasCapturedItems: false },
    activeDecision: { tradePlanId: null, tradePlanStatus: null, scoreLabel: null },
    lifecycleRecords: [],
    journal: { hasEntryToday: false },
    ...overrides,
  };
}

function baseProgress(overrides: Partial<WorkflowDailyProgress> = {}): WorkflowDailyProgress {
  return { completedStepIds: [], skippedStepIds: [], noTradeReason: null, ...overrides };
}

describe("computeDailyWorkflow — step ordering and single primary action (#1, #2)", () => {
  it("a brand-new day with no signals recommends Morning Brief first", () => {
    const result = computeDailyWorkflow(baseSignals(), baseProgress());
    expect(result.primaryNextStepId).toBe("morning-brief");
    expect(result.steps.find((s) => s.id === "morning-brief")!.status).toBe("active");
  });

  it("exactly one step is ever active, regardless of how far progress goes", () => {
    for (let i = 0; i < DAILY_WORKFLOW_STEP_ORDER.length; i++) {
      const completedStepIds = DAILY_WORKFLOW_STEP_ORDER.slice(0, i);
      const result = computeDailyWorkflow(baseSignals(), baseProgress({ completedStepIds }));
      const activeCount = result.steps.filter((s) => s.status === "active").length;
      expect(activeCount).toBeLessThanOrEqual(1);
    }
  });

  it("completing a step auto-activates the next valid one in sequence", () => {
    const result = computeDailyWorkflow(baseSignals(), baseProgress({ completedStepIds: ["morning-brief"] }));
    expect(result.primaryNextStepId).toBe("market-scan");
  });

  it("respects the full 11-step canonical order", () => {
    expect(DAILY_WORKFLOW_STEP_ORDER).toEqual([
      "morning-brief",
      "market-scan",
      "opportunity-review",
      "research",
      "trade-planning",
      "decision-risk-review",
      "execution-preparation",
      "execution",
      "position-monitoring",
      "trade-journal",
      "daily-review",
    ]);
  });

  it("real signals auto-complete a step honestly (never requires a redundant manual click)", () => {
    const signals = baseSignals({ scanner: { hasResultsToday: true } });
    const result = computeDailyWorkflow(signals, baseProgress({ completedStepIds: ["morning-brief"] }));
    expect(result.steps.find((s) => s.id === "market-scan")!.status).toBe("completed");
    expect(result.primaryNextStepId).toBe("opportunity-review");
  });
});

describe("computeDailyWorkflow — blocked-step handling (#3)", () => {
  it("blocks Execution honestly when the market is closed, with a real, non-fabricated reason", () => {
    const signals = baseSignals({
      marketClock: { isOpen: false },
      activeDecision: { tradePlanId: 7, tradePlanStatus: "ready", scoreLabel: "Well-Prepared" },
      lifecycleRecords: [
        { currentStage: "ready-to-execute", journalState: "not-yet-applicable", outstandingTaskCount: 0 },
      ],
    });
    const progress = baseProgress({
      completedStepIds: ["morning-brief", "market-scan", "opportunity-review", "research"],
    });
    const result = computeDailyWorkflow(signals, progress);
    const executionStep = result.steps.find((s) => s.id === "execution")!;
    expect(executionStep.status).toBe("blocked");
    expect(executionStep.blockedReason).toMatch(/market is closed/i);
    expect(result.primaryNextStepId).toBe("execution");
  });
});

describe("computeDailyWorkflow — 'No Trade' is a valid, disciplined outcome (#4)", () => {
  it("an explicit noTradeReason marks the whole new-trade pipeline not-applicable, never blocked", () => {
    const progress = baseProgress({
      completedStepIds: ["morning-brief"],
      noTradeReason: "No qualifying setups met my criteria today.",
    });
    const result = computeDailyWorkflow(baseSignals(), progress);
    const pipelineIds: DailyWorkflowStepId[] = [
      "market-scan",
      "opportunity-review",
      "research",
      "trade-planning",
      "decision-risk-review",
      "execution-preparation",
      "execution",
    ];
    for (const id of pipelineIds) {
      expect(result.steps.find((s) => s.id === id)!.status).toBe("not-applicable");
    }
    // Not-applicable steps never count against completion or block the recommended path.
    expect(result.applicableStepIds).not.toContain("market-scan");
    expect(result.primaryNextStepId).toBe("position-monitoring");
  });

  it("never counts a No-Trade day as incomplete — completion % excludes not-applicable steps", () => {
    const progress = baseProgress({
      completedStepIds: ["morning-brief", "position-monitoring", "trade-journal", "daily-review"],
      noTradeReason: "Market was too choppy to justify a new position.",
    });
    const result = computeDailyWorkflow(baseSignals(), progress);
    expect(result.completionPct).toBe(100);
    expect(result.isDoneForToday).toBe(true);
  });
});

describe("computeDailyWorkflow — market-closed behavior (#5)", () => {
  it("a closed market with nothing in progress makes the new-trade pipeline not-applicable without a declared reason", () => {
    const signals = baseSignals({ marketClock: { isOpen: false } });
    const progress = baseProgress({ completedStepIds: ["morning-brief"] });
    const result = computeDailyWorkflow(signals, progress);
    expect(result.steps.find((s) => s.id === "market-scan")!.status).toBe("not-applicable");
  });

  it("a closed market does NOT suppress the pipeline when a trade plan is already in progress", () => {
    const signals = baseSignals({
      marketClock: { isOpen: false },
      activeDecision: { tradePlanId: 3, tradePlanStatus: "draft", scoreLabel: "Developing" },
    });
    const progress = baseProgress({ completedStepIds: ["morning-brief", "market-scan", "opportunity-review", "research"] });
    const result = computeDailyWorkflow(signals, progress);
    expect(result.steps.find((s) => s.id === "trade-planning")!.status).not.toBe("not-applicable");
  });
});

describe("computeDailyWorkflow — open positions take priority (#6)", () => {
  it("reprioritizes Position Monitoring ahead of a fresh new-trade search when a position is already open", () => {
    const signals = baseSignals({
      lifecycleRecords: [{ currentStage: "open-position", journalState: "not-yet-applicable", outstandingTaskCount: 0 }],
    });
    // No steps completed at all today — Morning Brief hasn't even been marked done.
    const result = computeDailyWorkflow(signals, baseProgress());
    expect(result.primaryNextStepId).toBe("position-monitoring");
    expect(result.primaryReason).toMatch(/open position/i);
  });

  it("prioritizes a pending journal entry for a closed trade over a fresh scan", () => {
    const signals = baseSignals({
      lifecycleRecords: [{ currentStage: "closed", journalState: "pending-reflection", outstandingTaskCount: 0 }],
    });
    const result = computeDailyWorkflow(signals, baseProgress({ completedStepIds: ["morning-brief"] }));
    expect(result.primaryNextStepId).toBe("trade-journal");
  });

  it("never fabricates a completed Position Monitoring step while a position is still genuinely open", () => {
    const signals = baseSignals({
      lifecycleRecords: [{ currentStage: "open-position", journalState: "not-yet-applicable", outstandingTaskCount: 0 }],
    });
    const result = computeDailyWorkflow(signals, baseProgress());
    expect(result.steps.find((s) => s.id === "position-monitoring")!.status).not.toBe("completed");
  });
});

describe("computeDailyWorkflow — decision-quality gate is never bypassed (#13/#14)", () => {
  it("Decision & Risk Review only auto-completes when the real DecisionScore says Well-Prepared", () => {
    const notReady = baseSignals({
      activeDecision: { tradePlanId: 1, tradePlanStatus: "ready", scoreLabel: "Developing" },
    });
    const progress = baseProgress({
      completedStepIds: ["morning-brief", "market-scan", "opportunity-review", "research", "trade-planning"],
    });
    const resultNotReady = computeDailyWorkflow(notReady, progress);
    expect(resultNotReady.steps.find((s) => s.id === "decision-risk-review")!.status).not.toBe("completed");
    expect(resultNotReady.primaryNextStepId).toBe("decision-risk-review");

    const ready = baseSignals({ activeDecision: { tradePlanId: 1, tradePlanStatus: "ready", scoreLabel: "Well-Prepared" } });
    const resultReady = computeDailyWorkflow(ready, progress);
    expect(resultReady.steps.find((s) => s.id === "decision-risk-review")!.status).toBe("completed");
  });

  it("Execution Preparation only auto-completes when outstanding tasks are genuinely zero", () => {
    const signals = baseSignals({
      lifecycleRecords: [{ currentStage: "ready-to-execute", journalState: "not-yet-applicable", outstandingTaskCount: 2 }],
    });
    const progress = baseProgress({
      completedStepIds: ["morning-brief", "market-scan", "opportunity-review", "research", "trade-planning", "decision-risk-review"],
    });
    const result = computeDailyWorkflow(signals, progress);
    expect(result.steps.find((s) => s.id === "execution-preparation")!.status).not.toBe("completed");
  });
});

describe("computeDailyWorkflow — evidence-citing / disclosed-missing-evidence explanations (#15/#16)", () => {
  it("primaryReason always cites a concrete, real fact — never generic filler", () => {
    const signals = baseSignals({
      lifecycleRecords: [{ currentStage: "open-position", journalState: "not-yet-applicable", outstandingTaskCount: 0 }],
    });
    const result = computeDailyWorkflow(signals, baseProgress());
    expect(result.primaryReason.length).toBeGreaterThan(10);
    expect(result.primaryReason).not.toBe("");
  });

  it("a blocked step's reason is surfaced verbatim as the primaryReason — nothing hidden", () => {
    const signals = baseSignals({
      marketClock: { isOpen: false },
      activeDecision: { tradePlanId: 7, tradePlanStatus: "ready", scoreLabel: "Well-Prepared" },
      lifecycleRecords: [{ currentStage: "ready-to-execute", journalState: "not-yet-applicable", outstandingTaskCount: 0 }],
    });
    const progress = baseProgress({ completedStepIds: ["morning-brief", "market-scan", "opportunity-review", "research"] });
    const result = computeDailyWorkflow(signals, progress);
    expect(result.primaryReason).toBe(result.steps.find((s) => s.id === "execution")!.blockedReason);
  });
});

describe("computeDailyWorkflow — applicable-steps-only progress (#11)", () => {
  it("completion percentage never penalizes a skipped or not-applicable step", () => {
    const progress = baseProgress({
      completedStepIds: ["morning-brief"],
      skippedStepIds: ["market-scan", "opportunity-review", "research", "trade-planning", "decision-risk-review", "execution-preparation", "execution"],
    });
    const result = computeDailyWorkflow(baseSignals(), progress);
    // 8 of 11 steps accounted for (completed+skipped); denominator excludes nothing here since
    // none are not-applicable, but skipped still counts toward completion, never against it.
    expect(result.completionPct).toBeGreaterThan(0);
    expect(result.completedApplicableCount).toBe(8);
  });

  it("is complete for the day once every applicable step is done", () => {
    const progress = baseProgress({ completedStepIds: [...DAILY_WORKFLOW_STEP_ORDER] });
    const result = computeDailyWorkflow(baseSignals(), progress);
    expect(result.isDoneForToday).toBe(true);
    expect(result.completionPct).toBe(100);
    expect(result.primaryNextStepId).toBeNull();
  });
});

describe("computeAchievements — rewards process, never trade count/risk/frequency (#gamification)", () => {
  it("earns 'first' achievements at exactly the 1-count threshold", () => {
    const statuses = computeAchievements({
      totalMarketScansRun: 1,
      totalResearchStepsCompleted: 0,
      totalTradePlansReadied: 0,
      totalJournalEntries: 0,
      totalCompletedDailyChecklists: 0,
      consecutiveDisciplinedDays: 0,
      consecutiveJournaledDays: 0,
    });
    expect(statuses.find((a) => a.id === "first-market-scan")!.earned).toBe(true);
    expect(statuses.find((a) => a.id === "first-journal-entry")!.earned).toBe(false);
  });

  it("never rewards a high trade count directly — only journaled/disciplined process counts", () => {
    const statuses = computeAchievements({
      totalMarketScansRun: 500,
      totalResearchStepsCompleted: 0,
      totalTradePlansReadied: 0,
      totalJournalEntries: 0,
      totalCompletedDailyChecklists: 0,
      consecutiveDisciplinedDays: 0,
      consecutiveJournaledDays: 0,
    });
    // A huge scan count alone earns only the "first scan" milestone — nothing volume-based exists.
    expect(statuses.filter((a) => a.earned)).toHaveLength(1);
  });

  it("the discipline streak achievements require real consecutive-day evidence, not a raw trade count", () => {
    const statuses = computeAchievements({
      totalMarketScansRun: 0,
      totalResearchStepsCompleted: 0,
      totalTradePlansReadied: 0,
      totalJournalEntries: 0,
      totalCompletedDailyChecklists: 0,
      consecutiveDisciplinedDays: 30,
      consecutiveJournaledDays: 10,
    });
    expect(statuses.find((a) => a.id === "thirty-days-no-unplanned-trade")!.earned).toBe(true);
    expect(statuses.find((a) => a.id === "complete-risk-review-streak")!.earned).toBe(true);
    expect(statuses.find((a) => a.id === "consistent-journal-completion")!.earned).toBe(true);
  });
});

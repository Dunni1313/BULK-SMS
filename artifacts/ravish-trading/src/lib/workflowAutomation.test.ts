// v1.5.0, Sprint 16 — Institutional Workflow Automation Engine. Direct
// unit coverage for the one genuinely new piece of logic this sprint
// introduces — the Task Engine's own trigger/status derivation. Every
// reused signal (lifecycle stage, health/risk, lesson tables) already has
// its own dedicated test suite elsewhere (tradeLifecycle.test.ts,
// portfolioRiskIntelligence.test.ts) and is not re-tested here.

import { describe, it, expect } from "vitest";
import {
  computeWorkflowTasks,
  applyDismissals,
  buildWorkflowCoachNarrative,
  AUTOMATIC_CONNECTIONS,
  type WorkflowAutomationInput,
  type WorkflowTask,
} from "./workflowAutomation";
import type { AiNotebook } from "./ai-coach/notebooksApi";
import type { AiStrategy } from "./ai-coach/strategiesApi";
import type { TradeLifecycleRecord } from "./tradeLifecycle";
import type { PortfolioHealthScore, RiskIntelligenceReport, HealthFactor } from "./portfolioRiskIntelligence";

function emptyInput(overrides: Partial<WorkflowAutomationInput> = {}): WorkflowAutomationInput {
  return {
    notebooksByCoach: {},
    strategiesByCoach: {},
    lifecycleRecords: [],
    portfolioHealth: null,
    portfolioRisk: null,
    weakestPortfolioFactor: null,
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
    tags: [],
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
    status: "active",
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
    tradePlan: { id: 1, coachId: "trading", workspaceId: null, strategyId: null, title: "AAPL breakout", plannedAsset: "AAPL", assetClass: "equity", direction: "long", status: "draft", pinned: false, tags: [], currentVersion: 1, executedTradeRef: null, executedAt: null, createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z" },
    outcome: "active",
    currentStage: "research",
    previousStage: null,
    nextStage: null,
    completionPct: 20,
    openRisk: null,
    timeInTradeDays: null,
    outstandingTasks: ["Document a one-sentence thesis."],
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

describe("computeWorkflowTasks", () => {
  it("recommends starting a Notebook when zero notebooks exist anywhere — an honest standing tip, not a fabricated event trigger", () => {
    const tasks = computeWorkflowTasks(emptyInput());
    const t = tasks.find((x) => x.automation === "research-to-notebook");
    expect(t).toBeDefined();
    expect(t!.status).toBe("pending");
  });

  it("never recommends starting a Notebook once at least one exists", () => {
    const tasks = computeWorkflowTasks(emptyInput({ notebooksByCoach: { trading: [notebook()] } }));
    expect(tasks.find((x) => x.automation === "research-to-notebook")).toBeUndefined();
  });

  it("suggests creating a Strategy when notebooks exist but no non-archived strategy exists for that coachId", () => {
    const tasks = computeWorkflowTasks(emptyInput({ notebooksByCoach: { trading: [notebook()] }, strategiesByCoach: { trading: [] } }));
    const t = tasks.find((x) => x.automation === "notebook-to-strategy");
    expect(t).toBeDefined();
    expect(t!.originatingModule).toBe("Notebook (Trading)");
  });

  it("never suggests a Strategy once a non-archived one exists for that coachId", () => {
    const tasks = computeWorkflowTasks(emptyInput({ notebooksByCoach: { trading: [notebook()] }, strategiesByCoach: { trading: [strategy()] } }));
    expect(tasks.find((x) => x.automation === "notebook-to-strategy")).toBeUndefined();
  });

  it("suggests building a Trade Plan from an approved (active) Strategy with no Trade Plan referencing it", () => {
    const tasks = computeWorkflowTasks(emptyInput({ strategiesByCoach: { trading: [strategy({ id: 7, title: "Breakout" })] } }));
    const t = tasks.find((x) => x.automation === "strategy-to-tradeplan");
    expect(t).toBeDefined();
    expect(t!.status).toBe("pending");
    expect(t!.title).toMatch(/Breakout/);
  });

  it("never suggests a Trade Plan for a draft (not yet approved) Strategy", () => {
    const tasks = computeWorkflowTasks(emptyInput({ strategiesByCoach: { trading: [strategy({ status: "draft" })] } }));
    expect(tasks.find((x) => x.automation === "strategy-to-tradeplan")).toBeUndefined();
  });

  it("marks strategy-to-tradeplan completed once a real Trade Plan references the strategy id, precisely — never a fabricated link", () => {
    const tasks = computeWorkflowTasks(
      emptyInput({
        strategiesByCoach: { trading: [strategy({ id: 7 })] },
        lifecycleRecords: [lifecycleRecord({ tradePlan: { ...lifecycleRecord().tradePlan, strategyId: 7, updatedAt: new Date().toISOString() } })],
      }),
    );
    const t = tasks.find((x) => x.automation === "strategy-to-tradeplan");
    expect(t!.status).toBe("completed");
  });

  it.each([
    ["ideas", "pending"],
    ["research", "in-progress"],
    ["planning", "in-progress"],
    ["decision-ready", "waiting"],
  ] as const)("classifies a trade plan at pipeline stage %s as %s for tradeplan-to-decision", (stage, expected) => {
    const tasks = computeWorkflowTasks(emptyInput({ lifecycleRecords: [lifecycleRecord({ currentStage: stage })] }));
    const t = tasks.find((x) => x.automation === "tradeplan-to-decision");
    expect(t!.status).toBe(expected);
  });

  it("never emits a tradeplan-to-decision task for an archived plan", () => {
    const tasks = computeWorkflowTasks(emptyInput({ lifecycleRecords: [lifecycleRecord({ currentStage: "archived" })] }));
    expect(tasks.find((x) => x.automation === "tradeplan-to-decision")).toBeUndefined();
  });

  it("surfaces a ready execution package once a plan reaches ready-to-execute", () => {
    const tasks = computeWorkflowTasks(emptyInput({ lifecycleRecords: [lifecycleRecord({ currentStage: "ready-to-execute" })] }));
    const t = tasks.find((x) => x.automation === "decision-to-execution");
    expect(t).toBeDefined();
    expect(t!.status).toBe("pending");
    expect(t!.actionHref).toBe("/execution-lifecycle");
  });

  it("recommends journaling a closed trade, pending, with no lesson recorded yet", () => {
    const tasks = computeWorkflowTasks(emptyInput({ lifecycleRecords: [lifecycleRecord({ currentStage: "closed" })] }));
    const t = tasks.find((x) => x.automation === "trade-closed-to-journal");
    expect(t!.status).toBe("pending");
  });

  it("marks the journal task in-progress once an entry exists but no lesson learned yet", () => {
    const tasks = computeWorkflowTasks(emptyInput({ lifecycleRecords: [lifecycleRecord({ currentStage: "journal-pending" })] }));
    const t = tasks.find((x) => x.automation === "trade-closed-to-journal");
    expect(t!.status).toBe("in-progress");
  });

  it("marks the journal task completed once reviewed recently, and honestly excludes it once outside the recency window", () => {
    const recent = computeWorkflowTasks(emptyInput({ lifecycleRecords: [lifecycleRecord({ currentStage: "reviewed", tradePlan: { ...lifecycleRecord().tradePlan, updatedAt: new Date().toISOString() } })] }));
    expect(recent.find((x) => x.automation === "trade-closed-to-journal")!.status).toBe("completed");

    const stale = computeWorkflowTasks(emptyInput({ lifecycleRecords: [lifecycleRecord({ currentStage: "reviewed", tradePlan: { ...lifecycleRecord().tradePlan, updatedAt: "2020-01-01T00:00:00Z" } })] }));
    expect(stale.find((x) => x.automation === "trade-closed-to-journal")).toBeUndefined();
  });

  it("recommends a portfolio review when the Health Score is elevated risk/poor with genuine confidence, never when confidence is Low (a brand-new, empty portfolio)", () => {
    const genuine = computeWorkflowTasks(emptyInput({ portfolioHealth: healthScore({ label: "Poor", overall: 20, confidenceLevel: "Moderate" }) }));
    expect(genuine.find((x) => x.automation === "portfolio-risk-to-review")).toBeDefined();

    const emptyPortfolio = computeWorkflowTasks(emptyInput({ portfolioHealth: healthScore({ label: "Poor", overall: 0, confidenceLevel: "Low" }) }));
    expect(emptyPortfolio.find((x) => x.automation === "portfolio-risk-to-review")).toBeUndefined();
  });

  it("never recommends a portfolio review for a healthy portfolio", () => {
    const tasks = computeWorkflowTasks(emptyInput({ portfolioHealth: healthScore({ label: "Excellent", overall: 90 }) }));
    expect(tasks.find((x) => x.automation === "portfolio-risk-to-review")).toBeUndefined();
  });

  it("recommends practice for a genuinely weak, lesson-mapped portfolio factor", () => {
    const weak: HealthFactor = { code: "open_risk", label: "Open Risk", score: 20, available: true, detail: "Too much open risk.", sourceModule: "x" };
    const tasks = computeWorkflowTasks(emptyInput({ weakestPortfolioFactor: weak }));
    const t = tasks.find((x) => x.automation === "learning-weakness-to-practice");
    expect(t).toBeDefined();
    expect(t!.relatedLesson).toEqual({ pathKey: "trading-engine", topicKey: "trading-risk-management", label: "Risk Management" });
  });

  it("never recommends practice for a factor scoring at or above the weakness threshold", () => {
    const ok: HealthFactor = { code: "open_risk", label: "Open Risk", score: 70, available: true, detail: "Fine.", sourceModule: "x" };
    const tasks = computeWorkflowTasks(emptyInput({ weakestPortfolioFactor: ok }));
    expect(tasks.find((x) => x.automation === "learning-weakness-to-practice")).toBeUndefined();
  });

  it("every emitted task carries all 4 transparency fields the approved scope requires — trigger, source module, reason, suggested outcome", () => {
    const tasks = computeWorkflowTasks(
      emptyInput({
        notebooksByCoach: { trading: [notebook()] },
        lifecycleRecords: [lifecycleRecord({ currentStage: "closed" })],
        portfolioHealth: healthScore({ label: "Poor", confidenceLevel: "Moderate" }),
      }),
    );
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      expect(t.trigger.length).toBeGreaterThan(0);
      expect(t.originatingModule.length).toBeGreaterThan(0);
      expect(t.reason.length).toBeGreaterThan(0);
      expect(t.suggestedOutcome.length).toBeGreaterThan(0);
    }
  });
});

describe("applyDismissals", () => {
  it("marks only the exact dismissed task id as dismissed, never a whole automation type", () => {
    const tasks: WorkflowTask[] = [
      { id: "trade-closed-to-journal:1", automation: "trade-closed-to-journal", title: "Journal A", status: "pending", originatingModule: "x", trigger: "x", reason: "x", suggestedOutcome: "x", actionHref: "/x", actionLabel: "x", relatedLesson: null, updatedAt: null },
      { id: "trade-closed-to-journal:2", automation: "trade-closed-to-journal", title: "Journal B", status: "pending", originatingModule: "x", trigger: "x", reason: "x", suggestedOutcome: "x", actionHref: "/x", actionLabel: "x", relatedLesson: null, updatedAt: null },
    ];
    const result = applyDismissals(tasks, new Set(["trade-closed-to-journal:1"]));
    expect(result.find((t) => t.id === "trade-closed-to-journal:1")!.status).toBe("dismissed");
    expect(result.find((t) => t.id === "trade-closed-to-journal:2")!.status).toBe("pending");
  });
});

describe("buildWorkflowCoachNarrative", () => {
  it("gives an honest 'nothing to ignore' explanation when no task is selected and no active tasks exist", () => {
    const narrative = buildWorkflowCoachNarrative(null, 0);
    expect(narrative.summary).toMatch(/No workflow recommendations/);
    expect(narrative.ifIgnored).toMatch(/nothing pending to ignore/i);
  });

  it("explains a waiting task's own named precondition, never claiming it will silently resolve itself", () => {
    const task: WorkflowTask = {
      id: "x",
      automation: "tradeplan-to-decision",
      title: "Advance X",
      status: "waiting",
      originatingModule: "Trade Plan",
      trigger: "x",
      reason: "x",
      suggestedOutcome: "Complete the checklist.",
      actionHref: "/x",
      actionLabel: "x",
      relatedLesson: null,
      updatedAt: null,
    };
    const narrative = buildWorkflowCoachNarrative(task, 1);
    expect(narrative.ifIgnored).toMatch(/blocked/i);
    expect(narrative.recommendedNextAction).toBe("Complete the checklist.");
  });
});

describe("AUTOMATIC_CONNECTIONS", () => {
  it("documents journal->performance and performance->portfolio as automatic, never fabricated as dismissible tasks", () => {
    expect(AUTOMATIC_CONNECTIONS.length).toBe(2);
    expect(AUTOMATIC_CONNECTIONS.some((c) => /journal/i.test(c.trigger))).toBe(true);
    expect(AUTOMATIC_CONNECTIONS.some((c) => /performance/i.test(c.trigger))).toBe(true);
  });
});

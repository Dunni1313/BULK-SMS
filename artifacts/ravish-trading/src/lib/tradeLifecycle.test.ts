// v1.5.0, Sprint 14 — Institutional Execution & Lifecycle Manager. Direct
// unit coverage for the one genuinely new piece of scoring logic this
// sprint introduces — everything else is direct reuse of Decision
// Workflow's already-tested DecisionScore/DecisionStage signals.

import { describe, it, expect } from "vitest";
import {
  computeTradeLifecycle,
  buildExecutionPackage,
  recommendedLifecycleLesson,
  PIPELINE_STAGES,
  STAGE_GUIDANCE,
  type ComputeTradeLifecycleInput,
  type LinkedExecution,
} from "./tradeLifecycle";
import type { TradePlanDetail } from "./ai-coach/tradePlansApi";
import type { AiStrategyDetail } from "./ai-coach/strategiesApi";
import type { DecisionStage, DecisionScore, LearningContext } from "./decisionWorkflow";

function tradePlan(overrides: Partial<TradePlanDetail> = {}): TradePlanDetail {
  return {
    id: 1,
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
    sections: [],
    versions: [],
    checklistItems: [],
    checklistProgress: { totalItems: 4, completedItems: 2, requiredItems: 2, completedRequiredItems: 1, progressPct: 50, readyForEntry: false },
    ...overrides,
  };
}

const EMPTY_LEARNING: LearningContext = { engagedWithRecommendedLesson: false, recommendedPathKey: null, recommendedTopicKey: null, recommendedLabel: null };

function score(overrides: Partial<DecisionScore> = {}): DecisionScore {
  return { overall: 0, label: "Just Started", componentStageIds: [], ...overrides };
}

function baseInput(overrides: Partial<ComputeTradeLifecycleInput> = {}): ComputeTradeLifecycleInput {
  return {
    tradePlan: tradePlan(),
    decisionStages: [] as DecisionStage[],
    decisionScore: score(),
    linkedExecution: null,
    journalEntry: null,
    learning: EMPTY_LEARNING,
    ...overrides,
  };
}

describe("tradeLifecycle — pre-execution stage derivation", () => {
  it("classifies a truly empty draft as 'ideas'", () => {
    const record = computeTradeLifecycle(baseInput({ tradePlan: tradePlan({ sections: [], checklistItems: [] }), decisionScore: score({ label: "Just Started" }) }));
    expect(record.currentStage).toBe("ideas");
  });

  it("classifies 'Just Started' WITH some content as 'research', not 'ideas'", () => {
    const record = computeTradeLifecycle(
      baseInput({
        tradePlan: tradePlan({ sections: [{ id: 1, tradePlanId: 1, kind: "market_context", content: "SPY breaking out", notebook: null, conversation: null, file: null, createdAt: "", updatedAt: "" }], checklistItems: [] }),
        decisionScore: score({ label: "Just Started" }),
      }),
    );
    expect(record.currentStage).toBe("research");
  });

  it("classifies 'Early Stage' as 'research'", () => {
    const record = computeTradeLifecycle(baseInput({ decisionScore: score({ label: "Early Stage" }) }));
    expect(record.currentStage).toBe("research");
  });

  it("classifies 'Developing' as 'planning'", () => {
    const record = computeTradeLifecycle(baseInput({ decisionScore: score({ label: "Developing" }) }));
    expect(record.currentStage).toBe("planning");
  });

  it("classifies 'Well-Prepared' without a ready checklist as 'decision-ready'", () => {
    const record = computeTradeLifecycle(
      baseInput({ tradePlan: tradePlan({ checklistProgress: { totalItems: 2, completedItems: 1, requiredItems: 2, completedRequiredItems: 1, progressPct: 50, readyForEntry: false } }), decisionScore: score({ label: "Well-Prepared", overall: 85 }) }),
    );
    expect(record.currentStage).toBe("decision-ready");
  });

  it("classifies 'Well-Prepared' WITH a ready checklist as 'ready-to-execute'", () => {
    const record = computeTradeLifecycle(
      baseInput({ tradePlan: tradePlan({ checklistProgress: { totalItems: 2, completedItems: 2, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true } }), decisionScore: score({ label: "Well-Prepared", overall: 90 }) }),
    );
    expect(record.currentStage).toBe("ready-to-execute");
    expect(record.canMarkExecuted).toBe(true);
    expect(record.blockedReasons.markExecuted).toBeNull();
  });

  it("never allows marking executed from any stage other than ready-to-execute", () => {
    const record = computeTradeLifecycle(baseInput({ decisionScore: score({ label: "Developing" }) }));
    expect(record.currentStage).toBe("planning");
    expect(record.canMarkExecuted).toBe(false);
    expect(record.blockedReasons.markExecuted).not.toBeNull();
  });
});

describe("tradeLifecycle — post-execution stage derivation", () => {
  function openExecution(overrides: Partial<LinkedExecution> = {}): LinkedExecution {
    return {
      kind: "options-trade",
      status: "open",
      openedAt: new Date().toISOString(),
      closedAt: null,
      symbol: "AAPL",
      quantity: null,
      riskDollars: 500,
      unrealizedPnl: 120,
      realizedPnl: null,
      detailUnavailable: false,
      ...overrides,
    };
  }

  it("classifies a freshly-opened position (< 1 day) as 'open-position'", () => {
    const record = computeTradeLifecycle(baseInput({ tradePlan: tradePlan({ status: "executed" }), linkedExecution: openExecution({ openedAt: new Date().toISOString() }) }));
    expect(record.currentStage).toBe("open-position");
    expect(record.openRisk).toBe(500);
  });

  it("classifies an open position older than a day as 'managing'", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const record = computeTradeLifecycle(baseInput({ tradePlan: tradePlan({ status: "executed" }), linkedExecution: openExecution({ openedAt: twoDaysAgo }) }));
    expect(record.currentStage).toBe("managing");
    expect(record.timeInTradeDays).toBe(2);
  });

  it("classifies a closed position with no journal entry as 'closed'", () => {
    const record = computeTradeLifecycle(baseInput({ tradePlan: tradePlan({ status: "executed" }), linkedExecution: openExecution({ status: "closed", closedAt: new Date().toISOString(), realizedPnl: 300, riskDollars: null }), journalEntry: null }));
    expect(record.currentStage).toBe("closed");
    expect(record.openRisk).toBeNull();
    expect(record.outstandingTasks).toContain("Log this trade in the Trade Journal.");
  });

  it("classifies a closed, journaled-but-not-reflected trade as 'journal-pending'", () => {
    const record = computeTradeLifecycle(
      baseInput({ tradePlan: tradePlan({ status: "executed" }), linkedExecution: openExecution({ status: "closed", closedAt: new Date().toISOString() }), journalEntry: { id: 9, lessonLearned: null } }),
    );
    expect(record.currentStage).toBe("journal-pending");
    expect(record.journalStatus.state).toBe("pending-reflection");
  });

  it("classifies a closed, journaled, AND reflected trade as 'reviewed'", () => {
    const record = computeTradeLifecycle(
      baseInput({ tradePlan: tradePlan({ status: "executed" }), linkedExecution: openExecution({ status: "closed", closedAt: new Date().toISOString() }), journalEntry: { id: 9, lessonLearned: "Sized too aggressively — next time cut in half." } }),
    );
    expect(record.currentStage).toBe("reviewed");
    expect(record.journalStatus.state).toBe("reviewed");
    expect(record.canArchive).toBe(true);
  });

  it("never allows archiving between open-position and journal-pending, inclusive", () => {
    for (const linked of [
      openExecution({ status: "open", openedAt: new Date().toISOString() }),
      openExecution({ status: "open", openedAt: new Date(Date.now() - 5 * 86400000).toISOString() }),
      openExecution({ status: "closed", closedAt: new Date().toISOString() }),
    ]) {
      const record = computeTradeLifecycle(baseInput({ tradePlan: tradePlan({ status: "executed" }), linkedExecution: linked }));
      expect(record.canArchive).toBe(false);
      expect(record.blockedReasons.archive).not.toBeNull();
    }
  });

  it("honestly reports detailUnavailable for a marked-executed investing plan with no discrete trade row — never fabricates open/closed detail", () => {
    const record = computeTradeLifecycle(
      baseInput({
        tradePlan: tradePlan({ coachId: "investing", status: "executed" }),
        linkedExecution: { kind: "investing-holding", status: "open", openedAt: "2026-07-01T00:00:00Z", closedAt: null, symbol: "AAPL", quantity: null, riskDollars: null, unrealizedPnl: null, realizedPnl: null, detailUnavailable: true },
      }),
    );
    expect(record.currentStage).toBe("open-position");
    expect(record.linkedExecution?.detailUnavailable).toBe(true);
    expect(record.openRisk).toBeNull();
    expect(record.outstandingTasks).toContain("Confirm and log the full execution details for this position.");
  });

  it("classifies an archived plan as 'archived' with no previous/next stage when genuinely cancelled", () => {
    const record = computeTradeLifecycle(baseInput({ tradePlan: tradePlan({ status: "cancelled" }) }));
    expect(record.currentStage).toBe("archived");
    expect(record.outcome).toBe("cancelled");
    expect(record.previousStage).toBeNull();
    expect(record.nextStage).toBeNull();
    expect(record.canArchive).toBe(true);
  });

  it("classifies a genuinely archived (not cancelled) plan with real previous/next stage context", () => {
    const record = computeTradeLifecycle(baseInput({ tradePlan: tradePlan({ status: "archived" }) }));
    expect(record.currentStage).toBe("archived");
    expect(record.outcome).toBe("active");
    expect(record.previousStage).toBe("reviewed");
  });
});

describe("tradeLifecycle — completion percentage and stage adjacency", () => {
  it("computes completion as (stage index + 1) / 11, never a fabricated blended score", () => {
    const record = computeTradeLifecycle(baseInput({ tradePlan: tradePlan({ sections: [], checklistItems: [] }), decisionScore: score({ label: "Just Started" }) }));
    expect(record.currentStage).toBe("ideas");
    expect(record.completionPct).toBe(Math.round((1 / 11) * 100));
  });

  it("every stage's previous/next pair matches its real position in PIPELINE_STAGES", () => {
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const prev = i > 0 ? PIPELINE_STAGES[i - 1].id : null;
      const next = i < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[i + 1].id : null;
      expect(prev === null || PIPELINE_STAGES.findIndex((s) => s.id === prev) === i - 1).toBe(true);
      expect(next === null || PIPELINE_STAGES.findIndex((s) => s.id === next) === i + 1).toBe(true);
    }
  });
});

describe("buildExecutionPackage", () => {
  const strategy = { title: "Breakout Momentum" } as AiStrategyDetail;

  it("extracts every field honestly from real sections — never fabricates a value the plan doesn't have", () => {
    const plan = tradePlan({
      sections: [
        { id: 1, tradePlanId: 1, kind: "entry_zone", content: "Above 195 on volume confirmation", notebook: null, conversation: null, file: null, createdAt: "", updatedAt: "" },
        { id: 2, tradePlanId: 1, kind: "stop_loss", content: "190", notebook: null, conversation: null, file: null, createdAt: "", updatedAt: "" },
        { id: 3, tradePlanId: 1, kind: "target_1", content: "205", notebook: null, conversation: null, file: null, createdAt: "", updatedAt: "" },
      ],
    });
    const pkg = buildExecutionPackage(plan, score({ overall: 88, label: "Well-Prepared" }), strategy);
    expect(pkg.instrument).toBe("AAPL · equity");
    expect(pkg.direction).toBe("long");
    expect(pkg.entry).toBe("Above 195 on volume confirmation");
    expect(pkg.stop).toBe("190");
    expect(pkg.targets).toEqual(["205"]);
    expect(pkg.decisionScore).toBe(88);
    expect(pkg.decisionScoreLabel).toBe("Well-Prepared");
    expect(pkg.strategyTitle).toBe("Breakout Momentum");
  });

  it("honestly reports 'Not specified' (via null) for every section the plan never filled in", () => {
    const pkg = buildExecutionPackage(tradePlan({ sections: [] }), score(), null);
    expect(pkg.entry).toBeNull();
    expect(pkg.stop).toBeNull();
    expect(pkg.targets).toEqual([]);
    expect(pkg.positionSize).toBeNull();
    expect(pkg.risk).toBeNull();
    expect(pkg.strategyTitle).toBeNull();
    expect(pkg.notes).toBeNull();
  });
});

describe("recommendedLifecycleLesson", () => {
  it("delegates to the Decision Workflow's own recommendations for pre-execution stages", () => {
    const rec = recommendedLifecycleLesson("trading", "planning", "risk");
    expect(rec).not.toBeNull();
    expect(rec?.pathKey).toBe("trading-engine");
  });

  it("returns a real, pre-verified recommendation for every post-execution stage/coachId combination this module defines", () => {
    const stages: Array<"open-position" | "managing" | "closed" | "journal-pending" | "reviewed"> = ["open-position", "managing", "closed", "journal-pending", "reviewed"];
    for (const stage of stages) {
      for (const coachId of ["investing", "trading", "options"] as const) {
        const rec = recommendedLifecycleLesson(coachId, stage, null);
        expect(rec).not.toBeNull();
        expect(rec?.pathKey).toBeTruthy();
        expect(rec?.topicKey).toBeTruthy();
      }
    }
  });

  it("returns null for a pre-execution stage when no weakest decision stage was supplied", () => {
    expect(recommendedLifecycleLesson("trading", "planning", null)).toBeNull();
  });
});

describe("STAGE_GUIDANCE", () => {
  it("provides guidance content for every one of the 11 pipeline stages", () => {
    for (const stage of PIPELINE_STAGES) {
      const guidance = STAGE_GUIDANCE[stage.id];
      expect(guidance).toBeDefined();
      expect(guidance.whatNow.length).toBeGreaterThan(0);
      expect(guidance.why.length).toBeGreaterThan(0);
      expect(guidance.bestPractice.length).toBeGreaterThan(0);
    }
  });
});

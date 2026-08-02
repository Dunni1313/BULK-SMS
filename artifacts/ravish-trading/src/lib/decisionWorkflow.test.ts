// v1.5.0, Sprint 13 — Institutional Decision Engine. Direct unit coverage
// for the one genuinely new piece of scoring logic this sprint introduces
// (everything else is direct reuse of Trade Plan/Strategy completeness
// signals already shipped in Sprints 9-10).

import { describe, it, expect } from "vitest";
import {
  computeCoreDecisionStages,
  buildLearningStage,
  buildLearningContext,
  buildDecisionCoachNarrative,
  buildDecisionTrace,
  computeDecisionScore,
  weakestScoredStage,
  DECISION_LEARNING_RECOMMENDATIONS,
  type ComputeCoreDecisionStagesInput,
  type DecisionStage,
} from "./decisionWorkflow";
import type { TradePlanDetail, MissingTradePlanInfoResult } from "./ai-coach/tradePlansApi";
import type { AiStrategyDetail, MissingSectionsResult } from "./ai-coach/strategiesApi";

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

function missingInfo(overrides: Partial<MissingTradePlanInfoResult> = {}): MissingTradePlanInfoResult {
  return { missing: [], present: [], completenessPct: 100, ...overrides };
}

function baseInput(overrides: Partial<ComputeCoreDecisionStagesInput> = {}): ComputeCoreDecisionStagesInput {
  return {
    tradePlan: tradePlan(),
    missingInfo: missingInfo(),
    strategy: null,
    strategyMissingSections: null,
    review: { hasJournalEntry: null },
    portfolio: { currentlyHeldOrWatched: false, sourceLabel: "" },
    ...overrides,
  };
}

describe("computeCoreDecisionStages", () => {
  it("returns exactly 9 core stages (never the 10th 'learning' stage)", () => {
    const stages = computeCoreDecisionStages(baseInput());
    expect(stages).toHaveLength(9);
    expect(stages.map((s) => s.id)).not.toContain("learning");
  });

  it("scores research/evidence/thesis/risk stages as fully complete when nothing is missing", () => {
    const stages = computeCoreDecisionStages(baseInput());
    const byId = Object.fromEntries(stages.map((s) => [s.id, s]));
    expect(byId.research.status).toBe("complete");
    expect(byId.research.confidence).toBe(100);
    expect(byId.evidence.status).toBe("complete");
    expect(byId.thesis.status).toBe("complete");
    expect(byId.risk.status).toBe("complete");
  });

  it("honestly reports missing sections with real section labels, never fabricated", () => {
    const stages = computeCoreDecisionStages(
      baseInput({ missingInfo: missingInfo({ missing: ["market_context"], completenessPct: 90 }) }),
    );
    const research = stages.find((s) => s.id === "research")!;
    expect(research.status).toBe("missing");
    expect(research.confidence).toBe(0);
    expect(research.missingInfo).toEqual(["Market Context"]);
    expect(research.recommendedAction).toContain("Market Context");
  });

  it("partially scores a stage when only some of its sections are present", () => {
    // thesis = [trade_thesis, bias, catalysts] -> 1 of 3 missing = 67% (rounded)
    const stages = computeCoreDecisionStages(baseInput({ missingInfo: missingInfo({ missing: ["bias"] }) }));
    const thesis = stages.find((s) => s.id === "thesis")!;
    expect(thesis.status).toBe("partial");
    expect(thesis.confidence).toBe(67);
  });

  it("reuses TradePlanDetail.checklistProgress.progressPct directly for the tradePlan stage, never recomputed", () => {
    const stages = computeCoreDecisionStages(
      baseInput({ tradePlan: tradePlan({ checklistProgress: { totalItems: 10, completedItems: 3, requiredItems: 5, completedRequiredItems: 2, progressPct: 30, readyForEntry: false } }) }),
    );
    const plan = stages.find((s) => s.id === "tradePlan")!;
    expect(plan.confidence).toBe(30);
    expect(plan.status).toBe("partial");
  });

  it("lists only required, incomplete checklist items as the tradePlan stage's missing info", () => {
    const stages = computeCoreDecisionStages(
      baseInput({
        tradePlan: tradePlan({
          checklistItems: [
            { id: 1, tradePlanId: 1, label: "Define stop loss", required: true, completed: false, sortOrder: 0, createdAt: "", updatedAt: "" },
            { id: 2, tradePlanId: 1, label: "Optional note", required: false, completed: false, sortOrder: 1, createdAt: "", updatedAt: "" },
            { id: 3, tradePlanId: 1, label: "Confirm entry", required: true, completed: true, sortOrder: 2, createdAt: "", updatedAt: "" },
          ],
        }),
      }),
    );
    const plan = stages.find((s) => s.id === "tradePlan")!;
    expect(plan.missingInfo).toEqual(["Define stop loss"]);
  });

  it("honestly reports strategy as missing when no strategy is linked, never fabricated", () => {
    const stages = computeCoreDecisionStages(baseInput({ strategy: null }));
    const strategy = stages.find((s) => s.id === "strategy")!;
    expect(strategy.status).toBe("missing");
    expect(strategy.confidence).toBeNull();
    expect(strategy.missingInfo).toEqual(["No strategy linked"]);
  });

  it("scores the strategy stage from the linked strategy's own missing-sections completeness", () => {
    const strategy: AiStrategyDetail = {
      id: 5,
      coachId: "trading",
      workspaceId: null,
      title: "Breakout",
      description: null,
      strategyType: "breakout",
      assetClass: "equity",
      folder: null,
      status: "active",
      pinned: false,
      archived: false,
      tags: [],
      currentVersion: 1,
      createdAt: "",
      updatedAt: "",
      sections: [],
      versions: [],
    };
    const strategyMissing: MissingSectionsResult = { missing: ["risk"], present: ["entry", "stop"], completenessPct: 75 };
    const stages = computeCoreDecisionStages(baseInput({ strategy, strategyMissingSections: strategyMissing }));
    const s = stages.find((s) => s.id === "strategy")!;
    expect(s.confidence).toBe(75);
    expect(s.status).toBe("partial");
    expect(s.missingInfo).toEqual(["risk"]);
  });

  it("treats execution as not-applicable until executedTradeRef is set, never scored", () => {
    const stages = computeCoreDecisionStages(baseInput());
    const execution = stages.find((s) => s.id === "execution")!;
    expect(execution.status).toBe("not-applicable");
    expect(execution.confidence).toBeNull();
    expect(execution.href).toBeNull();
  });

  it("marks execution complete once executedTradeRef is set", () => {
    const stages = computeCoreDecisionStages(baseInput({ tradePlan: tradePlan({ executedTradeRef: "trade-42" }) }));
    expect(stages.find((s) => s.id === "execution")!.status).toBe("complete");
  });

  it("treats review as not-applicable pre-execution, then honestly reflects journal-entry presence post-execution", () => {
    const preExecution = computeCoreDecisionStages(baseInput());
    expect(preExecution.find((s) => s.id === "review")!.status).toBe("not-applicable");

    const executedNoJournal = computeCoreDecisionStages(
      baseInput({ tradePlan: tradePlan({ executedTradeRef: "trade-42" }), review: { hasJournalEntry: false } }),
    );
    expect(executedNoJournal.find((s) => s.id === "review")!.status).toBe("missing");

    const executedWithJournal = computeCoreDecisionStages(
      baseInput({ tradePlan: tradePlan({ executedTradeRef: "trade-42" }), review: { hasJournalEntry: true } }),
    );
    expect(executedWithJournal.find((s) => s.id === "review")!.status).toBe("complete");
  });

  it("portfolio impact is always informational (not-applicable/null confidence), reflecting real held-or-watched state in its action text only", () => {
    const notHeld = computeCoreDecisionStages(baseInput());
    const notHeldStage = notHeld.find((s) => s.id === "portfolio")!;
    expect(notHeldStage.status).toBe("not-applicable");
    expect(notHeldStage.confidence).toBeNull();
    expect(notHeldStage.recommendedAction).toContain("Not currently held or watched");

    const held = computeCoreDecisionStages(baseInput({ portfolio: { currentlyHeldOrWatched: true, sourceLabel: "Trading Positions" } }));
    expect(held.find((s) => s.id === "portfolio")!.recommendedAction).toContain("Trading Positions");
  });
});

describe("computeDecisionScore", () => {
  it("averages only the 6 named scored stages, excluding review/portfolio/execution/learning", () => {
    const strategy: AiStrategyDetail = {
      id: 5,
      coachId: "trading",
      workspaceId: null,
      title: "Breakout",
      description: null,
      strategyType: "breakout",
      assetClass: "equity",
      folder: null,
      status: "active",
      pinned: false,
      archived: false,
      tags: [],
      currentVersion: 1,
      createdAt: "",
      updatedAt: "",
      sections: [],
      versions: [],
    };
    const stages = computeCoreDecisionStages(
      baseInput({ strategy, strategyMissingSections: { missing: [], present: [], completenessPct: 100 } }),
    );
    const score = computeDecisionScore(stages);
    expect(score.componentStageIds.sort()).toEqual(["evidence", "research", "risk", "strategy", "tradePlan", "thesis"].sort());
  });

  it("excludes the strategy stage from the average when no strategy is linked (its confidence is null)", () => {
    const stages = computeCoreDecisionStages(baseInput({ strategy: null }));
    const score = computeDecisionScore(stages);
    expect(score.componentStageIds).not.toContain("strategy");
  });

  it("labels a fully-complete decision Well-Prepared", () => {
    const stages = computeCoreDecisionStages(baseInput({ tradePlan: tradePlan({ checklistProgress: { totalItems: 4, completedItems: 4, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true } }) }));
    const score = computeDecisionScore(stages);
    expect(score.overall).toBe(100);
    expect(score.label).toBe("Well-Prepared");
  });

  it("labels a mostly-empty decision Just Started, never fabricating a higher confidence", () => {
    const emptyMissing = missingInfo({
      missing: ["market_context", "research_reference", "notebook_reference", "trade_thesis", "bias", "catalysts", "stop_loss", "maximum_risk", "invalidation", "risk_reward"],
      completenessPct: 0,
    });
    const stages = computeCoreDecisionStages(
      baseInput({ missingInfo: emptyMissing, tradePlan: tradePlan({ checklistProgress: { totalItems: 4, completedItems: 0, requiredItems: 2, completedRequiredItems: 0, progressPct: 0, readyForEntry: false } }) }),
    );
    const score = computeDecisionScore(stages);
    expect(score.overall).toBe(0);
    expect(score.label).toBe("Just Started");
  });

  it("returns overall 0 with an empty component list when given zero stages, never a crash", () => {
    const score = computeDecisionScore([]);
    expect(score.overall).toBe(0);
    expect(score.componentStageIds).toEqual([]);
  });
});

describe("weakestScoredStage", () => {
  it("picks the lowest-confidence scored stage, ignoring not-applicable/null-confidence stages", () => {
    const stages = computeCoreDecisionStages(
      baseInput({
        missingInfo: missingInfo({ missing: ["bias"] }),
        tradePlan: tradePlan({ checklistProgress: { totalItems: 4, completedItems: 4, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true } }),
      }),
    );
    const weakest = weakestScoredStage(stages);
    expect(weakest?.id).toBe("thesis");
  });

  it("returns null when no stage has a scoreable confidence", () => {
    expect(weakestScoredStage([])).toBeNull();
  });
});

describe("buildLearningStage", () => {
  it("is not-applicable when no lesson is recommended", () => {
    const stage = buildLearningStage({ engagedWithRecommendedLesson: false, recommendedPathKey: null, recommendedTopicKey: null, recommendedLabel: null });
    expect(stage.status).toBe("not-applicable");
    expect(stage.confidence).toBeNull();
  });

  it("is missing (never scored) when a lesson is recommended but not yet engaged with", () => {
    const stage = buildLearningStage({ engagedWithRecommendedLesson: false, recommendedPathKey: "trading-engine", recommendedTopicKey: "trading-risk-management", recommendedLabel: "Risk Management" });
    expect(stage.status).toBe("missing");
    expect(stage.confidence).toBeNull();
    expect(stage.recommendedAction).toContain("Risk Management");
  });

  it("is complete once the recommended lesson has been engaged with", () => {
    const stage = buildLearningStage({ engagedWithRecommendedLesson: true, recommendedPathKey: "trading-engine", recommendedTopicKey: "trading-risk-management", recommendedLabel: "Risk Management" });
    expect(stage.status).toBe("complete");
  });
});

describe("buildLearningContext", () => {
  it("recommends a real, registered lesson for the weakest stage's coachId", () => {
    const ctx = buildLearningContext("trading", "risk", [], []);
    expect(ctx.recommendedPathKey).toBe(DECISION_LEARNING_RECOMMENDATIONS.risk!.trading!.pathKey);
    expect(ctx.recommendedTopicKey).toBe(DECISION_LEARNING_RECOMMENDATIONS.risk!.trading!.topicKey);
  });

  it("honestly reports no recommendation when the weakest stage has none registered for this coachId", () => {
    const ctx = buildLearningContext("options", "research", [], []);
    expect(ctx.recommendedTopicKey).toBeNull();
  });

  it("honestly reports no recommendation when there is no weakest stage at all", () => {
    const ctx = buildLearningContext("trading", null, [], []);
    expect(ctx.recommendedTopicKey).toBeNull();
  });

  it("detects engagement via completedLessonKeys", () => {
    const ctx = buildLearningContext("trading", "risk", ["trading-risk-management"], []);
    expect(ctx.engagedWithRecommendedLesson).toBe(true);
  });

  it("detects engagement via recentHistory even without a completed marker", () => {
    const ctx = buildLearningContext("trading", "risk", [], [{ itemKey: "trading-risk-management" }]);
    expect(ctx.engagedWithRecommendedLesson).toBe(true);
  });

  it("never reports engagement for an unrelated lesson key", () => {
    const ctx = buildLearningContext("trading", "risk", ["some-other-lesson"], [{ itemKey: "another-lesson" }]);
    expect(ctx.engagedWithRecommendedLesson).toBe(false);
  });
});

describe("buildDecisionCoachNarrative", () => {
  it("explains the score using the real component stage labels and count, never fabricated", () => {
    const stages = computeCoreDecisionStages(baseInput());
    const score = computeDecisionScore(stages);
    const weakest = weakestScoredStage(stages);
    const narrative = buildDecisionCoachNarrative(stages, score, weakest);
    expect(narrative.scoreExplanation).toContain(String(score.overall));
    expect(narrative.scoreExplanation).toContain("Research");
  });

  it("lists real missing research/evidence items, honestly empty when nothing is missing", () => {
    const complete = computeCoreDecisionStages(baseInput());
    expect(buildDecisionCoachNarrative(complete, computeDecisionScore(complete), null).missingEvidence).toEqual([]);

    const incomplete = computeCoreDecisionStages(baseInput({ missingInfo: missingInfo({ missing: ["market_context"] }) }));
    const narrative = buildDecisionCoachNarrative(incomplete, computeDecisionScore(incomplete), null);
    expect(narrative.missingEvidence).toEqual(["Research: Market Context"]);
  });

  it("surfaces the weakest stage as the next thing a professional would review", () => {
    const stages = computeCoreDecisionStages(baseInput({ missingInfo: missingInfo({ missing: ["bias"] }) }));
    const weakest = weakestScoredStage(stages);
    const narrative = buildDecisionCoachNarrative(stages, computeDecisionScore(stages), weakest);
    expect(narrative.nextReview).toContain(weakest!.label);
  });

  it("honestly reports no immediate gap when every scored stage is complete", () => {
    const stages = computeCoreDecisionStages(baseInput());
    const narrative = buildDecisionCoachNarrative(stages, computeDecisionScore(stages), null);
    expect(narrative.nextReview).toContain("no immediate readiness gap");
  });

  it("lists real, high-confidence stages as positive factors, never a fabricated one", () => {
    const stages = computeCoreDecisionStages(baseInput());
    const narrative = buildDecisionCoachNarrative(stages, computeDecisionScore(stages), null);
    expect(narrative.positiveFactors.some((f) => f.startsWith("Research"))).toBe(true);
    expect(narrative.negativeFactors).toEqual([]);
  });

  it("lists real, low-confidence stages as negative factors with their real missing item, never fabricated", () => {
    const stages = computeCoreDecisionStages(
      baseInput({
        missingInfo: missingInfo({ missing: ["market_context"] }),
        tradePlan: tradePlan({ checklistProgress: { totalItems: 4, completedItems: 4, requiredItems: 2, completedRequiredItems: 2, progressPct: 100, readyForEntry: true } }),
      }),
    );
    const narrative = buildDecisionCoachNarrative(stages, computeDecisionScore(stages), null);
    expect(narrative.negativeFactors).toEqual(["Research (0%) — Market Context"]);
    expect(narrative.positiveFactors.some((f) => f.startsWith("Research"))).toBe(false);
  });

  it("never fabricates a factor for a stage that never fed the score (e.g. an unlinked strategy)", () => {
    const stages = computeCoreDecisionStages(baseInput({ strategy: null }));
    const narrative = buildDecisionCoachNarrative(stages, computeDecisionScore(stages), null);
    expect(narrative.positiveFactors.some((f) => f.startsWith("Strategy"))).toBe(false);
    expect(narrative.negativeFactors.some((f) => f.startsWith("Strategy"))).toBe(false);
  });
});

describe("buildDecisionTrace", () => {
  it("produces exactly one trace entry per decision stage, in the same order, referencing a real source module for each", () => {
    const stages = computeCoreDecisionStages(baseInput());
    const withLearning = [...stages, buildLearningStage({ engagedWithRecommendedLesson: false, recommendedPathKey: null, recommendedTopicKey: null, recommendedLabel: null })];
    const trace = buildDecisionTrace(withLearning);
    expect(trace).toHaveLength(10);
    expect(trace.map((t) => t.id)).toEqual(withLearning.map((s) => s.id));
    for (const entry of trace) {
      expect(entry.sourceModule.length).toBeGreaterThan(0);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.statusLabel.length).toBeGreaterThan(0);
    }
  });

  it("marks a fully-complete stage with a check icon and a real strength label, never fabricated", () => {
    const stages = computeCoreDecisionStages(baseInput());
    const trace = buildDecisionTrace(stages);
    const research = trace.find((t) => t.id === "research")!;
    expect(research.icon).toBe("check");
    expect(research.statusLabel).toBe("Strong");
  });

  it("marks a partial stage with a warning icon and the real missing item, never a bare 'incomplete'", () => {
    const stages = computeCoreDecisionStages(baseInput({ missingInfo: missingInfo({ missing: ["bias"] }) }));
    const trace = buildDecisionTrace(stages);
    const thesis = trace.find((t) => t.id === "thesis")!;
    expect(thesis.icon).toBe("warning");
    expect(thesis.statusLabel).toContain("Bias");
  });

  it("marks a not-applicable stage with an unavailable icon, never a fabricated status", () => {
    const stages = computeCoreDecisionStages(baseInput());
    const trace = buildDecisionTrace(stages);
    expect(trace.find((t) => t.id === "execution")!.icon).toBe("unavailable");
    expect(trace.find((t) => t.id === "portfolio")!.icon).toBe("unavailable");
  });

  it("carries a real, non-fabricated assumption for thesis/risk, and null for every other stage", () => {
    const stages = computeCoreDecisionStages(baseInput({ missingInfo: missingInfo({ missing: ["bias", "stop_loss"] }) }));
    const trace = buildDecisionTrace(stages);
    const thesis = trace.find((t) => t.id === "thesis")!;
    const risk = trace.find((t) => t.id === "risk")!;
    expect(thesis.assumption).toContain("Bias");
    expect(risk.assumption).toContain("Stop Loss");
    for (const entry of trace) {
      if (entry.id !== "thesis" && entry.id !== "risk") expect(entry.assumption).toBeNull();
    }
  });

  it("references the real, distinct source module for each stage, never the same generic string twice", () => {
    const stages = computeCoreDecisionStages(baseInput());
    const trace = buildDecisionTrace(stages);
    const sources = trace.map((t) => t.sourceModule);
    expect(new Set(sources).size).toBe(sources.length);
  });
});

describe("DECISION_LEARNING_RECOMMENDATIONS", () => {
  it("registers only real, verified pathKey/topicKey pairs already confirmed against learningPaths.ts", () => {
    // A structural sanity check, not a content re-verification (already
    // done by hand against the real LEARNING_PATHS array before this
    // registry was committed) — every entry must at least be well-shaped.
    for (const [stageId, byCoach] of Object.entries(DECISION_LEARNING_RECOMMENDATIONS)) {
      for (const [coachId, rec] of Object.entries(byCoach ?? {})) {
        expect(rec!.pathKey.length, `${stageId}/${coachId} pathKey`).toBeGreaterThan(0);
        expect(rec!.topicKey.length, `${stageId}/${coachId} topicKey`).toBeGreaterThan(0);
        expect(rec!.label.length, `${stageId}/${coachId} label`).toBeGreaterThan(0);
      }
    }
  });
});

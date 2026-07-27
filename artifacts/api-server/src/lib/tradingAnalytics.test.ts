// Phase 32 — Institutional Trading Analytics Engine. Pure unit tests over
// the aggregation engine's own math — every builder is a direct read,
// count, tally, or simple aggregate of already-provided rows. No database,
// no HTTP — see routes/tradingAnalytics.route.test.ts for the live
// persistence layer.

import { describe, it, expect } from "vitest";
import {
  buildOverview,
  buildStrategyUsageAnalytics,
  buildJournalAnalytics,
  buildRiskAnalytics,
  buildLearningAnalytics,
  buildCoachAnalytics,
  buildSessionAnalytics,
  buildStructureAnalytics,
  buildLiquidityAnalytics,
  buildChecklistAnalytics,
  buildTradingAnalyticsDashboard,
  type MinimalPositionRow,
  type MinimalTradePlanRow,
  type MinimalJournalRow,
  type MinimalWorkspaceNoteRow,
  type CoachProgressRow,
} from "./tradingAnalytics.js";
import type { StrategyMetadata, StrategyChecklistInstance } from "./tradingStrategyFramework.js";
import type { LearningProgressSummary } from "./learningProgress.js";

function strategy(overrides: Partial<StrategyMetadata> = {}): StrategyMetadata {
  return {
    id: 1,
    name: "Test Strategy",
    description: "A personally defined trade setup.",
    category: "trend",
    timeframes: ["1h"],
    markets: ["equities"],
    requiredEvidence: ["structure", "liquidity"],
    checklist: [
      { id: "a", label: "Reviewed structure", required: true },
      { id: "b", label: "Optional", required: false },
    ],
    educationalNotes: "",
    references: [],
    version: "1.0.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function checklist(overrides: Partial<StrategyChecklistInstance> = {}): StrategyChecklistInstance {
  return {
    id: 1,
    strategyId: 1,
    symbol: "AAPL",
    status: "in_progress",
    items: [
      { id: "a", label: "Reviewed structure", required: true, completed: true, notes: "", evidenceLinks: [{ sourceType: "structure", label: "x", detail: "y", url: null }] },
      { id: "b", label: "Optional", required: false, completed: false, notes: "", evidenceLinks: [] },
    ],
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function emptyQuizProgress() {
  return { attempts: [], bestByTopic: [], totalAttempts: 0, averagePercent: 0, streak: 0, improvement: 0, firstPercent: 0, latestPercent: 0 };
}

function emptyLearningProgress(): LearningProgressSummary {
  return {
    lessonsViewed: 0,
    lessonsCompleted: 0,
    glossaryTermsViewed: 0,
    strategiesViewed: 0,
    coachesViewed: 0,
    pathCompletion: [],
    greeksQuiz: emptyQuizProgress(),
    valueQuiz: emptyQuizProgress(),
    recentHistory: [],
    completedLessonKeys: [],
    completedGlossaryKeys: [],
    completedStrategyKeys: [],
    completedCoachKeys: [],
    completedKnowledgeCheckKeys: [],
    viewedStrategyKeys: [],
    bookmarks: [],
  };
}

describe("buildOverview", () => {
  it("directly counts each row array, excluding STRATEGY:<id> pseudo-symbol notes from workspaceNotes", () => {
    const notes: MinimalWorkspaceNoteRow[] = [{ symbol: "AAPL" }, { symbol: "STRATEGY:1" }, { symbol: "MSFT" }];
    const overview = buildOverview([], [], [], notes, [strategy()], [checklist()]);
    expect(overview.workspaceNotes).toBe(2);
    expect(overview.strategiesRegistered).toBe(1);
    expect(overview.checklistInstances).toBe(1);
    expect(overview.tradesReviewed).toBe(0);
    expect(overview.plansCreated).toBe(0);
    expect(overview.journalEntries).toBe(0);
    expect(typeof overview.generatedAt).toBe("string");
  });

  it("honestly reports all zeros for a brand-new user with no data", () => {
    const overview = buildOverview([], [], [], [], [], []);
    expect(overview).toMatchObject({
      tradesReviewed: 0,
      plansCreated: 0,
      journalEntries: 0,
      workspaceNotes: 0,
      strategiesRegistered: 0,
      checklistInstances: 0,
    });
  });
});

describe("buildStrategyUsageAnalytics", () => {
  it("tallies required evidence and attached evidence links by type, never fabricating a count for a type never cited", () => {
    const usage = buildStrategyUsageAnalytics([strategy({ requiredEvidence: ["structure", "liquidity"] })], [checklist()]);
    expect(usage.requiredEvidenceByType.structure).toBe(1);
    expect(usage.requiredEvidenceByType.liquidity).toBe(1);
    expect(usage.requiredEvidenceByType.session).toBe(0);
    expect(usage.evidenceLinksAttachedByType.structure).toBe(1);
    expect(usage.evidenceLinksAttachedByType.journal).toBe(0);
  });

  it("computes overall checklist completion by reusing computeChecklistCompletion(), never a second formula", () => {
    // The fixture checklist has 1 required item complete, 1 optional incomplete -> 50%.
    // checklistsComplete counts strictly by the instance's own persisted status field
    // (see the dedicated test below), independent of the live item-completion math here.
    const usage = buildStrategyUsageAnalytics([strategy()], [checklist()]);
    expect(usage.overallChecklistCompletionPct).toBe(50);
    expect(usage.checklistsComplete).toBe(0);
  });

  it("honestly reports 0% completion, not NaN, when there are no checklist instances", () => {
    const usage = buildStrategyUsageAnalytics([strategy()], []);
    expect(usage.overallChecklistCompletionPct).toBe(0);
    expect(usage.checklistsComplete).toBe(0);
    expect(usage.checklistsInProgress).toBe(0);
  });

  it("counts checklistsComplete strictly by the instance's own persisted status field", () => {
    const complete = checklist({ id: 2, status: "complete" });
    const inProgress = checklist({ id: 3, status: "in_progress" });
    const usage = buildStrategyUsageAnalytics([strategy()], [complete, inProgress]);
    expect(usage.checklistsComplete).toBe(1);
    expect(usage.checklistsInProgress).toBe(1);
  });
});

describe("buildJournalAnalytics", () => {
  function entry(overrides: Partial<MinimalJournalRow> = {}): MinimalJournalRow {
    return { mood: "neutral", setupType: null, lessonLearned: null, rMultiple: null, ...overrides };
  }

  it("tallies mood and setup type, honestly excluding null setupType from the tally", () => {
    const analytics = buildJournalAnalytics([
      entry({ mood: "confident", setupType: "breakout" }),
      entry({ mood: "confident", setupType: null }),
      entry({ mood: "anxious", setupType: "breakout" }),
    ]);
    expect(analytics.moodTally).toEqual({ confident: 2, anxious: 1 });
    expect(analytics.setupTypeTally).toEqual({ breakout: 2 });
  });

  it("counts a lesson as recorded only when non-empty after trimming", () => {
    const analytics = buildJournalAnalytics([
      entry({ lessonLearned: "Learned something." }),
      entry({ lessonLearned: "   " }),
      entry({ lessonLearned: null }),
    ]);
    expect(analytics.lessonRecordedCount).toBe(1);
    expect(analytics.lessonRecordedPct).toBeCloseTo(33.3, 1);
  });

  it("computes averageRMultiple only over entries that actually recorded one, honestly null when none did", () => {
    const withNone = buildJournalAnalytics([entry(), entry()]);
    expect(withNone.averageRMultiple).toBeNull();
    expect(withNone.rMultipleEntriesCount).toBe(0);

    const withSome = buildJournalAnalytics([entry({ rMultiple: 2 }), entry({ rMultiple: -1 }), entry()]);
    expect(withSome.averageRMultiple).toBe(0.5);
    expect(withSome.rMultipleEntriesCount).toBe(2);
  });

  it("buckets rMultiple values into the fixed 5 named ranges", () => {
    const analytics = buildJournalAnalytics([
      entry({ rMultiple: -2 }), // < -1R
      entry({ rMultiple: -0.5 }), // -1R to 0R
      entry({ rMultiple: 0.5 }), // 0R to 1R
      entry({ rMultiple: 1.5 }), // 1R to 2R
      entry({ rMultiple: 3 }), // > 2R
    ]);
    const counts = Object.fromEntries(analytics.rMultipleDistribution.map((b) => [b.label, b.count]));
    expect(counts).toEqual({ "< -1R": 1, "-1R to 0R": 1, "0R to 1R": 1, "1R to 2R": 1, "> 2R": 1 });
  });

  it("honestly reports zero entries and 0% lessonRecordedPct for no journal entries at all", () => {
    const analytics = buildJournalAnalytics([]);
    expect(analytics.entryCount).toBe(0);
    expect(analytics.lessonRecordedPct).toBe(0);
    expect(analytics.averageRMultiple).toBeNull();
  });
});

describe("buildRiskAnalytics", () => {
  function plan(overrides: Partial<MinimalTradePlanRow> = {}): MinimalTradePlanRow {
    return { accountRiskPct: 1, riskRewardRatio: null, positionSize: null, ...overrides };
  }
  function position(overrides: Partial<MinimalPositionRow> = {}): MinimalPositionRow {
    return { entryDate: new Date(), stopPrice: null, targetPrice: null, ...overrides };
  }

  it("averages accountRiskPct and riskRewardRatio only over plans that actually recorded them", () => {
    const risk = buildRiskAnalytics(
      [plan({ accountRiskPct: 1, riskRewardRatio: 2 }), plan({ accountRiskPct: 3, riskRewardRatio: null })],
      [],
    );
    expect(risk.averageAccountRiskPct).toBe(2);
    expect(risk.averageRiskRewardRatio).toBe(2);
  });

  it("honestly reports null averages when no plan exists", () => {
    const risk = buildRiskAnalytics([], []);
    expect(risk.averageAccountRiskPct).toBeNull();
    expect(risk.averageRiskRewardRatio).toBeNull();
  });

  it("counts stop/target discipline directly from real position fields, never fabricating a default", () => {
    const risk = buildRiskAnalytics(
      [],
      [
        position({ stopPrice: 90, targetPrice: 110 }),
        position({ stopPrice: null, targetPrice: null }),
        position({ stopPrice: 90, targetPrice: null }),
      ],
    );
    expect(risk.positionsWithBothStopAndTarget).toBe(1);
    expect(risk.positionsWithNeitherStopNorTarget).toBe(1);
    expect(risk.openPositionsCount).toBe(3);
    expect(risk.stopTargetDisciplinePct).toBeCloseTo(33.3, 1);
  });

  it("buckets riskRewardRatio into the fixed 4 named ranges", () => {
    const risk = buildRiskAnalytics(
      [plan({ riskRewardRatio: 0.5 }), plan({ riskRewardRatio: 1.5 }), plan({ riskRewardRatio: 2.5 }), plan({ riskRewardRatio: 4 })],
      [],
    );
    const counts = Object.fromEntries(risk.riskRewardDistribution.map((b) => [b.label, b.count]));
    expect(counts).toEqual({ "< 1:1": 1, "1:1 to 2:1": 1, "2:1 to 3:1": 1, "> 3:1": 1 });
  });
});

describe("buildLearningAnalytics", () => {
  it("is a pure reformatting of getLearningProgress()'s own already-computed summary — no recomputation", () => {
    const progress = { ...emptyLearningProgress(), lessonsViewed: 5, lessonsCompleted: 2, glossaryTermsViewed: 3, strategiesViewed: 1, coachesViewed: 4 };
    const analytics = buildLearningAnalytics(progress);
    expect(analytics.lessonsViewed).toBe(5);
    expect(analytics.lessonsCompleted).toBe(2);
    expect(analytics.glossaryTermsViewed).toBe(3);
    expect(analytics.strategiesViewed).toBe(1);
    expect(analytics.coachesViewed).toBe(4);
  });

  it("sums totalTopics/completedTopics across all learning paths", () => {
    const progress = {
      ...emptyLearningProgress(),
      pathCompletion: [
        { pathKey: "a", title: "A", topicsTotal: 4, topicsCompleted: 4, percentComplete: 100 },
        { pathKey: "b", title: "B", topicsTotal: 6, topicsCompleted: 1, percentComplete: 16.7 },
      ],
    };
    const analytics = buildLearningAnalytics(progress);
    expect(analytics.totalTopics).toBe(10);
    expect(analytics.completedTopics).toBe(5);
    expect(analytics.remainingTopics).toBe(5);
  });

  it("surfaces only paths below the weak-topic threshold, sorted lowest-first — never a prediction", () => {
    const progress = {
      ...emptyLearningProgress(),
      pathCompletion: [
        { pathKey: "strong", title: "Strong Path", topicsTotal: 4, topicsCompleted: 4, percentComplete: 100 },
        { pathKey: "weakest", title: "Weakest Path", topicsTotal: 4, topicsCompleted: 0, percentComplete: 0 },
        { pathKey: "weak", title: "Weak Path", topicsTotal: 4, topicsCompleted: 1, percentComplete: 25 },
      ],
    };
    const analytics = buildLearningAnalytics(progress);
    expect(analytics.weakestPaths.map((p) => p.pathKey)).toEqual(["weakest", "weak"]);
  });

  it("excludes a path with zero total topics from weakestPaths (nothing to be weak at)", () => {
    const progress = {
      ...emptyLearningProgress(),
      pathCompletion: [{ pathKey: "empty", title: "Empty", topicsTotal: 0, topicsCompleted: 0, percentComplete: 0 }],
    };
    const analytics = buildLearningAnalytics(progress);
    expect(analytics.weakestPaths).toHaveLength(0);
  });
});

describe("buildCoachAnalytics", () => {
  function row(itemKey: string, viewedAt: string): CoachProgressRow {
    return { itemKey, viewedAt };
  }

  it("parses the persisted '<coachType>:<scope>' itemKey format, never a new tracking mechanism", () => {
    const analytics = buildCoachAnalytics([
      row("structure:AAPL", "2026-01-01T00:00:00.000Z"),
      row("journal:account", "2026-01-02T00:00:00.000Z"),
      row("structure:MSFT", "2026-01-03T00:00:00.000Z"),
    ]);
    expect(analytics.totalCoachViews).toBe(3);
    const structureRow = analytics.byType.find((r) => r.coach === "structure")!;
    expect(structureRow.viewCount).toBe(2);
    const journalRow = analytics.byType.find((r) => r.coach === "journal")!;
    expect(journalRow.viewCount).toBe(1);
  });

  it("zero-fills every coach type never used, rather than omitting it", () => {
    const analytics = buildCoachAnalytics([row("structure:AAPL", "2026-01-01T00:00:00.000Z")]);
    expect(analytics.byType).toHaveLength(9);
    expect(analytics.byType.find((r) => r.coach === "psychology")!.viewCount).toBe(0);
  });

  it("honestly identifies the most recently viewed coach by timestamp, and its scope", () => {
    const analytics = buildCoachAnalytics([
      row("structure:AAPL", "2026-01-01T00:00:00.000Z"),
      row("journal:account", "2026-01-05T00:00:00.000Z"),
    ]);
    expect(analytics.mostRecentCoach).toBe("journal");
    expect(analytics.mostRecentScope).toBe("account");
    expect(analytics.mostRecentViewedAt).toBe("2026-01-05T00:00:00.000Z");
  });

  it("honestly reports null mostRecent* fields and zero counts for a brand-new user", () => {
    const analytics = buildCoachAnalytics([]);
    expect(analytics.totalCoachViews).toBe(0);
    expect(analytics.mostRecentCoach).toBeNull();
    expect(analytics.mostRecentScope).toBeNull();
    expect(analytics.mostRecentViewedAt).toBeNull();
  });

  it("skips a malformed itemKey (no separator) rather than crashing or fabricating a coach type", () => {
    const analytics = buildCoachAnalytics([row("malformed-no-colon", "2026-01-01T00:00:00.000Z")]);
    expect(analytics.totalCoachViews).toBe(1);
    expect(analytics.byType.every((r) => r.viewCount === 0)).toBe(true);
  });
});

describe("buildSessionAnalytics", () => {
  function position(entryDate: string): MinimalPositionRow {
    return { entryDate, stopPrice: null, targetPrice: null };
  }

  it("classifies real entry timestamps via the unmodified activeSessionsAt(), never a synthetic session", () => {
    // 02:00 UTC -> tokyo + sydney active (Asia), no overlap between sydney/tokyo themselves matters, but
    // per TRADING_SESSION_WINDOWS: sydney 21-6, tokyo 0-9 -> both active at 02:00 -> counts as Asia AND overlap.
    const analytics = buildSessionAnalytics([position("2026-01-01T02:00:00.000Z")]);
    expect(analytics.totalClassified).toBe(1);
    const asia = analytics.activity.find((a) => a.label === "Asia")!;
    expect(asia.count).toBe(1);
    const overlap = analytics.activity.find((a) => a.label === "Overlap")!;
    expect(overlap.count).toBe(1);
  });

  it("excludes a position with an unresolvable entryDate from totalClassified, never crashing", () => {
    const analytics = buildSessionAnalytics([position("not-a-real-date")]);
    expect(analytics.totalClassified).toBe(0);
  });

  it("honestly reports all-zero activity for no positions at all", () => {
    const analytics = buildSessionAnalytics([]);
    expect(analytics.totalClassified).toBe(0);
    expect(analytics.activity.every((a) => a.count === 0)).toBe(true);
    expect(analytics.rawSessionCounts).toEqual({ sydney: 0, tokyo: 0, london: 0, new_york: 0 });
  });
});

describe("buildStructureAnalytics / buildLiquidityAnalytics", () => {
  it("is a disclosed usage proxy — real coach views + real evidence citations, never a re-derivation of a structure/liquidity reading", () => {
    const coach = buildCoachAnalytics([{ itemKey: "structure:AAPL", viewedAt: "2026-01-01T00:00:00.000Z" }]);
    const usage = buildStrategyUsageAnalytics([strategy({ requiredEvidence: ["structure"] })], [checklist()]);
    const structureAnalytics = buildStructureAnalytics(coach, usage);
    expect(structureAnalytics.coachViewCount).toBe(1);
    expect(structureAnalytics.strategiesRequiringAsEvidence).toBe(1);
    expect(structureAnalytics.evidenceLinksAttached).toBe(1);

    const liquidityAnalytics = buildLiquidityAnalytics(coach, usage);
    expect(liquidityAnalytics.coachViewCount).toBe(0);
    expect(liquidityAnalytics.strategiesRequiringAsEvidence).toBe(0);
  });
});

describe("buildChecklistAnalytics", () => {
  it("groups checklist instances by strategy, using the strategy's own registered name", () => {
    const strategies = [strategy({ id: 1, name: "Strategy One" }), strategy({ id: 2, name: "Strategy Two" })];
    const checklists = [checklist({ id: 1, strategyId: 1 }), checklist({ id: 2, strategyId: 1, status: "complete" }), checklist({ id: 3, strategyId: 2 })];
    const analytics = buildChecklistAnalytics(strategies, checklists);
    expect(analytics.totalInstances).toBe(3);
    expect(analytics.totalComplete).toBe(1);
    const row1 = analytics.byStrategy.find((r) => r.strategyId === 1)!;
    expect(row1.strategyName).toBe("Strategy One");
    expect(row1.instanceCount).toBe(2);
    expect(row1.completeCount).toBe(1);
  });

  it("falls back to a generic label, never a fabricated name, for a checklist whose strategy no longer resolves", () => {
    const analytics = buildChecklistAnalytics([], [checklist({ strategyId: 999 })]);
    expect(analytics.byStrategy[0].strategyName).toBe("Strategy #999");
  });

  it("honestly reports 0% overall completion for zero checklist instances", () => {
    const analytics = buildChecklistAnalytics([strategy()], []);
    expect(analytics.overallCompletionPct).toBe(0);
    expect(analytics.totalInstances).toBe(0);
  });
});

describe("buildTradingAnalyticsDashboard", () => {
  it("composes all 10 analytics categories from one input object, each independently derivable", () => {
    const dashboard = buildTradingAnalyticsDashboard({
      positions: [],
      plans: [],
      journalEntries: [],
      workspaceNotes: [],
      strategies: [strategy()],
      checklists: [checklist()],
      learningProgress: emptyLearningProgress(),
      coachProgressRows: [],
    });
    expect(dashboard.overview.strategiesRegistered).toBe(1);
    expect(dashboard.strategyUsage.checklistInstances).toBe(1);
    expect(dashboard.journal.entryCount).toBe(0);
    expect(dashboard.risk.openPositionsCount).toBe(0);
    expect(dashboard.learning.totalTopics).toBe(0);
    expect(dashboard.coach.totalCoachViews).toBe(0);
    expect(dashboard.session.totalClassified).toBe(0);
    expect(dashboard.structure).toBeDefined();
    expect(dashboard.liquidity).toBeDefined();
    expect(dashboard.checklist.totalInstances).toBe(1);
  });

  it("never fabricates a signal, score, or prediction field anywhere in the composed dashboard", () => {
    const dashboard = buildTradingAnalyticsDashboard({
      positions: [],
      plans: [],
      journalEntries: [],
      workspaceNotes: [],
      strategies: [],
      checklists: [],
      learningProgress: emptyLearningProgress(),
      coachProgressRows: [],
    });
    const serialized = JSON.stringify(dashboard).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"signal"|"forecast"|"score":\d/);
  });
});

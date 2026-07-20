// Phase 33 — Institutional Executive Intelligence & Reporting Hub. Pure
// unit tests over the composition engine's own math — every builder is a
// direct read, count, tally, sort, or simple aggregate of already-computed
// engine outputs / already-provided rows. No database, no HTTP — see
// routes/executiveIntelligence.route.test.ts for the live persistence
// layer.

import { describe, it, expect } from "vitest";
import { buildReportingSummary, buildActivityTimeline, buildExecutiveIntelligenceHub, type MinimalReportRow, type ActivityTimelineInput } from "./executiveIntelligence.js";
import { buildInvestingAnalyticsDashboard } from "./investingAnalytics.js";
import { buildTradingAnalyticsDashboard } from "./tradingAnalytics.js";
import type { StrategyMetadata, StrategyChecklistInstance } from "./tradingStrategyFramework.js";
import type { LearningProgressSummary } from "./learningProgress.js";

function emptyQuizProgress() {
  return { attempts: [], bestByTopic: [], totalAttempts: 0, averagePercent: 0, streak: 0, improvement: 0, firstPercent: 0, latestPercent: 0 };
}

function emptyLearningProgress(overrides: Partial<LearningProgressSummary> = {}): LearningProgressSummary {
  return {
    lessonsViewed: 0,
    lessonsCompleted: 0,
    glossaryTermsViewed: 0,
    strategiesViewed: 0,
    coachesViewed: 0,
    pathCompletion: [],
    completedLessonKeys: [],
    completedGlossaryKeys: [],
    completedStrategyKeys: [],
    completedCoachKeys: [],
    viewedStrategyKeys: [],
    greeksQuiz: emptyQuizProgress(),
    valueQuiz: emptyQuizProgress(),
    recentHistory: [],
    ...overrides,
  };
}

function emptyInvestingDashboard() {
  return buildInvestingAnalyticsDashboard({
    portfolios: [],
    holdings: [],
    researchNotes: [],
    watchlist: [],
    decisionSnapshots: [],
    riskSnapshots: [],
    optimisationReviews: [],
    savedScreens: [],
    coachProgressRows: [],
  });
}

function emptyTradingDashboard() {
  return buildTradingAnalyticsDashboard({
    positions: [],
    plans: [],
    journalEntries: [],
    workspaceNotes: [],
    strategies: [] as StrategyMetadata[],
    checklists: [] as StrategyChecklistInstance[],
    learningProgress: emptyLearningProgress(),
    coachProgressRows: [],
  });
}

function emptyActivityInput(): ActivityTimelineInput {
  return {
    journalEntries: [],
    committeeSnapshots: [],
    riskSnapshots: [],
    optimisationReviews: [],
    researchNotes: [],
    reports: [],
    notifications: [],
  };
}

describe("buildReportingSummary", () => {
  it("tallies reports by type, sorted descending, and lists the most recent N", () => {
    const rows: MinimalReportRow[] = [
      { id: 1, reportType: "watchlist", title: "Watchlist Report", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: 2, reportType: "watchlist", title: "Watchlist Report", createdAt: "2026-01-02T00:00:00.000Z" },
      { id: 3, reportType: "executive-summary", title: "Executive Summary", createdAt: "2026-01-03T00:00:00.000Z" },
    ];
    const summary = buildReportingSummary(rows);
    expect(summary.totalReports).toBe(3);
    expect(summary.distinctReportTypesUsed).toBe(2);
    expect(summary.byType[0]).toEqual({ reportType: "watchlist", count: 2 });
    expect(summary.recentReports[0].id).toBe(3); // newest first
    expect(summary.recentReports).toHaveLength(3);
  });

  it("respects the limit parameter for recentReports without affecting totalReports/byType", () => {
    const rows: MinimalReportRow[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      reportType: "watchlist",
      title: "Watchlist Report",
      createdAt: new Date(2026, 0, i + 1).toISOString(),
    }));
    const summary = buildReportingSummary(rows, 2);
    expect(summary.totalReports).toBe(5);
    expect(summary.recentReports).toHaveLength(2);
    expect(summary.recentReports[0].id).toBe(5);
  });

  it("honestly reports zero/empty for a brand-new user with no reports", () => {
    const summary = buildReportingSummary([]);
    expect(summary.totalReports).toBe(0);
    expect(summary.distinctReportTypesUsed).toBe(0);
    expect(summary.byType).toEqual([]);
    expect(summary.recentReports).toEqual([]);
  });
});

describe("buildActivityTimeline", () => {
  it("merges every source table's rows into one chronologically sorted feed", () => {
    const input: ActivityTimelineInput = {
      journalEntries: [{ title: "Trade recap", createdAt: "2026-01-01T00:00:00.000Z" }],
      committeeSnapshots: [{ symbol: "AAPL", recommendation: "Buy", createdAt: "2026-01-04T00:00:00.000Z" }],
      riskSnapshots: [{ overallScore: 70, createdAt: "2026-01-02T00:00:00.000Z" }],
      optimisationReviews: [{ symbol: "MSFT", action: "trim", createdAt: "2026-01-03T00:00:00.000Z" }],
      researchNotes: [{ symbol: "GOOGL", createdAt: "2026-01-05T00:00:00.000Z" }],
      reports: [{ id: 1, reportType: "watchlist", title: "Watchlist Report", createdAt: "2026-01-06T00:00:00.000Z" }],
      notifications: [{ title: "Price target crossed", message: "AAPL crossed your target", relatedSymbol: "AAPL", createdAt: "2026-01-07T00:00:00.000Z" }],
    };
    const timeline = buildActivityTimeline(input);
    expect(timeline).toHaveLength(7);
    // newest first
    expect(timeline[0].type).toBe("notification");
    expect(timeline[0].symbol).toBe("AAPL");
    expect(timeline[6].type).toBe("journal-entry");
  });

  it("respects the limit parameter, keeping only the most recent entries", () => {
    const input = emptyActivityInput();
    input.researchNotes = Array.from({ length: 10 }, (_, i) => ({ symbol: "AAPL", createdAt: new Date(2026, 0, i + 1).toISOString() }));
    const timeline = buildActivityTimeline(input, 3);
    expect(timeline).toHaveLength(3);
    expect(timeline[0].occurredAt).toBe(new Date(2026, 0, 10).toISOString());
  });

  it("honestly reports an empty timeline for a brand-new user with no activity anywhere", () => {
    expect(buildActivityTimeline(emptyActivityInput())).toEqual([]);
  });

  it("gives every optimisation review with no symbol a portfolio-level detail, never a fabricated symbol", () => {
    const input = emptyActivityInput();
    input.optimisationReviews = [{ symbol: null, action: "note", createdAt: "2026-01-01T00:00:00.000Z" }];
    const timeline = buildActivityTimeline(input);
    expect(timeline[0].symbol).toBeNull();
    expect(timeline[0].detail).toContain("Portfolio-level review");
  });
});

describe("buildExecutiveIntelligenceHub", () => {
  it("composes overview/investing/trading/strategy/portfolio/risk/learning/coach/reporting/activity from the same inputs", () => {
    const investing = emptyInvestingDashboard();
    const trading = emptyTradingDashboard();
    const hub = buildExecutiveIntelligenceHub({
      investing,
      trading,
      reportRows: [{ id: 1, reportType: "watchlist", title: "Watchlist Report", createdAt: "2026-01-01T00:00:00.000Z" }],
      activityInput: emptyActivityInput(),
    });
    expect(hub.investing).toBe(investing);
    expect(hub.trading).toBe(trading);
    expect(hub.strategy).toBe(trading.strategyUsage);
    expect(hub.portfolio).toBe(investing.portfolio);
    expect(hub.learning).toBe(trading.learning);
    expect(hub.reporting.totalReports).toBe(1);
    expect(typeof hub.overview.summary).toBe("string");
    expect(hub.overview.summary.length).toBeGreaterThan(0);
  });

  it("never double-counts coach views across engines — deriving trading's own count from byType, not the potentially-inflated totalCoachViews field", () => {
    const investing = buildInvestingAnalyticsDashboard({
      portfolios: [],
      holdings: [],
      researchNotes: [],
      watchlist: [],
      decisionSnapshots: [],
      riskSnapshots: [],
      optimisationReviews: [],
      savedScreens: [],
      // One genuine Investing coach view.
      coachProgressRows: [{ itemKey: "investment:AAPL", viewedAt: "2026-01-01T00:00:00.000Z" }],
    });
    const trading = buildTradingAnalyticsDashboard({
      positions: [],
      plans: [],
      journalEntries: [],
      workspaceNotes: [],
      strategies: [],
      checklists: [],
      learningProgress: emptyLearningProgress(),
      // Trading's own loader would, in the real app, ALSO see the
      // Investing coach row above (shared learning_progress itemType) —
      // simulate that here directly, passed only to Trading's builder to
      // prove the Executive layer's own coach total isn't inflated by it.
      coachProgressRows: [
        { itemKey: "structure:AAPL", viewedAt: "2026-01-02T00:00:00.000Z" },
        { itemKey: "investment:AAPL", viewedAt: "2026-01-01T00:00:00.000Z" },
      ],
    });
    // Confirm the pre-existing Phase 32 behavior this test depends on:
    // Trading's own totalCoachViews DOES include the foreign investing row.
    expect(trading.coach.totalCoachViews).toBe(2);
    // But byType only counts the real Trading coach ("structure").
    expect(trading.coach.byType.find((r) => r.coach === "structure")?.viewCount).toBe(1);

    const hub = buildExecutiveIntelligenceHub({
      investing,
      trading,
      reportRows: [],
      activityInput: emptyActivityInput(),
    });
    expect(hub.coach.investingCoachViews).toBe(1);
    expect(hub.coach.tradingCoachViews).toBe(1); // derived from byType, not the inflated field (2)
    expect(hub.coach.totalCoachViews).toBe(2); // 1 + 1, never 1 + 2
  });

  it("reports the most recent coach view across both engines, choosing the correct engine", () => {
    const investing = buildInvestingAnalyticsDashboard({
      portfolios: [],
      holdings: [],
      researchNotes: [],
      watchlist: [],
      decisionSnapshots: [],
      riskSnapshots: [],
      optimisationReviews: [],
      savedScreens: [],
      coachProgressRows: [{ itemKey: "investment:AAPL", viewedAt: "2026-01-05T00:00:00.000Z" }],
    });
    const trading = buildTradingAnalyticsDashboard({
      positions: [],
      plans: [],
      journalEntries: [],
      workspaceNotes: [],
      strategies: [],
      checklists: [],
      learningProgress: emptyLearningProgress(),
      coachProgressRows: [{ itemKey: "structure:MSFT", viewedAt: "2026-01-01T00:00:00.000Z" }],
    });
    const hub = buildExecutiveIntelligenceHub({ investing, trading, reportRows: [], activityInput: emptyActivityInput() });
    expect(hub.coach.mostRecentEngine).toBe("investing");
    expect(hub.coach.mostRecentCoach).toBe("investment");
  });

  it("never fabricates a signal, score, or prediction field anywhere in the composed hub", () => {
    const hub = buildExecutiveIntelligenceHub({
      investing: emptyInvestingDashboard(),
      trading: emptyTradingDashboard(),
      reportRows: [],
      activityInput: emptyActivityInput(),
    });
    const serialized = JSON.stringify(hub).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"tradingsignal"|"forecast"/);
  });
});

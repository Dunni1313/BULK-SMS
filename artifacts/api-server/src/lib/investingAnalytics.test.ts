// Phase 33 — Institutional Executive Intelligence & Reporting Hub. Pure
// unit tests over the Investing Analytics Engine's own math — every
// builder is a direct read, count, tally, or simple aggregate of already-
// provided rows. No database, no HTTP — see
// routes/investingAnalytics.route.test.ts for the live persistence layer.

import { describe, it, expect } from "vitest";
import {
  buildOverview,
  buildPortfolioAnalytics,
  buildResearchAnalytics,
  buildWatchlistAnalytics,
  buildCommitteeAnalytics,
  buildRiskAnalytics,
  buildOptimisationAnalytics,
  buildCoachAnalytics,
  buildInvestingAnalyticsDashboard,
  type MinimalPortfolioRow,
  type MinimalHoldingRow,
  type MinimalResearchNoteRow,
  type MinimalWatchlistRow,
  type MinimalDecisionSnapshotRow,
  type MinimalRiskSnapshotRow,
  type MinimalOptimisationReviewRow,
  type CoachProgressRow,
} from "./investingAnalytics.js";

describe("buildOverview", () => {
  it("counts each table's rows directly", () => {
    const overview = buildOverview(
      [{ id: 1 }, { id: 2 }],
      [{ portfolioId: 1, symbol: "AAPL" }],
      [{ symbol: "AAPL", createdAt: "2026-01-01T00:00:00.000Z" }],
      [{ symbol: "AAPL", category: "Researching", currentDecision: "WATCHLIST" }],
      [{ symbol: "AAPL", recommendation: "Buy", confidence: 0.8, createdAt: "2026-01-01T00:00:00.000Z" }],
      [{ overallScore: 70, createdAt: "2026-01-01T00:00:00.000Z" }],
      [{ symbol: "AAPL", action: "upgrade", createdAt: "2026-01-01T00:00:00.000Z" }],
      [{ id: 1 }],
    );
    expect(overview.portfoliosCreated).toBe(2);
    expect(overview.holdingsTracked).toBe(1);
    expect(overview.researchNotesWritten).toBe(1);
    expect(overview.watchlistItems).toBe(1);
    expect(overview.committeeSnapshotsSaved).toBe(1);
    expect(overview.riskSnapshotsSaved).toBe(1);
    expect(overview.optimisationReviewsSaved).toBe(1);
    expect(overview.savedScreens).toBe(1);
    expect(typeof overview.generatedAt).toBe("string");
  });

  it("honestly reports all zeros for a brand-new user, never fabricating a value", () => {
    const overview = buildOverview([], [], [], [], [], [], [], []);
    expect(overview.portfoliosCreated).toBe(0);
    expect(overview.holdingsTracked).toBe(0);
    expect(overview.researchNotesWritten).toBe(0);
    expect(overview.watchlistItems).toBe(0);
    expect(overview.committeeSnapshotsSaved).toBe(0);
    expect(overview.riskSnapshotsSaved).toBe(0);
    expect(overview.optimisationReviewsSaved).toBe(0);
    expect(overview.savedScreens).toBe(0);
  });
});

describe("buildPortfolioAnalytics", () => {
  it("computes total holdings, average per portfolio, and distinct symbols", () => {
    const portfolios: MinimalPortfolioRow[] = [{ id: 1 }, { id: 2 }];
    const holdings: MinimalHoldingRow[] = [
      { portfolioId: 1, symbol: "AAPL" },
      { portfolioId: 1, symbol: "MSFT" },
      { portfolioId: 2, symbol: "aapl" }, // case-insensitive dedup with AAPL above
    ];
    const analytics = buildPortfolioAnalytics(portfolios, holdings);
    expect(analytics.portfolioCount).toBe(2);
    expect(analytics.totalHoldings).toBe(3);
    expect(analytics.averageHoldingsPerPortfolio).toBe(1.5);
    expect(analytics.distinctSymbolsHeld).toBe(2);
  });

  it("honestly reports 0 average when there are no portfolios, never a divide-by-zero NaN", () => {
    const analytics = buildPortfolioAnalytics([], []);
    expect(analytics.averageHoldingsPerPortfolio).toBe(0);
    expect(Number.isNaN(analytics.averageHoldingsPerPortfolio)).toBe(false);
  });
});

describe("buildResearchAnalytics", () => {
  it("counts notes, distinct symbols, and the most recent note's timestamp", () => {
    const notes: MinimalResearchNoteRow[] = [
      { symbol: "AAPL", createdAt: "2026-01-01T00:00:00.000Z" },
      { symbol: "MSFT", createdAt: "2026-01-03T00:00:00.000Z" },
      { symbol: "AAPL", createdAt: "2026-01-02T00:00:00.000Z" },
    ];
    const analytics = buildResearchAnalytics(notes);
    expect(analytics.noteCount).toBe(3);
    expect(analytics.distinctSymbolsResearched).toBe(2);
    expect(analytics.mostRecentNoteAt).toBe(new Date("2026-01-03T00:00:00.000Z").toISOString());
  });

  it("honestly reports null mostRecentNoteAt when no note has ever been written", () => {
    const analytics = buildResearchAnalytics([]);
    expect(analytics.noteCount).toBe(0);
    expect(analytics.mostRecentNoteAt).toBeNull();
  });
});

describe("buildWatchlistAnalytics", () => {
  it("tallies by category and by current decision", () => {
    const rows: MinimalWatchlistRow[] = [
      { symbol: "AAPL", category: "Researching", currentDecision: "WATCHLIST" },
      { symbol: "MSFT", category: "Researching", currentDecision: "BUY" },
      { symbol: "GOOGL", category: "Owned", currentDecision: "WATCHLIST" },
    ];
    const analytics = buildWatchlistAnalytics(rows);
    expect(analytics.itemCount).toBe(3);
    expect(analytics.categoryTally.Researching).toBe(2);
    expect(analytics.categoryTally.Owned).toBe(1);
    expect(analytics.decisionTally.WATCHLIST).toBe(2);
    expect(analytics.decisionTally.BUY).toBe(1);
  });
});

describe("buildCommitteeAnalytics", () => {
  it("tallies recommendations and reports the most recent snapshot", () => {
    const rows: MinimalDecisionSnapshotRow[] = [
      { symbol: "AAPL", recommendation: "Buy", confidence: 0.7, createdAt: "2026-01-01T00:00:00.000Z" },
      { symbol: "MSFT", recommendation: "Hold", confidence: 0.5, createdAt: "2026-01-03T00:00:00.000Z" },
      { symbol: "GOOGL", recommendation: "Buy", confidence: 0.9, createdAt: "2026-01-02T00:00:00.000Z" },
    ];
    const analytics = buildCommitteeAnalytics(rows);
    expect(analytics.snapshotCount).toBe(3);
    expect(analytics.recommendationTally.Buy).toBe(2);
    expect(analytics.recommendationTally.Hold).toBe(1);
    expect(analytics.mostRecentSymbol).toBe("MSFT");
    expect(analytics.mostRecentRecommendation).toBe("Hold");
    expect(analytics.mostRecentConfidence).toBe(0.5);
  });

  it("honestly reports all-null fields when no snapshot has ever been saved", () => {
    const analytics = buildCommitteeAnalytics([]);
    expect(analytics.snapshotCount).toBe(0);
    expect(analytics.mostRecentSymbol).toBeNull();
    expect(analytics.mostRecentRecommendation).toBeNull();
    expect(analytics.mostRecentConfidence).toBeNull();
    expect(analytics.mostRecentSavedAt).toBeNull();
  });
});

describe("buildRiskAnalytics", () => {
  it("reports the most recent row's own score and the average over only scored snapshots", () => {
    const rows: MinimalRiskSnapshotRow[] = [
      { overallScore: 60, createdAt: "2026-01-01T00:00:00.000Z" },
      { overallScore: 40, createdAt: "2026-01-02T00:00:00.000Z" },
      { overallScore: 80, createdAt: "2026-01-03T00:00:00.000Z" }, // most recent by createdAt
    ];
    const analytics = buildRiskAnalytics(rows);
    expect(analytics.snapshotCount).toBe(3);
    expect(analytics.mostRecentOverallScore).toBe(80);
    expect(analytics.averageOverallScore).toBe(60); // average of 60, 40, 80
  });

  it("honestly reports a null mostRecentOverallScore when the most recent snapshot wasn't scoreable, while still averaging the earlier scored ones", () => {
    const rows: MinimalRiskSnapshotRow[] = [
      { overallScore: 60, createdAt: "2026-01-01T00:00:00.000Z" },
      { overallScore: 80, createdAt: "2026-01-02T00:00:00.000Z" },
      { overallScore: null, createdAt: "2026-01-03T00:00:00.000Z" }, // most recent, unscoreable at time of save — never fabricated
    ];
    const analytics = buildRiskAnalytics(rows);
    expect(analytics.mostRecentOverallScore).toBeNull();
    expect(analytics.averageOverallScore).toBe(70); // average of 60 and 80 only
  });

  it("honestly reports null average when no snapshot was ever scoreable", () => {
    const rows: MinimalRiskSnapshotRow[] = [{ overallScore: null, createdAt: "2026-01-01T00:00:00.000Z" }];
    const analytics = buildRiskAnalytics(rows);
    expect(analytics.averageOverallScore).toBeNull();
    expect(analytics.mostRecentOverallScore).toBeNull();
  });
});

describe("buildOptimisationAnalytics", () => {
  it("tallies actions and reports the most recent review", () => {
    const rows: MinimalOptimisationReviewRow[] = [
      { symbol: "AAPL", action: "upgrade", createdAt: "2026-01-01T00:00:00.000Z" },
      { symbol: "MSFT", action: "trim", createdAt: "2026-01-02T00:00:00.000Z" },
      { symbol: null, action: "note", createdAt: "2026-01-03T00:00:00.000Z" },
    ];
    const analytics = buildOptimisationAnalytics(rows);
    expect(analytics.reviewCount).toBe(3);
    expect(analytics.actionTally.upgrade).toBe(1);
    expect(analytics.actionTally.trim).toBe(1);
    expect(analytics.actionTally.note).toBe(1);
    expect(analytics.mostRecentAction).toBe("note");
  });
});

describe("buildCoachAnalytics", () => {
  it("parses itemKey prefixes and counts only valid investing coach types", () => {
    const rows: CoachProgressRow[] = [
      { itemKey: "investment:AAPL", viewedAt: "2026-01-01T00:00:00.000Z" },
      { itemKey: "risk:AAPL", viewedAt: "2026-01-02T00:00:00.000Z" },
      { itemKey: "committee:MSFT", viewedAt: "2026-01-03T00:00:00.000Z" },
    ];
    const analytics = buildCoachAnalytics(rows);
    expect(analytics.totalCoachViews).toBe(3);
    expect(analytics.mostRecentCoach).toBe("committee");
    expect(analytics.mostRecentScope).toBe("MSFT");
    expect(analytics.byType.find((r) => r.coach === "investment")?.viewCount).toBe(1);
    expect(analytics.byType.find((r) => r.coach === "risk")?.viewCount).toBe(1);
    expect(analytics.byType).toHaveLength(8);
  });

  it("never counts a Trading Engine coach row (same itemType, foreign coach-type prefix) — the core disclosed collision-avoidance guarantee", () => {
    const rows: CoachProgressRow[] = [
      { itemKey: "investment:AAPL", viewedAt: "2026-01-01T00:00:00.000Z" },
      // "structure"/"session"/"trade-plan" are Trading Engine coach types,
      // never valid Investing Engine CoachType prefixes — must be excluded.
      { itemKey: "structure:AAPL", viewedAt: "2026-01-02T00:00:00.000Z" },
      { itemKey: "session:account", viewedAt: "2026-01-03T00:00:00.000Z" },
    ];
    const analytics = buildCoachAnalytics(rows);
    expect(analytics.totalCoachViews).toBe(1);
    expect(analytics.mostRecentCoach).toBe("investment");
  });

  it("honestly reports zero-filled byType and null most-recent fields with no rows", () => {
    const analytics = buildCoachAnalytics([]);
    expect(analytics.totalCoachViews).toBe(0);
    expect(analytics.mostRecentCoach).toBeNull();
    expect(analytics.mostRecentScope).toBeNull();
    expect(analytics.mostRecentViewedAt).toBeNull();
    expect(analytics.byType.every((r) => r.viewCount === 0)).toBe(true);
  });
});

describe("buildInvestingAnalyticsDashboard", () => {
  it("composes every section from the same input set", () => {
    const dashboard = buildInvestingAnalyticsDashboard({
      portfolios: [{ id: 1 }],
      holdings: [{ portfolioId: 1, symbol: "AAPL" }],
      researchNotes: [{ symbol: "AAPL", createdAt: "2026-01-01T00:00:00.000Z" }],
      watchlist: [{ symbol: "AAPL", category: "Researching", currentDecision: "WATCHLIST" }],
      decisionSnapshots: [{ symbol: "AAPL", recommendation: "Buy", confidence: 0.8, createdAt: "2026-01-01T00:00:00.000Z" }],
      riskSnapshots: [{ overallScore: 65, createdAt: "2026-01-01T00:00:00.000Z" }],
      optimisationReviews: [{ symbol: "AAPL", action: "upgrade", createdAt: "2026-01-01T00:00:00.000Z" }],
      savedScreens: [{ id: 1 }],
      coachProgressRows: [{ itemKey: "investment:AAPL", viewedAt: "2026-01-01T00:00:00.000Z" }],
    });
    expect(dashboard.overview.portfoliosCreated).toBe(1);
    expect(dashboard.portfolio.portfolioCount).toBe(1);
    expect(dashboard.research.noteCount).toBe(1);
    expect(dashboard.watchlist.itemCount).toBe(1);
    expect(dashboard.committee.snapshotCount).toBe(1);
    expect(dashboard.risk.snapshotCount).toBe(1);
    expect(dashboard.optimisation.reviewCount).toBe(1);
    expect(dashboard.coach.totalCoachViews).toBe(1);
  });

  it("never fabricates a signal, score, or prediction field anywhere in the composed dashboard", () => {
    const dashboard = buildInvestingAnalyticsDashboard({
      portfolios: [{ id: 1 }],
      holdings: [{ portfolioId: 1, symbol: "AAPL" }],
      researchNotes: [],
      watchlist: [],
      decisionSnapshots: [],
      riskSnapshots: [],
      optimisationReviews: [],
      savedScreens: [],
      coachProgressRows: [],
    });
    const serialized = JSON.stringify(dashboard).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"tradingsignal"|"forecast"/);
  });
});

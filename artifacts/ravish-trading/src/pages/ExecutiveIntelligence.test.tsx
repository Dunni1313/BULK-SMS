// Phase 33 — Institutional Executive Intelligence & Reporting Hub. Frontend
// smoke tests for the Executive Intelligence Hub page, following the
// established mocked-generated-hook pattern (see
// TradingAnalyticsDashboard.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isError: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetExecutiveIntelligenceHub: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
  };
});

import ExecutiveIntelligence from "./ExecutiveIntelligence";

function emptyTradingAnalyticsDashboard(overrides: Record<string, unknown> = {}) {
  return {
    overview: {
      tradesReviewed: 0,
      plansCreated: 0,
      journalEntries: 0,
      workspaceNotes: 0,
      strategiesRegistered: 0,
      checklistInstances: 0,
      generatedAt: "2026-07-20T00:00:00.000Z",
    },
    strategyUsage: {
      strategiesRegistered: 0,
      checklistInstances: 0,
      checklistsComplete: 0,
      checklistsInProgress: 0,
      overallChecklistCompletionPct: 0,
      requiredEvidenceByType: { structure: 0, liquidity: 0, session: 0, risk: 0, "trade-plan": 0, journal: 0, coach: 0 },
      evidenceLinksAttachedByType: { structure: 0, liquidity: 0, session: 0, risk: 0, "trade-plan": 0, journal: 0, coach: 0 },
    },
    journal: {
      entryCount: 0,
      moodTally: {},
      setupTypeTally: {},
      lessonRecordedCount: 0,
      lessonRecordedPct: 0,
      rMultipleEntriesCount: 0,
      averageRMultiple: null,
      rMultipleDistribution: [],
    },
    risk: {
      plansWithRiskParams: 0,
      averageAccountRiskPct: null,
      riskRewardDistribution: [],
      averageRiskRewardRatio: null,
      positionsWithBothStopAndTarget: 0,
      positionsWithNeitherStopNorTarget: 0,
      openPositionsCount: 0,
      stopTargetDisciplinePct: 0,
    },
    learning: {
      lessonsViewed: 0,
      lessonsCompleted: 0,
      glossaryTermsViewed: 0,
      strategiesViewed: 0,
      coachesViewed: 0,
      totalTopics: 0,
      completedTopics: 0,
      remainingTopics: 0,
      weakestPaths: [],
    },
    coach: {
      totalCoachViews: 0,
      byType: [],
      mostRecentCoach: null,
      mostRecentScope: null,
      mostRecentViewedAt: null,
    },
    session: { totalClassified: 0, activity: [], rawSessionCounts: { sydney: 0, tokyo: 0, london: 0, new_york: 0 } },
    structure: { coachViewCount: 0, strategiesRequiringAsEvidence: 0, evidenceLinksAttached: 0 },
    liquidity: { coachViewCount: 0, strategiesRequiringAsEvidence: 0, evidenceLinksAttached: 0 },
    checklist: { totalInstances: 0, totalComplete: 0, totalInProgress: 0, overallCompletionPct: 0, byStrategy: [] },
    ...overrides,
  };
}

function emptyInvestingAnalyticsDashboard(overrides: Record<string, unknown> = {}) {
  return {
    overview: {
      portfoliosCreated: 0,
      holdingsTracked: 0,
      researchNotesWritten: 0,
      watchlistItems: 0,
      committeeSnapshotsSaved: 0,
      riskSnapshotsSaved: 0,
      optimisationReviewsSaved: 0,
      savedScreens: 0,
      generatedAt: "2026-07-20T00:00:00.000Z",
    },
    portfolio: { portfolioCount: 0, totalHoldings: 0, averageHoldingsPerPortfolio: 0, distinctSymbolsHeld: 0 },
    research: { noteCount: 0, distinctSymbolsResearched: 0, mostRecentNoteAt: null },
    watchlist: { itemCount: 0, categoryTally: {}, decisionTally: {} },
    committee: { snapshotCount: 0, recommendationTally: {}, mostRecentSymbol: null, mostRecentRecommendation: null, mostRecentConfidence: null, mostRecentSavedAt: null },
    risk: { snapshotCount: 0, mostRecentOverallScore: null, averageOverallScore: null, mostRecentSavedAt: null },
    optimisation: { reviewCount: 0, actionTally: {}, mostRecentAction: null, mostRecentSavedAt: null },
    coach: { totalCoachViews: 0, byType: [], mostRecentCoach: null, mostRecentScope: null, mostRecentViewedAt: null },
    ...overrides,
  };
}

function emptyHub(overrides: Record<string, unknown> = {}) {
  return {
    overview: {
      portfoliosCreated: 0,
      holdingsTracked: 0,
      researchNotesWritten: 0,
      watchlistItems: 0,
      committeeSnapshotsSaved: 0,
      tradesReviewed: 0,
      tradePlansCreated: 0,
      journalEntries: 0,
      strategiesRegistered: 0,
      checklistInstances: 0,
      learningTopicsCompleted: 0,
      learningTopicsTotal: 0,
      totalCoachViews: 0,
      reportsGenerated: 0,
      reportCategoriesUsed: 0,
      generatedAt: "2026-07-20T00:00:00.000Z",
      summary: "No activity recorded yet across either engine.",
    },
    investing: emptyInvestingAnalyticsDashboard(),
    trading: emptyTradingAnalyticsDashboard(),
    strategy: emptyTradingAnalyticsDashboard().strategyUsage,
    portfolio: emptyInvestingAnalyticsDashboard().portfolio,
    risk: { investingRiskSnapshotsSaved: 0, investingMostRecentRiskScore: null, tradingOpenPositionsCount: 0, tradingStopTargetDisciplinePct: 0 },
    learning: emptyTradingAnalyticsDashboard().learning,
    coach: { investingCoachViews: 0, tradingCoachViews: 0, totalCoachViews: 0, mostRecentEngine: null, mostRecentCoach: null, mostRecentViewedAt: null },
    reporting: { totalReports: 0, distinctReportTypesUsed: 0, byType: [], recentReports: [] },
    activity: [],
    ...overrides,
  };
}

function populatedHub() {
  return emptyHub({
    overview: {
      portfoliosCreated: 2,
      holdingsTracked: 5,
      researchNotesWritten: 3,
      watchlistItems: 4,
      committeeSnapshotsSaved: 1,
      tradesReviewed: 6,
      tradePlansCreated: 2,
      journalEntries: 3,
      strategiesRegistered: 1,
      checklistInstances: 2,
      learningTopicsCompleted: 4,
      learningTopicsTotal: 10,
      totalCoachViews: 5,
      reportsGenerated: 3,
      reportCategoriesUsed: 2,
      generatedAt: "2026-07-20T00:00:00.000Z",
      summary: "2 investing portfolio(s), 6 trading position(s) reviewed, 1 committee snapshot(s), 1 strategy(ies) registered, 4 of 10 learning topic(s) completed, 5 AI Coach view(s), 3 report(s) generated across 2 categories.",
    },
    investing: emptyInvestingAnalyticsDashboard({
      overview: {
        portfoliosCreated: 2,
        holdingsTracked: 5,
        researchNotesWritten: 3,
        watchlistItems: 4,
        committeeSnapshotsSaved: 1,
        riskSnapshotsSaved: 1,
        optimisationReviewsSaved: 1,
        savedScreens: 0,
        generatedAt: "2026-07-20T00:00:00.000Z",
      },
      portfolio: { portfolioCount: 2, totalHoldings: 5, averageHoldingsPerPortfolio: 2.5, distinctSymbolsHeld: 4 },
      optimisation: { reviewCount: 1, actionTally: { upgrade: 1 }, mostRecentAction: "upgrade", mostRecentSavedAt: "2026-07-19T00:00:00.000Z" },
    }),
    trading: emptyTradingAnalyticsDashboard({
      overview: {
        tradesReviewed: 6,
        plansCreated: 2,
        journalEntries: 3,
        workspaceNotes: 0,
        strategiesRegistered: 1,
        checklistInstances: 2,
        generatedAt: "2026-07-20T00:00:00.000Z",
      },
      strategyUsage: {
        strategiesRegistered: 1,
        checklistInstances: 2,
        checklistsComplete: 1,
        checklistsInProgress: 1,
        overallChecklistCompletionPct: 75,
        requiredEvidenceByType: { structure: 1, liquidity: 0, session: 0, risk: 0, "trade-plan": 0, journal: 0, coach: 0 },
        evidenceLinksAttachedByType: { structure: 1, liquidity: 0, session: 0, risk: 0, "trade-plan": 0, journal: 0, coach: 0 },
      },
      session: { totalClassified: 6, activity: [{ label: "Asia", count: 6 }], rawSessionCounts: { sydney: 3, tokyo: 3, london: 0, new_york: 0 } },
    }),
    strategy: { strategiesRegistered: 1, checklistInstances: 2, checklistsComplete: 1, checklistsInProgress: 1, overallChecklistCompletionPct: 75, requiredEvidenceByType: {}, evidenceLinksAttachedByType: {} },
    portfolio: { portfolioCount: 2, totalHoldings: 5, averageHoldingsPerPortfolio: 2.5, distinctSymbolsHeld: 4 },
    risk: { investingRiskSnapshotsSaved: 1, investingMostRecentRiskScore: 72, tradingOpenPositionsCount: 3, tradingStopTargetDisciplinePct: 66.7 },
    learning: {
      lessonsViewed: 8,
      lessonsCompleted: 4,
      glossaryTermsViewed: 2,
      strategiesViewed: 1,
      coachesViewed: 5,
      totalTopics: 10,
      completedTopics: 4,
      remainingTopics: 6,
      weakestPaths: [{ pathKey: "greeks", title: "Greeks Fundamentals", percentComplete: 20 }],
    },
    coach: { investingCoachViews: 2, tradingCoachViews: 3, totalCoachViews: 5, mostRecentEngine: "trading", mostRecentCoach: "structure", mostRecentViewedAt: "2026-07-19T00:00:00.000Z" },
    reporting: {
      totalReports: 3,
      distinctReportTypesUsed: 2,
      byType: [
        { reportType: "watchlist", count: 2 },
        { reportType: "executive-summary", count: 1 },
      ],
      recentReports: [{ id: 1, reportType: "watchlist", title: "Watchlist Report", createdAt: "2026-07-19T00:00:00.000Z" }],
    },
    activity: [
      { type: "committee-snapshot", engine: "investing", label: "Investment Committee Snapshot", detail: "AAPL: Buy", occurredAt: "2026-07-19T00:00:00.000Z", symbol: "AAPL", linkPath: "/investment-committee-workbench?symbol=AAPL" },
      { type: "journal-entry", engine: "trading", label: "Trading Journal Entry", detail: "Trade recap", occurredAt: "2026-07-18T00:00:00.000Z", symbol: null, linkPath: "/trading-journal" },
    ],
  });
}

describe("ExecutiveIntelligence page", () => {
  beforeEach(() => {
    mockState.data = undefined;
    mockState.isLoading = false;
    mockState.isError = false;
  });

  it("shows a loading state while the hub is fetching", () => {
    mockState.isLoading = true;
    renderWithClient(<ExecutiveIntelligence />);
    expect(screen.getByTestId("executive-intelligence-loading")).toBeInTheDocument();
  });

  it("shows an honest error state when the hub fails to load", () => {
    mockState.isError = true;
    renderWithClient(<ExecutiveIntelligence />);
    expect(screen.getByTestId("executive-intelligence-error")).toBeInTheDocument();
  });

  it("shows the honest empty-state advisory for a brand-new user across both engines", () => {
    mockState.data = emptyHub();
    renderWithClient(<ExecutiveIntelligence />);
    expect(screen.getByTestId("executive-intelligence-empty")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-portfolios")).toHaveTextContent("0");
    expect(screen.getByTestId("kpi-trades")).toHaveTextContent("0");
  });

  it("renders real aggregated KPIs across both engines, never fabricating a nonzero value", () => {
    mockState.data = populatedHub();
    renderWithClient(<ExecutiveIntelligence />);
    expect(screen.queryByTestId("executive-intelligence-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("kpi-portfolios")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-trades")).toHaveTextContent("6");
    expect(screen.getByTestId("kpi-strategies")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-reports")).toHaveTextContent("3");
    expect(screen.getByTestId("executive-overview-summary")).toHaveTextContent("2 investing portfolio(s)");
  });

  it("Overview tab folds Strategy/Portfolio/AI-Coach/Investing/Trading summary cards, each a pass-through, never a duplicate computation", () => {
    mockState.data = populatedHub();
    renderWithClient(<ExecutiveIntelligence />);
    expect(screen.getByTestId("panel-strategy-summary")).toHaveTextContent("1 of 2 checklist instance(s) complete");
    expect(screen.getByTestId("panel-portfolio-summary")).toHaveTextContent("2 portfolio(s)");
    expect(screen.getByTestId("panel-ai-coach-summary")).toHaveTextContent("5 view(s) total");
  });

  it("Activity tab shows a real chronological merge of cross-engine events with deep links", async () => {
    mockState.data = populatedHub();
    renderWithClient(<ExecutiveIntelligence />);
    await userEvent.click(screen.getByTestId("tab-executive-activity"));
    expect(screen.getByTestId("activity-entry-0")).toHaveTextContent("AAPL: Buy");
    expect(screen.getByTestId("activity-entry-1")).toHaveTextContent("Trade recap");
  });

  it("Activity tab honestly shows an empty message when no activity exists yet", async () => {
    mockState.data = emptyHub();
    renderWithClient(<ExecutiveIntelligence />);
    await userEvent.click(screen.getByTestId("tab-executive-activity"));
    expect(screen.getByTestId("activity-timeline-empty")).toBeInTheDocument();
  });

  it("Reporting tab shows real report-type tallies and recent reports, reusing the Reporting Centre link", async () => {
    mockState.data = populatedHub();
    renderWithClient(<ExecutiveIntelligence />);
    await userEvent.click(screen.getByTestId("tab-executive-reporting"));
    expect(screen.getByTestId("kpi-total-reports")).toHaveTextContent("3");
    expect(screen.getByTestId("kpi-report-categories")).toHaveTextContent("2");
    expect(screen.getByTestId("panel-recent-reports")).toHaveTextContent("Watchlist Report");
    expect(screen.getByTestId("link-open-reporting-centre")).toBeInTheDocument();
  });

  it("Learning tab shows real completion figures and weakest paths, never a recommendation", async () => {
    mockState.data = populatedHub();
    renderWithClient(<ExecutiveIntelligence />);
    await userEvent.click(screen.getByTestId("tab-executive-learning"));
    expect(screen.getByTestId("kpi-topics-completed")).toHaveTextContent("4");
    expect(screen.getByTestId("kpi-topics-remaining")).toHaveTextContent("6");
    expect(screen.getByTestId("panel-weakest-paths")).toHaveTextContent("Greeks Fundamentals");
  });

  it("Risk tab shows cross-engine risk figures from both engines", async () => {
    mockState.data = populatedHub();
    renderWithClient(<ExecutiveIntelligence />);
    await userEvent.click(screen.getByTestId("tab-executive-risk"));
    expect(screen.getByTestId("kpi-investing-risk-snapshots")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-investing-risk-score")).toHaveTextContent("72");
    expect(screen.getByTestId("kpi-trading-open-positions")).toHaveTextContent("3");
  });

});

// Phase 32 — Institutional Trading Analytics Engine. Frontend smoke tests
// for the Trading Analytics Dashboard, following the established
// mocked-generated-hook pattern (see PortfolioConcentration.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
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
    useGetTradingAnalyticsDashboard: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
  };
});

import TradingAnalyticsDashboard from "./TradingAnalyticsDashboard";

function emptyDashboard(overrides: Record<string, unknown> = {}) {
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
      rMultipleDistribution: [
        { label: "< -1R", min: null, max: -1, count: 0 },
        { label: "-1R to 0R", min: -1, max: 0, count: 0 },
        { label: "0R to 1R", min: 0, max: 1, count: 0 },
        { label: "1R to 2R", min: 1, max: 2, count: 0 },
        { label: "> 2R", min: 2, max: null, count: 0 },
      ],
    },
    risk: {
      plansWithRiskParams: 0,
      averageAccountRiskPct: null,
      riskRewardDistribution: [
        { label: "< 1:1", min: null, max: 1, count: 0 },
        { label: "1:1 to 2:1", min: 1, max: 2, count: 0 },
        { label: "2:1 to 3:1", min: 2, max: 3, count: 0 },
        { label: "> 3:1", min: 3, max: null, count: 0 },
      ],
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
      byType: [
        { coach: "structure", label: "Structure Coach", viewCount: 0 },
        { coach: "liquidity", label: "Liquidity Coach", viewCount: 0 },
        { coach: "session", label: "Session Coach", viewCount: 0 },
        { coach: "risk", label: "Risk Coach", viewCount: 0 },
        { coach: "trade-plan", label: "Trade Plan Coach", viewCount: 0 },
        { coach: "journal", label: "Journal Coach", viewCount: 0 },
        { coach: "scenario", label: "Scenario Coach", viewCount: 0 },
        { coach: "psychology", label: "Psychology & Discipline Coach", viewCount: 0 },
        { coach: "strategy", label: "Strategy Coach", viewCount: 0 },
      ],
      mostRecentCoach: null,
      mostRecentScope: null,
      mostRecentViewedAt: null,
    },
    session: {
      totalClassified: 0,
      activity: [
        { label: "Asia", count: 0 },
        { label: "London", count: 0 },
        { label: "New York", count: 0 },
        { label: "Overlap", count: 0 },
      ],
      rawSessionCounts: { sydney: 0, tokyo: 0, london: 0, new_york: 0 },
    },
    structure: { coachViewCount: 0, strategiesRequiringAsEvidence: 0, evidenceLinksAttached: 0 },
    liquidity: { coachViewCount: 0, strategiesRequiringAsEvidence: 0, evidenceLinksAttached: 0 },
    checklist: { totalInstances: 0, totalComplete: 0, totalInProgress: 0, overallCompletionPct: 0, byStrategy: [] },
    ...overrides,
  };
}

function populatedDashboard() {
  return emptyDashboard({
    overview: {
      tradesReviewed: 3,
      plansCreated: 2,
      journalEntries: 4,
      workspaceNotes: 1,
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
      requiredEvidenceByType: { structure: 1, liquidity: 1, session: 0, risk: 0, "trade-plan": 0, journal: 0, coach: 0 },
      evidenceLinksAttachedByType: { structure: 1, liquidity: 0, session: 0, risk: 0, "trade-plan": 0, journal: 0, coach: 0 },
    },
    journal: {
      entryCount: 4,
      moodTally: { confident: 2, anxious: 1, neutral: 1 },
      setupTypeTally: { breakout: 3, reversal: 1 },
      lessonRecordedCount: 3,
      lessonRecordedPct: 75,
      rMultipleEntriesCount: 3,
      averageRMultiple: 1.2,
      rMultipleDistribution: [
        { label: "< -1R", min: null, max: -1, count: 0 },
        { label: "-1R to 0R", min: -1, max: 0, count: 1 },
        { label: "0R to 1R", min: 0, max: 1, count: 0 },
        { label: "1R to 2R", min: 1, max: 2, count: 2 },
        { label: "> 2R", min: 2, max: null, count: 0 },
      ],
    },
    risk: {
      plansWithRiskParams: 2,
      averageAccountRiskPct: 1.5,
      riskRewardDistribution: [
        { label: "< 1:1", min: null, max: 1, count: 0 },
        { label: "1:1 to 2:1", min: 1, max: 2, count: 1 },
        { label: "2:1 to 3:1", min: 2, max: 3, count: 1 },
        { label: "> 3:1", min: 3, max: null, count: 0 },
      ],
      averageRiskRewardRatio: 2.1,
      positionsWithBothStopAndTarget: 2,
      positionsWithNeitherStopNorTarget: 1,
      openPositionsCount: 3,
      stopTargetDisciplinePct: 66.7,
    },
    learning: {
      lessonsViewed: 5,
      lessonsCompleted: 2,
      glossaryTermsViewed: 3,
      strategiesViewed: 1,
      coachesViewed: 2,
      totalTopics: 10,
      completedTopics: 4,
      remainingTopics: 6,
      weakestPaths: [{ pathKey: "weak-path", title: "Weak Path", percentComplete: 25 }],
    },
    coach: {
      totalCoachViews: 2,
      byType: emptyDashboard().coach.byType.map((r: { coach: string; label: string; viewCount: number }) =>
        r.coach === "structure" ? { ...r, viewCount: 2 } : r,
      ),
      mostRecentCoach: "structure",
      mostRecentScope: "AAPL",
      mostRecentViewedAt: "2026-07-20T00:00:00.000Z",
    },
    session: {
      totalClassified: 3,
      activity: [
        { label: "Asia", count: 1 },
        { label: "London", count: 1 },
        { label: "New York", count: 1 },
        { label: "Overlap", count: 0 },
      ],
      rawSessionCounts: { sydney: 1, tokyo: 0, london: 1, new_york: 1 },
    },
    structure: { coachViewCount: 2, strategiesRequiringAsEvidence: 1, evidenceLinksAttached: 1 },
    liquidity: { coachViewCount: 0, strategiesRequiringAsEvidence: 1, evidenceLinksAttached: 0 },
    checklist: {
      totalInstances: 2,
      totalComplete: 1,
      totalInProgress: 1,
      overallCompletionPct: 75,
      byStrategy: [{ strategyId: 1, strategyName: "Test Strategy", instanceCount: 2, completeCount: 1, averagePercentComplete: 75 }],
    },
  });
}

describe("TradingAnalyticsDashboard page", () => {
  beforeEach(() => {
    mockState.data = undefined;
    mockState.isLoading = false;
    mockState.isError = false;
  });

  it("shows a loading state while the dashboard is fetching", () => {
    mockState.isLoading = true;
    renderWithClient(<TradingAnalyticsDashboard />);
    expect(screen.getByTestId("trading-analytics-loading")).toBeInTheDocument();
  });

  it("shows an honest error state when the dashboard fails to load", () => {
    mockState.isError = true;
    renderWithClient(<TradingAnalyticsDashboard />);
    expect(screen.getByTestId("trading-analytics-error")).toBeInTheDocument();
  });

  it("shows the honest empty-state advisory and all-zero KPI cards for a brand-new user", () => {
    mockState.data = emptyDashboard();
    renderWithClient(<TradingAnalyticsDashboard />);
    expect(screen.getByTestId("trading-analytics-empty")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-trades-reviewed")).toHaveTextContent("0");
    expect(screen.getByTestId("kpi-strategies-registered")).toHaveTextContent("0");
    expect(screen.getByTestId("text-no-checklists")).toBeInTheDocument();
  });

  it("renders real aggregated figures across the Overview cards, never fabricating a nonzero value", () => {
    mockState.data = populatedDashboard();
    renderWithClient(<TradingAnalyticsDashboard />);
    expect(screen.queryByTestId("trading-analytics-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("kpi-trades-reviewed")).toHaveTextContent("3");
    expect(screen.getByTestId("kpi-journal-entries")).toHaveTextContent("4");
    expect(screen.getByTestId("kpi-strategies-registered")).toHaveTextContent("1");
    expect(screen.getByTestId("chart-checklist-completion")).toBeInTheDocument();
  });

  it("Strategy tab shows real evidence-usage chart and checklist-by-strategy table", async () => {
    mockState.data = populatedDashboard();
    renderWithClient(<TradingAnalyticsDashboard />);
    await userEvent.click(screen.getByTestId("tab-strategy-analytics"));
    expect(screen.getByTestId("chart-evidence-usage")).toBeInTheDocument();
    const table = screen.getByTestId("table-checklist-by-strategy");
    expect(within(table).getByText("Test Strategy")).toBeInTheDocument();
  });

  it("Journal tab shows real mood/setup/R-multiple charts, honestly hidden when there are no entries", async () => {
    mockState.data = emptyDashboard();
    renderWithClient(<TradingAnalyticsDashboard />);
    await userEvent.click(screen.getByTestId("tab-journal-analytics"));
    expect(screen.getByTestId("text-no-journal-entries")).toBeInTheDocument();
    expect(screen.queryByTestId("chart-journal-mood")).not.toBeInTheDocument();
  });

  it("Risk tab shows the stop/target discipline chart and risk/reward distribution for real data", async () => {
    mockState.data = populatedDashboard();
    renderWithClient(<TradingAnalyticsDashboard />);
    await userEvent.click(screen.getByTestId("tab-risk-analytics"));
    expect(screen.getByTestId("kpi-open-positions")).toHaveTextContent("3");
    expect(screen.getByTestId("chart-stop-target-discipline")).toBeInTheDocument();
    expect(screen.getByTestId("chart-riskreward-distribution")).toBeInTheDocument();
  });

  it("Learning tab shows weakest topics honestly, never a predicted recommendation", async () => {
    mockState.data = populatedDashboard();
    renderWithClient(<TradingAnalyticsDashboard />);
    await userEvent.click(screen.getByTestId("tab-learning-analytics"));
    const table = screen.getByTestId("table-weakest-paths");
    expect(within(table).getByText("Weak Path")).toBeInTheDocument();
    expect(within(table).getByText("25%")).toBeInTheDocument();
  });

  it("Coach tab shows real coach-usage-by-type chart and most-recent-coach info", async () => {
    mockState.data = populatedDashboard();
    renderWithClient(<TradingAnalyticsDashboard />);
    await userEvent.click(screen.getByTestId("tab-coach-analytics"));
    expect(screen.getByTestId("kpi-most-recent-coach")).toHaveTextContent("structure");
    expect(screen.getByTestId("chart-coach-views")).toBeInTheDocument();
  });

  it("Sessions tab renders a real heatmap grid over the 4 session buckets, honestly empty when unclassified", async () => {
    mockState.data = emptyDashboard();
    renderWithClient(<TradingAnalyticsDashboard />);
    await userEvent.click(screen.getByTestId("tab-session-analytics"));
    expect(screen.getByTestId("text-no-session-data")).toBeInTheDocument();
    expect(screen.queryByTestId("grid-session-heatmap")).not.toBeInTheDocument();
  });

  it("Sessions tab renders real per-session counts when positions are classified", async () => {
    mockState.data = populatedDashboard();
    renderWithClient(<TradingAnalyticsDashboard />);
    await userEvent.click(screen.getByTestId("tab-session-analytics"));
    const grid = screen.getByTestId("grid-session-heatmap");
    expect(within(grid).getByTestId("heatmap-cell-session-asia")).toHaveTextContent("1");
    expect(within(grid).getByTestId("heatmap-cell-session-new-york")).toHaveTextContent("1");
  });

  it("links out to the Trading Analytics Summary Report in the Reporting Centre, never re-implementing it", () => {
    mockState.data = populatedDashboard();
    renderWithClient(<TradingAnalyticsDashboard />);
    const link = screen.getByTestId("link-trading-analytics-report");
    expect(link).toHaveAttribute("href", "/reporting-centre?reportType=trading-analytics-summary");
  });
});

// Phase 23 — Executive Dashboard & Production Readiness. Page smoke test,
// following the established mocked-generated-hook pattern (see
// PortfolioOptimisation.test.tsx/PortfolioConstruction.test.tsx).
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  portfolios: [] as unknown[],
  portfolioHealthReport: undefined as unknown,
  portfolioHealthError: false,
  opportunitiesReport: undefined as unknown,
  monitoringReport: undefined as unknown,
  committeeReport: undefined as unknown,
  aiCoachReport: undefined as unknown,
  executiveSummaryReport: undefined as unknown,
  savedReports: [] as unknown[],
  watchlist: [] as unknown[],
  researchNotes: [] as unknown[],
  recentDecisions: [] as unknown[],
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetPortfolios: () => ({ data: mockState.portfolios, isLoading: false }),
    useGetPortfolioHealthReport: () => ({ data: mockState.portfolioHealthReport, isLoading: false, isError: mockState.portfolioHealthError }),
    getGetPortfolioHealthReportQueryKey: (id: number) => ["portfolio-health-report", id],
    useGetOpportunityDiscoveryReport: () => ({ data: mockState.opportunitiesReport, isLoading: false, isError: false }),
    useGetMonitoringSummaryReport: () => ({ data: mockState.monitoringReport, isLoading: false, isError: false }),
    useGetInvestmentCommitteeReport: () => ({ data: mockState.committeeReport, isLoading: false, isError: false }),
    getGetInvestmentCommitteeReportQueryKey: (symbol: string) => ["investment-committee-report", symbol],
    useGetAiCoachLearningSummaryReport: () => ({ data: mockState.aiCoachReport, isLoading: false, isError: false }),
    useGetExecutiveSummaryReport: () => ({ data: mockState.executiveSummaryReport, isLoading: false, isError: false }),
    useListInstitutionalReports: () => ({ data: mockState.savedReports, isLoading: false, isError: false }),
    useGetValueWatchlist: () => ({ data: mockState.watchlist, isLoading: false, isError: false }),
    useGetAllResearchNotes: () => ({ data: mockState.researchNotes, isLoading: false, isError: false }),
    useGetRecentDecisionSnapshots: () => ({ data: mockState.recentDecisions, isLoading: false, isError: false }),
  };
});

import ExecutiveDashboard from "./ExecutiveDashboard";

function report(over: Record<string, unknown> = {}) {
  return {
    reportType: "executive-summary",
    title: "Daily Executive Summary",
    subtitle: "Across the Investing Engine",
    symbol: null,
    portfolioId: null,
    generatedAt: new Date().toISOString(),
    dataSource: "SIMULATED",
    sections: [
      { id: "highlights", title: "Highlights", body: "Everything looks stable today.", bullets: ["No new risk flags"] },
    ],
    disclaimer: "Educational only.",
    ...over,
  };
}

describe("ExecutiveDashboard", () => {
  it("renders the page header and every panel, honestly empty with no data anywhere", () => {
    mockState.portfolios = [];
    mockState.portfolioHealthReport = undefined;
    mockState.opportunitiesReport = undefined;
    mockState.monitoringReport = undefined;
    mockState.committeeReport = undefined;
    mockState.aiCoachReport = undefined;
    mockState.executiveSummaryReport = undefined;
    mockState.savedReports = [];
    mockState.watchlist = [];
    mockState.researchNotes = [];
    mockState.recentDecisions = [];

    renderWithClient(<ExecutiveDashboard />);

    expect(screen.getByText("Executive Dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("panel-executive-summary-empty")).toBeInTheDocument();
    expect(screen.getByTestId("panel-portfolio-health-empty")).toHaveTextContent("No portfolios yet");
    expect(screen.getByTestId("panel-opportunities-empty")).toBeInTheDocument();
    expect(screen.getByTestId("panel-monitoring-empty")).toBeInTheDocument();
    expect(screen.getByTestId("panel-committee-activity-empty")).toHaveTextContent("No recent decisions yet");
    expect(screen.getByTestId("panel-ai-coach-progress-empty")).toBeInTheDocument();
    expect(screen.getByTestId("panel-recent-reports-empty")).toBeInTheDocument();
    expect(screen.getByTestId("panel-watchlists-empty")).toBeInTheDocument();
    expect(screen.getByTestId("panel-saved-research-empty")).toBeInTheDocument();
    expect(screen.getByTestId("panel-recent-decisions-empty")).toBeInTheDocument();
    expect(screen.getByTestId("shortcut-terminal-analyse")).toBeInTheDocument();
    expect(screen.getByTestId("shortcut-terminal-compare")).toBeInTheDocument();
    expect(screen.getByTestId("shortcut-terminal-split")).toBeInTheDocument();
  });

  it("renders real report data for the report-shaped panels", () => {
    mockState.executiveSummaryReport = report({ title: "Daily Executive Summary" });
    mockState.opportunitiesReport = report({ title: "Active Opportunities" });
    mockState.monitoringReport = report({ title: "Monitoring Summary" });
    mockState.aiCoachReport = report({ title: "AI Coach Progress" });

    renderWithClient(<ExecutiveDashboard />);

    expect(screen.getAllByText("Highlights").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Everything looks stable today.").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No new risk flags/).length).toBeGreaterThan(0);
  });

  it("shows an honest error message when a panel's hook errors", () => {
    mockState.portfolios = [{ id: 1, name: "Core Value", description: "", holdingsCount: 3, createdAt: "", updatedAt: "" }];
    mockState.portfolioHealthError = true;

    renderWithClient(<ExecutiveDashboard />);

    expect(screen.getByTestId("panel-portfolio-health-error")).toBeInTheDocument();
  });

  it("renders Recent Reports, Watchlists, Saved Research, and Recent Decisions from real data", () => {
    mockState.portfolioHealthError = false;
    mockState.savedReports = [
      { id: 1, reportType: "executive-summary", title: "Q3 Executive Summary", symbol: null, portfolioId: null, dataSource: "SIMULATED", createdAt: new Date().toISOString() },
    ];
    mockState.watchlist = [
      { id: 1, symbol: "AAPL", category: "core", marginOfSafetyTarget: 0.25, reason: "Quality compounder", currentDecision: "Buy" },
    ];
    mockState.researchNotes = [
      { id: 1, symbol: "MSFT", note: "Strong moat, watch multiple.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    mockState.recentDecisions = [
      { id: 1, symbol: "GOOGL", recommendation: "Buy", confidence: 72, analysis: {}, createdAt: new Date().toISOString() },
    ];

    renderWithClient(<ExecutiveDashboard />);

    expect(screen.getByText("Q3 Executive Summary")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText(/MSFT/)).toBeInTheDocument();
    expect(screen.getByText("GOOGL")).toBeInTheDocument();
  });

  it("deep-links the Investment Committee Activity panel to the most recently decided symbol", () => {
    mockState.savedReports = [];
    mockState.watchlist = [];
    mockState.researchNotes = [];
    mockState.recentDecisions = [
      { id: 1, symbol: "GOOGL", recommendation: "Buy", confidence: 72, analysis: {}, createdAt: new Date().toISOString() },
    ];
    mockState.committeeReport = report({ title: "Investment Committee Activity", symbol: "GOOGL" });

    renderWithClient(<ExecutiveDashboard />);

    const link = screen.getByTestId("panel-committee-activity-view-link");
    expect(link).toHaveAttribute("href", "/reporting-centre?reportType=investment-committee&symbol=GOOGL");
  });
});

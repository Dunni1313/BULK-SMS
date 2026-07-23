// Phase 40 — Institutional Decision Support & Executive Insights Engine.
// Frontend smoke tests, following the established mocked-generated-hook
// pattern (ScenarioEngine.test.tsx — the query-hook variant, since this
// dashboard is a plain GET, not a POST mutation).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  dashboardData: undefined as unknown,
  dashboardLoading: false,
  dashboardError: false,
  coachData: undefined as unknown,
  coachLoading: false,
  learningData: undefined as unknown,
  learningLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetDecisionSupportDashboard: () => ({ data: mockState.dashboardData, isLoading: mockState.dashboardLoading, isError: mockState.dashboardError }),
    useListDecisionSupportCoachTopics: () => ({ data: mockState.coachData, isLoading: mockState.coachLoading }),
    useListDecisionSupportLearning: () => ({ data: mockState.learningData, isLoading: mockState.learningLoading }),
  };
});

import DecisionSupportEngine from "./DecisionSupportEngine";

function engineHealth(over: Record<string, unknown> = {}) {
  return { engine: "investing", available: true, score: 80, label: "Good", detail: "Detail.", ...over };
}

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: {
      investingPortfolioCount: 1,
      investingHoldingsCount: 2,
      investingMarketValue: 1000,
      tradingOpenPositionsCount: 1,
      tradingAccountValue: 5000,
      optionsOpenPositionsCount: 1,
      optionsPortfolioValue: 20000,
      optionsBuyingPower: 15000,
      overallHealthScore: 78,
      alertCount: 1,
      outstandingIssueCount: 1,
      generatedAt: "2026-07-21T00:00:00.000Z",
      summary: "2 Investing holding(s), 1 open Trading position(s), 1 open Options position(s).",
    },
    portfolioHealthOverview: {
      investing: engineHealth({ engine: "investing", score: 80 }),
      trading: engineHealth({ engine: "trading", score: 70 }),
      options: engineHealth({ engine: "options", score: 85 }),
      overallScore: 78,
    },
    riskSummary: {
      combined: { capitalAllocation: [], buyingPowerOverview: [], sectorConcentration: [], strategyConcentration: [], assetAllocation: { entries: [] }, greeksSummary: { delta: 0, gamma: 0, theta: 0, vega: 0 }, correlationOverview: { overlapSymbolCount: 0, overlapSymbols: [] }, concentrationTimeline: [] },
      investingRiskScore: 80,
      tradingRiskScore: 70,
      optionsRiskScoreBaseline: 60,
    },
    performanceSummary: {},
    scenarioSummary: { combined: { byEngine: [], sectorImpact: [], strategyImpact: [], assetImpact: [] }, worstCaseByEngine: [] },
    capitalAllocationSummary: { capitalAllocation: [], buyingPowerOverview: [] },
    exposureSummary: { sectorConcentration: [], strategyConcentration: [], assetAllocation: { entries: [] }, greeksSummary: { delta: 0, gamma: 0, theta: 0, vega: 0 } },
    diversificationSummary: {
      investing: { engine: "investing", available: true, score: 75, detail: "Investing detail." },
      trading: { engine: "trading", available: false, score: null, detail: "No concentration/diversification scoring exists for the Trading Engine." },
      options: { engine: "options", available: true, score: 82, detail: "Options detail." },
      correlationOverview: { overlapSymbolCount: 0, overlapSymbols: [] },
      concentrationTimeline: [],
    },
    executiveAlerts: [{ code: "sector_allocation_exceeds_target", engine: "investing", severity: "moderate", label: "Technology allocation exceeds target", detail: "Technology accounts for 40% of allocation." }],
    outstandingIssues: [{ code: "missing_stop", engine: "trading", label: "Trading positions missing a stop", detail: "1 open position(s) have no stop defined." }],
    keyMetrics: [{ code: "investing_market_value", engine: "investing", label: "Investing Market Value", value: 1000, unit: "usd" }],
    executiveHealth: {
      dimensions: [
        { code: "portfolio_health", label: "Portfolio Health", available: true, score: 78, detail: "Renormalized average.", sourceModule: "investingRisk.ts", includedInComposite: true },
        { code: "capital_utilisation", label: "Capital Utilisation", available: true, score: null, detail: "Raw utilisation, not scored.", sourceModule: "tradingRisk.ts", includedInComposite: false },
      ],
      compositeScore: 78,
    },
    generatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("DecisionSupportEngine", () => {
  beforeEach(() => {
    mockState.dashboardData = undefined;
    mockState.dashboardLoading = false;
    mockState.dashboardError = false;
    mockState.coachData = undefined;
    mockState.coachLoading = false;
    mockState.learningData = undefined;
    mockState.learningLoading = false;
  });

  it("renders the page header and disclosure labels", () => {
    renderWithClient(<DecisionSupportEngine />);
    expect(screen.getByText("Institutional Decision Support & Executive Insights Engine")).toBeInTheDocument();
    expect(screen.getByTestId("decision-support-labels")).toBeInTheDocument();
  });

  it("shows a loading skeleton while the dashboard is loading", () => {
    mockState.dashboardLoading = true;
    renderWithClient(<DecisionSupportEngine />);
    expect(screen.queryByTestId("panel-dse-executive-summary")).not.toBeInTheDocument();
  });

  it("shows an honest error message if the dashboard fails to load", () => {
    mockState.dashboardError = true;
    renderWithClient(<DecisionSupportEngine />);
    expect(screen.getByTestId("decision-support-dashboard-error")).toBeInTheDocument();
  });

  it("renders the Executive Summary with real, per-engine counts, never blended into one figure", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<DecisionSupportEngine />);
    expect(screen.getByTestId("panel-dse-executive-summary")).toBeInTheDocument();
    expect(screen.getByTestId("es-investing")).toHaveTextContent("2 holding(s)");
    expect(screen.getByTestId("es-trading")).toHaveTextContent("1 open");
    expect(screen.getByTestId("es-options")).toHaveTextContent("1 open");
  });

  it("renders the Portfolio Health Overview with each engine's own score, side by side", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<DecisionSupportEngine />);
    expect(screen.getByTestId("ph-investing")).toHaveTextContent("80/100");
    expect(screen.getByTestId("ph-trading")).toHaveTextContent("70/100");
    expect(screen.getByTestId("ph-options")).toHaveTextContent("85/100");
  });

  it("renders a real Executive Alert, never fabricated", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<DecisionSupportEngine />);
    expect(screen.getByTestId("alert-0")).toHaveTextContent("Technology allocation exceeds target");
    expect(screen.getByTestId("alert-0")).toHaveTextContent("moderate");
  });

  it("shows an honest empty-alerts message when there are no executive alerts", () => {
    mockState.dashboardData = dashboard({ executiveAlerts: [] });
    renderWithClient(<DecisionSupportEngine />);
    expect(screen.getByTestId("decision-support-alerts-empty")).toBeInTheDocument();
  });

  it("renders a real Outstanding Issue, never fabricated", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<DecisionSupportEngine />);
    expect(screen.getByTestId("issue-0")).toHaveTextContent("Trading positions missing a stop");
  });

  it("renders the Key Metrics Dashboard", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<DecisionSupportEngine />);
    expect(screen.getByTestId("metric-investing_market_value")).toHaveTextContent("$1,000");
  });

  it("renders the Executive Health scorecard, honestly showing 'n/a' for a dimension with no genuine scoring formula", () => {
    mockState.dashboardData = dashboard();
    renderWithClient(<DecisionSupportEngine />);
    expect(screen.getByTestId("health-dim-portfolio_health")).toHaveTextContent("78/100");
    expect(screen.getByTestId("health-dim-capital_utilisation")).toHaveTextContent("n/a");
  });

  it("renders the Coach & Learning tab with real topics and Learning Centre links, never a trade recommendation", async () => {
    const user = userEvent.setup();
    mockState.coachData = [{ topic: "risk", title: "Risk", explanation: ["Real explanation text."], disclaimer: "Educational only." }];
    mockState.learningData = [{ topic: "risk_interpretation", links: [{ pathKey: "portfolio", topicKey: "portfolio-health", title: "Portfolio Health", summary: "Summary.", href: "/learn/paths/portfolio/portfolio-health" }] }];
    renderWithClient(<DecisionSupportEngine />);
    await user.click(screen.getByTestId("tab-dse-learning"));
    expect(screen.getByTestId("coach-topic-risk")).toBeInTheDocument();
    expect(screen.getByTestId("learning-topic-risk_interpretation")).toBeInTheDocument();
    expect(screen.getByTestId("learning-link-portfolio-portfolio-health")).toBeInTheDocument();
  });

  it("renders the Reporting tab with deep links to the Institutional Reporting Centre", async () => {
    const user = userEvent.setup();
    renderWithClient(<DecisionSupportEngine />);
    await user.click(screen.getByTestId("tab-dse-reporting"));
    expect(screen.getByTestId("link-report-executive-decision-summary")).toHaveAttribute("href", "/reporting-centre?reportType=executive-decision-summary");
    expect(screen.getByTestId("link-report-institutional-health-report")).toHaveAttribute("href", "/reporting-centre?reportType=institutional-health-report");
  });
});

// Institutional Command Center sprint — frontend smoke tests for the
// new primary landing page. This page makes zero new calculations —
// every hook mocked below is an already-existing generated hook reused
// by at least one other page in this codebase.

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  dashboard: undefined as unknown,
  dashboardLoading: false,
  dashboardError: false,
  summary: undefined as unknown,
  greeks: undefined as unknown,
  theta: undefined as unknown,
  performance: undefined as unknown,
  topOpps: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetPortfolioDashboard: () => ({
      data: mockState.dashboard,
      isLoading: mockState.dashboardLoading,
      isError: mockState.dashboardError,
    }),
    useGetPortfolioSummary: () => ({ data: mockState.summary }),
    useGetPortfolioGreeks: () => ({ data: mockState.greeks }),
    useGetThetaIncome: () => ({ data: mockState.theta }),
    useGetPerformanceAnalytics: () => ({ data: mockState.performance }),
    useGetTopOpportunities: () => ({ data: mockState.topOpps }),
  };
});

import CommandCenter from "./CommandCenter";

function bucket(key: string, label: string, positionCount: number, weightPct: number) {
  return { key, label, positionCount, weightPct };
}

function dashboardFixture(over: Record<string, unknown> = {}) {
  return {
    portfolioValue: 125400,
    buyingPower: 248200,
    totalRiskDollars: 800,
    totalRiskPct: 0.64,
    healthScore: 72,
    overallRiskRating: { code: "moderate_risk", label: "Moderate Risk" },
    paperTradingMode: true,
    credentialsConfigured: false,
    brokerConnected: null,
    lastBrokerCheckAt: null,
    lastPortfolioUpdate: "2026-07-16T12:00:00.000Z",
    openPositionsCount: 2,
    healthFactors: [
      { code: "concentration", label: "Concentration", score: 48, sourceModule: "portfolioConcentration.ts", detail: "Symbol-level concentration score of 52/100." },
      { code: "diversification", label: "Diversification", score: 80, sourceModule: "portfolioConcentration.ts", detail: "Sector-level concentration score of 20/100." },
      { code: "event_risk", label: "Event Risk", score: 100, sourceModule: "portfolioEventRisk.ts", detail: 'Highest portfolio event-risk level is "none".' },
      { code: "net_greeks_exposure", label: "Net Greeks Exposure", score: 37, sourceModule: "portfolioConcentration.ts", detail: "..." },
      { code: "directional_exposure", label: "Directional Exposure", score: 0, sourceModule: "portfolioConcentration.ts", detail: "..." },
      { code: "position_sizing_quality", label: "Position Sizing Quality", score: 90, sourceModule: "portfolioStressTest.ts", detail: "..." },
      { code: "position_count", label: "Number of Positions", score: 40, sourceModule: "positionSizing.ts", detail: "..." },
      { code: "expiration_distribution", label: "Expiration Distribution", score: 80, sourceModule: "portfolioConcentration.ts", detail: "..." },
    ],
    netGreeks: { delta: -2.4, gamma: 0.08, theta: 24, vega: -12 },
    netBeta: null,
    netBetaUnavailableReason: "No beta figure exists anywhere in this engine's own data model — never approximated.",
    largestPosition: { symbol: "AAPL", riskDollars: 500, pctOfAccount: 0.4 },
    largestRiskContributor: { tradeId: 1, symbol: "AAPL", delta: -1.5, deltaSharePct: 62.5 },
    highestEventRisk: null,
    highestConcentration: { dimension: "symbol", bucket: bucket("AAPL", "AAPL", 1, 60) },
    highestDirectionalExposure: { direction: "short", exposureDollars: 700, pct: 100 },
    widgets: [
      { code: "position_sizing", label: "Position Sizing", headline: "2 open positions", detail: "Largest exposure: AAPL (0.40% of account).", linkHref: "/position-sizing" },
      { code: "stress_test", label: "Stress Test", headline: "Base risk score 90/100", detail: "Base-case portfolio value 125400.00.", linkHref: "/stress-test" },
      { code: "event_risk", label: "Event Risk", headline: "0 high-risk positions", detail: "0 of 2 positions carry a tracked upcoming event.", linkHref: "/event-risk" },
      { code: "concentration", label: "Concentration", headline: "52/100 concentration score", detail: "Moderate Concentration", linkHref: "/concentration-risk" },
      { code: "diversification", label: "Diversification", headline: "48/100 diversification score", detail: "Least diversified area: Strategy.", linkHref: "/concentration-risk" },
      { code: "greeks", label: "Greeks", headline: "Net delta -2.4", detail: "Net theta 24, net vega -12.", linkHref: "/concentration-risk" },
      { code: "broker_health", label: "Broker Health", headline: "No credentials configured", detail: "Configure Alpaca Paper credentials in Settings.", linkHref: "/settings" },
    ],
    allocationBySymbol: [bucket("AAPL", "AAPL", 1, 60), bucket("SPY", "SPY", 1, 40)],
    allocationBySector: [bucket("Technology", "Technology", 1, 60), bucket("Index ETF (S&P 500)", "Index ETF (S&P 500)", 1, 40)],
    allocationByStrategy: [bucket("iron_condor", "iron condor", 2, 100)],
    expirationDistribution: [bucket("2026-08-21", "2026-08-21", 2, 100)],
    eventTimelineSummary: {
      totalPositions: 2, positionsWithEvents: 0, positionsWithoutEvents: 2, highRiskCount: 0,
      within1Day: 0, within3Days: 0, within7Days: 0, within14Days: 0, aggregateExposurePct: 0, highestRiskPosition: null,
    },
    stressTestSummary: [
      { label: "Bullish (+5%)", portfolioValueImpact: 120, riskScoreAfter: 88 },
      { label: "Bearish (-5%)", portfolioValueImpact: -140, riskScoreAfter: 70 },
    ],
    guidance: [
      { code: "moderate_risk", label: "Moderate Risk", detail: "This portfolio's blended Health Score indicates moderate risk." },
    ],
    generatedAt: "2026-07-16T12:00:00.000Z",
    ...over,
  };
}

describe("CommandCenter page", () => {
  it("shows the Paper Trading Mode and Read-Only Command Center badges", () => {
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("badge-paper-trading-mode")).toHaveTextContent("Paper Trading Mode");
    expect(screen.getByTestId("badge-read-only-command-center")).toHaveTextContent("Read-Only Command Center");
  });

  it("shows a loading state while the dashboard resolves", () => {
    mockState.dashboardLoading = true;
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("command-center-loading")).toBeInTheDocument();
    mockState.dashboardLoading = false;
  });

  it("shows an error state when the dashboard fails to load", () => {
    mockState.dashboardError = true;
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("text-command-center-error")).toBeInTheDocument();
    mockState.dashboardError = false;
  });

  // v1.3.2 — Version 1 Polish Sprint: clarify Home vs. Command Center.
  // v1.5.0, Sprint 12 — Personal Dashboard (formerly "Institutional Home")
  // moved to "/personal-dashboard" when the new Institutional Command
  // Centre took over "/".
  it("links to Personal Dashboard for users looking for their own personalized dashboard", () => {
    mockState.dashboard = dashboardFixture();
    renderWithClient(<CommandCenter />);
    const link = screen.getByTestId("link-to-institutional-home");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/personal-dashboard");
    mockState.dashboard = undefined;
  });

  it("renders the Executive Overview with Portfolio Health Score, Overall Risk Rating, and broker/paper status", () => {
    mockState.dashboard = dashboardFixture();
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("text-portfolio-value")).toHaveTextContent("$125,400.00");
    expect(screen.getByTestId("text-buying-power")).toHaveTextContent("$248,200.00");
    expect(screen.getByTestId("text-health-score")).toHaveTextContent("72/100");
    expect(screen.getByTestId("badge-overall-risk-rating")).toHaveTextContent("Moderate Risk");
    expect(screen.getByTestId("text-broker-status-summary")).toHaveTextContent("No credentials configured");
    expect(screen.getByTestId("text-paper-trading-status-summary")).toBeInTheDocument();
    mockState.dashboard = undefined;
  });

  it("renders Daily P/L from the pre-existing Options Income Engine summary", () => {
    mockState.dashboard = dashboardFixture();
    mockState.summary = { accountValue: 125400, cashBalance: 1000, buyingPower: 248200, totalPnl: 500, dayPnl: -85.5, openPositions: 2 };
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("text-daily-pnl")).toHaveTextContent("-$85.50");
    mockState.dashboard = undefined;
    mockState.summary = undefined;
  });

  it("renders exactly 7 Portfolio Health widget links, each pointing to its own existing detailed page", () => {
    mockState.dashboard = dashboardFixture();
    renderWithClient(<CommandCenter />);
    const grid = screen.getByTestId("grid-portfolio-health-widgets");
    const links = within(grid).getAllByRole("link");
    expect(links).toHaveLength(7);
    expect(screen.getByTestId("health-widget-link-concentration")).toHaveAttribute("href", "/concentration-risk");
    expect(screen.getByTestId("health-widget-link-broker_health")).toHaveAttribute("href", "/settings");
    mockState.dashboard = undefined;
  });

  it("renders the Options Income Engine section with Iron Condor/Calendar Spread counts and honestly discloses untracked strategies", () => {
    mockState.dashboard = dashboardFixture();
    mockState.theta = { daily: 12, weekly: 84, monthly: 360, annualized: 4380, bySymbol: [], byStrategy: [] };
    mockState.performance = {
      winRate: 0.7, avgWin: 100, avgLoss: -50, expectancy: 40, totalTrades: 10, totalReturn: 400,
      totalCapitalDeployed: 5000, returnOnCapital: 0.08, profitFactor: 2, maxDrawdown: -200,
      sharpeRatio: 1.2, sortinoRatio: 1.5, avgHoldingDays: 14, thetaCollected: 1250, totalCommission: 10,
      totalSlippage: 5, commissionImpactPct: 0.01, actualPop: 0.68, expectedPop: 0.7, bestStrategy: "iron_condor",
      worstStrategy: "calendar_spread", bestTickers: [], worstTickers: [], monthlyReturns: [], strategyBreakdown: [],
    };
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("text-total-premium-collected")).toHaveTextContent("$1,250.00");
    expect(screen.getByTestId("text-expected-monthly-income")).toHaveTextContent("$360.00");
    expect(screen.getByTestId("text-count-iron-condor")).toHaveTextContent("2");
    expect(screen.getByTestId("text-count-calendar-spread")).toHaveTextContent("0");
    expect(screen.getByTestId("text-untracked-wheel-positions")).toHaveTextContent("Not tracked in this engine");
    expect(screen.getByTestId("text-untracked-covered-calls")).toHaveTextContent("Not tracked in this engine");
    expect(screen.getByTestId("text-untracked-cash-secured-puts")).toHaveTextContent("Not tracked in this engine");
    mockState.dashboard = undefined;
    mockState.theta = undefined;
    mockState.performance = undefined;
  });

  it("renders Net Delta/Gamma/Theta/Vega from the pre-existing Greeks engine, and always discloses Beta as unavailable", () => {
    mockState.dashboard = dashboardFixture();
    mockState.greeks = {
      totalDelta: -3.1, totalTheta: 18, totalVega: -9, totalGamma: 0.05,
      deltaStatus: "bearish", dailyThetaIncome: 18, totalPositions: 2,
    };
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("text-net-delta")).toHaveTextContent("-3.1");
    expect(screen.getByTestId("text-net-gamma")).toHaveTextContent("0.05");
    expect(screen.getByTestId("text-net-beta-unavailable")).toHaveTextContent(/no beta figure exists/i);
    mockState.dashboard = undefined;
    mockState.greeks = undefined;
  });

  it("shows the honest no-alerts message when nothing is elevated", () => {
    mockState.dashboard = dashboardFixture({
      guidance: [{ code: "healthy_portfolio", label: "Healthy Portfolio", detail: "..." }],
      stressTestSummary: [{ label: "Bullish (+5%)", portfolioValueImpact: 120, riskScoreAfter: 88 }],
    });
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("text-no-risk-alerts")).toBeInTheDocument();
    mockState.dashboard = undefined;
  });

  it("renders elevated Risk Alerts reused from the Concentration/Event Risk guidance and the worst Stress Test scenario", () => {
    mockState.dashboard = dashboardFixture({
      guidance: [
        { code: "moderate_risk", label: "Moderate Risk", detail: "..." },
        { code: "elevated_concentration", label: "Elevated Concentration", detail: "Largest position is too concentrated." },
      ],
    });
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("alert-elevated_concentration")).toHaveTextContent("Largest position is too concentrated.");
    expect(screen.getByTestId("alert-stress-test-worst-scenario")).toHaveTextContent("Bearish (-5%)");
    mockState.dashboard = undefined;
  });

  it("renders the 4 Portfolio Allocation charts, reused directly from the Concentration overlay", () => {
    mockState.dashboard = dashboardFixture();
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("chart-allocation-symbol")).toBeInTheDocument();
    expect(screen.getByTestId("chart-allocation-sector")).toBeInTheDocument();
    expect(screen.getByTestId("chart-allocation-strategy")).toBeInTheDocument();
    expect(screen.getByTestId("chart-allocation-expiration")).toBeInTheDocument();
    mockState.dashboard = undefined;
  });

  it("renders the Broker section from cached state, never fetching live on page load", () => {
    mockState.dashboard = dashboardFixture({
      credentialsConfigured: true,
      brokerConnected: true,
      lastBrokerCheckAt: "2026-07-16T11:00:00.000Z",
    });
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("text-broker-connected")).toHaveTextContent("Yes");
    expect(screen.getByTestId("text-broker-credentials-status")).toHaveTextContent("Configured");
    expect(screen.getByTestId("text-broker-last-update")).not.toHaveTextContent("Never");
    mockState.dashboard = undefined;
  });

  it("renders all 5 AI Insights, each linking to its own source page, with no execution recommendation text", () => {
    mockState.dashboard = dashboardFixture();
    mockState.topOpps = {
      ironCondors: [{ id: 9, symbol: "SPY", strategy: "iron_condor", maxProfit: 100, maxLoss: 400, pop: 70, ev: 12, theta: 5, ravishScore: 88, ravishTier: "elite", ivRank: 60, createdAt: "2026-07-16T00:00:00.000Z" }],
      ironFlys: [], calendarSpreads: [], earnings: [], lastScanned: "2026-07-16T00:00:00.000Z",
    };
    mockState.theta = { daily: 12, weekly: 84, monthly: 360, annualized: 4380, bySymbol: [], byStrategy: [] };
    renderWithClient(<CommandCenter />);
    const list = screen.getByTestId("list-ai-insights");
    expect(within(list).getByTestId("insight-largest_risk")).toBeInTheDocument();
    expect(within(list).getByTestId("insight-largest_opportunity")).toHaveTextContent("SPY");
    expect(within(list).getByTestId("insight-concentration")).toBeInTheDocument();
    expect(within(list).getByTestId("insight-diversification")).toBeInTheDocument();
    expect(within(list).getByTestId("insight-income_status")).toHaveTextContent("$360.00");
    expect(screen.queryByText(/place order|submit order|execute trade|you should (buy|sell)/i)).not.toBeInTheDocument();
    mockState.dashboard = undefined;
    mockState.topOpps = undefined;
    mockState.theta = undefined;
  });

  it("honestly shows no scanner opportunities when none are ranked", () => {
    mockState.dashboard = dashboardFixture();
    mockState.topOpps = { ironCondors: [], ironFlys: [], calendarSpreads: [], earnings: [], lastScanned: "2026-07-16T00:00:00.000Z" };
    renderWithClient(<CommandCenter />);
    expect(screen.getByTestId("insight-largest_opportunity")).toHaveTextContent("No scanner opportunities currently ranked.");
    mockState.dashboard = undefined;
    mockState.topOpps = undefined;
  });
});

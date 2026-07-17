// AI Portfolio Analyst sprint — Phase 8, Sprint 3. Frontend smoke tests
// for the AI Portfolio Analyst page, mirroring
// InstitutionalIntelligence.test.tsx's/CommandCenter.test.tsx's own
// established mocked-generated-hook pattern.

import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isError: false,
  summary: undefined as unknown,
  performance: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetPortfolioAnalyst: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
    useGetPortfolioSummary: () => ({ data: mockState.summary }),
    useGetPerformanceAnalytics: () => ({ data: mockState.performance }),
  };
});

import PortfolioAnalyst from "./PortfolioAnalyst";

function crossLink(over: Record<string, unknown> = {}) {
  return {
    category: "portfolio_health",
    lessonHref: "/learn/paths/portfolio_health",
    lessonTitle: "Reading Portfolio Health",
    glossaryHref: "/learn/glossary/portfolio-health",
    glossaryTerm: "Portfolio Health",
    strategyHref: "/learn/strategy-academy/iron_condor",
    strategyLabel: "Iron Condor",
    ...over,
  };
}

function resultFixture(over: Record<string, unknown> = {}) {
  return {
    paperTradingMode: true,
    deterministicAnalysis: true,
    executiveBriefing: {
      headline: "Portfolio Health remains strong.",
      bullets: [
        "Portfolio Health remains strong.",
        "Concentration remains moderate.",
        "No elevated Event Risk detected.",
        "Buying Power remains healthy.",
      ],
      generatedAt: "2026-07-16T12:00:00.000Z",
    },
    snapshot: {
      healthScore: 90,
      overallRiskRating: { code: "healthy", label: "Healthy" },
      buyingPower: 100000,
      openPositionsCount: 3,
      monthlyTheta: 450,
      dailyTheta: 15,
      totalRiskDollars: 5000,
      totalRiskPct: 4,
      generatedAt: "2026-07-16T12:00:00.000Z",
    },
    healthSummary: {
      overallHealthScore: 90,
      overallRiskRating: { code: "healthy", label: "Healthy" },
      trend: "insufficient_history",
      trendDetail: "No prior recorded snapshot exists yet.",
      strengths: [{ code: "diversification", label: "Diversification", score: 95, detail: "Well spread." }],
      weaknesses: [{ code: "concentration", label: "Concentration", score: 70, detail: "Moderate concentration." }],
      drivers: [
        { code: "concentration", label: "Concentration", score: 70, detail: "Moderate concentration." },
        { code: "diversification", label: "Diversification", score: 95, detail: "Well spread." },
      ],
      summary: "Portfolio Health is healthy at 90/100.",
    },
    riskSummary: {
      highestRisk: "No elevated risk detected",
      riskTrend: "insufficient_history",
      largestExposure: "AAPL (25.00% of account)",
      diversificationScore: 95,
      worstStressScenario: { label: "Market Crash (-20%)", portfolioValueImpact: -2000, riskScoreAfter: 40 },
      guidance: [],
    },
    incomeSummary: {
      monthlyTheta: 450,
      weeklyTheta: 100,
      dailyTheta: 15,
      annualizedTheta: 5400,
      incomeHealth: "insufficient_history",
      incomeHealthDetail: "No prior recorded snapshot exists yet — income trend will be available after the next recorded day.",
      bySymbol: [{ key: "AAPL", label: "AAPL", positionCount: 1, weightPct: 100 }],
      byStrategy: [{ key: "iron_condor", label: "Iron Condor", positionCount: 3, weightPct: 100 }],
    },
    greeksSummary: {
      delta: 12.5,
      gamma: 0.8,
      theta: 45.2,
      vega: -10.1,
      largestContributor: { tradeId: 1, symbol: "AAPL", delta: 8, deltaSharePct: 64 },
      deltaTrend: "insufficient_history",
      deltaTrendDetail: "No prior recorded snapshot exists yet — Delta trend will be available after the next recorded day.",
      educationalLinks: [{ label: "Understanding Greeks", href: "/learn/greeks", comingSoon: false }],
    },
    eventSummary: {
      upcomingEvents: {
        totalPositions: 3,
        positionsWithEvents: 1,
        positionsWithoutEvents: 2,
        highRiskCount: 0,
        within1Day: 0,
        within3Days: 0,
        within7Days: 1,
        within14Days: 1,
        aggregateExposurePct: 20,
        highestRiskPosition: null,
      },
      highestRiskEvent: null,
      safePositionsCount: 3,
      atRiskPositionsCount: 0,
      expirationClusters: [{ key: "2026-08-15", label: "Aug 15, 2026", positionCount: 3, weightPct: 100 }],
    },
    learningSummary: {
      health: crossLink({ category: "portfolio_health" }),
      risk: crossLink({ category: "concentration", strategyLabel: "Vertical Spread", strategyHref: "/learn/strategy-academy/vertical_spread" }),
      income: crossLink({ category: "theta_income", strategyLabel: "Covered Call", strategyHref: "/learn/strategy-academy/covered_call" }),
      greeks: crossLink({ category: "greeks_exposure" }),
      event: crossLink({ category: "event_risk", strategyLabel: "Calendar Spread", strategyHref: "/learn/strategy-academy/calendar_spread" }),
    },
    timeline: {
      asOf: "2026-07-16T12:00:00.000Z",
      comparedTo: null,
      newIssues: [],
      resolvedIssues: [],
      persistentIssues: [],
      healthChange: null,
      incomeChange: null,
      thisWeek: { daysRecorded: 0, healthScoreMin: null, healthScoreMax: null, trend: "insufficient_history" },
    },
    institutionalInsights: [{ text: "Portfolio remains well diversified.", category: "diversification" }],
    generatedAt: "2026-07-16T12:00:00.000Z",
    ...over,
  };
}

function summaryFixture(over: Record<string, unknown> = {}) {
  return {
    accountValue: 125000,
    cashBalance: 100000,
    buyingPower: 100000,
    totalPnl: 5000,
    totalPnlPercent: 4,
    dayPnl: 250,
    dayPnlPercent: 0.2,
    openPositions: 3,
    maxRiskUsed: 4,
    ...over,
  };
}

function performanceFixture(over: Record<string, unknown> = {}) {
  return {
    winRate: 0.72,
    avgWin: 180,
    avgLoss: -220,
    expectancy: 65,
    totalTrades: 220,
    totalReturn: 8400,
    totalCapitalDeployed: 50000,
    returnOnCapital: 16.8,
    profitFactor: 1.8,
    maxDrawdown: 6.2,
    sharpeRatio: 1.4,
    sortinoRatio: 1.9,
    avgHoldingDays: 18,
    thetaCollected: 3200,
    totalCommission: 220,
    totalSlippage: 40,
    commissionImpactPct: 0.5,
    actualPop: 0.7,
    expectedPop: 0.68,
    bestStrategy: "iron_condor",
    worstStrategy: "calendar_spread",
    bestTickers: [],
    worstTickers: [],
    monthlyReturns: [],
    strategyBreakdown: [],
    ...over,
  };
}

describe("PortfolioAnalyst page", () => {
  it("shows all 5 permanent indicator badges", () => {
    mockState.data = resultFixture();
    mockState.summary = summaryFixture();
    mockState.performance = performanceFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("badge-ai-portfolio-analyst")).toHaveTextContent("AI Portfolio Analyst");
    expect(screen.getByTestId("badge-institutional-intelligence-analyst")).toHaveTextContent("Institutional Intelligence");
    expect(screen.getByTestId("badge-deterministic-analysis-analyst")).toHaveTextContent("Deterministic Analysis");
    expect(screen.getByTestId("badge-paper-trading-analyst")).toHaveTextContent("Paper Trading");
    expect(screen.getByTestId("badge-read-only-analyst")).toHaveTextContent("Read Only");
    mockState.data = undefined;
    mockState.summary = undefined;
    mockState.performance = undefined;
  });

  it("shows a loading state while the result resolves", () => {
    mockState.isLoading = true;
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("portfolio-analyst-loading")).toBeInTheDocument();
    mockState.isLoading = false;
  });

  it("shows an error state when the result fails to load", () => {
    mockState.isError = true;
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-portfolio-analyst-error")).toBeInTheDocument();
    mockState.isError = false;
  });

  it("renders the Executive Daily Briefing headline and bullets", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-briefing-headline")).toHaveTextContent("Portfolio Health remains strong.");
    expect(screen.getByTestId("list-briefing-bullets")).toHaveTextContent("Buying Power remains healthy.");
    mockState.data = undefined;
  });

  it("renders the Portfolio Snapshot with Health, Buying Power, Open Positions, and Monthly Theta", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-snapshot-health-score")).toHaveTextContent("90/100");
    expect(screen.getByTestId("text-snapshot-open-positions")).toHaveTextContent("3");
    expect(screen.getByTestId("text-snapshot-monthly-theta")).toHaveTextContent("$450.00");
    mockState.data = undefined;
  });

  it("Net Liquidation and Daily P/L reuse the pre-existing Portfolio Summary hook, never fabricated when unavailable", () => {
    mockState.data = resultFixture();
    mockState.summary = undefined;
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-snapshot-net-liq")).toHaveTextContent("—");
    expect(screen.getByTestId("text-snapshot-daily-pl")).toHaveTextContent("—");
    mockState.data = undefined;
  });

  it("Net Liquidation and Daily P/L render real figures once the Portfolio Summary hook resolves", () => {
    mockState.data = resultFixture();
    mockState.summary = summaryFixture({ accountValue: 125000, dayPnl: 250 });
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-snapshot-net-liq")).toHaveTextContent("$125,000.00");
    expect(screen.getByTestId("text-snapshot-daily-pl")).toHaveTextContent("$250.00");
    mockState.data = undefined;
    mockState.summary = undefined;
  });

  it("renders the Health Summary with strengths and weaknesses drawn from real Health Engine drivers", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-health-summary-score")).toHaveTextContent("90/100");
    expect(screen.getByTestId("list-health-strengths")).toHaveTextContent("Diversification");
    expect(screen.getByTestId("list-health-weaknesses")).toHaveTextContent("Concentration");
    mockState.data = undefined;
  });

  it("renders the Risk Summary with highestRisk, largestExposure, and worst stress scenario", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("badge-risk-highest")).toHaveTextContent("No elevated risk detected");
    expect(screen.getByTestId("text-risk-largest-exposure")).toHaveTextContent("AAPL");
    expect(screen.getByTestId("text-risk-worst-stress")).toHaveTextContent("Market Crash");
    mockState.data = undefined;
  });

  it("renders the Income Summary's daily/weekly/monthly/annualized theta figures", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-income-monthly")).toHaveTextContent("$450.00");
    expect(screen.getByTestId("text-income-annualized")).toHaveTextContent("$5,400.00");
    mockState.data = undefined;
  });

  it("Performance Summary is explicitly labeled SIMULATED and shows Win Rate, Expectancy, and Portfolio Growth", () => {
    mockState.data = resultFixture();
    mockState.performance = performanceFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("badge-performance-simulated")).toHaveTextContent("SIMULATED");
    expect(screen.getByTestId("text-performance-win-rate")).toHaveTextContent("72.00%");
    expect(screen.getByTestId("text-performance-expectancy")).toHaveTextContent("$65.00");
    expect(screen.getByTestId("text-performance-growth")).toHaveTextContent("16.80%");
    mockState.data = undefined;
    mockState.performance = undefined;
  });

  it("Performance Summary honestly shows unavailable when the Performance Analytics hook has not resolved", () => {
    mockState.data = resultFixture();
    mockState.performance = undefined;
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-performance-unavailable")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("renders the Greeks Summary's 4 current values and largest contributor", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-greeks-delta")).toHaveTextContent("12.5");
    expect(screen.getByTestId("text-greeks-vega")).toHaveTextContent("-10.1");
    expect(screen.getByTestId("text-greeks-largest-contributor")).toHaveTextContent("AAPL");
    mockState.data = undefined;
  });

  it("renders the Event Summary's safe/at-risk position counts", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-event-safe-count")).toHaveTextContent("3");
    expect(screen.getByTestId("text-event-at-risk-count")).toHaveTextContent("0");
    expect(screen.getByTestId("text-event-no-highest-risk")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("a real highest-risk event renders instead of the honest empty message", () => {
    mockState.data = resultFixture({
      eventSummary: {
        upcomingEvents: { totalPositions: 1, positionsWithEvents: 1, positionsWithoutEvents: 0, highRiskCount: 1, within1Day: 0, within3Days: 1, within7Days: 1, within14Days: 1, aggregateExposurePct: 100, highestRiskPosition: { tradeId: 1, symbol: "AAPL", riskLevel: "high" } },
        highestRiskEvent: { tradeId: 1, symbol: "AAPL", riskLevel: "high" },
        safePositionsCount: 0,
        atRiskPositionsCount: 1,
        expirationClusters: [],
      },
    });
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-event-highest-risk")).toHaveTextContent("AAPL");
    expect(screen.getByTestId("text-event-highest-risk")).toHaveTextContent("high");
    mockState.data = undefined;
  });

  it("renders Learning Summary cross-links for every section, each pointing to a real lesson/glossary/strategy", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("learning-cross-link-health")).toHaveTextContent("Iron Condor");
    expect(screen.getByTestId("learning-cross-link-income")).toHaveTextContent("Covered Call");
    expect(screen.getByTestId("learning-cross-link-event")).toHaveTextContent("Calendar Spread");
    mockState.data = undefined;
  });

  it("Portfolio Timeline shows the honest no-prior-snapshot message and This Week's insufficient-history state on a first-ever call", () => {
    mockState.data = resultFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("card-portfolio-timeline")).toHaveTextContent("No prior recorded snapshot exists yet");
    expect(screen.getByTestId("text-this-week-insufficient")).toBeInTheDocument();
    expect(screen.getByTestId("text-timeline-no-new")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("Portfolio Timeline shows real new/resolved/persistent issues and a This Week summary once history exists", () => {
    mockState.data = resultFixture({
      timeline: {
        asOf: "2026-07-16T12:00:00.000Z",
        comparedTo: "2026-07-15",
        newIssues: [{ code: "portfolio_health_improved", label: "Portfolio Health improved", category: "portfolio_health", status: "new" }],
        resolvedIssues: [{ code: "concentration_elevated", label: "Concentration elevated", category: "concentration", status: "resolved" }],
        persistentIssues: [{ code: "paper_trading_active", label: "Paper Trading active", category: "paper_trading_status", status: "persistent" }],
        healthChange: { label: "Portfolio Health", direction: "improving", detail: "10/100 → 90/100" },
        incomeChange: null,
        thisWeek: { daysRecorded: 2, healthScoreMin: 10, healthScoreMax: 90, trend: "improving" },
      },
    });
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("card-portfolio-timeline")).toHaveTextContent("2026-07-15");
    const newList = screen.getByTestId("list-timeline-new");
    expect(within(newList).getByText("Portfolio Health improved")).toBeInTheDocument();
    const resolvedList = screen.getByTestId("list-timeline-resolved");
    expect(within(resolvedList).getByText("Concentration elevated")).toBeInTheDocument();
    expect(screen.getByTestId("text-this-week-summary")).toHaveTextContent("10");
    mockState.data = undefined;
  });

  it("renders Institutional Insights, deterministic and never a trade recommendation", () => {
    mockState.data = resultFixture({
      institutionalInsights: [
        { text: "Portfolio remains well diversified.", category: "diversification" },
        { text: "Theta income remains consistent.", category: "income" },
      ],
    });
    renderWithClient(<PortfolioAnalyst />);
    const list = screen.getByTestId("list-institutional-insights");
    expect(within(list).getByText("Portfolio remains well diversified.")).toBeInTheDocument();
    expect(within(list).getByText("Theta income remains consistent.")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("the honest empty Institutional Insights message shows when there are no notable observations", () => {
    mockState.data = resultFixture({ institutionalInsights: [] });
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.getByTestId("text-no-institutional-insights")).toBeInTheDocument();
    mockState.data = undefined;
  });

  it("never renders a trade recommendation or execution suggestion anywhere on the page", () => {
    mockState.data = resultFixture();
    mockState.summary = summaryFixture();
    mockState.performance = performanceFixture();
    renderWithClient(<PortfolioAnalyst />);
    expect(screen.queryByText(/place order|submit order|execute trade|buy now|sell now/i)).not.toBeInTheDocument();
    mockState.data = undefined;
    mockState.summary = undefined;
    mockState.performance = undefined;
  });
});

// Phase 38 — Institutional Performance & Attribution Engine. Frontend
// smoke tests, following the established mocked-generated-hook pattern
// (RiskExposureEngine.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  dashboardData: undefined as unknown,
  dashboardLoading: false,
  coachData: undefined as unknown,
  coachLoading: false,
  learningData: undefined as unknown,
  learningLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetPerformanceDashboard: () => ({ data: mockState.dashboardData, isLoading: mockState.dashboardLoading }),
    useListPerformanceAttributionCoachTopics: () => ({ data: mockState.coachData, isLoading: mockState.coachLoading }),
    useListPerformanceAttributionLearning: () => ({ data: mockState.learningData, isLoading: mockState.learningLoading }),
  };
});

import PerformanceAttributionEngine from "./PerformanceAttributionEngine";

function emptyDashboard(overrides: Record<string, unknown> = {}) {
  return {
    investing: {
      portfolioCount: 0,
      holdingsCount: 0,
      totalCostBasisValue: null,
      totalMarketValue: null,
      totalUnrealizedPnl: null,
      totalUnrealizedPnlPct: null,
      holdings: [],
      sectorAttribution: [],
      assetAttribution: [],
      riskAdjusted: { available: false, reason: "No closed, decided trades to compute a risk-adjusted return from yet.", sharpeRatio: null, sortinoRatio: null, tradeCount: 0, basis: "Trade-return-based." },
      capitalEfficiency: { totalDeployed: null, returnOnDeployedCapitalPct: null, detail: "No holdings on record yet." },
      unresolvedSymbols: [],
      summary: "This user has no Investing holdings on record yet.",
    },
    trading: {
      totalPositions: 0,
      openPositionsCount: 0,
      closedPositionsCount: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: null,
      averageWin: null,
      averageLoss: null,
      totalRealizedPnl: null,
      largestWinner: null,
      largestLoser: null,
      averageHoldingDays: null,
      positions: [],
      strategyAttribution: [],
      assetAttribution: [],
      riskAdjusted: { available: false, reason: "No closed, decided trades to compute a risk-adjusted return from yet.", sharpeRatio: null, sortinoRatio: null, tradeCount: 0, basis: "Trade-return-based." },
      capitalEfficiency: { capitalCommitted: null, returnOnCapitalPct: null, detail: "No closed positions with a resolvable entry cost basis yet." },
      summary: "This user has no Trading positions on record yet.",
    },
    options: {
      openPositionsCount: 0,
      closedPositionsCount: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: null,
      averageWin: null,
      averageLoss: null,
      totalRealizedPnl: null,
      income: { openPositionsCount: 0, closedPositionsCount: 0, totalCreditCollectedOpen: 0, totalRealizedPremium: 0, totalCapitalAllocated: 0, theta: { daily: 0, weekly: 0, monthly: 0, annualized: 0, bySymbol: [] }, generatedAt: "2026-07-21T00:00:00.000Z" },
      trades: [],
      strategyAttribution: [],
      assetAttribution: [],
      incomeAttribution: [],
      riskAdjusted: { available: false, reason: "No closed, decided trades to compute a risk-adjusted return from yet.", sharpeRatio: null, sortinoRatio: null, tradeCount: 0, basis: "Trade-return-based." },
      capitalEfficiency: { capitalCommitted: null, returnOnCapitalPct: null, detail: "No closed positions with a recorded max-loss figure yet." },
      summary: "This user has no Options positions on record yet.",
    },
    combined: {
      byEngine: [
        { engine: "investing", label: "Investing (unrealized)", totalPnl: null, pnlLabel: "Unrealized P&L" },
        { engine: "trading", label: "Trading (realized)", totalPnl: null, pnlLabel: "Realized P&L" },
        { engine: "options", label: "Options (realized)", totalPnl: null, pnlLabel: "Realized P&L" },
      ],
      sectorAttribution: [],
      strategyAttribution: [],
      assetAttribution: [],
      capitalEfficiency: [
        { engine: "investing", label: "Investing — return on deployed cost basis", returnPct: null },
        { engine: "trading", label: "Trading — return on capital committed", returnPct: null },
        { engine: "options", label: "Options — return on max-loss capital committed", returnPct: null },
      ],
      riskAdjusted: [
        { engine: "investing", available: false, sharpeRatio: null, sortinoRatio: null },
        { engine: "trading", available: false, sharpeRatio: null, sortinoRatio: null },
        { engine: "options", available: false, sharpeRatio: null, sortinoRatio: null },
      ],
    },
    timeline: [],
    generatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("PerformanceAttributionEngine", () => {
  beforeEach(() => {
    mockState.dashboardData = undefined;
    mockState.dashboardLoading = false;
    mockState.coachData = undefined;
    mockState.coachLoading = false;
    mockState.learningData = undefined;
    mockState.learningLoading = false;
  });

  it("renders the page header and disclosure labels", () => {
    mockState.dashboardData = emptyDashboard();
    renderWithClient(<PerformanceAttributionEngine />);
    expect(screen.getByText("Institutional Performance & Attribution Engine")).toBeInTheDocument();
    expect(screen.getByTestId("performance-attribution-engine-labels")).toBeInTheDocument();
  });

  it("shows an honest empty Combined view when there is no data across any engine", () => {
    mockState.dashboardData = emptyDashboard();
    renderWithClient(<PerformanceAttributionEngine />);
    expect(screen.getByTestId("panel-pae-combined")).toBeInTheDocument();
    expect(screen.getByTestId("performance-timeline-empty")).toBeInTheDocument();
  });

  it("switches to the Investing view and shows real, non-fabricated holdings and attribution, never a forecast", async () => {
    const user = userEvent.setup();
    mockState.dashboardData = emptyDashboard({
      investing: {
        ...emptyDashboard().investing,
        holdingsCount: 2,
        portfolioCount: 1,
        totalUnrealizedPnl: 500,
        totalUnrealizedPnlPct: 5.5,
        holdings: [
          { symbol: "AAPL", sector: "Technology", shares: 10, avgCostBasis: 100, currentPrice: 130, costBasisValue: 1000, marketValue: 1300, unrealizedPnl: 300, unrealizedPnlPct: 30 },
          { symbol: "SPY", sector: "Diversified", shares: 5, avgCostBasis: 400, currentPrice: 440, costBasisValue: 2000, marketValue: 2200, unrealizedPnl: 200, unrealizedPnlPct: 10 },
        ],
        sectorAttribution: [{ key: "Technology", label: "Technology", pnl: 300, tradeCount: 1, weightPct: 60 }],
        assetAttribution: [{ key: "AAPL", label: "AAPL", pnl: 300, tradeCount: 1, weightPct: 60 }],
        capitalEfficiency: { totalDeployed: 3000, returnOnDeployedCapitalPct: 16.67, detail: "Unrealized return on the 3,000 in deployed cost basis: 16.67%." },
      },
    });
    renderWithClient(<PerformanceAttributionEngine />);
    await user.click(screen.getByTestId("performance-view-select"));
    await user.click(screen.getByTestId("performance-view-option-investing"));
    expect(screen.getByTestId("panel-pae-investing")).toBeInTheDocument();
    expect(screen.getByTestId("investing-holding-AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("investing-holding-SPY")).toBeInTheDocument();
    expect(screen.getByTestId("investing-sector-Technology")).toBeInTheDocument();
    expect(screen.getByText(/\+\$500/)).toBeInTheDocument();
  });

  it("switches to the Trading view and shows real win rate, strategy attribution, and risk-adjusted performance", async () => {
    const user = userEvent.setup();
    mockState.dashboardData = emptyDashboard({
      trading: {
        ...emptyDashboard().trading,
        totalPositions: 2,
        closedPositionsCount: 2,
        winningTrades: 1,
        losingTrades: 1,
        winRate: 50,
        averageWin: 200,
        averageLoss: -100,
        totalRealizedPnl: 100,
        positions: [{ id: 1, symbol: "AAPL", side: "long", status: "closed", quantity: 10, entryPrice: 100, exitPrice: 120, realizedPnl: 200, realizedPnlPct: 20, holdingDays: 14, setupType: "breakout" }],
        strategyAttribution: [{ key: "breakout", label: "breakout", pnl: 200, tradeCount: 1, weightPct: 66.67 }],
        assetAttribution: [{ key: "AAPL", label: "AAPL", pnl: 200, tradeCount: 1, weightPct: 66.67 }],
        riskAdjusted: { available: true, reason: null, sharpeRatio: 1.5, sortinoRatio: 2.1, tradeCount: 2, basis: "Trade-return-based." },
        capitalEfficiency: { capitalCommitted: 3000, returnOnCapitalPct: 3.33, detail: "Realized P&L relative to the entry cost basis of closed positions: 3.33%." },
      },
    });
    renderWithClient(<PerformanceAttributionEngine />);
    await user.click(screen.getByTestId("performance-view-select"));
    await user.click(screen.getByTestId("performance-view-option-trading"));
    expect(screen.getByTestId("panel-pae-trading")).toBeInTheDocument();
    expect(screen.getByTestId("trading-strategy-breakout")).toBeInTheDocument();
    expect(screen.getByTestId("trading-position-1")).toBeInTheDocument();
    expect(screen.getByTestId("trading-risk-adjusted-detail")).toHaveTextContent("Sharpe 1.5, Sortino 2.1");
  });

  it("real historical performance timeline surfaces real monthly data points, never fabricated", () => {
    mockState.dashboardData = emptyDashboard({
      timeline: [
        { monthEnd: "2026-01-31", source: "trading-realized", detail: "Trading realized P&L: +200", value: 200 },
        { monthEnd: "2026-02-28", source: "options-realized", detail: "Options realized P&L: -50", value: -50 },
      ],
    });
    renderWithClient(<PerformanceAttributionEngine />);
    expect(screen.getByTestId("performance-timeline-0")).toBeInTheDocument();
    expect(screen.getByTestId("performance-timeline-1")).toBeInTheDocument();
    expect(screen.queryByTestId("performance-timeline-empty")).not.toBeInTheDocument();
  });

  it("renders the Coach & Learning tab with real topics and Learning Centre links, never a trade recommendation", async () => {
    const user = userEvent.setup();
    mockState.dashboardData = emptyDashboard();
    mockState.coachData = [{ topic: "risk_adjusted_returns", title: "Risk-Adjusted Returns (Sharpe & Sortino)", explanation: ["Real explanation text."], disclaimer: "Educational only." }];
    mockState.learningData = [{ topic: "risk_adjusted_returns", links: [{ pathKey: "performance", topicKey: "performance-expectancy", category: "risk_adjusted", title: "Expectancy", summary: "Summary.", href: "/learn/paths/performance/performance-expectancy" }] }];
    renderWithClient(<PerformanceAttributionEngine />);
    await user.click(screen.getByTestId("tab-pae-learning"));
    expect(screen.getByTestId("coach-topic-risk_adjusted_returns")).toBeInTheDocument();
    expect(screen.getByTestId("learning-topic-risk_adjusted_returns")).toBeInTheDocument();
    expect(screen.getByTestId("learning-link-performance-performance-expectancy")).toBeInTheDocument();
  });

  it("renders the Reporting tab with deep links to the Institutional Reporting Centre", async () => {
    const user = userEvent.setup();
    mockState.dashboardData = emptyDashboard();
    renderWithClient(<PerformanceAttributionEngine />);
    await user.click(screen.getByTestId("tab-pae-reporting"));
    expect(screen.getByTestId("link-report-performance-summary")).toHaveAttribute("href", "/reporting-centre?reportType=performance-summary");
    expect(screen.getByTestId("link-report-performance-attribution-report")).toHaveAttribute("href", "/reporting-centre?reportType=performance-attribution-report");
  });
});

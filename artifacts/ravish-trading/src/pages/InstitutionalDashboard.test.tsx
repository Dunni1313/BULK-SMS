// Phase 3, Sprint 50 — Institutional Dashboard smoke test, following the
// established mocked-generated-hook pattern (see TradingResearch.test.tsx,
// TradingJournal.test.tsx, TradingBacktest.test.tsx). Fixture shapes are
// deliberately identical to TradingResearch.test.tsx's own fixtures for the
// same underlying types, since this page reuses the exact same API
// contracts.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  valueReport: undefined as unknown,
  isValueReportLoading: false,
  isValueReportError: false,
  marketBriefing: undefined as unknown,
  isMarketBriefingLoading: false,
  macroContext: undefined as unknown,
  isMacroContextLoading: false,
  structure: undefined as unknown,
  isStructureLoading: false,
  isStructureError: false,
  multiTimeframe: undefined as unknown,
  isMultiTimeframeLoading: false,
  isMultiTimeframeError: false,
  regime: undefined as unknown,
  isRegimeLoading: false,
  isRegimeError: false,
  probability: undefined as unknown,
  isProbabilityLoading: false,
  isProbabilityError: false,
  liquidity: undefined as unknown,
  isLiquidityLoading: false,
  isLiquidityError: false,
  risk: undefined as unknown,
  journalEntries: [] as unknown[],
  backtestResults: [] as unknown[],
  constructionPortfolios: undefined as unknown,
  optionsPortfolioSummary: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetValueReport: () => ({
      data: mockState.valueReport,
      isLoading: mockState.isValueReportLoading,
      isError: mockState.isValueReportError,
    }),
    useGetMarketBriefing: () => ({
      data: mockState.marketBriefing,
      isLoading: mockState.isMarketBriefingLoading,
    }),
    useGetMacroContext: () => ({
      data: mockState.macroContext,
      isLoading: mockState.isMacroContextLoading,
    }),
    useGetTradingStructure: () => ({
      data: mockState.structure,
      isLoading: mockState.isStructureLoading,
      isError: mockState.isStructureError,
    }),
    useGetTradingMultiTimeframe: () => ({
      data: mockState.multiTimeframe,
      isLoading: mockState.isMultiTimeframeLoading,
      isError: mockState.isMultiTimeframeError,
    }),
    useGetTradingRegime: () => ({
      data: mockState.regime,
      isLoading: mockState.isRegimeLoading,
      isError: mockState.isRegimeError,
    }),
    useGetTradingProbability: () => ({
      data: mockState.probability,
      isLoading: mockState.isProbabilityLoading,
      isError: mockState.isProbabilityError,
    }),
    useGetTradingLiquidity: () => ({
      data: mockState.liquidity,
      isLoading: mockState.isLiquidityLoading,
      isError: mockState.isLiquidityError,
    }),
    useGetTradingRisk: () => ({ data: mockState.risk }),
    useListTradingJournalEntries: () => ({ data: mockState.journalEntries }),
    useListTradingBacktestResults: () => ({ data: mockState.backtestResults }),
    useGetPortfolios: () => ({ data: mockState.constructionPortfolios }),
    useGetPortfolioSummary: () => ({ data: mockState.optionsPortfolioSummary }),
  };
});

import InstitutionalDashboard from "./InstitutionalDashboard";

function valueReport(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    dataSource: "SIMULATED",
    investmentCommittee: {
      votes: [
        { analyst: "Graham", verdict: "Buy", confidence: 70, rationale: "Cheap on Graham Number." },
        { analyst: "Buffett", verdict: "Hold", confidence: 55, rationale: "Fair value, no margin of safety." },
        { analyst: "Tom Nash", verdict: "Buy", confidence: 78, rationale: "High conviction score." },
      ],
      consolidatedVerdict: "Buy",
      confidenceScore: 68,
      agreement: "majority",
      reasoning: ["Graham votes Buy.", "Buffett votes Hold.", "Tom Nash votes Buy.", "Majority agreement: Buy."],
      summary: "2 of 3 analysts recommend Buy, with majority agreement.",
    },
    ...over,
  };
}

function marketBriefingResponse(over: Record<string, unknown> = {}) {
  return {
    briefing: {
      date: "2026-07-14",
      regime: "risk_on",
      regimeLabel: "Risk-On",
      syntheticVix: 14.2,
      vixLabel: "Low volatility",
      avgIvRank: 32,
      breadth: 68,
      ivEnvironment: "Compressed",
      headline: "Options income conditions favor selling premium.",
      drivers: [],
      catalysts: [],
    },
    narration: "Risk-on conditions with compressed IV.",
    narrationSource: "template",
    ...over,
  };
}

function macroContext(over: Record<string, unknown> = {}) {
  return {
    asOf: "2026-07-14",
    regime: "stable_rates",
    regimeLabel: "Stable-Rate Environment",
    rateTrendPct: 0.0002,
    dataSource: "SIMULATED",
    summary: "SIMULATED macro proxy as of 2026-07-14: stable-rate environment.",
    ...over,
  };
}

function structureAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 90,
    currentPrice: 195.5,
    trend: "uptrend",
    trendDetail: "Higher highs and higher lows across the recent swing sequence.",
    swingPoints: [],
    zones: [],
    confidenceLevel: "High",
    confidenceExplanation: "90 candles available.",
    summary: "AAPL shows a uptrend structure. Confidence: High.",
    ...over,
  };
}

function multiTimeframeAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    dataSource: "SIMULATED",
    timeframes: [{ interval: "1D", structure: { trend: "uptrend" } }],
    trendAgreement: "majority",
    dominantTrend: "uptrend",
    confluenceScore: 67,
    confidenceLevel: "Moderate",
    confidenceExplanation: "Reasonable data coverage.",
    summary: "AAPL shows a uptrend trend across timeframes. Confidence: Moderate.",
    ...over,
  };
}

function regimeAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    dataSource: "SIMULATED",
    regimeLabel: "trending-bullish",
    trendRegime: "uptrend",
    trendAgreement: "unanimous",
    volatilityRegime: "normal",
    volatilityAnnualizedPct: 24.5,
    volatilityExplanation: "24.5% annualized realized volatility.",
    liquidityRegime: "High",
    confidenceLevel: "High",
    confidenceExplanation: "Strong data support.",
    summary: "AAPL is in a trending-bullish regime. Confidence: High.",
    ...over,
  };
}

function probabilityAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    dataSource: "SIMULATED",
    currentPrice: 195.5,
    volatilityAnnualizedPct: 24.5,
    available: true,
    unavailableReason: null,
    cone: [],
    confidenceLevel: "High",
    confidenceExplanation: "Strong data support.",
    summary: "AAPL probability cone at 24.5% annualized volatility. Confidence: High.",
    ...over,
  };
}

function liquidityAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 90,
    currentPrice: 195.5,
    volumeProfile: [],
    avgDollarVolume: 32_500_000,
    liquidityScore: 92,
    liquidityBand: "High",
    buySellPressure: { buyPct: 62, sellPct: 38, direction: "buying" },
    confidenceLevel: "High",
    confidenceExplanation: "Strong sample.",
    summary: "AAPL shows High liquidity with buying pressure. Confidence: High.",
    ...over,
  };
}

function tradingRiskAnalysis(over: Record<string, unknown> = {}) {
  return {
    overall: { score: 82, label: "Excellent", detail: "Composite of position sizing, stop/target discipline, and portfolio risk budget." },
    positionSizing: { score: 100, label: "Excellent", detail: "", largestPositionSymbol: null, largestPositionRiskPct: null, capBreached: false, unpricedSymbols: [] },
    stopDiscipline: { score: 100, label: "Excellent", detail: "", openPositionsCount: 1, positionsWithStop: 1, positionsWithTarget: 1, positionsFullyPlanned: 1, missingStopSymbols: [], missingTargetSymbols: [] },
    portfolioBudget: { score: 100, label: "Excellent", detail: "", totalRiskDollars: 100, totalRiskPct: 0.1, capBreached: false, perPosition: [] },
    openPositionsCount: 1,
    accountValue: 100000,
    positionContexts: [],
    ...over,
  };
}

function journalEntry(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    tradingPositionId: null,
    title: "AAPL breakout follow-through",
    content: "Entered on the structure break.",
    mood: "confident",
    lessonLearned: null,
    tags: [],
    setupType: null,
    entryPrice: null,
    exitPrice: null,
    rMultiple: null,
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    ...over,
  };
}

function backtestResult(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    createdAt: "2026-07-01T12:00:00.000Z",
    symbol: "AAPL",
    strategy: "trend-following",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 180,
    available: true,
    unavailableReason: null,
    trades: [],
    totalTrades: 1,
    winRate: 1,
    avgR: 2.63,
    totalReturnPct: 0.079,
    maxDrawdownPct: 0,
    sharpeRatio: 1.5,
    equityCurve: [],
    summary: "AAPL (trend-following) took 1 trade(s).",
    ...over,
  };
}

function constructionPortfolio(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Core Holdings",
    description: "Long-term stock allocation.",
    holdingsCount: 8,
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-01T12:00:00.000Z",
    ...over,
  };
}

function optionsPortfolioSummary(over: Record<string, unknown> = {}) {
  return {
    accountValue: 125_430.5,
    cashBalance: 42_000,
    buyingPower: 84_000,
    totalPnl: 3_250.75,
    totalPnlPercent: 2.66,
    dayPnl: 120.4,
    openPositions: 4,
    ...over,
  };
}

describe("InstitutionalDashboard page", () => {
  beforeEach(() => {
    mockState.valueReport = undefined;
    mockState.isValueReportLoading = false;
    mockState.isValueReportError = false;
    mockState.marketBriefing = undefined;
    mockState.isMarketBriefingLoading = false;
    mockState.macroContext = undefined;
    mockState.isMacroContextLoading = false;
    mockState.structure = undefined;
    mockState.isStructureLoading = false;
    mockState.isStructureError = false;
    mockState.multiTimeframe = undefined;
    mockState.isMultiTimeframeLoading = false;
    mockState.isMultiTimeframeError = false;
    mockState.regime = undefined;
    mockState.isRegimeLoading = false;
    mockState.isRegimeError = false;
    mockState.probability = undefined;
    mockState.isProbabilityLoading = false;
    mockState.isProbabilityError = false;
    mockState.liquidity = undefined;
    mockState.isLiquidityLoading = false;
    mockState.isLiquidityError = false;
    mockState.risk = undefined;
    mockState.journalEntries = [];
    mockState.backtestResults = [];
    mockState.constructionPortfolios = undefined;
    mockState.optionsPortfolioSummary = undefined;
  });

  it("shows advisory copy and no signal grid before a symbol is searched", () => {
    renderWithClient(<InstitutionalDashboard />);
    expect(screen.getByTestId("page-institutional-dashboard")).toBeInTheDocument();
    expect(screen.getByText(/Investment Committee verdict, Engine 2's technical read/i)).toBeInTheDocument();
    expect(screen.queryByTestId("grid-signal-cards")).not.toBeInTheDocument();
    expect(screen.queryByTestId("grid-cross-engine-verdict")).not.toBeInTheDocument();
  });

  it("renders all five per-symbol signal cards together with no additional navigation once a symbol is searched", async () => {
    mockState.structure = structureAnalysis();
    mockState.multiTimeframe = multiTimeframeAnalysis();
    mockState.regime = regimeAnalysis();
    mockState.probability = probabilityAnalysis();
    mockState.liquidity = liquidityAnalysis();

    const user = userEvent.setup();
    renderWithClient(<InstitutionalDashboard />);

    await user.type(screen.getByTestId("input-dashboard-symbol"), "aapl");
    await user.click(screen.getByTestId("button-dashboard-search"));

    // All five cards are visible simultaneously — no tab click needed.
    expect(screen.getByTestId("card-dashboard-structure")).toBeInTheDocument();
    expect(screen.getByTestId("card-dashboard-multi-timeframe")).toBeInTheDocument();
    expect(screen.getByTestId("card-dashboard-regime")).toBeInTheDocument();
    expect(screen.getByTestId("card-dashboard-probability")).toBeInTheDocument();
    expect(screen.getByTestId("card-dashboard-liquidity")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("shows Engine 1's Investment Committee verdict alongside Engine 2's technical read on one screen once a symbol is searched", async () => {
    mockState.valueReport = valueReport();
    mockState.structure = structureAnalysis();
    mockState.multiTimeframe = multiTimeframeAnalysis();
    mockState.regime = regimeAnalysis();
    mockState.probability = probabilityAnalysis();
    mockState.liquidity = liquidityAnalysis();

    const user = userEvent.setup();
    renderWithClient(<InstitutionalDashboard />);
    await user.type(screen.getByTestId("input-dashboard-symbol"), "AAPL");
    await user.click(screen.getByTestId("button-dashboard-search"));

    const committeeCard = screen.getByTestId("card-dashboard-committee");
    expect(within(committeeCard).getByText("Buy")).toBeInTheDocument();
    expect(within(committeeCard).getByText("majority")).toBeInTheDocument();
    expect(within(committeeCard).getByText(/2 of 3 analysts recommend Buy/i)).toBeInTheDocument();

    const technicalReadCard = screen.getByTestId("card-dashboard-technical-read");
    expect(within(technicalReadCard).getByText("trending-bullish")).toBeInTheDocument();

    // Both cards render together, in the same grid, without any extra
    // navigation — the literal "on one screen" acceptance criterion.
    const verdictGrid = screen.getByTestId("grid-cross-engine-verdict");
    expect(within(verdictGrid).getByTestId("card-dashboard-committee")).toBeInTheDocument();
    expect(within(verdictGrid).getByTestId("card-dashboard-technical-read")).toBeInTheDocument();
  });

  it("honestly shows an error card for the Investment Committee when Engine 1 can't resolve the symbol, without blocking Engine 2's own read", async () => {
    mockState.isValueReportError = true;
    mockState.regime = regimeAnalysis();

    const user = userEvent.setup();
    renderWithClient(<InstitutionalDashboard />);
    await user.type(screen.getByTestId("input-dashboard-symbol"), "AAPL");
    await user.click(screen.getByTestId("button-dashboard-search"));

    expect(screen.getByText(/Could not resolve "AAPL"/i)).toBeInTheDocument();
    expect(screen.queryByTestId("card-dashboard-committee")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-dashboard-technical-read")).toBeInTheDocument();
  });

  it("shows all 3 engines' independent regime reads together in the Macro/Regime Side-by-Side section once a symbol is searched", async () => {
    mockState.marketBriefing = marketBriefingResponse();
    mockState.macroContext = macroContext();
    mockState.regime = regimeAnalysis();

    const user = userEvent.setup();
    renderWithClient(<InstitutionalDashboard />);
    await user.type(screen.getByTestId("input-dashboard-symbol"), "AAPL");
    await user.click(screen.getByTestId("button-dashboard-search"));

    const macroGrid = screen.getByTestId("grid-macro-regime");

    const briefingCard = screen.getByTestId("card-dashboard-market-briefing");
    expect(within(briefingCard).getByText("Risk-On")).toBeInTheDocument();
    expect(within(briefingCard).getByText(/Options income conditions favor selling premium/i)).toBeInTheDocument();

    const macroCard = screen.getByTestId("card-dashboard-macro-context");
    expect(within(macroCard).getByText("Stable-Rate Environment")).toBeInTheDocument();
    expect(within(macroCard).getByText("SIMULATED")).toBeInTheDocument();

    const engine2Card = screen.getByTestId("card-dashboard-macro-regime-engine2");
    expect(within(engine2Card).getByText("trending-bullish")).toBeInTheDocument();

    // All three sit in the same grid — the literal "visible together" proof
    // — and each card is independently attributable to its own engine via
    // its own title, with no combined/averaged reading anywhere.
    expect(within(macroGrid).getByTestId("card-dashboard-market-briefing")).toBeInTheDocument();
    expect(within(macroGrid).getByTestId("card-dashboard-macro-context")).toBeInTheDocument();
    expect(within(macroGrid).getByTestId("card-dashboard-macro-regime-engine2")).toBeInTheDocument();
  });

  it("does not show the Macro/Regime Side-by-Side section before a symbol is searched", () => {
    renderWithClient(<InstitutionalDashboard />);
    expect(screen.queryByTestId("grid-macro-regime")).not.toBeInTheDocument();
  });

  it("honestly shows the probability-unavailable reason instead of a fabricated cone", async () => {
    mockState.structure = structureAnalysis();
    mockState.multiTimeframe = multiTimeframeAnalysis();
    mockState.regime = regimeAnalysis();
    mockState.probability = probabilityAnalysis({ available: false, unavailableReason: "Volatility could not be computed." });
    mockState.liquidity = liquidityAnalysis();

    const user = userEvent.setup();
    renderWithClient(<InstitutionalDashboard />);
    await user.type(screen.getByTestId("input-dashboard-symbol"), "AAPL");
    await user.click(screen.getByTestId("button-dashboard-search"));

    expect(screen.getByTestId("text-dashboard-probability-unavailable")).toHaveTextContent(/volatility could not be computed/i);
  });

  it("always shows the Portfolio Risk, Journal, and Backtest summary cards, even with no symbol searched", () => {
    renderWithClient(<InstitutionalDashboard />);
    expect(screen.getByTestId("card-dashboard-risk")).toBeInTheDocument();
    expect(screen.getByTestId("card-dashboard-journal")).toBeInTheDocument();
    expect(screen.getByTestId("card-dashboard-backtests")).toBeInTheDocument();
    expect(screen.getByTestId("text-dashboard-risk-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-dashboard-journal-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-dashboard-backtests-empty")).toBeInTheDocument();
  });

  it("renders the Portfolio Risk summary, recent journal entries, and recent backtests when data is available", () => {
    mockState.risk = tradingRiskAnalysis();
    mockState.journalEntries = [journalEntry(), journalEntry({ id: 2, title: "MSFT pullback entry" })];
    mockState.backtestResults = [backtestResult(), backtestResult({ id: 2, symbol: "MSFT" })];

    renderWithClient(<InstitutionalDashboard />);

    const riskCard = screen.getByTestId("card-dashboard-risk");
    expect(within(riskCard).getByText("Excellent")).toBeInTheDocument();

    const journalCard = screen.getByTestId("card-dashboard-journal");
    expect(within(journalCard).getByText("AAPL breakout follow-through")).toBeInTheDocument();
    expect(within(journalCard).getByText("MSFT pullback entry")).toBeInTheDocument();

    const backtestsCard = screen.getByTestId("card-dashboard-backtests");
    expect(within(backtestsCard).getByText(/AAPL · trend-following/i)).toBeInTheDocument();
    expect(within(backtestsCard).getAllByText(/100% win/i).length).toBe(2);
  });

  it("links out to Trading Research, Trading Journal, and Trading Backtest for management actions rather than duplicating them", () => {
    renderWithClient(<InstitutionalDashboard />);
    expect(screen.getByText("Manage positions →").closest("a")).toHaveAttribute("href", "/trading-research");
    expect(screen.getByText("View journal →").closest("a")).toHaveAttribute("href", "/trading-journal");
    expect(screen.getByText("Run backtest →").closest("a")).toHaveAttribute("href", "/trading-backtest");
    expect(screen.getByTestId("button-dashboard-open-coach").closest("a")).toHaveAttribute("href", "/trading-research");
  });

  // Phase 33 — Institutional Executive Intelligence & Reporting Hub.
  it("links out to the Executive Intelligence Hub for cross-engine convenience, never a duplicated feature", () => {
    renderWithClient(<InstitutionalDashboard />);
    expect(screen.getByTestId("link-open-executive-intelligence")).toHaveAttribute("href", "/executive-intelligence");
  });

  // Phase 5, Sprint 66 — Unified Portfolio Dashboard (side-by-side view only).
  it("always shows the Portfolio Overview section with honest empty states, even with no symbol searched", () => {
    renderWithClient(<InstitutionalDashboard />);
    expect(screen.getByTestId("grid-portfolio-overview")).toBeInTheDocument();
    expect(screen.getByTestId("text-dashboard-construction-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-dashboard-options-portfolio-empty")).toBeInTheDocument();
  });

  it("renders Engine 1's Portfolio Construction and Engine 3's Options Income Portfolio side by side, each independently attributable to its own engine", () => {
    mockState.constructionPortfolios = [constructionPortfolio(), constructionPortfolio({ id: 2, name: "Growth Sleeve", holdingsCount: 5 })];
    mockState.optionsPortfolioSummary = optionsPortfolioSummary();

    renderWithClient(<InstitutionalDashboard />);

    const overviewGrid = screen.getByTestId("grid-portfolio-overview");
    const constructionCard = within(overviewGrid).getByTestId("card-dashboard-portfolio-construction");
    expect(within(constructionCard).getByText("2 portfolios")).toBeInTheDocument();
    expect(within(constructionCard).getByText("13 holdings")).toBeInTheDocument();

    const optionsCard = within(overviewGrid).getByTestId("card-dashboard-options-portfolio");
    expect(within(optionsCard).getByText("$125,430.50")).toBeInTheDocument();
    expect(within(optionsCard).getByText("$3,250.75 P&L")).toBeInTheDocument();
    expect(within(optionsCard).getByText("4 open positions")).toBeInTheDocument();

    // No blended/combined net-worth figure is ever computed anywhere on the
    // page — Decision 2's own explicit boundary.
    expect(screen.queryByText(/total net worth/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/combined portfolio/i)).not.toBeInTheDocument();
  });

  it("links Portfolio Overview cards out to Portfolio Construction and Portfolio for management actions rather than duplicating them", () => {
    renderWithClient(<InstitutionalDashboard />);
    expect(screen.getByText("Manage portfolios →").closest("a")).toHaveAttribute(
      "href",
      "/stock-analyst/portfolio-construction",
    );
    expect(screen.getByText("Manage portfolio →").closest("a")).toHaveAttribute("href", "/portfolio");
  });

  it("shows the Portfolio Overview section regardless of whether a symbol has been searched", async () => {
    const user = userEvent.setup();
    renderWithClient(<InstitutionalDashboard />);
    expect(screen.getByTestId("grid-portfolio-overview")).toBeInTheDocument();

    await user.type(screen.getByTestId("input-dashboard-symbol"), "AAPL");
    await user.click(screen.getByTestId("button-dashboard-search"));

    expect(screen.getByTestId("grid-portfolio-overview")).toBeInTheDocument();
  });
});

// Phase 3, Sprint 40 — Trading Research page smoke test, following the
// established mocked-generated-hook pattern (see PortfolioConstruction.test.tsx).
// Phase 3, Sprint 41 extended this file with the Multi-Timeframe confluence
// card's own cases, mocking useGetTradingMultiTimeframe alongside the
// existing useGetTradingStructure mock. Phase 3, Sprint 42 extended it
// again with the Market Regime card's own cases. Phase 3, Sprint 43
// extended it again with the Probability card's own cases. Phase 3,
// Sprint 44 extended it again with the Portfolio Risk section's own cases
// (positions list/add/delete, account value, risk analysis).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const createPositionMutate = vi.fn();
const deletePositionMutate = vi.fn();
const updateSettingsMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  structure: undefined as unknown,
  isLoading: false,
  isError: false,
  multiTimeframe: undefined as unknown,
  isMultiTimeframeLoading: false,
  isMultiTimeframeError: false,
  regime: undefined as unknown,
  isRegimeLoading: false,
  isRegimeError: false,
  probability: undefined as unknown,
  isProbabilityLoading: false,
  isProbabilityError: false,
  positions: [] as unknown[],
  risk: undefined as unknown,
  settings: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetTradingStructure: () => ({
      data: mockState.structure,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
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
    useListTradingPositions: () => ({ data: mockState.positions }),
    useGetTradingRisk: () => ({ data: mockState.risk }),
    useGetSettings: () => ({ data: mockState.settings }),
    useCreateTradingPosition: () => ({ mutate: createPositionMutate, isPending: false }),
    useDeleteTradingPosition: () => ({ mutate: deletePositionMutate, isPending: false }),
    useUpdateSettings: () => ({ mutate: updateSettingsMutate, isPending: false }),
    useGetTradingProbability: () => ({
      data: mockState.probability,
      isLoading: mockState.isProbabilityLoading,
      isError: mockState.isProbabilityError,
    }),
  };
});

import TradingResearch from "./TradingResearch";

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
    zones: [{ price: 180.25, kind: "support", strength: 3 }],
    confidenceLevel: "High",
    confidenceExplanation: "90 candles available — a strong sample for swing/zone detection.",
    summary: "AAPL shows a uptrend structure. Confidence: High.",
    ...over,
  };
}

function multiTimeframeAnalysis(over: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    dataSource: "SIMULATED",
    timeframes: [
      { interval: "15m", structure: { trend: "uptrend" } },
      { interval: "1h", structure: { trend: "uptrend" } },
      { interval: "1D", structure: { trend: "range" } },
    ],
    trendAgreement: "majority",
    dominantTrend: "uptrend",
    confluenceScore: 67,
    confidenceLevel: "Moderate",
    confidenceExplanation: "Reasonable data coverage with partial trend agreement.",
    summary: "AAPL shows a uptrend trend across 15m/1h/1D (majority agreement, 67% confluence). Confidence: Moderate.",
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
    volatilityExplanation: "24.5% annualized realized volatility — typical range.",
    liquidityRegime: "High",
    confidenceLevel: "High",
    confidenceExplanation: "Trend confluence, liquidity, and realized volatility all have strong data support.",
    summary: "AAPL is in a trending-bullish regime — 24.5% annualized volatility (normal), High liquidity. Confidence: High.",
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
    cone: [
      { daysAhead: 5, low1Sigma: 190.1, high1Sigma: 201.2, low2Sigma: 184.9, high2Sigma: 206.8 },
      { daysAhead: 30, low1Sigma: 175.4, high1Sigma: 218.9, low2Sigma: 158.2, high2Sigma: 240.1 },
    ],
    confidenceLevel: "High",
    confidenceExplanation: "Trend confluence, liquidity, and realized volatility all have strong data support.",
    summary: "AAPL probability cone at 24.5% annualized volatility. Confidence: High.",
    ...over,
  };
}

function tradingPosition(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    symbol: "AAPL",
    instrumentType: "stock",
    side: "long",
    status: "open",
    quantity: 10,
    entryPrice: 190,
    entryDate: "2026-07-01T00:00:00.000Z",
    exitPrice: null,
    exitDate: null,
    stopPrice: 180,
    targetPrice: 210,
    notes: "",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

function tradingRiskAnalysis(over: Record<string, unknown> = {}) {
  return {
    overall: { score: 82, label: "Excellent", detail: "Composite of position sizing, stop/target discipline, and portfolio risk budget." },
    positionSizing: {
      score: 100,
      label: "Excellent",
      detail: "Largest single-position risk is AAPL at 0.1%, within the 2% cap.",
      largestPositionSymbol: "AAPL",
      largestPositionRiskPct: 0.1,
      capBreached: false,
      unpricedSymbols: [],
    },
    stopDiscipline: {
      score: 100,
      label: "Excellent",
      detail: "All 1 open position(s) have both a stop and a target defined.",
      openPositionsCount: 1,
      positionsWithStop: 1,
      positionsWithTarget: 1,
      positionsFullyPlanned: 1,
      missingStopSymbols: [],
      missingTargetSymbols: [],
    },
    portfolioBudget: {
      score: 100,
      label: "Excellent",
      detail: "Aggregate open-position risk is 0.1% of account value, within the 6% portfolio risk-budget cap.",
      accountValue: 100000,
      totalRiskDollars: 100,
      totalRiskUsedPct: 0.1,
      capBreached: false,
      perPosition: [{ id: 1, symbol: "AAPL", riskDollars: 100, riskPct: 0.1, withinLimit: true }],
    },
    components: [],
    accountValue: 100000,
    openPositionsCount: 1,
    positionContexts: [
      { positionId: 1, symbol: "AAPL", daysAhead: 20, regimeLabel: "trending-bullish", stopTouchProbability: 0.12, targetTouchProbability: 0.34 },
    ],
    ...over,
  };
}

describe("TradingResearch page", () => {
  beforeEach(() => {
    mockState.structure = undefined;
    mockState.isLoading = false;
    mockState.isError = false;
    mockState.multiTimeframe = undefined;
    mockState.isMultiTimeframeLoading = false;
    mockState.isMultiTimeframeError = false;
    mockState.regime = undefined;
    mockState.isRegimeLoading = false;
    mockState.isRegimeError = false;
    mockState.probability = undefined;
    mockState.isProbabilityLoading = false;
    mockState.isProbabilityError = false;
    mockState.positions = [];
    mockState.risk = undefined;
    mockState.settings = undefined;
    createPositionMutate.mockReset();
    deletePositionMutate.mockReset();
    updateSettingsMutate.mockReset();
  });

  it("renders the advisory-only copy and a prompt before any symbol is searched", () => {
    renderWithClient(<TradingResearch />);
    expect(screen.getByText(/SIMULATED market analysis, advisory only/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter a symbol above/i)).toBeInTheDocument();
  });

  it("submits a symbol search and renders the Market Structure card once data resolves", async () => {
    mockState.structure = structureAnalysis();
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "aapl");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-market-structure")).toBeInTheDocument();
    expect(screen.getByText(/Market Structure — AAPL/i)).toBeInTheDocument();
    expect(screen.getByText("uptrend")).toBeInTheDocument();
    expect(screen.getByText(/High confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Support — \$180\.25/i)).toBeInTheDocument();
    expect(screen.getByText("3 touches")).toBeInTheDocument();
  });

  it("shows an honest empty-zones message when no support/resistance zone was detected", async () => {
    mockState.structure = structureAnalysis({ zones: [] });
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-market-structure")).toBeInTheDocument();
    expect(screen.getByText(/No repeated support\/resistance zone detected/i)).toBeInTheDocument();
  });

  it("shows a not-found message when the symbol can't be resolved", async () => {
    mockState.isError = true;
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "NOTATICKER");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByText(/Could not resolve "NOTATICKER"/i)).toBeInTheDocument();
  });

  it("renders the Multi-Timeframe confluence card once data resolves, alongside the Market Structure card", async () => {
    mockState.structure = structureAnalysis();
    mockState.multiTimeframe = multiTimeframeAnalysis();
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-multi-timeframe")).toBeInTheDocument();
    expect(screen.getByText(/Multi-Timeframe Confluence — AAPL/i)).toBeInTheDocument();
    expect(screen.getByText("majority")).toBeInTheDocument();
    expect(screen.getByText("67% confluence")).toBeInTheDocument();
    expect(screen.getByText(/Moderate confidence/i)).toBeInTheDocument();
    // Per-timeframe rows.
    expect(screen.getByText("15m")).toBeInTheDocument();
    expect(screen.getByText("1h")).toBeInTheDocument();
    expect(screen.getByText("1D")).toBeInTheDocument();
  });

  it("honestly shows 'No dominant trend' with no confluence badge when the timeframes split, never fabricating a winner", async () => {
    mockState.multiTimeframe = multiTimeframeAnalysis({
      trendAgreement: "split",
      dominantTrend: null,
      confluenceScore: null,
      summary: "AAPL shows split trend structure across 15m/1h/1D — no dominant trend, agreement: split. Confidence: Low.",
    });
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-multi-timeframe")).toBeInTheDocument();
    expect(screen.getByText("No dominant trend")).toBeInTheDocument();
    expect(screen.queryByText(/% confluence/i)).not.toBeInTheDocument();
  });

  it("renders the Market Regime card once data resolves", async () => {
    mockState.regime = regimeAnalysis();
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-market-regime")).toBeInTheDocument();
    expect(screen.getByText(/Market Regime — AAPL/i)).toBeInTheDocument();
    expect(screen.getByText("trending-bullish")).toBeInTheDocument();
    expect(screen.getByText("normal volatility (24.5%)")).toBeInTheDocument();
    expect(screen.getByText("High liquidity")).toBeInTheDocument();
  });

  it("honestly omits a volatility percentage when it could not be computed, never fabricating a number", async () => {
    mockState.regime = regimeAnalysis({
      volatilityAnnualizedPct: null,
      volatilityExplanation: "Only 1 daily candle(s) available — not enough to compute realized volatility; defaulting to a neutral \"normal\" read.",
    });
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-market-regime")).toBeInTheDocument();
    expect(screen.getByText("normal volatility")).toBeInTheDocument();
    expect(screen.queryByText(/normal volatility \(/i)).not.toBeInTheDocument();
  });

  it("renders the Probability card's cone once data resolves", async () => {
    mockState.probability = probabilityAnalysis();
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-probability")).toBeInTheDocument();
    expect(screen.getByText(/Probability — AAPL/i)).toBeInTheDocument();
    expect(screen.getByText("24.5% annualized volatility")).toBeInTheDocument();
    expect(screen.getByText(/High confidence/i)).toBeInTheDocument();
    expect(screen.getByText("5d")).toBeInTheDocument();
    expect(screen.getByText("30d")).toBeInTheDocument();
  });

  it("honestly shows the unavailable reason instead of a fabricated cone when probability can't be computed", async () => {
    mockState.probability = probabilityAnalysis({
      available: false,
      unavailableReason: "Volatility could not be computed for this symbol.",
      volatilityAnnualizedPct: null,
      cone: [],
      confidenceLevel: "Low",
      summary: "AAPL probability cone unavailable — insufficient data. Confidence: Low.",
    });
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-trading-research-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-trading-research-search"));

    expect(await screen.findByTestId("card-probability")).toBeInTheDocument();
    expect(screen.getByText("Volatility could not be computed for this symbol.")).toBeInTheDocument();
    expect(screen.queryByText(/annualized volatility/i)).not.toBeInTheDocument();
  });

  it("renders the Portfolio Risk section without requiring a symbol search, listing positions and the risk analysis", () => {
    mockState.positions = [tradingPosition()];
    mockState.risk = tradingRiskAnalysis();
    mockState.settings = { tradingAccountValue: 100000 };
    renderWithClient(<TradingResearch />);

    expect(screen.getByTestId("card-portfolio-risk")).toBeInTheDocument();
    expect(screen.getByTestId("row-position-1")).toBeInTheDocument();
    expect(screen.getByText(/AAPL . long . 10/)).toBeInTheDocument();
    expect(screen.getByText("Overall: Excellent")).toBeInTheDocument();
    expect(screen.getByTestId("section-risk-analysis")).toBeInTheDocument();
  });

  it("shows an honest empty-positions message when no positions exist yet", () => {
    renderWithClient(<TradingResearch />);
    expect(screen.getByText("No trading positions yet — add one above.")).toBeInTheDocument();
  });

  it("submits the add-position form with the entered values", async () => {
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-position-symbol"), "msft");
    await userEvent.type(screen.getByTestId("input-position-quantity"), "5");
    await userEvent.type(screen.getByTestId("input-position-entry-price"), "400");
    await userEvent.type(screen.getByTestId("input-position-stop-price"), "380");
    await userEvent.click(screen.getByTestId("button-add-position"));

    expect(createPositionMutate).toHaveBeenCalledWith(
      {
        data: {
          symbol: "MSFT",
          side: "long",
          quantity: 5,
          entryPrice: 400,
          stopPrice: 380,
          targetPrice: undefined,
        },
      },
      expect.anything(),
    );
  });

  it("submits a delete for the clicked position", async () => {
    mockState.positions = [tradingPosition()];
    renderWithClient(<TradingResearch />);

    await userEvent.click(screen.getByTestId("button-delete-position-1"));

    expect(deletePositionMutate).toHaveBeenCalledWith({ id: 1 }, expect.anything());
  });

  it("submits the account value form with the entered value", async () => {
    renderWithClient(<TradingResearch />);

    await userEvent.type(screen.getByTestId("input-account-value"), "50000");
    await userEvent.click(screen.getByTestId("button-save-account-value"));

    expect(updateSettingsMutate).toHaveBeenCalledWith(
      { data: { tradingAccountValue: 50000 } },
      expect.anything(),
    );
  });

  it("shows the per-position touch probability context when risk data resolves", () => {
    mockState.positions = [tradingPosition()];
    mockState.risk = tradingRiskAnalysis();
    renderWithClient(<TradingResearch />);

    expect(screen.getByText(/trending-bullish/)).toBeInTheDocument();
    expect(screen.getByText(/stop touch 12%/)).toBeInTheDocument();
    expect(screen.getByText(/target touch 34%/)).toBeInTheDocument();
  });
});

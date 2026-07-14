// Phase 3, Sprint 40 — Trading Research page smoke test, following the
// established mocked-generated-hook pattern (see PortfolioConstruction.test.tsx).
// Phase 3, Sprint 41 extended this file with the Multi-Timeframe confluence
// card's own cases, mocking useGetTradingMultiTimeframe alongside the
// existing useGetTradingStructure mock.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  structure: undefined as unknown,
  isLoading: false,
  isError: false,
  multiTimeframe: undefined as unknown,
  isMultiTimeframeLoading: false,
  isMultiTimeframeError: false,
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

describe("TradingResearch page", () => {
  beforeEach(() => {
    mockState.structure = undefined;
    mockState.isLoading = false;
    mockState.isError = false;
    mockState.multiTimeframe = undefined;
    mockState.isMultiTimeframeLoading = false;
    mockState.isMultiTimeframeError = false;
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
});

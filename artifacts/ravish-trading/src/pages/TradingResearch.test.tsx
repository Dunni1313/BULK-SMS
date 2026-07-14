// Phase 3, Sprint 40 — Trading Research page smoke test, following the
// established mocked-generated-hook pattern (see PortfolioConstruction.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  structure: undefined as unknown,
  isLoading: false,
  isError: false,
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

describe("TradingResearch page", () => {
  beforeEach(() => {
    mockState.structure = undefined;
    mockState.isLoading = false;
    mockState.isError = false;
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
});

// Phase 6, Sprint 71 — Frontend Legacy Page Test Coverage, Slice 1.
// Following the established mocked-generated-hook pattern.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  greeks: undefined as unknown,
  isLoadingGreeks: false,
  positions: undefined as unknown,
  isLoadingPositions: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetPortfolioGreeks: () => ({ data: mockState.greeks, isLoading: mockState.isLoadingGreeks }),
    useGetPortfolioPositions: () => ({ data: mockState.positions, isLoading: mockState.isLoadingPositions }),
  };
});

import Portfolio from "./Portfolio";

function greeks(over: Record<string, unknown> = {}) {
  return {
    totalDelta: 12.34,
    deltaStatus: "bullish",
    dailyThetaIncome: 45.67,
    totalVega: -8.9,
    totalGamma: 0.42,
    recommendations: [],
    ...over,
  };
}

function position(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    symbol: "AAPL",
    strategy: "iron_condor",
    expiration: "2026-08-15",
    unrealizedPnl: 125.5,
    unrealizedPnlPercent: 12.5,
    delta: 0.15,
    theta: 4.2,
    ...over,
  };
}

describe("Portfolio page", () => {
  beforeEach(() => {
    mockState.greeks = undefined;
    mockState.isLoadingGreeks = false;
    mockState.positions = undefined;
    mockState.isLoadingPositions = false;
  });

  it("shows loading skeletons while greeks and positions resolve", () => {
    mockState.isLoadingGreeks = true;
    mockState.isLoadingPositions = true;
    renderWithClient(<Portfolio />);
    expect(screen.getByText("Portfolio Greeks")).toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr").length).toBe(3);
  });

  it("shows an honest empty-positions message when there are none", () => {
    mockState.greeks = greeks();
    mockState.positions = [];
    renderWithClient(<Portfolio />);
    expect(screen.getByText("No active positions.")).toBeInTheDocument();
  });

  it("renders real greeks and position rows once resolved", () => {
    mockState.greeks = greeks();
    mockState.positions = [position()];
    renderWithClient(<Portfolio />);
    expect(screen.getByText("12.34")).toBeInTheDocument();
    expect(screen.getByText("bullish")).toBeInTheDocument();
    expect(screen.getByText("$45.67")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("iron condor")).toBeInTheDocument();
    expect(screen.getByText(/\$125\.50 \(12\.5%\)/)).toBeInTheDocument();
  });

  it("shows AI portfolio recommendations only when there are real recommendations to show", () => {
    mockState.greeks = greeks({ recommendations: ["Consider closing the AAPL iron condor near max profit."] });
    mockState.positions = [];
    renderWithClient(<Portfolio />);
    expect(screen.getByText("AI Portfolio Recommendations")).toBeInTheDocument();
    expect(screen.getByText("Consider closing the AAPL iron condor near max profit.")).toBeInTheDocument();
  });

  it("never fabricates a recommendations card when there are none", () => {
    mockState.greeks = greeks({ recommendations: [] });
    mockState.positions = [];
    renderWithClient(<Portfolio />);
    expect(screen.queryByText("AI Portfolio Recommendations")).not.toBeInTheDocument();
  });

  // v1.3.1 — AI Trading Coach.
  it("shows an Ask AI Trading Coach trigger", () => {
    renderWithClient(<Portfolio />);
    expect(screen.getByTestId("button-ask-trading-coach-portfolio")).toBeInTheDocument();
  });
});

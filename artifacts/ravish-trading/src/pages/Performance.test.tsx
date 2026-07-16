// Phase 6, Sprint 72 — Frontend Legacy Page Test Coverage, Slice 2.
// Following the established mocked-generated-hook pattern. Recharts'
// ResponsiveContainer needs the shared ResizeObserverStub already
// established in src/test/setup.ts (Sprint 18 precedent).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  analytics: undefined as unknown,
  isLoading: false,
  equity: undefined as unknown,
  equityLoading: false,
  breakdown: undefined as unknown,
  breakdownLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetPerformanceAnalytics: () => ({ data: mockState.analytics, isLoading: mockState.isLoading }),
    useGetEquityCurve: () => ({ data: mockState.equity, isLoading: mockState.equityLoading }),
    useGetPerformanceBreakdown: () => ({ data: mockState.breakdown, isLoading: mockState.breakdownLoading }),
  };
});

import Performance from "./Performance";

function analytics(over: Record<string, unknown> = {}) {
  return {
    totalTrades: 42,
    winRate: 0.76,
    profitFactor: 2.15,
    expectancy: 38.5,
    totalReturn: 1615.0,
    returnOnCapital: 0.129,
    maxDrawdown: 0.061,
    avgWin: 95.2,
    avgLoss: -42.1,
    sharpeRatio: 1.42,
    sortinoRatio: 1.9,
    avgHoldingDays: 12.4,
    thetaCollected: 890.0,
    bestStrategy: "iron_condor",
    worstStrategy: "calendar_spread",
    bestTickers: [{ symbol: "AAPL", totalReturn: 320 }],
    worstTickers: [{ symbol: "TSLA", totalReturn: -120.0 }],
    expectedPop: 0.72,
    actualPop: 0.81,
    totalCommission: 45.0,
    totalSlippage: 12.0,
    commissionImpactPct: 0.035,
    monthlyReturns: [{ month: "Jun 26", return: 0.04 }],
    ...over,
  };
}

describe("Performance page", () => {
  beforeEach(() => {
    mockState.analytics = undefined;
    mockState.isLoading = false;
    mockState.equity = undefined;
    mockState.equityLoading = false;
    mockState.breakdown = undefined;
    mockState.breakdownLoading = false;
  });

  it("shows loading skeletons for the KPI grid while analytics resolves", () => {
    mockState.isLoading = true;
    renderWithClient(<Performance />);
    expect(screen.getByText("Performance Analytics")).toBeInTheDocument();
    expect(screen.getByText("Win Rate")).toBeInTheDocument();
  });

  it("renders real KPI values once analytics resolves", () => {
    mockState.analytics = analytics();
    mockState.equity = [];
    mockState.breakdown = [];
    renderWithClient(<Performance />);
    expect(screen.getByText("76.0%")).toBeInTheDocument(); // Win Rate
    expect(screen.getByText("2.15")).toBeInTheDocument(); // Profit Factor
    expect(screen.getByText("$1,615")).toBeInTheDocument(); // Total P&L
    expect(screen.getByText("iron_condor")).toBeInTheDocument(); // Best Strategy (raw value, no relabeling)
  });

  it("renders real best/worst ticker rows", () => {
    mockState.analytics = analytics();
    mockState.equity = [];
    mockState.breakdown = [];
    renderWithClient(<Performance />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("$320")).toBeInTheDocument();
    expect(screen.getByText("TSLA")).toBeInTheDocument();
  });

  it("renders the breakdown table with real bucket rows", () => {
    mockState.analytics = analytics();
    mockState.equity = [];
    mockState.breakdown = [
      { key: "iron_condor", label: "Iron Condor", totalTrades: 30, winRate: 0.8, totalReturn: 1200, profitFactor: 2.4, expectancy: 40 },
    ];
    renderWithClient(<Performance />);
    expect(screen.getByText("Iron Condor")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });
});

// Phase 6, Sprint 72 — Frontend Legacy Page Test Coverage, Slice 2.
// Following the established mocked-generated-hook pattern. Recharts'
// ResponsiveContainer needs the shared ResizeObserverStub already
// established in src/test/setup.ts (Sprint 18 precedent).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const runBacktestMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const mockState = vi.hoisted(() => ({
  results: undefined as unknown,
  isLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListBacktestResults: () => ({ data: mockState.results, isLoading: mockState.isLoading }),
    useRunBacktest: () => runBacktestMock,
  };
});

import Backtest from "./Backtest";

function backtestResult(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    symbol: "SPY",
    strategy: "iron_condor",
    period: "1y",
    totalTrades: 24,
    winRate: 0.79,
    expectancy: 42.5,
    maxDrawdown: 0.08,
    totalReturn: 0.21,
    equityCurve: [
      { date: "2025-08-01", value: 10000 },
      { date: "2026-08-01", value: 12100 },
    ],
    ...over,
  };
}

describe("Backtest page", () => {
  beforeEach(() => {
    mockState.results = undefined;
    mockState.isLoading = false;
    runBacktestMock.mutate.mockReset();
    runBacktestMock.isPending = false;
  });

  it("shows a loading placeholder while results resolve", () => {
    mockState.isLoading = true;
    renderWithClient(<Backtest />);
    expect(screen.getByText("Backtest Engine")).toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr").length).toBe(1);
  });

  it("shows an honest empty-history message when no backtest has run yet", () => {
    mockState.results = [];
    renderWithClient(<Backtest />);
    expect(screen.getByText("No backtests run yet.")).toBeInTheDocument();
  });

  it("renders the equity curve and real KPI tiles for the latest result", () => {
    mockState.results = [backtestResult()];
    renderWithClient(<Backtest />);
    expect(screen.getByText("Equity Curve")).toBeInTheDocument();
    // The single result is both the "latest result" summary and the sole
    // history-table row, so several of its own values legitimately render
    // twice — once in the KPI tile, once in the table (Win Rate/Expectancy/
    // Return columns) — reading off the identical real figures both times.
    // Max Drawdown has no table column, so it renders once.
    expect(screen.getAllByText("79.0%").length).toBe(2); // Win Rate
    expect(screen.getAllByText("$42.50").length).toBe(2); // Expectancy
    expect(screen.getByText("8.0%")).toBeInTheDocument(); // Max Drawdown (KPI-tile only)
    expect(screen.getAllByText("21.0%").length).toBe(2); // Total Return
  });

  it("renders the history table with real rows", () => {
    mockState.results = [backtestResult(), backtestResult({ id: 8, symbol: "QQQ", winRate: 0.65 })];
    renderWithClient(<Backtest />);
    expect(document.querySelectorAll("tbody tr").length).toBe(2);
    expect(screen.getByText("QQQ")).toBeInTheDocument();
  });

  it("triggers a new backtest run with the entered symbol/strategy/period", async () => {
    renderWithClient(<Backtest />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    expect(runBacktestMock.mutate).toHaveBeenCalledWith(
      { data: { symbol: "SPY", strategy: "iron_condor", period: "1y" } },
      expect.anything(),
    );
  });
});

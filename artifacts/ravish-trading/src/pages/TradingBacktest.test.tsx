// Phase 3, Sprint 49 — Backtesting frontend smoke test, following the
// established mocked-generated-hook pattern (see TradingJournal.test.tsx,
// TradingResearch.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const runMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  results: [] as unknown[],
  isLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListTradingBacktestResults: () => ({ data: mockState.results, isLoading: mockState.isLoading }),
    useRunTradingBacktest: () => ({ mutate: runMutate, isPending: false }),
  };
});

import TradingBacktest from "./TradingBacktest";

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
    trades: [
      {
        entryDate: "2026-01-05T00:00:00.000Z",
        entryPrice: 190,
        exitDate: "2026-01-20T00:00:00.000Z",
        exitPrice: 205,
        exitReason: "target",
        pnlPct: 0.079,
        rMultiple: 2.63,
      },
    ],
    totalTrades: 1,
    winRate: 1,
    avgR: 2.63,
    totalReturnPct: 0.079,
    maxDrawdownPct: 0,
    sharpeRatio: 1.5,
    equityCurve: [{ date: "2026-01-20T00:00:00.000Z", value: 107900, drawdownPct: 0 }],
    summary: "AAPL (trend-following) took 1 trade(s) over the 180-candle sample: 100% win rate.",
    ...over,
  };
}

describe("TradingBacktest page", () => {
  beforeEach(() => {
    mockState.results = [];
    mockState.isLoading = false;
    runMutate.mockReset();
  });

  it("shows an empty-state message in the history table when no backtests have been run", () => {
    renderWithClient(<TradingBacktest />);
    expect(screen.getByText(/No backtests run yet/i)).toBeInTheDocument();
  });

  it("submits the run form with the selected symbol/strategy/interval", async () => {
    const user = userEvent.setup();
    renderWithClient(<TradingBacktest />);

    const symbolInput = screen.getByTestId("input-backtest-symbol");
    await user.clear(symbolInput);
    await user.type(symbolInput, "msft");

    await user.click(screen.getByTestId("button-run-backtest"));

    expect(runMutate).toHaveBeenCalledTimes(1);
    const args = runMutate.mock.calls[0][0];
    expect(args.data.symbol).toBe("MSFT");
    expect(args.data.strategy).toBe("trend-following");
    expect(args.data.interval).toBe("1D");
  });

  it("renders a triggered-trade result with KPI tiles and the trade log", () => {
    mockState.results = [backtestResult()];
    renderWithClient(<TradingBacktest />);

    expect(screen.getAllByText("AAPL").length).toBeGreaterThan(0);
    expect(screen.getAllByText("100.0%").length).toBeGreaterThan(0);
    expect(screen.getByText("target")).toBeInTheDocument();
  });

  it("honestly shows the unavailable reason instead of a fabricated chart", () => {
    mockState.results = [
      backtestResult({ available: false, unavailableReason: "At least 31 candles are needed to run a backtest — only 10 available.", trades: [], totalTrades: 0, winRate: null, avgR: null, totalReturnPct: null, maxDrawdownPct: null, equityCurve: [] }),
    ];
    renderWithClient(<TradingBacktest />);
    expect(screen.getByTestId("text-backtest-unavailable")).toHaveTextContent(/at least 31 candles/i);
  });

  it("honestly shows a zero-trades message instead of a fabricated empty chart", () => {
    mockState.results = [
      backtestResult({
        strategy: "structure-breakout",
        trades: [],
        totalTrades: 0,
        winRate: null,
        avgR: null,
        totalReturnPct: null,
        maxDrawdownPct: null,
        equityCurve: [],
        summary: "AAPL (structure-breakout) triggered no trade signals over the 180-candle sample.",
      }),
    ];
    renderWithClient(<TradingBacktest />);
    expect(screen.getByTestId("text-backtest-no-trades")).toHaveTextContent(/triggered no trade signals/i);
  });
});

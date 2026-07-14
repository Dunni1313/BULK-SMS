// Phase 4, Sprint 58 — Options Engine-Native Backtesting frontend smoke
// test, following the established mocked-generated-hook pattern (see
// TradingBacktest.test.tsx's own Sprint 49 precedent, which this file
// mirrors directly).

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
    useListOptionsBacktestResults: () => ({ data: mockState.results, isLoading: mockState.isLoading }),
    useRunOptionsBacktest: () => ({ mutate: runMutate, isPending: false }),
  };
});

import OptionsBacktest from "./OptionsBacktest";

function backtestResult(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    createdAt: "2026-07-01T12:00:00.000Z",
    symbol: "SPY",
    strategy: "iron_condor",
    underlyingDataSource: "SIMULATED",
    optionsDataSource: "SIMULATED",
    candleCount: 180,
    available: true,
    unavailableReason: null,
    trades: [
      {
        entryDate: "2026-01-05T00:00:00.000Z",
        expirationDate: "2026-02-19T00:00:00.000Z",
        entryCredit: 1.85,
        exitDate: "2026-01-25T00:00:00.000Z",
        exitDebit: 0.9,
        exitReason: "profit-target",
        pnl: 0.95,
        maxLoss: 3.15,
        rMultiple: 0.3,
        daysHeld: 20,
      },
    ],
    totalTrades: 1,
    winRate: 1,
    avgR: 0.3,
    totalReturnPct: 0.05,
    maxDrawdownPct: 0,
    sharpeRatio: 1.2,
    equityCurve: [{ date: "2026-01-25T00:00:00.000Z", value: 100095, drawdownPct: 0 }],
    summary: "SPY (iron_condor) took 1 trade(s) over the 180-candle sample: 100% win rate.",
    ...over,
  };
}

describe("OptionsBacktest page", () => {
  beforeEach(() => {
    mockState.results = [];
    mockState.isLoading = false;
    runMutate.mockReset();
  });

  it("shows an empty-state message in the history table when no backtests have been run", () => {
    renderWithClient(<OptionsBacktest />);
    expect(screen.getByTestId("text-options-backtest-history-empty")).toHaveTextContent(/No backtests run yet/i);
  });

  it("submits the run form with the entered symbol and the fixed iron_condor strategy", async () => {
    const user = userEvent.setup();
    renderWithClient(<OptionsBacktest />);

    const symbolInput = screen.getByTestId("input-options-backtest-symbol");
    await user.clear(symbolInput);
    await user.type(symbolInput, "aapl");

    await user.click(screen.getByTestId("button-run-options-backtest"));

    expect(runMutate).toHaveBeenCalledTimes(1);
    const args = runMutate.mock.calls[0][0];
    expect(args.data.symbol).toBe("AAPL");
    expect(args.data.strategy).toBe("iron_condor");
  });

  it("renders a triggered-trade result with dual data-source badges, KPI tiles, and the options-native trade log", () => {
    mockState.results = [backtestResult()];
    renderWithClient(<OptionsBacktest />);

    expect(screen.getAllByText("SPY").length).toBeGreaterThan(0);
    expect(screen.getByText(/Underlying: SIMULATED/i)).toBeInTheDocument();
    expect(screen.getByText(/Options: SIMULATED/i)).toBeInTheDocument();
    expect(screen.getAllByText("100.0%").length).toBeGreaterThan(0);
    expect(screen.getByText("profit-target")).toBeInTheDocument();
    expect(screen.getByText("$1.85")).toBeInTheDocument();
  });

  it("honestly shows the unavailable reason instead of a fabricated chart", () => {
    mockState.results = [
      backtestResult({
        available: false,
        unavailableReason: "At least 30 candles are needed to run a backtest — only 10 available.",
        trades: [],
        totalTrades: 0,
        winRate: null,
        avgR: null,
        totalReturnPct: null,
        maxDrawdownPct: null,
        equityCurve: [],
      }),
    ];
    renderWithClient(<OptionsBacktest />);
    expect(screen.getByTestId("text-options-backtest-unavailable")).toHaveTextContent(/at least 30 candles/i);
  });

  it("honestly shows a zero-trades message instead of a fabricated empty chart", () => {
    mockState.results = [
      backtestResult({
        trades: [],
        totalTrades: 0,
        winRate: null,
        avgR: null,
        totalReturnPct: null,
        maxDrawdownPct: null,
        equityCurve: [],
        summary: "SPY (iron_condor) triggered no trade signals over the 180-candle sample.",
      }),
    ];
    renderWithClient(<OptionsBacktest />);
    expect(screen.getByTestId("text-options-backtest-no-trades")).toHaveTextContent(/triggered no trade signals/i);
  });
});

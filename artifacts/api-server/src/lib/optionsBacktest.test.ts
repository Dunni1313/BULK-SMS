// Phase 4, Sprint 57 — Options Engine-Native Backtesting (Core) unit tests
// (approved Phase 4 plan, Sprint 57). runOptionsBacktest() is pure and
// I/O-free — most tests construct daily candle fixtures directly, mirroring
// tradingBacktest.test.ts's own fixture-construction technique. Every exit
// path (profit-target, stop-loss, dte-trigger, expiration, end-of-period)
// was empirically derived against the real, unmodified optionsMath.ts
// functions before being hand-encoded here as a fixture, not guessed —
// each fixture's own comment records the exact reasoning.

import { describe, it, expect } from "vitest";
import {
  runOptionsBacktest,
  buildOptionsBacktest,
  MIN_CANDLES_REQUIRED,
  DEFAULT_ENTRY_DTE,
  DEFAULT_DTE_EXIT_TRIGGER,
} from "./optionsBacktest.js";
import { getSnapshot, buildIronCondor } from "./optionsMath.js";
import { SimulatedMarketDataProvider, type Candle } from "./tradingMarketData.js";

function isoDate(i: number): string {
  const d = new Date("2026-01-01T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString();
}

function flatCandle(i: number, close: number): Candle {
  return { time: isoDate(i), open: close, high: close, low: close, close, volume: 1000 };
}

function flatCandles(n: number, close: number): Candle[] {
  return Array.from({ length: n }, (_, i) => flatCandle(i, close));
}

describe("runOptionsBacktest — honest-unavailable paths", () => {
  it("is unavailable with too few candles, never a fabricated trade", () => {
    const result = runOptionsBacktest(flatCandles(MIN_CANDLES_REQUIRED - 1, 200), "AAPL", "iron_condor", false, {});
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toMatch(/at least/i);
    expect(result.trades).toEqual([]);
    expect(result.totalTrades).toBe(0);
    expect(result.winRate).toBeNull();
    expect(result.equityCurve).toEqual([]);
  });

  it("is unavailable for a symbol outside optionsMath.ts's own supported options universe", () => {
    // Confirmed via direct inspection: getSnapshot() only resolves the
    // fixed 10-symbol UNIVERSE, unlike Engine 2's own MarketDataProvider —
    // this is a genuine, disclosed scope boundary inherited from
    // optionsMath.ts, not a new limitation this sprint introduces.
    expect(getSnapshot("ZZZZZ", "2026-01-01")).toBeNull();
    const result = runOptionsBacktest(flatCandles(MIN_CANDLES_REQUIRED, 200), "ZZZZZ", "iron_condor", false, {});
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toMatch(/outside optionsMath\.ts's own supported options universe/i);
  });

  it("honestly reports zero trades, never fabricated, when every candidate entry is rejected", () => {
    // Empirically confirmed: buildIronCondor() rejects AAPL at spot=$5 with
    // "Negative expected value" (optionsMath.ts's own finalize() judgment,
    // read here, never overridden) — every day's entry attempt is skipped.
    const result = runOptionsBacktest(flatCandles(35, 5), "AAPL", "iron_condor", false, {});
    expect(result.available).toBe(true);
    expect(result.totalTrades).toBe(0);
    expect(result.trades).toEqual([]);
    expect(result.winRate).toBeNull();
    expect(result.summary).toMatch(/never opened a position/i);
    expect(result.summary).toMatch(/every candidate entry was rejected/i);
  });
});

describe("runOptionsBacktest — every exit path, isolated and verified against real optionsMath.ts pricing", () => {
  it("closes at the profit target once enough of the credit received is captured back", () => {
    // 46 flat days at $200 (AAPL) with every other option left at its
    // default — the first position closes in 2 days once day-to-day IV
    // decay/movement captures >= 50% of max profit.
    const result = runOptionsBacktest(flatCandles(46, 200), "AAPL", "iron_condor", false, {});
    const first = result.trades[0];
    expect(first.exitReason).toBe("profit-target");
    expect(first.pnl).toBeGreaterThan(0);
    expect(first.pnl).toBeGreaterThanOrEqual(0.5 * first.entryCredit - 0.01);
  });

  it("closes at a real loss when the underlying spikes hard through the short strikes (stop-loss)", () => {
    // Entry at $200 on day 0, an immediate spike to $300 on day 1 — deep
    // ITM on the call spread before any theta-decay-driven profit-target
    // could fire first. maxLoss/entryCredit/strikes are the real numbers
    // buildIronCondor() computes for AAPL at $200, 45 DTE, 0.2 delta.
    const candles: Candle[] = [flatCandle(0, 200), ...Array.from({ length: 31 }, (_, i) => flatCandle(i + 1, 300))];
    const result = runOptionsBacktest(candles, "AAPL", "iron_condor", false, {});
    const first = result.trades[0];
    expect(first.entryDate).toBe(isoDate(0).slice(0, 10));
    expect(first.exitReason).toBe("stop-loss");
    expect(first.pnl).toBeLessThan(0);
    // A hard breach should approach (not exceed, since it's still marked
    // via the real BS reprice, not settled) the position's own max loss.
    expect(Math.abs(first.pnl)).toBeLessThanOrEqual(first.maxLoss + 0.01);
  });

  it("closes at the DTE trigger when neither profit target nor stop loss has fired by then", () => {
    // Flat $200 the whole way, with profit-target/stop-loss thresholds set
    // deliberately unreachable so only the DTE trigger can close it —
    // confirmed empirically to close at exactly
    // DEFAULT_ENTRY_DTE - DEFAULT_DTE_EXIT_TRIGGER days held.
    const result = runOptionsBacktest(flatCandles(30, 200), "AAPL", "iron_condor", false, {
      profitTargetPct: 2.0,
      stopLossMultiple: 100,
    });
    const first = result.trades[0];
    expect(first.exitReason).toBe("dte-trigger");
    expect(first.daysHeld).toBe(DEFAULT_ENTRY_DTE - DEFAULT_DTE_EXIT_TRIGGER);
  });

  it("settles at true intrinsic value on the actual expiration day, never an approximated bs() reprice", () => {
    // A short 7-DTE entry (buildIronCondor() itself rejects 1-3 DTE as
    // negative-EV, confirmed empirically) with profit-target/stop-loss/
    // DTE-trigger all disabled, so the position survives to real 0-DTE
    // settlement. Flat price never breaches either short strike, so both
    // spreads expire fully worthless — exitDebit is exactly 0 and the
    // full entry credit is realized as profit, the textbook best-case
    // iron-condor settlement.
    const result = runOptionsBacktest(flatCandles(31, 200), "AAPL", "iron_condor", false, {
      entryDte: 7,
      dteExitTrigger: 0,
      profitTargetPct: 2.0,
      stopLossMultiple: 100,
    });
    const first = result.trades[0];
    expect(first.exitReason).toBe("expiration");
    expect(first.daysHeld).toBe(7);
    expect(first.exitDebit).toBe(0);
    expect(first.pnl).toBe(first.entryCredit);
  });

  it("honestly closes a still-open position at the sample's own end via a real reprice, never left dangling", () => {
    const result = runOptionsBacktest(flatCandles(30, 200), "AAPL", "iron_condor", false, {
      profitTargetPct: 2.0,
      stopLossMultiple: 100,
    });
    const last = result.trades[result.trades.length - 1];
    expect(last.exitReason).toBe("end-of-period");
    expect(last.exitDate).toBe(isoDate(29).slice(0, 10));
  });
});

describe("runOptionsBacktest — trade log / equity curve / KPI integrity", () => {
  it("derives the equity curve directly and only from the trade log's own realized pnl — never a fabricated statistical curve", () => {
    const result = runOptionsBacktest(flatCandles(46, 200), "AAPL", "iron_condor", false, {});
    expect(result.equityCurve.length).toBe(result.trades.length);
    let running = 100_000;
    result.trades.forEach((t, i) => {
      running += t.pnl;
      expect(result.equityCurve[i].value).toBeCloseTo(running, 1);
      expect(result.equityCurve[i].date).toBe(t.exitDate);
    });
  });

  it("computes winRate as the exact fraction of trades with positive pnl", () => {
    const result = runOptionsBacktest(flatCandles(46, 200), "AAPL", "iron_condor", false, {});
    const wins = result.trades.filter((t) => t.pnl > 0).length;
    expect(result.winRate).toBeCloseTo(wins / result.totalTrades, 6);
  });

  it("computes rMultiple as pnl divided by the entry quote's own maxLoss", () => {
    const result = runOptionsBacktest(flatCandles(46, 200), "AAPL", "iron_condor", false, {});
    for (const t of result.trades) {
      expect(t.rMultiple).toBeCloseTo(t.pnl / t.maxLoss, 3);
    }
  });

  it("totalReturnPct reflects the exact cumulative pnl relative to the fixed starting equity", () => {
    const result = runOptionsBacktest(flatCandles(46, 200), "AAPL", "iron_condor", false, {});
    const totalPnl = result.trades.reduce((s, t) => s + t.pnl, 0);
    expect(result.totalReturnPct).toBeCloseTo(totalPnl / 100_000, 4);
  });

  it("maxDrawdownPct is never positive and reflects the equity curve's own worst peak-to-trough decline", () => {
    const result = runOptionsBacktest(flatCandles(46, 200), "AAPL", "iron_condor", false, {});
    expect(result.maxDrawdownPct).toBeLessThanOrEqual(0);
    const worst = Math.min(...result.equityCurve.map((p) => p.drawdownPct));
    expect(result.maxDrawdownPct).toBeCloseTo(worst, 6);
  });
});

describe("runOptionsBacktest — labeling, summary, determinism", () => {
  it("labels underlyingDataSource from the isLive flag and optionsDataSource always SIMULATED", () => {
    const simResult = runOptionsBacktest(flatCandles(35, 200), "AAPL", "iron_condor", false, {});
    expect(simResult.underlyingDataSource).toBe("SIMULATED");
    expect(simResult.optionsDataSource).toBe("SIMULATED");

    const liveResult = runOptionsBacktest(flatCandles(35, 200), "AAPL", "iron_condor", true, {});
    expect(liveResult.underlyingDataSource).toBe("LIVE");
    expect(liveResult.optionsDataSource).toBe("SIMULATED");
  });

  it("is deterministic — identical candles and options always produce an identical result", () => {
    const candles = flatCandles(46, 200);
    const a = runOptionsBacktest(candles, "AAPL", "iron_condor", false, {});
    const b = runOptionsBacktest(candles, "AAPL", "iron_condor", false, {});
    expect(a).toEqual(b);
  });

  it("produces a non-boilerplate summary describing real trade outcomes", () => {
    const result = runOptionsBacktest(flatCandles(46, 200), "AAPL", "iron_condor", false, {});
    expect(result.summary).toContain("AAPL");
    expect(result.summary).toContain("iron_condor");
    expect(result.summary).toMatch(/win rate/i);
  });

  it("never enters a strategy that optionsMath.ts's own finalize() rejects, proven against a real buildIronCondor() call", () => {
    const snap = getSnapshot("AAPL", "2026-01-01")!;
    const quote = buildIronCondor({ ...snap, price: 5 }, { shortDelta: 0.2, dte: DEFAULT_ENTRY_DTE });
    expect(quote.rejected).toBe(true);
    // The identical fixture, run through the full backtest, must open zero
    // trades — proven above in the "honest-unavailable paths" block too;
    // this test exists to make the causal link to optionsMath.ts's own
    // rejection explicit.
    const result = runOptionsBacktest(flatCandles(35, 5), "AAPL", "iron_condor", false, {});
    expect(result.totalTrades).toBe(0);
  });
});

describe("buildOptionsBacktest — MarketDataProvider orchestration seam", () => {
  const provider = new SimulatedMarketDataProvider();

  it("honestly returns null for an invalid ticker shape, never fabricating a backtest", async () => {
    const result = await buildOptionsBacktest("NOT A TICKER!!", "iron_condor", 180, provider);
    expect(result).toBeNull();
  });

  it("resolves a well-shaped, available backtest for a real supported symbol", async () => {
    const result = await buildOptionsBacktest("SPY", "iron_condor", 180, provider);
    expect(result).not.toBeNull();
    expect(result!.available).toBe(true);
    expect(result!.symbol).toBe("SPY");
    expect(result!.candleCount).toBe(180);
    expect(result!.underlyingDataSource).toBe("SIMULATED");
    expect(result!.totalTrades).toBeGreaterThan(0);
    expect(result!.trades.length).toBe(result!.totalTrades);
  });

  it("is deterministic across repeated calls for the same symbol", async () => {
    const a = await buildOptionsBacktest("SPY", "iron_condor", 180, provider);
    const b = await buildOptionsBacktest("SPY", "iron_condor", 180, provider);
    expect(a).toEqual(b);
  });

  it("uppercases the symbol consistently regardless of input case", async () => {
    const result = await buildOptionsBacktest("spy", "iron_condor", 180, provider);
    expect(result!.symbol).toBe("SPY");
  });
});

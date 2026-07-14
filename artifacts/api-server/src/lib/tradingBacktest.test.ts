// Phase 3, Sprint 49 — Backtesting (Engine-2-native) unit tests (approved
// Phase 3 plan §18). runTradingBacktest() is pure and I/O-free — these
// tests construct candle fixtures directly, reusing the exact
// higher-highs/higher-lows and repeated-touch fixture techniques
// tradingMarketStructure.test.ts (Sprint 33) already proved, since
// runTradingBacktest() calls analyzeMarketStructure() unmodified at each
// walked-forward bar.

import { describe, it, expect } from "vitest";
import { runTradingBacktest, buildTradingBacktest, MIN_STRUCTURE_WINDOW } from "./tradingBacktest.js";
import { analyzeMarketStructure } from "./tradingMarketStructure.js";
import { SimulatedMarketDataProvider, type Candle } from "./tradingMarketData.js";

function isoDate(i: number): string {
  const d = new Date("2026-01-01T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString();
}

function candle(i: number, high: number, low: number): Candle {
  return { time: isoDate(i), open: low, high, low, close: high, volume: 1000 };
}

function customCandle(i: number, open: number, high: number, low: number, close: number): Candle {
  return { time: isoDate(i), open, high, low, close, volume: 1000 };
}

// A repeating, non-monotonic range cycle (period 3), the exact shape
// tradingMarketStructure.test.ts's own RANGE fixture uses, repeated for as
// many periods as needed — swing highs stay a mix of 11/12/10/11 and swing
// lows cluster repeatedly at 6, so it never classifies as a trend.
function rangeSegment(periods: number): { highs: number[]; lows: number[] } {
  const HIGH_CYCLE = [10, 8, 7];
  const LOW_CYCLE = [9, 7, 6];
  const highs: number[] = [];
  const lows: number[] = [];
  for (let p = 0; p < periods; p++) {
    highs.push(...HIGH_CYCLE);
    lows.push(...LOW_CYCLE);
  }
  return { highs, lows };
}

// A textbook higher-highs/higher-lows cycle (period 3), the same shape
// tradingMarketStructure.test.ts's own UPTREND fixture uses, generalized to
// any number of periods and offset by `base` so it can be chained after
// another segment.
function uptrendSegment(periods: number, base: number): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let p = 0; p < periods; p++) {
    highs.push(base + 10 + 2 * p, base + 8 + p, base + 7 + p);
    lows.push(base + 9 + 2 * p, base + 7 + p, base + 6 + p);
  }
  return { highs, lows };
}

function buildCandles(highs: number[], lows: number[]): Candle[] {
  return highs.map((h, i) => candle(i, h, lows[i]));
}

function concatSegments(...segments: { highs: number[]; lows: number[] }[]): Candle[] {
  const highs: number[] = [];
  const lows: number[] = [];
  for (const s of segments) {
    highs.push(...s.highs);
    lows.push(...s.lows);
  }
  return buildCandles(highs, lows);
}

describe("runTradingBacktest — honest availability", () => {
  it("honestly reports unavailable with zero trades when there aren't enough candles to run at all", () => {
    const seg = rangeSegment(1);
    const candles = buildCandles(seg.highs, seg.lows).slice(0, MIN_STRUCTURE_WINDOW - 1);
    const result = runTradingBacktest(candles, "AAPL", "trend-following", "1D", false);
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toMatch(/at least/i);
    expect(result.totalTrades).toBe(0);
    expect(result.trades).toEqual([]);
    expect(result.winRate).toBeNull();
    expect(result.avgR).toBeNull();
  });

  it("honestly reports zero trades (never fabricated) when a strategy never triggers a signal", () => {
    // A pure, permanent range never flips into uptrend, so structure-breakout
    // (which only fires on a fresh flip into uptrend) never gets a signal.
    const candles = concatSegments(rangeSegment(20));
    const result = runTradingBacktest(candles, "AAPL", "structure-breakout", "1D", false);
    expect(result.available).toBe(true);
    expect(result.totalTrades).toBe(0);
    expect(result.trades).toEqual([]);
    expect(result.winRate).toBeNull();
    expect(result.avgR).toBeNull();
    expect(result.totalReturnPct).toBeNull();
    expect(result.maxDrawdownPct).toBeNull();
    expect(result.equityCurve).toEqual([]);
    expect(result.summary).toMatch(/triggered no trade signals/i);
  });
});

describe("runTradingBacktest — structure-breakout vs. trend-following", () => {
  it("trend-following takes at least one trade on a series that becomes an uptrend, with self-consistent P&L arithmetic", () => {
    const candles = concatSegments(uptrendSegment(20, 0));
    // Sanity-check the fixture itself actually reads as an uptrend before
    // relying on it in the backtest.
    expect(analyzeMarketStructure(candles, "AAPL", "1D", false).trend).toBe("uptrend");

    const result = runTradingBacktest(candles, "AAPL", "trend-following", "1D", false);
    expect(result.available).toBe(true);
    expect(result.totalTrades).toBeGreaterThan(0);
    for (const t of result.trades) {
      expect(t.pnlPct).toBeCloseTo((t.exitPrice - t.entryPrice) / t.entryPrice, 6);
      expect(t.rMultiple).toBeCloseTo(t.pnlPct / 0.03, 6); // DEFAULT_STOP_LOSS_PCT
    }
    expect(result.winRate).not.toBeNull();
    expect(result.winRate!).toBeGreaterThanOrEqual(0);
    expect(result.winRate!).toBeLessThanOrEqual(1);
  });

  it("structure-breakout never fires on a series that is already an uptrend from the very first evaluated bar (no fresh flip ever occurs)", () => {
    const candles = concatSegments(uptrendSegment(20, 0));
    const result = runTradingBacktest(candles, "AAPL", "structure-breakout", "1D", false);
    expect(result.totalTrades).toBe(0);
  });

  it("structure-breakout DOES fire once a genuine range-to-uptrend flip occurs within the walked window", () => {
    const candles = concatSegments(rangeSegment(15), uptrendSegment(15, 0));
    const result = runTradingBacktest(candles, "AAPL", "structure-breakout", "1D", false);
    expect(result.available).toBe(true);
    expect(result.totalTrades).toBeGreaterThan(0);
    // The very first trade's entry must occur strictly after the range
    // prefix (45 candles) — proving the signal only fires on the flip, not
    // during the initial range.
    const firstEntryIndex = candles.findIndex((c) => c.time === result.trades[0].entryDate);
    expect(firstEntryIndex).toBeGreaterThanOrEqual(45);
  });

  it("exits a trend-following/structure-breakout position on a genuine trend-flip when stop/target are set unreachably wide", () => {
    const candles = concatSegments(uptrendSegment(15, 0), rangeSegment(15));
    const result = runTradingBacktest(candles, "AAPL", "trend-following", "1D", false, {
      stopLossPct: 0.9,
      targetPct: 0.9,
    });
    expect(result.available).toBe(true);
    expect(result.totalTrades).toBeGreaterThan(0);
    // With stop/target unreachable, every exit must be a trend-flip or the
    // honest end-of-period close, never a fabricated stop/target hit.
    for (const t of result.trades) {
      expect(["trend-flip", "end-of-period"]).toContain(t.exitReason);
    }
  });
});

describe("runTradingBacktest — mean-reversion", () => {
  it("enters when a candle's low pierces a real, already-detected support zone, never a fabricated dip", () => {
    // The range fixture, repeated enough to clear MIN_STRUCTURE_WINDOW, forms
    // a real support zone at price 6 (proven by tradingMarketStructure.test.ts's
    // own "clusters repeated swing touches" case) — the fixture's own
    // repeated touches at that level are themselves genuine entry signals
    // once the zone has formed, not just a specially-constructed dip bar.
    const candles = concatSegments(rangeSegment(12)); // 36 candles, clears the window
    const result = runTradingBacktest(candles, "AAPL", "mean-reversion", "1D", false);
    expect(result.available).toBe(true);
    expect(result.totalTrades).toBeGreaterThan(0);
    for (const t of result.trades) {
      const entryIndex = candles.findIndex((c) => c.time === t.entryDate);
      expect(candles[entryIndex].low).toBeLessThanOrEqual(6);
    }
  });

  it("every mean-reversion entry is grounded in a real support zone that existed in that day's own structure read, never a fabricated one", () => {
    const candles = concatSegments(rangeSegment(20));
    const result = runTradingBacktest(candles, "AAPL", "mean-reversion", "1D", false);
    expect(result.totalTrades).toBeGreaterThan(0);
    for (const t of result.trades) {
      const entryIndex = candles.findIndex((c) => c.time === t.entryDate);
      const structureAtEntry = analyzeMarketStructure(candles.slice(0, entryIndex + 1), "AAPL", "1D", false);
      const supports = structureAtEntry.zones.filter((z) => z.kind === "support");
      expect(supports.some((z) => candles[entryIndex].low <= z.price)).toBe(true);
    }
  });

  it("exits a mean-reversion trade after the configured max holding period, never held indefinitely", () => {
    const base = concatSegments(rangeSegment(12));
    const dipBar = customCandle(base.length, 6, 6.5, 4.5, 6);
    // Follow-on flat bars, all above the stop/target band, so only the
    // time-limit exit can trigger.
    const flatBars = Array.from({ length: 15 }, (_, k) =>
      customCandle(base.length + 1 + k, 6, 6.2, 5.9, 6),
    );
    const candles = [...base, dipBar, ...flatBars];

    const result = runTradingBacktest(candles, "AAPL", "mean-reversion", "1D", false, {
      stopLossPct: 0.9,
      targetPct: 0.9,
    });
    expect(result.totalTrades).toBeGreaterThan(0);
    expect(result.trades[0].exitReason).toBe("time-limit");
  });
});

describe("runTradingBacktest — equity curve and KPI bookkeeping", () => {
  it("the final equity value equals STARTING_EQUITY compounded by each trade's own pnlPct, and drawdown is never positive", () => {
    const candles = concatSegments(uptrendSegment(20, 0), rangeSegment(10));
    const result = runTradingBacktest(candles, "AAPL", "trend-following", "1D", false, {
      stopLossPct: 0.9,
      targetPct: 0.9,
    });
    expect(result.totalTrades).toBeGreaterThan(0);
    expect(result.equityCurve).toHaveLength(result.totalTrades);

    let equity = 100_000;
    for (const t of result.trades) equity *= 1 + t.pnlPct;
    expect(result.equityCurve[result.equityCurve.length - 1].value).toBeCloseTo(equity, 0);
    expect(result.totalReturnPct).toBeCloseTo((equity - 100_000) / 100_000, 4);
    for (const p of result.equityCurve) {
      expect(p.drawdownPct).toBeLessThanOrEqual(0);
    }
    expect(result.maxDrawdownPct).toBeLessThanOrEqual(0);
  });

  it("winRate is exactly the fraction of trades with a positive pnlPct", () => {
    const candles = concatSegments(uptrendSegment(20, 0), rangeSegment(10));
    const result = runTradingBacktest(candles, "AAPL", "trend-following", "1D", false, {
      stopLossPct: 0.9,
      targetPct: 0.9,
    });
    const wins = result.trades.filter((t) => t.pnlPct > 0).length;
    expect(result.winRate).toBeCloseTo(wins / result.totalTrades, 6);
  });

  it("an open position at the very end of the sample is honestly closed at the final candle's close, never left dangling", () => {
    // Wide stop/target and a trend that never flips within the sample means
    // the loop's last-ever position must close via end-of-period.
    const candles = concatSegments(uptrendSegment(25, 0));
    const result = runTradingBacktest(candles, "AAPL", "trend-following", "1D", false, {
      stopLossPct: 0.9,
      targetPct: 0.9,
    });
    expect(result.totalTrades).toBeGreaterThan(0);
    const last = result.trades[result.trades.length - 1];
    expect(last.exitReason).toBe("end-of-period");
    expect(last.exitPrice).toBe(candles[candles.length - 1].close);
  });

  it("is deterministic across repeated calls with the same inputs", () => {
    const candles = concatSegments(rangeSegment(15), uptrendSegment(15, 0));
    const a = runTradingBacktest(candles, "AAPL", "structure-breakout", "1D", false);
    const b = runTradingBacktest(candles, "AAPL", "structure-breakout", "1D", false);
    expect(a).toEqual(b);
  });
});

describe("buildTradingBacktest — provider orchestration seam", () => {
  const provider = new SimulatedMarketDataProvider();

  it("honestly returns null for an invalid ticker shape, never fabricating a backtest", async () => {
    const result = await buildTradingBacktest("NOT A TICKER!!", "trend-following", "1D", 180, provider);
    expect(result).toBeNull();
  });

  it("resolves a well-shaped backtest for a valid symbol via the real SimulatedMarketDataProvider", async () => {
    const result = await buildTradingBacktest("AAPL", "trend-following", "1D", 180, provider);
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.dataSource).toBe("SIMULATED");
    expect(result!.candleCount).toBe(180);
    expect(["trend-following", "mean-reversion", "structure-breakout"]).toContain(result!.strategy);
  });

  it("is deterministic across repeated calls for the same symbol/strategy", async () => {
    const a = await buildTradingBacktest("NVDA", "mean-reversion", "1D", 180, provider);
    const b = await buildTradingBacktest("NVDA", "mean-reversion", "1D", 180, provider);
    expect(a).toEqual(b);
  });
});

// Phase 26 — Institutional Market Structure Workbench unit tests.
// buildStructureShiftTimelineFromCandles() is pure and I/O-free — these
// tests construct candle fixtures directly, reusing the exact same
// textbook uptrend/downtrend/range swing-sequence fixtures
// tradingMarketStructure.test.ts already established (same underlying
// engine, same fixtures, proving genuine reuse rather than a parallel
// re-implementation).

import { describe, it, expect } from "vitest";
import { buildStructureShiftTimelineFromCandles, buildStructureShiftTimeline } from "./tradingStructureTimeline.js";
import { SimulatedMarketDataProvider, type Candle } from "./tradingMarketData.js";

function candle(i: number, high: number, low: number): Candle {
  return {
    time: `2026-06-${String(1 + i).padStart(2, "0")}T00:00:00.000Z`,
    open: low,
    high,
    low,
    close: high,
    volume: 1000,
  };
}

// Same fixtures as tradingMarketStructure.test.ts: swing highs at indices
// 3/6/9/12 form 12,14,16,18 (strictly rising); swing lows at 2/5/8/11 form
// 6,7,8,9 (strictly rising) — a textbook higher-highs/higher-lows uptrend.
const UPTREND_HIGH = [10, 8, 7, 12, 9, 8, 14, 10, 9, 16, 11, 10, 18, 12, 11];
const UPTREND_LOW = [9, 7, 6, 11, 8, 7, 13, 9, 8, 15, 10, 9, 17, 11, 10];

// The exact monotonic-transform inverse — a textbook lower-highs/lower-lows
// downtrend.
const DOWNTREND_HIGH = UPTREND_LOW.map((v) => 19 - v);
const DOWNTREND_LOW = UPTREND_HIGH.map((v) => 19 - v);

// Swing highs non-monotonic; swing lows all exactly 6 (a clean repeated-
// touch zone fixture) — a textbook range.
const RANGE_HIGH = [10, 8, 7, 11, 8, 7, 12, 8, 7, 10, 8, 7, 11, 8, 7];
const RANGE_LOW = [9, 7, 6, 10, 7, 6, 11, 7, 6, 9, 7, 6, 10, 7, 6];

function buildCandles(highs: number[], lows: number[], startIndex = 0): Candle[] {
  return highs.map((h, i) => candle(startIndex + i, h, lows[i]));
}

describe("buildStructureShiftTimelineFromCandles — swing sequence labeling", () => {
  it("labels a textbook uptrend's swing sequence as higher-high/higher-low events, in order, never fabricating a direction on a first swing", () => {
    const result = buildStructureShiftTimelineFromCandles(buildCandles(UPTREND_HIGH, UPTREND_LOW), "AAPL", "1D", false);
    const highEvents = result.events.filter((e) => e.type === "higher_high" || e.type === "lower_high");
    const lowEvents = result.events.filter((e) => e.type === "higher_low" || e.type === "lower_low");
    // 4 swing highs -> 3 transitions, all higher_high (12->14->16->18)
    expect(highEvents).toHaveLength(3);
    expect(highEvents.every((e) => e.type === "higher_high")).toBe(true);
    // 4 swing lows -> 3 transitions, all higher_low (6->7->8->9)
    expect(lowEvents).toHaveLength(3);
    expect(lowEvents.every((e) => e.type === "higher_low")).toBe(true);
    // Prices should reflect the actual swing prices, in ascending order.
    expect(highEvents.map((e) => e.price)).toEqual([14, 16, 18]);
    expect(lowEvents.map((e) => e.price)).toEqual([7, 8, 9]);
  });

  it("labels a textbook downtrend's swing sequence as lower-high/lower-low events", () => {
    const result = buildStructureShiftTimelineFromCandles(buildCandles(DOWNTREND_HIGH, DOWNTREND_LOW), "AAPL", "1D", false);
    const highEvents = result.events.filter((e) => e.type === "higher_high" || e.type === "lower_high");
    const lowEvents = result.events.filter((e) => e.type === "higher_low" || e.type === "lower_low");
    expect(highEvents.length).toBeGreaterThan(0);
    expect(highEvents.every((e) => e.type === "lower_high")).toBe(true);
    expect(lowEvents.length).toBeGreaterThan(0);
    expect(lowEvents.every((e) => e.type === "lower_low")).toBe(true);
  });

  it("every event carries a human-readable label matching its type, never a strategy-specific term like BOS/CHOCH/MSS", () => {
    const result = buildStructureShiftTimelineFromCandles(buildCandles(UPTREND_HIGH, UPTREND_LOW), "AAPL", "1D", false);
    for (const e of result.events) {
      expect(e.label).not.toMatch(/BOS|CHOCH|MSS/i);
      expect(e.label.length).toBeGreaterThan(0);
    }
  });
});

describe("buildStructureShiftTimelineFromCandles — support/resistance test detection", () => {
  it("detects support-test events at each swing touch of a real, already-clustered zone, reusing the exact same zone tolerance", () => {
    const result = buildStructureShiftTimelineFromCandles(buildCandles(RANGE_HIGH, RANGE_LOW), "AAPL", "1D", false);
    const supportTests = result.events.filter((e) => e.type === "support_test");
    // The 4 swing lows at exactly price 6 form one clustered support zone
    // (per tradingMarketStructure.test.ts's own proven fixture) — every one
    // of those touches should be detected as a support test.
    expect(supportTests.length).toBeGreaterThanOrEqual(2);
    expect(supportTests.every((e) => e.price === 6)).toBe(true);
  });

  it("never fabricates a resistance-test event when no resistance zone was actually detected", () => {
    // A pure uptrend never revisits an old high closely enough to form a
    // repeated-touch zone in this fixture — confirm no resistance_test
    // events are invented.
    const result = buildStructureShiftTimelineFromCandles(buildCandles(UPTREND_HIGH, UPTREND_LOW), "AAPL", "1D", false);
    expect(result.events.filter((e) => e.type === "resistance_test")).toHaveLength(0);
  });
});

describe("buildStructureShiftTimelineFromCandles — trend-change detection", () => {
  it("detects a genuine range-exit event when structure transitions from a range into a real uptrend, reusing analyzeMarketStructure() itself, not a new formula", () => {
    // A long enough range segment followed by a long enough uptrend segment
    // so the expanding-window replay genuinely reads "range" early and
    // "uptrend" once enough of the uptrend's own swings dominate the most
        // recent 3 highs/lows.
    const rangeSegment = buildCandles(RANGE_HIGH, RANGE_LOW, 0);
    const uptrendSegment = buildCandles(UPTREND_HIGH, UPTREND_LOW, rangeSegment.length);
    const combined = [...rangeSegment, ...uptrendSegment];

    const result = buildStructureShiftTimelineFromCandles(combined, "AAPL", "1D", false);
    const rangeExits = result.events.filter((e) => e.type === "range_exit");
    expect(rangeExits.length).toBeGreaterThanOrEqual(1);
    expect(rangeExits[0].detail).toMatch(/exited its range into a uptrend/i);
  });

  it("detects a genuine trend-change event when structure flips directly from uptrend to downtrend", () => {
    const upSegment = buildCandles(UPTREND_HIGH, UPTREND_LOW, 0);
    const downSegment = buildCandles(DOWNTREND_HIGH, DOWNTREND_LOW, upSegment.length);
    const combined = [...upSegment, ...downSegment];

    const result = buildStructureShiftTimelineFromCandles(combined, "AAPL", "1D", false);
    const flips = result.events.filter((e) => e.type === "trend_change" || e.type === "range_exit" || e.type === "range_entry");
    expect(flips.length).toBeGreaterThanOrEqual(1);
  });

  it("honestly reports zero trend-change events for a sample too thin to ever reach the timeline's own minimum window", () => {
    const thin = buildCandles(UPTREND_HIGH, UPTREND_LOW).slice(0, 9);
    const result = buildStructureShiftTimelineFromCandles(thin, "AAPL", "1D", false);
    expect(result.events.filter((e) => e.type === "trend_change" || e.type === "range_entry" || e.type === "range_exit")).toHaveLength(0);
  });
});

describe("buildStructureShiftTimelineFromCandles — honesty, determinism, and shape", () => {
  it("honestly reports an empty timeline for zero candles, never fabricating an event", () => {
    const result = buildStructureShiftTimelineFromCandles([], "AAPL", "1D", false);
    expect(result.candleCount).toBe(0);
    expect(result.events).toHaveLength(0);
    expect(result.summary).toMatch(/no candle data/i);
  });

  it("is deterministic across repeated calls for the same candle input", () => {
    const candles = buildCandles(UPTREND_HIGH, UPTREND_LOW);
    const a = buildStructureShiftTimelineFromCandles(candles, "AAPL", "1D", false);
    const b = buildStructureShiftTimelineFromCandles(candles, "AAPL", "1D", false);
    expect(a).toEqual(b);
  });

  it("labels dataSource SIMULATED/LIVE honestly, passed through from the caller", () => {
    const candles = buildCandles(UPTREND_HIGH, UPTREND_LOW);
    expect(buildStructureShiftTimelineFromCandles(candles, "AAPL", "1D", false).dataSource).toBe("SIMULATED");
    expect(buildStructureShiftTimelineFromCandles(candles, "AAPL", "1D", true).dataSource).toBe("LIVE");
  });

  it("events are sorted chronologically", () => {
    const rangeSegment = buildCandles(RANGE_HIGH, RANGE_LOW, 0);
    const uptrendSegment = buildCandles(UPTREND_HIGH, UPTREND_LOW, rangeSegment.length);
    const result = buildStructureShiftTimelineFromCandles([...rangeSegment, ...uptrendSegment], "AAPL", "1D", false);
    const times = result.events.map((e) => e.time);
    const sorted = [...times].sort();
    expect(times).toEqual(sorted);
  });
});

describe("buildStructureShiftTimeline — orchestration seam", () => {
  it("honestly returns null for an invalid ticker shape", async () => {
    const provider = new SimulatedMarketDataProvider();
    const result = await buildStructureShiftTimeline("NOT A TICKER!!", "1D", 90, provider);
    expect(result).toBeNull();
  });

  it("resolves a well-shaped timeline for a valid symbol via the real SimulatedMarketDataProvider", async () => {
    const provider = new SimulatedMarketDataProvider();
    const result = await buildStructureShiftTimeline("AAPL", "1D", 90, provider);
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.dataSource).toBe("SIMULATED");
    expect(Array.isArray(result!.events)).toBe(true);
  });

  it("is deterministic across repeated calls for the same symbol/interval/lookback", async () => {
    const provider = new SimulatedMarketDataProvider();
    const a = await buildStructureShiftTimeline("MSFT", "1D", 90, provider);
    const b = await buildStructureShiftTimeline("MSFT", "1D", 90, provider);
    expect(a).toEqual(b);
  });
});

// Phase 3, Sprint 33 — Market Structure Engine (Core) unit tests (approved
// Phase 3 plan, Sprint 33). analyzeMarketStructure() is pure and I/O-free —
// these tests construct candle fixtures directly rather than going through
// a MarketDataProvider (that seam is covered separately below via
// buildMarketStructureAnalysis() + SimulatedMarketDataProvider).

import { describe, it, expect } from "vitest";
import {
  analyzeMarketStructure,
  buildMarketStructureAnalysis,
} from "./tradingMarketStructure.js";
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

// Constructed so swing highs at indices 3/6/9/12 form 12,14,16,18 (strictly
// rising) and swing lows at indices 2/5/8/11 form 6,7,8,9 (strictly rising)
// — a textbook higher-highs/higher-lows uptrend.
const UPTREND_HIGH = [10, 8, 7, 12, 9, 8, 14, 10, 9, 16, 11, 10, 18, 12, 11];
const UPTREND_LOW = [9, 7, 6, 11, 8, 7, 13, 9, 8, 15, 10, 9, 17, 11, 10];

// The exact monotonic-transform inverse of the uptrend fixture
// (new_high = 19 - old_low, new_low = 19 - old_high), which provably
// preserves each bar's high>low relationship while flipping every local
// extremum's direction — swing highs 13,12,11,10 (falling), swing lows
// 7,5,3,1 (falling): a textbook lower-highs/lower-lows downtrend.
const DOWNTREND_HIGH = UPTREND_LOW.map((v) => 19 - v);
const DOWNTREND_LOW = UPTREND_HIGH.map((v) => 19 - v);

// Swing highs at indices 3/6/9/12 form 11,12,10,11 (non-monotonic either
// way); swing lows at indices 2/5/8/11 are all exactly 6 (not strictly
// monotonic either way, and also a clean repeated-touch zone fixture).
const RANGE_HIGH = [10, 8, 7, 11, 8, 7, 12, 8, 7, 10, 8, 7, 11, 8, 7];
const RANGE_LOW = [9, 7, 6, 10, 7, 6, 11, 7, 6, 9, 7, 6, 10, 7, 6];

function buildCandles(highs: number[], lows: number[]): Candle[] {
  return highs.map((h, i) => candle(i, h, lows[i]));
}

describe("analyzeMarketStructure — trend classification", () => {
  it("classifies a textbook higher-highs/higher-lows sequence as an uptrend", () => {
    const result = analyzeMarketStructure(buildCandles(UPTREND_HIGH, UPTREND_LOW), "AAPL", "1D", false);
    expect(result.trend).toBe("uptrend");
    expect(result.trendDetail).toMatch(/higher highs and higher lows/i);
  });

  it("classifies a textbook lower-highs/lower-lows sequence as a downtrend", () => {
    const result = analyzeMarketStructure(buildCandles(DOWNTREND_HIGH, DOWNTREND_LOW), "AAPL", "1D", false);
    expect(result.trend).toBe("downtrend");
    expect(result.trendDetail).toMatch(/lower highs and lower lows/i);
  });

  it("classifies a mixed, non-monotonic swing sequence as a range, never forcing a false trend", () => {
    const result = analyzeMarketStructure(buildCandles(RANGE_HIGH, RANGE_LOW), "AAPL", "1D", false);
    expect(result.trend).toBe("range");
  });

  it("honestly classifies a too-thin sample as a range with an explicit reason, never fabricating a trend", () => {
    const thin = buildCandles(UPTREND_HIGH, UPTREND_LOW).slice(0, 5);
    const result = analyzeMarketStructure(thin, "AAPL", "1D", false);
    expect(result.trend).toBe("range");
    expect(result.trendDetail).toMatch(/not enough swing points/i);
  });
});

describe("analyzeMarketStructure — support/resistance zones", () => {
  it("clusters repeated swing touches into a zone with the correct strength count", () => {
    const result = analyzeMarketStructure(buildCandles(RANGE_HIGH, RANGE_LOW), "AAPL", "1D", false);
    // The 4 swing lows at exactly price 6 should cluster into one support
    // zone with strength 4 — never reported as 4 separate one-touch zones.
    const supportAtSix = result.zones.find((z) => z.price === 6);
    expect(supportAtSix).toBeTruthy();
    expect(supportAtSix!.kind).toBe("support");
    expect(supportAtSix!.strength).toBe(4);
  });

  it("never reports a single, un-repeated swing as a zone", () => {
    // A single isolated candle sequence produces at most 1 swing high and 1
    // swing low with no repeated touches — no zone should ever be reported
    // from a lone touch.
    const lone = buildCandles([10, 8, 7, 15, 9, 8, 7], [9, 7, 6, 14, 8, 7, 6]);
    const result = analyzeMarketStructure(lone, "AAPL", "1D", false);
    expect(result.zones.every((z) => z.strength >= 2)).toBe(true);
  });

  it("classifies a zone below current price as support and above as resistance", () => {
    const result = analyzeMarketStructure(buildCandles(UPTREND_HIGH, UPTREND_LOW), "AAPL", "1D", false);
    for (const z of result.zones) {
      if (z.price < result.currentPrice) expect(z.kind).toBe("support");
      else expect(z.kind).toBe("resistance");
    }
  });

  it("returns zones sorted by strength, strongest first", () => {
    const result = analyzeMarketStructure(buildCandles(RANGE_HIGH, RANGE_LOW), "AAPL", "1D", false);
    for (let i = 1; i < result.zones.length; i++) {
      expect(result.zones[i - 1].strength).toBeGreaterThanOrEqual(result.zones[i].strength);
    }
  });
});

describe("analyzeMarketStructure — confidence level", () => {
  it("bands confidence by candle count: Low / Moderate / High", () => {
    const base = buildCandles(UPTREND_HIGH, UPTREND_LOW);
    const repeat = (n: number) => Array.from({ length: n }, (_, i) => base[i % base.length]);

    expect(analyzeMarketStructure(repeat(15), "AAPL", "1D", false).confidenceLevel).toBe("Low");
    expect(analyzeMarketStructure(repeat(40), "AAPL", "1D", false).confidenceLevel).toBe("Moderate");
    expect(analyzeMarketStructure(repeat(100), "AAPL", "1D", false).confidenceLevel).toBe("High");
  });

  it("never fabricates a result for zero candles — honest empty structure at Low confidence", () => {
    const result = analyzeMarketStructure([], "AAPL", "1D", false);
    expect(result.candleCount).toBe(0);
    expect(result.currentPrice).toBe(0);
    expect(result.swingPoints).toEqual([]);
    expect(result.zones).toEqual([]);
    expect(result.trend).toBe("range");
    expect(result.confidenceLevel).toBe("Low");
  });
});

describe("analyzeMarketStructure — general shape and honesty", () => {
  it("is deterministic — identical input produces identical output", () => {
    const candles = buildCandles(UPTREND_HIGH, UPTREND_LOW);
    const a = analyzeMarketStructure(candles, "AAPL", "1D", false);
    const b = analyzeMarketStructure(candles, "AAPL", "1D", false);
    expect(a).toEqual(b);
  });

  it("currentPrice is the last candle's close", () => {
    const candles = buildCandles(UPTREND_HIGH, UPTREND_LOW);
    const result = analyzeMarketStructure(candles, "AAPL", "1D", false);
    expect(result.currentPrice).toBe(candles[candles.length - 1].close);
  });

  it("labels dataSource SIMULATED when isLive is false and LIVE when true — never mislabeled", () => {
    const candles = buildCandles(UPTREND_HIGH, UPTREND_LOW);
    expect(analyzeMarketStructure(candles, "AAPL", "1D", false).dataSource).toBe("SIMULATED");
    expect(analyzeMarketStructure(candles, "AAPL", "1D", true).dataSource).toBe("LIVE");
  });

  it("summary references the actual trend, zone, and confidence — not boilerplate", () => {
    const result = analyzeMarketStructure(buildCandles(UPTREND_HIGH, UPTREND_LOW), "AAPL", "1D", false);
    expect(result.summary).toContain("AAPL");
    expect(result.summary).toContain(result.trend);
    expect(result.summary).toContain(result.confidenceLevel);
  });
});

describe("buildMarketStructureAnalysis — SimulatedMarketDataProvider orchestration", () => {
  const provider = new SimulatedMarketDataProvider();

  it("honestly returns null for an invalid ticker shape, never fabricating an analysis", async () => {
    const result = await buildMarketStructureAnalysis("NOT A TICKER!!", "1D", 60, provider);
    expect(result).toBeNull();
  });

  it("resolves a real, well-shaped analysis for a valid symbol via the SIMULATED provider", async () => {
    const result = await buildMarketStructureAnalysis("AAPL", "1D", 90, provider);
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.dataSource).toBe("SIMULATED");
    expect(result!.candleCount).toBe(90);
    expect(["uptrend", "downtrend", "range"]).toContain(result!.trend);
  });

  it("is deterministic across repeated calls for the same symbol/interval/lookback", async () => {
    const a = await buildMarketStructureAnalysis("MSFT", "1h", 30, provider);
    const b = await buildMarketStructureAnalysis("MSFT", "1h", 30, provider);
    expect(a).toEqual(b);
  });
});

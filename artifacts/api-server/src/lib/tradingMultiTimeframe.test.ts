// Phase 3, Sprint 34 — Multi-Timeframe Trend Engine (Core) unit tests
// (approved Phase 3 plan §13, reordered to Sprint 34). analyzeMultiTimeframe()
// is pure and I/O-free — these tests construct TimeframeStructure fixtures
// directly via Sprint 33's analyzeMarketStructure() over hand-built candles
// (the same fixture methodology tradingMarketStructure.test.ts established),
// rather than going through a MarketDataProvider (that seam is covered
// separately below via buildMultiTimeframeAnalysis() + SimulatedMarketDataProvider).

import { describe, it, expect } from "vitest";
import {
  analyzeMultiTimeframe,
  buildMultiTimeframeAnalysis,
  DEFAULT_MULTI_TIMEFRAMES,
  type TimeframeStructure,
} from "./tradingMultiTimeframe.js";
import { analyzeMarketStructure } from "./tradingMarketStructure.js";
import { SimulatedMarketDataProvider, type Candle, type Timeframe } from "./tradingMarketData.js";

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

function buildCandles(highs: number[], lows: number[]): Candle[] {
  return highs.map((h, i) => candle(i, h, lows[i]));
}

// Reused verbatim from tradingMarketStructure.test.ts's own proven fixtures
// (same swing-point math, same mirror-transform proof for the downtrend
// case) — kept local rather than imported so this file stays independently
// readable and doesn't reach into another test file's internals.
const UPTREND_HIGH = [10, 8, 7, 12, 9, 8, 14, 10, 9, 16, 11, 10, 18, 12, 11];
const UPTREND_LOW = [9, 7, 6, 11, 8, 7, 13, 9, 8, 15, 10, 9, 17, 11, 10];
const DOWNTREND_HIGH = UPTREND_LOW.map((v) => 19 - v);
const DOWNTREND_LOW = UPTREND_HIGH.map((v) => 19 - v);
const RANGE_HIGH = [10, 8, 7, 11, 8, 7, 12, 8, 7, 10, 8, 7, 11, 8, 7];
const RANGE_LOW = [9, 7, 6, 10, 7, 6, 11, 7, 6, 9, 7, 6, 10, 7, 6];

function structureFor(interval: Timeframe, highs: number[], lows: number[]): TimeframeStructure {
  return {
    interval,
    structure: analyzeMarketStructure(buildCandles(highs, lows), "AAPL", interval, false),
  };
}

describe("analyzeMultiTimeframe — trend agreement and dominant trend", () => {
  it("reports unanimous agreement and 100% confluence when every timeframe agrees", () => {
    const timeframes = [
      structureFor("15m", UPTREND_HIGH, UPTREND_LOW),
      structureFor("1h", UPTREND_HIGH, UPTREND_LOW),
      structureFor("1D", UPTREND_HIGH, UPTREND_LOW),
    ];
    const result = analyzeMultiTimeframe("AAPL", timeframes, false);
    expect(result.trendAgreement).toBe("unanimous");
    expect(result.dominantTrend).toBe("uptrend");
    expect(result.confluenceScore).toBe(100);
  });

  it("reports majority agreement with a correct confluence percentage when 2 of 3 timeframes agree", () => {
    const timeframes = [
      structureFor("15m", UPTREND_HIGH, UPTREND_LOW),
      structureFor("1h", UPTREND_HIGH, UPTREND_LOW),
      structureFor("1D", RANGE_HIGH, RANGE_LOW),
    ];
    const result = analyzeMultiTimeframe("AAPL", timeframes, false);
    expect(result.trendAgreement).toBe("majority");
    expect(result.dominantTrend).toBe("uptrend");
    expect(result.confluenceScore).toBe(67); // round(2/3 * 100)
  });

  it("honestly reports split agreement with no dominant trend when all 3 timeframes disagree", () => {
    const timeframes = [
      structureFor("15m", UPTREND_HIGH, UPTREND_LOW),
      structureFor("1h", DOWNTREND_HIGH, DOWNTREND_LOW),
      structureFor("1D", RANGE_HIGH, RANGE_LOW),
    ];
    const result = analyzeMultiTimeframe("AAPL", timeframes, false);
    expect(result.trendAgreement).toBe("split");
    expect(result.dominantTrend).toBeNull();
    expect(result.confluenceScore).toBeNull();
  });

  it("never fabricates a dominant trend on a genuine 2-vs-2 tie", () => {
    const timeframes = [
      structureFor("15m", UPTREND_HIGH, UPTREND_LOW),
      structureFor("1h", UPTREND_HIGH, UPTREND_LOW),
      structureFor("1D", DOWNTREND_HIGH, DOWNTREND_LOW),
      { interval: "5m" as Timeframe, structure: analyzeMarketStructure(buildCandles(DOWNTREND_HIGH, DOWNTREND_LOW), "AAPL", "5m", false) },
    ];
    const result = analyzeMultiTimeframe("AAPL", timeframes, false);
    expect(result.dominantTrend).toBeNull();
    expect(result.confluenceScore).toBeNull();
  });

  it("honestly reports insufficient-data with a null dominant trend and confluence score for a single timeframe", () => {
    const timeframes = [structureFor("1D", UPTREND_HIGH, UPTREND_LOW)];
    const result = analyzeMultiTimeframe("AAPL", timeframes, false);
    expect(result.trendAgreement).toBe("insufficient-data");
    expect(result.dominantTrend).toBeNull();
    expect(result.confluenceScore).toBeNull();
    expect(result.confidenceLevel).toBe("Low");
  });

  it("honestly reports insufficient-data for zero timeframes, never crashing or fabricating", () => {
    const result = analyzeMultiTimeframe("AAPL", [], false);
    expect(result.trendAgreement).toBe("insufficient-data");
    expect(result.dominantTrend).toBeNull();
    expect(result.confluenceScore).toBeNull();
    expect(result.timeframes).toEqual([]);
  });
});

describe("analyzeMultiTimeframe — confidence level", () => {
  it("is Low when any considered timeframe itself has Low confidence, even if trends agree", () => {
    const thin = buildCandles(UPTREND_HIGH, UPTREND_LOW).slice(0, 5); // too thin for Structure's own High/Moderate bands
    const timeframes: TimeframeStructure[] = [
      { interval: "15m", structure: analyzeMarketStructure(thin, "AAPL", "15m", false) },
      structureFor("1D", UPTREND_HIGH, UPTREND_LOW),
    ];
    const result = analyzeMultiTimeframe("AAPL", timeframes, false);
    expect(result.confidenceLevel).toBe("Low");
  });

  it("is Low when timeframes genuinely split, regardless of individual per-timeframe confidence", () => {
    const timeframes = [
      structureFor("15m", UPTREND_HIGH, UPTREND_LOW),
      structureFor("1h", DOWNTREND_HIGH, DOWNTREND_LOW),
    ];
    const result = analyzeMultiTimeframe("AAPL", timeframes, false);
    expect(result.trendAgreement).toBe("split");
    expect(result.confidenceLevel).toBe("Low");
  });
});

describe("analyzeMultiTimeframe — general shape and honesty", () => {
  it("is deterministic — identical input produces identical output", () => {
    const timeframes = [structureFor("15m", UPTREND_HIGH, UPTREND_LOW), structureFor("1D", UPTREND_HIGH, UPTREND_LOW)];
    const a = analyzeMultiTimeframe("AAPL", timeframes, false);
    const b = analyzeMultiTimeframe("AAPL", timeframes, false);
    expect(a).toEqual(b);
  });

  it("labels dataSource SIMULATED when isLive is false and LIVE when true — never mislabeled", () => {
    const timeframes = [structureFor("15m", UPTREND_HIGH, UPTREND_LOW), structureFor("1D", UPTREND_HIGH, UPTREND_LOW)];
    expect(analyzeMultiTimeframe("AAPL", timeframes, false).dataSource).toBe("SIMULATED");
    expect(analyzeMultiTimeframe("AAPL", timeframes, true).dataSource).toBe("LIVE");
  });

  it("summary references the actual symbol, agreement, and confidence — not boilerplate", () => {
    const timeframes = [structureFor("15m", UPTREND_HIGH, UPTREND_LOW), structureFor("1D", UPTREND_HIGH, UPTREND_LOW)];
    const result = analyzeMultiTimeframe("AAPL", timeframes, false);
    expect(result.summary).toContain("AAPL");
    expect(result.summary).toContain(result.trendAgreement);
    expect(result.summary).toContain(result.confidenceLevel);
  });
});

describe("buildMultiTimeframeAnalysis — SimulatedMarketDataProvider orchestration", () => {
  const provider = new SimulatedMarketDataProvider();

  it("honestly returns null for an invalid ticker shape, never fabricating an analysis", async () => {
    const result = await buildMultiTimeframeAnalysis("NOT A TICKER!!", provider);
    expect(result).toBeNull();
  });

  it("resolves a real, well-shaped analysis for a valid symbol using the default timeframe set", async () => {
    const result = await buildMultiTimeframeAnalysis("AAPL", provider);
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.dataSource).toBe("SIMULATED");
    expect(result!.timeframes.map((t) => t.interval)).toEqual(DEFAULT_MULTI_TIMEFRAMES);
    expect(["unanimous", "majority", "split", "insufficient-data"]).toContain(result!.trendAgreement);
  });

  it("respects a caller-supplied timeframe subset instead of the default set", async () => {
    const result = await buildMultiTimeframeAnalysis("MSFT", provider, ["1h", "1D"]);
    expect(result).not.toBeNull();
    expect(result!.timeframes.map((t) => t.interval)).toEqual(["1h", "1D"]);
  });

  it("is deterministic across repeated calls for the same symbol/timeframe set", async () => {
    const a = await buildMultiTimeframeAnalysis("NVDA", provider);
    const b = await buildMultiTimeframeAnalysis("NVDA", provider);
    expect(a).toEqual(b);
  });
});

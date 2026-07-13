// Phase 3, Sprint 35 — Order Flow and Liquidity Engine (Core) unit tests
// (approved Phase 3 plan §11). analyzeLiquidity() is pure and I/O-free —
// these tests construct candle fixtures directly rather than going through
// a MarketDataProvider (that seam is covered separately below via
// buildLiquidityAnalysis() + SimulatedMarketDataProvider).

import { describe, it, expect } from "vitest";
import { analyzeLiquidity, buildLiquidityAnalysis } from "./tradingLiquidity.js";
import { SimulatedMarketDataProvider, type Candle } from "./tradingMarketData.js";

function candle(i: number, open: number, close: number, volume: number, high?: number, low?: number): Candle {
  return {
    time: `2026-06-${String(1 + i).padStart(2, "0")}T00:00:00.000Z`,
    open,
    close,
    high: high ?? Math.max(open, close),
    low: low ?? Math.min(open, close),
    volume,
  };
}

describe("analyzeLiquidity — volume profile", () => {
  it("clusters candles into price-level buckets with correct volume and pctOfTotal", () => {
    // Two clearly separated price clusters: ~$10 (600 total volume) and
    // ~$50 (400 total volume), 1000 total volume.
    const candles = [
      candle(0, 9, 10, 200),
      candle(1, 10, 11, 200),
      candle(2, 9, 10, 200),
      candle(3, 49, 50, 400),
    ];
    const result = analyzeLiquidity(candles, "AAPL", "1D", false);
    expect(result.volumeProfile.length).toBeGreaterThan(0);
    const totalVolume = result.volumeProfile.reduce((s, l) => s + l.volume, 0);
    expect(totalVolume).toBe(1000);
    // Sorted strongest-volume level first.
    expect(result.volumeProfile[0].volume).toBeGreaterThanOrEqual(result.volumeProfile[1]?.volume ?? 0);
    const strongest = result.volumeProfile[0];
    expect(strongest.pctOfTotal).toBeCloseTo((strongest.volume / 1000) * 100, 1);
  });

  it("never fabricates a volume profile level for a zero-candle or zero-volume sample", () => {
    expect(analyzeLiquidity([], "AAPL", "1D", false).volumeProfile).toEqual([]);
    const zeroVol = [candle(0, 10, 12, 0), candle(1, 12, 11, 0)];
    expect(analyzeLiquidity(zeroVol, "AAPL", "1D", false).volumeProfile).toEqual([]);
  });

  it("handles a degenerate zero-range sample (identical price every bar) without dividing by zero", () => {
    const flat = [candle(0, 10, 10, 500), candle(1, 10, 10, 500)];
    const result = analyzeLiquidity(flat, "AAPL", "1D", false);
    expect(result.volumeProfile.length).toBe(1);
    expect(result.volumeProfile[0].price).toBe(10);
    expect(result.volumeProfile[0].volume).toBe(1000);
  });
});

describe("analyzeLiquidity — liquidity score and band", () => {
  it("bands liquidity Low / Moderate / High by average daily dollar volume", () => {
    const low = [candle(0, 49, 50, 100_000)]; // $5M avg dollar volume -> score 20
    const moderate = [candle(0, 99, 100, 100_000)]; // $10M avg dollar volume -> score 40
    const high = [candle(0, 99, 100, 225_000)]; // $22.5M avg dollar volume -> score 90

    expect(analyzeLiquidity(low, "AAPL", "1D", false).liquidityBand).toBe("Low");
    expect(analyzeLiquidity(low, "AAPL", "1D", false).liquidityScore).toBe(20);

    expect(analyzeLiquidity(moderate, "AAPL", "1D", false).liquidityBand).toBe("Moderate");
    expect(analyzeLiquidity(moderate, "AAPL", "1D", false).liquidityScore).toBe(40);

    expect(analyzeLiquidity(high, "AAPL", "1D", false).liquidityBand).toBe("High");
    expect(analyzeLiquidity(high, "AAPL", "1D", false).liquidityScore).toBe(90);
  });

  it("caps the liquidity score at 100, never exceeding it for extremely high dollar volume", () => {
    const megaCap = [candle(0, 499, 500, 10_000_000)]; // $5B avg dollar volume
    const result = analyzeLiquidity(megaCap, "AAPL", "1D", false);
    expect(result.liquidityScore).toBe(100);
    expect(result.liquidityBand).toBe("High");
  });

  it("honestly floors the score at 0 for zero or empty volume, never a fabricated positive score", () => {
    const result = analyzeLiquidity([], "AAPL", "1D", false);
    expect(result.liquidityScore).toBe(0);
    expect(result.liquidityBand).toBe("Low");
    expect(result.avgDollarVolume).toBe(0);
  });
});

describe("analyzeLiquidity — buy/sell pressure", () => {
  it("reads buying pressure from a run of bullish candles", () => {
    const bullish = [candle(0, 10, 11, 1000), candle(1, 11, 12, 1000), candle(2, 12, 13, 1000)];
    const result = analyzeLiquidity(bullish, "AAPL", "1D", false);
    expect(result.buySellPressure.direction).toBe("buying");
    expect(result.buySellPressure.buyPct).toBe(100);
  });

  it("reads selling pressure from a run of bearish candles", () => {
    const bearish = [candle(0, 13, 12, 1000), candle(1, 12, 11, 1000), candle(2, 11, 10, 1000)];
    const result = analyzeLiquidity(bearish, "AAPL", "1D", false);
    expect(result.buySellPressure.direction).toBe("selling");
    expect(result.buySellPressure.sellPct).toBe(100);
  });

  it("reads neutral pressure from an evenly split sample, never forcing a direction", () => {
    const mixed = [candle(0, 10, 11, 1000), candle(1, 11, 10, 1000)];
    const result = analyzeLiquidity(mixed, "AAPL", "1D", false);
    expect(result.buySellPressure.direction).toBe("neutral");
    expect(result.buySellPressure.buyPct).toBe(50);
  });

  it("excludes doji (close === open) candle volume from the directional total rather than guessing", () => {
    const dojiOnly = [candle(0, 10, 10, 1000)];
    const result = analyzeLiquidity(dojiOnly, "AAPL", "1D", false);
    expect(result.buySellPressure).toEqual({ buyPct: 50, sellPct: 50, direction: "neutral" });
  });
});

describe("analyzeLiquidity — confidence level", () => {
  it("bands confidence by candle count: Low / Moderate / High", () => {
    const one = candle(0, 10, 11, 1000);
    const repeat = (n: number) => Array.from({ length: n }, (_, i) => ({ ...one, time: `2026-06-01T00:${String(i).padStart(2, "0")}:00.000Z` }));

    expect(analyzeLiquidity(repeat(15), "AAPL", "1D", false).confidenceLevel).toBe("Low");
    expect(analyzeLiquidity(repeat(40), "AAPL", "1D", false).confidenceLevel).toBe("Moderate");
    expect(analyzeLiquidity(repeat(100), "AAPL", "1D", false).confidenceLevel).toBe("High");
  });

  it("never fabricates a result for zero candles — honest empty structure at Low confidence", () => {
    const result = analyzeLiquidity([], "AAPL", "1D", false);
    expect(result.candleCount).toBe(0);
    expect(result.currentPrice).toBe(0);
    expect(result.volumeProfile).toEqual([]);
    expect(result.buySellPressure).toEqual({ buyPct: 50, sellPct: 50, direction: "neutral" });
    expect(result.confidenceLevel).toBe("Low");
  });
});

describe("analyzeLiquidity — general shape and honesty", () => {
  it("is deterministic — identical input produces identical output", () => {
    const candles = [candle(0, 10, 11, 1000), candle(1, 11, 12, 1200)];
    const a = analyzeLiquidity(candles, "AAPL", "1D", false);
    const b = analyzeLiquidity(candles, "AAPL", "1D", false);
    expect(a).toEqual(b);
  });

  it("currentPrice is the last candle's close", () => {
    const candles = [candle(0, 10, 11, 1000), candle(1, 11, 12.5, 1200)];
    const result = analyzeLiquidity(candles, "AAPL", "1D", false);
    expect(result.currentPrice).toBe(candles[candles.length - 1].close);
  });

  it("labels dataSource SIMULATED when isLive is false and LIVE when true — never mislabeled", () => {
    const candles = [candle(0, 10, 11, 1000)];
    expect(analyzeLiquidity(candles, "AAPL", "1D", false).dataSource).toBe("SIMULATED");
    expect(analyzeLiquidity(candles, "AAPL", "1D", true).dataSource).toBe("LIVE");
  });

  it("summary references the actual symbol, liquidity band, and confidence — not boilerplate", () => {
    const candles = [candle(0, 99, 100, 225_000)];
    const result = analyzeLiquidity(candles, "AAPL", "1D", false);
    expect(result.summary).toContain("AAPL");
    expect(result.summary).toContain(result.liquidityBand);
    expect(result.summary).toContain(result.confidenceLevel);
  });
});

describe("buildLiquidityAnalysis — SimulatedMarketDataProvider orchestration", () => {
  const provider = new SimulatedMarketDataProvider();

  it("honestly returns null for an invalid ticker shape, never fabricating an analysis", async () => {
    const result = await buildLiquidityAnalysis("NOT A TICKER!!", "1D", 60, provider);
    expect(result).toBeNull();
  });

  it("resolves a real, well-shaped analysis for a valid symbol via the SIMULATED provider", async () => {
    const result = await buildLiquidityAnalysis("AAPL", "1D", 90, provider);
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.dataSource).toBe("SIMULATED");
    expect(result!.candleCount).toBe(90);
    expect(["High", "Moderate", "Low"]).toContain(result!.liquidityBand);
    expect(["buying", "selling", "neutral"]).toContain(result!.buySellPressure.direction);
  });

  it("is deterministic across repeated calls for the same symbol/interval/lookback", async () => {
    const a = await buildLiquidityAnalysis("MSFT", "1h", 30, provider);
    const b = await buildLiquidityAnalysis("MSFT", "1h", 30, provider);
    expect(a).toEqual(b);
  });
});

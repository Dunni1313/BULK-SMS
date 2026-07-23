// Phase 27 — Institutional Liquidity & Session Workbench. Unit tests for
// the new Liquidity Timeline module. Reuses tradingLiquidity.test.ts's own
// candle-fixture helper shape.

import { describe, it, expect } from "vitest";
import { buildLiquidityTimelineFromCandles, buildLiquidityTimeline } from "./tradingLiquidityTimeline.js";
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

describe("buildLiquidityTimelineFromCandles", () => {
  it("honestly returns an empty, well-shaped timeline for a zero-candle sample, never fabricating a point", () => {
    const result = buildLiquidityTimelineFromCandles([], "AAPL", "1D", false);
    expect(result.points).toEqual([]);
    expect(result.relativeLiquidity).toBe("Insufficient Data");
    expect(result.averageLiquidityScore).toBeNull();
    expect(result.keyLiquidityZones).toEqual([]);
  });

  it("produces zero timeline points when the sample is thinner than one rolling window (fewer than 5 candles)", () => {
    const candles = [candle(0, 10, 11, 100), candle(1, 11, 12, 100)];
    const result = buildLiquidityTimelineFromCandles(candles, "AAPL", "1D", false);
    expect(result.points).toEqual([]);
    expect(result.candleCount).toBe(2);
  });

  it("produces exactly (n - windowSize + 1) rolling-window points for a sample of n >= 5 candles", () => {
    const candles = Array.from({ length: 8 }, (_, i) => candle(i, 10 + i, 11 + i, 100));
    const result = buildLiquidityTimelineFromCandles(candles, "AAPL", "1D", false);
    expect(result.points.length).toBe(8 - 5 + 1);
    for (const p of result.points) {
      expect(["High", "Moderate", "Low"]).toContain(p.liquidityBand);
      expect(["buying", "selling", "neutral"]).toContain(p.buySellDirection);
    }
  });

  it("is deterministic across repeated calls for the same candles", () => {
    const candles = Array.from({ length: 10 }, (_, i) => candle(i, 10 + i, 11 + i, 100 * (i + 1)));
    const a = buildLiquidityTimelineFromCandles(candles, "AAPL", "1D", false);
    const b = buildLiquidityTimelineFromCandles(candles, "AAPL", "1D", false);
    expect(a).toEqual(b);
  });

  it("classifies relative liquidity Above Average when the latest window's volume is genuinely much larger than the prior average", () => {
    // 5 quiet days (low, steady volume) followed by 5 much higher-volume
    // days — the latest 5-day rolling window should read a materially
    // higher liquidity score than the earlier rolling windows.
    const quiet = Array.from({ length: 6 }, (_, i) => candle(i, 10, 10.1, 1_000));
    const busy = Array.from({ length: 6 }, (_, i) => candle(6 + i, 100, 100.5, 5_000_000));
    const candles = [...quiet, ...busy];
    const result = buildLiquidityTimelineFromCandles(candles, "AAPL", "1D", false);
    expect(result.relativeLiquidity).toBe("Above Average");
    expect(result.averageLiquidityScore).not.toBeNull();
  });

  it("classifies relative liquidity Average when every rolling window reads the same liquidity score", () => {
    const candles = Array.from({ length: 10 }, (_, i) => candle(i, 100, 100.5, 1_000_000));
    const result = buildLiquidityTimelineFromCandles(candles, "AAPL", "1D", false);
    expect(result.relativeLiquidity).toBe("Average");
  });

  it("reuses the full-sample volume profile (unmodified) as the Key Liquidity Zones list", () => {
    const candles = [
      candle(0, 9, 10, 200),
      candle(1, 10, 11, 200),
      candle(2, 9, 10, 200),
      candle(3, 49, 50, 400),
      candle(4, 49, 51, 400),
    ];
    const result = buildLiquidityTimelineFromCandles(candles, "AAPL", "1D", false);
    expect(result.keyLiquidityZones.length).toBeGreaterThan(0);
    const totalVolume = result.keyLiquidityZones.reduce((s, l) => s + l.volume, 0);
    expect(totalVolume).toBeLessThanOrEqual(candles.reduce((s, c) => s + c.volume, 0));
  });

  it("labels the dataSource honestly (SIMULATED vs LIVE) from the isLive flag", () => {
    const candles = Array.from({ length: 5 }, (_, i) => candle(i, 10, 11, 100));
    expect(buildLiquidityTimelineFromCandles(candles, "AAPL", "1D", false).dataSource).toBe("SIMULATED");
    expect(buildLiquidityTimelineFromCandles(candles, "AAPL", "1D", true).dataSource).toBe("LIVE");
  });
});

describe("buildLiquidityTimeline (orchestration)", () => {
  it("honestly returns null for an invalid ticker shape", async () => {
    const provider = new SimulatedMarketDataProvider();
    const result = await buildLiquidityTimeline("NOT A TICKER!!", "1D", 90, provider);
    expect(result).toBeNull();
  });

  it("resolves a well-shaped timeline for a known symbol", async () => {
    const provider = new SimulatedMarketDataProvider();
    const result = await buildLiquidityTimeline("AAPL", "1D", 90, provider);
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.points.length).toBeGreaterThan(0);
  });

  it("is deterministic across repeated calls for the same symbol", async () => {
    const provider = new SimulatedMarketDataProvider();
    const a = await buildLiquidityTimeline("MSFT", "1D", 90, provider);
    const b = await buildLiquidityTimeline("MSFT", "1D", 90, provider);
    expect(a).toEqual(b);
  });
});

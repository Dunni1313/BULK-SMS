// Phase 3, Sprint 32 — Institutional Trading Engine, Market Data Foundation
// (approved Phase 3 plan, Sprint 32). SimulatedMarketDataProvider is pure and
// I/O-free — these tests call it directly, no database/provider dependency.

import { describe, it, expect } from "vitest";
import {
  SimulatedMarketDataProvider,
  isValidTradingTickerShape,
  TRADING_MARKET_UNIVERSE,
  MAX_LOOKBACK,
  type Timeframe,
} from "./tradingMarketData.js";

const provider = new SimulatedMarketDataProvider();

describe("SimulatedMarketDataProvider — identity", () => {
  it("reports id=simulated and isLive=false", () => {
    expect(provider.id).toBe("simulated");
    expect(provider.isLive).toBe(false);
  });
});

describe("isValidTradingTickerShape", () => {
  it("accepts plain and share-class tickers", () => {
    expect(isValidTradingTickerShape("AAPL")).toBe(true);
    expect(isValidTradingTickerShape("SPY")).toBe(true);
    expect(isValidTradingTickerShape("BRK.B")).toBe(true);
  });

  it("rejects obviously invalid input, never fabricating a report for arbitrary text", () => {
    expect(isValidTradingTickerShape("NOT A TICKER!!")).toBe(false);
    expect(isValidTradingTickerShape("")).toBe(false);
    expect(isValidTradingTickerShape("TOOLONGTICKER")).toBe(false);
  });
});

describe("SimulatedMarketDataProvider.getCandles — determinism and honesty", () => {
  const timeframes: Timeframe[] = ["1m", "5m", "15m", "1h", "1D"];

  it("returns null for an invalid ticker shape, never fabricating candles", async () => {
    const result = await provider.getCandles("NOT A TICKER!!", "1D", 10);
    expect(result).toBeNull();
  });

  it.each(timeframes)("is byte-identical across repeated calls for the same symbol/interval/asOf (%s)", async (interval) => {
    const a = await provider.getCandles("AAPL", interval, 20, "2026-06-15");
    const b = await provider.getCandles("AAPL", interval, 20, "2026-06-15");
    expect(a).toEqual(b);
  });

  it.each(timeframes)("produces range-valid OHLCV candles (%s)", async (interval) => {
    const candles = await provider.getCandles("MSFT", interval, 10, "2026-06-15");
    expect(candles).not.toBeNull();
    expect(candles!.length).toBeGreaterThan(0);
    for (const c of candles!) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
      expect(c.high).toBeGreaterThanOrEqual(c.low);
      expect(c.volume).toBeGreaterThan(0);
      expect(Number.isFinite(c.open)).toBe(true);
      expect(Number.isFinite(c.close)).toBe(true);
      expect(new Date(c.time).toString()).not.toBe("Invalid Date");
    }
  });

  it("returns candles in oldest -> newest order", async () => {
    const candles = await provider.getCandles("AAPL", "1D", 5, "2026-06-15");
    expect(candles).not.toBeNull();
    const times = candles!.map((c) => Date.parse(c.time));
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it("clamps a requested lookback beyond the timeframe's max, never silently expanding it", async () => {
    const candles = await provider.getCandles("AAPL", "1D", 10_000, "2026-06-15");
    expect(candles).not.toBeNull();
    expect(candles!.length).toBe(MAX_LOOKBACK["1D"]);
  });

  it("clamps a requested lookback below 1 up to at least 1 bar", async () => {
    const candles = await provider.getCandles("AAPL", "1D", 0, "2026-06-15");
    expect(candles).not.toBeNull();
    expect(candles!.length).toBe(1);
  });

  it("honestly produces plausible candles for a symbol outside the default universe (syntheticProfile-style honest generation)", async () => {
    expect(TRADING_MARKET_UNIVERSE.find((u) => u.symbol === "IBM")).toBeUndefined();
    const candles = await provider.getCandles("IBM", "1D", 5, "2026-06-15");
    expect(candles).not.toBeNull();
    expect(candles!.length).toBe(5);
    for (const c of candles!) {
      expect(c.close).toBeGreaterThan(0);
    }
  });

  it("differs across symbols (seeded per-symbol, not a single global series)", async () => {
    const a = await provider.getCandles("AAPL", "1D", 5, "2026-06-15");
    const b = await provider.getCandles("MSFT", "1D", 5, "2026-06-15");
    expect(a!.map((c) => c.close)).not.toEqual(b!.map((c) => c.close));
  });

  it("intraday session bars roughly bracket the day's own 1D close (internal consistency, not disconnected walks)", async () => {
    const daily = await provider.getCandles("AAPL", "1D", 1, "2026-06-15");
    const intraday = await provider.getCandles("AAPL", "1h", 7, "2026-06-15");
    expect(daily).not.toBeNull();
    expect(intraday).not.toBeNull();
    const lastIntradayClose = intraday![intraday!.length - 1].close;
    expect(lastIntradayClose).toBeCloseTo(daily![0].close, 0);
  });
});

describe("SimulatedMarketDataProvider.getQuote — determinism and honesty", () => {
  it("returns null for an invalid ticker shape, never fabricating a quote", async () => {
    const result = await provider.getQuote("NOT A TICKER!!");
    expect(result).toBeNull();
  });

  it("returns a deterministic price/volume for a fixed asOf date, independent of wall-clock asOf timestamp", async () => {
    const a = await provider.getQuote("AAPL", "2026-06-15");
    const b = await provider.getQuote("AAPL", "2026-06-15");
    expect(a).not.toBeNull();
    expect(a!.price).toBe(b!.price);
    expect(a!.volume).toBe(b!.volume);
  });

  it("matches the same day's 1D candle close (internally consistent with getCandles)", async () => {
    const quote = await provider.getQuote("AAPL", "2026-06-15");
    const candles = await provider.getCandles("AAPL", "1D", 1, "2026-06-15");
    expect(quote!.price).toBe(candles![0].close);
  });
});

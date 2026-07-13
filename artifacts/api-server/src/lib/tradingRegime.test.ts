// Phase 3, Sprint 36 — Market Regime Detection Engine (Core) unit tests
// (approved Phase 3 plan §25 Decision 3, §0 Correction 1). analyzeMarketRegime()
// is pure and I/O-free — these tests construct MultiTimeframeAnalysis /
// LiquidityAnalysis / daily-candle fixtures directly rather than going
// through a MarketDataProvider (that seam is covered separately below via
// buildMarketRegimeAnalysis() + SimulatedMarketDataProvider).

import { describe, it, expect } from "vitest";
import { analyzeMarketRegime, buildMarketRegimeAnalysis } from "./tradingRegime.js";
import type { MultiTimeframeAnalysis } from "./tradingMultiTimeframe.js";
import type { LiquidityAnalysis, LiquidityBand } from "./tradingLiquidity.js";
import type { AgreementSignal } from "./marginOfSafety.js";
import type { MarketStructureConfidenceLevel, TrendStructure } from "./tradingMarketStructure.js";
import { SimulatedMarketDataProvider, type Candle } from "./tradingMarketData.js";

function fakeMultiTimeframe(
  dominantTrend: TrendStructure | null,
  trendAgreement: AgreementSignal,
  confidenceLevel: MarketStructureConfidenceLevel,
): MultiTimeframeAnalysis {
  return {
    symbol: "TEST",
    dataSource: "SIMULATED",
    timeframes: [],
    trendAgreement,
    dominantTrend,
    confluenceScore: dominantTrend ? 100 : null,
    confidenceLevel,
    confidenceExplanation: "fixture",
    summary: "fixture",
  };
}

function fakeLiquidity(liquidityBand: LiquidityBand, confidenceLevel: MarketStructureConfidenceLevel): LiquidityAnalysis {
  return {
    symbol: "TEST",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 90,
    currentPrice: 100,
    volumeProfile: [],
    avgDollarVolume: 10_000_000,
    liquidityScore: 50,
    liquidityBand,
    buySellPressure: { buyPct: 50, sellPct: 50, direction: "neutral" },
    confidenceLevel,
    confidenceExplanation: "fixture",
    summary: "fixture",
  };
}

// Builds daily candles from a repeating log-return pattern starting at
// price 100 — volatility is computed purely from `close`, so open/high/low
// are irrelevant filler here (set equal to close) and volume is a constant.
function buildDailyCandles(logReturns: number[], repeats: number): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  candles.push({ time: "2026-01-01T00:00:00.000Z", open: price, high: price, low: price, close: price, volume: 1000 });
  let i = 1;
  for (let r = 0; r < repeats; r++) {
    for (const logReturn of logReturns) {
      price = price * Math.exp(logReturn);
      candles.push({
        time: `2026-01-${String(1 + i).padStart(2, "0")}T00:00:00.000Z`,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1000,
      });
      i++;
    }
  }
  return candles;
}

describe("analyzeMarketRegime — volatility computation and banding", () => {
  it("bands a near-flat price series as low volatility", () => {
    const candles = buildDailyCandles([0.0002, -0.0002], 20);
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("range", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      candles,
      false,
    );
    expect(result.volatilityRegime).toBe("low");
    expect(result.volatilityAnnualizedPct).not.toBeNull();
    expect(result.volatilityAnnualizedPct!).toBeLessThanOrEqual(15);
  });

  it("bands a wildly swinging price series as high volatility", () => {
    const candles = buildDailyCandles([0.35, -0.35], 20);
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("range", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      candles,
      false,
    );
    expect(result.volatilityRegime).toBe("high");
    expect(result.volatilityAnnualizedPct!).toBeGreaterThanOrEqual(40);
  });

  it("bands a moderately moving price series as normal volatility", () => {
    const candles = buildDailyCandles([0.0158, -0.0158], 20);
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("range", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      candles,
      false,
    );
    expect(result.volatilityRegime).toBe("normal");
    expect(result.volatilityAnnualizedPct!).toBeGreaterThan(15);
    expect(result.volatilityAnnualizedPct!).toBeLessThan(40);
  });

  it("honestly defaults to a normal volatility read with an explicit reason for a too-thin daily sample, never fabricating high/low", () => {
    const candles = buildDailyCandles([0.01], 1); // just 2 candles total
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("range", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      [candles[0]], // force down to a single candle — no return computable at all
      false,
    );
    expect(result.volatilityAnnualizedPct).toBeNull();
    expect(result.volatilityRegime).toBe("normal");
    expect(result.volatilityExplanation).toMatch(/not enough/i);
  });
});

describe("analyzeMarketRegime — regime label derivation", () => {
  const normalVolCandles = buildDailyCandles([0.0158, -0.0158], 20);
  const highVolCandles = buildDailyCandles([0.35, -0.35], 20);
  const lowVolCandles = buildDailyCandles([0.0002, -0.0002], 20);

  it("labels trending-bullish whenever the dominant trend is uptrend, regardless of volatility", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("uptrend", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      highVolCandles,
      false,
    );
    expect(result.regimeLabel).toBe("trending-bullish");
  });

  it("labels trending-bearish whenever the dominant trend is downtrend, regardless of volatility", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("downtrend", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      lowVolCandles,
      false,
    );
    expect(result.regimeLabel).toBe("trending-bearish");
  });

  it("labels volatile-choppy for a range trend with high volatility", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("range", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      highVolCandles,
      false,
    );
    expect(result.regimeLabel).toBe("volatile-choppy");
  });

  it("labels quiet-consolidation for a range trend with low volatility", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("range", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      lowVolCandles,
      false,
    );
    expect(result.regimeLabel).toBe("quiet-consolidation");
  });

  it("labels range-bound for a range trend with normal volatility", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("range", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      normalVolCandles,
      false,
    );
    expect(result.regimeLabel).toBe("range-bound");
  });

  it("labels volatile-choppy for a genuinely split (null dominant trend) confluence with high volatility", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe(null, "split", "Low"),
      fakeLiquidity("High", "High"),
      highVolCandles,
      false,
    );
    expect(result.regimeLabel).toBe("volatile-choppy");
    expect(result.trendRegime).toBeNull();
  });

  it("labels range-bound for a null dominant trend with normal volatility, never fabricating a trend direction", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe(null, "insufficient-data", "Low"),
      fakeLiquidity("High", "High"),
      normalVolCandles,
      false,
    );
    expect(result.regimeLabel).toBe("range-bound");
    expect(result.trendRegime).toBeNull();
  });
});

describe("analyzeMarketRegime — confidence level", () => {
  const normalVolCandles = buildDailyCandles([0.0158, -0.0158], 20);

  it("is High only when trend, liquidity, and volatility all have strong support", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("uptrend", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      normalVolCandles,
      false,
    );
    expect(result.confidenceLevel).toBe("High");
  });

  it("is Low when the trend confluence signal itself is Low, even if liquidity and volatility are fine", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("uptrend", "unanimous", "Low"),
      fakeLiquidity("High", "High"),
      normalVolCandles,
      false,
    );
    expect(result.confidenceLevel).toBe("Low");
  });

  it("is Low when the liquidity signal itself is Low", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("uptrend", "unanimous", "High"),
      fakeLiquidity("Low", "Low"),
      normalVolCandles,
      false,
    );
    expect(result.confidenceLevel).toBe("Low");
  });

  it("is Low when volatility cannot be computed, even if trend/liquidity are strong", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("uptrend", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      [normalVolCandles[0]], // single candle, no return computable
      false,
    );
    expect(result.confidenceLevel).toBe("Low");
  });

  it("is Moderate when signals are mixed but none are Low", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("uptrend", "unanimous", "Moderate"),
      fakeLiquidity("High", "High"),
      normalVolCandles,
      false,
    );
    expect(result.confidenceLevel).toBe("Moderate");
  });
});

describe("analyzeMarketRegime — general shape and honesty", () => {
  const normalVolCandles = buildDailyCandles([0.0158, -0.0158], 20);

  it("is deterministic — identical input produces identical output", () => {
    const mt = fakeMultiTimeframe("uptrend", "unanimous", "High");
    const liq = fakeLiquidity("High", "High");
    const a = analyzeMarketRegime("AAPL", mt, liq, normalVolCandles, false);
    const b = analyzeMarketRegime("AAPL", mt, liq, normalVolCandles, false);
    expect(a).toEqual(b);
  });

  it("labels dataSource SIMULATED when isLive is false and LIVE when true — never mislabeled", () => {
    const mt = fakeMultiTimeframe("uptrend", "unanimous", "High");
    const liq = fakeLiquidity("High", "High");
    expect(analyzeMarketRegime("AAPL", mt, liq, normalVolCandles, false).dataSource).toBe("SIMULATED");
    expect(analyzeMarketRegime("AAPL", mt, liq, normalVolCandles, true).dataSource).toBe("LIVE");
  });

  it("carries through the exact multiTimeframe and liquidity inputs unchanged, never mutating them", () => {
    const mt = fakeMultiTimeframe("uptrend", "unanimous", "High");
    const liq = fakeLiquidity("High", "High");
    const result = analyzeMarketRegime("AAPL", mt, liq, normalVolCandles, false);
    expect(result.multiTimeframe).toEqual(mt);
    expect(result.liquidity).toEqual(liq);
  });

  it("summary references the actual symbol, regime label, and confidence — not boilerplate", () => {
    const result = analyzeMarketRegime(
      "AAPL",
      fakeMultiTimeframe("uptrend", "unanimous", "High"),
      fakeLiquidity("High", "High"),
      normalVolCandles,
      false,
    );
    expect(result.summary).toContain("AAPL");
    expect(result.summary).toContain(result.regimeLabel);
    expect(result.summary).toContain(result.confidenceLevel);
  });
});

describe("buildMarketRegimeAnalysis — SimulatedMarketDataProvider orchestration", () => {
  const provider = new SimulatedMarketDataProvider();

  it("honestly returns null for an invalid ticker shape, never fabricating a regime", async () => {
    const result = await buildMarketRegimeAnalysis("NOT A TICKER!!", provider);
    expect(result).toBeNull();
  });

  it("resolves a real, well-shaped regime analysis for a valid symbol via the SIMULATED provider", async () => {
    const result = await buildMarketRegimeAnalysis("AAPL", provider);
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.dataSource).toBe("SIMULATED");
    expect(["trending-bullish", "trending-bearish", "range-bound", "volatile-choppy", "quiet-consolidation"]).toContain(
      result!.regimeLabel,
    );
    expect(result!.multiTimeframe.symbol).toBe("AAPL");
    expect(result!.liquidity.symbol).toBe("AAPL");
  });

  it("is deterministic across repeated calls for the same symbol", async () => {
    const a = await buildMarketRegimeAnalysis("MSFT", provider);
    const b = await buildMarketRegimeAnalysis("MSFT", provider);
    expect(a).toEqual(b);
  });

  it("respects a caller-supplied timeframe subset for the underlying Multi-Timeframe read", async () => {
    const result = await buildMarketRegimeAnalysis("NVDA", provider, ["1h", "1D"]);
    expect(result).not.toBeNull();
    expect(result!.multiTimeframe.timeframes.map((t) => t.interval)).toEqual(["1h", "1D"]);
  });
});

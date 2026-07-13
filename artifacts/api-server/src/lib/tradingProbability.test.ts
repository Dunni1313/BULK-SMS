// Phase 3, Sprint 37 — Probability Engine (Core) unit tests (approved Phase
// 3 plan §14). analyzeProbability()/computeLevelProbability() are pure and
// I/O-free — these tests construct TradingRegimeAnalysis fixtures directly
// rather than going through a MarketDataProvider (that seam is covered
// separately below via buildProbabilityAnalysis()/buildLevelProbability()
// + SimulatedMarketDataProvider).

import { describe, it, expect } from "vitest";
import {
  analyzeProbability,
  computeLevelProbability,
  buildProbabilityAnalysis,
  buildLevelProbability,
  DEFAULT_CONE_HORIZONS_DAYS,
} from "./tradingProbability.js";
import type { TradingRegimeAnalysis, TradingRegimeLabel } from "./tradingRegime.js";
import type { MultiTimeframeAnalysis } from "./tradingMultiTimeframe.js";
import type { LiquidityAnalysis, LiquidityBand } from "./tradingLiquidity.js";
import type { MarketStructureConfidenceLevel } from "./tradingMarketStructure.js";
import { SimulatedMarketDataProvider } from "./tradingMarketData.js";

function fakeMultiTimeframe(confidenceLevel: MarketStructureConfidenceLevel): MultiTimeframeAnalysis {
  return {
    symbol: "TEST",
    dataSource: "SIMULATED",
    timeframes: [],
    trendAgreement: "unanimous",
    dominantTrend: "range",
    confluenceScore: 100,
    confidenceLevel,
    confidenceExplanation: "fixture",
    summary: "fixture",
  };
}

function fakeLiquidity(currentPrice: number, liquidityBand: LiquidityBand, confidenceLevel: MarketStructureConfidenceLevel): LiquidityAnalysis {
  return {
    symbol: "TEST",
    interval: "1D",
    dataSource: "SIMULATED",
    candleCount: 90,
    currentPrice,
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

function fakeRegime(overrides: {
  currentPrice: number;
  volatilityAnnualizedPct: number | null;
  regimeLabel?: TradingRegimeLabel;
  confidenceLevel?: MarketStructureConfidenceLevel;
  dataSource?: "SIMULATED" | "LIVE";
}): TradingRegimeAnalysis {
  const confidenceLevel = overrides.confidenceLevel ?? "High";
  return {
    symbol: "TEST",
    dataSource: overrides.dataSource ?? "SIMULATED",
    regimeLabel: overrides.regimeLabel ?? "range-bound",
    trendRegime: "range",
    trendAgreement: "unanimous",
    volatilityRegime: "normal",
    volatilityAnnualizedPct: overrides.volatilityAnnualizedPct,
    volatilityExplanation: "fixture",
    liquidityRegime: "High",
    confidenceLevel,
    confidenceExplanation: "fixture",
    summary: "fixture",
    multiTimeframe: fakeMultiTimeframe(confidenceLevel),
    liquidity: fakeLiquidity(overrides.currentPrice, "High", confidenceLevel),
  };
}

describe("computeLevelProbability — honest unavailable paths", () => {
  it("returns null for a non-positive current price", () => {
    expect(computeLevelProbability(0, 100, 30, 25)).toBeNull();
    expect(computeLevelProbability(-10, 100, 30, 25)).toBeNull();
  });

  it("returns null for a non-positive target price", () => {
    expect(computeLevelProbability(100, 0, 30, 25)).toBeNull();
  });

  it("returns null for a non-positive day horizon", () => {
    expect(computeLevelProbability(100, 110, 0, 25)).toBeNull();
    expect(computeLevelProbability(100, 110, -5, 25)).toBeNull();
  });

  it("returns null when volatility is unavailable (null) or non-positive, never fabricating a probability", () => {
    expect(computeLevelProbability(100, 110, 30, null)).toBeNull();
    expect(computeLevelProbability(100, 110, 30, 0)).toBeNull();
    expect(computeLevelProbability(100, 110, 30, -5)).toBeNull();
  });
});

describe("computeLevelProbability — math correctness", () => {
  it("classifies direction correctly for a target above vs below current price", () => {
    expect(computeLevelProbability(100, 110, 30, 25)!.direction).toBe("above");
    expect(computeLevelProbability(100, 90, 30, 25)!.direction).toBe("below");
  });

  it("reads ~50% probability at horizon and ~100% touch probability when target equals current price", () => {
    const result = computeLevelProbability(100, 100, 30, 25)!;
    expect(result.probabilityAtHorizon).toBeCloseTo(0.5, 2);
    expect(result.probabilityOfTouch).toBe(1);
  });

  it("caps probabilityOfTouch at 1, never exceeding certainty", () => {
    const result = computeLevelProbability(100, 100.01, 60, 80)!;
    expect(result.probabilityOfTouch).toBeLessThanOrEqual(1);
  });

  it("derives probabilityOfTouch as approximately min(1, 2 * probabilityAtHorizon) in both directions", () => {
    // toBeCloseTo (not toBe): the source rounds probabilityOfTouch from the
    // *unrounded* intermediate value, while this assertion doubles the
    // already-rounded probabilityAtHorizon — a legitimate double-rounding
    // gap of at most ~1e-4, not a correctness bug.
    const above = computeLevelProbability(100, 120, 20, 25)!;
    expect(above.probabilityOfTouch).toBeCloseTo(Math.min(1, 2 * above.probabilityAtHorizon), 3);

    const below = computeLevelProbability(100, 80, 20, 25)!;
    expect(below.probabilityOfTouch).toBeCloseTo(Math.min(1, 2 * below.probabilityAtHorizon), 3);
  });

  it("a target farther from the current price has a lower probability of being reached than a nearer target at the same horizon", () => {
    const near = computeLevelProbability(100, 105, 30, 25)!;
    const far = computeLevelProbability(100, 130, 30, 25)!;
    expect(far.probabilityAtHorizon).toBeLessThan(near.probabilityAtHorizon);
    expect(far.probabilityOfTouch).toBeLessThan(near.probabilityOfTouch);
  });

  it("higher volatility increases the probability of reaching a fixed target level", () => {
    const lowVol = computeLevelProbability(100, 120, 30, 15)!;
    const highVol = computeLevelProbability(100, 120, 30, 60)!;
    expect(highVol.probabilityAtHorizon).toBeGreaterThan(lowVol.probabilityAtHorizon);
  });

  it("a longer horizon increases the probability of reaching a fixed target level", () => {
    const shortHorizon = computeLevelProbability(100, 120, 10, 25)!;
    const longHorizon = computeLevelProbability(100, 120, 90, 25)!;
    expect(longHorizon.probabilityAtHorizon).toBeGreaterThan(shortHorizon.probabilityAtHorizon);
  });

  it("probabilities are always within the valid [0, 1] range", () => {
    const cases = [
      computeLevelProbability(100, 1000, 5, 80),
      computeLevelProbability(100, 1, 5, 80),
      computeLevelProbability(100, 100.5, 365, 90),
    ];
    for (const c of cases) {
      expect(c).not.toBeNull();
      expect(c!.probabilityAtHorizon).toBeGreaterThanOrEqual(0);
      expect(c!.probabilityAtHorizon).toBeLessThanOrEqual(1);
      expect(c!.probabilityOfTouch).toBeGreaterThanOrEqual(0);
      expect(c!.probabilityOfTouch).toBeLessThanOrEqual(1);
    }
  });
});

describe("analyzeProbability — probability cone", () => {
  it("computes a cone entry for every requested horizon when data is available", () => {
    const regime = fakeRegime({ currentPrice: 100, volatilityAnnualizedPct: 25 });
    const result = analyzeProbability("AAPL", regime);
    expect(result.available).toBe(true);
    expect(result.cone.map((c) => c.daysAhead)).toEqual(DEFAULT_CONE_HORIZONS_DAYS);
  });

  it("widens the cone (larger high-low spread) as the horizon lengthens", () => {
    const regime = fakeRegime({ currentPrice: 100, volatilityAnnualizedPct: 25 });
    const result = analyzeProbability("AAPL", regime, [5, 60]);
    const [near, far] = result.cone;
    expect(far.high1Sigma - far.low1Sigma).toBeGreaterThan(near.high1Sigma - near.low1Sigma);
  });

  it("2-sigma band is always wider than the 1-sigma band at the same horizon", () => {
    const regime = fakeRegime({ currentPrice: 100, volatilityAnnualizedPct: 25 });
    const result = analyzeProbability("AAPL", regime, [30]);
    const level = result.cone[0];
    expect(level.low2Sigma).toBeLessThan(level.low1Sigma);
    expect(level.high2Sigma).toBeGreaterThan(level.high1Sigma);
    expect(level.low1Sigma).toBeLessThan(100);
    expect(level.high1Sigma).toBeGreaterThan(100);
  });

  it("respects a caller-supplied horizon list instead of the default", () => {
    const regime = fakeRegime({ currentPrice: 100, volatilityAnnualizedPct: 25 });
    const result = analyzeProbability("AAPL", regime, [7, 14]);
    expect(result.cone.map((c) => c.daysAhead)).toEqual([7, 14]);
  });
});

describe("analyzeProbability — honest unavailable paths", () => {
  it("is unavailable with an empty cone and Low confidence when volatility could not be computed", () => {
    const regime = fakeRegime({ currentPrice: 100, volatilityAnnualizedPct: null });
    const result = analyzeProbability("AAPL", regime);
    expect(result.available).toBe(false);
    expect(result.cone).toEqual([]);
    expect(result.confidenceLevel).toBe("Low");
    expect(result.unavailableReason).toMatch(/volatility/i);
  });

  it("is unavailable when the current price could not be resolved (non-positive)", () => {
    const regime = fakeRegime({ currentPrice: 0, volatilityAnnualizedPct: 25 });
    const result = analyzeProbability("AAPL", regime);
    expect(result.available).toBe(false);
    expect(result.cone).toEqual([]);
    expect(result.unavailableReason).toMatch(/current price/i);
  });

  it("never fabricates a confidence level higher than the underlying regime's own when available", () => {
    const regime = fakeRegime({ currentPrice: 100, volatilityAnnualizedPct: 25, confidenceLevel: "Moderate" });
    const result = analyzeProbability("AAPL", regime);
    expect(result.confidenceLevel).toBe("Moderate");
  });
});

describe("analyzeProbability — general shape and honesty", () => {
  it("is deterministic — identical input produces identical output", () => {
    const regime = fakeRegime({ currentPrice: 100, volatilityAnnualizedPct: 25 });
    const a = analyzeProbability("AAPL", regime);
    const b = analyzeProbability("AAPL", regime);
    expect(a).toEqual(b);
  });

  it("passes dataSource through unchanged from the underlying regime", () => {
    const simRegime = fakeRegime({ currentPrice: 100, volatilityAnnualizedPct: 25, dataSource: "SIMULATED" });
    const liveRegime = fakeRegime({ currentPrice: 100, volatilityAnnualizedPct: 25, dataSource: "LIVE" });
    expect(analyzeProbability("AAPL", simRegime).dataSource).toBe("SIMULATED");
    expect(analyzeProbability("AAPL", liveRegime).dataSource).toBe("LIVE");
  });

  it("carries through the exact regime input unchanged, never mutating it", () => {
    const regime = fakeRegime({ currentPrice: 100, volatilityAnnualizedPct: 25 });
    const result = analyzeProbability("AAPL", regime);
    expect(result.regime).toEqual(regime);
  });

  it("summary references the actual symbol and confidence — not boilerplate", () => {
    const regime = fakeRegime({ currentPrice: 100, volatilityAnnualizedPct: 25 });
    const result = analyzeProbability("AAPL", regime);
    expect(result.summary).toContain("AAPL");
    expect(result.summary).toContain(result.confidenceLevel);
  });
});

describe("buildProbabilityAnalysis / buildLevelProbability — SimulatedMarketDataProvider orchestration", () => {
  const provider = new SimulatedMarketDataProvider();

  it("honestly returns null for an invalid ticker shape, never fabricating a probability analysis", async () => {
    expect(await buildProbabilityAnalysis("NOT A TICKER!!", provider)).toBeNull();
    expect(await buildLevelProbability("NOT A TICKER!!", 200, 30, provider)).toBeNull();
  });

  it("resolves a real, well-shaped probability analysis for a valid symbol via the SIMULATED provider", async () => {
    const result = await buildProbabilityAnalysis("AAPL", provider);
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.dataSource).toBe("SIMULATED");
    expect(result!.currentPrice).toBeGreaterThan(0);
    expect(result!.regime.symbol).toBe("AAPL");
    if (result!.available) {
      expect(result!.cone.length).toBe(DEFAULT_CONE_HORIZONS_DAYS.length);
    }
  });

  it("resolves a real, well-shaped level-probability result for a valid symbol", async () => {
    const result = await buildLevelProbability("MSFT", 1000, 30, provider);
    expect(result).not.toBeNull();
    expect(result!.targetPrice).toBe(1000);
    expect(result!.daysAhead).toBe(30);
    expect(["above", "below"]).toContain(result!.direction);
    expect(result!.probabilityAtHorizon).toBeGreaterThanOrEqual(0);
    expect(result!.probabilityAtHorizon).toBeLessThanOrEqual(1);
  });

  it("is deterministic across repeated calls for the same symbol", async () => {
    const a = await buildProbabilityAnalysis("NVDA", provider);
    const b = await buildProbabilityAnalysis("NVDA", provider);
    expect(a).toEqual(b);

    const c = await buildLevelProbability("NVDA", 950, 45, provider);
    const d = await buildLevelProbability("NVDA", 950, 45, provider);
    expect(c).toEqual(d);
  });
});

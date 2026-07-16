// Phase 3, Sprint 38 — Risk Management Engine (Core) unit tests (approved
// Phase 3 plan §15). computeTradingRisk() is pure and I/O-free — most tests
// construct TradingPositionInput fixtures directly. The orchestration seam
// (buildTradingRiskAnalysis()) is covered separately below via a real
// SimulatedMarketDataProvider, including a call-count proof that same-symbol
// positions never trigger redundant regime resolution.

import { describe, it, expect } from "vitest";
import {
  computeTradingRisk,
  buildTradingRiskAnalysis,
  MAX_RISK_PER_POSITION_PCT,
  MAX_PORTFOLIO_RISK_PCT,
  type TradingPositionInput,
} from "./tradingRisk.js";
import { SimulatedMarketDataProvider, type Candle, type MarketDataProvider, type MarketQuote, type Timeframe } from "./tradingMarketData.js";

function position(overrides: Partial<TradingPositionInput> & { id: number; symbol: string }): TradingPositionInput {
  return {
    side: "long",
    status: "open",
    quantity: 100,
    entryPrice: 100,
    stopPrice: null,
    targetPrice: null,
    ...overrides,
  };
}

describe("computeTradingRisk — position sizing", () => {
  it("is honestly insufficient-data when no account value is provided", () => {
    const result = computeTradingRisk([position({ id: 1, symbol: "AAPL", stopPrice: 95 })], null);
    expect(result.positionSizing.score).toBeNull();
    expect(result.positionSizing.label).toBe("Insufficient data");
  });

  it("is honestly insufficient-data when no open position has a defined stop", () => {
    const result = computeTradingRisk([position({ id: 1, symbol: "AAPL" })], 100_000);
    expect(result.positionSizing.score).toBeNull();
    expect(result.positionSizing.unpricedSymbols).toEqual(["AAPL"]);
  });

  it("identifies the largest single-position risk correctly and never fabricates a negative risk", () => {
    // AAPL: |100-95| * 100 = 500 -> 0.5% of 100k. MSFT: |200-150| * 50 = 2500 -> 2.5% of 100k.
    const positions = [
      position({ id: 1, symbol: "AAPL", entryPrice: 100, stopPrice: 95, quantity: 100 }),
      position({ id: 2, symbol: "MSFT", entryPrice: 200, stopPrice: 150, quantity: 50 }),
    ];
    const result = computeTradingRisk(positions, 100_000);
    expect(result.positionSizing.largestPositionSymbol).toBe("MSFT");
    expect(result.positionSizing.largestPositionRiskPct).toBe(2.5);
  });

  it("computes the same risk magnitude regardless of whether the stop is above or below entry (side-agnostic)", () => {
    const belowEntry = computeTradingRisk([position({ id: 1, symbol: "AAPL", entryPrice: 100, stopPrice: 95, quantity: 100 })], 100_000);
    const aboveEntry = computeTradingRisk([position({ id: 1, symbol: "AAPL", entryPrice: 100, stopPrice: 105, quantity: 100 })], 100_000);
    expect(belowEntry.positionSizing.largestPositionRiskPct).toBe(aboveEntry.positionSizing.largestPositionRiskPct);
  });

  it("flags capBreached when the largest position exceeds MAX_RISK_PER_POSITION_PCT", () => {
    const result = computeTradingRisk(
      [position({ id: 1, symbol: "AAPL", entryPrice: 100, stopPrice: 90, quantity: 300 })], // 3000/100000 = 3%
      100_000,
    );
    expect(result.positionSizing.largestPositionRiskPct).toBeGreaterThan(MAX_RISK_PER_POSITION_PCT);
    expect(result.positionSizing.capBreached).toBe(true);
  });
});

describe("computeTradingRisk — stop/target discipline", () => {
  it("is honestly insufficient-data when there are no open positions", () => {
    const result = computeTradingRisk([position({ id: 1, symbol: "AAPL", status: "closed" })], 100_000);
    expect(result.stopDiscipline.score).toBeNull();
    expect(result.stopDiscipline.openPositionsCount).toBe(0);
  });

  it("scores 100 when every open position has both a stop and a target", () => {
    const positions = [
      position({ id: 1, symbol: "AAPL", stopPrice: 95, targetPrice: 110 }),
      position({ id: 2, symbol: "MSFT", stopPrice: 190, targetPrice: 220 }),
    ];
    const result = computeTradingRisk(positions, 100_000);
    expect(result.stopDiscipline.score).toBe(100);
    expect(result.stopDiscipline.positionsFullyPlanned).toBe(2);
  });

  it("correctly identifies which symbols are missing a stop vs. a target", () => {
    const positions = [
      position({ id: 1, symbol: "AAPL", stopPrice: 95 }), // missing target
      position({ id: 2, symbol: "MSFT", targetPrice: 220 }), // missing stop
      position({ id: 3, symbol: "NVDA" }), // missing both
    ];
    const result = computeTradingRisk(positions, 100_000);
    expect(result.stopDiscipline.missingStopSymbols).toEqual(["MSFT", "NVDA"]);
    expect(result.stopDiscipline.missingTargetSymbols).toEqual(["AAPL", "NVDA"]);
    expect(result.stopDiscipline.positionsFullyPlanned).toBe(0);
  });

  it("excludes closed positions from the discipline check entirely", () => {
    const positions = [
      position({ id: 1, symbol: "AAPL", stopPrice: 95, targetPrice: 110 }),
      position({ id: 2, symbol: "MSFT", status: "closed" }), // no stop/target, but closed
    ];
    const result = computeTradingRisk(positions, 100_000);
    expect(result.stopDiscipline.openPositionsCount).toBe(1);
    expect(result.stopDiscipline.score).toBe(100);
  });
});

describe("computeTradingRisk — portfolio risk budget", () => {
  it("is honestly insufficient-data with no account value, still reporting a null-riskDollars perPosition breakdown", () => {
    const result = computeTradingRisk([position({ id: 1, symbol: "AAPL", stopPrice: 95 })], null);
    expect(result.portfolioBudget.score).toBeNull();
    expect(result.portfolioBudget.perPosition[0].riskDollars).toBeNull();
  });

  it("aggregates dollar risk correctly across multiple stop-defined positions", () => {
    const positions = [
      position({ id: 1, symbol: "AAPL", entryPrice: 100, stopPrice: 95, quantity: 100 }), // 500
      position({ id: 2, symbol: "MSFT", entryPrice: 200, stopPrice: 190, quantity: 50 }), // 500
    ];
    const result = computeTradingRisk(positions, 100_000);
    expect(result.portfolioBudget.totalRiskDollars).toBe(1000);
    expect(result.portfolioBudget.totalRiskUsedPct).toBe(1); // 1000/100000 = 1%
  });

  it("never fabricates a riskDollars value for a position with no stop, leaving it honestly null in the breakdown", () => {
    const positions = [
      position({ id: 1, symbol: "AAPL", entryPrice: 100, stopPrice: 95, quantity: 100 }),
      position({ id: 2, symbol: "MSFT" }), // no stop
    ];
    const result = computeTradingRisk(positions, 100_000);
    const msft = result.portfolioBudget.perPosition.find((p) => p.symbol === "MSFT")!;
    expect(msft.riskDollars).toBeNull();
    expect(msft.riskPct).toBeNull();
    expect(msft.withinLimit).toBeNull();
    // The unstopped position must not silently contribute 0 vs. being excluded differently than intended.
    expect(result.portfolioBudget.totalRiskDollars).toBe(500);
  });

  it("flags capBreached when aggregate risk exceeds MAX_PORTFOLIO_RISK_PCT", () => {
    const result = computeTradingRisk(
      [position({ id: 1, symbol: "AAPL", entryPrice: 100, stopPrice: 90, quantity: 700 })], // 7000/100000 = 7%
      100_000,
    );
    expect(result.portfolioBudget.totalRiskUsedPct).toBeGreaterThan(MAX_PORTFOLIO_RISK_PCT);
    expect(result.portfolioBudget.capBreached).toBe(true);
  });
});

describe("computeTradingRisk — overall composite", () => {
  it("is honestly insufficient-data (null) when zero components could be scored", () => {
    const result = computeTradingRisk([], null);
    expect(result.overall.score).toBeNull();
    expect(result.overall.label).toBe("Insufficient data");
  });

  it("hard-caps the overall score at 60 when the position-sizing cap is breached, regardless of the blend", () => {
    const positions = [
      position({ id: 1, symbol: "AAPL", entryPrice: 100, stopPrice: 90, quantity: 300, targetPrice: 130 }), // 3% single-position risk, breaches cap
    ];
    const result = computeTradingRisk(positions, 100_000);
    expect(result.positionSizing.capBreached).toBe(true);
    expect(result.overall.score).not.toBeNull();
    expect(result.overall.score!).toBeLessThanOrEqual(60);
  });

  it("hard-caps the overall score at 60 when the portfolio-budget cap is breached", () => {
    // Four positions, each individually risking 1.9% (under the 2% single-
    // position cap), summing to 7.6% (above the 6% portfolio-wide cap).
    const fourPositions = [
      position({ id: 1, symbol: "AAPL", entryPrice: 100, stopPrice: 99, quantity: 1900, targetPrice: 110 }),
      position({ id: 2, symbol: "MSFT", entryPrice: 200, stopPrice: 199, quantity: 1900, targetPrice: 220 }),
      position({ id: 3, symbol: "NVDA", entryPrice: 300, stopPrice: 299, quantity: 1900, targetPrice: 330 }),
      position({ id: 4, symbol: "GOOGL", entryPrice: 150, stopPrice: 149, quantity: 1900, targetPrice: 165 }),
    ];
    const result = computeTradingRisk(fourPositions, 100_000);
    expect(result.positionSizing.capBreached).toBe(false);
    expect(result.portfolioBudget.totalRiskUsedPct).toBeGreaterThan(MAX_PORTFOLIO_RISK_PCT);
    expect(result.portfolioBudget.capBreached).toBe(true);
    expect(result.overall.score!).toBeLessThanOrEqual(60);
  });

  it("is deterministic — identical input produces identical output", () => {
    const positions = [position({ id: 1, symbol: "AAPL", stopPrice: 95, targetPrice: 110 })];
    const a = computeTradingRisk(positions, 100_000);
    const b = computeTradingRisk(positions, 100_000);
    expect(a).toEqual(b);
  });
});

describe("buildTradingRiskAnalysis — SimulatedMarketDataProvider orchestration", () => {
  class CountingProvider implements MarketDataProvider {
    readonly id = "counting";
    readonly isLive = false;
    calls = 0;
    constructor(private inner: MarketDataProvider) {}
    async getCandles(symbol: string, interval: Timeframe, lookback: number, asOf?: string): Promise<Candle[] | null> {
      this.calls++;
      return this.inner.getCandles(symbol, interval, lookback, asOf);
    }
    async getQuote(symbol: string, asOf?: string): Promise<MarketQuote | null> {
      return this.inner.getQuote(symbol, asOf);
    }
  }

  it("attaches an honest probability context for every open, stop-or-target-defined position", async () => {
    const provider = new SimulatedMarketDataProvider();
    const positions = [position({ id: 1, symbol: "AAPL", stopPrice: 150, targetPrice: 250 })];
    const result = await buildTradingRiskAnalysis(positions, 100_000, provider);
    expect(result.positionContexts.length).toBe(1);
    const ctx = result.positionContexts[0];
    expect(ctx.symbol).toBe("AAPL");
    expect(ctx.regimeLabel).not.toBeNull();
    expect(ctx.stopTouchProbability).toBeGreaterThanOrEqual(0);
    expect(ctx.stopTouchProbability!).toBeLessThanOrEqual(1);
    expect(ctx.targetTouchProbability).toBeGreaterThanOrEqual(0);
  });

  it("excludes closed positions and positions with neither a stop nor a target from position contexts", async () => {
    const provider = new SimulatedMarketDataProvider();
    const positions = [
      position({ id: 1, symbol: "AAPL", stopPrice: 150 }),
      position({ id: 2, symbol: "MSFT", status: "closed", stopPrice: 300 }),
      position({ id: 3, symbol: "NVDA" }), // no stop, no target
    ];
    const result = await buildTradingRiskAnalysis(positions, 100_000, provider);
    expect(result.positionContexts.map((c) => c.symbol)).toEqual(["AAPL"]);
  });

  it("honestly reports null probability context fields for an unresolvable symbol, never fabricating a probability", async () => {
    const provider = new SimulatedMarketDataProvider();
    const positions = [position({ id: 1, symbol: "NOT A TICKER!!", stopPrice: 50 })];
    const result = await buildTradingRiskAnalysis(positions, 100_000, provider);
    expect(result.positionContexts[0].regimeLabel).toBeNull();
    expect(result.positionContexts[0].stopTouchProbability).toBeNull();
  });

  it("never resolves the same symbol's regime twice — two positions in the same symbol cost no more provider calls than one", async () => {
    const base = new SimulatedMarketDataProvider();
    const counterOne = new CountingProvider(base);
    await buildTradingRiskAnalysis([position({ id: 1, symbol: "AAPL", stopPrice: 150 })], 100_000, counterOne);

    const counterTwo = new CountingProvider(base);
    await buildTradingRiskAnalysis(
      [position({ id: 1, symbol: "AAPL", stopPrice: 150 }), position({ id: 2, symbol: "AAPL", stopPrice: 160, targetPrice: 250 })],
      100_000,
      counterTwo,
    );

    expect(counterTwo.calls).toBe(counterOne.calls);
  });

  it("still returns the deterministic risk scoring even when accountValue is null", async () => {
    const provider = new SimulatedMarketDataProvider();
    const result = await buildTradingRiskAnalysis([position({ id: 1, symbol: "AAPL", stopPrice: 150 })], null, provider);
    expect(result.positionSizing.score).toBeNull();
    expect(result.positionContexts.length).toBe(1);
  });

  it("is deterministic across repeated calls", async () => {
    const provider = new SimulatedMarketDataProvider();
    const positions = [position({ id: 1, symbol: "AAPL", stopPrice: 150, targetPrice: 250 })];
    const a = await buildTradingRiskAnalysis(positions, 100_000, provider);
    const b = await buildTradingRiskAnalysis(positions, 100_000, provider);
    expect(a).toEqual(b);
  });
});

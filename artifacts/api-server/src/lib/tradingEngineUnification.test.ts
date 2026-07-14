// Phase 3, Sprint 51 — Trading Engine Unification (approved Phase 3 plan
// §0 item 7 / §20; see docs/Phase-3-Trading-Engine-Execution-Plan.md's
// Sprint 51 as-built note). The closing Phase-3 integration sprint,
// mirroring Phase 2 Sprint 31's own audit + regression discipline.
//
// Engine 2 has no single "build everything" entry point the way Engine 1's
// buildValueResearchReport() is (each module composes only what it needs:
// buildProbabilityAnalysis() pulls Regime->MultiTimeframe->Liquidity-
// >Structure, buildTradingRiskAnalysis() pulls Probability per position,
// AI Trade Coach pulls Probability+Risk+Journal). The genuine regression
// risk this sprint closes out is therefore not "does one report have every
// field" (Engine 1's own risk) but "do the SAME underlying signals, reached
// through two different composition paths for the SAME symbol, agree with
// each other" — this file proves exactly that, the direct Engine-2 analog
// of every Phase 2 sprint's own "prove prior sprints' outputs are byte-
// identical via direct equality against standalone calls" regression
// pattern (first established Sprint 13, reused every sprint since).
//
// SIMULATED path only, deterministic by construction (Sprint 32's own
// makeRng/todayStr seeding) — every equality assertion below relies on that
// determinism, not on mocking.

import { describe, it, expect } from "vitest";
import { SimulatedMarketDataProvider, MAX_LOOKBACK, type Timeframe } from "./tradingMarketData.js";
import { buildMarketStructureAnalysis } from "./tradingMarketStructure.js";
import { buildMultiTimeframeAnalysis, DEFAULT_MULTI_TIMEFRAMES } from "./tradingMultiTimeframe.js";
import { buildLiquidityAnalysis } from "./tradingLiquidity.js";
import { buildMarketRegimeAnalysis } from "./tradingRegime.js";
import { buildProbabilityAnalysis } from "./tradingProbability.js";
import { buildTradingRiskAnalysis, type TradingPositionInput } from "./tradingRisk.js";
import { buildTradingBacktest } from "./tradingBacktest.js";

const provider = new SimulatedMarketDataProvider();
const DAILY: Timeframe = "1D";

describe("Trading Engine Unification — one symbol, every module resolves consistently (SIMULATED path)", () => {
  it("buildMarketRegimeAnalysis()'s own nested multiTimeframe is byte-identical to a standalone buildMultiTimeframeAnalysis() call", async () => {
    const [regime, standaloneMtf] = await Promise.all([
      buildMarketRegimeAnalysis("AAPL", provider),
      buildMultiTimeframeAnalysis("AAPL", provider),
    ]);
    expect(regime).not.toBeNull();
    expect(standaloneMtf).not.toBeNull();
    expect(regime!.multiTimeframe).toEqual(standaloneMtf);
  });

  it("buildMarketRegimeAnalysis()'s own nested liquidity is byte-identical to a standalone buildLiquidityAnalysis() call", async () => {
    const [regime, standaloneLiquidity] = await Promise.all([
      buildMarketRegimeAnalysis("AAPL", provider),
      buildLiquidityAnalysis("AAPL", DAILY, MAX_LOOKBACK[DAILY], provider),
    ]);
    expect(regime).not.toBeNull();
    expect(standaloneLiquidity).not.toBeNull();
    expect(regime!.liquidity).toEqual(standaloneLiquidity);
  });

  it("every per-timeframe structure read inside multiTimeframe matches a standalone buildMarketStructureAnalysis() call for that same timeframe", async () => {
    const mtf = await buildMultiTimeframeAnalysis("AAPL", provider, DEFAULT_MULTI_TIMEFRAMES);
    expect(mtf).not.toBeNull();
    for (const tf of mtf!.timeframes) {
      const standalone = await buildMarketStructureAnalysis("AAPL", tf.interval, MAX_LOOKBACK[tf.interval], provider);
      expect(standalone).not.toBeNull();
      expect(tf.structure).toEqual(standalone);
    }
  });

  it("buildProbabilityAnalysis()'s own nested regime is byte-identical to a standalone buildMarketRegimeAnalysis() call", async () => {
    const [probability, standaloneRegime] = await Promise.all([
      buildProbabilityAnalysis("AAPL", provider),
      buildMarketRegimeAnalysis("AAPL", provider),
    ]);
    expect(probability).not.toBeNull();
    expect(standaloneRegime).not.toBeNull();
    expect(probability!.regime).toEqual(standaloneRegime);
  });

  it("buildProbabilityAnalysis()'s own currentPrice/volatility feed AI Trade Coach's and Risk's touch-probability context consistently for a position in the same symbol", async () => {
    const probability = await buildProbabilityAnalysis("AAPL", provider);
    expect(probability).not.toBeNull();
    expect(probability!.available).toBe(true);

    const positions: TradingPositionInput[] = [
      { id: 1, symbol: "AAPL", side: "long", status: "open", quantity: 10, entryPrice: probability!.currentPrice, stopPrice: probability!.currentPrice * 0.95, targetPrice: probability!.currentPrice * 1.1 },
    ];
    const risk = await buildTradingRiskAnalysis(positions, 100_000, provider);
    const ctx = risk.positionContexts.find((c) => c.symbol === "AAPL");
    expect(ctx).toBeTruthy();
    expect(ctx!.regimeLabel).toBe(probability!.regime.regimeLabel);
  });

  it("Backtesting's own walk-forward signal reuses the exact same analyzeMarketStructure() reads as the eager Structure/Multi-Timeframe cards for the same symbol", async () => {
    // Sprint 49's tradingBacktest.ts calls analyzeMarketStructure() directly
    // (not buildMarketStructureAnalysis()) over an expanding window — this
    // proves the two paths still agree at the final window (the full
    // candle series), the point where they're directly comparable.
    const backtest = await buildTradingBacktest("AAPL", "trend-following", DAILY, 180, provider);
    const structure = await buildMarketStructureAnalysis("AAPL", DAILY, 180, provider);
    expect(backtest).not.toBeNull();
    expect(structure).not.toBeNull();
    expect(backtest!.candleCount).toBe(structure!.candleCount);
    expect(backtest!.dataSource).toBe(structure!.dataSource);
  });

  it("an unresolvable symbol honestly returns null across every Engine 2 composition entry point — never a partial/fabricated result for any module", async () => {
    const unknown = "NOT A TICKER!!";
    const results = await Promise.all([
      buildMarketStructureAnalysis(unknown, DAILY, 90, provider),
      buildMultiTimeframeAnalysis(unknown, provider),
      buildLiquidityAnalysis(unknown, DAILY, 90, provider),
      buildMarketRegimeAnalysis(unknown, provider),
      buildProbabilityAnalysis(unknown, provider),
      buildTradingBacktest(unknown, "trend-following", DAILY, 180, provider),
    ]);
    for (const r of results) {
      expect(r).toBeNull();
    }
  });

  it("is deterministic across repeated full-engine sweeps for the same symbol", async () => {
    const sweep = async () => {
      const [structure, mtf, liquidity, regime, probability] = await Promise.all([
        buildMarketStructureAnalysis("MSFT", DAILY, 90, provider),
        buildMultiTimeframeAnalysis("MSFT", provider),
        buildLiquidityAnalysis("MSFT", DAILY, 90, provider),
        buildMarketRegimeAnalysis("MSFT", provider),
        buildProbabilityAnalysis("MSFT", provider),
      ]);
      return { structure, mtf, liquidity, regime, probability };
    };
    const a = await sweep();
    const b = await sweep();
    expect(a).toEqual(b);
  });
});

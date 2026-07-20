// Phase 24 — Institutional Trading Engine Foundation.
//
// Analysis service boundary. Groups the 5 already-shipped, already-tested
// candle-analysis engines (Sprints 33-37) behind one import point, so a
// future Strategy Framework or Trade Plan builder composes "Analysis" as
// one concern instead of reaching into 5 separate lib files individually.
//
// Zero new logic: every export below is re-exported unmodified from its
// own already-shipped module. This file adds no computation of its own.

// Market Structure — swing points, support/resistance zones, trend.
export {
  analyzeMarketStructure,
  buildMarketStructureAnalysis,
} from "../tradingMarketStructure.js";
export type {
  TrendStructure,
  MarketStructureConfidenceLevel,
  SwingPoint,
  SupportResistanceZone,
  MarketStructureAnalysis,
} from "../tradingMarketStructure.js";

// Multi-Timeframe Trend — confluence across several timeframes.
export {
  analyzeMultiTimeframe,
  buildMultiTimeframeAnalysis,
  DEFAULT_MULTI_TIMEFRAMES,
} from "../tradingMultiTimeframe.js";
export type {
  TimeframeStructure,
  MultiTimeframeAnalysis,
} from "../tradingMultiTimeframe.js";

// Liquidity — volume profile, liquidity score, buy/sell pressure.
export {
  analyzeLiquidity,
  buildLiquidityAnalysis,
} from "../tradingLiquidity.js";
export type {
  LiquidityBand,
  LiquidityConfidenceLevel,
  PressureDirection,
  VolumeProfileLevel,
  BuySellPressure,
  LiquidityAnalysis,
} from "../tradingLiquidity.js";

// Market Regime — trend/liquidity/volatility composite read.
export {
  analyzeMarketRegime,
  buildMarketRegimeAnalysis,
} from "../tradingRegime.js";
export type { TradingRegimeAnalysis } from "../tradingRegime.js";

// Probability — lognormal-diffusion probability cone.
export {
  computeLevelProbability,
  analyzeProbability,
  buildProbabilityAnalysis,
  buildLevelProbability,
} from "../tradingProbability.js";
export type { ProbabilityAnalysis } from "../tradingProbability.js";

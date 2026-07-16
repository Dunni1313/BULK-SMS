// Phase 3, Sprint 36 — Institutional Trading Engine, Market Regime Detection
// Engine (Core) (approved Phase 3 plan §25 Decision 3, §0 Correction 1; see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 36 as-built note).
//
// Deliberately a COMPOSITION layer, not a new candle-analysis algorithm —
// the same "reuse the pattern, not the code, but reuse the code where it
// genuinely fits" discipline as Sprint 34's Multi-Timeframe Engine and Phase
// 2's Tom Nash Engine. Regime = trend axis (reused directly from Sprint 34's
// Multi-Timeframe confluence read) + liquidity axis (reused directly from
// Sprint 35's Liquidity Engine) + volatility axis (the one genuinely new
// piece of logic this sprint: realized volatility computed from daily
// candles resolved via Sprint 32's own MarketDataProvider — no new candle
// generator, no parallel data source).
//
// CRITICAL, per §0 Correction 1 and §25 Decision 3 (already-approved Phase 3
// owner decisions, not re-litigated here): this module is INDEPENDENT of
// marketBriefing.ts's own MarketRegime ("risk_on"/"neutral"/"risk_off") —
// that read is a byproduct of optionsMath.ts's simulated option-chain IV,
// not real price action, and Engine 2 never reads it. This module's
// TradingRegimeAnalysis is a genuinely different, price-action-derived
// read, deliberately not merged with marketBriefing.ts's (see the one-line
// cross-reference comment added to marketBriefing.ts this sprint, per the
// Phase 3 plan's own Technical Debt Review recommendation, §26).
//
// SAFETY CONTRACT, unbroken from every prior SIMULATED engine in this
// codebase: every axis is either computed from real (SIMULATED or LIVE)
// data already resolved by an existing module, or honestly defaults to a
// neutral/low-confidence read when there isn't enough data — never a
// fabricated regime label. No LLM call, no live order-flow/Level 2/broker
// data anywhere in this module.
//
// Core only this sprint — no route, no UI, no database changes. Reuses
// Sprint 32's MarketDataProvider, Sprint 33's Market Structure (via Sprint
// 34's Multi-Timeframe orchestrator), Sprint 34's Multi-Timeframe Engine,
// and Sprint 35's Liquidity Engine — all unmodified.

import type { Candle, MarketDataProvider, Timeframe } from "./tradingMarketData.js";
import { MAX_LOOKBACK } from "./tradingMarketData.js";
import type { AgreementSignal } from "./marginOfSafety.js";
import type { MarketStructureConfidenceLevel, TrendStructure } from "./tradingMarketStructure.js";
import {
  buildMultiTimeframeAnalysis,
  DEFAULT_MULTI_TIMEFRAMES,
  type MultiTimeframeAnalysis,
} from "./tradingMultiTimeframe.js";
import { buildLiquidityAnalysis, type LiquidityAnalysis, type LiquidityBand } from "./tradingLiquidity.js";

export type VolatilityRegime = "high" | "normal" | "low";

// Deliberately a distinct name/shape from marketBriefing.ts's own
// MarketRegime ("risk_on"/"neutral"/"risk_off") — see the module doc
// comment above for why these are never merged.
export type TradingRegimeLabel =
  | "trending-bullish"
  | "trending-bearish"
  | "range-bound"
  | "volatile-choppy"
  | "quiet-consolidation";

export interface TradingRegimeAnalysis {
  symbol: string;
  dataSource: "SIMULATED" | "LIVE";
  regimeLabel: TradingRegimeLabel;
  trendRegime: TrendStructure | null;
  trendAgreement: AgreementSignal;
  volatilityRegime: VolatilityRegime;
  volatilityAnnualizedPct: number | null;
  volatilityExplanation: string;
  liquidityRegime: LiquidityBand;
  confidenceLevel: MarketStructureConfidenceLevel;
  confidenceExplanation: string;
  summary: string;
  multiTimeframe: MultiTimeframeAnalysis;
  liquidity: LiquidityAnalysis;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// Realized volatility (annualized %) from daily log returns' sample stdev.
// A well-understood, deterministic statistical technique — not ML, not a
// black box. Honestly returns null (never a fabricated number) when there
// aren't at least MIN_RETURNS_FOR_VOLATILITY usable returns.
const MIN_RETURNS_FOR_VOLATILITY = 2;
const TRADING_DAYS_PER_YEAR = 252;

function computeRealizedVolatilityPct(dailyCandles: Candle[]): number | null {
  const returns: number[] = [];
  for (let i = 1; i < dailyCandles.length; i++) {
    const prev = dailyCandles[i - 1].close;
    const curr = dailyCandles[i].close;
    if (prev > 0 && curr > 0) returns.push(Math.log(curr / prev));
  }
  if (returns.length < MIN_RETURNS_FOR_VOLATILITY) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const dailyStdev = Math.sqrt(variance);
  return round2(dailyStdev * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100);
}

// Plausible equity annualized-volatility bands (SPY/large-cap historical
// norms run roughly 15-25%; higher-beta/growth names run well above 40%).
// A too-thin sample honestly defaults to "normal" (a neutral, non-alarming
// read) with an explicit reason — never guessing "high" or "low" from
// insufficient data.
const VOLATILITY_LOW_THRESHOLD_PCT = 15;
const VOLATILITY_HIGH_THRESHOLD_PCT = 40;

function bandVolatility(
  annualizedPct: number | null,
  candleCount: number,
): { regime: VolatilityRegime; explanation: string } {
  if (annualizedPct === null) {
    return {
      regime: "normal",
      explanation: `Only ${candleCount} daily candle(s) available — not enough to compute realized volatility; defaulting to a neutral "normal" read.`,
    };
  }
  if (annualizedPct >= VOLATILITY_HIGH_THRESHOLD_PCT) {
    return { regime: "high", explanation: `${annualizedPct}% annualized realized volatility — elevated.` };
  }
  if (annualizedPct <= VOLATILITY_LOW_THRESHOLD_PCT) {
    return { regime: "low", explanation: `${annualizedPct}% annualized realized volatility — subdued.` };
  }
  return { regime: "normal", explanation: `${annualizedPct}% annualized realized volatility — typical range.` };
}

// The one deterministic rule table this module adds: trend takes priority
// when Multi-Timeframe found a real dominant trend (uptrend/downtrend);
// volatility only becomes the primary read when there's no clear
// direction (a "range" structure or a genuinely split confluence) — never
// an invented combination outside these 5 honestly-named labels.
function deriveRegimeLabel(
  dominantTrend: TrendStructure | null,
  volatilityRegime: VolatilityRegime,
): TradingRegimeLabel {
  if (dominantTrend === "uptrend") return "trending-bullish";
  if (dominantTrend === "downtrend") return "trending-bearish";
  // dominantTrend is "range" or null (split/insufficient-data) here.
  if (volatilityRegime === "high") return "volatile-choppy";
  if (volatilityRegime === "low") return "quiet-consolidation";
  return "range-bound";
}

// Confidence mirrors the established 3-tier convention, derived honestly
// from the confidence of every reused signal plus whether volatility was
// actually computable — never a fabricated "High" when an underlying
// signal is thin.
function deriveConfidence(
  trendConfidence: MarketStructureConfidenceLevel,
  liquidityConfidence: MarketStructureConfidenceLevel,
  volatilityComputable: boolean,
): { level: MarketStructureConfidenceLevel; explanation: string } {
  if (!volatilityComputable || trendConfidence === "Low" || liquidityConfidence === "Low") {
    return {
      level: "Low",
      explanation: "At least one underlying signal (trend confluence, liquidity, or realized volatility) has limited data.",
    };
  }
  if (trendConfidence === "High" && liquidityConfidence === "High") {
    return {
      level: "High",
      explanation: "Trend confluence, liquidity, and realized volatility all have strong data support.",
    };
  }
  return {
    level: "Moderate",
    explanation: "Reasonable data coverage across trend confluence, liquidity, and realized volatility.",
  };
}

function buildSummary(
  symbol: string,
  regimeLabel: TradingRegimeLabel,
  volatilityRegime: VolatilityRegime,
  volatilityAnnualizedPct: number | null,
  liquidityRegime: LiquidityBand,
  confidenceLevel: MarketStructureConfidenceLevel,
): string {
  const volPart =
    volatilityAnnualizedPct !== null
      ? `${volatilityAnnualizedPct}% annualized volatility (${volatilityRegime})`
      : `volatility data unavailable (defaulting to ${volatilityRegime})`;
  return `${symbol} is in a ${regimeLabel} regime — ${volPart}, ${liquidityRegime} liquidity. Confidence: ${confidenceLevel}.`;
}

// Pure — never touches a provider. `multiTimeframe`/`liquidity` must already
// be resolved (Sprint 34/35's own build*() orchestrators); `dailyCandles`
// must already be oldest -> newest (SimulatedMarketDataProvider's own
// shape). The same "pure function over already-resolved data" discipline as
// every prior Engine 2 Core module.
export function analyzeMarketRegime(
  symbol: string,
  multiTimeframe: MultiTimeframeAnalysis,
  liquidity: LiquidityAnalysis,
  dailyCandles: Candle[],
  isLive: boolean,
): TradingRegimeAnalysis {
  const volatilityAnnualizedPct = computeRealizedVolatilityPct(dailyCandles);
  const { regime: volatilityRegime, explanation: volatilityExplanation } = bandVolatility(
    volatilityAnnualizedPct,
    dailyCandles.length,
  );
  const regimeLabel = deriveRegimeLabel(multiTimeframe.dominantTrend, volatilityRegime);
  const { level: confidenceLevel, explanation: confidenceExplanation } = deriveConfidence(
    multiTimeframe.confidenceLevel,
    liquidity.confidenceLevel,
    volatilityAnnualizedPct !== null,
  );
  const summary = buildSummary(
    symbol,
    regimeLabel,
    volatilityRegime,
    volatilityAnnualizedPct,
    liquidity.liquidityBand,
    confidenceLevel,
  );

  return {
    symbol,
    dataSource: isLive ? "LIVE" : "SIMULATED",
    regimeLabel,
    trendRegime: multiTimeframe.dominantTrend,
    trendAgreement: multiTimeframe.trendAgreement,
    volatilityRegime,
    volatilityAnnualizedPct,
    volatilityExplanation,
    liquidityRegime: liquidity.liquidityBand,
    confidenceLevel,
    confidenceExplanation,
    summary,
    multiTimeframe,
    liquidity,
  };
}

// Orchestration helper: resolves every reused input via existing
// abstractions only — Sprint 34's buildMultiTimeframeAnalysis(), Sprint 35's
// buildLiquidityAnalysis(), and a direct daily-candle fetch through Sprint
// 32's own MarketDataProvider (no new candle generator). Honestly returns
// null when the provider can't resolve the symbol (invalid ticker shape) —
// never fabricates a regime for an unresolvable symbol.
export async function buildMarketRegimeAnalysis(
  symbol: string,
  provider: MarketDataProvider,
  timeframes: Timeframe[] = DEFAULT_MULTI_TIMEFRAMES,
): Promise<TradingRegimeAnalysis | null> {
  const sym = symbol.toUpperCase();
  const dailyInterval: Timeframe = "1D";

  const multiTimeframe = await buildMultiTimeframeAnalysis(sym, provider, timeframes);
  if (!multiTimeframe) return null;

  const liquidity = await buildLiquidityAnalysis(sym, dailyInterval, MAX_LOOKBACK[dailyInterval], provider);
  if (!liquidity) return null;

  const dailyCandles = await provider.getCandles(sym, dailyInterval, MAX_LOOKBACK[dailyInterval]);
  if (!dailyCandles) return null;

  return analyzeMarketRegime(sym, multiTimeframe, liquidity, dailyCandles, provider.isLive);
}

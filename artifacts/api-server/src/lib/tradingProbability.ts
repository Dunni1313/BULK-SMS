// Phase 3, Sprint 37 — Institutional Trading Engine, Probability Engine
// (Core) (approved Phase 3 plan §14; see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 37 as-built note).
//
// Objective (§14): an instrument-agnostic probability-of-a-move estimate,
// generalizing optionsMath.ts's POP (probability of profit) math beyond
// options. optionsMath.ts's POP is a Black-Scholes-family calculation that
// genuinely needs IV/strike/DTE — options-specific inputs this module never
// has. Per §14's own recommendation, this is a **historical-volatility-
// based probability cone**: the same "real formula, not a fabricated
// number" rigor as the options POP math, computed from a genuinely
// different input (realized volatility from the candle series), reusing
// only the *shape* of that discipline, not the code.
//
// Deliberately a COMPOSITION layer, not a new candle/volatility
// computation — per the explicit Sprint 37 kickoff instruction to "compose
// existing engines rather than introduce duplicate logic," this module
// makes exactly one call, to Sprint 36's buildMarketRegimeAnalysis(), and
// reads its already-computed `volatilityAnnualizedPct` and (via its nested
// `liquidity.currentPrice`) current price — no second candle fetch, no
// second volatility formula. That one call transitively reuses Sprint 34's
// Multi-Timeframe Engine, Sprint 35's Liquidity Engine, Sprint 33's Market
// Structure Engine, and Sprint 32's MarketDataProvider, exactly as the
// Sprint 37 kickoff instruction listed.
//
// The one genuinely new piece of logic this sprint: the lognormal-diffusion
// probability math itself (a driftless geometric Brownian motion
// assumption — this module never forecasts direction, only dispersion,
// consistent with "never fabricate a directional forecast"). Both a
// probability cone (±1σ/±2σ implied price ranges at several day horizons)
// and a targeted probability-of-reaching-a-specific-price calculation
// (probability at the horizon date, and probability of touching that price
// at any point before it, via the standard reflection-principle formula for
// driftless Brownian motion) are provided.
//
// SAFETY CONTRACT, unbroken from every prior SIMULATED engine in this
// codebase: every probability is either computed from a real, resolved
// current price and realized volatility, or honestly reports
// `available: false` / returns `null` — never a fabricated probability
// number. No LLM call, no live order-flow/Level 2/broker/execution data
// anywhere in this module.
//
// Core only this sprint — no route, no UI, no database changes.

import type { MarketDataProvider, Timeframe } from "./tradingMarketData.js";
import type { MarketStructureConfidenceLevel } from "./tradingMarketStructure.js";
import { DEFAULT_MULTI_TIMEFRAMES } from "./tradingMultiTimeframe.js";
import { buildMarketRegimeAnalysis, type TradingRegimeAnalysis, type TradingRegimeLabel } from "./tradingRegime.js";

const TRADING_DAYS_PER_YEAR = 252;

export interface ProbabilityConeLevel {
  daysAhead: number;
  low1Sigma: number;
  high1Sigma: number;
  low2Sigma: number;
  high2Sigma: number;
}

export interface LevelProbability {
  currentPrice: number;
  targetPrice: number;
  daysAhead: number;
  direction: "above" | "below";
  probabilityAtHorizon: number; // P(price is above/below target exactly at the horizon date), 0-1
  probabilityOfTouch: number; // P(price reaches target at any point before the horizon date), 0-1
}

export interface ProbabilityAnalysis {
  symbol: string;
  dataSource: "SIMULATED" | "LIVE";
  currentPrice: number;
  volatilityAnnualizedPct: number | null;
  available: boolean;
  unavailableReason: string | null;
  cone: ProbabilityConeLevel[];
  confidenceLevel: MarketStructureConfidenceLevel;
  confidenceExplanation: string;
  summary: string;
  regime: TradingRegimeAnalysis;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

// Standard normal CDF via the Abramowitz & Stegun 7.1.26 erf approximation
// (max absolute error ~1.5e-7) — a well-understood, deterministic numerical
// technique, never ML/LLM-generated.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function standardNormalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// sigma_T: the volatility of ln(S_T/S) over `daysAhead` trading days, under
// a driftless GBM assumption (no directional forecast — dispersion only).
function sigmaForHorizon(volatilityAnnualizedPct: number, daysAhead: number): number {
  const sigmaAnnual = volatilityAnnualizedPct / 100;
  return sigmaAnnual * Math.sqrt(daysAhead / TRADING_DAYS_PER_YEAR);
}

// ±1σ/±2σ implied price range at a given day horizon under the driftless
// lognormal assumption: S_T = S * exp(sigma_T * Z).
function computeConeLevel(currentPrice: number, volatilityAnnualizedPct: number, daysAhead: number): ProbabilityConeLevel {
  const sigmaT = sigmaForHorizon(volatilityAnnualizedPct, daysAhead);
  return {
    daysAhead,
    low1Sigma: round2(currentPrice * Math.exp(-1 * sigmaT)),
    high1Sigma: round2(currentPrice * Math.exp(1 * sigmaT)),
    low2Sigma: round2(currentPrice * Math.exp(-2 * sigmaT)),
    high2Sigma: round2(currentPrice * Math.exp(2 * sigmaT)),
  };
}

export const DEFAULT_CONE_HORIZONS_DAYS: number[] = [5, 10, 20, 30, 60];

// Pure — targeted probability of a specific price level by a specific day
// horizon. Honestly returns null (never a fabricated probability) when any
// input is non-positive or volatility isn't available.
export function computeLevelProbability(
  currentPrice: number,
  targetPrice: number,
  daysAhead: number,
  volatilityAnnualizedPct: number | null,
): LevelProbability | null {
  if (
    currentPrice <= 0 ||
    targetPrice <= 0 ||
    daysAhead <= 0 ||
    volatilityAnnualizedPct === null ||
    volatilityAnnualizedPct <= 0
  ) {
    return null;
  }

  const sigmaT = sigmaForHorizon(volatilityAnnualizedPct, daysAhead);
  if (sigmaT <= 0) return null;

  const direction: "above" | "below" = targetPrice >= currentPrice ? "above" : "below";
  const z = Math.log(targetPrice / currentPrice) / sigmaT;
  // P(S_T <= target) = Phi(z); P(S_T > target) = 1 - Phi(z).
  const probAtHorizon = direction === "above" ? 1 - standardNormalCdf(z) : standardNormalCdf(z);
  // Reflection principle for driftless Brownian motion: P(touch barrier by
  // T) = 2 * P(at-or-beyond barrier at T) — the exact same numeric quantity
  // as probAtHorizon in both directions, capped at 1 (certainty).
  const probabilityOfTouch = Math.min(1, 2 * probAtHorizon);

  return {
    currentPrice,
    targetPrice,
    daysAhead,
    direction,
    probabilityAtHorizon: round4(probAtHorizon),
    probabilityOfTouch: round4(probabilityOfTouch),
  };
}

function buildSummary(
  symbol: string,
  available: boolean,
  unavailableReason: string | null,
  regimeLabel: TradingRegimeLabel,
  volatilityAnnualizedPct: number | null,
  confidenceLevel: MarketStructureConfidenceLevel,
): string {
  if (!available) {
    return `${symbol}: probability cone unavailable — ${unavailableReason} Confidence: ${confidenceLevel}.`;
  }
  return `${symbol} probability cone derived from ${volatilityAnnualizedPct}% annualized realized volatility (${regimeLabel} regime). Confidence: ${confidenceLevel}.`;
}

// Pure — never touches a provider. `regime` must already be resolved
// (Sprint 36's own buildMarketRegimeAnalysis()) — the same "pure function
// over already-resolved data" discipline as every prior Engine 2 Core
// module.
export function analyzeProbability(
  symbol: string,
  regime: TradingRegimeAnalysis,
  horizons: number[] = DEFAULT_CONE_HORIZONS_DAYS,
): ProbabilityAnalysis {
  const currentPrice = regime.liquidity.currentPrice;
  const volatilityAnnualizedPct = regime.volatilityAnnualizedPct;
  const available = currentPrice > 0 && volatilityAnnualizedPct !== null && volatilityAnnualizedPct > 0;

  const unavailableReason = available
    ? null
    : currentPrice <= 0
      ? "current price could not be resolved."
      : "realized volatility could not be computed from the available candle history.";

  const cone = available ? horizons.map((d) => computeConeLevel(currentPrice, volatilityAnnualizedPct!, d)) : [];

  const confidenceLevel: MarketStructureConfidenceLevel = available ? regime.confidenceLevel : "Low";
  const confidenceExplanation = available
    ? `Derived from the same trend/liquidity/volatility signals underlying the ${regime.regimeLabel} regime read.`
    : "Probability cone could not be computed — see unavailableReason.";

  const summary = buildSummary(symbol, available, unavailableReason, regime.regimeLabel, volatilityAnnualizedPct, confidenceLevel);

  return {
    symbol,
    dataSource: regime.dataSource,
    currentPrice,
    volatilityAnnualizedPct,
    available,
    unavailableReason,
    cone,
    confidenceLevel,
    confidenceExplanation,
    summary,
    regime,
  };
}

// Orchestration helper: resolves the regime via Sprint 36's
// buildMarketRegimeAnalysis() (which itself transitively resolves Sprint
// 33/34/35 and Sprint 32's provider) — this module makes no direct provider
// call of its own. Honestly returns null when the symbol can't be resolved
// — never fabricates an analysis for an unresolvable symbol.
export async function buildProbabilityAnalysis(
  symbol: string,
  provider: MarketDataProvider,
  horizons: number[] = DEFAULT_CONE_HORIZONS_DAYS,
  timeframes: Timeframe[] = DEFAULT_MULTI_TIMEFRAMES,
): Promise<ProbabilityAnalysis | null> {
  const regime = await buildMarketRegimeAnalysis(symbol, provider, timeframes);
  if (!regime) return null;
  return analyzeProbability(symbol.toUpperCase(), regime, horizons);
}

// Convenience orchestration for a single targeted price-level question
// ("what's the probability AAPL reaches $220 in 30 days?"), reusing the
// exact same Sprint 36 regime resolution as buildProbabilityAnalysis()
// above rather than a second, parallel provider call.
export async function buildLevelProbability(
  symbol: string,
  targetPrice: number,
  daysAhead: number,
  provider: MarketDataProvider,
  timeframes: Timeframe[] = DEFAULT_MULTI_TIMEFRAMES,
): Promise<LevelProbability | null> {
  const regime = await buildMarketRegimeAnalysis(symbol, provider, timeframes);
  if (!regime) return null;
  return computeLevelProbability(regime.liquidity.currentPrice, targetPrice, daysAhead, regime.volatilityAnnualizedPct);
}

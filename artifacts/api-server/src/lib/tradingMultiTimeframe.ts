// Phase 3, Sprint 34 — Institutional Trading Engine, Multi-Timeframe Trend
// Engine (Core) (approved Phase 3 plan §13, reordered ahead of the original
// roadmap table's Sprint 34/37 order at the project owner's explicit
// direction — see docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 34
// as-built note for the disclosed reordering).
//
// Deliberately NOT a new algorithm: per §13's own design, this module runs
// Sprint 33's Market Structure scorer independently at each configured
// timeframe, then layers a thin confluence classification on top, reusing
// the exact generic `classifyAgreementSignal<T>()` helper extracted in
// Phase 2 Sprint 17 (already reused once for the AI Investment Committee's
// Buy/Hold/Wait votes) — a second, disclosed reuse of that utility, not a
// new agreement-scoring formula. The only genuinely new logic here is the
// candle-per-timeframe plumbing and the honest dominant-trend/confluence-
// score derivation below.
//
// SAFETY CONTRACT, unbroken from every prior SIMULATED engine in this
// codebase: never fabricate a "dominant" trend or a confluence percentage
// when the underlying timeframes don't actually support one — a single
// timeframe or a genuine tie between trends honestly reports no dominant
// trend / no confluence score, never an invented pick. No LLM call, no live
// order-flow/Level 2/broker data anywhere in this module.
//
// Core only this sprint — no route, no UI (mirrors Sprint 33's own Core-only
// scope; a future sprint adds the route/UI). Reuses Sprint 32's
// MarketDataProvider and Sprint 33's analyzeMarketStructure() unmodified.

import type { Candle, MarketDataProvider, Timeframe } from "./tradingMarketData.js";
import { MAX_LOOKBACK } from "./tradingMarketData.js";
import {
  analyzeMarketStructure,
  type MarketStructureAnalysis,
  type MarketStructureConfidenceLevel,
  type TrendStructure,
} from "./tradingMarketStructure.js";
import { classifyAgreementSignal, type AgreementSignal } from "./marginOfSafety.js";

// The default confluence set: a short/medium/long-horizon spread, matching
// §13's own example ("is the 1-hour trend aligned with the daily trend")
// extended with 15m for a short-horizon read. A caller may pass any subset
// of Timeframe with 2+ entries; fewer than 2 honestly yields
// agreement: "insufficient-data" (classifyAgreementSignal's own existing
// behavior, reused unmodified) and null dominant trend / confluence score.
export const DEFAULT_MULTI_TIMEFRAMES: Timeframe[] = ["15m", "1h", "1D"];

export interface TimeframeStructure {
  interval: Timeframe;
  structure: MarketStructureAnalysis;
}

export interface MultiTimeframeAnalysis {
  symbol: string;
  dataSource: "SIMULATED" | "LIVE";
  timeframes: TimeframeStructure[];
  trendAgreement: AgreementSignal;
  dominantTrend: TrendStructure | null;
  confluenceScore: number | null; // % of considered timeframes sharing the dominant trend; null when not meaningfully computable
  confidenceLevel: MarketStructureConfidenceLevel;
  confidenceExplanation: string;
  summary: string;
}

// Returns the single trend with the strictly-highest count, or null on a
// genuine tie (including the all-different case) — never guesses a winner.
function deriveDominantTrend(trends: TrendStructure[]): TrendStructure | null {
  const counts = new Map<TrendStructure, number>();
  for (const t of trends) counts.set(t, (counts.get(t) ?? 0) + 1);
  let max = -1;
  let winners: TrendStructure[] = [];
  for (const [trend, count] of counts) {
    if (count > max) {
      max = count;
      winners = [trend];
    } else if (count === max) {
      winners.push(trend);
    }
  }
  return winners.length === 1 ? winners[0] : null;
}

function deriveConfidence(
  structures: TimeframeStructure[],
  agreement: AgreementSignal,
): { level: MarketStructureConfidenceLevel; explanation: string } {
  if (agreement === "insufficient-data") {
    return {
      level: "Low",
      explanation: "Fewer than 2 timeframes were analyzed — confluence cannot be meaningfully assessed.",
    };
  }
  const levels = structures.map((s) => s.structure.confidenceLevel);
  if (levels.some((l) => l === "Low")) {
    return {
      level: "Low",
      explanation: "At least one timeframe has a thin candle sample, limiting confidence in the overall read.",
    };
  }
  if (agreement === "unanimous" && levels.every((l) => l === "High")) {
    return {
      level: "High",
      explanation: "All analyzed timeframes agree on trend direction with a strong candle sample on each.",
    };
  }
  if (agreement === "split") {
    return {
      level: "Low",
      explanation: "The analyzed timeframes show no consistent trend direction.",
    };
  }
  return {
    level: "Moderate",
    explanation: "Timeframes show reasonable data coverage with partial trend agreement.",
  };
}

function buildSummary(
  symbol: string,
  agreement: AgreementSignal,
  dominantTrend: TrendStructure | null,
  confluenceScore: number | null,
  confidenceLevel: MarketStructureConfidenceLevel,
  timeframes: TimeframeStructure[],
): string {
  const tfList = timeframes.map((t) => t.interval).join("/");
  if (agreement === "insufficient-data") {
    return `${symbol}: not enough timeframes were analyzed (${tfList}) to assess multi-timeframe confluence. Confidence: ${confidenceLevel}.`;
  }
  if (!dominantTrend) {
    return `${symbol} shows split trend structure across ${tfList} — no dominant trend, agreement: ${agreement}. Confidence: ${confidenceLevel}.`;
  }
  return `${symbol} shows a ${dominantTrend} trend across ${tfList} (${agreement} agreement, ${confluenceScore}% confluence). Confidence: ${confidenceLevel}.`;
}

// Pure — never touches a provider. `timeframes` must each already carry a
// resolved MarketStructureAnalysis (produced by Sprint 33's
// analyzeMarketStructure()), the same "pure function over already-resolved
// data" discipline as analyzeMarketStructure() itself.
export function analyzeMultiTimeframe(
  symbol: string,
  timeframes: TimeframeStructure[],
  isLive: boolean,
): MultiTimeframeAnalysis {
  const trends = timeframes.map((t) => t.structure.trend);
  const agreement = classifyAgreementSignal(trends);
  const dominantTrend = timeframes.length >= 2 ? deriveDominantTrend(trends) : null;
  const confluenceScore =
    timeframes.length >= 2 && dominantTrend
      ? Math.round((trends.filter((t) => t === dominantTrend).length / trends.length) * 100)
      : null;
  const { level: confidenceLevel, explanation: confidenceExplanation } = deriveConfidence(timeframes, agreement);
  const summary = buildSummary(symbol, agreement, dominantTrend, confluenceScore, confidenceLevel, timeframes);

  return {
    symbol,
    dataSource: isLive ? "LIVE" : "SIMULATED",
    timeframes,
    trendAgreement: agreement,
    dominantTrend,
    confluenceScore,
    confidenceLevel,
    confidenceExplanation,
    summary,
  };
}

// Orchestration helper: resolves candles for each configured timeframe via
// the provided MarketDataProvider (Sprint 32's seam, unmodified), runs
// Sprint 33's analyzeMarketStructure() per timeframe, then the pure
// confluence layer above. Honestly returns null when the provider can't
// resolve the symbol (invalid ticker shape) — never fabricates a partial
// analysis for an unresolvable symbol.
export async function buildMultiTimeframeAnalysis(
  symbol: string,
  provider: MarketDataProvider,
  timeframes: Timeframe[] = DEFAULT_MULTI_TIMEFRAMES,
): Promise<MultiTimeframeAnalysis | null> {
  const sym = symbol.toUpperCase();
  const resolved: TimeframeStructure[] = [];
  for (const interval of timeframes) {
    const candles: Candle[] | null = await provider.getCandles(sym, interval, MAX_LOOKBACK[interval]);
    if (!candles) return null;
    resolved.push({ interval, structure: analyzeMarketStructure(candles, sym, interval, provider.isLive) });
  }
  return analyzeMultiTimeframe(sym, resolved, provider.isLive);
}

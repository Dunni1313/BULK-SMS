// Phase 2, Sprint 25 — Earnings Intelligence Engine (approved Phase 2 plan,
// Sprint 25). A pure, PROVIDER-AGNOSTIC analysis layer over the quarterly
// EarningsHistory data fundamentals.ts's providers already fetch (Sprint 25) —
// this module never touches a FundamentalsProvider, a network call, or a
// database; it only processes the already-computed, already-honest
// QuarterlyEarningsRecord[] it's given (SIMULATED, FMP, or Alpha Vantage all
// produce the exact same shape, so this engine can't tell — and doesn't need
// to know — which one it's looking at).
//
// SAFETY CONTRACT: never fabricates. Every derived field is null (with the
// data it needed simply absent) whenever the underlying quarters don't carry
// enough real actual/estimate pairs — e.g. Alpha Vantage's permanent lack of
// revenue-estimate data (Sprint 25's own approved decision) correctly leaves
// revenueBeatRate null and revenueSurprisePct null on every quarter, never
// approximated from EPS data or any other proxy.
//
// Reasoning is deterministic and rule-based only, per the approved Sprint 25
// scope — zero LLM calls, no AI-generated earnings commentary.
//
// REUSE: Earnings Consistency Score reuses the exact non-declining-steps
// formula already shipped as competitiveAdvantage.ts's historyConsistencyScore()
// (exported this sprint, a behavior-preserving change) rather than a second,
// duplicated consistency algorithm. Financial Statements/Financial Ratios/
// Graham/DCF/Buffett/Tom Nash/Management Quality/Document Intelligence were
// each checked during planning and none compute anything at quarterly-earnings
// granularity — there is no other genuine calculation to reuse from them this
// sprint, so none are referenced here.

import type { CompanyKind, DataSource, EarningsHistory, QuarterlyEarningsRecord, FundamentalsProvider, FetchOpts } from "./fundamentals.js";
import { historyConsistencyScore } from "./competitiveAdvantage.js";

function round(x: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

export type EarningsGrowthDirection = "accelerating" | "decelerating" | "stable" | "insufficient-data";
export type EarningsConfidenceLevel = "High" | "Moderate" | "Low";
export type EarningsSurpriseDirection = "beat" | "miss" | "meet";

export interface EarningsGrowthTrend {
  epsYoyGrowthPct: number | null; // most recent quarter's EPS vs. the same quarter 4 quarters prior
  revenueYoyGrowthPct: number | null;
  direction: EarningsGrowthDirection;
  detail: string;
}

export interface EarningsSurpriseStreak {
  direction: EarningsSurpriseDirection;
  count: number; // consecutive quarters, most recent backwards
}

export interface EarningsIntelligenceAnalysis {
  symbol: string;
  dataSource: DataSource;
  quarters: QuarterlyEarningsRecord[]; // pass-through, oldest -> newest — the "historical earnings timeline"
  epsBeatRate: number | null; // fraction [0,1] of quarters where actual >= estimate (both present)
  revenueBeatRate: number | null; // null entirely when no quarter has both revenue fields (e.g. Alpha Vantage)
  epsSurpriseStreak: EarningsSurpriseStreak | null;
  earningsGrowthTrend: EarningsGrowthTrend;
  consistencyScore: number | null; // 0-100
  confidenceLevel: EarningsConfidenceLevel;
  confidenceExplanation: string;
  summary: string;
}

// The minimum quarter-index distance needed to compare a quarter against "the
// same quarter a year prior" (4 quarters = 1 year for a quarterly series).
const YOY_QUARTER_OFFSET = 4;
// Minimum swing (percentage points) between the two most recent YoY growth
// readings to call the trend "accelerating"/"decelerating" rather than "stable".
const TREND_STABLE_BAND_PCT = 2;

function beatRate(
  quarters: QuarterlyEarningsRecord[],
  actualKey: "epsActual" | "revenueActual",
  estimateKey: "epsEstimate" | "revenueEstimate",
): number | null {
  const usable = quarters.filter((q) => q[actualKey] != null && q[estimateKey] != null);
  if (usable.length === 0) return null;
  const beats = usable.filter((q) => (q[actualKey] as number) >= (q[estimateKey] as number)).length;
  return round(beats / usable.length, 4);
}

function surpriseStreak(quarters: QuarterlyEarningsRecord[]): EarningsSurpriseStreak | null {
  let direction: EarningsSurpriseDirection | null = null;
  let count = 0;
  for (let i = quarters.length - 1; i >= 0; i--) {
    const q = quarters[i];
    if (q.epsActual == null || q.epsEstimate == null) break;
    const outcome: EarningsSurpriseDirection =
      q.epsActual > q.epsEstimate ? "beat" : q.epsActual < q.epsEstimate ? "miss" : "meet";
    if (direction === null) {
      direction = outcome;
      count = 1;
    } else if (outcome === direction) {
      count++;
    } else {
      break;
    }
  }
  return direction == null ? null : { direction, count };
}

function yoyGrowthPct(quarters: QuarterlyEarningsRecord[], offsetFromEnd: number, key: "epsActual" | "revenueActual"): number | null {
  const latestIdx = quarters.length - 1 - offsetFromEnd;
  const priorIdx = latestIdx - YOY_QUARTER_OFFSET;
  if (latestIdx < 0 || priorIdx < 0) return null;
  const latest = quarters[latestIdx][key];
  const prior = quarters[priorIdx][key];
  if (latest == null || prior == null || prior === 0) return null;
  return round(((latest - prior) / Math.abs(prior)) * 100, 2);
}

function growthTrend(quarters: QuarterlyEarningsRecord[]): EarningsGrowthTrend {
  const epsYoyGrowthPct = yoyGrowthPct(quarters, 0, "epsActual");
  const revenueYoyGrowthPct = yoyGrowthPct(quarters, 0, "revenueActual");
  const priorEpsYoyGrowthPct = yoyGrowthPct(quarters, 1, "epsActual");

  if (epsYoyGrowthPct == null || priorEpsYoyGrowthPct == null) {
    return {
      epsYoyGrowthPct,
      revenueYoyGrowthPct,
      direction: "insufficient-data",
      detail: "Not enough quarterly history to compute a year-over-year earnings growth trend (at least 5 quarters with both a current and a same-quarter-prior-year EPS actual are needed).",
    };
  }

  const swing = epsYoyGrowthPct - priorEpsYoyGrowthPct;
  let direction: EarningsGrowthDirection = "stable";
  if (swing > TREND_STABLE_BAND_PCT) direction = "accelerating";
  else if (swing < -TREND_STABLE_BAND_PCT) direction = "decelerating";

  const detail =
    `EPS grew ${epsYoyGrowthPct}% year-over-year in the most recent quarter, versus ${priorEpsYoyGrowthPct}% ` +
    `the quarter before — earnings growth is ${direction}.`;

  return { epsYoyGrowthPct, revenueYoyGrowthPct, direction, detail };
}

function consistencyScore(quarters: QuarterlyEarningsRecord[], epsBeat: number | null): number | null {
  const epsActuals = quarters.map((q) => q.epsActual).filter((v): v is number => v != null);
  const historyScore = historyConsistencyScore(epsActuals);
  const beatComponent = epsBeat != null ? round(epsBeat * 100) : null;
  if (historyScore != null && beatComponent != null) return round(historyScore * 0.5 + beatComponent * 0.5);
  return historyScore ?? beatComponent;
}

function confidence(quarters: QuarterlyEarningsRecord[]): { level: EarningsConfidenceLevel; explanation: string } {
  const total = quarters.length;
  if (total === 0) {
    return { level: "Low", explanation: "No quarterly earnings data is available." };
  }
  const epsComplete = quarters.filter((q) => q.epsActual != null && q.epsEstimate != null).length;
  const revenueComplete = quarters.filter((q) => q.revenueActual != null && q.revenueEstimate != null).length;
  const epsFraction = epsComplete / total;
  const revenueFraction = revenueComplete / total;
  // EPS actual-vs-estimate is the primary, near-universally-available signal;
  // revenue actual-vs-estimate is a bonus some providers (e.g. Alpha Vantage)
  // never publish — weighted so a provider's structural revenue gap doesn't
  // crater confidence the way missing EPS data would.
  const ratio = epsFraction * 0.7 + revenueFraction * 0.3;
  let level: EarningsConfidenceLevel = "Low";
  if (ratio >= 0.95) level = "High";
  else if (ratio >= 0.7) level = "Moderate";

  const revenueNote =
    revenueComplete === 0
      ? " (this provider does not publish revenue actual-vs-estimate data)"
      : "";
  const explanation =
    `EPS actual-vs-estimate data available for ${epsComplete} of ${total} quarters; ` +
    `revenue actual-vs-estimate data available for ${revenueComplete} of ${total} quarters${revenueNote}.`;
  return { level, explanation };
}

export function analyzeEarningsIntelligence(
  history: EarningsHistory,
  kind: CompanyKind = "stock",
): EarningsIntelligenceAnalysis {
  const { quarters } = history;
  const epsBeatRate = beatRate(quarters, "epsActual", "epsEstimate");
  const revenueBeatRate = beatRate(quarters, "revenueActual", "revenueEstimate");
  const epsSurpriseStreak = surpriseStreak(quarters);
  const earningsGrowthTrend = growthTrend(quarters);
  const score = consistencyScore(quarters, epsBeatRate);
  const { level: confidenceLevel, explanation: confidenceExplanation } = confidence(quarters);

  const etfCaveat =
    kind === "etf"
      ? " As a diversified fund, per-quarter earnings figures reflect the fund's blended holdings rather than a single business."
      : "";

  let summary: string;
  if (quarters.length === 0) {
    summary = `${history.symbol}: no quarterly earnings data is available.`;
  } else {
    const beatText =
      epsBeatRate != null
        ? `beat EPS estimates in ${round(epsBeatRate * 100)}% of tracked quarters`
        : "has no comparable EPS estimate data";
    const streakText = epsSurpriseStreak
      ? `, currently on a ${epsSurpriseStreak.count}-quarter ${epsSurpriseStreak.direction} streak`
      : "";
    const trendText =
      earningsGrowthTrend.direction === "insufficient-data"
        ? "earnings growth trend is not yet computable"
        : `earnings growth is ${earningsGrowthTrend.direction}`;
    summary = `${history.symbol}: ${beatText}${streakText}. ${trendText[0].toUpperCase()}${trendText.slice(1)} (${confidenceLevel} confidence).${etfCaveat}`;
  }

  return {
    symbol: history.symbol,
    dataSource: history.dataSource,
    quarters,
    epsBeatRate,
    revenueBeatRate,
    epsSurpriseStreak,
    earningsGrowthTrend,
    consistencyScore: score,
    confidenceLevel,
    confidenceExplanation,
    summary,
  };
}

// Orchestration helper for the route: fetches the provider's EarningsHistory
// (honestly null for an unknown symbol, never fabricated) plus its Fundamentals
// purely for the `kind` field (ETF caveat text) — both calls hit the same
// short-lived in-process caches their own providers already maintain, so this
// adds no new caching layer. Honestly null when the symbol is unknown to the
// active provider; never throws for a genuinely missing symbol (network/rate-
// limit failures still propagate, matching every other on-demand route's
// contract).
export async function buildEarningsIntelligence(
  symbol: string,
  provider: FundamentalsProvider,
  opts?: FetchOpts,
): Promise<EarningsIntelligenceAnalysis | null> {
  const history = await provider.getEarningsHistory(symbol, opts);
  if (!history) return null;
  const fundamentals = await provider.getFundamentals(symbol);
  return analyzeEarningsIntelligence(history, fundamentals?.kind ?? "stock");
}

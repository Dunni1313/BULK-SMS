// Phase 27 — Institutional Liquidity & Session Workbench.
//
// The Liquidity analog of Phase 26's Structure Shift Timeline: a
// deterministic, chronological view built by replaying Sprint 35's
// already-tested, unexported-internals analyzeLiquidity() unmodified over
// a rolling window of already-resolved candles — the same disclosed
// "reuse the existing scorer repeatedly over sub-windows to build a
// timeline instead of inventing a new one" technique
// tradingStructureTimeline.ts already established (itself modeled on
// tradingBacktest.ts's own "structure-breakout" strategy). Zero new
// scoring formula for the liquidity/pressure reads themselves — every
// point in the timeline is a genuine analyzeLiquidity() call over a real
// sub-window of candles.
//
// The one genuinely new, but deliberately trivial, piece of logic is
// "Relative Liquidity": a plain statistical comparison (latest point's
// already-computed liquidityScore vs. the average of the other returned
// points' already-computed liquidityScore) bucketed into
// Above/Below/Average — never a new score, just a comparison of existing
// scores, honestly "Insufficient Data" with fewer than 2 points.
//
// "Key Liquidity Zones" reuses the volume profile analyzeLiquidity()
// already produces for the FULL candle sample (a single additional call,
// not a new computation) — the same top-strength levels already shown
// elsewhere, relabeled for this panel's own display purpose.
//
// SAFETY CONTRACT, unbroken: no LLM call, no fabricated liquidity read —
// a thin/empty sample still produces an honest, well-shaped empty
// timeline, never a crash or an invented value.

import type { Candle, MarketDataProvider, Timeframe } from "./tradingMarketData.js";
import { analyzeLiquidity, type LiquidityBand, type PressureDirection, type VolumeProfileLevel } from "./tradingLiquidity.js";

export type RelativeLiquidity = "Above Average" | "Below Average" | "Average" | "Insufficient Data";

export interface LiquidityTimelinePoint {
  periodStart: string;
  periodEnd: string;
  liquidityBand: LiquidityBand;
  liquidityScore: number;
  avgDollarVolume: number;
  buySellDirection: PressureDirection;
  candleCount: number;
}

export interface LiquidityTimeline {
  symbol: string;
  interval: Timeframe;
  dataSource: "SIMULATED" | "LIVE";
  candleCount: number;
  points: LiquidityTimelinePoint[];
  relativeLiquidity: RelativeLiquidity;
  averageLiquidityScore: number | null;
  keyLiquidityZones: VolumeProfileLevel[];
  summary: string;
}

// A rolling window of this many candles is replayed through
// analyzeLiquidity() to produce each timeline point — wide enough to give
// each point a real, non-degenerate volume-profile/pressure read (matching
// this module's own confidenceFromCandleCount's "Moderate" tier), narrow
// enough that the timeline genuinely varies point to point rather than
// smoothing everything into the same read.
const ROLLING_WINDOW = 5;
const MAX_TIMELINE_POINTS_RETURNED = 20;
// A ±10% band around the average before a difference is honestly called
// "Above"/"Below" rather than "Average" — avoids flagging noise-level
// differences as a meaningful relative-liquidity signal.
const RELATIVE_LIQUIDITY_BAND_PCT = 0.1;

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function relativeLiquidityFrom(points: LiquidityTimelinePoint[]): { relative: RelativeLiquidity; average: number | null } {
  if (points.length < 2) return { relative: "Insufficient Data", average: null };
  const latest = points[points.length - 1];
  const priorScores = points.slice(0, -1).map((p) => p.liquidityScore);
  const average = round1(priorScores.reduce((s, v) => s + v, 0) / priorScores.length);
  if (average <= 0) return { relative: "Insufficient Data", average };
  const ratio = latest.liquidityScore / average;
  if (ratio >= 1 + RELATIVE_LIQUIDITY_BAND_PCT) return { relative: "Above Average", average };
  if (ratio <= 1 - RELATIVE_LIQUIDITY_BAND_PCT) return { relative: "Below Average", average };
  return { relative: "Average", average };
}

function buildSummary(symbol: string, points: LiquidityTimelinePoint[], relative: RelativeLiquidity): string {
  if (points.length === 0) return `${symbol}: no candle data available to build a liquidity timeline.`;
  const latest = points[points.length - 1];
  return `${symbol}: ${points.length} liquidity timeline point(s). Most recent read: ${latest.liquidityBand} liquidity, ${latest.buySellDirection} pressure. Relative liquidity: ${relative}.`;
}

// Pure — never touches a provider. `candles` must already be oldest ->
// newest. Never fabricates a point for a window with no real candles.
export function buildLiquidityTimelineFromCandles(
  candles: Candle[],
  symbol: string,
  interval: Timeframe,
  isLive: boolean,
): LiquidityTimeline {
  const points: LiquidityTimelinePoint[] = [];
  for (let i = ROLLING_WINDOW - 1; i < candles.length; i++) {
    const window = candles.slice(i - ROLLING_WINDOW + 1, i + 1);
    const analysis = analyzeLiquidity(window, symbol, interval, isLive);
    points.push({
      periodStart: window[0].time,
      periodEnd: window[window.length - 1].time,
      liquidityBand: analysis.liquidityBand,
      liquidityScore: analysis.liquidityScore,
      avgDollarVolume: analysis.avgDollarVolume,
      buySellDirection: analysis.buySellPressure.direction,
      candleCount: window.length,
    });
  }

  const returnedPoints = points.slice(-MAX_TIMELINE_POINTS_RETURNED);
  const { relative, average } = relativeLiquidityFrom(returnedPoints);
  const fullSample = analyzeLiquidity(candles, symbol, interval, isLive);

  return {
    symbol,
    interval,
    dataSource: isLive ? "LIVE" : "SIMULATED",
    candleCount: candles.length,
    points: returnedPoints,
    relativeLiquidity: relative,
    averageLiquidityScore: average,
    keyLiquidityZones: fullSample.volumeProfile,
    summary: buildSummary(symbol, returnedPoints, relative),
  };
}

// Orchestration helper: resolves candles via the provided MarketDataProvider
// (Sprint 32's seam, unmodified) and calls the pure builder above. Honestly
// returns null when the provider can't resolve the symbol.
export async function buildLiquidityTimeline(
  symbol: string,
  interval: Timeframe,
  lookback: number,
  provider: MarketDataProvider,
): Promise<LiquidityTimeline | null> {
  const candles = await provider.getCandles(symbol, interval, lookback);
  if (!candles) return null;
  return buildLiquidityTimelineFromCandles(candles, symbol.toUpperCase(), interval, provider.isLive);
}

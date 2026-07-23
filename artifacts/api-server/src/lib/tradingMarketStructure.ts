// Phase 3, Sprint 33 — Institutional Trading Engine, Market Structure Engine
// (Core) (approved Phase 3 plan, Sprint 33; see
// docs/Phase-3-Trading-Engine-Execution-Plan.md §12).
//
// A pure, I/O-free scorer over an already-resolved candle series — the same
// "pure function over already-resolved data, unit-testable without a
// provider" discipline as computePortfolioRisk()/analyzeTomNash(). Produces
// detected support/resistance zones (local-extrema clustering — a well-
// understood deterministic technique, never ML/LLM-generated), a trend-
// structure classification (uptrend/downtrend/range, from swing-high/
// swing-low sequencing), and a confidence level reflecting how many candles
// were actually available.
//
// SAFETY CONTRACT, unbroken from every prior SIMULATED engine in this
// codebase: every score/level is either computed from real (SIMULATED or
// LIVE) candle data or honestly reflects a thin sample via a low confidence
// level — never a fabricated zone or trend read. No LLM call, no live
// order-flow/Level 2/broker data anywhere in this module.
//
// Core only this sprint — no route, no UI (Sprint 34's scope per the
// approved plan). Deliberately reuses Sprint 32's MarketDataProvider
// abstraction unmodified.

import type { Candle, MarketDataProvider, Timeframe } from "./tradingMarketData.js";

export type TrendStructure = "uptrend" | "downtrend" | "range";
export type MarketStructureConfidenceLevel = "High" | "Moderate" | "Low";

export interface SwingPoint {
  time: string;
  price: number;
  kind: "high" | "low";
}

export interface SupportResistanceZone {
  price: number;
  kind: "support" | "resistance";
  strength: number; // number of swing touches clustered into this zone
}

export interface MarketStructureAnalysis {
  symbol: string;
  interval: Timeframe;
  dataSource: "SIMULATED" | "LIVE";
  candleCount: number;
  currentPrice: number;
  trend: TrendStructure;
  trendDetail: string;
  swingPoints: SwingPoint[];
  zones: SupportResistanceZone[];
  confidenceLevel: MarketStructureConfidenceLevel;
  confidenceExplanation: string;
  summary: string;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// A candle at index i is a swing high/low when its high/low is the most
// extreme within a symmetric window of SWING_WINDOW candles on either side.
const SWING_WINDOW = 2;

function detectSwingPoints(candles: Candle[]): SwingPoint[] {
  const points: SwingPoint[] = [];
  for (let i = SWING_WINDOW; i < candles.length - SWING_WINDOW; i++) {
    const c = candles[i];
    const before = candles.slice(i - SWING_WINDOW, i);
    const after = candles.slice(i + 1, i + 1 + SWING_WINDOW);
    const isSwingHigh = before.every((w) => w.high <= c.high) && after.every((w) => w.high <= c.high);
    const isSwingLow = before.every((w) => w.low >= c.low) && after.every((w) => w.low >= c.low);
    if (isSwingHigh) points.push({ time: c.time, price: c.high, kind: "high" });
    if (isSwingLow) points.push({ time: c.time, price: c.low, kind: "low" });
  }
  return points;
}

// Swing prices within this fraction of each other are clustered into the
// same support/resistance zone. Exported (Phase 26 — Institutional Market
// Structure Workbench) so lib/tradingStructureTimeline.ts's own "support
// test"/"resistance test" event detection reuses the exact same tolerance
// rather than inventing a second, subtly different threshold — the same
// "export what's needed, reuse directly" precedent as classifyMoatRating()/
// classifyMarginOfSafety() elsewhere in this codebase.
export const ZONE_TOLERANCE_PCT = 0.005;
// A cluster needs at least this many swing touches to be reported as a real
// zone — a single, un-repeated swing is never surfaced as a "level".
const MIN_ZONE_TOUCHES = 2;
const MAX_ZONES_RETURNED = 6;

function clusterZones(points: SwingPoint[], currentPrice: number): SupportResistanceZone[] {
  const sorted = [...points].sort((a, b) => a.price - b.price);
  const clusters: number[][] = [];
  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    if (last) {
      const avg = last.reduce((s, x) => s + x, 0) / last.length;
      if (avg > 0 && Math.abs(p.price - avg) / avg <= ZONE_TOLERANCE_PCT) {
        last.push(p.price);
        continue;
      }
    }
    clusters.push([p.price]);
  }

  return clusters
    .filter((c) => c.length >= MIN_ZONE_TOUCHES)
    .map((c) => {
      const avg = round2(c.reduce((s, x) => s + x, 0) / c.length);
      return {
        price: avg,
        kind: (avg < currentPrice ? "support" : "resistance") as "support" | "resistance",
        strength: c.length,
      };
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_ZONES_RETURNED);
}

function isMonotonic(vals: number[], direction: "rising" | "falling"): boolean {
  for (let i = 1; i < vals.length; i++) {
    if (direction === "rising" && vals[i] <= vals[i - 1]) return false;
    if (direction === "falling" && vals[i] >= vals[i - 1]) return false;
  }
  return true;
}

// Recent-swings-only trend structure — deliberately looks at only the last 3
// swing highs and last 3 swing lows (not the whole history), matching how a
// trader reads recent structure rather than the entire lookback window.
const RECENT_SWINGS = 3;

function classifyTrend(points: SwingPoint[]): { trend: TrendStructure; detail: string } {
  const highs = points.filter((p) => p.kind === "high").slice(-RECENT_SWINGS);
  const lows = points.filter((p) => p.kind === "low").slice(-RECENT_SWINGS);

  if (highs.length < 2 || lows.length < 2) {
    return {
      trend: "range",
      detail: "Not enough swing points in this sample to classify a clear trend structure.",
    };
  }

  const highsRising = isMonotonic(highs.map((h) => h.price), "rising");
  const lowsRising = isMonotonic(lows.map((l) => l.price), "rising");
  const highsFalling = isMonotonic(highs.map((h) => h.price), "falling");
  const lowsFalling = isMonotonic(lows.map((l) => l.price), "falling");

  if (highsRising && lowsRising) {
    return { trend: "uptrend", detail: "Higher highs and higher lows across the recent swing sequence." };
  }
  if (highsFalling && lowsFalling) {
    return { trend: "downtrend", detail: "Lower highs and lower lows across the recent swing sequence." };
  }
  return {
    trend: "range",
    detail: "Mixed swing structure — no clear higher-highs/higher-lows or lower-highs/lower-lows sequence.",
  };
}

// Confidence bands mirror the established 3-tier convention used throughout
// this codebase (Investment Quality, Competitive Advantage, Earnings
// Intelligence, etc.) — always floors at "Low", never a 4th "unavailable"
// tier; a thin sample still produces an honest, well-shaped result (an
// empty zones list, a "range" trend with an honest reason), just at low
// confidence, never a fabricated one.
function confidenceFromCandleCount(n: number): { level: MarketStructureConfidenceLevel; explanation: string } {
  if (n >= 80) {
    return { level: "High", explanation: `${n} candles available — a strong sample for swing/zone detection.` };
  }
  if (n >= 30) {
    return { level: "Moderate", explanation: `${n} candles available — a reasonable sample for swing/zone detection.` };
  }
  return { level: "Low", explanation: `${n} candles available — a thin sample; swing/zone detection is directional at best.` };
}

function buildSummary(
  symbol: string,
  trend: TrendStructure,
  trendDetail: string,
  zones: SupportResistanceZone[],
  confidenceLevel: MarketStructureConfidenceLevel,
): string {
  const zonePart =
    zones.length > 0
      ? `${zones.length} support/resistance zone(s) detected, the strongest at $${zones[0].price.toFixed(2)} (${zones[0].kind}, ${zones[0].strength} touches).`
      : "No repeated support/resistance zone detected in this sample.";
  return `${symbol} shows a ${trend} structure (${trendDetail}) ${zonePart} Confidence: ${confidenceLevel}.`;
}

// Pure — never touches a provider. `candles` must already be oldest -> newest
// (the shape SimulatedMarketDataProvider.getCandles() already returns).
export function analyzeMarketStructure(
  candles: Candle[],
  symbol: string,
  interval: Timeframe,
  isLive: boolean,
): MarketStructureAnalysis {
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const swingPoints = detectSwingPoints(candles);
  const zones = clusterZones(swingPoints, currentPrice);
  const { trend, detail: trendDetail } = classifyTrend(swingPoints);
  const { level: confidenceLevel, explanation: confidenceExplanation } = confidenceFromCandleCount(candles.length);
  const summary = buildSummary(symbol, trend, trendDetail, zones, confidenceLevel);

  return {
    symbol,
    interval,
    dataSource: isLive ? "LIVE" : "SIMULATED",
    candleCount: candles.length,
    currentPrice,
    trend,
    trendDetail,
    swingPoints,
    zones,
    confidenceLevel,
    confidenceExplanation,
    summary,
  };
}

// Orchestration helper: resolves candles via the provided MarketDataProvider
// (Sprint 32's seam, unmodified) and calls the pure analyzer above. Honestly
// returns null when the provider can't resolve the symbol (invalid ticker
// shape) — never fabricates an analysis for an unresolvable symbol.
export async function buildMarketStructureAnalysis(
  symbol: string,
  interval: Timeframe,
  lookback: number,
  provider: MarketDataProvider,
): Promise<MarketStructureAnalysis | null> {
  const candles = await provider.getCandles(symbol, interval, lookback);
  if (!candles) return null;
  return analyzeMarketStructure(candles, symbol.toUpperCase(), interval, provider.isLive);
}

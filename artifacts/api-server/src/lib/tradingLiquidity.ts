// Phase 3, Sprint 35 — Institutional Trading Engine, Order Flow and
// Liquidity Engine (Core) (approved Phase 3 plan §11; see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 35 as-built note).
//
// A pure, I/O-free scorer over an already-resolved candle series — the same
// "pure function over already-resolved data" discipline as Sprint 33's
// analyzeMarketStructure()/computePortfolioRisk()/analyzeTomNash(). Produces
// a volume profile (price-level volume histogram), a banded liquidity score
// (adapting marketData.ts's checkLiquidity() threshold-gating shape from
// options open-interest/volume/spread to equity dollar-volume), and a
// buy/sell-pressure proxy derived directly from each candle's own up/down
// close — never a separately-seeded "fabricated" imbalance, just an honest
// read of the candle data §10 already produced deterministically.
//
// SAFETY CONTRACT, unbroken from every prior SIMULATED engine in this
// codebase: this is never real Level 2 order-book depth or real trade-print
// tape data — both are explicitly deferred (Phase 3 plan §11/§25 Decision
// 7), pending a live tick-data vendor relationship. Every score/level is
// either computed from real (SIMULATED or LIVE) candle data or honestly
// reflects a thin/empty sample via a low confidence level — never a
// fabricated liquidity read. No LLM call anywhere in this module.
//
// Core only this sprint — no route, no UI. Deliberately reuses Sprint 32's
// MarketDataProvider abstraction unmodified; deliberately independent of
// Sprint 33/34's Market Structure/Multi-Timeframe modules (this is a
// sibling engine per §11, not built on top of Structure).

import type { Candle, MarketDataProvider, Timeframe } from "./tradingMarketData.js";

export type LiquidityBand = "High" | "Moderate" | "Low";
export type LiquidityConfidenceLevel = "High" | "Moderate" | "Low";
export type PressureDirection = "buying" | "selling" | "neutral";

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  pctOfTotal: number;
}

export interface BuySellPressure {
  buyPct: number;
  sellPct: number;
  direction: PressureDirection;
}

export interface LiquidityAnalysis {
  symbol: string;
  interval: Timeframe;
  dataSource: "SIMULATED" | "LIVE";
  candleCount: number;
  currentPrice: number;
  volumeProfile: VolumeProfileLevel[];
  avgDollarVolume: number;
  liquidityScore: number;
  liquidityBand: LiquidityBand;
  buySellPressure: BuySellPressure;
  confidenceLevel: LiquidityConfidenceLevel;
  confidenceExplanation: string;
  summary: string;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

// Volume profile: bucket each candle's typical price ((high+low+close)/3)
// into a fixed number of equal-width price buckets across the sample's own
// high/low range, summing volume per bucket. Never fabricates a level with
// no real candle volume behind it.
const VOLUME_PROFILE_BUCKETS = 10;
const MAX_PROFILE_LEVELS_RETURNED = 8;

function buildVolumeProfile(candles: Candle[]): VolumeProfileLevel[] {
  if (candles.length === 0) return [];
  const totalVolume = candles.reduce((s, c) => s + c.volume, 0);
  if (totalVolume === 0) return [];

  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const hasRange = max > min;
  const bucketWidth = hasRange ? (max - min) / VOLUME_PROFILE_BUCKETS : 0;

  const buckets = new Map<number, number>();
  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const idx = hasRange
      ? Math.min(VOLUME_PROFILE_BUCKETS - 1, Math.floor((typicalPrice - min) / bucketWidth))
      : 0;
    buckets.set(idx, (buckets.get(idx) ?? 0) + c.volume);
  }

  const levels: VolumeProfileLevel[] = [];
  for (const [idx, volume] of buckets) {
    const price = hasRange ? round2(min + (idx + 0.5) * bucketWidth) : round2(min);
    levels.push({ price, volume, pctOfTotal: round1((volume / totalVolume) * 100) });
  }

  return levels.sort((a, b) => b.volume - a.volume).slice(0, MAX_PROFILE_LEVELS_RETURNED);
}

function avgDollarVolume(candles: Candle[]): number {
  if (candles.length === 0) return 0;
  const total = candles.reduce((s, c) => s + c.close * c.volume, 0);
  return round2(total / candles.length);
}

// Adapts marketData.ts's checkLiquidity() threshold-gating shape (options
// open interest/volume/spread) to a single continuous 0-100 equity
// dollar-volume score, banded the same 3-tier way every confidence/score
// convention in this codebase is banded. $25M average daily dollar volume
// (a plausible large-cap/liquid-ETF threshold) reaches the score ceiling;
// zero or negative dollar volume honestly floors at 0, never a fabricated
// positive score.
const LIQUIDITY_HIGH_THRESHOLD = 25_000_000;

function liquidityScoreFromDollarVolume(dv: number): { score: number; band: LiquidityBand } {
  const score = dv <= 0 ? 0 : Math.min(100, Math.round((dv / LIQUIDITY_HIGH_THRESHOLD) * 100));
  const band: LiquidityBand = score >= 75 ? "High" : score >= 40 ? "Moderate" : "Low";
  return { score, band };
}

// Buy/sell-pressure proxy: derived directly from each candle's own up/down
// close (bullish candle's volume counts toward buying pressure, bearish
// toward selling) — an honest read of already-seeded candle data, never a
// separately-fabricated imbalance number. A doji (close === open) candle's
// volume is excluded from the directional total, not guessed either way.
const PRESSURE_THRESHOLD_PCT = 55;

function computeBuySellPressure(candles: Candle[]): BuySellPressure {
  let buyVolume = 0;
  let sellVolume = 0;
  for (const c of candles) {
    if (c.close > c.open) buyVolume += c.volume;
    else if (c.close < c.open) sellVolume += c.volume;
  }
  const total = buyVolume + sellVolume;
  if (total === 0) return { buyPct: 50, sellPct: 50, direction: "neutral" };
  const buyPct = Math.round((buyVolume / total) * 100);
  const sellPct = 100 - buyPct;
  const direction: PressureDirection =
    buyPct >= PRESSURE_THRESHOLD_PCT ? "buying" : sellPct >= PRESSURE_THRESHOLD_PCT ? "selling" : "neutral";
  return { buyPct, sellPct, direction };
}

// Confidence bands mirror the established 3-tier convention used throughout
// this codebase — always floors at "Low", never a 4th "unavailable" tier; a
// thin sample still produces an honest, well-shaped result (an empty
// volume profile, a neutral pressure read), just at low confidence, never a
// fabricated one.
function confidenceFromCandleCount(n: number): { level: LiquidityConfidenceLevel; explanation: string } {
  if (n >= 80) {
    return { level: "High", explanation: `${n} candles available — a strong sample for liquidity/volume-profile analysis.` };
  }
  if (n >= 30) {
    return { level: "Moderate", explanation: `${n} candles available — a reasonable sample for liquidity/volume-profile analysis.` };
  }
  return { level: "Low", explanation: `${n} candles available — a thin sample; the liquidity read is directional at best.` };
}

function buildSummary(
  symbol: string,
  liquidityBand: LiquidityBand,
  dollarVolume: number,
  direction: PressureDirection,
  confidenceLevel: LiquidityConfidenceLevel,
): string {
  const dvMillions = (dollarVolume / 1_000_000).toFixed(1);
  return `${symbol} shows ${liquidityBand} liquidity (avg $${dvMillions}M daily dollar volume) with ${direction} pressure. Confidence: ${confidenceLevel}.`;
}

// Pure — never touches a provider, never generates new randomness. `candles`
// must already be oldest -> newest (the shape SimulatedMarketDataProvider's
// getCandles() already returns).
export function analyzeLiquidity(
  candles: Candle[],
  symbol: string,
  interval: Timeframe,
  isLive: boolean,
): LiquidityAnalysis {
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const volumeProfile = buildVolumeProfile(candles);
  const dollarVolume = avgDollarVolume(candles);
  const { score: liquidityScore, band: liquidityBand } = liquidityScoreFromDollarVolume(dollarVolume);
  const buySellPressure = computeBuySellPressure(candles);
  const { level: confidenceLevel, explanation: confidenceExplanation } = confidenceFromCandleCount(candles.length);
  const summary = buildSummary(symbol, liquidityBand, dollarVolume, buySellPressure.direction, confidenceLevel);

  return {
    symbol,
    interval,
    dataSource: isLive ? "LIVE" : "SIMULATED",
    candleCount: candles.length,
    currentPrice,
    volumeProfile,
    avgDollarVolume: dollarVolume,
    liquidityScore,
    liquidityBand,
    buySellPressure,
    confidenceLevel,
    confidenceExplanation,
    summary,
  };
}

// Orchestration helper: resolves candles via the provided MarketDataProvider
// (Sprint 32's seam, unmodified) and calls the pure analyzer above. Honestly
// returns null when the provider can't resolve the symbol (invalid ticker
// shape) — never fabricates an analysis for an unresolvable symbol.
export async function buildLiquidityAnalysis(
  symbol: string,
  interval: Timeframe,
  lookback: number,
  provider: MarketDataProvider,
): Promise<LiquidityAnalysis | null> {
  const candles = await provider.getCandles(symbol, interval, lookback);
  if (!candles) return null;
  return analyzeLiquidity(candles, symbol.toUpperCase(), interval, provider.isLive);
}

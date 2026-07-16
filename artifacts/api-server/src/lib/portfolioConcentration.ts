// Correlation & Concentration Risk Overlay sprint — a portfolio-wide,
// read-only view of concentration, directional exposure, net Greeks, and
// correlation-style clustering across the user's own current open
// portfolio.
//
// Every figure here is built entirely from already-existing, unmodified
// primitives: lib/positionSizing.ts's own already-exported
// currentOpenTrades()/TradeRow/buildSnapshot() (Trade Adjustment sprint's
// own precedent, reused unchanged a third time) and serverState.ts's own
// computeTradeGreeks() (the same function every other portfolio-facing
// page in this codebase already uses). execution.ts, optionsMath.ts,
// risk.ts, autoExecution.ts, autoAdjustment.ts, and eventRisk.ts are NOT
// modified by this sprint.
//
// This module NEVER contacts a broker execution endpoint, NEVER creates
// or modifies an order or position, and NEVER performs a database write
// of any kind — every function here is read-only.
//
// Correlation-model scope, honestly disclosed rather than silently
// narrowed: per this sprint's own explicit "do not invent new
// correlation models or external market correlations" instruction, no
// statistical correlation coefficient (e.g. a real price-return
// covariance matrix) is computed anywhere in this module — there is no
// historical price-series data anywhere in this engine to compute one
// from honestly. Every "correlation" surfaced here is a categorical
// CLUSTER — positions that share an already-known, already-computed
// trait (the same underlying symbol, the same hand-curated real sector,
// the same strategy, the same exact expiration date, or the same
// delta-sign directional bias) — grouping, not statistics.
//
// Sector scope: optionsMath.ts's own UniverseEntry/Snapshot types carry
// no sector/industry field at all (confirmed by direct inspection before
// writing any code) — this engine's own trades table has never stored
// one, the same gap Position Sizing (Sprint "Position Sizing & Portfolio
// Impact Calculator") and Portfolio Stress Test both already disclosed
// as "No sector/industry classification is stored on options positions
// in this engine." This sprint closes that specific gap, but only via a
// small, disclosed, hand-curated table of REAL, publicly-known sector
// classifications for this engine's own fixed 10-symbol UNIVERSE
// (KNOWN_SECTOR_MAP below) — categorical metadata about real companies,
// not fabricated financial data, mirroring the exact precedent Engine 1's
// own lib/industryPeers.ts already established (its own
// KNOWN_SECTOR_PROFILES table) for the same reason. A symbol outside
// this table (a genuinely unusual state — every real position this
// engine can open is drawn from its own closed 10-symbol universe)
// honestly reports "Unclassified", never a guessed sector.
//
// Beta scope: no beta figure — real or synthetic — exists anywhere in
// this engine's own data model, and unlike sector (pure categorical
// metadata), a beta value is itself a statistical measure that would
// require either a real market-data feed or a fabricated number this
// sprint's own "do not invent" instruction rules out. Net portfolio beta
// is therefore always honestly reported unavailable, with a disclosed
// reason — never approximated.
//
// Asset class scope: every instrument this engine can ever hold is an
// equity/ETF option — there is no multi-asset-class universe (no bonds,
// futures, or crypto) anywhere in this codebase. Asset class is
// therefore genuinely, structurally always "Equity Option" for every
// position — a real, always-available, always-uniform classification,
// not a fabricated one.

import {
  currentOpenTrades,
  buildSnapshot,
  type TradeRow,
  type PortfolioGreeksSnapshot,
} from "./positionSizing.js";
import { computeTradeGreeks, getAccountValue, getSettingsRow, type StoredLeg } from "./serverState.js";
import { readAlpacaCreds } from "./providers/alpacaProvider.js";
import {
  getLastBrokerCheckConnected,
  getLastSuccessfulBrokerCheck,
} from "./providers/alpacaBroker.js";

// A small, disclosed, hand-curated table of REAL, publicly-known sector
// classifications for this engine's own fixed 10-symbol UNIVERSE
// (optionsMath.ts) — categorical metadata about real companies, not
// derived from any live data feed, mirroring Engine 1's own
// lib/industryPeers.ts KNOWN_SECTOR_PROFILES precedent. The 7 real,
// non-ETF names here use the exact same coarse GICS-style sector value
// Engine 1's own table already assigns to the same real companies
// (AAPL/MSFT/NVDA/GOOGL/META/AMZN/TSLA all also appear there) — reused,
// not independently re-classified — so a symbol's sector reads
// consistently across the whole platform. The 3 index ETFs are honestly
// labeled as ETFs, not assigned a fabricated GICS sector they don't
// belong to.
export const KNOWN_SECTOR_MAP: Record<string, string> = {
  SPY: "Index ETF (S&P 500)",
  QQQ: "Index ETF (Nasdaq-100)",
  IWM: "Index ETF (Russell 2000)",
  NVDA: "Technology",
  META: "Communication Services",
  AAPL: "Technology",
  AMZN: "Consumer Discretionary",
  MSFT: "Technology",
  GOOGL: "Communication Services",
  TSLA: "Consumer Discretionary",
};

const UNCLASSIFIED_SECTOR = "Unclassified";
const EQUITY_OPTION_ASSET_CLASS = "Equity Option";

// Named, disclosed thresholds — the same "state a reasonable default,
// disclose it" precedent already established by Position Sizing's
// BUYING_POWER_EXHAUSTION_THRESHOLD_PCT/MAX_LEVERAGE_RATIO, Trade
// Adjustment's ADJUSTMENT_LEVERAGE_RATIO, and Portfolio Stress Test's
// RISK_SCORE_CONCENTRATION_CAP_PCT. Concentration scoring itself uses
// the Herfindahl-Hirschman Index (HHI) — a standard, well-established
// concentration statistic (sum of squared bucket weights), not a
// fabricated proprietary formula.
export const CONCENTRATION_WELL_DIVERSIFIED_MAX = 30;
export const CONCENTRATION_MODERATE_MAX = 55;
export const CONCENTRATION_HIGH_MAX = 75;
export const SECTOR_CONCENTRATION_ADVISORY_THRESHOLD = 60;
// A directional bias is only assigned when a position's own net delta
// exceeds this small dead-band — avoids mislabeling a near-delta-neutral
// position as meaningfully bullish or bearish.
const DIRECTIONAL_BIAS_DELTA_THRESHOLD = 0.05;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ConcentrationBucket {
  key: string;
  label: string;
  positionCount: number;
  weightPct: number;
}

export interface ConcentrationBreakdown {
  dimension: string;
  buckets: ConcentrationBucket[];
  concentrationScore: number;
  largestBucket: ConcentrationBucket | null;
}

export interface LongShortExposure {
  longExposureDollars: number;
  shortExposureDollars: number;
  longPct: number;
  shortPct: number;
}

export interface CallPutExposure {
  callNotional: number;
  putNotional: number;
  callPct: number;
  putPct: number;
}

export interface PositionGreeksContribution {
  tradeId: number;
  symbol: string;
  strategy: string;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  deltaSharePct: number;
}

export interface ClusterGroup {
  dimension: string;
  key: string;
  label: string;
  tradeIds: number[];
  positionCount: number;
}

export interface DimensionScoreRef {
  dimension: string;
  label: string;
  concentrationScore: number;
}

export interface PortfolioSummaryHighlights {
  largestConcentration: { dimension: string; bucket: ConcentrationBucket } | null;
  highestDirectionalExposure: { direction: "long" | "short"; exposureDollars: number; pct: number } | null;
  highestGreeksContributor: { tradeId: number; symbol: string; delta: number } | null;
  mostDiversifiedArea: DimensionScoreRef | null;
  leastDiversifiedArea: DimensionScoreRef | null;
  concentrationScore: number;
  diversificationScore: number;
  portfolioHealthLabel: string;
}

export type RiskGuidanceCode = "well_diversified" | "moderate_concentration" | "high_concentration" | "review_exposure";

export interface RiskGuidanceAdvisory {
  code: string;
  label: string;
  detail: string;
}

export interface RiskGuidance {
  code: RiskGuidanceCode;
  label: string;
  advisories: RiskGuidanceAdvisory[];
}

export interface PortfolioConcentrationBreakdowns {
  symbol: ConcentrationBreakdown;
  underlying: ConcentrationBreakdown;
  sector: ConcentrationBreakdown;
  strategy: ConcentrationBreakdown;
  expiration: ConcentrationBreakdown;
  assetClass: ConcentrationBreakdown;
  directionalBias: ConcentrationBreakdown;
}

export interface PortfolioConcentrationResult {
  totalPositions: number;
  totalPortfolioValue: number;
  accountValue: number;
  netGreeks: PortfolioGreeksSnapshot;
  netBeta: null;
  netBetaUnavailableReason: string;
  netDirectionalExposure: {
    longExposureDollars: number;
    shortExposureDollars: number;
    netExposureDollars: number;
    netBiasLabel: "net_long" | "net_short" | "balanced";
  };
  breakdowns: PortfolioConcentrationBreakdowns;
  longShort: LongShortExposure;
  callPut: CallPutExposure;
  greeksContributions: PositionGreeksContribution[];
  clusters: ClusterGroup[];
  summary: PortfolioSummaryHighlights;
  riskGuidance: RiskGuidance;
  credentialsConfigured: boolean;
  brokerConnected: boolean | null;
  lastBrokerCheckAt: string | null;
  sectorDataSource: "KNOWN_UNIVERSE_METADATA";
  generatedAt: string;
}

function sectorFor(symbol: string): string {
  return KNOWN_SECTOR_MAP[symbol.toUpperCase()] ?? UNCLASSIFIED_SECTOR;
}

function directionalBiasFor(delta: number): "bullish" | "bearish" | "neutral" {
  if (delta > DIRECTIONAL_BIAS_DELTA_THRESHOLD) return "bullish";
  if (delta < -DIRECTIONAL_BIAS_DELTA_THRESHOLD) return "bearish";
  return "neutral";
}

function buildBreakdown(
  dimension: string,
  entries: { key: string; label: string; weightPct: number }[],
): ConcentrationBreakdown {
  const bucketMap = new Map<string, ConcentrationBucket>();
  for (const e of entries) {
    const existing = bucketMap.get(e.key);
    if (existing) {
      existing.positionCount += 1;
      existing.weightPct = round2(existing.weightPct + e.weightPct);
    } else {
      bucketMap.set(e.key, { key: e.key, label: e.label, positionCount: 1, weightPct: round2(e.weightPct) });
    }
  }
  const buckets = Array.from(bucketMap.values()).sort((a, b) => b.weightPct - a.weightPct);
  // Herfindahl-Hirschman Index: sum of squared bucket weight fractions
  // (0..1), a standard, well-established concentration statistic — never
  // a fabricated proprietary formula. Mapped onto a 0-100 "concentration
  // score" (100 = fully concentrated in one bucket).
  const hhi = buckets.reduce((sum, b) => sum + Math.pow(b.weightPct / 100, 2), 0);
  const concentrationScore = Math.round(Math.min(1, Math.max(0, hhi)) * 100);
  return { dimension, buckets, concentrationScore, largestBucket: buckets[0] ?? null };
}

interface PositionCompute {
  trade: TradeRow;
  weightPct: number;
  greeks: ReturnType<typeof computeTradeGreeks>;
  sector: string;
  bias: "bullish" | "bearish" | "neutral";
}

// `weightPct` here is each position's share of the PORTFOLIO'S OWN TOTAL
// DEPLOYED RISK (maxLoss ÷ Σ maxLoss across every open position) — the
// correct denominator for concentration bucketing (e.g. "80% of your
// deployed option risk sits in NVDA"). This is deliberately different
// from Position Sizing's/Portfolio Stress Test's own "portfolio weight"
// concept (maxLoss ÷ account value), which measures buying-power
// headroom, not concentration among the positions actually held — using
// account value here would make even a single, fully-concentrated
// position score as trivially low-concentration, an honest-but-wrong
// answer to a genuinely different question.
function computePositions(trades: TradeRow[], totalRiskDollars: number): PositionCompute[] {
  return trades.map((t) => {
    const greeks = computeTradeGreeks({ symbol: t.symbol, legs: t.legs, credit: t.credit, maxProfit: t.maxProfit });
    const weightPct = totalRiskDollars > 0 ? round2((Math.max(0, t.maxLoss) / totalRiskDollars) * 100) : 0;
    return { trade: t, weightPct, greeks, sector: sectorFor(t.symbol), bias: directionalBiasFor(greeks.delta) };
  });
}

function buildClusters(positions: PositionCompute[]): ClusterGroup[] {
  const clusters: ClusterGroup[] = [];
  const groupBy = (
    dimension: string,
    keyFn: (p: PositionCompute) => string,
    labelFn: (p: PositionCompute) => string,
  ) => {
    const map = new Map<string, { label: string; tradeIds: number[] }>();
    for (const p of positions) {
      const key = keyFn(p);
      const entry = map.get(key) ?? { label: labelFn(p), tradeIds: [] };
      entry.tradeIds.push(p.trade.id);
      map.set(key, entry);
    }
    for (const [key, v] of map.entries()) {
      if (v.tradeIds.length >= 2) {
        clusters.push({ dimension, key, label: v.label, tradeIds: v.tradeIds, positionCount: v.tradeIds.length });
      }
    }
  };

  groupBy("underlying", (p) => p.trade.symbol, (p) => p.trade.symbol);
  groupBy("sector", (p) => p.sector, (p) => p.sector);
  groupBy("strategy", (p) => p.trade.strategy, (p) => p.trade.strategy.replace(/_/g, " "));
  groupBy("expiration", (p) => p.trade.expiration ?? "unknown", (p) => p.trade.expiration ?? "Unknown expiration");
  groupBy("directional_bias", (p) => p.bias, (p) => p.bias);

  return clusters.sort((a, b) => b.positionCount - a.positionCount);
}

function buildCallPutExposure(positions: PositionCompute[]): CallPutExposure {
  let callNotional = 0;
  let putNotional = 0;
  for (const p of positions) {
    const legs = (p.trade.legs as StoredLeg[]) ?? [];
    for (const leg of legs) {
      const notional = leg.strike * 100 * leg.quantity;
      if (leg.optionType === "call") callNotional += notional;
      else putNotional += notional;
    }
  }
  const total = callNotional + putNotional;
  return {
    callNotional: round2(callNotional),
    putNotional: round2(putNotional),
    callPct: total > 0 ? round2((callNotional / total) * 100) : 0,
    putPct: total > 0 ? round2((putNotional / total) * 100) : 0,
  };
}

function buildGreeksContributions(positions: PositionCompute[]): PositionGreeksContribution[] {
  const totalAbsDelta = positions.reduce((sum, p) => sum + Math.abs(p.greeks.delta), 0);
  return positions
    .map((p) => ({
      tradeId: p.trade.id,
      symbol: p.trade.symbol,
      strategy: p.trade.strategy,
      delta: p.greeks.delta,
      gamma: p.greeks.gamma,
      theta: p.greeks.theta,
      vega: p.greeks.vega,
      deltaSharePct: totalAbsDelta > 0 ? round2((Math.abs(p.greeks.delta) / totalAbsDelta) * 100) : 0,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function guidanceFor(symbolScore: number, sectorScore: number): RiskGuidance {
  let code: RiskGuidanceCode;
  let label: string;
  if (symbolScore < CONCENTRATION_WELL_DIVERSIFIED_MAX) {
    code = "well_diversified";
    label = "Well Diversified";
  } else if (symbolScore < CONCENTRATION_MODERATE_MAX) {
    code = "moderate_concentration";
    label = "Moderate Concentration";
  } else if (symbolScore < CONCENTRATION_HIGH_MAX) {
    code = "high_concentration";
    label = "High Concentration";
  } else {
    code = "review_exposure";
    label = "Review Exposure";
  }
  const advisories: RiskGuidanceAdvisory[] = [];
  if (sectorScore >= SECTOR_CONCENTRATION_ADVISORY_THRESHOLD) {
    advisories.push({
      code: "monitor_sector_concentration",
      label: "Monitor Sector Concentration",
      detail: `The largest single sector accounts for a concentration score of ${sectorScore}/100 — consider whether this portfolio is more sector-concentrated than its symbol-level diversification alone suggests.`,
    });
  }
  return { code, label, advisories };
}

export async function buildPortfolioConcentrationOverlay(userId: string): Promise<PortfolioConcentrationResult> {
  const [trades, accountValue, settings] = await Promise.all([
    currentOpenTrades(userId),
    getAccountValue(userId),
    getSettingsRow(userId),
  ]);

  const credentialsConfigured = readAlpacaCreds(settings.alpacaApiKey) !== null;
  const brokerConnected = getLastBrokerCheckConnected();
  const lastBrokerCheckAt = getLastSuccessfulBrokerCheck();

  const structural = buildSnapshot(trades, accountValue);
  const positions = computePositions(trades, structural.totalRiskDollars);
  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.greeks.unrealizedPnl, 0);

  const symbolBreakdown = buildBreakdown(
    "symbol",
    positions.map((p) => ({ key: p.trade.symbol, label: p.trade.symbol, weightPct: p.weightPct })),
  );
  const sectorBreakdown = buildBreakdown(
    "sector",
    positions.map((p) => ({ key: p.sector, label: p.sector, weightPct: p.weightPct })),
  );
  const strategyBreakdown = buildBreakdown(
    "strategy",
    positions.map((p) => ({ key: p.trade.strategy, label: p.trade.strategy.replace(/_/g, " "), weightPct: p.weightPct })),
  );
  const expirationBreakdown = buildBreakdown(
    "expiration",
    positions.map((p) => ({
      key: p.trade.expiration ?? "unknown",
      label: p.trade.expiration ?? "Unknown expiration",
      weightPct: p.weightPct,
    })),
  );
  const assetClassBreakdown = buildBreakdown(
    "asset_class",
    positions.map((p) => ({ key: EQUITY_OPTION_ASSET_CLASS, label: EQUITY_OPTION_ASSET_CLASS, weightPct: p.weightPct })),
  );
  const directionalBiasBreakdown = buildBreakdown(
    "directional_bias",
    positions.map((p) => ({ key: p.bias, label: p.bias.charAt(0).toUpperCase() + p.bias.slice(1), weightPct: p.weightPct })),
  );

  const longShort: LongShortExposure = {
    longExposureDollars: structural.longExposureDollars,
    shortExposureDollars: structural.shortExposureDollars,
    longPct:
      structural.longExposureDollars + structural.shortExposureDollars > 0
        ? round2((structural.longExposureDollars / (structural.longExposureDollars + structural.shortExposureDollars)) * 100)
        : 0,
    shortPct:
      structural.longExposureDollars + structural.shortExposureDollars > 0
        ? round2((structural.shortExposureDollars / (structural.longExposureDollars + structural.shortExposureDollars)) * 100)
        : 0,
  };

  const netExposureDollars = round2(structural.shortExposureDollars - structural.longExposureDollars);
  const netBiasLabel: "net_long" | "net_short" | "balanced" =
    Math.abs(netExposureDollars) < 1 ? "balanced" : netExposureDollars > 0 ? "net_short" : "net_long";

  const callPut = buildCallPutExposure(positions);
  const greeksContributions = buildGreeksContributions(positions);
  const clusters = buildClusters(positions);

  const dimensionScores: DimensionScoreRef[] = [
    { dimension: "symbol", label: "Symbol", concentrationScore: symbolBreakdown.concentrationScore },
    { dimension: "sector", label: "Sector", concentrationScore: sectorBreakdown.concentrationScore },
    { dimension: "strategy", label: "Strategy", concentrationScore: strategyBreakdown.concentrationScore },
    { dimension: "expiration", label: "Expiration", concentrationScore: expirationBreakdown.concentrationScore },
    { dimension: "directional_bias", label: "Directional Bias", concentrationScore: directionalBiasBreakdown.concentrationScore },
  ];
  let mostDiversifiedArea: DimensionScoreRef | null = null;
  let leastDiversifiedArea: DimensionScoreRef | null = null;
  if (positions.length > 0) {
    mostDiversifiedArea = [...dimensionScores].sort((a, b) => a.concentrationScore - b.concentrationScore)[0];
    leastDiversifiedArea = [...dimensionScores].sort((a, b) => b.concentrationScore - a.concentrationScore)[0];
  }

  const largestConcentration =
    symbolBreakdown.largestBucket !== null ? { dimension: "symbol", bucket: symbolBreakdown.largestBucket } : null;

  const highestDirectionalExposure =
    positions.length > 0
      ? structural.shortExposureDollars >= structural.longExposureDollars
        ? { direction: "short" as const, exposureDollars: structural.shortExposureDollars, pct: longShort.shortPct }
        : { direction: "long" as const, exposureDollars: structural.longExposureDollars, pct: longShort.longPct }
      : null;

  const highestGreeksContributor =
    greeksContributions.length > 0
      ? { tradeId: greeksContributions[0].tradeId, symbol: greeksContributions[0].symbol, delta: greeksContributions[0].delta }
      : null;

  const concentrationScore = symbolBreakdown.concentrationScore;
  const diversificationScore = 100 - concentrationScore;
  const riskGuidance = guidanceFor(symbolBreakdown.concentrationScore, sectorBreakdown.concentrationScore);

  const summary: PortfolioSummaryHighlights = {
    largestConcentration,
    highestDirectionalExposure,
    highestGreeksContributor,
    mostDiversifiedArea,
    leastDiversifiedArea,
    concentrationScore,
    diversificationScore,
    portfolioHealthLabel: riskGuidance.label,
  };

  return {
    totalPositions: positions.length,
    totalPortfolioValue: round2(accountValue + totalUnrealizedPnl),
    accountValue,
    netGreeks: structural.greeks,
    netBeta: null,
    netBetaUnavailableReason:
      "No beta figure exists anywhere in this engine's own data model — never approximated. optionsMath.ts's UNIVERSE carries no beta field, and no live market-data feed is wired into this engine.",
    netDirectionalExposure: {
      longExposureDollars: structural.longExposureDollars,
      shortExposureDollars: structural.shortExposureDollars,
      netExposureDollars,
      netBiasLabel,
    },
    breakdowns: {
      symbol: symbolBreakdown,
      underlying: symbolBreakdown,
      sector: sectorBreakdown,
      strategy: strategyBreakdown,
      expiration: expirationBreakdown,
      assetClass: assetClassBreakdown,
      directionalBias: directionalBiasBreakdown,
    },
    longShort,
    callPut,
    greeksContributions,
    clusters,
    summary,
    riskGuidance,
    credentialsConfigured,
    brokerConnected,
    lastBrokerCheckAt,
    sectorDataSource: "KNOWN_UNIVERSE_METADATA",
    generatedAt: new Date().toISOString(),
  };
}

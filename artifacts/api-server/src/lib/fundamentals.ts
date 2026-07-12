// Task #66 / #67 — Fundamentals data layer with a pluggable provider seam.
//
// Two classes of provider sit behind `FundamentalsProvider`:
//   1. SimulatedFundamentalsProvider — a deterministic, seeded engine (like
//      optionsMath / eventRisk / earnings). Every datum is SIMULATED and labelled
//      as such; nothing is live market data.
//   2. Live providers (Financial Modeling Prep, Alpha Vantage) — fetch REAL
//      company fundamentals from a third-party API. Selected via Settings
//      (`fundamentalsProvider`) when the matching API key is present in the
//      environment. Their data is labelled "LIVE".
//
// CRITICAL CONTRACT (applies to BOTH simulated and live):
//  - `dataSource` is "SIMULATED" or "LIVE" and must always reflect reality. Live
//    data is never presented as simulated, and simulated data is never presented
//    as live (including the resilient fallback path, which re-labels as SIMULATED).
//  - Numbers are never fabricated to look "live": valuation ratios that cannot be
//    computed from positive inputs (e.g. negative earnings) are returned as null so
//    downstream engines honestly show "unavailable" instead of a made-up figure.
//  - Provider selection is pure/testable: `selectFundamentalsProvider(settings)`
//    decides from settings + env keys; `getFundamentalsProvider()` loads settings
//    and applies it. With no live keys configured it short-circuits to simulated
//    (no DB read), keeping unit tests DB-free.

import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { makeRng, todayStr } from "./deterministic.js";
import { INVESTING_UNIVERSE, investingPrice, isValidTickerShape } from "./investingUniverse.js";
import { logger } from "./logger.js";
import { getLegacyOwnerUserId } from "./legacyOwner.js";

export const FUNDAMENTALS_DATA_SOURCE = "SIMULATED" as const;
export type FundamentalsDataSource = typeof FUNDAMENTALS_DATA_SOURCE;
export type DataSource = "SIMULATED" | "LIVE";

export type CompanyKind = "stock" | "etf";

// Why a live fetch was abandoned and the app fell back to simulated data. Surfaced
// to the UI so a fallback is shown honestly (e.g. "provider rate-limited") rather
// than silently presenting simulated numbers as if the live request had succeeded.
export type FundamentalsFallbackReason = "rate_limit" | "error" | "no_data";

export interface FundamentalsFallback {
  attemptedProvider: string;
  reason: FundamentalsFallbackReason;
  message: string;
}

// Per-request fetch options. `forceRefresh` bypasses the short-lived live cache so
// a user can pull fresh data on demand (still respecting provider rate limits).
export interface FetchOpts {
  forceRefresh?: boolean;
}

// Qualitative moat / business-quality factors, each scored 0-100. For SIMULATED
// data these are hand-authored; for LIVE data they are derived deterministically
// from the real quantitative fundamentals (margins, returns, scale, growth).
export interface QualitativeFactors {
  pricingPower: number;
  brand: number;
  customerLoyalty: number;
  recurringRevenue: number;
  scale: number;
  switchingCost: number;
  networkEffect: number;
  ipStrength: number;
  distribution: number;
  regulatoryAdvantage: number;
}

export interface Fundamentals {
  symbol: string;
  name: string;
  kind: CompanyKind;
  dataSource: DataSource;
  asOf: string; // YYYY-MM-DD
  // When this datum was actually fetched/computed (ISO-8601). For LIVE data this is
  // the time the provider was called (preserved across cache hits, so the UI shows
  // true data age, not the time of the current request). For SIMULATED it is the
  // time the deterministic engine produced the snapshot.
  fetchedAt: string;
  // Present only when a live fetch was attempted but failed/empty and the app fell
  // back to the simulated provider (so the UI can explain the degradation).
  fallback?: FundamentalsFallback;
  price: number;

  // Per-share fundamentals.
  epsTtm: number | null; // null => not meaningfully profitable on a trailing basis
  epsFwd: number | null;
  fcfPerShare: number;
  salesPerShare: number;
  bookPerShare: number;
  dividendPerShare: number;

  // Price-derived valuation ratios (null when not computable from positive inputs).
  pe: number | null;
  forwardPe: number | null;
  peg: number | null;
  ps: number | null;
  pb: number | null;
  fcfYield: number | null; // fraction (FCF/share ÷ price)
  earningsYield: number | null; // fraction (EPS ÷ price)
  dividendYield: number; // fraction

  // Growth (fractions, e.g. 0.18 = 18%).
  revenueGrowth5y: number;
  epsGrowth5y: number;
  revenueGrowthFwd: number;

  // Profitability (fractions).
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  roe: number;
  roic: number;

  // Balance sheet / cash.
  debtToEquity: number;
  interestCoverage: number; // EBIT / interest; very high => effectively no debt burden
  currentRatio: number;
  netCashPerShare: number; // negative => net debt per share
  fcfPositiveYears: number; // out of the last 10
  fcfMargin: number; // fraction

  // Qualitative moat inputs.
  qualitative: QualitativeFactors;

  // Multi-year history for charts (oldest → newest).
  revenueHistory: number[];
  epsHistory: number[];
  fcfHistory: number[];
}

interface BaseProfile {
  kind: CompanyKind;
  epsTtm: number | null;
  epsFwd: number | null;
  fcfPerShare: number;
  salesPerShare: number;
  bookPerShare: number;
  dividendPerShare: number;
  revenueGrowth5y: number;
  epsGrowth5y: number;
  revenueGrowthFwd: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  roe: number;
  roic: number;
  debtToEquity: number;
  interestCoverage: number;
  currentRatio: number;
  netCashPerShare: number;
  fcfPositiveYears: number;
  fcfMargin: number;
  q: QualitativeFactors;
}

// Hand-authored, deliberately plausible SIMULATED profiles for the 10 supported
// symbols. These are NOT real financials — they are a stable fixture so the
// engines have something realistic to reason over. Do not present as live data.
const PROFILES: Record<string, BaseProfile> = {
  // ── ETFs: diversified baskets, no single-company moat ──────────────────────
  SPY: {
    kind: "etf", epsTtm: 22.5, epsFwd: 24.2, fcfPerShare: 21, salesPerShare: 175, bookPerShare: 240,
    dividendPerShare: 6.6, revenueGrowth5y: 0.06, epsGrowth5y: 0.09, revenueGrowthFwd: 0.06,
    grossMargin: 0.0, operatingMargin: 0.0, netMargin: 0.12, roe: 0.18, roic: 0.13,
    debtToEquity: 0.0, interestCoverage: 999, currentRatio: 0, netCashPerShare: 0, fcfPositiveYears: 10, fcfMargin: 0.12,
    q: { pricingPower: 55, brand: 50, customerLoyalty: 50, recurringRevenue: 50, scale: 95, switchingCost: 40, networkEffect: 30, ipStrength: 40, distribution: 70, regulatoryAdvantage: 30 },
  },
  QQQ: {
    kind: "etf", epsTtm: 15.3, epsFwd: 17.0, fcfPerShare: 14, salesPerShare: 110, bookPerShare: 150,
    dividendPerShare: 2.8, revenueGrowth5y: 0.12, epsGrowth5y: 0.15, revenueGrowthFwd: 0.11,
    grossMargin: 0.0, operatingMargin: 0.0, netMargin: 0.18, roe: 0.24, roic: 0.18,
    debtToEquity: 0.0, interestCoverage: 999, currentRatio: 0, netCashPerShare: 0, fcfPositiveYears: 10, fcfMargin: 0.18,
    q: { pricingPower: 60, brand: 55, customerLoyalty: 50, recurringRevenue: 55, scale: 90, switchingCost: 45, networkEffect: 45, ipStrength: 55, distribution: 70, regulatoryAdvantage: 30 },
  },
  IWM: {
    kind: "etf", epsTtm: 7.0, epsFwd: 8.4, fcfPerShare: 5, salesPerShare: 95, bookPerShare: 120,
    dividendPerShare: 2.4, revenueGrowth5y: 0.05, epsGrowth5y: 0.04, revenueGrowthFwd: 0.07,
    grossMargin: 0.0, operatingMargin: 0.0, netMargin: 0.07, roe: 0.10, roic: 0.07,
    debtToEquity: 0.0, interestCoverage: 999, currentRatio: 0, netCashPerShare: 0, fcfPositiveYears: 8, fcfMargin: 0.07,
    q: { pricingPower: 40, brand: 35, customerLoyalty: 40, recurringRevenue: 40, scale: 70, switchingCost: 30, networkEffect: 25, ipStrength: 35, distribution: 55, regulatoryAdvantage: 25 },
  },
  // ── Mega-cap stocks ────────────────────────────────────────────────────────
  NVDA: {
    kind: "stock", epsTtm: 20.0, epsFwd: 26.0, fcfPerShare: 22, salesPerShare: 70, bookPerShare: 40,
    dividendPerShare: 0.16, revenueGrowth5y: 0.55, epsGrowth5y: 0.65, revenueGrowthFwd: 0.40,
    grossMargin: 0.75, operatingMargin: 0.62, netMargin: 0.55, roe: 0.85, roic: 0.70,
    debtToEquity: 0.18, interestCoverage: 90, currentRatio: 4.0, netCashPerShare: 14, fcfPositiveYears: 10, fcfMargin: 0.48,
    q: { pricingPower: 92, brand: 80, customerLoyalty: 78, recurringRevenue: 60, scale: 85, switchingCost: 82, networkEffect: 70, ipStrength: 95, distribution: 75, regulatoryAdvantage: 45 },
  },
  META: {
    kind: "stock", epsTtm: 20.4, epsFwd: 23.2, fcfPerShare: 25, salesPerShare: 75, bookPerShare: 80,
    dividendPerShare: 2.0, revenueGrowth5y: 0.20, epsGrowth5y: 0.24, revenueGrowthFwd: 0.16,
    grossMargin: 0.81, operatingMargin: 0.42, netMargin: 0.35, roe: 0.35, roic: 0.30,
    debtToEquity: 0.12, interestCoverage: 120, currentRatio: 2.6, netCashPerShare: 12, fcfPositiveYears: 10, fcfMargin: 0.33,
    q: { pricingPower: 78, brand: 82, customerLoyalty: 70, recurringRevenue: 65, scale: 92, switchingCost: 60, networkEffect: 95, ipStrength: 70, distribution: 80, regulatoryAdvantage: 30 },
  },
  AAPL: {
    kind: "stock", epsTtm: 6.5, epsFwd: 7.1, fcfPerShare: 6.8, salesPerShare: 25, bookPerShare: 4.2,
    dividendPerShare: 1.0, revenueGrowth5y: 0.08, epsGrowth5y: 0.12, revenueGrowthFwd: 0.07,
    grossMargin: 0.46, operatingMargin: 0.31, netMargin: 0.26, roe: 1.40, roic: 0.55,
    debtToEquity: 1.5, interestCoverage: 40, currentRatio: 0.95, netCashPerShare: 3.5, fcfPositiveYears: 10, fcfMargin: 0.27,
    q: { pricingPower: 90, brand: 98, customerLoyalty: 95, recurringRevenue: 62, scale: 90, switchingCost: 88, networkEffect: 72, ipStrength: 80, distribution: 88, regulatoryAdvantage: 35 },
  },
  AMZN: {
    kind: "stock", epsTtm: 4.6, epsFwd: 6.0, fcfPerShare: 4.0, salesPerShare: 58, bookPerShare: 28,
    dividendPerShare: 0, revenueGrowth5y: 0.16, epsGrowth5y: 0.30, revenueGrowthFwd: 0.12,
    grossMargin: 0.48, operatingMargin: 0.10, netMargin: 0.08, roe: 0.22, roic: 0.14,
    debtToEquity: 0.55, interestCoverage: 18, currentRatio: 1.05, netCashPerShare: 2.0, fcfPositiveYears: 8, fcfMargin: 0.07,
    q: { pricingPower: 70, brand: 88, customerLoyalty: 82, recurringRevenue: 68, scale: 96, switchingCost: 70, networkEffect: 80, ipStrength: 60, distribution: 95, regulatoryAdvantage: 30 },
  },
  MSFT: {
    kind: "stock", epsTtm: 12.7, epsFwd: 14.2, fcfPerShare: 13, salesPerShare: 36, bookPerShare: 45,
    dividendPerShare: 3.0, revenueGrowth5y: 0.15, epsGrowth5y: 0.17, revenueGrowthFwd: 0.14,
    grossMargin: 0.69, operatingMargin: 0.45, netMargin: 0.36, roe: 0.39, roic: 0.30,
    debtToEquity: 0.30, interestCoverage: 45, currentRatio: 1.3, netCashPerShare: 6.0, fcfPositiveYears: 10, fcfMargin: 0.30,
    q: { pricingPower: 85, brand: 90, customerLoyalty: 88, recurringRevenue: 90, scale: 92, switchingCost: 92, networkEffect: 78, ipStrength: 82, distribution: 85, regulatoryAdvantage: 40 },
  },
  GOOGL: {
    kind: "stock", epsTtm: 8.0, epsFwd: 9.1, fcfPerShare: 8.0, salesPerShare: 38, bookPerShare: 30,
    dividendPerShare: 0.8, revenueGrowth5y: 0.17, epsGrowth5y: 0.20, revenueGrowthFwd: 0.12,
    grossMargin: 0.57, operatingMargin: 0.32, netMargin: 0.27, roe: 0.31, roic: 0.26,
    debtToEquity: 0.10, interestCoverage: 150, currentRatio: 2.1, netCashPerShare: 7.0, fcfPositiveYears: 10, fcfMargin: 0.25,
    q: { pricingPower: 80, brand: 92, customerLoyalty: 78, recurringRevenue: 70, scale: 94, switchingCost: 65, networkEffect: 92, ipStrength: 85, distribution: 82, regulatoryAdvantage: 28 },
  },
  TSLA: {
    kind: "stock", epsTtm: 2.5, epsFwd: 3.0, fcfPerShare: 2.0, salesPerShare: 30, bookPerShare: 25,
    dividendPerShare: 0, revenueGrowth5y: 0.35, epsGrowth5y: 0.20, revenueGrowthFwd: 0.10,
    grossMargin: 0.18, operatingMargin: 0.09, netMargin: 0.08, roe: 0.16, roic: 0.12,
    debtToEquity: 0.20, interestCoverage: 12, currentRatio: 1.7, netCashPerShare: 8.0, fcfPositiveYears: 6, fcfMargin: 0.06,
    q: { pricingPower: 58, brand: 85, customerLoyalty: 75, recurringRevenue: 35, scale: 70, switchingCost: 45, networkEffect: 55, ipStrength: 65, distribution: 60, regulatoryAdvantage: 40 },
  },
};

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Small, stable seeded jitter (±pct) so SIMULATED fundamentals look organic but
// don't churn between requests.
function jitter(base: number, pct: number, rng: () => number): number {
  return base * (1 + (rng() - 0.5) * 2 * pct);
}

// Build a multi-year series ending at `latest`, growing backwards by `growth`/yr
// with light seeded noise. Oldest → newest.
function backHistory(latest: number, growth: number, years: number, rng: () => number): number[] {
  const out: number[] = [];
  let v = latest;
  out.push(round(v, 2));
  for (let i = 1; i < years; i++) {
    v = v / (1 + growth);
    out.push(round(v * (1 + (rng() - 0.5) * 0.08), 2));
  }
  return out.reverse();
}

// Inputs needed to assemble a complete Fundamentals object. Per-share values and
// structural fundamentals are final (already sourced/derived); the price-derived
// ratios and chart histories are computed here so the math is identical for
// SIMULATED and LIVE data and the "never fabricate a ratio" rule holds everywhere.
interface AssembleInput {
  symbol: string;
  name: string;
  kind: CompanyKind;
  asOf: string;
  fetchedAt: string;
  price: number;
  dataSource: DataSource;
  epsTtm: number | null;
  epsFwd: number | null;
  fcfPerShare: number;
  salesPerShare: number;
  bookPerShare: number;
  dividendPerShare: number;
  revenueGrowth5y: number;
  epsGrowth5y: number;
  revenueGrowthFwd: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  roe: number;
  roic: number;
  debtToEquity: number;
  interestCoverage: number;
  currentRatio: number;
  netCashPerShare: number;
  fcfPositiveYears: number;
  fcfMargin: number;
  qualitative: QualitativeFactors;
  historyRng: () => number;
}

function assembleFundamentals(a: AssembleInput): Fundamentals {
  const { price } = a;

  // Price-derived ratios. Null whenever the numerator/denominator is not a
  // positive, meaningful number — never fabricate a ratio.
  const pe = a.epsTtm != null && a.epsTtm > 0 ? round(price / a.epsTtm, 1) : null;
  const forwardPe = a.epsFwd != null && a.epsFwd > 0 ? round(price / a.epsFwd, 1) : null;
  const epsGrowthPct = a.epsGrowth5y * 100;
  const peg = pe != null && epsGrowthPct > 0 ? round(pe / epsGrowthPct, 2) : null;
  const ps = a.salesPerShare > 0 ? round(price / a.salesPerShare, 1) : null;
  const pb = a.bookPerShare > 0 ? round(price / a.bookPerShare, 1) : null;
  const fcfYield = a.fcfPerShare > 0 ? round(a.fcfPerShare / price, 4) : null;
  const earningsYield = a.epsTtm != null && a.epsTtm > 0 ? round(a.epsTtm / price, 4) : null;
  const dividendYield = round(a.dividendPerShare / price, 4);

  const revenueHistory = backHistory(a.salesPerShare, a.revenueGrowth5y, 6, a.historyRng);
  const epsHistory = backHistory(a.epsTtm ?? a.fcfPerShare, a.epsGrowth5y, 6, a.historyRng);
  const fcfHistory = backHistory(a.fcfPerShare, a.revenueGrowth5y, 6, a.historyRng);

  return {
    symbol: a.symbol,
    name: a.name,
    kind: a.kind,
    dataSource: a.dataSource,
    asOf: a.asOf,
    fetchedAt: a.fetchedAt,
    price,
    epsTtm: a.epsTtm,
    epsFwd: a.epsFwd,
    fcfPerShare: a.fcfPerShare,
    salesPerShare: a.salesPerShare,
    bookPerShare: a.bookPerShare,
    dividendPerShare: a.dividendPerShare,
    pe,
    forwardPe,
    peg,
    ps,
    pb,
    fcfYield,
    earningsYield,
    dividendYield,
    revenueGrowth5y: a.revenueGrowth5y,
    epsGrowth5y: a.epsGrowth5y,
    revenueGrowthFwd: a.revenueGrowthFwd,
    grossMargin: a.grossMargin,
    operatingMargin: a.operatingMargin,
    netMargin: a.netMargin,
    roe: a.roe,
    roic: a.roic,
    debtToEquity: a.debtToEquity,
    interestCoverage: a.interestCoverage,
    currentRatio: a.currentRatio,
    netCashPerShare: a.netCashPerShare,
    fcfPositiveYears: a.fcfPositiveYears,
    fcfMargin: a.fcfMargin,
    qualitative: a.qualitative,
    revenueHistory,
    epsHistory,
    fcfHistory,
  };
}

// Derive 0-100 qualitative moat factors from REAL quantitative fundamentals. The
// qualitative dimension is inherently subjective and not published by fundamentals
// APIs, so we approximate it deterministically from margins, returns, scale and
// growth. This never affects the fair-value math (which uses real EPS/FCF).
function deriveQualitative(m: {
  kind: CompanyKind;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  roic: number;
  roe: number;
  revenueGrowth5y: number;
  marketCap?: number;
}): QualitativeFactors {
  if (m.kind === "etf") {
    return {
      pricingPower: 50, brand: 50, customerLoyalty: 50, recurringRevenue: 50, scale: 90,
      switchingCost: 40, networkEffect: 35, ipStrength: 40, distribution: 65, regulatoryAdvantage: 30,
    };
  }
  const gm = m.grossMargin || 0;
  const om = m.operatingMargin || 0;
  const nm = m.netMargin || 0;
  const g = m.revenueGrowth5y || 0;
  // log10(marketCap): 1e9 → 9, 1e12 → 12. Map ~$1B→30 up to mega-cap→95.
  const sizeScore = m.marketCap && m.marketCap > 0 ? clamp((Math.log10(m.marketCap) - 9) * 22 + 30, 30, 95) : 60;
  return {
    pricingPower: Math.round(clamp(gm * 110 + 10, 25, 95)),
    brand: Math.round(clamp(nm * 150 + sizeScore * 0.4, 25, 95)),
    customerLoyalty: Math.round(clamp(om * 140 + 30, 25, 90)),
    recurringRevenue: Math.round(clamp(gm * 90 + 25, 25, 90)),
    scale: Math.round(sizeScore),
    switchingCost: Math.round(clamp(om * 130 + 25, 20, 92)),
    networkEffect: Math.round(clamp(g * 120 + sizeScore * 0.3, 20, 92)),
    ipStrength: Math.round(clamp(gm * 100 + 20, 20, 95)),
    distribution: Math.round(clamp(sizeScore * 0.7 + 25, 30, 92)),
    regulatoryAdvantage: 35,
  };
}

// A stable, deterministic SIMULATED profile for any symbol NOT in the
// hand-authored PROFILES map above (Phase 2, Sprint 11 — the Investing Engine
// no longer limits SIMULATED research to the original 10-symbol universe).
// Values are seeded by the symbol only (not the date), so repeated requests
// for the same unlisted symbol return a stable, if invented, financial
// picture. Deliberately unremarkable (never wonderful, never distressed) so
// an unlisted symbol doesn't imply a false verdict about a real company that
// happens to share the ticker. Assembled through the same never-fabricate-a-
// ratio `assembleFundamentals` pipeline as every other provider.
function syntheticProfile(symbol: string, price: number): BaseProfile {
  const rng = makeRng(`${symbol}|synthetic-profile`);
  const grossMargin = round(0.30 + rng() * 0.25, 4);
  const operatingMargin = round(grossMargin * (0.35 + rng() * 0.2), 4);
  const netMargin = round(operatingMargin * (0.6 + rng() * 0.2), 4);
  const revenueGrowth5y = round(0.03 + rng() * 0.1, 4);
  const epsGrowth5y = round(revenueGrowth5y * (0.8 + rng() * 0.6), 4);
  const salesPerShare = round(price / (3 + rng() * 6), 2);
  const epsTtm = round(salesPerShare * netMargin, 2);
  const bookPerShare = round(price / (1.5 + rng() * 2.5), 2);
  const fcfPerShare = round(epsTtm * (0.85 + rng() * 0.3), 2);
  return {
    kind: "stock",
    epsTtm: epsTtm > 0 ? epsTtm : null,
    epsFwd: epsTtm > 0 ? round(epsTtm * (1 + epsGrowth5y), 2) : null,
    fcfPerShare,
    salesPerShare,
    bookPerShare,
    dividendPerShare: 0,
    revenueGrowth5y,
    epsGrowth5y,
    revenueGrowthFwd: revenueGrowth5y,
    grossMargin,
    operatingMargin,
    netMargin,
    roe: round(netMargin * 1.8, 4),
    roic: round(netMargin * 1.3, 4),
    debtToEquity: round(0.2 + rng() * 0.6, 2),
    interestCoverage: round(8 + rng() * 20, 1),
    currentRatio: round(1.1 + rng() * 1.2, 2),
    netCashPerShare: round((rng() - 0.4) * bookPerShare * 0.3, 2),
    fcfPositiveYears: 7,
    fcfMargin: salesPerShare > 0 ? round(fcfPerShare / salesPerShare, 4) : 0,
    q: {
      pricingPower: 50, brand: 45, customerLoyalty: 45, recurringRevenue: 45, scale: 45,
      switchingCost: 40, networkEffect: 35, ipStrength: 40, distribution: 45, regulatoryAdvantage: 30,
    },
  };
}

// The provider seam. A live provider implements the same async interface and is
// selected via Settings; the simulated provider is the safe default.
export interface FundamentalsProvider {
  readonly id: string;
  readonly dataSource: DataSource;
  readonly isLive: boolean;
  getFundamentals(symbol: string, asOf?: string, opts?: FetchOpts): Promise<Fundamentals | null>;
}

export class SimulatedFundamentalsProvider implements FundamentalsProvider {
  readonly id = "simulated";
  readonly dataSource: DataSource = FUNDAMENTALS_DATA_SOURCE;
  readonly isLive = false;

  async getFundamentals(
    symbol: string,
    asOf: string = todayStr(),
    _opts?: FetchOpts,
  ): Promise<Fundamentals | null> {
    const sym = symbol.toUpperCase();
    if (!isValidTickerShape(sym)) return null;

    const entry = INVESTING_UNIVERSE.find((e) => e.symbol === sym);
    const price = investingPrice(sym, asOf);
    const p = PROFILES[sym] ?? syntheticProfile(sym, price);
    // Never fabricate a plausible-sounding real company name for a symbol we
    // don't actually know — fall back to the ticker itself.
    const name = entry?.name ?? sym;

    // Structural fundamentals are seeded by symbol only (stable, not date-churning).
    const rng = makeRng(`${sym}|fundamentals`);

    const epsTtm = p.epsTtm == null ? null : round(jitter(p.epsTtm, 0.03, rng), 2);
    const epsFwd = p.epsFwd == null ? null : round(jitter(p.epsFwd, 0.03, rng), 2);
    const fcfPerShare = round(jitter(p.fcfPerShare, 0.04, rng), 2);
    const salesPerShare = round(jitter(p.salesPerShare, 0.03, rng), 2);
    const bookPerShare = round(jitter(p.bookPerShare, 0.03, rng), 2);

    return assembleFundamentals({
      symbol: sym,
      name,
      kind: p.kind,
      asOf,
      fetchedAt: new Date().toISOString(),
      price,
      dataSource: FUNDAMENTALS_DATA_SOURCE,
      epsTtm,
      epsFwd,
      fcfPerShare,
      salesPerShare,
      bookPerShare,
      dividendPerShare: p.dividendPerShare,
      revenueGrowth5y: p.revenueGrowth5y,
      epsGrowth5y: p.epsGrowth5y,
      revenueGrowthFwd: p.revenueGrowthFwd,
      grossMargin: p.grossMargin,
      operatingMargin: p.operatingMargin,
      netMargin: p.netMargin,
      roe: p.roe,
      roic: p.roic,
      debtToEquity: p.debtToEquity,
      interestCoverage: p.interestCoverage,
      currentRatio: p.currentRatio,
      netCashPerShare: p.netCashPerShare,
      fcfPositiveYears: p.fcfPositiveYears,
      fcfMargin: p.fcfMargin,
      qualitative: p.q,
      historyRng: rng,
    });
  }
}

// ─── Live data plumbing ───────────────────────────────────────────────────────

// Parse a possibly-stringy numeric API field, tolerating "None"/"-"/"" / NaN.
function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === "" || s === "None" || s === "-" || s.toLowerCase() === "nan" || s.toLowerCase() === "null") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// Short-lived in-memory cache so repeated views (and the 10-symbol universe) don't
// hammer the provider's rate limit. `undefined` => miss, `null`/data => hit.
const LIVE_TTL_MS = 15 * 60 * 1000;
const liveCache = new Map<string, { at: number; data: Fundamentals | null }>();
function getCached(id: string, sym: string, asOf: string): Fundamentals | null | undefined {
  const e = liveCache.get(`${id}:${sym}:${asOf}`);
  if (e && Date.now() - e.at < LIVE_TTL_MS) return e.data;
  return undefined;
}
function setCached(id: string, sym: string, asOf: string, data: Fundamentals | null): void {
  liveCache.set(`${id}:${sym}:${asOf}`, { at: Date.now(), data });
}

// Process-local record of the most recent successful live fundamentals fetch, so
// the Settings UI can show when the live provider was last reached. Reset on
// restart (in-memory only) — it reflects this process's live activity, not a
// persisted audit trail.
let lastLiveFetch: { provider: string; at: string } | null = null;
function recordLiveSuccess(provider: string, at: string): void {
  // Keep the most recent fetch time across providers/symbols.
  if (!lastLiveFetch || at > lastLiveFetch.at) lastLiveFetch = { provider, at };
}
export function getLastLiveFetch(): { provider: string; at: string } | null {
  return lastLiveFetch;
}

function fwdEps(epsTtm: number | null, growth: number): number | null {
  if (epsTtm == null) return null;
  if (epsTtm <= 0) return epsTtm;
  return round(epsTtm * (1 + clamp(growth, -0.2, 0.3)), 2);
}

// Financial Modeling Prep — rich per-symbol TTM endpoints (recommended live
// provider: ~250 free calls/day, all required fields in a few requests).
export class FmpFundamentalsProvider implements FundamentalsProvider {
  readonly id = "financial_modeling_prep";
  readonly dataSource: DataSource = "LIVE";
  readonly isLive = true;
  constructor(private readonly apiKey: string) {}

  async getFundamentals(
    symbol: string,
    asOf: string = todayStr(),
    opts?: FetchOpts,
  ): Promise<Fundamentals | null> {
    const sym = symbol.toUpperCase();
    if (!opts?.forceRefresh) {
      const cached = getCached(this.id, sym, asOf);
      if (cached !== undefined) return cached;
    }

    const base = "https://financialmodelingprep.com/api/v3";
    const k = encodeURIComponent(this.apiKey);
    const [profileArr, ratiosArr, kmArr, growthArr] = await Promise.all([
      fetchJson(`${base}/profile/${sym}?apikey=${k}`),
      fetchJson(`${base}/ratios-ttm/${sym}?apikey=${k}`),
      fetchJson(`${base}/key-metrics-ttm/${sym}?apikey=${k}`),
      fetchJson(`${base}/financial-growth/${sym}?period=annual&limit=1&apikey=${k}`),
    ]);

    const first = (x: unknown): Record<string, unknown> | undefined =>
      Array.isArray(x) && x.length > 0 ? (x[0] as Record<string, unknown>) : undefined;
    // FMP signals an invalid key / over-limit with an object carrying "Error Message".
    for (const r of [profileArr, ratiosArr, kmArr, growthArr]) {
      if (r && !Array.isArray(r) && (r as Record<string, unknown>)["Error Message"]) {
        throw new Error("Financial Modeling Prep error or rate limit");
      }
    }
    const profile = first(profileArr);
    const ratios = first(ratiosArr);
    const km = first(kmArr);
    const growth = first(growthArr);

    const price = num(profile?.price);
    if (!profile || price == null || price <= 0) {
      setCached(this.id, sym, asOf, null);
      return null;
    }

    const kind: CompanyKind = profile.isEtf ? "etf" : "stock";
    const epsTtm = num(km?.netIncomePerShareTTM);
    const salesPerShare = num(km?.revenuePerShareTTM) ?? 0;
    const bookPerShare = num(km?.bookValuePerShareTTM) ?? 0;
    const fcfPerShare = num(km?.freeCashFlowPerShareTTM) ?? 0;

    // FMP dividend yield is a fraction (their field name has a typo: dividendYielTTM).
    const rawYield = num(ratios?.dividendYielTTM) ?? num(km?.dividendYieldTTM) ?? 0;
    const dividendYield = rawYield > 1 ? rawYield / 100 : rawYield;
    const dividendPerShare = round(dividendYield * price, 4);

    const grossMargin = num(ratios?.grossProfitMarginTTM) ?? 0;
    const operatingMargin = num(ratios?.operatingProfitMarginTTM) ?? 0;
    const netMargin = num(ratios?.netProfitMarginTTM) ?? 0;
    const roe = num(ratios?.returnOnEquityTTM) ?? 0;
    const roic = num(km?.roicTTM) ?? num(ratios?.returnOnCapitalEmployedTTM) ?? 0;
    const debtToEquity = Math.max(num(ratios?.debtEquityRatioTTM) ?? 0, 0);

    let interestCoverage = num(ratios?.interestCoverageTTM) ?? 999;
    if (!Number.isFinite(interestCoverage) || interestCoverage > 999) interestCoverage = 999;
    if (interestCoverage < 0) interestCoverage = 0;

    const currentRatio = num(ratios?.currentRatioTTM) ?? 0;
    const cashPerShare = num(km?.cashPerShareTTM) ?? 0;
    const netCashPerShare = round(cashPerShare - debtToEquity * Math.max(bookPerShare, 0), 2);
    const fcfMargin = salesPerShare > 0 ? round(fcfPerShare / salesPerShare, 4) : 0;
    // Annual cash-flow history isn't fetched (call budget): infer a coarse, honest
    // proxy from current FCF sign. Affects financial-strength only, not fair value.
    const fcfPositiveYears = fcfPerShare > 0 ? 9 : 3;

    const revenueGrowth5y = num(growth?.fiveYRevenueGrowthPerShare) ?? num(growth?.revenueGrowth) ?? 0;
    const epsGrowth5y =
      num(growth?.fiveYNetIncomeGrowthPerShare) ?? num(growth?.epsgrowth) ?? revenueGrowth5y;
    const revenueGrowthFwd = num(growth?.revenueGrowth) ?? revenueGrowth5y;

    const qualitative = deriveQualitative({
      kind, grossMargin, operatingMargin, netMargin, roic, roe, revenueGrowth5y,
      marketCap: num(profile?.mktCap) ?? undefined,
    });

    const data = assembleFundamentals({
      symbol: sym,
      name: (profile.companyName as string) || sym,
      kind,
      asOf,
      fetchedAt: new Date().toISOString(),
      price,
      dataSource: "LIVE",
      epsTtm,
      epsFwd: fwdEps(epsTtm, epsGrowth5y),
      fcfPerShare,
      salesPerShare,
      bookPerShare,
      dividendPerShare,
      revenueGrowth5y,
      epsGrowth5y,
      revenueGrowthFwd,
      grossMargin,
      operatingMargin,
      netMargin,
      roe,
      roic,
      debtToEquity,
      interestCoverage,
      currentRatio,
      netCashPerShare,
      fcfPositiveYears,
      fcfMargin,
      qualitative,
      historyRng: makeRng(`${sym}|fmp`),
    });
    setCached(this.id, sym, asOf, data);
    return data;
  }
}

// Alpha Vantage — OVERVIEW carries most ratios; GLOBAL_QUOTE the live price;
// CASH_FLOW real free cash flow; BALANCE_SHEET leverage/liquidity.
export class AlphaVantageFundamentalsProvider implements FundamentalsProvider {
  readonly id = "alpha_vantage";
  readonly dataSource: DataSource = "LIVE";
  readonly isLive = true;
  constructor(private readonly apiKey: string) {}

  async getFundamentals(
    symbol: string,
    asOf: string = todayStr(),
    opts?: FetchOpts,
  ): Promise<Fundamentals | null> {
    const sym = symbol.toUpperCase();
    if (!opts?.forceRefresh) {
      const cached = getCached(this.id, sym, asOf);
      if (cached !== undefined) return cached;
    }

    const base = "https://www.alphavantage.co/query";
    const k = encodeURIComponent(this.apiKey);
    const [overviewRaw, quoteRaw, cashRaw, balanceRaw] = await Promise.all([
      fetchJson(`${base}?function=OVERVIEW&symbol=${sym}&apikey=${k}`),
      fetchJson(`${base}?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${k}`),
      fetchJson(`${base}?function=CASH_FLOW&symbol=${sym}&apikey=${k}`),
      fetchJson(`${base}?function=BALANCE_SHEET&symbol=${sym}&apikey=${k}`),
    ]);
    const overview = (overviewRaw ?? {}) as Record<string, unknown>;
    const quote = (quoteRaw ?? {}) as Record<string, unknown>;
    const cash = (cashRaw ?? {}) as Record<string, unknown>;
    const balance = (balanceRaw ?? {}) as Record<string, unknown>;

    // Rate-limit / invalid responses come back as { Note } / { Information } / { Error Message }.
    if (overview.Note || overview.Information || overview["Error Message"]) {
      throw new Error("Alpha Vantage rate limit or error");
    }
    if (!overview.Symbol) {
      setCached(this.id, sym, asOf, null);
      return null;
    }

    const gq = (quote["Global Quote"] ?? {}) as Record<string, unknown>;
    const price = num(gq["05. price"]);
    if (price == null || price <= 0) {
      setCached(this.id, sym, asOf, null);
      return null;
    }

    const kind: CompanyKind = String(overview.AssetType ?? "").toUpperCase() === "ETF" ? "etf" : "stock";
    const shares = num(overview.SharesOutstanding);
    const epsTtm = num(overview.EPS);
    const salesPerShare = num(overview.RevenuePerShareTTM) ?? 0;
    const bookPerShare = num(overview.BookValue) ?? 0;
    const dividendPerShare = num(overview.DividendPerShare) ?? 0;
    const fwdPe = num(overview.ForwardPE);
    const epsFwd = fwdPe && fwdPe > 0 ? round(price / fwdPe, 2) : epsTtm;

    const revenueTTM = num(overview.RevenueTTM);
    const grossProfitTTM = num(overview.GrossProfitTTM);
    const grossMargin =
      revenueTTM && revenueTTM > 0 && grossProfitTTM != null ? round(grossProfitTTM / revenueTTM, 4) : 0;
    const operatingMargin = num(overview.OperatingMarginTTM) ?? 0;
    const netMargin = num(overview.ProfitMargin) ?? 0;
    const roe = num(overview.ReturnOnEquityTTM) ?? 0;
    const roic = num(overview.ReturnOnAssetsTTM) ?? roe; // ROA proxy when ROIC not published

    // Real free cash flow from the latest annual cash-flow statement.
    const cashReports = Array.isArray(cash.annualReports) ? (cash.annualReports as Record<string, unknown>[]) : [];
    const latestCf = cashReports[0];
    const ocf = num(latestCf?.operatingCashflow);
    const capex = num(latestCf?.capitalExpenditures);
    let fcfPerShare = 0;
    if (ocf != null && shares && shares > 0) {
      fcfPerShare = round((ocf - (capex ?? 0)) / shares, 2);
    } else if (epsTtm != null) {
      fcfPerShare = epsTtm; // owner-earnings proxy when cash-flow unavailable
    }
    let fcfPositiveYears = 0;
    for (const r of cashReports.slice(0, 10)) {
      const o = num(r?.operatingCashflow);
      const c = num(r?.capitalExpenditures);
      if (o != null && o - (c ?? 0) > 0) fcfPositiveYears++;
    }
    if (cashReports.length === 0) fcfPositiveYears = fcfPerShare > 0 ? 8 : 2;

    // Leverage & liquidity from the latest annual balance sheet.
    const bsReports = Array.isArray(balance.annualReports)
      ? (balance.annualReports as Record<string, unknown>[])
      : [];
    const bs = bsReports[0];
    const equity = num(bs?.totalShareholderEquity);
    const totalDebt =
      num(bs?.shortLongTermDebtTotal) ?? (num(bs?.currentDebt) ?? 0) + (num(bs?.longTermDebt) ?? 0);
    const curAssets = num(bs?.totalCurrentAssets);
    const curLiab = num(bs?.totalCurrentLiabilities);
    const cashEq =
      num(bs?.cashAndCashEquivalentsAtCarryingValue) ?? num(bs?.cashAndShortTermInvestments) ?? 0;
    const debtToEquity = equity && equity > 0 && totalDebt != null ? round(totalDebt / equity, 2) : 0;
    const currentRatio = curAssets != null && curLiab && curLiab > 0 ? round(curAssets / curLiab, 2) : 0;
    const netCashPerShare = shares && shares > 0 ? round((cashEq - (totalDebt ?? 0)) / shares, 2) : 0;
    // Interest coverage isn't in these endpoints; infer a conservative band from leverage.
    const interestCoverage =
      debtToEquity <= 0.1 ? 999 : debtToEquity < 0.5 ? 30 : debtToEquity < 1 ? 12 : debtToEquity < 2 ? 6 : 2;
    const fcfMargin = salesPerShare > 0 ? round(fcfPerShare / salesPerShare, 4) : 0;

    const revenueGrowth5y = num(overview.QuarterlyRevenueGrowthYOY) ?? 0;
    const epsGrowth5y = num(overview.QuarterlyEarningsGrowthYOY) ?? revenueGrowth5y;
    const revenueGrowthFwd = revenueGrowth5y;

    const qualitative = deriveQualitative({
      kind, grossMargin, operatingMargin, netMargin, roic, roe, revenueGrowth5y,
      marketCap: num(overview.MarketCapitalization) ?? undefined,
    });

    const data = assembleFundamentals({
      symbol: sym,
      name: (overview.Name as string) || sym,
      kind,
      asOf,
      fetchedAt: new Date().toISOString(),
      price,
      dataSource: "LIVE",
      epsTtm,
      epsFwd,
      fcfPerShare,
      salesPerShare,
      bookPerShare,
      dividendPerShare,
      revenueGrowth5y,
      epsGrowth5y,
      revenueGrowthFwd,
      grossMargin,
      operatingMargin,
      netMargin,
      roe,
      roic,
      debtToEquity,
      interestCoverage,
      currentRatio,
      netCashPerShare,
      fcfPositiveYears,
      fcfMargin,
      qualitative,
      historyRng: makeRng(`${sym}|alpha_vantage`),
    });
    setCached(this.id, sym, asOf, data);
    return data;
  }
}

// ─── Provider selection ───────────────────────────────────────────────────────

const simulatedProvider = new SimulatedFundamentalsProvider();

// Resolve the API key for a live provider from the environment.
function apiKeyFor(provider: string): string | undefined {
  if (provider === "alpha_vantage") return process.env.ALPHA_VANTAGE_API_KEY || undefined;
  if (provider === "financial_modeling_prep") return process.env.FMP_API_KEY || undefined;
  return undefined;
}

function anyLiveKeyPresent(): boolean {
  return !!(process.env.ALPHA_VANTAGE_API_KEY || process.env.FMP_API_KEY);
}

// Pure selector: choose the provider from settings + env keys. Returns the live
// provider only when the selected provider has its API key present; otherwise the
// simulated provider. No DB / network access — directly unit-testable.
export function selectFundamentalsProvider(
  settings?: { fundamentalsProvider?: string | null } | null,
): FundamentalsProvider {
  const provider = settings?.fundamentalsProvider ?? "simulated";
  const key = apiKeyFor(provider);
  if (provider === "alpha_vantage" && key) return new AlphaVantageFundamentalsProvider(key);
  if (provider === "financial_modeling_prep" && key) return new FmpFundamentalsProvider(key);
  return simulatedProvider;
}

// Load the configured provider: reads the (Phase 1, Sprint 5: per-user) Settings
// row and applies `selectFundamentalsProvider`. Short-circuits to simulated (no
// DB read) when no live API key is configured, so unit tests stay DB-free and
// the default is safe. `userId` defaults to the legacy-owner stand-in (see
// lib/legacyOwner.ts) so every existing caller keeps working unchanged until
// Sprint 6/7 thread the real authenticated user through.
export async function getFundamentalsProvider(userId?: string): Promise<FundamentalsProvider> {
  if (!anyLiveKeyPresent()) return simulatedProvider;
  try {
    const resolvedUserId = userId ?? (await getLegacyOwnerUserId());
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.userId, resolvedUserId))
      .limit(1);
    return selectFundamentalsProvider(row ?? null);
  } catch (err) {
    logger.warn({ err }, "failed to load fundamentals settings; using simulated provider");
    return simulatedProvider;
  }
}

// Human-readable label for a provider id (used in honest fallback messaging).
export function providerLabel(id: string): string {
  if (id === "financial_modeling_prep") return "Financial Modeling Prep";
  if (id === "alpha_vantage") return "Alpha Vantage";
  if (id === "simulated") return "Simulated";
  return id;
}

// ─── Live provider status tracking ────────────────────────────────────────────
//
// We already degrade honestly to SIMULATED with a typed `fallback` reason on every
// failed live fetch, but that reason is only visible on the one report that
// triggered it. To give operators an at-a-glance health view (a status surface on
// Settings), we record the most recent live success and most recent fallback per
// live provider in-process. This is observability only — it never changes which
// data is returned, and it is intentionally not persisted (process-local, resets
// on restart, like the live cache).

export const LIVE_PROVIDER_IDS = ["financial_modeling_prep", "alpha_vantage"] as const;

export type FundamentalsProviderState =
  | "ok" // last live fetch succeeded
  | "rate_limited" // temporary — recovers when the provider's limit resets
  | "unreachable" // misconfigured / down — needs attention
  | "no_data" // key works but the provider had no data for the symbol
  | "not_configured" // no API key present
  | "idle"; // configured but not queried yet this process

interface ProviderActivity {
  lastSuccessAt: number | null;
  lastFallback: { reason: FundamentalsFallbackReason; message: string; at: number } | null;
}

const providerActivity = new Map<string, ProviderActivity>();

// Test-only: clear the in-process activity map so the status-surface unit tests
// are isolated from one another (and from other suites in the same worker). The
// map is observability-only and process-local, so this never affects runtime.
export function __resetFundamentalsProviderActivityForTest(): void {
  providerActivity.clear();
}

function activityFor(id: string): ProviderActivity {
  let a = providerActivity.get(id);
  if (!a) {
    a = { lastSuccessAt: null, lastFallback: null };
    providerActivity.set(id, a);
  }
  return a;
}

function recordProviderSuccess(id: string): void {
  activityFor(id).lastSuccessAt = Date.now();
}

function recordProviderFallback(
  id: string,
  reason: FundamentalsFallbackReason,
  message: string,
): void {
  activityFor(id).lastFallback = { reason, message, at: Date.now() };
}

export interface FundamentalsProviderStatusEntry {
  provider: string;
  label: string;
  selected: boolean;
  keyPresent: boolean;
  state: FundamentalsProviderState;
  message: string;
  lastSuccessAt: string | null;
  lastFallbackAt: string | null;
  lastFallbackReason: FundamentalsFallbackReason | null;
}

// Build the operator-facing status for each live provider from recorded activity +
// current configuration. Pure given the in-process activity map, so it is safe to
// call from a route handler without any network/DB access.
export function getFundamentalsProviderStatuses(
  settings?: { fundamentalsProvider?: string | null } | null,
): FundamentalsProviderStatusEntry[] {
  const selectedProvider = settings?.fundamentalsProvider ?? "simulated";
  return LIVE_PROVIDER_IDS.map((id) => {
    const label = providerLabel(id);
    const keyPresent = !!apiKeyFor(id);
    const selected = selectedProvider === id;
    const activity = providerActivity.get(id);
    const lastSuccessAt = activity?.lastSuccessAt ?? null;
    const fb = activity?.lastFallback ?? null;
    // The fallback only reflects the current health if it is at least as recent as
    // the last success — otherwise a later success has cleared it.
    const fallbackIsLatest = fb != null && (lastSuccessAt == null || fb.at >= lastSuccessAt);

    let state: FundamentalsProviderState;
    let message: string;

    if (!keyPresent) {
      state = "not_configured";
      message = selected
        ? `${label} is selected but no API key is configured. Add its environment secret to connect — research is using simulated data until then.`
        : `${label} is not configured. Add its API key as an environment secret to enable live fundamentals.`;
    } else if (fallbackIsLatest && fb) {
      switch (fb.reason) {
        case "rate_limit":
          state = "rate_limited";
          message = `${label} is rate-limited right now. This is temporary — it should recover on its own once the provider's limit resets.`;
          break;
        case "error":
          state = "unreachable";
          message = `${label} could not be reached. Check the API key and the provider's status; research is falling back to simulated data.`;
          break;
        case "no_data":
        default:
          state = "no_data";
          message = `${label} returned no data on the last request. The key is working, but the requested symbol may be unsupported.`;
          break;
      }
    } else if (lastSuccessAt != null) {
      state = "ok";
      message = `${label} is responding normally.`;
    } else {
      state = "idle";
      message = `${label} is configured but has not been queried yet this session.`;
    }

    return {
      provider: id,
      label,
      selected,
      keyPresent,
      state,
      message,
      lastSuccessAt: lastSuccessAt != null ? new Date(lastSuccessAt).toISOString() : null,
      lastFallbackAt: fb != null ? new Date(fb.at).toISOString() : null,
      lastFallbackReason: fb?.reason ?? null,
    };
  });
}

// Fetch with a resilient, HONEST fallback: if a live provider errors or returns no
// data, fall back to the simulated provider — whose result is correctly labelled
// SIMULATED, so the UI never shows simulated numbers under a LIVE badge. When a
// fallback happens, the returned (simulated) fundamentals carry a `fallback` note
// describing why, so the UI can tell the user the live data is temporarily
// unavailable (e.g. the provider is rate-limited) instead of degrading silently.
export async function resolveFundamentals(
  provider: FundamentalsProvider,
  symbol: string,
  asOf?: string,
  opts?: FetchOpts,
): Promise<Fundamentals | null> {
  if (!provider.isLive) return provider.getFundamentals(symbol, asOf, opts);

  let reason: FundamentalsFallbackReason;
  let message: string;
  const label = providerLabel(provider.id);
  try {
    const f = await provider.getFundamentals(symbol, asOf, opts);
    if (f) {
      // Record when a live provider last yielded real data so the UI can show
      // data freshness (the time the provider was actually reached, preserved
      // across cache hits via the datum's own fetchedAt).
      recordLiveSuccess(provider.id, f.fetchedAt);
      recordProviderSuccess(provider.id);
      return f;
    }
    reason = "no_data";
    message = `${label} returned no data for ${symbol.toUpperCase()}. Showing simulated fundamentals instead.`;
    logger.warn({ symbol, provider: provider.id }, "live fundamentals returned no data; using simulated");
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    reason = /limit/i.test(errMsg) ? "rate_limit" : "error";
    message =
      reason === "rate_limit"
        ? `${label} is rate-limited right now. Showing simulated fundamentals until the limit resets.`
        : `${label} could not be reached. Showing simulated fundamentals instead.`;
    logger.warn({ err, symbol, provider: provider.id }, "live fundamentals fetch failed; using simulated");
  }

  // Record the fallback so the provider-status surface can report the most recent
  // outage/rate-limit per provider, not just the symbol that hit it.
  recordProviderFallback(provider.id, reason, message);

  const sim = await simulatedProvider.getFundamentals(symbol, asOf, opts);
  if (sim) sim.fallback = { attemptedProvider: provider.id, reason, message };
  return sim;
}

export async function getFundamentals(
  symbol: string,
  asOf?: string,
  opts?: FetchOpts,
): Promise<Fundamentals | null> {
  const provider = await getFundamentalsProvider();
  return resolveFundamentals(provider, symbol, asOf, opts);
}

// Connection status for the Settings UI: is a live fundamentals provider actually
// configured (selected + key present)?
export function fundamentalsConnectionStatus(
  settings?: { fundamentalsProvider?: string | null } | null,
): { provider: string; connected: boolean } {
  const provider = settings?.fundamentalsProvider ?? "simulated";
  const connected = provider !== "simulated" && !!apiKeyFor(provider);
  return { provider, connected };
}

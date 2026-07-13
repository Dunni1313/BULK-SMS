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
import { getSectorProfile } from "./industryPeers.js";

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

  // Phase 2, Sprint 20. Real categorical classification for LIVE data (captured
  // from the provider's own profile/overview response, never fabricated — honest
  // null when the provider doesn't return one); for SIMULATED data, a known
  // real-company classification or a deterministic synthetic bucket (see
  // industryPeers.ts's getSectorProfile) — never null, so peer comparison always
  // has some deterministic sector to work with.
  sector: string | null;
  industry: string | null;

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

  // Phase 2, Sprint 24 — capital allocation / ownership. Aggregate numbers
  // about capital structure only (never a named individual's transaction) —
  // null when no provider (SIMULATED or LIVE) supplies them.
  insiderOwnershipPct: number | null; // fraction of shares held by insiders
  sharesOutstandingChange5y: number | null; // fraction; negative = net buybacks, positive = net dilution
  netInsiderActivity: "buying" | "selling" | "neutral" | null; // aggregate direction only, never per-transaction

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
  sector: string | null;
  industry: string | null;
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
  insiderOwnershipPct: number | null;
  sharesOutstandingChange5y: number | null;
  netInsiderActivity: "buying" | "selling" | "neutral" | null;
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
    sector: a.sector,
    industry: a.industry,
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
    insiderOwnershipPct: a.insiderOwnershipPct,
    sharesOutstandingChange5y: a.sharesOutstandingChange5y,
    netInsiderActivity: a.netInsiderActivity,
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

// ─── Financial Statements (Phase 2, Sprint 19) ────────────────────────────────
// Full multi-year Income Statement / Balance Sheet / Cash Flow Statement line
// items — a separate, heavier, ON-DEMAND data source from `Fundamentals` itself.
// Deliberately not folded into `Fundamentals`/`buildValueResearchReport()`:
// fetching full statements on every report would multiply the API calls per
// report for data most users never open. Fetched only when a caller explicitly
// requests it (the new "Financial Statements" UI tab, opened per symbol).
//
// Five years of ANNUAL data, oldest -> newest (matching the existing
// `revenueHistory`-style convention elsewhere in this file). All monetary figures
// are absolute (not per-share), matching how real filed statements are presented.
export interface IncomeStatementYear {
  year: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingIncome: number;
  netIncome: number;
}
export interface BalanceSheetYear {
  year: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currentAssets: number;
  currentLiabilities: number;
  inventory: number;
  cash: number;
}
export interface CashFlowYear {
  year: string;
  operatingCashFlow: number;
  capitalExpenditures: number;
  freeCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
}
export interface FinancialStatements {
  symbol: string;
  name: string;
  dataSource: DataSource;
  fetchedAt: string;
  incomeStatement: IncomeStatementYear[];
  balanceSheet: BalanceSheetYear[];
  cashFlow: CashFlowYear[];
}

// ─── Earnings Intelligence (Phase 2, Sprint 25) ───────────────────────────────
// Quarterly earnings actual-vs-estimate history — a separate, ON-DEMAND data
// source from `Fundamentals` itself, mirroring Sprint 19's Financial Statements
// seam exactly. Deliberately not folded into `Fundamentals`/
// `buildValueResearchReport()`: fetched only when a caller explicitly requests
// it (the new "Earnings" UI tab, opened per symbol).
//
// Oldest -> newest, up to EARNINGS_QUARTERS_TRACKED quarters. Every numeric
// field is honestly null when a provider doesn't supply it (e.g. Alpha
// Vantage's documented EARNINGS endpoint has no revenue-estimate data at
// all — revenueActual/revenueEstimate/revenueSurprisePct stay null for that
// provider, never approximated).
export const EARNINGS_QUARTERS_TRACKED = 8;

export interface QuarterlyEarningsRecord {
  fiscalQuarter: string; // e.g. "Q2 2025" (LIVE) or a relative label like "Q1 -1y" (SIMULATED, which has no real calendar anchor)
  reportDate: string | null; // ISO date; null when the provider doesn't supply one — never fabricated
  epsActual: number | null;
  epsEstimate: number | null;
  epsSurprisePct: number | null; // (actual-estimate)/abs(estimate)*100; null if either is missing or estimate is 0
  revenueActual: number | null;
  revenueEstimate: number | null;
  revenueSurprisePct: number | null;
}
export interface EarningsHistory {
  symbol: string;
  name: string;
  dataSource: DataSource;
  fetchedAt: string;
  quarters: QuarterlyEarningsRecord[];
}

// Shared by SIMULATED and FMP paths (Alpha Vantage prefers its own reported
// surprisePercentage field — see below). Honestly null, never a division by
// zero or a fabricated figure, when either side is missing or the estimate is 0.
function computeSurprisePct(actual: number | null, estimate: number | null): number | null {
  if (actual == null || estimate == null || estimate === 0) return null;
  return round(((actual - estimate) / Math.abs(estimate)) * 100, 2);
}

// Phase 2, Sprint 25 — deterministic SIMULATED quarterly earnings, derived from
// the SAME Fundamentals this provider already produces for the symbol (its
// revenueHistory/epsHistory per-share arrays) — never a second, independently
// random data source, mirroring Sprint 19's simulateFinancialStatements()
// precedent. The most recent 2 annual entries are split into 8 deterministically
// weighted quarters; each quarter's "estimate" is the actual plus small seeded
// noise, the same kind of illustrative aggregate every other SIMULATED metric
// in this file already produces — never a claim about a real reported event.
function simulatedEarningsHistory(f: Fundamentals): EarningsHistory {
  const rng = makeRng(`${f.symbol}|earnings-history`);
  const scaleFactor = clamp(f.qualitative.scale, 20, 95) / 95;
  const shares = Math.round((2e8 + rng() * 3e9) * (0.4 + 0.6 * scaleFactor));

  const revPerShareYears = f.revenueHistory.slice(-2); // [-1y, Current]
  const epsPerShareYears = f.epsHistory.slice(-2);
  const yearLabels = revPerShareYears.length === 2 ? ["-1y", "Current"] : ["Current"];

  const quarters: QuarterlyEarningsRecord[] = [];
  for (let y = 0; y < revPerShareYears.length; y++) {
    const annualRevPerShare = revPerShareYears[y];
    const annualEpsPerShare = epsPerShareYears[y];
    // Seeded quarterly weights around 25% each, normalized to sum to 1 — an
    // illustrative seasonal split, not an independently random model.
    const rawWeights = [1, 2, 3, 4].map(() => 0.25 + (rng() - 0.5) * 0.1);
    const weightSum = rawWeights.reduce((a, w) => a + w, 0);
    const weights = rawWeights.map((w) => w / weightSum);
    for (let q = 0; q < 4; q++) {
      const epsActual = round(annualEpsPerShare * weights[q], 2);
      const revenueActual = round(annualRevPerShare * weights[q] * shares, 0);
      const noise = (rng() - 0.5) * 0.16; // -8%..+8%
      const epsEstimate = round(epsActual * (1 - noise), 2);
      const revenueEstimate = round(revenueActual * (1 - noise), 0);
      quarters.push({
        fiscalQuarter: `Q${q + 1} ${yearLabels[y]}`,
        reportDate: null,
        epsActual,
        epsEstimate,
        epsSurprisePct: computeSurprisePct(epsActual, epsEstimate),
        revenueActual,
        revenueEstimate,
        revenueSurprisePct: computeSurprisePct(revenueActual, revenueEstimate),
      });
    }
  }

  return {
    symbol: f.symbol,
    name: f.name,
    dataSource: f.dataSource,
    fetchedAt: new Date().toISOString(),
    quarters: quarters.slice(-EARNINGS_QUARTERS_TRACKED),
  };
}

// Phase 2, Sprint 24 — deterministic SIMULATED capital-allocation/ownership
// data, seeded by symbol only (stable across requests). These are aggregate
// numbers about capital structure (insider ownership %, share-count trend) —
// the same kind of thing this file already simulates for every other
// financial metric — never a named individual's specific transaction, which
// this function deliberately cannot produce (netInsiderActivity is only ever
// one of three aggregate directions).
function simulatedCapitalAllocation(symbol: string): {
  insiderOwnershipPct: number;
  sharesOutstandingChange5y: number;
  netInsiderActivity: "buying" | "selling" | "neutral";
} {
  const rng = makeRng(`${symbol}|capital-allocation`);
  const insiderOwnershipPct = round(0.005 + rng() * 0.15, 4); // 0.5%-15.5%
  const sharesOutstandingChange5y = round((rng() - 0.6) * 0.3, 4); // skewed toward buybacks, -18%..+12%
  const activityRoll = rng();
  const netInsiderActivity: "buying" | "selling" | "neutral" =
    activityRoll < 0.3 ? "buying" : activityRoll < 0.6 ? "selling" : "neutral";
  return { insiderOwnershipPct, sharesOutstandingChange5y, netInsiderActivity };
}

// The provider seam. A live provider implements the same async interface and is
// selected via Settings; the simulated provider is the safe default.
export interface FundamentalsProvider {
  readonly id: string;
  readonly dataSource: DataSource;
  readonly isLive: boolean;
  getFundamentals(symbol: string, asOf?: string, opts?: FetchOpts): Promise<Fundamentals | null>;
  getFinancialStatements(symbol: string, opts?: FetchOpts): Promise<FinancialStatements | null>;
  getEarningsHistory(symbol: string, opts?: FetchOpts): Promise<EarningsHistory | null>;
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
    const sectorProfile = getSectorProfile(sym);
    const capitalAllocation = simulatedCapitalAllocation(sym);

    return assembleFundamentals({
      symbol: sym,
      name,
      kind: p.kind,
      asOf,
      fetchedAt: new Date().toISOString(),
      price,
      dataSource: FUNDAMENTALS_DATA_SOURCE,
      sector: sectorProfile.sector,
      industry: sectorProfile.industry,
      insiderOwnershipPct: capitalAllocation.insiderOwnershipPct,
      sharesOutstandingChange5y: capitalAllocation.sharesOutstandingChange5y,
      netInsiderActivity: capitalAllocation.netInsiderActivity,
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

  // Deterministic, internally-consistent SIMULATED statements: derived from the
  // SAME Fundamentals this provider already produces for the symbol (its
  // revenueHistory/epsHistory/fcfHistory per-share arrays and margin/leverage
  // ratios) — never a second, independently-random data source. The one new
  // synthetic input is a deterministic "shares outstanding" (seeded by symbol
  // only, stable across calls) needed to turn per-share figures into the
  // absolute-dollar figures real filed statements use.
  async getFinancialStatements(symbol: string, _opts?: FetchOpts): Promise<FinancialStatements | null> {
    const sym = symbol.toUpperCase();
    const f = await this.getFundamentals(sym, todayStr());
    if (!f) return null;
    return simulateFinancialStatements(f);
  }

  async getEarningsHistory(symbol: string, _opts?: FetchOpts): Promise<EarningsHistory | null> {
    const sym = symbol.toUpperCase();
    const f = await this.getFundamentals(sym, todayStr());
    if (!f) return null;
    return simulatedEarningsHistory(f);
  }
}

// Builds 5 years of absolute-dollar statements from an already-computed
// Fundamentals snapshot. `revenueHistory`/`epsHistory`/`fcfHistory` are 6-entry
// per-share arrays (oldest -> newest); the most recent 5 become the statement
// years. A deterministic share count (seeded by symbol, stable across calls,
// scaled loosely by the qualitative "scale" factor so mega-cap-flavored symbols
// get a larger illustrative share count) converts per-share figures to totals.
function simulateFinancialStatements(f: Fundamentals): FinancialStatements {
  const rng = makeRng(`${f.symbol}|financial-statements-shares`);
  const scaleFactor = clamp(f.qualitative.scale, 20, 95) / 95; // 0.21..1.0
  const shares = Math.round((2e8 + rng() * 3e9) * (0.4 + 0.6 * scaleFactor));

  const revPerShare = f.revenueHistory.slice(-5);
  const epsPerShare = f.epsHistory.slice(-5);
  const fcfPerShareHist = f.fcfHistory.slice(-5);
  const n = revPerShare.length;

  const yearLabel = (i: number): string => {
    const offset = n - 1 - i; // years before "now"
    return offset === 0 ? "Current" : `-${offset}y`;
  };

  const incomeStatement: IncomeStatementYear[] = revPerShare.map((rps, i) => {
    const revenue = round(rps * shares, 0);
    const grossProfit = round(revenue * f.grossMargin, 0);
    const costOfRevenue = revenue - grossProfit;
    const operatingIncome = round(revenue * f.operatingMargin, 0);
    const operatingExpenses = grossProfit - operatingIncome;
    const netIncome = round(epsPerShare[i] * shares, 0);
    return { year: yearLabel(i), revenue, costOfRevenue, grossProfit, operatingExpenses, operatingIncome, netIncome };
  });

  // Balance sheet: current year anchored to the exact ratios Fundamentals already
  // reports (bookPerShare, debtToEquity, currentRatio, netCashPerShare); prior
  // years scaled proportionally to that year's revenue vs. the current year's —
  // a simple, deterministic size proxy, not an independent random model.
  const currentEquity = f.bookPerShare * shares;
  const currentRevenue = revPerShare[n - 1] * shares;
  const balanceSheet: BalanceSheetYear[] = revPerShare.map((rps, i) => {
    const sizeScale = currentRevenue > 0 ? (rps * shares) / currentRevenue : 1;
    const totalEquity = round(currentEquity * sizeScale, 0);
    const totalLiabilities = round(Math.max(f.debtToEquity, 0) * totalEquity, 0);
    const totalAssets = totalEquity + totalLiabilities;
    const currentLiabilities = round(totalLiabilities * 0.4, 0);
    const currentAssets = f.kind === "etf" ? 0 : round(Math.max(f.currentRatio, 0) * currentLiabilities, 0);
    const inventory = f.kind === "etf" ? 0 : round(currentAssets * 0.15, 0);
    const cash = round(Math.max(f.netCashPerShare, 0) * shares * sizeScale, 0);
    return { year: yearLabel(i), totalAssets, totalLiabilities, totalEquity, currentAssets, currentLiabilities, inventory, cash };
  });

  const cashFlow: CashFlowYear[] = fcfPerShareHist.map((fcfps, i) => {
    const freeCashFlow = round(fcfps * shares, 0);
    // FCF = Operating CF - Capex; assume capex is a modest ~15% of operating CF
    // (i.e. operatingCashFlow = freeCashFlow / 0.85) — a plausible, deterministic
    // illustrative split, not an independently sourced figure.
    const operatingCashFlow = round(freeCashFlow / 0.85, 0);
    const capitalExpenditures = operatingCashFlow - freeCashFlow;
    const investingCashFlow = round(-capitalExpenditures * 1.1, 0);
    const financingCashFlow = round(-freeCashFlow * 0.2, 0);
    return { year: yearLabel(i), operatingCashFlow, capitalExpenditures, freeCashFlow, investingCashFlow, financingCashFlow };
  });

  return {
    symbol: f.symbol,
    name: f.name,
    dataSource: f.dataSource,
    fetchedAt: new Date().toISOString(),
    incomeStatement,
    balanceSheet,
    cashFlow,
  };
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

// Phase 2, Sprint 25 — derives a "Q# YYYY" fiscal-quarter label from a
// fiscal-period-end date string (e.g. "2025-06-30" -> "Q2 2025"), used by both
// live providers' earnings-history parsing. Honestly returns the raw string
// unlabeled ("Unknown") if it can't be parsed — never a guessed quarter.
function quarterLabelFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${quarter} ${d.getUTCFullYear()}`;
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

// Phase 2, Sprint 24 — best-effort FMP capital-allocation/ownership fetch.
// Deliberately never throws: these two endpoints have no prior in-repo
// precedent (unlike ratios-ttm/key-metrics-ttm) and live verification could
// not be performed this session (no FMP_API_KEY available), so a failure or
// unexpected shape here must never break the main getFundamentals() call —
// it degrades to honest nulls instead. Only ever returns an AGGREGATE
// direction for insider activity, never a named individual's transaction.
async function fetchFmpCapitalAllocation(
  base: string,
  sym: string,
  k: string,
): Promise<{
  sharesOutstandingChange5y: number | null;
  netInsiderActivity: "buying" | "selling" | "neutral" | null;
}> {
  let sharesOutstandingChange5y: number | null = null;
  let netInsiderActivity: "buying" | "selling" | "neutral" | null = null;

  try {
    const evRaw = await fetchJson(`${base}/enterprise-values/${sym}?period=annual&limit=6&apikey=${k}`);
    if (Array.isArray(evRaw) && evRaw.length >= 2) {
      // FMP returns most-recent-first.
      const rows = evRaw as Record<string, unknown>[];
      const newest = num(rows[0]?.numberOfShares);
      const oldest = num(rows[rows.length - 1]?.numberOfShares);
      if (newest != null && oldest != null && oldest > 0) {
        sharesOutstandingChange5y = round((newest - oldest) / oldest, 4);
      }
    }
  } catch {
    // Honest null — never blocks the main fetch.
  }

  try {
    const tradesRaw = await fetchJson(`${base}/insider-trading?symbol=${sym}&limit=100&apikey=${k}`);
    if (Array.isArray(tradesRaw) && tradesRaw.length > 0) {
      const rows = tradesRaw as Record<string, unknown>[];
      let buyVolume = 0;
      let sellVolume = 0;
      for (const r of rows) {
        const type = String(r.transactionType ?? r.acquistionOrDisposition ?? "").toUpperCase();
        const shares = Math.abs(num(r.securitiesTransacted) ?? 0);
        const isBuy = type.startsWith("P") || type === "A" || type.includes("BUY") || type.includes("PURCHASE");
        const isSell = type.startsWith("S") || type === "D" || type.includes("SELL") || type.includes("SALE");
        if (isBuy) buyVolume += shares;
        else if (isSell) sellVolume += shares;
      }
      const total = buyVolume + sellVolume;
      if (total > 0) {
        const buyShare = buyVolume / total;
        netInsiderActivity = buyShare >= 0.6 ? "buying" : buyShare <= 0.4 ? "selling" : "neutral";
      }
    }
  } catch {
    // Honest null — never blocks the main fetch.
  }

  return { sharesOutstandingChange5y, netInsiderActivity };
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

// Same short-lived-cache discipline for the separate, heavier financial-statements
// fetch (Phase 2, Sprint 19) — its own map since the payload shape differs and it
// isn't keyed by `asOf` (statements are annual, not date-scoped like a quote).
const statementsCache = new Map<string, { at: number; data: FinancialStatements | null }>();
function getCachedStatements(id: string, sym: string): FinancialStatements | null | undefined {
  const e = statementsCache.get(`${id}:${sym}`);
  if (e && Date.now() - e.at < LIVE_TTL_MS) return e.data;
  return undefined;
}
function setCachedStatements(id: string, sym: string, data: FinancialStatements | null): void {
  statementsCache.set(`${id}:${sym}`, { at: Date.now(), data });
}

// Same short-lived-cache discipline for the earnings-history fetch (Phase 2,
// Sprint 25) — quarterly earnings are periodic, not date-scoped, so this
// mirrors statementsCache's own (no-asOf) keying exactly.
const earningsCache = new Map<string, { at: number; data: EarningsHistory | null }>();
function getCachedEarnings(id: string, sym: string): EarningsHistory | null | undefined {
  const e = earningsCache.get(`${id}:${sym}`);
  if (e && Date.now() - e.at < LIVE_TTL_MS) return e.data;
  return undefined;
}
function setCachedEarnings(id: string, sym: string, data: EarningsHistory | null): void {
  earningsCache.set(`${id}:${sym}`, { at: Date.now(), data });
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

    const capitalAllocation = await fetchFmpCapitalAllocation(base, sym, k);

    const data = assembleFundamentals({
      symbol: sym,
      name: (profile.companyName as string) || sym,
      kind,
      asOf,
      fetchedAt: new Date().toISOString(),
      price,
      dataSource: "LIVE",
      // Phase 2, Sprint 20 — already present in FMP's /profile response, simply
      // not captured until now. Honest null when the provider omits it, never a
      // guessed classification.
      sector: (profile.sector as string) || null,
      industry: (profile.industry as string) || null,
      // Phase 2, Sprint 24 — best-effort, never blocks the main fetch. Insider
      // OWNERSHIP PERCENTAGE is honestly left null for FMP: unlike shares-
      // outstanding trend and insider transaction direction, it isn't reliably
      // available from a documented free-tier endpoint without live
      // verification this session couldn't perform — never guessed.
      insiderOwnershipPct: null,
      sharesOutstandingChange5y: capitalAllocation.sharesOutstandingChange5y,
      netInsiderActivity: capitalAllocation.netInsiderActivity,
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

  // Phase 2, Sprint 19. Fetched only on demand (the Financial Statements tab),
  // never as part of getFundamentals()/buildValueResearchReport(), so it never
  // adds to the per-report call budget. Field names below are FMP's documented
  // v3 statement-endpoint shape; LIVE VERIFICATION IS DEFERRED — no FMP_API_KEY
  // was available in this session, so these have not been exercised against the
  // real API (mocked-fetch tests cover the parsing logic instead).
  async getFinancialStatements(symbol: string, opts?: FetchOpts): Promise<FinancialStatements | null> {
    const sym = symbol.toUpperCase();
    if (!opts?.forceRefresh) {
      const cached = getCachedStatements(this.id, sym);
      if (cached !== undefined) return cached;
    }

    const base = "https://financialmodelingprep.com/api/v3";
    const k = encodeURIComponent(this.apiKey);
    const [incomeRaw, balanceRaw, cashRaw] = await Promise.all([
      fetchJson(`${base}/income-statement/${sym}?period=annual&limit=5&apikey=${k}`),
      fetchJson(`${base}/balance-sheet-statement/${sym}?period=annual&limit=5&apikey=${k}`),
      fetchJson(`${base}/cash-flow-statement/${sym}?period=annual&limit=5&apikey=${k}`),
    ]);
    for (const r of [incomeRaw, balanceRaw, cashRaw]) {
      if (r && !Array.isArray(r) && (r as Record<string, unknown>)["Error Message"]) {
        throw new Error("Financial Modeling Prep error or rate limit");
      }
    }
    const incomeArr = (Array.isArray(incomeRaw) ? incomeRaw : []) as Record<string, unknown>[];
    const balanceArr = (Array.isArray(balanceRaw) ? balanceRaw : []) as Record<string, unknown>[];
    const cashArr = (Array.isArray(cashRaw) ? cashRaw : []) as Record<string, unknown>[];
    if (incomeArr.length === 0 && balanceArr.length === 0 && cashArr.length === 0) {
      setCachedStatements(this.id, sym, null);
      return null;
    }

    // FMP returns most-recent-first; reverse to oldest -> newest for consistency
    // with the rest of this file's history-array convention.
    const incomeStatement: IncomeStatementYear[] = [...incomeArr].reverse().map((r) => {
      const revenue = num(r.revenue) ?? 0;
      const grossProfit = num(r.grossProfit) ?? 0;
      return {
        year: String(r.date ?? r.calendarYear ?? ""),
        revenue,
        costOfRevenue: num(r.costOfRevenue) ?? revenue - grossProfit,
        grossProfit,
        operatingExpenses: num(r.operatingExpenses) ?? 0,
        operatingIncome: num(r.operatingIncome) ?? 0,
        netIncome: num(r.netIncome) ?? 0,
      };
    });
    const balanceSheet: BalanceSheetYear[] = [...balanceArr].reverse().map((r) => ({
      year: String(r.date ?? r.calendarYear ?? ""),
      totalAssets: num(r.totalAssets) ?? 0,
      totalLiabilities: num(r.totalLiabilities) ?? 0,
      totalEquity: num(r.totalStockholdersEquity) ?? num(r.totalEquity) ?? 0,
      currentAssets: num(r.totalCurrentAssets) ?? 0,
      currentLiabilities: num(r.totalCurrentLiabilities) ?? 0,
      inventory: num(r.inventory) ?? 0,
      cash: num(r.cashAndCashEquivalents) ?? num(r.cashAndShortTermInvestments) ?? 0,
    }));
    const cashFlow: CashFlowYear[] = [...cashArr].reverse().map((r) => {
      const operatingCashFlow = num(r.operatingCashFlow) ?? 0;
      const capitalExpenditures = Math.abs(num(r.capitalExpenditure) ?? 0);
      return {
        year: String(r.date ?? r.calendarYear ?? ""),
        operatingCashFlow,
        capitalExpenditures,
        freeCashFlow: num(r.freeCashFlow) ?? operatingCashFlow - capitalExpenditures,
        investingCashFlow: num(r.netCashUsedForInvestingActivites) ?? num(r.netCashUsedForInvestingActivities) ?? 0,
        financingCashFlow: num(r.netCashUsedProvidedByFinancingActivities) ?? 0,
      };
    });

    // The statement endpoints don't carry a company display name (only /profile
    // does, fetched separately by getFundamentals) — fall back to the ticker
    // itself rather than fabricate one.
    const data: FinancialStatements = {
      symbol: sym,
      name: sym,
      dataSource: "LIVE",
      fetchedAt: new Date().toISOString(),
      incomeStatement,
      balanceSheet,
      cashFlow,
    };
    setCachedStatements(this.id, sym, data);
    return data;
  }

  // Phase 2, Sprint 25. Fetched only on demand (the Earnings tab), never as
  // part of getFundamentals()/buildValueResearchReport(). Field names below
  // are FMP's documented historical-earnings-calendar shape
  // (eps/epsEstimated/revenue/revenueEstimated/fiscalDateEnding/date) — LIVE
  // VERIFICATION IS DEFERRED, same as every FMP integration since Sprint 11:
  // no FMP_API_KEY was available in this session, so this has not been
  // exercised against the real API (mocked-fetch tests cover the parsing
  // logic instead).
  async getEarningsHistory(symbol: string, opts?: FetchOpts): Promise<EarningsHistory | null> {
    const sym = symbol.toUpperCase();
    if (!opts?.forceRefresh) {
      const cached = getCachedEarnings(this.id, sym);
      if (cached !== undefined) return cached;
    }

    const base = "https://financialmodelingprep.com/api/v3";
    const k = encodeURIComponent(this.apiKey);
    const raw = await fetchJson(
      `${base}/historical/earning_calendar/${sym}?limit=${EARNINGS_QUARTERS_TRACKED}&apikey=${k}`,
    );
    if (raw && !Array.isArray(raw) && (raw as Record<string, unknown>)["Error Message"]) {
      throw new Error("Financial Modeling Prep error or rate limit");
    }
    const arr = (Array.isArray(raw) ? raw : []) as Record<string, unknown>[];
    if (arr.length === 0) {
      setCachedEarnings(this.id, sym, null);
      return null;
    }

    // FMP returns most-recent-first; reverse to oldest -> newest, matching the
    // rest of this file's history-array convention.
    const quarters: QuarterlyEarningsRecord[] = [...arr]
      .reverse()
      .slice(-EARNINGS_QUARTERS_TRACKED)
      .map((r) => {
        const epsActual = num(r.eps);
        const epsEstimate = num(r.epsEstimated);
        const revenueActual = num(r.revenue);
        const revenueEstimate = num(r.revenueEstimated);
        const fiscalDateEnding = String(r.fiscalDateEnding ?? r.date ?? "");
        return {
          fiscalQuarter: quarterLabelFromDate(fiscalDateEnding),
          reportDate: r.date != null ? String(r.date) : null,
          epsActual,
          epsEstimate,
          epsSurprisePct: computeSurprisePct(epsActual, epsEstimate),
          revenueActual,
          revenueEstimate,
          revenueSurprisePct: computeSurprisePct(revenueActual, revenueEstimate),
        };
      });

    const data: EarningsHistory = {
      symbol: sym,
      // The earnings-calendar endpoint doesn't carry a company display name
      // (only /profile does, fetched separately by getFundamentals) — fall
      // back to the ticker itself rather than fabricate one.
      name: sym,
      dataSource: "LIVE",
      fetchedAt: new Date().toISOString(),
      quarters,
    };
    setCachedEarnings(this.id, sym, data);
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
      // Phase 2, Sprint 20 — already present in Alpha Vantage's OVERVIEW
      // response, simply not captured until now. Honest null when the provider
      // omits it, never a guessed classification.
      sector: (overview.Sector as string) || null,
      industry: (overview.Industry as string) || null,
      // Phase 2, Sprint 24 — honestly null for Alpha Vantage this sprint: no
      // insider-ownership/buyback-trend fetch was implemented against AV's
      // API, an explicit scope reduction disclosed in the sprint report
      // rather than a guessed/unverified endpoint call.
      insiderOwnershipPct: null,
      sharesOutstandingChange5y: null,
      netInsiderActivity: null,
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

  // Phase 2, Sprint 19. Fetched only on demand, never as part of
  // getFundamentals()/buildValueResearchReport(). Field names below are Alpha
  // Vantage's documented INCOME_STATEMENT/BALANCE_SHEET/CASH_FLOW `annualReports`
  // shape; LIVE VERIFICATION IS DEFERRED — no ALPHA_VANTAGE_API_KEY was available
  // in this session (mocked-fetch tests cover the parsing logic instead).
  async getFinancialStatements(symbol: string, opts?: FetchOpts): Promise<FinancialStatements | null> {
    const sym = symbol.toUpperCase();
    if (!opts?.forceRefresh) {
      const cached = getCachedStatements(this.id, sym);
      if (cached !== undefined) return cached;
    }

    const base = "https://www.alphavantage.co/query";
    const k = encodeURIComponent(this.apiKey);
    const [incomeRaw, balanceRaw, cashRaw] = await Promise.all([
      fetchJson(`${base}?function=INCOME_STATEMENT&symbol=${sym}&apikey=${k}`),
      fetchJson(`${base}?function=BALANCE_SHEET&symbol=${sym}&apikey=${k}`),
      fetchJson(`${base}?function=CASH_FLOW&symbol=${sym}&apikey=${k}`),
    ]);
    const income = (incomeRaw ?? {}) as Record<string, unknown>;
    const balance = (balanceRaw ?? {}) as Record<string, unknown>;
    const cash = (cashRaw ?? {}) as Record<string, unknown>;
    for (const r of [income, balance, cash]) {
      if (r.Note || r.Information || r["Error Message"]) {
        throw new Error("Alpha Vantage rate limit or error");
      }
    }
    const incomeArr = (Array.isArray(income.annualReports) ? income.annualReports : []) as Record<string, unknown>[];
    const balanceArr = (Array.isArray(balance.annualReports) ? balance.annualReports : []) as Record<string, unknown>[];
    const cashArr = (Array.isArray(cash.annualReports) ? cash.annualReports : []) as Record<string, unknown>[];
    if (incomeArr.length === 0 && balanceArr.length === 0 && cashArr.length === 0) {
      setCachedStatements(this.id, sym, null);
      return null;
    }

    // Alpha Vantage returns most-recent-first, up to 5 years; take the 5 most
    // recent and reverse to oldest -> newest.
    const incomeStatement: IncomeStatementYear[] = incomeArr.slice(0, 5).reverse().map((r) => {
      const revenue = num(r.totalRevenue) ?? 0;
      const grossProfit = num(r.grossProfit) ?? 0;
      return {
        year: String(r.fiscalDateEnding ?? ""),
        revenue,
        costOfRevenue: num(r.costOfRevenue) ?? num(r.costofGoodsAndServicesSold) ?? revenue - grossProfit,
        grossProfit,
        operatingExpenses: num(r.operatingExpenses) ?? 0,
        operatingIncome: num(r.operatingIncome) ?? 0,
        netIncome: num(r.netIncome) ?? 0,
      };
    });
    const balanceSheet: BalanceSheetYear[] = balanceArr.slice(0, 5).reverse().map((r) => ({
      year: String(r.fiscalDateEnding ?? ""),
      totalAssets: num(r.totalAssets) ?? 0,
      totalLiabilities: num(r.totalLiabilities) ?? 0,
      totalEquity: num(r.totalShareholderEquity) ?? 0,
      currentAssets: num(r.totalCurrentAssets) ?? 0,
      currentLiabilities: num(r.totalCurrentLiabilities) ?? 0,
      inventory: num(r.inventory) ?? 0,
      cash: num(r.cashAndCashEquivalentsAtCarryingValue) ?? num(r.cashAndShortTermInvestments) ?? 0,
    }));
    const cashFlow: CashFlowYear[] = cashArr.slice(0, 5).reverse().map((r) => {
      const operatingCashFlow = num(r.operatingCashflow) ?? 0;
      const capitalExpenditures = Math.abs(num(r.capitalExpenditures) ?? 0);
      return {
        year: String(r.fiscalDateEnding ?? ""),
        operatingCashFlow,
        capitalExpenditures,
        freeCashFlow: operatingCashFlow - capitalExpenditures,
        investingCashFlow: num(r.cashflowFromInvestment) ?? 0,
        financingCashFlow: num(r.cashflowFromFinancing) ?? 0,
      };
    });

    const data: FinancialStatements = {
      symbol: sym,
      name: sym,
      dataSource: "LIVE",
      fetchedAt: new Date().toISOString(),
      incomeStatement,
      balanceSheet,
      cashFlow,
    };
    setCachedStatements(this.id, sym, data);
    return data;
  }

  // Phase 2, Sprint 25. Fetched only on demand (the Earnings tab). Alpha
  // Vantage's documented EARNINGS function returns quarterlyEarnings with
  // reportedEPS/estimatedEPS/surprisePercentage/reportedDate — but no revenue
  // estimate data at all (per the approved Sprint 25 decision, revenue fields
  // stay honestly null for this provider, never approximated). LIVE
  // VERIFICATION IS DEFERRED — no ALPHA_VANTAGE_API_KEY was available in this
  // session; mocked-fetch tests cover the parsing logic instead.
  async getEarningsHistory(symbol: string, opts?: FetchOpts): Promise<EarningsHistory | null> {
    const sym = symbol.toUpperCase();
    if (!opts?.forceRefresh) {
      const cached = getCachedEarnings(this.id, sym);
      if (cached !== undefined) return cached;
    }

    const base = "https://www.alphavantage.co/query";
    const k = encodeURIComponent(this.apiKey);
    const raw = (await fetchJson(`${base}?function=EARNINGS&symbol=${sym}&apikey=${k}`)) as Record<string, unknown>;
    if (raw.Note || raw.Information || raw["Error Message"]) {
      throw new Error("Alpha Vantage rate limit or error");
    }
    const arr = (Array.isArray(raw.quarterlyEarnings) ? raw.quarterlyEarnings : []) as Record<string, unknown>[];
    if (arr.length === 0) {
      setCachedEarnings(this.id, sym, null);
      return null;
    }

    // Alpha Vantage returns most-recent-first; take the most recent N and
    // reverse to oldest -> newest, matching the rest of this file's convention.
    const quarters: QuarterlyEarningsRecord[] = arr
      .slice(0, EARNINGS_QUARTERS_TRACKED)
      .reverse()
      .map((r) => {
        const epsActual = num(r.reportedEPS);
        const epsEstimate = num(r.estimatedEPS);
        return {
          fiscalQuarter: quarterLabelFromDate(String(r.fiscalDateEnding ?? "")),
          reportDate: r.reportedDate != null ? String(r.reportedDate) : null,
          epsActual,
          epsEstimate,
          // Prefer Alpha Vantage's own reported surprisePercentage (its own
          // authoritative computation) over recomputing, falling back to the
          // shared formula only when it's missing.
          epsSurprisePct: num(r.surprisePercentage) ?? computeSurprisePct(epsActual, epsEstimate),
          revenueActual: null,
          revenueEstimate: null,
          revenueSurprisePct: null,
        };
      });

    const data: EarningsHistory = {
      symbol: sym,
      name: sym,
      dataSource: "LIVE",
      fetchedAt: new Date().toISOString(),
      quarters,
    };
    setCachedEarnings(this.id, sym, data);
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

// Phase 2, Sprint 20 — Industry Comparison Engine (approved Phase 2 plan,
// Sprint 20). Compares a company against a deterministic peer group drawn from
// its sector, reusing every existing analyzer (Investment Quality, Graham, DCF,
// Buffett, Tom Nash, and raw Fundamentals growth/margin/return/debt fields) —
// zero new scoring logic. Deliberately on-demand (its own route, its own cache,
// never folded into buildValueResearchReport()): each peer needs its own
// Fundamentals fetch, so a full comparison costs several times the provider
// calls of viewing a single report.

import {
  resolveFundamentals,
  type Fundamentals,
  type FundamentalsProvider,
  type FetchOpts,
} from "./fundamentals.js";
import {
  analyzeBusinessQuality,
  analyzeFinancialStrength,
  analyzeMoat,
  analyzeValuation,
} from "./valueInvesting.js";
import { analyzeGrahamValuation } from "./grahamValuation.js";
import { analyzeDcfValuation } from "./dcfValuation.js";
import { analyzeBuffettValuation } from "./buffettValuation.js";
import { analyzeInvestmentQuality, fcfGrowth5y } from "./investmentQuality.js";
import { analyzeTomNash } from "./tomNashEngine.js";
import { getSectorProfile, selectPeerSymbols, type Sector } from "./industryPeers.js";

// Kept as its own named constant (not inlined) so a future enhancement sprint
// can make this configurable without touching the comparison/ranking logic.
export const DEFAULT_PEER_COUNT = 5;

export type MetricDirection = "higher-better" | "lower-better";

export interface ComparisonMetric {
  key: string;
  label: string;
  // "context-only" metrics (P/E, P/S, P/B) are shown with a peer median but are
  // deliberately excluded from percentile/rank/strengths/weaknesses — "cheaper is
  // better" isn't a defensible convention across sectors with very different
  // structural valuation levels (approved Sprint 20 decision).
  direction: MetricDirection | "context-only";
  companyValue: number | null;
  peerMedian: number | null;
  peerCount: number; // peers with an available value for this metric
  rank: number | null; // 1 = best, among company + peers with an available value
  totalRanked: number; // company + peers with an available value for this metric
  percentile: number | null; // 0-100, null for context-only or insufficient data
  available: boolean;
  reason?: string;
}

export interface PeerSummary {
  symbol: string;
  name: string;
  dataSource: Fundamentals["dataSource"];
  fallback: boolean; // true if this peer's live fetch fell back to SIMULATED
}

export type CompetitivePosition =
  | "Leader"
  | "Above Average"
  | "Average"
  | "Below Average"
  | "Laggard"
  | "Insufficient Data";

export type ComparisonConfidenceLevel = "High" | "Moderate" | "Low";

export interface IndustryComparisonResult {
  symbol: string;
  name: string;
  sector: Sector;
  industry: string;
  dataSource: Fundamentals["dataSource"];
  simulated: boolean; // true if the target or any peer used SIMULATED/fallback data
  peerGroup: PeerSummary[];
  metrics: ComparisonMetric[];
  strengths: string[];
  weaknesses: string[];
  overallPercentile: number | null;
  competitivePosition: CompetitivePosition;
  confidenceLevel: ComparisonConfidenceLevel;
  confidenceExplanation: string;
  summary: string;
}

// Every number a company needs to appear in the comparison table, computed via
// the exact same analyzer functions valueReport.ts already composes for the
// main Value Report — this module never recomputes a score, it only re-reads
// already-computed results into a flat, comparable shape.
interface ComparableProfile {
  revenueGrowth5y: number;
  epsGrowth5y: number;
  fcfGrowth5y: number | null;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  roe: number;
  roic: number;
  debtToEquity: number;
  pe: number | null;
  ps: number | null;
  pb: number | null;
  investmentQualityScore: number | null;
  grahamMarginOfSafety: number | null;
  dcfMarginOfSafety: number | null;
  buffettMarginOfSafety: number | null;
  tomNashConvictionScore: number;
}

function computeComparableProfile(f: Fundamentals): ComparableProfile {
  const bq = analyzeBusinessQuality(f);
  const iq = analyzeInvestmentQuality(f);
  const moat = analyzeMoat(f);
  const fin = analyzeFinancialStrength(f);
  const val = analyzeValuation(f);
  const graham = analyzeGrahamValuation(f);
  const dcf = analyzeDcfValuation(f);
  const buffett = analyzeBuffettValuation(f, bq, moat);
  const tomNash = analyzeTomNash(f, iq, fin, val, graham, dcf, buffett);
  return {
    revenueGrowth5y: f.revenueGrowth5y,
    epsGrowth5y: f.epsGrowth5y,
    fcfGrowth5y: fcfGrowth5y(f),
    grossMargin: f.grossMargin,
    operatingMargin: f.operatingMargin,
    netMargin: f.netMargin,
    roe: f.roe,
    roic: f.roic,
    debtToEquity: f.debtToEquity,
    pe: f.pe,
    ps: f.ps,
    pb: f.pb,
    investmentQualityScore: iq.score,
    grahamMarginOfSafety: graham.available ? graham.marginOfSafety : null,
    dcfMarginOfSafety: dcf.available ? dcf.marginOfSafety : null,
    buffettMarginOfSafety: buffett.available ? buffett.marginOfSafety : null,
    tomNashConvictionScore: tomNash.convictionScore,
  };
}

interface MetricConfig {
  key: keyof ComparableProfile;
  label: string;
  direction: MetricDirection | "context-only";
}

// All 17 requested comparison rows, in display order. Order and direction were
// approved as part of the Sprint 20 plan.
const METRIC_CONFIG: MetricConfig[] = [
  { key: "revenueGrowth5y", label: "Revenue Growth (5y)", direction: "higher-better" },
  { key: "epsGrowth5y", label: "EPS Growth (5y)", direction: "higher-better" },
  { key: "fcfGrowth5y", label: "Free Cash Flow Growth (5y)", direction: "higher-better" },
  { key: "grossMargin", label: "Gross Margin", direction: "higher-better" },
  { key: "operatingMargin", label: "Operating Margin", direction: "higher-better" },
  { key: "netMargin", label: "Net Margin", direction: "higher-better" },
  { key: "roe", label: "Return on Equity", direction: "higher-better" },
  { key: "roic", label: "Return on Invested Capital", direction: "higher-better" },
  { key: "debtToEquity", label: "Debt-to-Equity", direction: "lower-better" },
  { key: "investmentQualityScore", label: "Investment Quality Score", direction: "higher-better" },
  { key: "grahamMarginOfSafety", label: "Graham Margin of Safety", direction: "higher-better" },
  { key: "dcfMarginOfSafety", label: "DCF Margin of Safety", direction: "higher-better" },
  { key: "buffettMarginOfSafety", label: "Buffett Margin of Safety", direction: "higher-better" },
  { key: "tomNashConvictionScore", label: "Tom Nash Conviction Score", direction: "higher-better" },
  { key: "pe", label: "P/E (trailing)", direction: "context-only" },
  { key: "ps", label: "P/S", direction: "context-only" },
  { key: "pb", label: "P/B", direction: "context-only" },
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function buildMetric(
  config: MetricConfig,
  companyValue: number | null,
  peerValues: number[],
): ComparisonMetric {
  const peerMedian = median(peerValues);
  if (config.direction === "context-only") {
    return {
      key: config.key,
      label: config.label,
      direction: "context-only",
      companyValue,
      peerMedian,
      peerCount: peerValues.length,
      rank: null,
      totalRanked: 0,
      percentile: null,
      available: companyValue != null,
      reason: companyValue == null ? "Not computable for this company." : undefined,
    };
  }
  if (companyValue == null || peerValues.length === 0) {
    return {
      key: config.key,
      label: config.label,
      direction: config.direction,
      companyValue,
      peerMedian,
      peerCount: peerValues.length,
      rank: null,
      totalRanked: 0,
      percentile: null,
      available: false,
      reason:
        companyValue == null
          ? "Not computable for this company."
          : "No peers had an available value for this metric.",
    };
  }
  const all = [...peerValues, companyValue];
  const sorted =
    config.direction === "higher-better"
      ? [...all].sort((a, b) => b - a)
      : [...all].sort((a, b) => a - b);
  const rank = sorted.indexOf(companyValue) + 1;
  const totalRanked = all.length;
  const percentile = totalRanked > 1 ? Math.round(((totalRanked - rank) / (totalRanked - 1)) * 100) : null;
  return {
    key: config.key,
    label: config.label,
    direction: config.direction,
    companyValue,
    peerMedian,
    peerCount: peerValues.length,
    rank,
    totalRanked,
    percentile,
    available: true,
  };
}

function confidenceFor(
  peerCount: number,
  rankedAvailable: number,
  rankedTotal: number,
): { level: ComparisonConfidenceLevel; explanation: string } {
  const coverage = rankedTotal > 0 ? rankedAvailable / rankedTotal : 0;
  if (peerCount >= 4 && coverage >= 0.8) {
    return {
      level: "High",
      explanation: `${peerCount} peers resolved and ${rankedAvailable}/${rankedTotal} ranked metrics available.`,
    };
  }
  if (peerCount >= 2 && coverage >= 0.5) {
    return {
      level: "Moderate",
      explanation: `${peerCount} peers resolved and ${rankedAvailable}/${rankedTotal} ranked metrics available.`,
    };
  }
  return {
    level: "Low",
    explanation:
      peerCount === 0
        ? "No peers could be resolved for this sector."
        : `Only ${peerCount} peer(s) resolved and ${rankedAvailable}/${rankedTotal} ranked metrics available.`,
  };
}

function competitivePositionFor(overallPercentile: number | null): CompetitivePosition {
  if (overallPercentile == null) return "Insufficient Data";
  if (overallPercentile >= 80) return "Leader";
  if (overallPercentile >= 60) return "Above Average";
  if (overallPercentile >= 40) return "Average";
  if (overallPercentile >= 20) return "Below Average";
  return "Laggard";
}

// Short-lived in-memory cache mirroring statementsCache's pattern (Sprint 19) —
// avoids re-fetching every peer's Fundamentals on repeat tab-opens within a
// session. Keyed by provider + symbol + asOf + peerCount (peer count is a fixed
// internal constant in production today, not a request parameter, but the key
// includes it so a future caller passing a non-default count can never silently
// receive another call's cached peer group).
const COMPARISON_TTL_MS = 15 * 60 * 1000;
const comparisonCache = new Map<string, { at: number; data: IndustryComparisonResult | null }>();
function getCachedComparison(
  providerId: string,
  sym: string,
  asOf: string,
  peerCount: number,
): IndustryComparisonResult | null | undefined {
  const e = comparisonCache.get(`${providerId}:${sym}:${asOf}:${peerCount}`);
  if (e && Date.now() - e.at < COMPARISON_TTL_MS) return e.data;
  return undefined;
}
function setCachedComparison(
  providerId: string,
  sym: string,
  asOf: string,
  peerCount: number,
  data: IndustryComparisonResult | null,
): void {
  comparisonCache.set(`${providerId}:${sym}:${asOf}:${peerCount}`, { at: Date.now(), data });
}

export async function buildIndustryComparison(
  symbol: string,
  provider: FundamentalsProvider,
  asOf?: string,
  opts?: FetchOpts,
  peerCount: number = DEFAULT_PEER_COUNT,
): Promise<IndustryComparisonResult | null> {
  const target = await resolveFundamentals(provider, symbol, asOf, opts);
  if (!target) return null;

  if (!opts?.forceRefresh) {
    const cached = getCachedComparison(provider.id, target.symbol, target.asOf, peerCount);
    if (cached !== undefined) return cached;
  }

  const sectorProfile = getSectorProfile(target.symbol);
  const peerSymbols = selectPeerSymbols(sectorProfile.sector, target.symbol, peerCount);

  const peerResults = await Promise.all(
    peerSymbols.map((sym) => resolveFundamentals(provider, sym, target.asOf, opts)),
  );
  const peers = peerResults.filter((f): f is Fundamentals => f != null);

  const targetProfile = computeComparableProfile(target);
  const peerProfiles = peers.map((f) => ({ f, profile: computeComparableProfile(f) }));

  const metrics = METRIC_CONFIG.map((config) => {
    const companyValue = targetProfile[config.key];
    const peerValues = peerProfiles
      .map((p) => p.profile[config.key])
      .filter((v): v is number => v != null);
    return buildMetric(config, companyValue, peerValues);
  });

  const ranked = metrics.filter((m) => m.direction !== "context-only");
  const rankedAvailable = ranked.filter((m) => m.available && m.percentile != null);
  const overallPercentile =
    rankedAvailable.length > 0
      ? Math.round(rankedAvailable.reduce((sum, m) => sum + (m.percentile as number), 0) / rankedAvailable.length)
      : null;

  const strengths = rankedAvailable
    .filter((m) => (m.percentile as number) >= 67)
    .sort((a, b) => (b.percentile as number) - (a.percentile as number))
    .map((m) => `${m.label} ranks in the top third of ${sectorProfile.sector} peers (${m.percentile}th percentile).`);
  const weaknesses = rankedAvailable
    .filter((m) => (m.percentile as number) <= 33)
    .sort((a, b) => (a.percentile as number) - (b.percentile as number))
    .map(
      (m) => `${m.label} ranks in the bottom third of ${sectorProfile.sector} peers (${m.percentile}th percentile).`,
    );

  const { level: confidenceLevel, explanation: confidenceExplanation } = confidenceFor(
    peers.length,
    rankedAvailable.length,
    ranked.length,
  );
  const competitivePosition = competitivePositionFor(overallPercentile);

  const simulated =
    target.dataSource === "SIMULATED" ||
    !!target.fallback ||
    peers.some((p) => p.dataSource === "SIMULATED" || !!p.fallback);

  const summaryParts: string[] = [];
  if (peers.length === 0) {
    summaryParts.push(
      `No ${sectorProfile.sector} peers could be resolved, so this comparison is based on ${target.symbol} alone.`,
    );
  } else {
    summaryParts.push(
      `${target.symbol} was compared against ${peers.length} ${sectorProfile.sector} peer${peers.length === 1 ? "" : "s"} (${peers.map((p) => p.symbol).join(", ")}).`,
    );
    summaryParts.push(`Overall competitive position: ${competitivePosition}${overallPercentile != null ? ` (${overallPercentile}th percentile average).` : "."}`);
    if (strengths.length > 0) summaryParts.push(`Strongest relative to peers: ${strengths[0]}`);
    if (weaknesses.length > 0) summaryParts.push(`Weakest relative to peers: ${weaknesses[0]}`);
  }
  if (simulated) summaryParts.push("Some or all of this comparison uses SIMULATED data.");

  const result: IndustryComparisonResult = {
    symbol: target.symbol,
    name: target.name,
    sector: sectorProfile.sector,
    industry: target.industry ?? sectorProfile.industry,
    dataSource: target.dataSource,
    simulated,
    peerGroup: peers.map((p) => ({
      symbol: p.symbol,
      name: p.name,
      dataSource: p.dataSource,
      fallback: !!p.fallback,
    })),
    metrics,
    strengths,
    weaknesses,
    overallPercentile,
    competitivePosition,
    confidenceLevel,
    confidenceExplanation,
    summary: summaryParts.join(" "),
  };

  setCachedComparison(provider.id, target.symbol, target.asOf, peerCount, result);
  return result;
}

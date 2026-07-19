// Phase 15 — Institutional Opportunity Discovery Engine.
//
// PURE ORCHESTRATION LAYER. This module builds no new valuation model, no new
// quality scoring, and no new financial ratio — every number attached to an
// OpportunityRow is read directly off the already-resolved Fundamentals (Phase
// 2/13/29) or an already-built ValueResearchReport (Phase 2, Sprints 12-31), or
// is the Decision Engine's own already-computed synthesis score/recommendation
// (Phase 14, lib/decisionEngine.ts, reused via its exported
// decisionSynthesisScore()/deriveRecommendation() — never recomputed here). The
// scan universe is the union of the two already-shipped symbol lists this
// codebase already maintains (lib/investingUniverse.ts's INVESTING_UNIVERSE and
// lib/industryPeers.ts's SECTOR_PEER_UNIVERSE) — no new symbol list is invented.
//
// The one genuinely new logic in this file:
//   - A deterministic screener (pure filtering over already-computed fields).
//     The "Country" filter is accepted but never actually applied — no
//     provider (SIMULATED or LIVE) surfaces a country/currency field anywhere
//     in Fundamentals, so honestly reporting it unavailable (via
//     `unavailableFilters`) is the only never-fabricate-compliant option.
//   - A ranking order (sort by the Decision Engine's own synthesis score,
//     descending — not a new score, a reuse of an existing one) plus a
//     deterministic "why it ranks here" sentence quoting real numbers already
//     on the row.
//   - Ten named opportunity buckets, each a disclosed, deterministic
//     threshold/set rule over already-computed fields (see
//     docs/Opportunity-Discovery.md for the exact rule per bucket) — never a
//     new scoring formula, never a price forecast, never a probability.
//
// A scan is a genuinely heavier operation than a single-symbol report (up to
// ~70 report builds), so per the on-demand-for-heavier-operations discipline
// this codebase has followed since Phase 2 Sprints 19-20 (Financial
// Statements, Industry Comparison) and reaffirmed by the Cross-Engine Daily
// Report (Phase 4, Sprint 68), scanning is an explicit, user-triggered action
// — never run eagerly on every page load.
//
// DETERMINISTIC ONLY: zero LLM calls, zero price forecasting, zero
// probability guessing anywhere in this file.

import { resolveFundamentals, type Fundamentals, type FundamentalsProvider } from "./fundamentals.js";
import { buildValueResearchReport, type ValueResearchReport } from "./valueReport.js";
import {
  decisionSynthesisScore,
  deriveRecommendation,
  type DecisionRecommendation,
  type ManagementQualityResult,
} from "./decisionEngine.js";
import type { ValuationRating, MoatRating, FinancialStrengthRating } from "./valueInvesting.js";
import type { CommitteeVerdict } from "./investmentCommittee.js";
import type { TomNashVerdict } from "./tomNashEngine.js";
import { INVESTING_UNIVERSE } from "./investingUniverse.js";
import { SECTOR_PEER_UNIVERSE } from "./industryPeers.js";

// Opportunity Discovery never fetches Management Quality (an EDGAR filing
// fetch) per scanned symbol — running that for dozens of symbols on every
// scan would be prohibitively expensive and contradicts the on-demand-for-
// heavier-operations discipline described above. Every scanned row's
// recommendation is therefore computed the same honest way: Management
// Quality is explicitly marked unavailable for the purposes of the scan
// (never fabricated), and a user who wants the full picture — including
// Management Quality and portfolio-fit context — is one click away via the
// existing Decision Engine page (see "Analyse" in the UI).
const SCAN_MANAGEMENT_QUALITY_PLACEHOLDER: ManagementQualityResult = {
  available: false,
  score: null,
  reason:
    "Not evaluated during a portfolio-wide scan — open the full Decision Engine page for this symbol for a Management Quality read.",
};

// ─── Scan universe ──────────────────────────────────────────────────────────

// Union of the two existing, already-shipped symbol lists this codebase
// maintains — no new universe is invented for this phase. INVESTING_UNIVERSE
// is the Investing Engine's own default coverage (Phase 2, Sprint 11);
// SECTOR_PEER_UNIVERSE is the ~63-symbol, 11-sector taxonomy already used for
// Industry Comparison peer selection (Phase 2, Sprint 20).
export function getOpportunityScanUniverse(): string[] {
  const symbols = new Set<string>();
  for (const u of INVESTING_UNIVERSE) symbols.add(u.symbol);
  for (const peers of Object.values(SECTOR_PEER_UNIVERSE)) {
    for (const s of peers) symbols.add(s);
  }
  return [...symbols].sort();
}

// ─── Opportunity row ────────────────────────────────────────────────────────

export interface OpportunityRow {
  symbol: string;
  name: string;
  kind: string;
  price: number;
  sector: string | null;
  industry: string | null;

  businessQualityScore: number;
  businessQualityRating: string;
  investmentQualityScore: number | null;
  moatRating: MoatRating;
  moatScore: number;
  competitiveAdvantageScore: number | null;
  financialStrengthRating: FinancialStrengthRating;
  financialStrengthScore: number;

  valuationRating: ValuationRating | "Unavailable";
  marginOfSafety: number | null; // consolidated average across Blended/Graham/DCF/Buffett

  marketCap: number | null;
  revenueGrowth5y: number;
  roic: number;
  roe: number;
  debtToEquity: number;
  fcfMargin: number;
  dividendYield: number;

  investmentCommitteeVerdict: CommitteeVerdict;
  investmentCommitteeConfidence: number;
  tomNashConvictionScore: number;
  tomNashVerdict: TomNashVerdict;

  decisionRecommendation: DecisionRecommendation;
  rankScore: number; // reused directly from the Decision Engine's own synthesis score
  rankExplanation: string;

  dataSource: string;
  fetchedAt: string;
  simulated: boolean;
}

// Pure — re-expresses an already-resolved Fundamentals + already-built
// ValueResearchReport pair as a compact, scannable/rankable row. Mirrors
// routes/stockAnalyst.ts's own summaryFromReport() precedent, extended with
// the Phase 12-14 fields that helper predates (Investment Quality,
// Competitive Advantage, the consolidated Margin of Safety, Tom Nash, the
// Investment Committee, and the Decision Engine's own
// recommendation/synthesis score).
export function buildOpportunityRow(f: Fundamentals, report: ValueResearchReport): OpportunityRow {
  const rankScore = decisionSynthesisScore(report, SCAN_MANAGEMENT_QUALITY_PLACEHOLDER);
  const { recommendation } = deriveRecommendation(report, rankScore, null);
  return {
    symbol: report.symbol,
    name: report.name,
    kind: report.kind,
    price: report.price,
    sector: report.sector,
    industry: report.industry,

    businessQualityScore: report.businessQuality.score,
    businessQualityRating: report.businessQuality.rating,
    investmentQualityScore: report.investmentQuality.score,
    moatRating: report.moat.rating,
    moatScore: report.moat.score,
    competitiveAdvantageScore: report.competitiveAdvantage.score,
    financialStrengthRating: report.financialStrength.rating,
    financialStrengthScore: report.financialStrength.score,

    valuationRating: report.valuation.available ? report.valuation.rating : "Unavailable",
    marginOfSafety: report.consolidatedMarginOfSafety.averageMarginOfSafety,

    marketCap: f.marketCap,
    revenueGrowth5y: f.revenueGrowth5y,
    roic: f.roic,
    roe: f.roe,
    debtToEquity: f.debtToEquity,
    fcfMargin: f.fcfMargin,
    dividendYield: f.dividendYield,

    investmentCommitteeVerdict: report.investmentCommittee.consolidatedVerdict,
    investmentCommitteeConfidence: report.investmentCommittee.confidenceScore,
    tomNashConvictionScore: report.tomNash.convictionScore,
    tomNashVerdict: report.tomNash.verdict,

    decisionRecommendation: recommendation,
    rankScore,
    rankExplanation: buildRankExplanation(report, rankScore, recommendation),

    dataSource: report.dataSource,
    fetchedAt: report.fetchedAt,
    simulated: report.simulated,
  };
}

// Deterministic, rule-based — quotes real, already-computed numbers off the
// row itself. Never a new judgment, never an LLM call.
function buildRankExplanation(
  report: ValueResearchReport,
  rankScore: number,
  recommendation: DecisionRecommendation,
): string {
  const mos = report.consolidatedMarginOfSafety.averageMarginOfSafety;
  const mosText =
    mos != null
      ? `a ${mos >= 0 ? "" : "negative "}${(mos * 100).toFixed(0)}% average margin of safety`
      : "no computable margin of safety";
  return (
    `${report.symbol} ranks with a synthesis score of ${rankScore}/100 (Decision Engine: ${recommendation}), ` +
    `driven by a Tom Nash conviction score of ${report.tomNash.convictionScore}/100 and an Investment Committee ` +
    `verdict of ${report.investmentCommittee.consolidatedVerdict}, against ${mosText}.`
  );
}

// ─── Scan orchestration ─────────────────────────────────────────────────────

export interface OpportunityScanOptions {
  symbols?: string[]; // defaults to getOpportunityScanUniverse()
  forceRefresh?: boolean;
}

export interface OpportunityScanResult {
  rows: OpportunityRow[];
  universeSize: number;
  unresolvedSymbols: string[]; // symbols that failed to resolve fundamentals — never silently dropped without disclosure
  scannedAt: string;
}

// The actual per-symbol work: resolve Fundamentals once, then hand that exact
// snapshot into buildValueResearchReport() via its fundamentalsOverride
// parameter so the report pipeline never re-fetches — the same "resolve once,
// reuse everywhere" discipline every other multi-analyzer composition in this
// codebase already follows.
async function buildRowForSymbol(
  symbol: string,
  provider: FundamentalsProvider,
  opts: { forceRefresh?: boolean } | undefined,
  userId: string | undefined,
): Promise<OpportunityRow | null> {
  const f = await resolveFundamentals(provider, symbol, undefined, opts);
  if (!f) return null;
  const report = await buildValueResearchReport(symbol, f.asOf, provider, f, opts, userId);
  if (!report) return null;
  return buildOpportunityRow(f, report);
}

export async function scanOpportunities(
  provider: FundamentalsProvider,
  options?: OpportunityScanOptions,
  userId?: string,
): Promise<OpportunityScanResult> {
  const symbols = options?.symbols ?? getOpportunityScanUniverse();
  const settled = await Promise.all(
    symbols.map((s) => buildRowForSymbol(s, provider, { forceRefresh: options?.forceRefresh }, userId)),
  );
  const rows: OpportunityRow[] = [];
  const unresolvedSymbols: string[] = [];
  settled.forEach((row, i) => {
    if (row) rows.push(row);
    else unresolvedSymbols.push(symbols[i]);
  });
  return { rows, universeSize: symbols.length, unresolvedSymbols, scannedAt: new Date().toISOString() };
}

// ─── Screener ───────────────────────────────────────────────────────────────

export interface OpportunityScreenerFilters {
  // Country has no backing data anywhere in Fundamentals for any provider
  // (SIMULATED or LIVE) — never fabricated. Accepted here only so the request
  // shape matches the 17 requested filter dimensions; supplying it always adds
  // "country" to the response's unavailableFilters, and it is never actually
  // applied to any row.
  country?: string;
  sector?: string;
  industry?: string;
  minMarketCap?: number;
  maxMarketCap?: number;
  minRevenueGrowth?: number;
  minRoic?: number;
  minRoe?: number;
  maxDebtToEquity?: number;
  minFcfMargin?: number;
  minDividendYield?: number;
  valuationRatings?: (ValuationRating | "Unavailable")[];
  minMarginOfSafety?: number;
  minBusinessQualityScore?: number;
  investmentCommitteeVerdicts?: CommitteeVerdict[];
  decisionRecommendations?: DecisionRecommendation[];
  minTomNashScore?: number;
}

export interface OpportunityScreenerResult {
  rows: OpportunityRow[];
  unavailableFilters: string[];
  totalBeforeFilter: number;
}

// Pure filtering — every predicate reads an already-computed field on the
// row. Never invents a number, never re-scores anything.
export function applyScreenerFilters(
  rows: OpportunityRow[],
  filters: OpportunityScreenerFilters,
): OpportunityScreenerResult {
  const unavailableFilters: string[] = [];
  if (filters.country != null && filters.country.trim() !== "") unavailableFilters.push("country");

  const filtered = rows.filter((r) => {
    if (filters.sector && r.sector !== filters.sector) return false;
    if (filters.industry && r.industry !== filters.industry) return false;
    if (filters.minMarketCap != null && (r.marketCap == null || r.marketCap < filters.minMarketCap)) return false;
    if (filters.maxMarketCap != null && (r.marketCap == null || r.marketCap > filters.maxMarketCap)) return false;
    if (filters.minRevenueGrowth != null && r.revenueGrowth5y < filters.minRevenueGrowth) return false;
    if (filters.minRoic != null && r.roic < filters.minRoic) return false;
    if (filters.minRoe != null && r.roe < filters.minRoe) return false;
    if (filters.maxDebtToEquity != null && r.debtToEquity > filters.maxDebtToEquity) return false;
    if (filters.minFcfMargin != null && r.fcfMargin < filters.minFcfMargin) return false;
    if (filters.minDividendYield != null && r.dividendYield < filters.minDividendYield) return false;
    if (filters.valuationRatings?.length && !filters.valuationRatings.includes(r.valuationRating)) return false;
    if (filters.minMarginOfSafety != null && (r.marginOfSafety == null || r.marginOfSafety < filters.minMarginOfSafety)) return false;
    if (filters.minBusinessQualityScore != null && r.businessQualityScore < filters.minBusinessQualityScore) return false;
    if (filters.investmentCommitteeVerdicts?.length && !filters.investmentCommitteeVerdicts.includes(r.investmentCommitteeVerdict)) return false;
    if (filters.decisionRecommendations?.length && !filters.decisionRecommendations.includes(r.decisionRecommendation)) return false;
    if (filters.minTomNashScore != null && r.tomNashConvictionScore < filters.minTomNashScore) return false;
    return true;
  });

  return { rows: filtered, unavailableFilters, totalBeforeFilter: rows.length };
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

// Sort by the Decision Engine's own synthesis score, descending — reused, not
// invented. Ties broken alphabetically by symbol for a stable, deterministic
// order.
export function rankOpportunities(rows: OpportunityRow[]): OpportunityRow[] {
  return [...rows].sort((a, b) => b.rankScore - a.rankScore || a.symbol.localeCompare(b.symbol));
}

// ─── Opportunity Dashboard buckets ──────────────────────────────────────────

export type OpportunityCategory =
  | "top-opportunities"
  | "undervalued"
  | "high-quality"
  | "wide-moat"
  | "dividend"
  | "growth"
  | "deep-value"
  | "turnaround"
  | "watchlist-candidates"
  | "portfolio-upgrade-candidates";

export interface OpportunityBucket {
  category: OpportunityCategory;
  label: string;
  rule: string; // the disclosed, deterministic rule this bucket applies — always shown in the UI
  rows: OpportunityRow[];
}

export interface OpportunityBucketContext {
  watchlistSymbols?: string[]; // this user's own Watchlist symbols (uppercased) — for "Watchlist Candidates"
  portfolioSymbols?: string[]; // a selected portfolio's own held symbols (uppercased) — for "Portfolio Upgrade Candidates"
}

const TOP_N = 10;

// Ten named buckets, each a disclosed, deterministic threshold/set rule over
// fields already on OpportunityRow — never a new score. See
// docs/Opportunity-Discovery.md for the full rationale per bucket.
export function bucketOpportunities(
  rows: OpportunityRow[],
  context?: OpportunityBucketContext,
): OpportunityBucket[] {
  const ranked = rankOpportunities(rows);
  const watchlist = new Set((context?.watchlistSymbols ?? []).map((s) => s.toUpperCase()));
  const portfolio = new Set((context?.portfolioSymbols ?? []).map((s) => s.toUpperCase()));

  const buckets: OpportunityBucket[] = [
    {
      category: "top-opportunities",
      label: "Top Opportunities",
      rule: `Highest Decision Engine synthesis score among a Buy/Accumulate recommendation, top ${TOP_N}.`,
      rows: ranked.filter((r) => r.decisionRecommendation === "Buy" || r.decisionRecommendation === "Accumulate").slice(0, TOP_N),
    },
    {
      category: "undervalued",
      label: "Undervalued Companies",
      rule: "Consolidated margin of safety >= 15% (Valuation rating Cheap), sorted by margin of safety descending.",
      rows: [...rows]
        .filter((r) => r.marginOfSafety != null && r.marginOfSafety >= 0.15)
        .sort((a, b) => (b.marginOfSafety ?? 0) - (a.marginOfSafety ?? 0)),
    },
    {
      category: "high-quality",
      label: "High Quality Companies",
      rule: "Investment Quality score >= 70, sorted by score descending.",
      rows: [...rows]
        .filter((r) => r.investmentQualityScore != null && r.investmentQualityScore >= 70)
        .sort((a, b) => (b.investmentQualityScore ?? 0) - (a.investmentQualityScore ?? 0)),
    },
    {
      category: "wide-moat",
      label: "Wide Moat Companies",
      rule: 'Moat rating = "Wide", sorted by moat score descending.',
      rows: [...rows].filter((r) => r.moatRating === "Wide").sort((a, b) => b.moatScore - a.moatScore),
    },
    {
      category: "dividend",
      label: "Dividend Opportunities",
      rule: "Dividend yield >= 2%, sorted by yield descending.",
      rows: [...rows].filter((r) => r.dividendYield >= 0.02).sort((a, b) => b.dividendYield - a.dividendYield),
    },
    {
      category: "growth",
      label: "Growth Opportunities",
      rule: "5-year revenue growth >= 15%, sorted by growth descending.",
      rows: [...rows].filter((r) => r.revenueGrowth5y >= 0.15).sort((a, b) => b.revenueGrowth5y - a.revenueGrowth5y),
    },
    {
      category: "deep-value",
      label: "Deep Value Opportunities",
      rule: "Consolidated margin of safety >= 30% AND Business Quality score >= 42 (avoids likely value traps), sorted by margin of safety descending.",
      rows: [...rows]
        .filter((r) => r.marginOfSafety != null && r.marginOfSafety >= 0.3 && r.businessQualityScore >= 42)
        .sort((a, b) => (b.marginOfSafety ?? 0) - (a.marginOfSafety ?? 0)),
    },
    {
      category: "turnaround",
      label: "Turnaround Candidates",
      rule: 'Business Quality rating "Weak" or "Average" but a positive margin of safety and Financial Strength not "Risky" — currently out of favor but not distressed. A heuristic bucket for further research, never a prediction.',
      rows: [...rows].filter(
        (r) =>
          (r.businessQualityRating === "Weak" || r.businessQualityRating === "Average") &&
          r.marginOfSafety != null &&
          r.marginOfSafety > 0 &&
          r.financialStrengthRating !== "Risky",
      ),
    },
    {
      category: "watchlist-candidates",
      label: "Watchlist Candidates",
      rule: "A Buy/Accumulate recommendation for a symbol not already on this user's Watchlist.",
      rows: watchlist.size
        ? ranked.filter(
            (r) =>
              (r.decisionRecommendation === "Buy" || r.decisionRecommendation === "Accumulate") &&
              !watchlist.has(r.symbol.toUpperCase()),
          )
        : ranked.filter((r) => r.decisionRecommendation === "Buy" || r.decisionRecommendation === "Accumulate"),
    },
    {
      category: "portfolio-upgrade-candidates",
      label: "Portfolio Upgrade Candidates",
      rule: 'A "Buy" recommendation for a symbol not already held in the selected portfolio, sorted by synthesis score descending. Unavailable (empty) unless a portfolio was supplied.',
      rows: portfolio.size ? ranked.filter((r) => r.decisionRecommendation === "Buy" && !portfolio.has(r.symbol.toUpperCase())) : [],
    },
  ];

  return buckets;
}

// ─── Comparison view ────────────────────────────────────────────────────────

export interface OpportunityComparisonResult {
  rows: OpportunityRow[];
  bestBy: Record<string, string>; // dimension label -> symbol with the best already-computed value
}

// Pure, presentational only — highlights which compared symbol has the best
// value for each already-computed numeric dimension. No new scoring.
export function compareOpportunities(rows: OpportunityRow[]): OpportunityComparisonResult {
  const bestBy: Record<string, string> = {};
  if (rows.length === 0) return { rows, bestBy };

  const pickMax = (label: string, get: (r: OpportunityRow) => number | null) => {
    let best: OpportunityRow | null = null;
    for (const r of rows) {
      const v = get(r);
      if (v == null) continue;
      if (best == null || v > (get(best) as number)) best = r;
    }
    if (best) bestBy[label] = best.symbol;
  };
  const pickMin = (label: string, get: (r: OpportunityRow) => number | null) => {
    let best: OpportunityRow | null = null;
    for (const r of rows) {
      const v = get(r);
      if (v == null) continue;
      if (best == null || v < (get(best) as number)) best = r;
    }
    if (best) bestBy[label] = best.symbol;
  };

  pickMax("Decision Engine Synthesis Score", (r) => r.rankScore);
  pickMax("Business Quality", (r) => r.businessQualityScore);
  pickMax("Investment Quality", (r) => r.investmentQualityScore);
  pickMax("Margin of Safety", (r) => r.marginOfSafety);
  pickMax("Tom Nash Conviction", (r) => r.tomNashConvictionScore);
  pickMax("Revenue Growth (5y)", (r) => r.revenueGrowth5y);
  pickMax("ROIC", (r) => r.roic);
  pickMax("Dividend Yield", (r) => r.dividendYield);
  pickMin("Debt/Equity", (r) => r.debtToEquity);

  return { rows, bestBy };
}

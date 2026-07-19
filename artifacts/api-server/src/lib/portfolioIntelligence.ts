// Phase 13 — Institutional Portfolio Manager. The single, on-demand
// composition layer over every already-shipped analytical engine, producing
// Quality/Capital-Allocation scoring, allocation breakdowns (sector,
// industry, market cap), extended risk dimensions, performance analytics,
// income/dividend analytics, and a position-sizing/rebalancing assistant for
// one portfolio.
//
// REUSE, NOT DUPLICATION — every number here comes from an already-shipped,
// already-tested module:
//   - buildPortfolioAllocation() (Phase 2, Sprint 28/29) for price/market
//     value/target-vs-actual weight/drift/sector/industry/beta/marketCap —
//     called exactly once, unmodified.
//   - computePortfolioRiskFromAllocation() (Phase 2, Sprint 29) for
//     concentration/sector-exposure/beta(cyclicality) scoring — called
//     exactly once, unmodified, over the same allocation this module already
//     resolved (zero duplicate provider calls).
//   - buildValueResearchReport() (Phase 2, Sprints 12-31) for each distinct
//     holding's Investment Quality score, Tom Nash Capital Allocation
//     pillar, Tom Nash Growth pillar, blended Valuation rating, and
//     Investment Committee verdict — called once per DISTINCT symbol, fed
//     the already-resolved Fundamentals via `fundamentalsOverride` so it
//     performs zero second fetch for the same symbol.
//
// ON-DEMAND, NOT EAGER, PER PHASE 2 SPRINT 19-20 PRECEDENT: this module
// composes buildValueResearchReport() once per distinct holding — real,
// non-trivial analyzer work — so it lives behind its own route
// (GET /portfolio-construction/portfolios/:id/intelligence), never folded
// into the eager portfolio-detail view the way the cheap
// sector/industry/market-cap fields themselves were (those ride along on
// buildPortfolioAllocation()'s own existing, already-eager resolution).
//
// NEVER-FABRICATE DISCIPLINE: Country and Currency exposure are always
// honestly `available: false` — no provider anywhere in this codebase models
// either dimension for any symbol, so no attempt is made to approximate one
// from sector/industry (the same discipline Competitive Advantage's Customer
// Concentration Risk and Investment Quality's Insider Ownership metric
// already established for a permanently-unavailable dimension). A holding's
// Performance figures are honestly null whenever `avgCostBasis`/`shares`
// weren't entered — never approximated from the current price.
//
// DETERMINISTIC ONLY: zero LLM calls anywhere in this module.

import { resolveFundamentals, type Fundamentals, type FundamentalsProvider } from "./fundamentals.js";
import { buildValueResearchReport, type ValueResearchReport } from "./valueReport.js";
import {
  buildPortfolioAllocation,
  type PortfolioHoldingInput,
  type PortfolioAllocationResult,
} from "./portfolioConstruction.js";
import {
  computePortfolioRiskFromAllocation,
  band,
  gradeLabel,
  type PortfolioRiskAnalysis,
} from "./investingRisk.js";

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

export interface PortfolioScoreCard {
  score: number | null;
  label: string;
  detail: string;
}

export interface AllocationSlice {
  label: string;
  weightPct: number;
}

export interface PortfolioHoldingIntelligence {
  symbol: string;
  weightPct: number | null;
  qualityScore: number | null;
  capitalAllocationScore: number | null;
  growthScore: number | null;
  valuationRating: string | null; // "Cheap" | "Fair" | "Expensive" | "Very Expensive" | null when unavailable
  committeeVerdict: string | null; // "Buy" | "Hold" | "Wait" | null when unavailable
  marketCapBand: string | null;

  // Performance (Phase 13's one new schema field: investing_holdings.avg_cost_basis).
  shares: number | null;
  avgCostBasis: number | null;
  currentPrice: number | null;
  costBasisValue: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;

  // Income.
  dividendYield: number | null; // fraction
  dividendPerShare: number | null;
  estAnnualDividendIncome: number | null;

  // Position sizing / rebalancing assistant — the concrete share count
  // implied by the drift already computed in buildPortfolioAllocation()
  // (targetWeightPct vs actualWeightPct), not a new judgment.
  suggestedShareDelta: number | null; // positive => buy this many more shares, negative => sell
}

export interface PortfolioIntelligenceAnalysis {
  qualityScore: PortfolioScoreCard;
  capitalAllocationScore: PortfolioScoreCard;
  diversificationScore: PortfolioScoreCard;

  weightedMetrics: {
    roic: number | null;
    roe: number | null;
    grossMargin: number | null;
    operatingMargin: number | null;
    fcfYield: number | null;
    dividendYield: number | null;
    debtToEquity: number | null;
  };

  allocation: {
    bySector: AllocationSlice[];
    byIndustry: AllocationSlice[];
    byMarketCapBand: AllocationSlice[];
    byCountry: { available: false; reason: string };
    byCurrency: { available: false; reason: string };
    growthValueMix: AllocationSlice[]; // "Growth" | "Value" | "Blend"
    qualityMix: AllocationSlice[]; // "High Quality" | "Medium Quality" | "Low Quality"
    largestPositionPct: number | null;
    top10ExposurePct: number | null;
    cashAllocationPct: number | null;
    cashAllocationNote: string;
  };

  risk: {
    overall: PortfolioRiskAnalysis["overall"];
    concentration: PortfolioRiskAnalysis["concentration"];
    sectorExposure: PortfolioRiskAnalysis["sectorExposure"];
    cyclicality: PortfolioRiskAnalysis["betaEstimate"];
    cashRisk: PortfolioScoreCard;
    dividendDependence: PortfolioScoreCard;
    leverageExposure: PortfolioScoreCard;
    qualityDrift: PortfolioScoreCard;
    portfolioStability: PortfolioScoreCard;
  };

  income: {
    portfolioDividendYield: number | null;
    estAnnualDividendIncome: number | null;
  };

  performance: {
    totalCostBasisValue: number | null;
    totalMarketValue: number | null;
    totalUnrealizedPnl: number | null;
    totalUnrealizedPnlPct: number | null;
    holdingsWithoutCostBasis: string[];
  };

  holdings: PortfolioHoldingIntelligence[];
  unresolvedSymbols: string[];
  summary: string;
}

function weightedAverage(items: { weight: number; value: number | null }[]): number | null {
  const usable = items.filter((i) => i.value != null && i.weight > 0);
  const totalWeight = usable.reduce((s, i) => s + i.weight, 0);
  if (totalWeight <= 0) return null;
  return round(usable.reduce((s, i) => s + (i.value as number) * i.weight, 0) / totalWeight, 4);
}

function marketCapBand(marketCap: number | null): string | null {
  if (marketCap == null) return null;
  if (marketCap >= 200e9) return "Mega Cap";
  if (marketCap >= 10e9) return "Large Cap";
  if (marketCap >= 2e9) return "Mid Cap";
  if (marketCap >= 300e6) return "Small Cap";
  return "Micro Cap";
}

// A disclosed heuristic, not a new judgment engine: reuses Tom Nash's own
// already-scored Growth pillar and the blended model's own already-computed
// valuation rating (both Phase 2 modules, unmodified) rather than inventing
// a third growth/value classifier.
function growthValueBucket(growthScore: number | null, valuationRating: string | null): string | null {
  if (growthScore == null) return null;
  if (growthScore >= 65) return "Growth";
  if ((valuationRating === "Cheap" || valuationRating === "Fair") && growthScore < 55) return "Value";
  return "Blend";
}

function qualityBucket(qualityScore: number | null): string | null {
  if (qualityScore == null) return null;
  if (qualityScore >= 75) return "High Quality";
  if (qualityScore >= 45) return "Medium Quality";
  return "Low Quality";
}

function toSlices(counts: Map<string, number>, totalWeight: number): AllocationSlice[] {
  if (totalWeight <= 0) return [];
  return [...counts.entries()]
    .map(([label, weight]) => ({ label, weightPct: round((weight / totalWeight) * 100) }))
    .sort((a, b) => b.weightPct - a.weightPct);
}

export interface PreviousPortfolioSnapshot {
  qualityScore: number | null;
  riskScore: number | null;
  diversificationScore: number | null;
}

export async function buildPortfolioIntelligence(
  holdings: PortfolioHoldingInput[],
  provider: FundamentalsProvider,
  previousSnapshot?: PreviousPortfolioSnapshot | null,
): Promise<PortfolioIntelligenceAnalysis> {
  const allocation: PortfolioAllocationResult = await buildPortfolioAllocation(holdings, provider);
  const risk = computePortfolioRiskFromAllocation(allocation.holdings);

  const distinctSymbols = [...new Set(holdings.map((h) => h.symbol))];
  const reports = new Map<string, ValueResearchReport>();
  const fundamentalsBySymbol = new Map<string, Fundamentals>();
  await Promise.all(
    distinctSymbols.map(async (symbol) => {
      const f = await resolveFundamentals(provider, symbol).catch(() => null);
      if (!f) return;
      fundamentalsBySymbol.set(symbol, f);
      const report = await buildValueResearchReport(symbol, f.asOf, provider, f).catch(() => null);
      if (report) reports.set(symbol, report);
    }),
  );

  const byId = new Map(allocation.holdings.map((h) => [h.id, h]));
  const priced = allocation.holdings.filter((h) => h.marketValue != null && h.marketValue! > 0);
  const totalMarketValue = allocation.totalMarketValue;

  // --- Per-holding composite intelligence -----------------------------
  const holdingIntel: PortfolioHoldingIntelligence[] = holdings.map((h) => {
    const a = byId.get(h.id);
    const f = fundamentalsBySymbol.get(h.symbol);
    const report = reports.get(h.symbol);

    const shares = h.shares ?? null;
    const avgCostBasis = h.avgCostBasis ?? null;
    const currentPrice = a?.currentPrice ?? null;
    const marketValue = a?.marketValue ?? null;
    const cbValue = shares != null && avgCostBasis != null ? round(shares * avgCostBasis) : null;
    const unrealizedPnl = cbValue != null && marketValue != null ? round(marketValue - cbValue) : null;
    const unrealizedPnlPct = unrealizedPnl != null && cbValue != null && cbValue > 0 ? round((unrealizedPnl / cbValue) * 100) : null;

    const dividendYield = f?.dividendYield ?? null;
    const dividendPerShare = f?.dividendPerShare ?? null;
    const estAnnualDividendIncome = shares != null && dividendPerShare != null ? round(shares * dividendPerShare) : null;

    let suggestedShareDelta: number | null = null;
    if (a?.driftPct != null && currentPrice != null && currentPrice > 0 && totalMarketValue != null) {
      const targetValue = (h.targetWeightPct / 100) * totalMarketValue;
      const targetShares = targetValue / currentPrice;
      suggestedShareDelta = round(targetShares - (shares ?? 0), 2);
    }

    const qualityScore = report?.investmentQuality.score ?? null;
    const capitalAllocationScore = report?.tomNash.capitalAllocation.score ?? null;
    const growthScore = report?.tomNash.growth.score ?? null;
    const valuationRating = report?.valuation.available ? report.valuation.rating : null;
    const committeeVerdict = report?.investmentCommittee.consolidatedVerdict ?? null;

    return {
      symbol: h.symbol,
      weightPct: a?.actualWeightPct ?? null,
      qualityScore,
      capitalAllocationScore,
      growthScore,
      valuationRating,
      committeeVerdict,
      marketCapBand: marketCapBand(a?.marketCap ?? null),
      shares,
      avgCostBasis,
      currentPrice,
      costBasisValue: cbValue,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPct,
      dividendYield,
      dividendPerShare,
      estAnnualDividendIncome,
      suggestedShareDelta,
    };
  });

  // --- Portfolio Quality / Capital Allocation scores -------------------
  const qualityItems = holdingIntel.map((h) => ({ weight: h.weightPct ?? 0, value: h.qualityScore }));
  const capAllocItems = holdingIntel.map((h) => ({ weight: h.weightPct ?? 0, value: h.capitalAllocationScore }));
  const qualityAvg = weightedAverage(qualityItems);
  const capAllocAvg = weightedAverage(capAllocItems);

  const qualityScore: PortfolioScoreCard =
    qualityAvg == null
      ? { score: null, label: "Insufficient data", detail: "No holding could be scored for Investment Quality — add resolvable symbols with shares or a target weight." }
      : { score: round(qualityAvg), label: gradeLabel(round(qualityAvg)), detail: `Market-value-weighted average Investment Quality score across ${qualityItems.filter((i) => i.value != null).length} of ${holdings.length} holding(s).` };

  const capitalAllocationScore: PortfolioScoreCard =
    capAllocAvg == null
      ? { score: null, label: "Insufficient data", detail: "No holding could be scored for Capital Allocation — add resolvable symbols with shares or a target weight." }
      : { score: round(capAllocAvg), label: gradeLabel(round(capAllocAvg)), detail: `Market-value-weighted average Tom Nash Capital Allocation pillar score across ${capAllocItems.filter((i) => i.value != null).length} of ${holdings.length} holding(s).` };

  // --- Weighted fundamental metrics ------------------------------------
  const wm = (field: keyof Fundamentals) =>
    weightedAverage(
      holdingIntel.map((h) => ({
        weight: h.weightPct ?? 0,
        value: (fundamentalsBySymbol.get(h.symbol)?.[field] as number | undefined) ?? null,
      })),
    );
  const weightedMetrics = {
    roic: wm("roic"),
    roe: wm("roe"),
    grossMargin: wm("grossMargin"),
    operatingMargin: wm("operatingMargin"),
    fcfYield: wm("fcfYield"),
    dividendYield: wm("dividendYield"),
    debtToEquity: wm("debtToEquity"),
  };

  // --- Allocation breakdowns --------------------------------------------
  const totalPriced = priced.reduce((s, h) => s + (h.marketValue ?? 0), 0);
  const sectorCounts = new Map<string, number>();
  const industryCounts = new Map<string, number>();
  const capCounts = new Map<string, number>();
  for (const h of priced) {
    if (h.sector) sectorCounts.set(h.sector, (sectorCounts.get(h.sector) ?? 0) + (h.marketValue ?? 0));
    if (h.industry) industryCounts.set(h.industry, (industryCounts.get(h.industry) ?? 0) + (h.marketValue ?? 0));
    const band_ = marketCapBand(h.marketCap ?? null);
    if (band_) capCounts.set(band_, (capCounts.get(band_) ?? 0) + (h.marketValue ?? 0));
  }
  const bySector = toSlices(sectorCounts, totalPriced);
  const byIndustry = toSlices(industryCounts, totalPriced);
  const byMarketCapBand = toSlices(capCounts, totalPriced);

  const gvCounts = new Map<string, number>();
  const qmCounts = new Map<string, number>();
  for (const h of holdingIntel) {
    const w = h.weightPct ?? 0;
    if (w <= 0) continue;
    const gv = growthValueBucket(h.growthScore, h.valuationRating);
    if (gv) gvCounts.set(gv, (gvCounts.get(gv) ?? 0) + w);
    const qm = qualityBucket(h.qualityScore);
    if (qm) qmCounts.set(qm, (qmCounts.get(qm) ?? 0) + w);
  }
  const gvTotal = [...gvCounts.values()].reduce((a, b) => a + b, 0);
  const qmTotal = [...qmCounts.values()].reduce((a, b) => a + b, 0);
  const growthValueMix = toSlices(gvCounts, gvTotal);
  const qualityMix = toSlices(qmCounts, qmTotal);

  const sortedByWeight = [...priced].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
  const largestPositionPct = totalPriced > 0 && sortedByWeight[0] ? round(((sortedByWeight[0].marketValue ?? 0) / totalPriced) * 100) : null;
  const top10ExposurePct =
    totalPriced > 0
      ? round((sortedByWeight.slice(0, 10).reduce((s, h) => s + (h.marketValue ?? 0), 0) / totalPriced) * 100)
      : null;

  // Cash allocation: honestly defined as the portion of TARGET weight not
  // assigned to any holding (never a claim about actual brokerage cash
  // balances, which this app has no way to observe) — clamped at 0, and
  // clearly labeled as such.
  const cashAllocationPct = Math.max(0, round(100 - allocation.totalTargetWeightPct));
  const cashAllocationNote =
    "Defined as unallocated target weight (100% minus the sum of this portfolio's target weights) — not a claim about an actual brokerage cash balance, which this app does not observe.";

  // --- Extended risk dimensions ------------------------------------------
  const cashRiskScore = round(band(cashAllocationPct, [[10, 90], [20, 70], [35, 45]], 20));
  const cashRisk: PortfolioScoreCard = {
    score: cashRiskScore,
    label: gradeLabel(cashRiskScore),
    detail:
      cashAllocationPct > 20
        ? `${cashAllocationPct}% of target weight is unallocated to any holding — this portfolio is meaningfully under-invested relative to its own targets.`
        : `${cashAllocationPct}% of target weight is unallocated — within a normal range.`,
  };

  const weightedDividendYieldPct = weightedMetrics.dividendYield != null ? round(weightedMetrics.dividendYield * 100, 2) : null;
  const dividendDependence: PortfolioScoreCard =
    weightedDividendYieldPct == null
      ? { score: null, label: "Insufficient data", detail: "No holding has a resolvable dividend yield." }
      : (() => {
          const score = round(band(weightedDividendYieldPct, [[2, 85], [4, 65], [6, 45]], 30));
          return {
            score,
            label: gradeLabel(score),
            detail: `Market-value-weighted dividend yield ${weightedDividendYieldPct}% — ${
              weightedDividendYieldPct >= 4
                ? "a meaningful share of this portfolio's return depends on continued dividend payments."
                : "dividend income is a modest share of this portfolio's expected return."
            }`,
          };
        })();

  const leverageExposure: PortfolioScoreCard =
    weightedMetrics.debtToEquity == null
      ? { score: null, label: "Insufficient data", detail: "No holding has a resolvable debt-to-equity ratio." }
      : (() => {
          const score = round(band(weightedMetrics.debtToEquity as number, [[0.3, 90], [0.7, 70], [1.5, 45]], 20));
          return {
            score,
            label: gradeLabel(score),
            detail: `Market-value-weighted debt-to-equity ${round(weightedMetrics.debtToEquity as number, 2)}× (${gradeLabel(score).toLowerCase()} leverage exposure).`,
          };
        })();

  let qualityDrift: PortfolioScoreCard;
  if (previousSnapshot?.qualityScore == null || qualityScore.score == null) {
    qualityDrift = {
      score: null,
      label: "Insufficient data",
      detail: "No prior saved snapshot to compare against yet — save a snapshot to start tracking quality drift over time.",
    };
  } else {
    const drift = round(qualityScore.score - previousSnapshot.qualityScore, 1);
    const driftLabel = drift <= -10 ? "Deteriorating" : drift >= 10 ? "Improving" : "Stable";
    qualityDrift = {
      score: round(Math.max(0, Math.min(100, 70 + drift))),
      label: driftLabel,
      detail: `Quality score moved ${drift >= 0 ? "+" : ""}${drift} points since the last saved snapshot (${previousSnapshot.qualityScore} → ${qualityScore.score}).`,
    };
  }

  const stabilityInputs = [risk.overall.score, qualityDrift.score].filter((v): v is number => v != null);
  const portfolioStability: PortfolioScoreCard =
    stabilityInputs.length === 0
      ? { score: null, label: "Insufficient data", detail: "Not enough data to assess portfolio stability yet." }
      : (() => {
          const score = round(stabilityInputs.reduce((a, b) => a + b, 0) / stabilityInputs.length);
          return {
            score,
            label: gradeLabel(score),
            detail: `Composite of overall portfolio risk and quality drift (only the signals currently available are blended).`,
          };
        })();

  // --- Diversification score (new composite — Herfindahl-based) ----------
  let diversificationScore: PortfolioScoreCard;
  if (totalPriced <= 0 || priced.length === 0) {
    diversificationScore = { score: null, label: "Insufficient data", detail: "No priced holdings — diversification cannot be scored." };
  } else {
    const hhi = priced.reduce((s, h) => s + ((h.marketValue ?? 0) / totalPriced) ** 2, 0);
    const distinctSectors = new Set(priced.map((h) => h.sector).filter((s): s is string => s != null)).size;
    const score = round(Math.max(0, Math.min(100, (1 - hhi) * 100)));
    diversificationScore = {
      score,
      label: gradeLabel(score),
      detail: `Based on position concentration (Herfindahl-Hirschman Index) across ${priced.length} priced holding(s) spanning ${distinctSectors} distinct sector(s).`,
    };
  }

  // --- Performance / income roll-ups --------------------------------------
  const holdingsWithoutCostBasis = holdingIntel.filter((h) => h.costBasisValue == null && h.shares != null).map((h) => h.symbol);
  const totalCostBasisValue = holdingIntel.some((h) => h.costBasisValue != null)
    ? round(holdingIntel.reduce((s, h) => s + (h.costBasisValue ?? 0), 0))
    : null;
  const totalUnrealizedPnl = totalCostBasisValue != null && totalMarketValue != null ? round(totalMarketValue - totalCostBasisValue) : null;
  const totalUnrealizedPnlPct = totalUnrealizedPnl != null && totalCostBasisValue != null && totalCostBasisValue > 0 ? round((totalUnrealizedPnl / totalCostBasisValue) * 100) : null;

  const estAnnualDividendIncome = holdingIntel.some((h) => h.estAnnualDividendIncome != null)
    ? round(holdingIntel.reduce((s, h) => s + (h.estAnnualDividendIncome ?? 0), 0))
    : null;

  const summary =
    holdings.length === 0
      ? "This portfolio has no holdings yet — add holdings to see quality, risk, and diversification analytics."
      : `${holdings.length} holding(s) analyzed. Quality: ${qualityScore.score != null ? `${qualityScore.score}/100 (${qualityScore.label})` : "unavailable"}. ` +
        `Overall risk: ${risk.overall.score != null ? `${risk.overall.score}/100 (${risk.overall.label})` : "unavailable"}. ` +
        `Diversification: ${diversificationScore.score != null ? `${diversificationScore.score}/100 (${diversificationScore.label})` : "unavailable"}.`;

  return {
    qualityScore,
    capitalAllocationScore,
    diversificationScore,
    weightedMetrics,
    allocation: {
      bySector,
      byIndustry,
      byMarketCapBand,
      byCountry: { available: false, reason: "No provider integrated in this codebase reports a holding's country of domicile/listing." },
      byCurrency: { available: false, reason: "No provider integrated in this codebase reports a holding's reporting or trading currency." },
      growthValueMix,
      qualityMix,
      largestPositionPct,
      top10ExposurePct,
      cashAllocationPct,
      cashAllocationNote,
    },
    risk: {
      overall: risk.overall,
      concentration: risk.concentration,
      sectorExposure: risk.sectorExposure,
      cyclicality: risk.betaEstimate,
      cashRisk,
      dividendDependence,
      leverageExposure,
      qualityDrift,
      portfolioStability,
    },
    income: {
      portfolioDividendYield: weightedMetrics.dividendYield,
      estAnnualDividendIncome,
    },
    performance: {
      totalCostBasisValue,
      totalMarketValue,
      totalUnrealizedPnl,
      totalUnrealizedPnlPct,
      holdingsWithoutCostBasis,
    },
    holdings: holdingIntel,
    unresolvedSymbols: allocation.unresolvedSymbols,
    summary,
  };
}

// --- Watchlist vs Portfolio comparison ------------------------------------
// Pure set comparison — reuses the existing Watchlist table's own symbol
// list (fetched by the caller) and this portfolio's own holdings; no new
// analyzer calls beyond what buildPortfolioIntelligence() already made.
export interface WatchlistPortfolioComparison {
  inBoth: string[];
  onlyInWatchlist: string[];
  onlyInPortfolio: string[];
  summary: string;
}

export function compareWatchlistToPortfolio(watchlistSymbols: string[], portfolioSymbols: string[]): WatchlistPortfolioComparison {
  const watch = new Set(watchlistSymbols.map((s) => s.toUpperCase()));
  const port = new Set(portfolioSymbols.map((s) => s.toUpperCase()));
  const inBoth = [...watch].filter((s) => port.has(s)).sort();
  const onlyInWatchlist = [...watch].filter((s) => !port.has(s)).sort();
  const onlyInPortfolio = [...port].filter((s) => !watch.has(s)).sort();
  return {
    inBoth,
    onlyInWatchlist,
    onlyInPortfolio,
    summary:
      `${inBoth.length} symbol(s) tracked on both the Watchlist and this portfolio. ` +
      `${onlyInWatchlist.length} watchlist symbol(s) are not yet held. ` +
      `${onlyInPortfolio.length} held symbol(s) are not on the watchlist.`,
  };
}

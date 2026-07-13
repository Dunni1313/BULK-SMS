// Phase 2, Sprint 21 — Competitive Advantage Engine (approved Phase 2 plan,
// Sprint 21). A new, additive analysis alongside the existing analyzeMoat()
// (valueInvesting.ts) — that engine's output/thresholds/durabilityYears lookup
// are completely untouched, per the approved decision. This engine scores 11
// dimensions of competitive advantage individually, mostly by re-reading
// signals already computed elsewhere (Fundamentals.qualitative, Investment
// Quality, Financial Strength) rather than introducing new scoring logic —
// only Cost Advantages and Competitive Durability combine existing scores in a
// small new way, and Customer Concentration Risk is honestly always
// unavailable (no provider publishes revenue-by-customer data for any symbol
// today).
//
// Deliberately does NOT depend on getFinancialStatements() (Sprint 19) or
// buildIndustryComparison() (Sprint 20) — both are heavier, on-demand, multi-
// call data sources by their own design; pulling either in here would defeat
// that design since this engine is folded into the eager buildValueResearchReport()
// path (approved decision: Competitive Durability uses only Fundamentals/
// Financial Strength/Investment Quality signals already available at that
// point, real multi-year ROIC persistence deferred to a future sprint).

import type { Fundamentals } from "./fundamentals.js";
import type { InvestmentQualityAnalysis } from "./investmentQuality.js";
import type { FinancialStrength, MoatRating } from "./valueInvesting.js";
import { classifyMoatRating } from "./valueInvesting.js";

export type CompetitiveAdvantageConfidenceLevel = "High" | "Moderate" | "Low";

export interface CompetitiveDimensionScore {
  dimension: string;
  score: number | null; // 0-100, null when unavailable
  weight: number; // design weight (11 dimensions, applied only to available ones, renormalized)
  detail: string;
  reason?: string; // present only when unavailable
}

export interface CompetitiveAdvantageAnalysis {
  score: number | null; // 0-100 overall, null only if every dimension is somehow unavailable
  dimensions: CompetitiveDimensionScore[]; // all 11, in the requested order
  classification: MoatRating;
  strengths: string[];
  weaknesses: string[];
  confidenceLevel: CompetitiveAdvantageConfidenceLevel;
  confidenceExplanation: string;
  summary: string;
}

const DEFERRED_DATA_REASON =
  "requires customer/segment revenue-concentration data from filings, planned for a future Tom Nash Enhancement sprint (the same filing-ingestion infrastructure gap noted for Investment Quality's Share Dilution and Insider Ownership metrics)";

// Fixed design weights across all 11 dimensions (sum to 1.0, matching Investment
// Quality's own WEIGHTS convention). Applied only to AVAILABLE dimensions and
// renormalized over their combined weight — Customer Concentration Risk is
// always unavailable today and is excluded from the average, not penalized.
const WEIGHTS = {
  brand: 1 / 11,
  networkEffects: 1 / 11,
  switchingCosts: 1 / 11,
  costAdvantages: 1 / 11,
  economiesOfScale: 1 / 11,
  intangibleAssets: 1 / 11,
  regulatoryAdvantages: 1 / 11,
  distributionAdvantages: 1 / 11,
  recurringRevenueQuality: 1 / 11,
  customerConcentrationRisk: 1 / 11,
  competitiveDurability: 1 / 11,
};

function round(x: number): number {
  return Math.round(x);
}
function clamp(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

// How consistently a multi-year per-share history (oldest -> newest) grew,
// expressed 0-100 as the share of year-over-year steps that were non-declining.
// A simple, honest durability proxy derived only from data Fundamentals already
// carries (the same 6-year revenueHistory/epsHistory arrays every report
// already fetches) — never a fabricated trend.
// Exported (Phase 2, Sprint 25) so the Earnings Intelligence Engine reuses this
// exact non-declining-steps formula for its own Earnings Consistency Score
// (applied to a quarterly EPS-actual array) instead of a second, duplicated
// consistency algorithm — a behavior-preserving export, this function's own
// logic and Competitive Advantage's own output are unchanged.
export function historyConsistencyScore(history: number[]): number | null {
  if (history.length < 2) return null;
  let nonDeclining = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i] >= history[i - 1]) nonDeclining++;
  }
  return round(clamp((nonDeclining / (history.length - 1)) * 100));
}

export function analyzeCompetitiveAdvantage(
  f: Fundamentals,
  iq: InvestmentQualityAnalysis,
  fin: FinancialStrength,
): CompetitiveAdvantageAnalysis {
  const q = f.qualitative;
  const dimensions: CompetitiveDimensionScore[] = [];

  dimensions.push({
    dimension: "Brand Strength",
    score: q.brand,
    weight: WEIGHTS.brand,
    detail: `Brand strength scored ${q.brand}/100.`,
  });

  dimensions.push({
    dimension: "Network Effects",
    score: q.networkEffect,
    weight: WEIGHTS.networkEffects,
    detail: `Network effect scored ${q.networkEffect}/100.`,
  });

  dimensions.push({
    dimension: "Switching Costs",
    score: q.switchingCost,
    weight: WEIGHTS.switchingCosts,
    detail: `Switching cost scored ${q.switchingCost}/100.`,
  });

  // Reuses Investment Quality's own already-scored "Gross Margin" metric
  // (never recomputed) averaged with the qualitative pricing-power signal —
  // corroborating a qualitative moat source with quantitative margin evidence,
  // the same blending idea analyzeMoat() already uses for its own score.
  const grossMarginScore = iq.metrics.find((m) => m.metric === "Gross Margin")?.score ?? null;
  const costAdvantageScore = grossMarginScore != null ? round(clamp((q.pricingPower + grossMarginScore) / 2)) : null;
  dimensions.push({
    dimension: "Cost Advantages",
    score: costAdvantageScore,
    weight: WEIGHTS.costAdvantages,
    detail:
      costAdvantageScore != null
        ? `Blend of pricing power (${q.pricingPower}/100) and gross margin strength (${grossMarginScore}/100).`
        : "",
    ...(costAdvantageScore == null ? { reason: "Gross margin score unavailable." } : {}),
  });

  dimensions.push({
    dimension: "Economies of Scale",
    score: q.scale,
    weight: WEIGHTS.economiesOfScale,
    detail: `Scale advantage scored ${q.scale}/100.`,
  });

  dimensions.push({
    dimension: "Intangible Assets",
    score: q.ipStrength,
    weight: WEIGHTS.intangibleAssets,
    detail: `Intangible assets / IP strength scored ${q.ipStrength}/100.`,
  });

  dimensions.push({
    dimension: "Regulatory Advantages",
    score: q.regulatoryAdvantage,
    weight: WEIGHTS.regulatoryAdvantages,
    detail: `Regulatory advantage scored ${q.regulatoryAdvantage}/100.`,
  });

  dimensions.push({
    dimension: "Distribution Advantages",
    score: q.distribution,
    weight: WEIGHTS.distributionAdvantages,
    detail: `Distribution advantage scored ${q.distribution}/100.`,
  });

  dimensions.push({
    dimension: "Recurring Revenue Quality",
    score: q.recurringRevenue,
    weight: WEIGHTS.recurringRevenueQuality,
    detail: `Recurring revenue quality scored ${q.recurringRevenue}/100.`,
  });

  dimensions.push({
    dimension: "Customer Concentration Risk",
    score: null,
    weight: WEIGHTS.customerConcentrationRisk,
    detail: "",
    reason: `No customer-concentration data source yet — ${DEFERRED_DATA_REASON}.`,
  });

  // Approved decision: a cheap proxy from data already available in the eager
  // report path — ROIC level (Investment Quality's own already-scored ROIC
  // metric), FCF reliability (Financial Strength's own already-scored metric),
  // and revenue/EPS history consistency (derived from Fundamentals' own 6-year
  // arrays) — never getFinancialStatements(). Real multi-year ROIC persistence
  // is deferred to a future enhancement sprint.
  const roicScore = iq.metrics.find((m) => m.metric === "Return on Invested Capital")?.score ?? null;
  const fcfReliabilityScore = fin.metrics.find((m) => m.label === "FCF reliability")?.score ?? null;
  const revenueConsistency = historyConsistencyScore(f.revenueHistory);
  const epsConsistency = historyConsistencyScore(f.epsHistory);
  const durabilityInputs = [roicScore, fcfReliabilityScore, revenueConsistency, epsConsistency].filter(
    (v): v is number => v != null,
  );
  const durabilityScore = durabilityInputs.length > 0 ? round(clamp(durabilityInputs.reduce((a, b) => a + b, 0) / durabilityInputs.length)) : null;
  dimensions.push({
    dimension: "Competitive Durability",
    score: durabilityScore,
    weight: WEIGHTS.competitiveDurability,
    detail:
      durabilityScore != null
        ? `Blend of ROIC strength, FCF reliability, and revenue/EPS history consistency (${durabilityInputs.length} of 4 signals available).`
        : "",
    ...(durabilityScore == null ? { reason: "No underlying durability signal was computable." } : {}),
  });

  const available = dimensions.filter(
    (d): d is CompetitiveDimensionScore & { score: number } => d.score != null,
  );
  const totalWeight = available.reduce((a, d) => a + d.weight, 0);
  const score = totalWeight > 0 ? round(clamp(available.reduce((a, d) => a + d.score * d.weight, 0) / totalWeight)) : null;

  const classification: MoatRating = score != null ? classifyMoatRating(score) : "None";

  const byScoreDesc = [...available].sort((a, b) => b.score - a.score);
  const byScoreAsc = [...available].sort((a, b) => a.score - b.score);
  const strengths = byScoreDesc
    .filter((d) => d.score >= 70)
    .slice(0, 4)
    .map((d) => `${d.dimension}: ${d.score}/100 — ${d.detail}`);
  const weaknesses = byScoreAsc
    .filter((d) => d.score < 40)
    .slice(0, 4)
    .map((d) => `${d.dimension}: ${d.score}/100 — ${d.detail}`);

  const unavailable = dimensions.filter((d) => d.score == null);
  const availabilityRatio = dimensions.length > 0 ? available.length / dimensions.length : 0;
  let confidenceLevel: CompetitiveAdvantageConfidenceLevel = "Low";
  if (availabilityRatio >= 0.95) confidenceLevel = "High";
  else if (availabilityRatio >= 0.8) confidenceLevel = "Moderate";

  const confidenceExplanation =
    unavailable.length === 0
      ? `All ${dimensions.length} competitive-advantage dimensions have usable data for ${f.symbol}.`
      : `${available.length} of ${dimensions.length} dimensions have usable data for ${f.symbol}; ${unavailable.length} (${unavailable.map((d) => d.dimension).join(", ")}) await future data sources.`;

  const kindNote =
    f.kind === "etf"
      ? " As a diversified fund, these per-company dimensions reflect the fund's blended holdings rather than a single business."
      : "";
  const summary =
    score != null
      ? `${f.symbol} scores ${score}/100 on competitive advantage (${classification}) across ${available.length} scored dimensions (${confidenceLevel} confidence).${kindNote}`
      : `${f.symbol}: competitive advantage could not be scored — no dimension had usable data.`;

  return { score, dimensions, classification, strengths, weaknesses, confidenceLevel, confidenceExplanation, summary };
}

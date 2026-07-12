// Phase 2, Sprint 16 — Tom Nash Investment Engine, Core (approved Phase 2 plan,
// Sprint 16 after the roadmap's post-Sprint-15 renumbering).
//
// A COMPOSITION layer, not a replacement for any existing valuation engine — every
// pillar either directly reuses an already-computed analyzer output or re-aggregates
// already-scored sub-metrics. Nothing here recomputes a fundamental ratio, refetches
// data, or duplicates a scoring formula that already exists elsewhere:
//
//  - Business Quality  -> the Investment Quality Engine's own overall score (Sprint 15),
//                          reused whole, not partitioned.
//  - Growth             -> renormalized average of the Investment Quality Engine's own
//                          Revenue/EPS/FCF Growth metric scores (same scored objects,
//                          just re-aggregated over a subset).
//  - Capital Allocation  -> renormalized average of Cash Position / Debt Levels /
//                          Return on Invested Capital (relabeled "Capital efficiency"
//                          for this engine's own display) from the same Investment
//                          Quality metrics; Share Dilution/Buybacks is surfaced as an
//                          unavailable line item (never fabricated) but excluded from
//                          the numeric average, exactly like Investment Quality's own
//                          internal discipline.
//  - Financial Strength  -> analyzeFinancialStrength()'s own score, called through.
//  - Valuation           -> the ONE genuinely new piece of logic: no existing code
//                          exposes a 0-100 valuation score (only categorical ratings +
//                          raw margin-of-safety fractions), so a small rating->score
//                          bucket table is applied to whichever of Blended/Graham/DCF/
//                          Buffett are available, reusing their already-computed
//                          `rating` field (itself produced by the shared
//                          classifyMarginOfSafety()). Deliberately isolated inside this
//                          module so it can be refined later without touching Graham/
//                          DCF/Buffett/Investment Quality.
//
// Explicitly, deliberately NOT in Sprint 16 (see the approved Phase 2 plan's Tom Nash
// Enhancement I/II sprints): macro/interest-rate/sector-rotation/AI-cycle analysis,
// insider-ownership scoring, filing ingestion. Investment Quality's own "Insider
// Ownership" metric is simply never pulled into any pillar here.
//
// Output shape ({verdict, convictionScore, rationale, summary}) deliberately mirrors
// the {verdict, conviction, rationale, summary} contract every other analyst in this
// engine already produces, so a future AI Investment Committee (Sprint 17) can treat
// Tom Nash as one more voting member via the same structural pattern.

import type { Fundamentals } from "./fundamentals.js";
import type { FinancialStrength, Valuation } from "./valueInvesting.js";
import type { InvestmentQualityAnalysis, QualityMetricScore } from "./investmentQuality.js";
import type { GrahamValuation } from "./grahamValuation.js";
import type { DcfValuation } from "./dcfValuation.js";
import type { BuffettValuation } from "./buffettValuation.js";

function round(x: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

export type TomNashVerdict = "Buy" | "Hold" | "Wait";

export interface TomNashPillarScore {
  label: string;
  score: number | null; // 0-100, null only when nothing behind the pillar is available
  detail: string;
}

export interface TomNashAnalysis {
  businessQuality: TomNashPillarScore;
  growth: TomNashPillarScore;
  capitalAllocation: TomNashPillarScore;
  financialStrength: TomNashPillarScore;
  valuation: TomNashPillarScore;
  convictionScore: number; // 0-100
  verdict: TomNashVerdict;
  rationale: string[];
  summary: string;
}

// Approved Sprint 16 default: equal weighting across all 5 pillars. Kept as its own
// named constant (rather than inlined) so a later Tom Nash enhancement sprint can
// recalibrate weighting without touching the aggregation logic itself.
const PILLAR_WEIGHTS = {
  businessQuality: 0.2,
  growth: 0.2,
  capitalAllocation: 0.2,
  financialStrength: 0.2,
  valuation: 0.2,
} as const;

// Approved Sprint 16 thresholds — recalibratable later using real-world performance
// data without changing the conviction-score math itself.
const BUY_THRESHOLD = 70;
const HOLD_THRESHOLD = 45;

// Isolated inside this module per the approved decision: no existing code exposes a
// 0-100 valuation score, only categorical ratings. Refining this mapping later never
// touches Graham/DCF/Buffett/the blended model's own computation.
const VALUATION_RATING_SCORE: Record<string, number> = {
  Cheap: 100,
  Fair: 65,
  Expensive: 35,
  "Very Expensive": 0,
};

function findMetric(metrics: QualityMetricScore[], name: string): QualityMetricScore {
  const m = metrics.find((x) => x.metric === name);
  if (!m) throw new Error(`Investment Quality metric not found: ${name}`);
  return m;
}

// Renormalized average over whichever of the named metrics have usable data —
// mirrors Investment Quality's own "exclude, don't penalize" discipline for
// unavailable metrics. Returns null only when none of the named metrics are available.
function averageMetrics(metrics: QualityMetricScore[], names: string[]): number | null {
  const selected = names.map((n) => findMetric(metrics, n)).filter((m) => m.availability === "available" && m.score != null);
  if (selected.length === 0) return null;
  const totalWeight = selected.reduce((a, m) => a + m.weight, 0);
  return round(selected.reduce((a, m) => a + (m.score as number) * m.weight, 0) / totalWeight);
}

function growthPillar(iq: InvestmentQualityAnalysis): TomNashPillarScore {
  const score = averageMetrics(iq.metrics, ["Revenue Growth", "EPS Growth", "Free Cash Flow Growth"]);
  const rg = findMetric(iq.metrics, "Revenue Growth");
  const eg = findMetric(iq.metrics, "EPS Growth");
  const fg = findMetric(iq.metrics, "Free Cash Flow Growth");
  const parts = [rg, eg, fg].map((m) => (m.availability === "available" ? `${m.metric} ${m.score}/100` : `${m.metric} unavailable`));
  return {
    label: "Growth",
    score,
    detail: parts.join("; "),
  };
}

function capitalAllocationPillar(iq: InvestmentQualityAnalysis): TomNashPillarScore {
  const score = averageMetrics(iq.metrics, ["Cash Position", "Debt Levels", "Return on Invested Capital"]);
  const cash = findMetric(iq.metrics, "Cash Position");
  const debt = findMetric(iq.metrics, "Debt Levels");
  const roic = findMetric(iq.metrics, "Return on Invested Capital");
  const dilution = findMetric(iq.metrics, "Share Dilution / Buybacks");
  const parts = [
    `Cash Position ${cash.score}/100`,
    `Debt Levels ${debt.score}/100`,
    `Capital efficiency (ROIC) ${roic.score}/100`,
    dilution.availability === "available" ? `Share Dilution/Buybacks ${dilution.score}/100` : "Share Dilution/Buybacks unavailable",
  ];
  return {
    label: "Capital Allocation",
    score,
    detail: parts.join("; "),
  };
}

function financialStrengthPillar(fin: FinancialStrength): TomNashPillarScore {
  return {
    label: "Financial Strength",
    score: fin.score,
    detail: `${fin.rating} (${fin.score}/100)`,
  };
}

interface RatedModel {
  name: string;
  available: boolean;
  rating?: string;
}

function valuationPillar(
  blended: Valuation,
  graham: GrahamValuation,
  dcf: DcfValuation,
  buffett: BuffettValuation,
): TomNashPillarScore {
  const models: RatedModel[] = [
    { name: "Blended", available: blended.available, rating: blended.available ? blended.rating : undefined },
    { name: "Graham", available: graham.available, rating: graham.available ? graham.rating : undefined },
    { name: "DCF", available: dcf.available, rating: dcf.available ? dcf.rating : undefined },
    { name: "Buffett", available: buffett.available, rating: buffett.available ? buffett.rating : undefined },
  ];
  const rated = models.filter((m): m is RatedModel & { rating: string } => m.available && m.rating != null);

  if (rated.length === 0) {
    return {
      label: "Valuation",
      score: null,
      detail: "Valuation score unavailable — no valuation model produced a usable estimate.",
    };
  }

  const score = round(rated.reduce((a, m) => a + VALUATION_RATING_SCORE[m.rating], 0) / rated.length);
  const detail = rated.map((m) => `${m.name}: ${m.rating}`).join("; ");
  return { label: "Valuation", score, detail };
}

export function analyzeTomNash(
  f: Fundamentals,
  iq: InvestmentQualityAnalysis,
  fin: FinancialStrength,
  blended: Valuation,
  graham: GrahamValuation,
  dcf: DcfValuation,
  buffett: BuffettValuation,
): TomNashAnalysis {
  const businessQuality: TomNashPillarScore = {
    label: "Business Quality",
    score: iq.score,
    detail: iq.summary,
  };
  const growth = growthPillar(iq);
  const capitalAllocation = capitalAllocationPillar(iq);
  const financialStrength = financialStrengthPillar(fin);
  const valuation = valuationPillar(blended, graham, dcf, buffett);

  const pillars = [
    { pillar: businessQuality, weight: PILLAR_WEIGHTS.businessQuality },
    { pillar: growth, weight: PILLAR_WEIGHTS.growth },
    { pillar: capitalAllocation, weight: PILLAR_WEIGHTS.capitalAllocation },
    { pillar: financialStrength, weight: PILLAR_WEIGHTS.financialStrength },
    { pillar: valuation, weight: PILLAR_WEIGHTS.valuation },
  ];
  const available = pillars.filter((p) => p.pillar.score != null);
  const totalWeight = available.reduce((a, p) => a + p.weight, 0);
  const convictionScore =
    totalWeight > 0
      ? round(available.reduce((a, p) => a + (p.pillar.score as number) * p.weight, 0) / totalWeight)
      : 0;

  let verdict: TomNashVerdict;
  if (convictionScore >= BUY_THRESHOLD) verdict = "Buy";
  else if (convictionScore >= HOLD_THRESHOLD) verdict = "Hold";
  else verdict = "Wait";

  const rationale: string[] = [
    `Business Quality: ${businessQuality.score}/100 (Investment Quality Engine).`,
    `Growth: ${growth.score != null ? `${growth.score}/100` : "unavailable"} — ${growth.detail}.`,
    `Capital Allocation: ${capitalAllocation.score != null ? `${capitalAllocation.score}/100` : "unavailable"} — ${capitalAllocation.detail}.`,
    `Financial Strength: ${financialStrength.score}/100 (${fin.rating}).`,
    `Valuation: ${valuation.score != null ? `${valuation.score}/100` : "unavailable"} — ${valuation.detail}.`,
  ];

  const etfCaveat =
    f.kind === "etf"
      ? " As a diversified fund, these pillar scores reflect the fund's blended holdings rather than a single business."
      : "";
  const summary =
    `${f.symbol}: ${verdict} (conviction ${convictionScore}/100), composed from Business Quality, Growth, ` +
    `Capital Allocation, Financial Strength, and Valuation.${etfCaveat}`;

  return {
    businessQuality,
    growth,
    capitalAllocation,
    financialStrength,
    valuation,
    convictionScore,
    verdict,
    rationale,
    summary,
  };
}

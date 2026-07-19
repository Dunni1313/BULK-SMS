// Phase 14 — Institutional Investment Decision Engine.
//
// PURE COMPOSITION LAYER, ZERO NEW SCORING FORMULAS. Every number here comes
// from an already-shipped, already-tested module — this file adds no new
// valuation model, no new quality engine, and no new provider call beyond
// what's already made by the callers below:
//
//   - buildValueResearchReport() (Phase 2, Sprints 12-31) supplies Business
//     Quality, Investment Quality, Moat, Competitive Advantage, Financial
//     Strength, Financial Ratios, Graham/DCF/Buffett/blended Valuation, the
//     Consolidated Margin of Safety, Tom Nash, and the Investment Committee —
//     called exactly once by the caller (route layer), passed in whole.
//   - buildManagementQualityAnalysis() (Phase 2 Sprint 23 / Phase 4 Sprint 63)
//     supplies the Management checklist item — OPTIONAL: honestly
//     `unavailable` whenever Document Intelligence/EDGAR can't resolve a
//     filing (this sandbox's own outbound proxy denies data.sec.gov, per
//     every prior sprint's disclosure), never fabricated, never blocks the
//     rest of the decision.
//   - An optional portfolio context (already-computed Portfolio Intelligence
//     figures, Phase 13 — diversification score, portfolio risk score, this
//     symbol's own current weight/sector exposure if held) supplies the
//     Portfolio Fit / Risk / Diversification checklist items — honestly
//     `unavailable` when no portfolio was supplied, never approximated from
//     a hypothetical allocation this module does not compute.
//
// DETERMINISTIC ONLY: zero LLM calls, zero price forecasting, zero
// probability guessing anywhere in this file. The one genuinely new logic is
// (a) a weighted-average synthesis of already-computed 0-100 scores — the
// same "combine already-scored composites" pattern Tom Nash Engine (Phase 2,
// Sprint 16) and Portfolio Intelligence (Phase 13) already establish, not a
// new valuation/quality engine — and (b) threshold-based Pass/Warning/Fail
// bucketing of those same already-computed numbers/ratings.

import type { ValueResearchReport } from "./valueReport.js";
import type { ManagementQualityAnalysis } from "./managementAnalysis.js";
import { classifyMarginOfSafety, type MoatRating, type ValuationRating } from "./valueInvesting.js";
import { SINGLE_SYMBOL_CONCENTRATION_CAP_PCT, SECTOR_CONCENTRATION_CAP_PCT } from "./investingRisk.js";

export type DecisionRecommendation = "Buy" | "Accumulate" | "Hold" | "Reduce" | "Sell" | "Avoid";
export type ChecklistStatus = "pass" | "warning" | "fail" | "unavailable";

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
  explanation: string;
}

export interface DecisionEvidenceItem {
  label: string;
  detail: string;
}

// Pre-resolved by the caller (route layer) from the user's own portfolio, via
// the already-shipped buildPortfolioIntelligence()/buildPortfolioAllocation()
// (Phase 13) — this module never touches the database or re-derives these
// figures itself.
export interface DecisionPortfolioContext {
  portfolioId: number;
  alreadyHeld: boolean;
  currentWeightPct: number | null; // this symbol's own actualWeightPct, null if not held or unresolved
  sectorExposurePct: number | null; // the current portfolio's exposure to this symbol's own sector
  diversificationScore: number | null; // the portfolio's own current Diversification Score
  portfolioRiskScore: number | null; // the portfolio's own current overall risk score
}

export interface PortfolioFitResult {
  available: boolean;
  reason?: string;
  portfolioId?: number;
  alreadyHeld?: boolean;
  currentWeightPct?: number | null;
  sectorExposurePct?: number | null;
}

export interface ManagementQualityResult {
  available: boolean;
  score: number | null;
  reason?: string;
}

export interface InstitutionalDecisionAnalysis {
  symbol: string;
  asOf: string;
  kind: string;
  price: number;
  recommendation: DecisionRecommendation;
  confidence: number; // 0-100, reused directly from Investment Committee's own confidenceScore
  summary: string;
  explanation: string;
  drivers: string[];
  risks: string[];
  supportingEvidence: DecisionEvidenceItem[];
  contradictingEvidence: DecisionEvidenceItem[];
  checklist: ChecklistItem[];
  strengths: string[];
  weaknesses: string[];
  catalysts: string[];
  thingsToMonitor: string[];
  whyBuy: string[];
  whyWait: string[];
  whySell: string[];
  managementQuality: ManagementQualityResult;
  portfolioFit: PortfolioFitResult;
  riskChecklistItem: ChecklistItem; // surfaced separately too — see checklist "risk" entry
  diversificationChecklistItem: ChecklistItem; // surfaced separately too — see checklist "diversification" entry
  disclaimer: string;
}

export const DECISION_DISCLAIMER =
  "Educational research only — not investment advice or a recommendation to buy, hold, or sell any security. " +
  "Every figure above is a direct reuse of an existing, already-computed analytical engine (Business Quality, " +
  "Competitive Advantage, Management Quality, Capital Allocation, Financial Strength, Valuation, Margin of Safety, " +
  "the Investment Committee, and Tom Nash's conviction score) — this module performs deterministic synthesis only, " +
  "never a new valuation model, never an AI prediction, never a price forecast.";

function round(x: number): number {
  return Math.round(x);
}

function statusFromScore(score: number | null, passAt = 65, warnAt = 45): ChecklistStatus {
  if (score == null) return "unavailable";
  if (score >= passAt) return "pass";
  if (score >= warnAt) return "warning";
  return "fail";
}

function findMetric(metrics: { metric: string; score: number | null; detail: string; reason?: string }[], name: string) {
  return metrics.find((m) => m.metric === name) ?? null;
}
function findFactor(metrics: { label: string; score: number; detail: string }[], label: string) {
  return metrics.find((m) => m.label === label) ?? null;
}

const MOAT_STATUS: Record<MoatRating, ChecklistStatus> = {
  Wide: "pass",
  Medium: "pass",
  Narrow: "warning",
  None: "fail",
};

const VALUATION_STATUS: Record<ValuationRating, ChecklistStatus> = {
  Cheap: "pass",
  Fair: "pass",
  Expensive: "warning",
  "Very Expensive": "fail",
};

// The one genuinely new logic in this module: a weighted-average synthesis
// of already-computed 0-100 scores, mirroring Tom Nash's/Portfolio
// Intelligence's own renormalize-over-available-inputs discipline. Never
// recomputes any of the underlying scores.
function decisionSynthesisScore(report: ValueResearchReport, managementQuality: ManagementQualityResult): number {
  const parts: { value: number; weight: number }[] = [
    { value: report.tomNash.convictionScore, weight: 0.5 },
    { value: report.investmentCommittee.confidenceScore, weight: 0.2 },
  ];
  if (report.competitiveAdvantage.score != null) parts.push({ value: report.competitiveAdvantage.score, weight: 0.15 });
  if (managementQuality.available && managementQuality.score != null) parts.push({ value: managementQuality.score, weight: 0.15 });
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  return round(parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight);
}

function deriveRecommendation(
  report: ValueResearchReport,
  synthesisScore: number,
  portfolio: DecisionPortfolioContext | null,
): { recommendation: DecisionRecommendation; explanation: string } {
  const fin = report.financialStrength;
  const committee = report.investmentCommittee;

  if (fin.rating === "Risky") {
    return {
      recommendation: "Sell",
      explanation: `Balance-sheet distress overrides every other signal — Financial Strength rates Risky (${fin.score}/100).`,
    };
  }
  if (fin.rating === "Weak") {
    return {
      recommendation: "Avoid",
      explanation: `Weak financial strength (${fin.score}/100) fails the quality-first filter regardless of upside elsewhere.`,
    };
  }

  let recommendation: DecisionRecommendation;
  let explanation: string;
  if (committee.consolidatedVerdict === "Buy") {
    if (synthesisScore >= 70) {
      recommendation = "Buy";
      explanation = `Investment Committee votes Buy (${committee.agreement}), and the synthesis score of ${synthesisScore}/100 clears the high-conviction bar.`;
    } else if (synthesisScore >= 50) {
      recommendation = "Accumulate";
      explanation = `Investment Committee votes Buy (${committee.agreement}), but the synthesis score of ${synthesisScore}/100 supports adding gradually rather than a full-conviction Buy.`;
    } else {
      recommendation = "Hold";
      explanation = `Investment Committee votes Buy, but the synthesis score of ${synthesisScore}/100 is not yet strong enough to add — hold what you have.`;
    }
  } else if (committee.consolidatedVerdict === "Hold") {
    if (synthesisScore < 35) {
      recommendation = "Reduce";
      explanation = `Investment Committee votes Hold, but a synthesis score of only ${synthesisScore}/100 argues for trimming rather than maintaining full exposure.`;
    } else {
      recommendation = "Hold";
      explanation = `Investment Committee votes Hold with a synthesis score of ${synthesisScore}/100 — no strong signal to add or trim.`;
    }
  } else {
    // Wait
    if (synthesisScore < 35) {
      recommendation = "Avoid";
      explanation = `Investment Committee votes Wait, and a synthesis score of only ${synthesisScore}/100 argues against a new position entirely.`;
    } else if (synthesisScore < 55) {
      recommendation = "Reduce";
      explanation = `Investment Committee votes Wait (synthesis score ${synthesisScore}/100) — an otherwise reasonable business trading at a level that favors trimming over adding.`;
    } else {
      recommendation = "Hold";
      explanation = `Investment Committee votes Wait, but the underlying business still scores ${synthesisScore}/100 — hold rather than reduce while waiting for a better price.`;
    }
  }

  if (
    portfolio &&
    portfolio.currentWeightPct != null &&
    portfolio.currentWeightPct >= SINGLE_SYMBOL_CONCENTRATION_CAP_PCT &&
    (recommendation === "Buy" || recommendation === "Accumulate")
  ) {
    const original = recommendation;
    recommendation = "Hold";
    explanation = `${explanation} Downgraded from ${original} to Hold: this position already accounts for ${portfolio.currentWeightPct.toFixed(1)}% of the portfolio, at or above the ${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}% single-symbol concentration cap.`;
  }

  return { recommendation, explanation };
}

function buildChecklist(
  report: ValueResearchReport,
  managementQuality: ManagementQualityResult,
  portfolio: DecisionPortfolioContext | null,
): ChecklistItem[] {
  const { businessQuality: bq, investmentQuality: iq, moat, competitiveAdvantage, financialStrength: fin, tomNash, consolidatedMarginOfSafety: moS } = report;

  const revGrowth = findMetric(iq.metrics, "Revenue Growth");
  const grossMargin = findMetric(iq.metrics, "Gross Margin");
  const opMargin = findMetric(iq.metrics, "Operating Margin");
  const netMargin = findMetric(iq.metrics, "Net Margin");
  const roic = findMetric(iq.metrics, "Return on Invested Capital");
  const roe = findMetric(iq.metrics, "Return on Equity");
  const fcfReliability = findFactor(fin.metrics, "FCF reliability");
  const leverage = findFactor(fin.metrics, "Leverage");

  const marginScores = [grossMargin?.score, opMargin?.score, netMargin?.score].filter((s): s is number => s != null);
  const marginsScore = marginScores.length ? round(marginScores.reduce((a, b) => a + b, 0) / marginScores.length) : null;

  const mosAvg = moS.averageMarginOfSafety;
  const mosClass = mosAvg != null ? classifyMarginOfSafety(mosAvg) : null;

  const items: ChecklistItem[] = [
    {
      id: "business-quality",
      label: "Business Quality",
      status: statusFromScore(bq.score, 58, 42),
      explanation: `${bq.rating} (${bq.score}/100). ${bq.summary}`,
    },
    {
      id: "moat",
      label: "Moat",
      status: MOAT_STATUS[moat.rating],
      explanation: `${moat.rating} moat. ${moat.summary}`,
    },
    {
      id: "management",
      label: "Management",
      status: managementQuality.available ? statusFromScore(managementQuality.score, 65, 45) : "unavailable",
      explanation: managementQuality.available
        ? `Management Quality score ${managementQuality.score}/100.`
        : (managementQuality.reason ?? "Management Quality analysis is unavailable for this symbol."),
    },
    {
      id: "capital-allocation",
      label: "Capital Allocation",
      status: statusFromScore(tomNash.capitalAllocation.score),
      explanation: tomNash.capitalAllocation.detail,
    },
    {
      id: "revenue-growth",
      label: "Revenue Growth",
      status: revGrowth ? statusFromScore(revGrowth.score) : "unavailable",
      explanation: revGrowth?.detail ?? revGrowth?.reason ?? "Revenue growth is unavailable.",
    },
    {
      id: "margins",
      label: "Margins",
      status: statusFromScore(marginsScore),
      explanation:
        marginsScore != null
          ? `Average of Gross/Operating/Net Margin scores: ${marginsScore}/100.`
          : "Margin data is unavailable.",
    },
    {
      id: "cash-flow",
      label: "Cash Flow",
      status: fcfReliability ? statusFromScore(fcfReliability.score) : "unavailable",
      explanation: fcfReliability?.detail ?? "Free cash flow reliability is unavailable.",
    },
    {
      id: "debt",
      label: "Debt",
      status: leverage ? statusFromScore(leverage.score) : "unavailable",
      explanation: leverage?.detail ?? "Leverage data is unavailable.",
    },
    {
      id: "roic",
      label: "ROIC",
      status: roic ? statusFromScore(roic.score) : "unavailable",
      explanation: roic?.detail ?? roic?.reason ?? "ROIC is unavailable.",
    },
    {
      id: "roe",
      label: "ROE",
      status: roe ? statusFromScore(roe.score) : "unavailable",
      explanation: roe?.detail ?? roe?.reason ?? "ROE is unavailable.",
    },
    {
      id: "valuation",
      label: "Valuation",
      status: mosClass ? VALUATION_STATUS[mosClass.rating] : "unavailable",
      explanation: mosClass
        ? `Consolidated valuation rating: ${mosClass.rating} (average margin of safety ${(mosAvg! * 100).toFixed(0)}% across ${moS.modelsAvailable} model(s)).`
        : "No valuation model produced a usable fair value.",
    },
    {
      id: "margin-of-safety",
      label: "Margin of Safety",
      status: mosClass ? (mosClass.marginOfSafetyLabel === "None" ? "fail" : mosClass.marginOfSafetyLabel === "Low" ? "warning" : "pass") : "unavailable",
      explanation: mosClass
        ? `${mosClass.marginOfSafetyLabel} margin of safety (${(mosAvg! * 100).toFixed(0)}% average discount, ${moS.agreement} agreement across ${moS.modelsAvailable} model(s)).`
        : "Margin of safety cannot be computed — no model produced a usable fair value.",
    },
    {
      id: "risk",
      label: "Risk",
      status: portfolio?.portfolioRiskScore != null ? statusFromScore(portfolio.portfolioRiskScore) : "unavailable",
      explanation:
        portfolio?.portfolioRiskScore != null
          ? `Current portfolio risk score: ${portfolio.portfolioRiskScore}/100.`
          : "No portfolio selected — portfolio-level risk cannot be evaluated for this decision.",
    },
    {
      id: "portfolio-fit",
      label: "Portfolio Fit",
      status: !portfolio
        ? "unavailable"
        : portfolio.currentWeightPct != null && portfolio.currentWeightPct >= SINGLE_SYMBOL_CONCENTRATION_CAP_PCT
          ? "fail"
          : portfolio.sectorExposurePct != null && portfolio.sectorExposurePct >= SECTOR_CONCENTRATION_CAP_PCT
            ? "warning"
            : "pass",
      explanation: !portfolio
        ? "No portfolio selected — portfolio fit cannot be evaluated for this decision."
        : portfolio.alreadyHeld
          ? `Already held at ${portfolio.currentWeightPct?.toFixed(1) ?? "an unresolved"}% of the portfolio (single-symbol cap ${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}%); sector exposure ${portfolio.sectorExposurePct?.toFixed(1) ?? "unresolved"}% (sector cap ${SECTOR_CONCENTRATION_CAP_PCT}%).`
          : `Not currently held. Current sector exposure to this symbol's sector is ${portfolio.sectorExposurePct?.toFixed(1) ?? "unresolved"}% (sector cap ${SECTOR_CONCENTRATION_CAP_PCT}%).`,
    },
    {
      id: "diversification",
      label: "Diversification",
      status: portfolio?.diversificationScore != null ? statusFromScore(portfolio.diversificationScore, 70, 45) : "unavailable",
      explanation:
        portfolio?.diversificationScore != null
          ? `Current portfolio Diversification Score: ${portfolio.diversificationScore}/100.`
          : "No portfolio selected — diversification impact cannot be evaluated for this decision.",
    },
  ];

  return items;
}

function buildEvidence(
  report: ValueResearchReport,
  managementQuality: ManagementQualityResult,
): { supporting: DecisionEvidenceItem[]; contradicting: DecisionEvidenceItem[] } {
  const { businessQuality: bq, moat, competitiveAdvantage, investmentQuality: iq, financialStrength: fin, tomNash, investmentCommittee: committee, consolidatedMarginOfSafety: moS } = report;
  const supporting: DecisionEvidenceItem[] = [];
  const contradicting: DecisionEvidenceItem[] = [];

  if (moat.rating !== "None") supporting.push({ label: "Economic Moat", detail: `${moat.rating} moat — ${moat.summary}` });
  else contradicting.push({ label: "Economic Moat", detail: `No qualifying moat — ${moat.summary}` });

  if (bq.rating === "Wonderful" || bq.rating === "Good") supporting.push({ label: "Business Quality", detail: bq.summary });
  else if (bq.rating === "Weak") contradicting.push({ label: "Business Quality", detail: bq.summary });

  if (iq.score != null && iq.score >= 65) supporting.push({ label: "Investment Quality", detail: iq.summary });
  else if (iq.score != null && iq.score < 45) contradicting.push({ label: "Investment Quality", detail: iq.summary });

  if (competitiveAdvantage.score != null && competitiveAdvantage.score >= 65)
    supporting.push({ label: "Competitive Advantage", detail: competitiveAdvantage.summary });
  else if (competitiveAdvantage.score != null && competitiveAdvantage.score < 45)
    contradicting.push({ label: "Competitive Advantage", detail: competitiveAdvantage.summary });

  if (managementQuality.available && managementQuality.score != null) {
    if (managementQuality.score >= 65) supporting.push({ label: "Management Quality", detail: `Management Quality score ${managementQuality.score}/100.` });
    else if (managementQuality.score < 45) contradicting.push({ label: "Management Quality", detail: `Management Quality score ${managementQuality.score}/100.` });
  }

  if (committee.consolidatedVerdict === "Buy")
    supporting.push({ label: "Investment Committee", detail: `${committee.agreement} Buy vote (confidence ${committee.confidenceScore}/100) — ${committee.summary}` });
  else if (committee.consolidatedVerdict === "Wait")
    contradicting.push({ label: "Investment Committee", detail: `${committee.agreement} Wait vote (confidence ${committee.confidenceScore}/100) — ${committee.summary}` });

  if (tomNash.convictionScore >= 65) supporting.push({ label: "Tom Nash Conviction", detail: tomNash.summary });
  else if (tomNash.convictionScore < 45) contradicting.push({ label: "Tom Nash Conviction", detail: tomNash.summary });

  if (moS.averageMarginOfSafety != null) {
    if (moS.averageMarginOfSafety > 0)
      supporting.push({ label: "Margin of Safety", detail: `${(moS.averageMarginOfSafety * 100).toFixed(0)}% average discount to intrinsic value across ${moS.modelsAvailable} model(s).` });
    else
      contradicting.push({ label: "Margin of Safety", detail: `${Math.abs(moS.averageMarginOfSafety * 100).toFixed(0)}% average premium above intrinsic value across ${moS.modelsAvailable} model(s).` });
  } else {
    contradicting.push({ label: "Margin of Safety", detail: "No valuation model produced a usable fair value — intrinsic value cannot be judged." });
  }

  for (const flag of fin.flags) contradicting.push({ label: "Financial Strength", detail: flag });
  if (fin.flags.length === 0) supporting.push({ label: "Financial Strength", detail: fin.summary });

  return { supporting, contradicting };
}

function dedupeTop(lists: string[][], n: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const s of list) {
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
      if (out.length >= n) return out;
    }
  }
  return out;
}

export function buildInstitutionalDecision(
  report: ValueResearchReport,
  managementQuality: ManagementQualityResult,
  portfolio: DecisionPortfolioContext | null,
): InstitutionalDecisionAnalysis {
  const synthesisScore = decisionSynthesisScore(report, managementQuality);
  const { recommendation, explanation } = deriveRecommendation(report, synthesisScore, portfolio);
  const confidence = report.investmentCommittee.confidenceScore;
  const checklist = buildChecklist(report, managementQuality, portfolio);
  const { supporting, contradicting } = buildEvidence(report, managementQuality);

  const strengths = dedupeTop([report.investmentQuality.strengths, report.competitiveAdvantage.strengths, ...(managementQuality.available ? [] : [])], 8);
  const weaknesses = dedupeTop([report.investmentQuality.weaknesses, report.competitiveAdvantage.weaknesses], 8);

  const risks = dedupeTop([report.financialStrength.flags, report.risks.map((r) => r.text)], 8);

  const catalysts: string[] = [];
  if (report.consolidatedMarginOfSafety.averageMarginOfSafety != null && report.consolidatedMarginOfSafety.averageMarginOfSafety > 0.15) {
    catalysts.push(`A re-rating toward the consolidated fair value would close a ${(report.consolidatedMarginOfSafety.averageMarginOfSafety * 100).toFixed(0)}% average discount.`);
  }
  if (report.tomNash.sectorMacro.detail) catalysts.push(report.tomNash.sectorMacro.detail);
  if (report.tomNash.rateSensitivity.detail) catalysts.push(report.tomNash.rateSensitivity.detail);
  const earningsRisk = report.risks.find((r) => r.text.toLowerCase().includes("earnings in"));
  if (earningsRisk) catalysts.push(earningsRisk.text);

  const thingsToMonitor: string[] = [];
  if (!managementQuality.available) thingsToMonitor.push(managementQuality.reason ?? "Management Quality analysis is unavailable — revisit once filing data can be resolved.");
  const unavailableCaDims = report.competitiveAdvantage.dimensions.filter((d) => d.score == null);
  for (const d of unavailableCaDims) thingsToMonitor.push(`${d.dimension}: ${d.reason ?? "unavailable"}.`);
  if (!portfolio) thingsToMonitor.push("No portfolio was supplied — portfolio fit, risk, and diversification impact were not evaluated.");
  if (report.financialStrength.flags.length) thingsToMonitor.push(...report.financialStrength.flags);

  const whyBuy = dedupeTop([supporting.map((e) => `${e.label}: ${e.detail}`)], 6);
  const whyWait: string[] = [];
  if (report.consolidatedMarginOfSafety.averageMarginOfSafety != null && report.consolidatedMarginOfSafety.averageMarginOfSafety <= 0)
    whyWait.push(`Trading above the consolidated fair value (${(report.consolidatedMarginOfSafety.averageMarginOfSafety * 100).toFixed(0)}% average margin of safety) — waiting for a better price preserves optionality.`);
  if (report.investmentCommittee.consolidatedVerdict === "Wait") whyWait.push(`Investment Committee votes Wait: ${report.investmentCommittee.summary}`);
  if (report.investmentCommittee.agreement === "split") whyWait.push("Analysts disagree (split verdict) — more confirmation would reduce the risk of acting on a contested read.");
  if (whyWait.length === 0) whyWait.push("No strong valuation or committee signal argues for waiting rather than acting now.");

  const whySell = dedupeTop([contradicting.map((e) => `${e.label}: ${e.detail}`)], 6);

  const summary = `${report.symbol}: ${recommendation} (confidence ${confidence}/100). ${explanation}`;

  const portfolioFit: PortfolioFitResult = portfolio
    ? {
        available: true,
        portfolioId: portfolio.portfolioId,
        alreadyHeld: portfolio.alreadyHeld,
        currentWeightPct: portfolio.currentWeightPct,
        sectorExposurePct: portfolio.sectorExposurePct,
      }
    : { available: false, reason: "No portfolio was supplied." };

  return {
    symbol: report.symbol,
    asOf: report.asOf,
    kind: report.kind,
    price: report.price,
    recommendation,
    confidence,
    summary,
    explanation,
    drivers: dedupeTop([supporting.slice(0, 5).map((e) => `${e.label}: ${e.detail}`)], 5),
    risks,
    supportingEvidence: supporting,
    contradictingEvidence: contradicting,
    checklist,
    strengths,
    weaknesses,
    catalysts: catalysts.length ? catalysts : ["No specific near-term catalyst identified from currently available data."],
    thingsToMonitor: thingsToMonitor.length ? thingsToMonitor : ["No specific monitoring flag identified from currently available data."],
    whyBuy,
    whyWait,
    whySell: whySell.length ? whySell : ["No strong bearish evidence identified from currently available data."],
    managementQuality,
    portfolioFit,
    riskChecklistItem: checklist.find((c) => c.id === "risk")!,
    diversificationChecklistItem: checklist.find((c) => c.id === "diversification")!,
    disclaimer: DECISION_DISCLAIMER,
  };
}

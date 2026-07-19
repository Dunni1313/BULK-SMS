// Phase 18 — Institutional Portfolio Optimisation Engine.
//
// PURE COMPOSITION LAYER. This module builds no new valuation model, no new
// scoring system, and duplicates no existing logic — every figure here is
// read directly off already-built, already-tested outputs:
//
//   - buildPortfolioIntelligence() (Phase 13) supplies Portfolio Health
//     (quality/capital-allocation/diversification scores), Concentration
//     Analysis (risk.concentration), and Diversification Analysis
//     (allocation.bySector/byIndustry/growthValueMix/qualityMix/
//     largestPositionPct/top10ExposurePct) — passed in whole, never
//     recomputed.
//   - buildOpportunityRow() (Phase 15, lib/opportunityDiscovery.ts) supplies
//     every held position's own Decision Engine recommendation, Investment
//     Committee verdict/confidence, Tom Nash conviction, and the Decision
//     Engine's own synthesis score (rankScore) plus its already-written
//     rankExplanation sentence — called once per DISTINCT held symbol by the
//     route layer, passed in whole.
//   - bucketOpportunities()'s own "portfolio-upgrade-candidates" bucket
//     (Phase 15) supplies Replacement Opportunities and Cash Deployment
//     candidates — Buy-rated symbols not already held, already ranked by the
//     Decision Engine's own synthesis score — reused directly, never
//     reimplemented.
//   - SINGLE_SYMBOL_CONCENTRATION_CAP_PCT / SECTOR_CONCENTRATION_CAP_PCT
//     (Phase 2 Sprint 29, lib/investingRisk.ts) are the exact same caps the
//     Decision Engine's own Portfolio Fit checklist and the Portfolio
//     Manager's own Risk tab already use — reused, never redefined.
//
// THE ONLY GENUINELY NEW LOGIC in this file:
//   (a) Classification of each holding into Upgrade / Trim / Exit / Core —
//       a threshold-based bucketing of already-computed values (the exact
//       same "genuinely new logic is classification, never a new score"
//       precedent Decision Engine's own checklist and Tom Nash's Valuation
//       bucket already established), built almost entirely from the
//       Decision Engine's own already-computed recommendation:
//         - Exit:   decisionRecommendation is "Sell" or "Avoid" (the
//                   Decision Engine already told us to sell/avoid this
//                   business — reused directly, not reclassified).
//         - Trim:   decisionRecommendation is "Reduce", OR this position's
//                   own weight breaches the existing single-symbol/sector
//                   concentration caps (reused, unmodified).
//         - Upgrade: decisionRecommendation is "Hold" and the position's own
//                   rankScore is below the Decision Engine's own 65-point
//                   pass bar (statusFromScore's own passAt default), AND a
//                   real, meaningfully better same-sector alternative
//                   (rankScore >= held rankScore + UPGRADE_GAP_THRESHOLD)
//                   exists in the wider opportunity universe.
//         - Core:   everything else (Buy/Accumulate, or a Hold with no
//                   better alternative found).
//   (b) A short, deterministic evidence-bundling composition per
//       candidate/replacement — quoting only already-computed fields, never
//       a new judgment — plus a one-line portfolio/risk/diversification
//       impact sentence built from arithmetic over already-known weights
//       and sector membership.
//   (c) A deterministic aggregation for Capital Allocation Suggestions
//       (summing already-known weights of Exit/Trim candidates vs. already-
//       known cash headroom) — arithmetic only, never a new formula.
//
// NEVER PREDICTS PRICES, NEVER FORECASTS RETURNS: every sentence below
// describes a weight, a score, a rating, or a verdict that already exists —
// never a price target, an expected return, or a probability of any kind.

import type { PortfolioIntelligenceAnalysis, PortfolioHoldingIntelligence } from "./portfolioIntelligence.js";
import type { OpportunityRow } from "./opportunityDiscovery.js";
import { SINGLE_SYMBOL_CONCENTRATION_CAP_PCT, SECTOR_CONCENTRATION_CAP_PCT } from "./investingRisk.js";

// Matches Decision Engine's own statusFromScore() default pass bar exactly —
// reused, not redefined, so "below the Decision Engine's own pass bar" means
// the literal same threshold the Decision Engine's checklist already applies.
const DECISION_ENGINE_PASS_BAR = 65;
// A disclosed, named margin: a same-sector alternative must beat the held
// position's own rankScore by at least this many points to count as a real,
// meaningfully-better alternative — never a fabricated precision, a round
// number in the same spirit as every other named threshold in this codebase.
const UPGRADE_GAP_THRESHOLD = 15;
// A disclosed, named floor: cash allocation below this is treated as
// "nothing meaningful to deploy" rather than surfacing a deployment
// suggestion for a rounding-error amount of cash.
const CASH_DEPLOYMENT_FLOOR_PCT = 2;

export type OptimisationAction = "exit" | "trim" | "upgrade" | "core";

export interface OptimisationEvidenceMetric {
  label: string;
  value: string;
}

export interface OptimisationEvidence {
  metrics: OptimisationEvidenceMetric[];
  decisionEngineRecommendation: string;
  investmentCommitteeRecommendation: string;
  rankExplanation: string;
  portfolioImpact: string;
  riskImpact: string;
  diversificationImpact: string;
}

export interface OptimisationPositionRow {
  symbol: string;
  name: string;
  sector: string | null;
  weightPct: number | null;
  qualityScore: number | null;
  valuationRating: string;
  investmentCommitteeVerdict: string;
  decisionRecommendation: string;
  rankScore: number;
  action: OptimisationAction;
  actionReason: string;
}

export interface OptimisationCandidate {
  symbol: string;
  name: string;
  sector: string | null;
  weightPct: number | null;
  action: OptimisationAction;
  reason: string;
  evidence: OptimisationEvidence;
}

export interface ReplacementOpportunity {
  forSymbol: string | null; // the weak holding this would replace; null for a general cash-deployment pick
  symbol: string;
  name: string;
  sector: string | null;
  evidence: OptimisationEvidence;
}

export interface CapitalAllocationSuggestion {
  action: string;
  detail: string;
}

export interface PortfolioOptimisationAnalysis {
  portfolioId: number;
  health: {
    qualityScore: number | null;
    qualityLabel: string;
    capitalAllocationScore: number | null;
    diversificationScore: number | null;
    diversificationLabel: string;
    overallRiskScore: number | null;
    overallRiskLabel: string;
    summary: string;
  };
  concentration: PortfolioIntelligenceAnalysis["risk"]["concentration"];
  diversification: {
    bySector: PortfolioIntelligenceAnalysis["allocation"]["bySector"];
    byIndustry: PortfolioIntelligenceAnalysis["allocation"]["byIndustry"];
    growthValueMix: PortfolioIntelligenceAnalysis["allocation"]["growthValueMix"];
    qualityMix: PortfolioIntelligenceAnalysis["allocation"]["qualityMix"];
    largestPositionPct: number | null;
    top10ExposurePct: number | null;
  };
  positionQualityRanking: OptimisationPositionRow[];
  upgradeCandidates: OptimisationCandidate[];
  trimCandidates: OptimisationCandidate[];
  exitCandidates: OptimisationCandidate[];
  capitalAllocationSuggestions: CapitalAllocationSuggestion[];
  replacementOpportunities: ReplacementOpportunity[];
  cashDeploymentSuggestions: ReplacementOpportunity[];
  summary: string;
  disclaimer: string;
}

export const OPTIMISATION_DISCLAIMER =
  "Educational research only — not investment advice or a recommendation to buy, hold, sell, or trade any security. " +
  "Every figure above is a direct reuse of an already-computed analytical engine (Portfolio Intelligence, the Decision " +
  "Engine, the Investment Committee, and Opportunity Discovery) — this module performs deterministic classification " +
  "and evidence assembly only, never a new valuation model, never a new score, never a price prediction, never a " +
  "return forecast.";

function fmtPct(n: number | null): string {
  return n == null ? "n/a" : `${n.toFixed(1)}%`;
}

function metricsFor(row: OpportunityRow): OptimisationEvidenceMetric[] {
  return [
    { label: "Business Quality", value: `${row.businessQualityScore}/100` },
    { label: "Financial Strength", value: `${row.financialStrengthScore}/100 (${row.financialStrengthRating})` },
    { label: "Valuation", value: row.valuationRating },
    { label: "Margin of Safety", value: row.marginOfSafety != null ? `${(row.marginOfSafety * 100).toFixed(0)}%` : "n/a" },
    { label: "Investment Committee", value: `${row.investmentCommitteeVerdict} (confidence ${row.investmentCommitteeConfidence}/100)` },
    { label: "Tom Nash Conviction", value: `${row.tomNashConvictionScore}/100 (${row.tomNashVerdict})` },
    { label: "Decision Engine Synthesis Score", value: `${row.rankScore}/100` },
  ];
}

function sectorAlreadyHeld(sector: string | null, bySector: PortfolioIntelligenceAnalysis["allocation"]["bySector"]): boolean {
  if (!sector) return false;
  return bySector.some((s) => s.label === sector);
}

function classify(
  row: OpportunityRow,
  weightPct: number | null,
  universe: OpportunityRow[],
  heldSymbols: Set<string>,
  sectorExposure: PortfolioIntelligenceAnalysis["risk"]["sectorExposure"],
): { action: OptimisationAction; reason: string } {
  if (row.decisionRecommendation === "Sell" || row.decisionRecommendation === "Avoid") {
    return {
      action: "exit",
      reason: `Decision Engine recommends ${row.decisionRecommendation} (synthesis score ${row.rankScore}/100).`,
    };
  }

  const weightBreach = weightPct != null && weightPct > SINGLE_SYMBOL_CONCENTRATION_CAP_PCT;
  const sectorBreach =
    sectorExposure.capBreached && row.sector != null && row.sector === sectorExposure.largestSector;
  if (row.decisionRecommendation === "Reduce" || weightBreach || sectorBreach) {
    const reasonParts: string[] = [];
    if (row.decisionRecommendation === "Reduce") reasonParts.push(`Decision Engine recommends Reduce (synthesis score ${row.rankScore}/100)`);
    if (weightBreach) reasonParts.push(`position is ${fmtPct(weightPct)} of the portfolio, above the ${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}% single-symbol concentration cap`);
    if (sectorBreach) reasonParts.push(`its sector (${row.sector}) is ${sectorExposure.largestSectorWeightPct}% of the portfolio, above the ${SECTOR_CONCENTRATION_CAP_PCT}% sector concentration cap`);
    return { action: "trim", reason: reasonParts.join("; ") + "." };
  }

  if (row.decisionRecommendation === "Hold" && row.rankScore < DECISION_ENGINE_PASS_BAR) {
    const better = universe.find(
      (u) => u.sector === row.sector && !heldSymbols.has(u.symbol.toUpperCase()) && u.rankScore >= row.rankScore + UPGRADE_GAP_THRESHOLD,
    );
    if (better) {
      return {
        action: "upgrade",
        reason: `Decision Engine recommends Hold with a synthesis score of only ${row.rankScore}/100 (below the ${DECISION_ENGINE_PASS_BAR}-point pass bar), and ${better.symbol} ranks ${better.rankScore}/100 in the same sector (${row.sector ?? "unclassified"}).`,
      };
    }
  }

  return { action: "core", reason: `Decision Engine recommends ${row.decisionRecommendation} (synthesis score ${row.rankScore}/100).` };
}

function riskImpactFor(action: OptimisationAction, weightPct: number | null): string {
  if (action === "exit") {
    return weightPct != null
      ? `Exiting this ${fmtPct(weightPct)} position removes it entirely from single-symbol and sector concentration.`
      : "Exiting removes this position entirely from single-symbol and sector concentration.";
  }
  if (action === "trim") {
    return weightPct != null && weightPct > SINGLE_SYMBOL_CONCENTRATION_CAP_PCT
      ? `Trimming below ${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}% would bring this position back under the single-symbol concentration cap (currently ${fmtPct(weightPct)}).`
      : "Trimming reduces this position's contribution to single-symbol concentration.";
  }
  if (action === "upgrade") return "Swapping into a higher-ranked same-sector alternative does not change sector concentration.";
  return "No concentration-cap concern identified for this position.";
}

function diversificationImpactFor(sector: string | null, replacesSector: string | null, bySector: PortfolioIntelligenceAnalysis["allocation"]["bySector"]): string {
  if (!sector) return "Sector unclassified — diversification impact cannot be determined.";
  if (replacesSector != null && replacesSector === sector) {
    return `Same sector (${sector}) as the position it would replace — no change to sector diversification, only to position quality within that sector.`;
  }
  return sectorAlreadyHeld(sector, bySector)
    ? `${sector} is already represented in the portfolio — no new sector diversification from this pick alone.`
    : `Adds exposure to ${sector}, a sector not currently represented in the portfolio — improves sector diversification.`;
}

export function buildPortfolioOptimisation(
  portfolioId: number,
  intelligence: PortfolioIntelligenceAnalysis,
  heldRows: OpportunityRow[],
  universeRows: OpportunityRow[],
): PortfolioOptimisationAnalysis {
  const weightBySymbol = new Map<string, number | null>(intelligence.holdings.map((h: PortfolioHoldingIntelligence) => [h.symbol, h.weightPct]));
  const heldSymbols = new Set(heldRows.map((r) => r.symbol.toUpperCase()));
  const bySector = intelligence.allocation.bySector;

  const rankedHeld = [...heldRows].sort((a, b) => b.rankScore - a.rankScore || a.symbol.localeCompare(b.symbol));

  const positionQualityRanking: OptimisationPositionRow[] = rankedHeld.map((row) => {
    const weightPct = weightBySymbol.get(row.symbol) ?? null;
    const { action, reason } = classify(row, weightPct, universeRows, heldSymbols, intelligence.risk.sectorExposure);
    return {
      symbol: row.symbol,
      name: row.name,
      sector: row.sector,
      weightPct,
      qualityScore: row.investmentQualityScore,
      valuationRating: row.valuationRating,
      investmentCommitteeVerdict: row.investmentCommitteeVerdict,
      decisionRecommendation: row.decisionRecommendation,
      rankScore: row.rankScore,
      action,
      actionReason: reason,
    };
  });

  function toCandidate(pos: OptimisationPositionRow, row: OpportunityRow): OptimisationCandidate {
    return {
      symbol: pos.symbol,
      name: pos.name,
      sector: pos.sector,
      weightPct: pos.weightPct,
      action: pos.action,
      reason: pos.actionReason,
      evidence: {
        metrics: metricsFor(row),
        decisionEngineRecommendation: row.decisionRecommendation,
        investmentCommitteeRecommendation: row.investmentCommitteeVerdict,
        rankExplanation: row.rankExplanation,
        portfolioImpact: pos.weightPct != null ? `Currently ${fmtPct(pos.weightPct)} of the portfolio.` : "Weight could not be resolved.",
        riskImpact: riskImpactFor(pos.action, pos.weightPct),
        diversificationImpact: diversificationImpactFor(pos.sector, null, bySector),
      },
    };
  }

  const heldBySymbol = new Map(heldRows.map((r) => [r.symbol, r]));
  const upgradeCandidates: OptimisationCandidate[] = [];
  const trimCandidates: OptimisationCandidate[] = [];
  const exitCandidates: OptimisationCandidate[] = [];
  for (const pos of positionQualityRanking) {
    const row = heldBySymbol.get(pos.symbol);
    if (!row) continue;
    const candidate = toCandidate(pos, row);
    if (pos.action === "exit") exitCandidates.push(candidate);
    else if (pos.action === "trim") trimCandidates.push(candidate);
    else if (pos.action === "upgrade") upgradeCandidates.push(candidate);
  }

  // Replacement Opportunities: for each Upgrade/Exit/Trim candidate, reuse
  // the wider universe's already-ranked, not-already-held rows, filtered to
  // the same sector — a direct reuse of the same "Buy-rated, not already
  // held" definition bucketOpportunities()'s own portfolio-upgrade-
  // candidates bucket already applies.
  const notHeldRanked = [...universeRows]
    .filter((r) => r.decisionRecommendation === "Buy" && !heldSymbols.has(r.symbol.toUpperCase()))
    .sort((a, b) => b.rankScore - a.rankScore || a.symbol.localeCompare(b.symbol));

  const replacementOpportunities: ReplacementOpportunity[] = [];
  const weakPositions = [...exitCandidates, ...trimCandidates, ...upgradeCandidates];
  for (const weak of weakPositions) {
    const sameSector = notHeldRanked.filter((r) => r.sector === weak.sector).slice(0, 3);
    for (const r of sameSector) {
      replacementOpportunities.push({
        forSymbol: weak.symbol,
        symbol: r.symbol,
        name: r.name,
        sector: r.sector,
        evidence: {
          metrics: metricsFor(r),
          decisionEngineRecommendation: r.decisionRecommendation,
          investmentCommitteeRecommendation: r.investmentCommitteeVerdict,
          rankExplanation: r.rankExplanation,
          portfolioImpact: `Not currently held — would be a new position, potentially funded by reducing ${weak.symbol}.`,
          riskImpact: `${r.symbol} ranks ${r.rankScore}/100 vs. ${weak.symbol}'s ${weak.evidence.metrics.find((m) => m.label === "Decision Engine Synthesis Score")?.value ?? "n/a"}.`,
          diversificationImpact: diversificationImpactFor(r.sector, weak.sector, bySector),
        },
      });
    }
  }

  // Cash Deployment Suggestions: only surfaced when there's meaningful cash
  // headroom, per intelligence.allocation.cashAllocationPct — the wider
  // universe's own top-ranked, not-already-held picks, unfiltered by sector.
  const cashDeploymentSuggestions: ReplacementOpportunity[] = [];
  const cashPct = intelligence.allocation.cashAllocationPct;
  if (cashPct != null && cashPct >= CASH_DEPLOYMENT_FLOOR_PCT) {
    for (const r of notHeldRanked.slice(0, 5)) {
      cashDeploymentSuggestions.push({
        forSymbol: null,
        symbol: r.symbol,
        name: r.name,
        sector: r.sector,
        evidence: {
          metrics: metricsFor(r),
          decisionEngineRecommendation: r.decisionRecommendation,
          investmentCommitteeRecommendation: r.investmentCommitteeVerdict,
          rankExplanation: r.rankExplanation,
          portfolioImpact: `Not currently held — ${fmtPct(cashPct)} of the portfolio is currently unallocated cash.`,
          riskImpact: "Deploying idle cash into a single new position increases that position's own concentration from zero — size accordingly.",
          diversificationImpact: diversificationImpactFor(r.sector, null, bySector),
        },
      });
    }
  }

  // Capital Allocation Suggestions: deterministic arithmetic over already-
  // known weights — never a new formula.
  const capitalAllocationSuggestions: CapitalAllocationSuggestion[] = [];
  const weakWeightTotal = [...exitCandidates, ...trimCandidates].reduce((s, c) => s + (c.weightPct ?? 0), 0);
  if (weakWeightTotal > 0) {
    capitalAllocationSuggestions.push({
      action: `Reduce exposure to ${exitCandidates.length + trimCandidates.length} position(s)`,
      detail: `Exit and Trim candidates together represent approximately ${weakWeightTotal.toFixed(1)}% of current portfolio weight.`,
    });
  }
  if (cashPct != null && cashPct >= CASH_DEPLOYMENT_FLOOR_PCT) {
    capitalAllocationSuggestions.push({
      action: "Deploy idle cash",
      detail: `${fmtPct(cashPct)} of the portfolio is currently unallocated cash — see Cash Deployment Suggestions below.`,
    });
  }
  if (replacementOpportunities.length > 0) {
    capitalAllocationSuggestions.push({
      action: "Consider same-sector replacements",
      detail: `${replacementOpportunities.length} higher-ranked, same-sector alternative(s) were found for the Upgrade/Trim/Exit candidates below.`,
    });
  }
  if (capitalAllocationSuggestions.length === 0) {
    capitalAllocationSuggestions.push({
      action: "No allocation changes suggested",
      detail: "No Exit/Trim candidates, no meaningful idle cash, and no same-sector replacement found — current allocation appears reasonable by the Decision Engine's own thresholds.",
    });
  }

  const overallRisk = intelligence.risk.overall;
  const health = {
    qualityScore: intelligence.qualityScore.score,
    qualityLabel: intelligence.qualityScore.label,
    capitalAllocationScore: intelligence.capitalAllocationScore.score,
    diversificationScore: intelligence.diversificationScore.score,
    diversificationLabel: intelligence.diversificationScore.label,
    overallRiskScore: overallRisk.score,
    overallRiskLabel: overallRisk.label,
    summary: intelligence.summary,
  };

  const summary =
    `Portfolio quality ${health.qualityScore ?? "n/a"}/100 (${health.qualityLabel}), diversification ${health.diversificationScore ?? "n/a"}/100. ` +
    `${exitCandidates.length} Exit, ${trimCandidates.length} Trim, and ${upgradeCandidates.length} Upgrade candidate(s) identified among ${positionQualityRanking.length} held position(s), ` +
    `with ${replacementOpportunities.length} same-sector replacement(s) and ${cashDeploymentSuggestions.length} cash-deployment idea(s) found.`;

  return {
    portfolioId,
    health,
    concentration: intelligence.risk.concentration,
    diversification: {
      bySector: intelligence.allocation.bySector,
      byIndustry: intelligence.allocation.byIndustry,
      growthValueMix: intelligence.allocation.growthValueMix,
      qualityMix: intelligence.allocation.qualityMix,
      largestPositionPct: intelligence.allocation.largestPositionPct,
      top10ExposurePct: intelligence.allocation.top10ExposurePct,
    },
    positionQualityRanking,
    upgradeCandidates,
    trimCandidates,
    exitCandidates,
    capitalAllocationSuggestions,
    replacementOpportunities,
    cashDeploymentSuggestions,
    summary,
    disclaimer: OPTIMISATION_DISCLAIMER,
  };
}

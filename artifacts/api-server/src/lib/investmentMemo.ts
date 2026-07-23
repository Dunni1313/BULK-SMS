// Phase 19 — Institutional Investment Committee Workbench.
//
// PURE, DETERMINISTIC, TEMPLATE-BASED COMPOSITION — the same discipline as
// investmentThesisGenerator.ts (Phase 12). Zero LLM calls, zero new
// scoring/valuation logic, zero new financial calculations. Every section
// below is a plain string template filled in from fields an already-built
// ValueResearchReport (valueReport.ts) and an already-built
// InstitutionalDecisionAnalysis (decisionEngine.ts) already computed —
// Business Quality, Economic Moat, Competitive Advantage, Financial
// Strength, the four valuation models, the Consolidated Margin of Safety,
// the Investment Committee, and the Decision Engine's own synthesis,
// evidence, checklist, risks, catalysts, and portfolio fit are all read
// from, never modified, never re-derived, never second-guessed.
//
// The two remaining sections (Research Notes, Monitoring Summary) are
// sourced from plain, already-fetched rows the route layer hands in — this
// module never touches the database or makes a provider call itself,
// matching the "pure function over already-resolved data" discipline used
// throughout this codebase (e.g. tradingRisk.ts, portfolioOptimisation.ts).
//
// This module never produces a NEW buy/sell recommendation, a new score,
// or a price target. Every verdict it cites (Decision Engine recommendation,
// Investment Committee verdict) is the one an already-approved, already-
// existing engine already concluded.

import type { ValueResearchReport } from "./valueReport.js";
import type { InstitutionalDecisionAnalysis } from "./decisionEngine.js";
import { VALUE_DISCLAIMER } from "./valueReport.js";

export interface InvestmentMemoSection {
  heading: string;
  paragraphs: string[];
}

export interface InvestmentMemoResearchNote {
  note: string;
  createdAt: string;
}

export interface InvestmentMemoMonitoringAlert {
  title: string;
  message: string;
  severity: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface InvestmentMemo {
  symbol: string;
  name: string;
  asOf: string;
  dataSource: ValueResearchReport["dataSource"];
  generatedAt: string;
  recommendation: InstitutionalDecisionAnalysis["recommendation"];
  confidence: number;
  overview: string;
  sections: InvestmentMemoSection[];
  disclaimer: string;
}

function fmtPct(x: number | null | undefined, dp = 1): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "not available";
  return `${(x * 100).toFixed(dp)}%`;
}

function fmtMoney(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "not available";
  return `$${x.toFixed(2)}`;
}

// 1. Business Summary — plain descriptive facts already on the report
// header, never a judgment.
function businessSummarySection(report: ValueResearchReport): InvestmentMemoSection {
  const sectorLine = report.sector
    ? `${report.name} (${report.symbol}) operates in the ${report.sector} sector (${report.industry}).`
    : `${report.name} (${report.symbol}) — sector/industry classification not available.`;
  return {
    heading: "Business Summary",
    paragraphs: [
      `${sectorLine} Analysis as of ${report.asOf}, using ${report.dataSource} data.${
        report.kind === "etf" ? " This symbol is classified as a diversified fund, not a single operating company." : ""
      }`,
    ],
  };
}

// 2. Business Quality — reuses report.businessQuality directly.
function businessQualitySection(report: ValueResearchReport): InvestmentMemoSection {
  const bq = report.businessQuality;
  return {
    heading: "Business Quality",
    paragraphs: [`Scores ${bq.score.toFixed(0)}/100, rated "${bq.rating}." ${bq.summary}`],
  };
}

// 3. Competitive Advantage — reuses report.competitiveAdvantage and
// report.moat directly.
function competitiveAdvantageSection(report: ValueResearchReport): InvestmentMemoSection {
  const { moat, competitiveAdvantage: ca } = report;
  const paragraphs = [`Economic moat rated "${moat.rating}" (score ${moat.score.toFixed(0)}/100, estimated durability ~${moat.durabilityYears} year(s)). ${moat.summary}`];
  if (ca.score !== null) {
    paragraphs.push(`11-dimension Competitive Advantage classification: "${ca.classification}" (score ${ca.score.toFixed(0)}/100, confidence ${ca.confidenceLevel}). ${ca.summary}`);
  } else {
    paragraphs.push(`Competitive Advantage scoring is not available for this company today: ${ca.summary}`);
  }
  return { heading: "Competitive Advantage", paragraphs };
}

// 4. Financial Strength — reuses report.financialStrength and
// report.investmentQuality directly.
function financialStrengthSection(report: ValueResearchReport): InvestmentMemoSection {
  const { financialStrength: fin, investmentQuality: iq } = report;
  const paragraphs = [`Financial strength rated "${fin.rating}" (score ${fin.score.toFixed(0)}/100). ${fin.summary}`];
  if (iq.score !== null) {
    paragraphs.push(`Investment Quality (12-metric framework): ${iq.score.toFixed(0)}/100, ${iq.confidenceLevel.toLowerCase()} confidence. ${iq.summary}`);
  }
  if (fin.flags.length > 0) paragraphs.push(`Flagged items: ${fin.flags.join("; ")}.`);
  return { heading: "Financial Strength", paragraphs };
}

// 5. Valuation Summary — reuses the four already-computed valuation models
// directly, never recomputed.
function valuationSummarySection(report: ValueResearchReport): InvestmentMemoSection {
  const { valuation: blended, grahamValuation: graham, dcfValuation: dcf, buffettValuation: buffett } = report;
  const modelLine = (
    label: string,
    v: { available: boolean; fairValue?: number; marginOfSafety?: number; rating?: string; reason?: string },
  ): string =>
    v.available
      ? `${label}: fair value ${fmtMoney(v.fairValue)}, margin of safety ${fmtPct(v.marginOfSafety)}, rated "${v.rating}."`
      : `${label}: not available (${v.reason}).`;
  return {
    heading: "Valuation Summary",
    paragraphs: [
      [modelLine("Blended model", blended), modelLine("Graham model", graham), modelLine("DCF model", dcf), modelLine("Buffett model", buffett)].join(" "),
      "These are historical, deterministic valuation methods applied to already-reported financial data — none predict a future stock price.",
    ],
  };
}

// 6. Margin of Safety — reuses report.consolidatedMarginOfSafety directly,
// distinct from the per-model Valuation Summary above.
function marginOfSafetySection(report: ValueResearchReport): InvestmentMemoSection {
  const mos = report.consolidatedMarginOfSafety;
  if (mos.modelsAvailable === 0 || mos.averageFairValue === null) {
    return { heading: "Margin of Safety", paragraphs: [`No deterministic valuation model produced a usable margin-of-safety estimate. ${mos.summary}`] };
  }
  return {
    heading: "Margin of Safety",
    paragraphs: [
      `${mos.modelsAvailable} of ${mos.modelsConsidered} models produced a usable estimate at the current price of ${fmtMoney(mos.price)}. ` +
        `Fair value ranges from ${fmtMoney(mos.minFairValue)} to ${fmtMoney(mos.maxFairValue)} (average ${fmtMoney(mos.averageFairValue)}), an average margin of safety of ${fmtPct(mos.averageMarginOfSafety)}. ` +
        `Model agreement: "${mos.agreement}." ${mos.summary}`,
    ],
  };
}

// 7. Decision Engine — reuses the already-built InstitutionalDecisionAnalysis
// directly (its own synthesis, drivers, checklist).
function decisionEngineSection(decision: InstitutionalDecisionAnalysis): InvestmentMemoSection {
  const paragraphs = [`Recommendation: "${decision.recommendation}" (confidence ${decision.confidence}/100). ${decision.summary} ${decision.explanation}`];
  if (decision.drivers.length > 0) paragraphs.push(`Key drivers: ${decision.drivers.join("; ")}.`);
  const passing = decision.checklist.filter((c) => c.status === "pass").length;
  paragraphs.push(`Checklist: ${passing} of ${decision.checklist.length} item(s) pass.`);
  return { heading: "Decision Engine", paragraphs };
}

// 8. Investment Committee Verdict — reuses report.investmentCommittee
// directly.
function investmentCommitteeVerdictSection(report: ValueResearchReport): InvestmentMemoSection {
  const ic = report.investmentCommittee;
  return {
    heading: "Investment Committee Verdict",
    paragraphs: [
      `Consolidated verdict: "${ic.consolidatedVerdict}" (confidence ${ic.confidenceScore.toFixed(0)}/100, agreement "${ic.agreement}" among ${ic.votes.length} model(s)). ${ic.summary}`,
    ],
  };
}

// 9. Portfolio Impact — reuses decision.portfolioFit directly.
function portfolioImpactSection(decision: InstitutionalDecisionAnalysis): InvestmentMemoSection {
  const fit = decision.portfolioFit;
  if (!fit.available) {
    return { heading: "Portfolio Impact", paragraphs: [fit.reason ?? "No portfolio context supplied for this review."] };
  }
  const paragraphs = [fit.alreadyHeld ? `Already held — current weight ${fit.currentWeightPct?.toFixed(1) ?? "unknown"}%.` : "Not currently held in the selected portfolio."];
  if (fit.sectorExposurePct !== null && fit.sectorExposurePct !== undefined) {
    paragraphs.push(`This symbol's sector currently represents ${fit.sectorExposurePct.toFixed(1)}% of the portfolio.`);
  }
  return { heading: "Portfolio Impact", paragraphs };
}

// 10. Risk Summary — reuses decision.risks and decision.thingsToMonitor
// directly (already-synthesized fields, never re-derived).
function riskSummarySection(decision: InstitutionalDecisionAnalysis): InvestmentMemoSection {
  const paragraphs: string[] = [];
  paragraphs.push(decision.risks.length > 0 ? `Risks: ${decision.risks.join("; ")}.` : "No risks identified.");
  if (decision.thingsToMonitor.length > 0) paragraphs.push(`Things to monitor: ${decision.thingsToMonitor.join("; ")}.`);
  return { heading: "Risk Summary", paragraphs };
}

// 11. Catalysts — reuses decision.catalysts directly.
function catalystsSection(decision: InstitutionalDecisionAnalysis): InvestmentMemoSection {
  return {
    heading: "Catalysts",
    paragraphs: [decision.catalysts.length > 0 ? decision.catalysts.join("; ") + "." : "No catalysts identified."],
  };
}

// 12. Research Notes — reuses already-fetched investing_research_notes rows
// (the route layer's own existing GET /research-notes/:symbol query),
// never a new note store.
function researchNotesSection(notes: InvestmentMemoResearchNote[]): InvestmentMemoSection {
  if (notes.length === 0) return { heading: "Research Notes", paragraphs: ["No research notes recorded for this symbol yet."] };
  return {
    heading: "Research Notes",
    paragraphs: notes.slice(0, 10).map((n) => `[${new Date(n.createdAt).toLocaleDateString()}] ${n.note}`),
  };
}

// 13. Monitoring Summary — reuses already-fetched platform_notifications
// rows filtered by this symbol (the route layer's own query, reusing
// routes/notifications.ts's own formatNotification), never a new alert rule.
function monitoringSummarySection(alerts: InvestmentMemoMonitoringAlert[]): InvestmentMemoSection {
  if (alerts.length === 0) return { heading: "Monitoring Summary", paragraphs: ["No monitoring alerts recorded for this symbol."] };
  const unread = alerts.filter((a) => !a.isRead);
  const paragraphs = [`${alerts.length} alert(s) recorded for this symbol (${unread.length} unread).`];
  paragraphs.push(...alerts.slice(0, 5).map((a) => `[${new Date(a.createdAt).toLocaleDateString()}] ${a.title}: ${a.message}`));
  return { heading: "Monitoring Summary", paragraphs };
}

// 14. Conclusion — restates the Decision Engine's own already-computed
// recommendation; introduces no new verdict.
function conclusionSection(decision: InstitutionalDecisionAnalysis): InvestmentMemoSection {
  return {
    heading: "Conclusion",
    paragraphs: [
      `This memo's bottom line restates the Decision Engine's own already-computed recommendation: "${decision.recommendation}" with ${decision.confidence}/100 confidence. ${decision.summary}`,
      "This memo introduces no new score, no new valuation model, and no new buy/sell/price recommendation — every section above cites an already-computed engine output.",
    ],
  };
}

export const MEMO_DISCLAIMER =
  VALUE_DISCLAIMER +
  " This Investment Memo is a deterministic, template-based document assembled entirely from the analysis above; it was not written by an AI language model, does not predict a future price, and is not a buy, sell, or hold recommendation beyond restating the platform's own existing, already-computed Decision Engine and Investment Committee outputs.";

// Pure — no I/O, no provider calls, no LLM. Every input is already-built
// (ValueResearchReport, InstitutionalDecisionAnalysis) or already-fetched
// by the route layer (research notes, monitoring alerts).
export function buildInvestmentMemo(
  report: ValueResearchReport,
  decision: InstitutionalDecisionAnalysis,
  researchNotes: InvestmentMemoResearchNote[] = [],
  monitoringAlerts: InvestmentMemoMonitoringAlert[] = [],
): InvestmentMemo {
  const overview =
    `A deterministic Investment Committee memo for ${report.name} (${report.symbol}), assembled entirely from already-computed Engine 1 analysis ` +
    `(Business Quality, Economic Moat, Competitive Advantage, Financial Strength, Valuation, Margin of Safety, the Decision Engine, and the Investment Committee) ` +
    `plus the user's own Research Notes and Monitoring alerts. No LLM narration, no new scoring, no price prediction.`;

  return {
    symbol: report.symbol,
    name: report.name,
    asOf: report.asOf,
    dataSource: report.dataSource,
    generatedAt: new Date().toISOString(),
    recommendation: decision.recommendation,
    confidence: decision.confidence,
    overview,
    sections: [
      businessSummarySection(report),
      businessQualitySection(report),
      competitiveAdvantageSection(report),
      financialStrengthSection(report),
      valuationSummarySection(report),
      marginOfSafetySection(report),
      decisionEngineSection(decision),
      investmentCommitteeVerdictSection(report),
      portfolioImpactSection(decision),
      riskSummarySection(decision),
      catalystsSection(decision),
      researchNotesSection(researchNotes),
      monitoringSummarySection(monitoringAlerts),
      conclusionSection(decision),
    ],
    disclaimer: MEMO_DISCLAIMER,
  };
}

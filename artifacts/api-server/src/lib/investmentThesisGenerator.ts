// Phase 12 — Institutional Investing Engine Consolidation & Integration.
//
// Investment Thesis Generator: the one genuinely-missing capability the
// repository audit identified with no existing equivalent anywhere in
// Engine 1 (confirmed by grep before this file was written — zero prior
// matches for "InvestmentThesis"/"investment_thesis" in lib/ or routes/).
//
// PURE, DETERMINISTIC, TEMPLATE-BASED COMPOSITION. Zero LLM calls, zero
// new scoring/valuation logic, zero new financial calculations. Every
// sentence below is a plain string template filled in from fields an
// already-built ValueResearchReport (valueReport.ts) already computed —
// Business Quality (investmentQuality.ts), Economic Moat (valueInvesting.ts),
// Competitive Advantage (competitiveAdvantage.ts), Financial Strength/
// Ratios (valueInvesting.ts/financialRatios.ts), Graham/DCF/Buffett/
// Blended valuation, the Consolidated Margin of Safety
// (marginOfSafety.ts), the Tom Nash Conviction Engine (tomNashEngine.ts),
// and the AI Investment Committee (investmentCommittee.ts) — every one
// of those is read from, never modified, never re-derived, never
// second-guessed.
//
// This module never produces a NEW buy/sell recommendation or price
// target. Where the report already contains a Buy/Hold/Wait verdict or
// conviction score (Tom Nash, the Investment Committee, the existing
// ValueDecision), the thesis DESCRIBES what those already-approved,
// already-existing engines concluded — it does not invent a new one.
// It is not predictive: no future price is ever stated or implied.

import type { ValueResearchReport } from "./valueReport.js";
import { VALUE_DISCLAIMER } from "./valueReport.js";

export interface InvestmentThesisSection {
  heading: string;
  paragraphs: string[];
}

export interface InvestmentThesis {
  symbol: string;
  name: string;
  asOf: string;
  dataSource: ValueResearchReport["dataSource"];
  generatedAt: string;
  overview: string;
  sections: InvestmentThesisSection[];
  supportingPoints: string[];
  riskFactors: string[];
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

function businessOverviewSection(report: ValueResearchReport): InvestmentThesisSection {
  const { businessQuality: bq, moat, competitiveAdvantage: ca } = report;
  const paragraphs: string[] = [
    `${report.name} (${report.symbol}) scores ${bq.score.toFixed(0)}/100 on the Business Quality scale, rated "${bq.rating}." ${bq.summary}`,
    `Its economic moat is rated "${moat.rating}" (score ${moat.score.toFixed(0)}/100, an estimated durability of roughly ${moat.durabilityYears} year(s)). ${moat.summary}`,
  ];
  if (ca.score !== null) {
    paragraphs.push(
      `On the 11-dimension Competitive Advantage framework, the company classifies as "${ca.classification}" (score ${ca.score.toFixed(0)}/100, confidence: ${ca.confidenceLevel}). ${ca.summary}`,
    );
  } else {
    paragraphs.push(`Competitive Advantage scoring is not available for this company today: ${ca.summary}`);
  }
  return { heading: "Business Overview", paragraphs };
}

function financialHealthSection(report: ValueResearchReport): InvestmentThesisSection {
  const { financialStrength: fin, investmentQuality: iq } = report;
  const paragraphs: string[] = [
    `Financial strength is rated "${fin.rating}" (score ${fin.score.toFixed(0)}/100). ${fin.summary}`,
  ];
  if (iq.score !== null) {
    paragraphs.push(
      `Across the 12-metric Investment Quality framework (growth, returns on capital, margins, debt, cash position, and more), the company scores ${iq.score.toFixed(0)}/100 with ${iq.confidenceLevel.toLowerCase()} confidence. ${iq.summary}`,
    );
  } else {
    paragraphs.push(`Investment Quality scoring is not available for this company today: ${iq.summary}`);
  }
  if (fin.flags.length > 0) {
    paragraphs.push(`Flagged financial-health items: ${fin.flags.join("; ")}.`);
  }
  return { heading: "Financial Health", paragraphs };
}

function valuationSection(report: ValueResearchReport): InvestmentThesisSection {
  const { consolidatedMarginOfSafety: mos, valuation: blended, grahamValuation: graham, dcfValuation: dcf, buffettValuation: buffett } = report;
  const paragraphs: string[] = [];

  if (mos.modelsAvailable > 0 && mos.averageFairValue !== null) {
    paragraphs.push(
      `${mos.modelsAvailable} of ${mos.modelsConsidered} deterministic valuation models produced a usable fair-value estimate at the current price of ${fmtMoney(mos.price)}. ` +
        `Estimated fair value ranges from ${fmtMoney(mos.minFairValue)} to ${fmtMoney(mos.maxFairValue)} (average ${fmtMoney(mos.averageFairValue)}), implying an average margin of safety of ${fmtPct(mos.averageMarginOfSafety)}. ` +
        `The models' agreement on direction is "${mos.agreement}." ${mos.summary}`,
    );
  } else {
    paragraphs.push(`No deterministic valuation model produced a usable estimate for this company today. ${mos.summary}`);
  }

  const modelLine = (label: string, v: typeof blended | typeof graham | typeof dcf | typeof buffett): string => {
    if (v.available) {
      return `${label}: fair value ${fmtMoney(v.fairValue)}, margin of safety ${fmtPct(v.marginOfSafety)}, rated "${v.rating}."`;
    }
    return `${label}: not available (${v.reason}).`;
  };
  paragraphs.push(
    [modelLine("Blended model", blended), modelLine("Graham model", graham), modelLine("DCF model", dcf), modelLine("Buffett model", buffett)].join(
      " ",
    ),
  );

  paragraphs.push(
    "These are historical, deterministic valuation methods (P/E, EV/EBITDA, DCF, Graham Number, and owner-earnings-based approaches) applied to already-reported financial data — none of them estimate or predict a future stock price.",
  );

  return { heading: "Valuation", paragraphs };
}

function institutionalPerspectiveSection(report: ValueResearchReport): InvestmentThesisSection {
  const { tomNash, investmentCommittee: ic } = report;
  const paragraphs: string[] = [
    `The Tom Nash Conviction Engine — a composite of Business Quality, Growth, Capital Allocation, Financial Strength, and Valuation pillars — computes a conviction score of ${tomNash.convictionScore.toFixed(0)}/100 and a "${tomNash.verdict}" read (data completeness ${(tomNash.dataCompleteness * 100).toFixed(0)}%). ${tomNash.summary}`,
    `The AI Investment Committee consolidates the independent votes of the Graham, Buffett, and Tom Nash models into a single "${ic.consolidatedVerdict}" verdict with ${ic.confidenceScore.toFixed(0)}/100 confidence and "${ic.agreement}" agreement among the ${ic.votes.length} model(s) that produced a usable vote. ${ic.summary}`,
  ];
  return { heading: "Institutional Perspective", paragraphs };
}

function conclusionSection(report: ValueResearchReport): InvestmentThesisSection {
  const { decision } = report;
  const paragraphs: string[] = [
    `Summarizing the above, the platform's existing Value Decision framework reads "${decision.verdict}" with a conviction of ${decision.conviction.toFixed(0)}/100. ${decision.summary}`,
    "This thesis is a structured summary of the analysis already computed above — it introduces no new score, no new valuation model, and no new buy/sell/price recommendation. Every figure it cites can be traced back to a specific section of the full research report.",
  ];
  return { heading: "Conclusion", paragraphs };
}

function collectSupportingPoints(report: ValueResearchReport): string[] {
  const points: string[] = [];
  if (report.investmentQuality.strengths.length > 0) points.push(...report.investmentQuality.strengths.slice(0, 3));
  if (report.competitiveAdvantage.strengths.length > 0) points.push(...report.competitiveAdvantage.strengths.slice(0, 3));
  if (report.moat.rating !== "None") points.push(`Economic moat rated "${report.moat.rating}."`);
  return points.slice(0, 8);
}

function collectRiskFactors(report: ValueResearchReport): string[] {
  const factors: string[] = report.risks.map((r) => `[${r.severity.toUpperCase()}] ${r.text}`);
  if (report.investmentQuality.weaknesses.length > 0) factors.push(...report.investmentQuality.weaknesses.slice(0, 3));
  if (report.competitiveAdvantage.weaknesses.length > 0) factors.push(...report.competitiveAdvantage.weaknesses.slice(0, 3));
  return factors.slice(0, 10);
}

const THESIS_DISCLAIMER =
  VALUE_DISCLAIMER +
  " This Investment Thesis is a deterministic, template-based summary assembled entirely from the analysis above; it was not written by an AI language model, does not predict a future price, and is not a buy, sell, or hold recommendation beyond restating the platform's own existing, already-computed decision framework.";

// Pure — no I/O, no provider calls, no LLM. Every input is an already-built
// ValueResearchReport (valueReport.ts), so this composes in-memory only.
export function buildInvestmentThesis(report: ValueResearchReport): InvestmentThesis {
  const overview = `A deterministic, institutional-style investment thesis for ${report.name} (${report.symbol}), assembled entirely from already-computed Engine 1 analysis (Business Quality, Economic Moat, Competitive Advantage, Financial Strength, Valuation, the Tom Nash Conviction Engine, and the AI Investment Committee). No LLM narration, no new scoring, no price prediction.`;

  return {
    symbol: report.symbol,
    name: report.name,
    asOf: report.asOf,
    dataSource: report.dataSource,
    generatedAt: new Date().toISOString(),
    overview,
    sections: [
      businessOverviewSection(report),
      financialHealthSection(report),
      valuationSection(report),
      institutionalPerspectiveSection(report),
      conclusionSection(report),
    ],
    supportingPoints: collectSupportingPoints(report),
    riskFactors: collectRiskFactors(report),
    disclaimer: THESIS_DISCLAIMER,
  };
}

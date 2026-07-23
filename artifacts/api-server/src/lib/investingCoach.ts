// Phase 21 — Institutional AI Coach & Education Platform.
//
// PURE ORCHESTRATION AND EDUCATIONAL LAYER. This module creates no new
// valuation model, no new scoring system, and no new investment
// recommendation — it exists ONLY to explain and teach using outputs that
// already exist, exactly the same "compose, never compute" discipline every
// prior Phase-14+ module already established (Decision Engine, Opportunity
// Discovery, Portfolio Optimisation, the Investment Committee Workbench,
// the Investment Memo). Confirmed by construction: every field this module
// reads is already present on ValueResearchReport (Phase 2),
// InstitutionalDecisionAnalysis (Phase 14), formatted notifications
// (platform_notifications), or an already-resolved DecisionPortfolioContext
// (Phase 14) — none of it is fetched, computed, or re-derived here.
//
// The only genuinely new content in this file is STATIC, PER-COACH
// EDUCATIONAL COPY (commonMistakes / institutionalPerspective / howToInterpret)
// — hand-authored teaching material that never varies per symbol and never
// encodes a new judgment about any specific company. Every per-symbol
// sentence in a CoachExplanation is a direct quote (or a trivial relabeling)
// of a field that was already computed by an existing, already-tested engine.
//
// Mirrors metricExplainer.ts's own "Explain Mode" precedent (Options Income
// Engine, existing before this phase) at Engine-1 scope: that module answers
// "what does this options metric mean, right now, for my real account,"
// reusing intelligenceObservations.ts's Explanation Engine when a live
// Observation exists. This module answers the equivalent question for
// Engine 1's own already-computed research/decision/portfolio/committee
// outputs — a second, symbol-scoped explainer, not a duplicate of the first
// (metricExplainer.ts is untouched, unmodified, and not imported here).

import type { ValueResearchReport } from "./valueReport.js";
import type {
  InstitutionalDecisionAnalysis,
  DecisionPortfolioContext,
  ChecklistItem,
} from "./decisionEngine.js";
import { SINGLE_SYMBOL_CONCENTRATION_CAP_PCT, SECTOR_CONCENTRATION_CAP_PCT } from "./investingRisk.js";

export type CoachType =
  | "investment"
  | "portfolio"
  | "decision"
  | "valuation"
  | "risk"
  | "research"
  | "monitoring"
  | "committee";

export const COACH_TYPES: CoachType[] = [
  "investment",
  "portfolio",
  "decision",
  "valuation",
  "risk",
  "research",
  "monitoring",
  "committee",
];

export const COACH_LABELS: Record<CoachType, string> = {
  investment: "Investment Coach",
  portfolio: "Portfolio Coach",
  decision: "Decision Coach",
  valuation: "Valuation Coach",
  risk: "Risk Coach",
  research: "Research Coach",
  monitoring: "Monitoring Coach",
  committee: "Committee Coach",
};

export interface CoachEvidenceItem {
  label: string;
  detail: string;
  source: string; // which already-existing engine/field this quotes, e.g. "Decision Engine — Supporting Evidence"
}

export interface CoachExplanation {
  coach: CoachType;
  coachLabel: string;
  symbol: string;
  headline: string; // one-line summary of why the current recommendation/reading exists
  whyThisExists: string; // paragraph-level explanation, quoting already-computed fields
  metricsUsed: CoachEvidenceItem[]; // which existing metrics produced the reading
  supportingEvidence: CoachEvidenceItem[]; // which existing evidence supports it
  risksReducingConfidence: string[]; // which risks reduced confidence
  strengthsIncreasingConfidence: string[]; // which strengths increased confidence
  howToInterpret: string[]; // how to read the numbers — static, generic, never per-symbol invented
  commonMistakes: string[]; // static, hand-authored, per-coach
  institutionalPerspective: string; // static, hand-authored, per-coach — "how institutional investors think about this"
  relatedGlossaryKeys: string[];
  calculationSources: string[]; // named existing modules/engines the numbers above were quoted from
  disclaimer: string;
}

export const COACH_DISCLAIMER =
  "Institutional AI Coach — Educational, Deterministic, Evidence Based. The Coach never invents a recommendation, " +
  "score, or forecast: every figure above is a direct quote from an existing, already-computed engine (Business " +
  "Quality, Competitive Advantage, Financial Strength, Valuation, Margin of Safety, the Decision Engine, Portfolio " +
  "Optimisation, the Investment Committee, and Tom Nash's conviction score). This module only explains and teaches " +
  "using outputs that already exist — it creates no new valuation model, scoring system, or investment recommendation, " +
  "and this is not investment advice.";

function ev(label: string, detail: string, source: string): CoachEvidenceItem {
  return { label, detail, source };
}

function statusWord(s: ChecklistItem["status"]): string {
  if (s === "pass") return "passes";
  if (s === "warning") return "shows a warning";
  if (s === "fail") return "fails";
  return "is unavailable for";
}

// ---------------------------------------------------------------------------
// 1. Investment Coach — the high-level "why this call" tutor. Reuses the
//    Decision Engine's own recommendation/explanation/evidence/checklist,
//    plus Business Quality and Moat for the "is this a good business" lens.
// ---------------------------------------------------------------------------
export function explainInvestmentCoach(report: ValueResearchReport, decision: InstitutionalDecisionAnalysis): CoachExplanation {
  const metricsUsed: CoachEvidenceItem[] = [
    ev("Business Quality", `${report.businessQuality.score}/100 (${report.businessQuality.rating})`, "Business Quality Engine"),
    ev("Economic Moat", `${report.moat.rating} (${report.moat.score}/100)`, "Economic Moat Analysis"),
    ev("Financial Strength", `${report.financialStrength.rating} (${report.financialStrength.score}/100)`, "Financial Strength Analysis"),
    ev("Investment Committee", `${report.investmentCommittee.consolidatedVerdict} (${report.investmentCommittee.confidenceScore}/100 confidence, ${report.investmentCommittee.agreement})`, "Investment Committee"),
    ev("Tom Nash Conviction", `${report.tomNash.convictionScore}/100 (${report.tomNash.verdict})`, "Tom Nash Investment Engine"),
  ];
  const supportingEvidence = decision.supportingEvidence.map((e) => ev(e.label, e.detail, "Decision Engine — Supporting Evidence"));

  return {
    coach: "investment",
    coachLabel: COACH_LABELS.investment,
    symbol: report.symbol,
    headline: `${report.symbol}: ${decision.recommendation} — confidence ${decision.confidence}/100`,
    whyThisExists: decision.explanation,
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence: [...decision.risks, ...decision.weaknesses],
    strengthsIncreasingConfidence: decision.strengths,
    howToInterpret: [
      "The recommendation ladder runs Buy → Accumulate → Hold → Reduce → Sell → Avoid — each step is a synthesis of the Investment Committee's verdict and the Decision Engine's own synthesis score, never a standalone number.",
      "Confidence (0-100) measures how much already-computed evidence backs the call, not how certain the future outcome is — a low-confidence Buy means the underlying data is thin, not that the direction is wrong.",
      "A 'Wonderful' or 'Good' Business Quality rating describes the business itself, independent of price — pair it with Valuation before concluding a stock is a buy.",
    ],
    commonMistakes: [
      "Treating a single rating as a guarantee of future returns — every score here is a snapshot of already-known fundamentals, not a forecast.",
      "Ignoring the confidence score and agreement signal — acting on a split-committee, low-confidence call carries materially more risk than a unanimous, high-confidence one.",
      "Conflating a good business (Business Quality, Moat) with a good buy (Valuation, Margin of Safety) — the two lenses answer different questions.",
    ],
    institutionalPerspective:
      "Institutional investors rarely act on one signal. They cross-check business quality (is this a good business), price (are we overpaying), and catalysts (why now, why not just hold cash) before sizing a position — exactly the three lenses the platform's Business Quality, Valuation, and Decision Engine sections already provide, side by side, on this same report.",
    relatedGlossaryKeys: ["institutional-decision-engine", "business-quality-score", "economic-moat", "decision-confidence-score"],
    calculationSources: ["Business Quality Engine", "Economic Moat Analysis", "Financial Strength Analysis", "Investment Committee", "Tom Nash Investment Engine", "Decision Engine"],
    disclaimer: COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 2. Portfolio Coach — explains portfolio fit/impact using the same
//    DecisionPortfolioContext the Decision Engine's own checklist already
//    resolves (Phase 14) — reused unmodified, never re-derived here.
// ---------------------------------------------------------------------------
export function explainPortfolioCoach(
  report: ValueResearchReport,
  decision: InstitutionalDecisionAnalysis,
  portfolioContext: DecisionPortfolioContext | null,
): CoachExplanation {
  const fit = decision.portfolioFit;
  const metricsUsed: CoachEvidenceItem[] = [];
  const supportingEvidence: CoachEvidenceItem[] = [];
  let headline: string;
  let whyThisExists: string;

  if (!fit.available || !portfolioContext) {
    headline = `${report.symbol}: no portfolio was supplied`;
    whyThisExists =
      fit.reason ??
      "Portfolio fit was not evaluated — pass ?portfolioId= for one of your own Portfolio Construction portfolios to see this symbol's weight, sector exposure, and its effect on diversification and risk.";
  } else {
    metricsUsed.push(
      ev("Already held?", fit.alreadyHeld ? "Yes" : "No", "Portfolio Construction — Holdings"),
      ev("Current weight", fit.currentWeightPct != null ? `${fit.currentWeightPct.toFixed(1)}%` : "unresolved", "Portfolio Construction — Holdings"),
      ev("Sector exposure", fit.sectorExposurePct != null ? `${fit.sectorExposurePct.toFixed(1)}%` : "unresolved", "Portfolio Intelligence — Diversification"),
      ev("Portfolio diversification score", portfolioContext.diversificationScore != null ? `${portfolioContext.diversificationScore}/100` : "unavailable", "Portfolio Intelligence"),
      ev("Portfolio risk score", portfolioContext.portfolioRiskScore != null ? `${portfolioContext.portfolioRiskScore}/100` : "unavailable", "Portfolio Intelligence — Risk"),
    );
    supportingEvidence.push(
      ev("Single-symbol concentration cap", `${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}%`, "Portfolio Risk — Concentration Cap"),
      ev("Sector concentration cap", `${SECTOR_CONCENTRATION_CAP_PCT}%`, "Portfolio Risk — Sector Cap"),
    );
    headline = `${report.symbol}: ${fit.alreadyHeld ? `already held at ${fit.currentWeightPct?.toFixed(1) ?? "?"}%` : "not currently held"}`;
    whyThisExists = fit.alreadyHeld
      ? `This symbol is already a ${fit.currentWeightPct?.toFixed(1) ?? "an unresolved"}% position in the selected portfolio${fit.sectorExposurePct != null ? `, and its sector accounts for ${fit.sectorExposurePct.toFixed(1)}% of total exposure` : ""}. Compare both figures against the platform's own concentration caps (${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}% single-symbol, ${SECTOR_CONCENTRATION_CAP_PCT}% sector) to see whether adding more would breach them.`
      : `This symbol is not currently held in the selected portfolio. Portfolio Optimisation (if you open it for this portfolio) will flag whether it belongs on the Replacement Opportunities or Cash Deployment list.`;
  }

  return {
    coach: "portfolio",
    coachLabel: COACH_LABELS.portfolio,
    symbol: report.symbol,
    headline,
    whyThisExists,
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence: fit.available && fit.currentWeightPct != null && fit.currentWeightPct > SINGLE_SYMBOL_CONCENTRATION_CAP_PCT
      ? [`Current weight (${fit.currentWeightPct.toFixed(1)}%) already exceeds the ${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}% single-symbol concentration cap.`]
      : [],
    strengthsIncreasingConfidence: fit.available && portfolioContext?.diversificationScore != null && portfolioContext.diversificationScore >= 65
      ? [`The portfolio's own diversification score (${portfolioContext.diversificationScore}/100) is already healthy.`]
      : [],
    howToInterpret: [
      "Weight and sector exposure are read directly off your own Portfolio Construction holdings — they are not a suggestion of what your weight should be.",
      "The concentration caps (single-symbol and sector) are the same fixed thresholds the Decision Engine's own Portfolio Fit checklist item and Portfolio Optimisation's Trim/Exit classification both already use.",
      "A high diversification score does not mean a specific position is safe — it describes the whole portfolio, not this one symbol.",
    ],
    commonMistakes: [
      "Sizing a new position without checking sector exposure — two uncorrelated-looking symbols in the same sector still concentrate risk.",
      "Reading 'not held' as an automatic buy signal — it only means this symbol isn't yet part of this specific portfolio.",
      "Ignoring the portfolio risk score when adding to an already-large position — concentration risk compounds, it does not average out.",
    ],
    institutionalPerspective:
      "Institutional portfolio managers think in terms of active weight and marginal contribution to risk, not just 'do I like this stock.' The same position can be a sensible core holding at 3% and a real concentration problem at 15% — the caps and diversification score above exist to make that distinction visible before it becomes a problem.",
    relatedGlossaryKeys: ["portfolio-construction", "concentration", "diversification", "portfolio-diversification-score"],
    calculationSources: ["Portfolio Construction — Holdings", "Portfolio Intelligence", "Portfolio Risk — Concentration Cap", "Decision Engine — Portfolio Fit"],
    disclaimer: COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 3. Decision Coach — deep-dive on the Decision Engine's own checklist,
//    drivers, and why-buy/why-wait/why-sell reasoning.
// ---------------------------------------------------------------------------
export function explainDecisionCoach(report: ValueResearchReport, decision: InstitutionalDecisionAnalysis): CoachExplanation {
  const metricsUsed = decision.checklist.map((c) => ev(c.label, `${statusWord(c.status)} — ${c.explanation}`, "Decision Engine — Checklist"));
  const supportingEvidence = decision.supportingEvidence.map((e) => ev(e.label, e.detail, "Decision Engine — Supporting Evidence"));
  const contradicting = decision.contradictingEvidence.map((e) => `${e.label}: ${e.detail}`);

  return {
    coach: "decision",
    coachLabel: COACH_LABELS.decision,
    symbol: report.symbol,
    headline: `${report.symbol}: ${decision.recommendation} (${decision.checklist.filter((c) => c.status === "pass").length}/${decision.checklist.length} checklist items pass)`,
    whyThisExists: decision.explanation,
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence: [...contradicting, ...decision.thingsToMonitor],
    strengthsIncreasingConfidence: decision.drivers,
    howToInterpret: [
      "The checklist is a threshold read of already-computed scores/ratings (pass/warning/fail/unavailable) — it never recomputes any underlying number.",
      "Why Buy / Why Wait / Why Sell are three separate angles on the same evidence — a strong Why Buy list and a non-empty Why Wait list can both be true at once; the recommendation itself resolves which weighs more.",
      "'Unavailable' on a checklist item (e.g. Management Quality without a resolvable filing) is an honest gap, never treated as a fail.",
    ],
    commonMistakes: [
      "Reading a single failed checklist item as disqualifying — the Decision Engine already weighs every item together into one recommendation.",
      "Skipping 'Things to Monitor' — it exists specifically to surface what wasn't available or what changed since the checklist last passed.",
      "Assuming Why Wait items mean 'don't buy' — they often mean 'the setup is fine, the price/timing argues for patience.'",
    ],
    institutionalPerspective:
      "A formal investment checklist is standard institutional practice precisely because it forces every position through the same set of questions, in the same order, regardless of how exciting the story is — reducing the chance a single compelling narrative overrides a real balance-sheet or valuation problem.",
    relatedGlossaryKeys: ["institutional-decision-engine", "investment-checklist", "supporting-contradicting-evidence", "decision-confidence-score"],
    calculationSources: ["Decision Engine — Checklist", "Decision Engine — Supporting/Contradicting Evidence"],
    disclaimer: COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 4. Valuation Coach — the four named valuation models plus the
//    Consolidated Margin of Safety, all reused directly.
// ---------------------------------------------------------------------------
export function explainValuationCoach(report: ValueResearchReport): CoachExplanation {
  const cms = report.consolidatedMarginOfSafety;
  const metricsUsed: CoachEvidenceItem[] = [
    ev("Blended fair value", report.valuation.available ? `$${report.valuation.fairValue.toFixed(2)} (${report.valuation.rating})` : `unavailable — ${report.valuation.reason}`, "Blended Valuation Model"),
    ev("Graham valuation", report.grahamValuation.available ? `$${report.grahamValuation.fairValue.toFixed(2)} (${report.grahamValuation.rating})` : `unavailable — ${report.grahamValuation.reason}`, "Graham Valuation Engine"),
    ev("DCF valuation", report.dcfValuation.available ? `$${report.dcfValuation.fairValue.toFixed(2)} (${report.dcfValuation.rating}, ${report.dcfValuation.confidenceLabel} confidence)` : `unavailable — ${report.dcfValuation.reason}`, "DCF Valuation Engine"),
    ev("Buffett valuation", report.buffettValuation.available ? `$${report.buffettValuation.fairValue.toFixed(2)} (${report.buffettValuation.rating})` : `unavailable — ${report.buffettValuation.reason}`, "Buffett Valuation Engine"),
  ];
  const supportingEvidence: CoachEvidenceItem[] = [
    ev("Consolidated average fair value", cms.averageFairValue != null ? `$${cms.averageFairValue.toFixed(2)}` : "unavailable", "Consolidated Margin of Safety"),
    ev("Average margin of safety", cms.averageMarginOfSafety != null ? `${(cms.averageMarginOfSafety * 100).toFixed(1)}%` : "unavailable", "Consolidated Margin of Safety"),
    ev("Model agreement", cms.agreement, "Consolidated Margin of Safety"),
    ev("Models considered / available", `${cms.modelsAvailable} of ${cms.modelsConsidered}`, "Consolidated Margin of Safety"),
  ];

  return {
    coach: "valuation",
    coachLabel: COACH_LABELS.valuation,
    symbol: report.symbol,
    headline: `${report.symbol}: ${cms.summary}`,
    whyThisExists: `Four independent, already-computed valuation models (Blended, Graham, DCF, Buffett) each estimate a fair value from ${report.symbol}'s own fundamentals; the Consolidated Margin of Safety module (reused, not recomputed here) averages the models that produced a usable value and reports how much they agree.`,
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence: cms.agreement === "split" || cms.agreement === "insufficient-data" ? [`Models ${cms.agreement === "split" ? "disagree (split)" : "have insufficient data"} — treat the average fair value with more caution than a unanimous read.`] : [],
    strengthsIncreasingConfidence: cms.agreement === "unanimous" || cms.agreement === "majority" ? [`Models show ${cms.agreement} agreement on direction (cheap/fair/expensive).`] : [],
    howToInterpret: [
      "Margin of safety = (fair value − price) / fair value — a positive number means the model considers the stock undervalued, a negative number means overvalued.",
      "Each model uses a different method (classic Graham formula, multi-year discounted cash flow, Buffett-style owner-earnings perpetuity, a blended composite) — they will not agree on an exact number, and that is expected; the agreement signal exists to show whether they at least agree on direction.",
      "'Unavailable' (e.g. DCF when free cash flow is not positive) is an honest gap in that one model, not evidence the stock is a poor investment.",
    ],
    commonMistakes: [
      "Treating any single model's fair value as precise — all four are estimates built on simplifying assumptions, not a promise of where the price will go.",
      "Ignoring model disagreement — a split verdict across models is itself useful information, not noise to average away.",
      "Buying purely because a stock is 'cheap' by one model while ignoring Business Quality and Financial Strength — a statistically cheap but structurally weak business is a value trap, not a bargain.",
    ],
    institutionalPerspective:
      "Institutional valuation work almost never relies on one model. Analysts triangulate across methods (comparable multiples, DCF, owner-earnings) precisely because each embeds different assumptions — when several independent methods agree on direction, that convergence carries more weight than any single number.",
    relatedGlossaryKeys: ["margin-of-safety", "intrinsic-value", "discounted-cash-flow", "graham-number", "owner-earnings"],
    calculationSources: ["Blended Valuation Model", "Graham Valuation Engine", "DCF Valuation Engine", "Buffett Valuation Engine", "Consolidated Margin of Safety"],
    disclaimer: COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 5. Risk Coach — reuses the Decision Engine's own risk checklist item plus
//    the report's own risk flags and Financial Strength's own flags.
// ---------------------------------------------------------------------------
export function explainRiskCoach(report: ValueResearchReport, decision: InstitutionalDecisionAnalysis): CoachExplanation {
  const riskItem = decision.riskChecklistItem;
  const metricsUsed: CoachEvidenceItem[] = [
    ev("Portfolio risk checklist", `${statusWord(riskItem.status)} — ${riskItem.explanation}`, "Decision Engine — Risk Checklist"),
    ev("Diversification checklist", `${statusWord(decision.diversificationChecklistItem.status)} — ${decision.diversificationChecklistItem.explanation}`, "Decision Engine — Diversification Checklist"),
    ev("Financial Strength", `${report.financialStrength.rating} (${report.financialStrength.score}/100)`, "Financial Strength Analysis"),
  ];
  const supportingEvidence: CoachEvidenceItem[] = report.risks.map((r) => ev(`${r.severity} severity`, r.text, "Value Research Report — Risk Flags"));

  return {
    coach: "risk",
    coachLabel: COACH_LABELS.risk,
    symbol: report.symbol,
    headline: `${report.symbol}: ${report.risks.length} recorded risk flag${report.risks.length === 1 ? "" : "s"}, ${report.financialStrength.flags.length} financial-strength flag${report.financialStrength.flags.length === 1 ? "" : "s"}`,
    whyThisExists: `Risk here is read directly from three already-computed sources: this report's own risk flags (severity-tagged), Financial Strength's own flags, and — when a portfolio is supplied — the Decision Engine's Portfolio Risk and Diversification checklist items (single-symbol cap ${SINGLE_SYMBOL_CONCENTRATION_CAP_PCT}%, sector cap ${SECTOR_CONCENTRATION_CAP_PCT}%). No new risk model is computed by this Coach.`,
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence: [...report.financialStrength.flags, ...decision.risks],
    strengthsIncreasingConfidence: report.financialStrength.rating === "Strong" || report.financialStrength.rating === "Acceptable" ? [`Financial Strength rates ${report.financialStrength.rating} — the balance sheet itself is not flagged as a source of risk.`] : [],
    howToInterpret: [
      "Risk flags are severity-tagged (low/medium/high) — a high-severity flag deserves more weight than several low-severity ones combined.",
      "The Portfolio Risk and Diversification checklist items only populate when a portfolio is supplied — without one, they honestly read 'unavailable,' not 'low risk.'",
      "Financial Strength flags describe balance-sheet-level risk (leverage, coverage, liquidity) — distinct from valuation risk (overpaying) or concentration risk (portfolio-level).",
    ],
    commonMistakes: [
      "Reading zero recorded risk flags as 'risk-free' — it means no flag tripped the existing thresholds, not that no risk exists.",
      "Weighing all risk flags equally regardless of severity.",
      "Evaluating single-symbol risk in isolation from portfolio-level concentration risk — the two are captured by different checklist items for a reason.",
    ],
    institutionalPerspective:
      "Institutional risk management separates position-level risk (is this specific business financially sound) from portfolio-level risk (does adding this position over-concentrate the book) — this Coach mirrors that separation by keeping Financial Strength's flags distinct from the Decision Engine's own Portfolio Risk/Diversification checklist items.",
    relatedGlossaryKeys: ["event-risk", "stress-testing", "concentration", "monitoring-alert"],
    calculationSources: ["Value Research Report — Risk Flags", "Financial Strength Analysis", "Decision Engine — Risk Checklist", "Decision Engine — Diversification Checklist"],
    disclaimer: COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 6. Research Coach — surfaces the underlying factor-level detail behind
//    Business Quality, Investment Quality, and Competitive Advantage.
// ---------------------------------------------------------------------------
export function explainResearchCoach(report: ValueResearchReport): CoachExplanation {
  const metricsUsed: CoachEvidenceItem[] = report.businessQuality.factors.map((f) => ev(f.label, `${f.score}/100 — ${f.detail}`, "Business Quality — Factors"));
  const supportingEvidence: CoachEvidenceItem[] = report.competitiveAdvantage.dimensions
    .filter((d) => d.score != null)
    .slice(0, 6)
    .map((d) => ev(d.dimension, `${d.score}/100 — ${d.detail}`, "Competitive Advantage — Dimensions"));
  const unavailableDims = report.competitiveAdvantage.dimensions.filter((d) => d.score == null).map((d) => `${d.dimension}: ${d.reason ?? "unavailable"}`);

  return {
    coach: "research",
    coachLabel: COACH_LABELS.research,
    symbol: report.symbol,
    headline: `${report.symbol}: Business Quality ${report.businessQuality.score}/100, Investment Quality ${report.investmentQuality.score ?? "n/a"}/100, Competitive Advantage ${report.competitiveAdvantage.score ?? "n/a"}/100 (${report.competitiveAdvantage.classification})`,
    whyThisExists: `${report.businessQuality.summary} ${report.competitiveAdvantage.summary}`,
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence: [...report.investmentQuality.weaknesses, ...unavailableDims],
    strengthsIncreasingConfidence: [...report.investmentQuality.strengths, ...report.competitiveAdvantage.strengths],
    howToInterpret: [
      "Business Quality's factors are already-weighted sub-scores (e.g. growth, profitability, moat inputs) — read the lowest-scoring factor first, since it usually explains why the overall score isn't higher.",
      "Competitive Advantage's 11 dimensions are individually reported so a genuinely unavailable dimension (e.g. customer concentration, which needs filing data no provider yet supplies) never silently drags the average — it's excluded from the score, not counted as zero.",
      "Investment Quality's confidence level reflects how many of its 12 metrics were actually computable, not how good the company is.",
    ],
    commonMistakes: [
      "Averaging factor scores yourself instead of reading the already-computed overall score — the weighting is deliberate, not equal-weighted.",
      "Treating an 'unavailable' dimension as a weakness — it is a genuine data gap, disclosed rather than approximated.",
      "Reading Competitive Advantage's classification (Wide/Medium/Narrow/None) as identical to the separate Economic Moat rating — they use the same vocabulary but are computed from different, complementary inputs.",
    ],
    institutionalPerspective:
      "Institutional research analysts build a company view from the ground up — unit economics, competitive positioning, capital efficiency — before ever looking at price. Reading the factor-level detail here, not just the headline score, is exactly that process: understanding *why* a business scores the way it does, not just what the number is.",
    relatedGlossaryKeys: ["business-quality-score", "competitive-advantage-dimensions", "return-on-invested-capital", "return-on-equity"],
    calculationSources: ["Business Quality — Factors", "Investment Quality Analysis", "Competitive Advantage — Dimensions"],
    disclaimer: COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 7. Monitoring Coach — reuses the user's own recorded alerts for this
//    symbol (platform_notifications, the same rows GET /notifications and
//    the Investment Memo's Monitoring Summary already read).
// ---------------------------------------------------------------------------
export interface CoachNotification {
  type: string;
  title: string;
  message: string;
  severity: string | null;
  createdAt: string;
}

export function explainMonitoringCoach(report: ValueResearchReport, alerts: CoachNotification[]): CoachExplanation {
  const metricsUsed: CoachEvidenceItem[] = [ev("Recorded alerts for this symbol", `${alerts.length}`, "Monitoring — platform_notifications")];
  const supportingEvidence: CoachEvidenceItem[] = alerts.slice(0, 8).map((a) => ev(a.title, a.message, `Monitoring Alert (${a.severity ?? "unspecified"} severity)`));

  return {
    coach: "monitoring",
    coachLabel: COACH_LABELS.monitoring,
    symbol: report.symbol,
    headline: alerts.length ? `${report.symbol}: ${alerts.length} recorded monitoring alert${alerts.length === 1 ? "" : "s"}` : `${report.symbol}: no monitoring alerts recorded yet`,
    whyThisExists: alerts.length
      ? `These alerts were generated by the platform's existing Monitoring & Alerts system (price-target crossings, portfolio-drift, and watchlist/opportunity triggers) — reused here exactly as recorded, never re-evaluated or re-scored by this Coach.`
      : `No alert has fired for ${report.symbol} yet. Alerts are generated when an existing, already-configured trigger (a price target, portfolio drift, or a watchlist/opportunity condition) is actually crossed — nothing to explain until one exists.`,
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence: alerts.filter((a) => a.severity === "high").map((a) => `${a.title}: ${a.message}`),
    strengthsIncreasingConfidence: [],
    howToInterpret: [
      "An alert records a condition that was true at the moment it fired — it is a historical fact, not a live, continuously-updating signal.",
      "Severity (low/medium/high) reflects how the triggering rule itself classified the condition, not a judgment this Coach adds.",
      "The absence of alerts does not mean nothing is happening — it means no configured trigger has crossed its threshold yet.",
    ],
    commonMistakes: [
      "Treating an old alert as still current — always check its timestamp before acting on it.",
      "Assuming more alerts always means more risk — a cluster of alerts can also reflect closely-watched, well-covered triggers rather than deteriorating fundamentals.",
      "Ignoring monitoring entirely between research sessions — that is exactly the gap the alert system exists to close.",
    ],
    institutionalPerspective:
      "Institutional desks separate research (periodic, deep) from monitoring (continuous, shallow but timely) for a reason — a thesis can remain sound between formal reviews while a specific trigger (a price target, a drift threshold) still needs an immediate look. Alerts are the bridge between the two.",
    relatedGlossaryKeys: ["monitoring-alert", "alert-severity", "portfolio-drift-alert", "watchlist-and-opportunity-triggers"],
    calculationSources: ["Monitoring — platform_notifications"],
    disclaimer: COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// 8. Committee Coach — reuses the Investment Committee's own votes,
//    consolidated verdict, confidence, agreement, and reasoning verbatim.
// ---------------------------------------------------------------------------
export function explainCommitteeCoach(report: ValueResearchReport): CoachExplanation {
  const committee = report.investmentCommittee;
  const metricsUsed: CoachEvidenceItem[] = committee.votes.map((v) => ev(v.analyst, `${v.verdict} (${v.confidence}/100 confidence)`, "Investment Committee — Votes"));
  const supportingEvidence: CoachEvidenceItem[] = committee.reasoning.map((r, i) => ev(`Reasoning ${i + 1}`, r, "Investment Committee — Reasoning"));

  return {
    coach: "committee",
    coachLabel: COACH_LABELS.committee,
    symbol: report.symbol,
    headline: `${report.symbol}: Investment Committee votes ${committee.consolidatedVerdict} (${committee.agreement}, ${committee.confidenceScore}/100 confidence)`,
    whyThisExists: committee.summary,
    metricsUsed,
    supportingEvidence,
    risksReducingConfidence: committee.agreement === "split" ? ["Analysts disagree (split) — the consolidated verdict defaults to Hold when the committee is genuinely split, per the platform's own approved design."] : [],
    strengthsIncreasingConfidence: committee.agreement === "unanimous" ? ["All voting analysts agree unanimously on direction."] : committee.agreement === "majority" ? ["A majority of voting analysts agree on direction."] : [],
    howToInterpret: [
      "Each analyst (Graham, Buffett, Tom Nash) votes independently from its own already-computed valuation/conviction output — Graham and Buffett cast a Buy/Hold/Wait vote derived from their own rating; Tom Nash votes with its own already-computed verdict directly.",
      "Confidence per vote and the consolidated confidence score are both averages of already-computed numbers — never a new probability estimate.",
      "Agreement (unanimous/majority/split/insufficient-data) describes how many analysts actually agree — read it alongside the verdict, not instead of it.",
    ],
    commonMistakes: [
      "Treating the consolidated verdict as a fourth, independent opinion — it is a deterministic aggregation of the three votes shown, nothing more.",
      "Ignoring a genuinely split committee — the safe Hold default exists precisely because acting on a coin-flip disagreement is riskier than waiting for more confirmation.",
      "Assuming every analyst always votes — Graham/Buffett are excluded from voting entirely when their own valuation model reports itself unavailable (e.g. a company with negative trailing EPS), which is honest, not a gap to fill in.",
    ],
    institutionalPerspective:
      "A real investment committee's value comes from forcing independent perspectives to be reconciled explicitly, rather than blended silently into one number — seeing exactly where Graham, Buffett, and Tom Nash agree or disagree is more informative than a single composite score would be, which is why this Coach shows every vote, not just the outcome.",
    relatedGlossaryKeys: ["investment-committee-workbench", "decision-confidence-score", "conviction-score"],
    calculationSources: ["Investment Committee — Votes", "Investment Committee — Reasoning"],
    disclaimer: COACH_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// Top-level dispatcher — the single entry point the route layer calls.
// ---------------------------------------------------------------------------
export interface CoachContext {
  report: ValueResearchReport;
  decision: InstitutionalDecisionAnalysis;
  portfolioContext?: DecisionPortfolioContext | null;
  alerts?: CoachNotification[];
}

export function explainCoach(coach: CoachType, ctx: CoachContext): CoachExplanation {
  switch (coach) {
    case "investment":
      return explainInvestmentCoach(ctx.report, ctx.decision);
    case "portfolio":
      return explainPortfolioCoach(ctx.report, ctx.decision, ctx.portfolioContext ?? null);
    case "decision":
      return explainDecisionCoach(ctx.report, ctx.decision);
    case "valuation":
      return explainValuationCoach(ctx.report);
    case "risk":
      return explainRiskCoach(ctx.report, ctx.decision);
    case "research":
      return explainResearchCoach(ctx.report);
    case "monitoring":
      return explainMonitoringCoach(ctx.report, ctx.alerts ?? []);
    case "committee":
      return explainCommitteeCoach(ctx.report);
  }
}

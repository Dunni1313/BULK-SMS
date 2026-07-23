// Phase 40 — Institutional Decision Support & Executive Insights Engine.
//
// Reuses the existing Institutional AI Coach's own disclaimer contract
// (lib/coach.ts's COACH_DISCLAIMER, imported unmodified — never
// re-authored), the same pattern lib/scenarioCoach.ts (Phase 39),
// lib/performanceAttributionCoach.ts (Phase 38), and
// lib/riskExposureCoach.ts (Phase 37) already established. Every
// explanation below is deterministic, template-based prose about
// CONCEPTS only — never a trade recommendation, never a buy/sell signal,
// never a market forecast. "Never recommend trades" is enforced
// structurally: no function here takes a symbol, a position, a live
// quote, or an account figure as input — only a topic key.

import { COACH_DISCLAIMER } from "./coach.js";

export const DECISION_SUPPORT_COACH_TOPICS = [
  "executive_dashboards",
  "institutional_decision_support",
  "portfolio_interpretation",
  "risk",
  "performance",
  "scenario_analysis",
  "diversification",
  "capital_allocation",
] as const;
export type DecisionSupportCoachTopic = (typeof DECISION_SUPPORT_COACH_TOPICS)[number];

export interface DecisionSupportCoachExplanation {
  topic: DecisionSupportCoachTopic;
  title: string;
  explanation: string[];
  disclaimer: string;
}

const EXPLANATIONS: Record<DecisionSupportCoachTopic, { title: string; explanation: string[] }> = {
  executive_dashboards: {
    title: "Executive Dashboards",
    explanation: [
      "An executive dashboard exists to answer one question fast: 'what does my whole portfolio look like right now, across every engine I use?' — without opening Investing, Trading, and Options separately and mentally reconciling three different views.",
      "This platform's Decision Support Engine never computes a new figure of its own — every number on it is read directly from an already-shipped, already-tested engine (Risk & Exposure, Performance & Attribution, Scenario & Stress Testing, Portfolio Dashboard). The dashboard's own job is composition and presentation, not calculation.",
      "An executive dashboard is a starting point for your own review, never a final verdict — it surfaces what's true today so you can decide what, if anything, deserves closer attention.",
    ],
  },
  institutional_decision_support: {
    title: "Institutional Decision Support",
    explanation: [
      "Decision support means organizing real, already-computed information so a decision-maker can reason about it clearly — it is not the same as decision automation, and this platform never crosses that line.",
      "Every section here — Portfolio Health, Risk, Performance, Scenario, Capital Allocation, Exposure, Diversification, Alerts, Outstanding Issues — is a read of existing analytics, reorganized around a decision-maker's own workflow rather than an engine's own internal structure.",
      "This platform never tells you what to do next. Executive Alerts and Outstanding Issues surface real, already-flagged conditions (a concentration cap breached, a missing stop, a sector allocation above a stated threshold) — they never suggest a specific trade, hedge, or rebalance.",
    ],
  },
  portfolio_interpretation: {
    title: "Portfolio Interpretation",
    explanation: [
      "Interpreting a portfolio means understanding what its own already-computed figures actually mean together, not computing anything new — a single risk score in isolation tells you less than that same score read alongside diversification, capital allocation, and scenario resilience.",
      "This platform deliberately keeps Investing, Trading, and Options figures side by side rather than blending them into one number — a target-weight investing book, a real trading account, and an options income book are not directly comparable, and summing them would imply a fungibility this platform was never asked to model.",
      "Portfolio interpretation is your own judgment applied to real data — this Coach explains what a figure represents and where it comes from, never what it means you should do.",
    ],
  },
  risk: {
    title: "Risk",
    explanation: [
      "The Risk Summary consolidates each engine's own already-computed risk score, capital allocation, buying-power picture, and concentration data into one view — reused directly from the Institutional Risk & Exposure Intelligence Engine (Phase 37), never recomputed.",
      "Every risk score in this platform follows the same convention: higher is safer. A low score means a real, already-identified condition (concentration, low diversification, high utilisation) deserves your own attention — never that a specific action is required.",
      "This platform's own Correlation Overview is deliberately honest about its limits: it reports which symbols are genuinely held across more than one engine, not a fabricated statistical correlation coefficient, since no real price-covariance infrastructure exists anywhere in this codebase.",
    ],
  },
  performance: {
    title: "Performance",
    explanation: [
      "The Performance Summary reuses the Institutional Performance & Attribution Engine's own already-computed Combined view (Phase 38) — realized/unrealized P&L, sector/strategy/asset attribution, capital efficiency, and risk-adjusted return, per engine.",
      "There is deliberately no single fabricated '0-100 performance score' anywhere in this platform — no such scoring formula exists, so raw Sharpe/Sortino ratios and return percentages are shown honestly instead of being approximated into a composite that would overstate precision.",
      "Investing shows unrealized P&L (holdings are continuously held, not round-tripped); Trading and Options show realized P&L from closed positions — two genuinely different measures, never blended.",
    ],
  },
  scenario_analysis: {
    title: "Scenario Analysis",
    explanation: [
      "The Scenario Summary reuses the Institutional Scenario & Stress Testing Engine's own already-computed Combined view (Phase 39) — the same 8 deterministic scenarios (Market ±5%/±10%, Volatility Increase/Decrease, Interest Rate Increase/Decrease) evaluated across Investing, Trading, and Options.",
      "Scenario Resilience in the Executive Health scorecard reuses the Options Stress Test's own already-computed post-shock safety score for a Market -10% scenario — never a new probability model, never a forecast of whether the move will happen.",
      "A scenario is a hypothetical repricing of your real, already-open holdings — it always answers 'what would happen if,' never 'what will happen.'",
    ],
  },
  diversification: {
    title: "Diversification",
    explanation: [
      "The Diversification Summary reuses each engine's own already-computed diversification-adjacent score: Investing's concentration score (`investingRisk.ts`) and Options' own diversification score (`portfolioConcentration.ts`) — no diversification scoring formula exists for Trading, so that dimension is honestly reported unavailable rather than approximated.",
      "A 'Portfolio diversification improved/declined' alert is only ever generated from two real, previously-saved Investing risk snapshots — never fabricated, and silently absent when fewer than two snapshots exist yet.",
      "Diversification is a description of how spread out a portfolio's exposure is, not a judgment about whether more diversification is always better for your own goals — that remains your own call.",
    ],
  },
  capital_allocation: {
    title: "Capital Allocation",
    explanation: [
      "The Capital Allocation Summary reuses the Risk & Exposure Engine's own already-computed `capitalAllocation`/`buyingPowerOverview` fields directly — Investing's market value, Trading's account value, and Options' portfolio value and buying power, shown side by side.",
      "'Buying power utilisation is high' is a real, threshold-based observation over an already-computed utilisation percentage (Trading's own risk-budget usage, Options' own account-value-at-risk) — never a suggestion to deploy more or less capital.",
      "Capital allocation figures are never summed into one blended total across engines — see the Risk Coach's own explanation for why.",
    ],
  },
};

export function explainDecisionSupportTopic(topic: string): DecisionSupportCoachExplanation | null {
  if (!(DECISION_SUPPORT_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as DecisionSupportCoachTopic;
  const { title, explanation } = EXPLANATIONS[t];
  return { topic: t, title, explanation, disclaimer: COACH_DISCLAIMER };
}

export function allDecisionSupportTopics(): DecisionSupportCoachExplanation[] {
  return DECISION_SUPPORT_COACH_TOPICS.map((t) => explainDecisionSupportTopic(t)!);
}

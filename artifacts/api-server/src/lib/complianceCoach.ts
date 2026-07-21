// Phase 42 — Institutional Portfolio Monitoring & Compliance Engine.
//
// Reuses the existing Institutional AI Coach's own disclaimer contract
// (lib/coach.ts's COACH_DISCLAIMER, imported unmodified — never
// re-authored), the same pattern lib/rebalancingCoach.ts (Phase 41),
// lib/decisionSupportCoach.ts (Phase 40), and every earlier engine's own
// coach module already established. Every explanation below is
// deterministic, template-based prose about CONCEPTS only — never a trade
// recommendation, never a buy/sell signal, never a market forecast.
// "Never recommend trades" is enforced structurally: no function here
// takes a symbol, a position, a live quote, or an account figure as
// input — only a topic key.

import { COACH_DISCLAIMER } from "./coach.js";

export const COMPLIANCE_COACH_TOPICS = ["portfolio_monitoring", "compliance_concepts", "risk_limits", "capital_limits", "governance"] as const;
export type ComplianceCoachTopic = (typeof COMPLIANCE_COACH_TOPICS)[number];

export interface ComplianceCoachExplanation {
  topic: ComplianceCoachTopic;
  title: string;
  explanation: string[];
  disclaimer: string;
}

const EXPLANATIONS: Record<ComplianceCoachTopic, { title: string; explanation: string[] }> = {
  portfolio_monitoring: {
    title: "Portfolio Monitoring",
    explanation: [
      "Monitoring means continuously comparing a portfolio's real, already-computed state — allocation, concentration, Greeks, buying-power utilisation — against limits you've defined, so drift from your own intentions is visible early.",
      "This platform's own Monitoring & Compliance Engine never computes a new figure of its own to monitor; every current value it compares is read directly from an already-shipped, already-tested engine (the Risk & Exposure Engine's own sector/strategy/capital allocation and Greeks, the Options Income Engine's own theta income).",
      "Monitoring is observational — it tells you where things stand against your own rules, never what to do about it.",
    ],
  },
  compliance_concepts: {
    title: "Compliance Concepts",
    explanation: [
      "A compliance policy is simply a limit you define — a maximum sector allocation, a maximum single-position weight, a minimum diversification score — paired with the real, current figure it's measured against.",
      "Every evaluation reports three honest things: the current value, the limit you set, and whether the current value is compliant, in breach, or genuinely unavailable (never a fabricated status when the underlying figure can't be resolved).",
      "Compliance status describes a real, present condition — it is never a probability that a breach will happen in the future, and never a suggested trade to fix it.",
    ],
  },
  risk_limits: {
    title: "Risk Limits",
    explanation: [
      "Risk limits in this platform cover Greeks (portfolio delta, gamma, theta exposure) and expiration concentration for the Options book, and buying-power/risk-budget utilisation for both Trading and Options — each reused directly from the same engines that already compute them elsewhere in this platform.",
      "A portfolio delta or gamma limit is expressed as an absolute value — the sign of your net exposure (long or short) is preserved in the underlying figure, but the limit itself asks 'how large is the exposure,' not 'which direction.'",
      "Breaching a risk limit is a real, disclosed fact about your current book — this platform never tells you which position to trim or hedge to fix it.",
    ],
  },
  capital_limits: {
    title: "Capital Limits",
    explanation: [
      "Capital limits set a dollar ceiling on how much value sits in a single engine's own book — Investing market value, Trading account value, or Options portfolio value — reused directly from the Risk & Exposure Engine's own Capital Allocation figures.",
      "Investing, Trading, and Options capital figures are always evaluated and shown side by side, never summed into one blended 'total capital' limit — a target-weight construction book, a real trading account, and an options income book are genuinely different kinds of capital.",
      "A capital limit is distinct from a position or sector limit: it caps how much total capital an entire engine holds, not how concentrated that capital is within the engine.",
    ],
  },
  governance: {
    title: "Governance",
    explanation: [
      "Governance is the discipline of writing your own limits down, in one place, and checking your actual portfolio against them regularly — rather than relying on memory or ad-hoc review.",
      "This platform's own Policy Engine lets you define, edit, enable, and disable policies at any time; every evaluation is computed fresh from your current portfolio, never a cached or stale judgment.",
      "Good governance means limits are genuinely yours to set — this platform suggests starting values drawn from the same named caps used elsewhere in the platform (a 25% single-position cap, a 40% sector cap, and so on), but every value is yours to accept, edit, or ignore.",
    ],
  },
};

export function explainComplianceTopic(topic: string): ComplianceCoachExplanation | null {
  if (!(COMPLIANCE_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as ComplianceCoachTopic;
  const { title, explanation } = EXPLANATIONS[t];
  return { topic: t, title, explanation, disclaimer: COACH_DISCLAIMER };
}

export function allComplianceTopics(): ComplianceCoachExplanation[] {
  return COMPLIANCE_COACH_TOPICS.map((t) => explainComplianceTopic(t)!);
}

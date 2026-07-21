// Phase 36 — Institutional Position Lifecycle Manager.
//
// Reuses the existing Institutional AI Coach's own disclaimer contract
// (lib/coach.ts's COACH_DISCLAIMER, imported unmodified — never
// re-authored). Every explanation below is deterministic, template-based
// prose about MECHANICS and PROCESS only — never a trade recommendation,
// never a directional forecast, never an assignment/expiration
// prediction for any specific real position. "Never recommend trades" is
// enforced structurally: no function here takes a symbol, a strike, or a
// live quote as input — only a topic key.

import { COACH_DISCLAIMER } from "./coach.js";

export const LIFECYCLE_COACH_TOPICS = ["lifecycle_stages", "review_process", "assignment_mechanics", "capital_allocation", "portfolio_concentration"] as const;
export type LifecycleCoachTopic = (typeof LIFECYCLE_COACH_TOPICS)[number];

export interface LifecycleCoachExplanation {
  topic: LifecycleCoachTopic;
  title: string;
  explanation: string[];
  disclaimer: string;
}

const EXPLANATIONS: Record<LifecycleCoachTopic, { title: string; explanation: string[] }> = {
  lifecycle_stages: {
    title: "Position Lifecycle Stages",
    explanation: [
      "Every position moves through a small set of deterministic stages you set yourself — Draft, Planned, Open, Monitoring, Near Expiration, Assignment Risk, Closed, and Archived. Nothing in this platform advances a stage automatically.",
      "Draft and Planned are pre-entry stages — a position you're still researching or have decided on but haven't opened yet. Open marks a real, live position. Monitoring and Near Expiration are ongoing-management stages you assign as a position approaches decision points. Assignment Risk flags a short strike that has moved in-the-money and may be assigned. Closed and Archived record the position's own final disposition.",
      "Moving between stages is a deliberate record-keeping action, the same as writing a note — it never triggers an order, an adjustment, or a notification.",
    ],
  },
  review_process: {
    title: "The Review Process",
    explanation: [
      "A review is simply a dated note you attach to a position, recording what you checked and what you concluded. You can assign a position a review cadence — Daily, Weekly, Monthly, Expiration, or Manual — as a personal organizing preference.",
      "No cadence triggers a reminder or a notification anywhere in this platform. The cadence is a label you can filter by, nothing more — the discipline of actually reviewing on that schedule remains entirely yours.",
      "A useful review typically checks: has the thesis that led you to open the position changed, has an assigned strike moved meaningfully, is the position approaching its own profit target or stop-loss, and does the position's risk still fit your current portfolio.",
    ],
  },
  assignment_mechanics: {
    title: "Assignment Mechanics",
    explanation: [
      "Assignment is what happens to the SELLER of an option when the buyer exercises their right: a short call's seller must deliver 100 shares at the strike; a short put's seller must buy 100 shares at the strike.",
      "American-style equity options can be assigned at any time before expiration, not only at expiration — assignment risk rises sharply once a short strike moves in-the-money, and further still near a stock's ex-dividend date for short calls.",
      "The Assignment Tracker in this workspace lets you record your own assessment of a position's assignment risk over time — it never predicts whether a specific position will actually be assigned, since that decision belongs entirely to the option's buyer.",
    ],
  },
  capital_allocation: {
    title: "Capital Allocation",
    explanation: [
      "Capital utilisation measures how much of your account's total risk budget is currently committed across all open positions — the same figure the Portfolio Risk Dashboard already computes from your real, open positions.",
      "Buying power allocation is the capital your broker actually reserves against your open positions' own collateral requirements (cash-secured, margin, or defined-risk, depending on each strategy).",
      "Income allocation shows how your own realized and projected premium is distributed across symbols and strategies — a read of what has already happened, never a projection of what capital 'should' be allocated where.",
    ],
  },
  portfolio_concentration: {
    title: "Portfolio Concentration",
    explanation: [
      "Concentration measures how much of your open risk sits in a single symbol, sector, or strategy — the same allocation figures the Portfolio Risk Dashboard and Concentration Risk pages already compute from your real, open positions.",
      "A well-diversified options income portfolio typically spreads risk across multiple uncorrelated underlyings and more than one strategy, so a single adverse move or a single strategy's own weak regime doesn't dominate portfolio-wide results.",
      "This workspace surfaces your own current concentration figures for review — it never recommends a specific rebalancing action or a specific new position to open.",
    ],
  },
};

export function explainLifecycleTopic(topic: string): LifecycleCoachExplanation | null {
  if (!(LIFECYCLE_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as LifecycleCoachTopic;
  const { title, explanation } = EXPLANATIONS[t];
  return { topic: t, title, explanation, disclaimer: COACH_DISCLAIMER };
}

export function allLifecycleTopics(): LifecycleCoachExplanation[] {
  return LIFECYCLE_COACH_TOPICS.map((t) => explainLifecycleTopic(t)!);
}

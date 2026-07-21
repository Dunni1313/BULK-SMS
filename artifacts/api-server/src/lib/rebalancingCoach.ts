// Phase 41 — Institutional Portfolio Rebalancing & Allocation Planning
// Engine.
//
// Reuses the existing Institutional AI Coach's own disclaimer contract
// (lib/coach.ts's COACH_DISCLAIMER, imported unmodified — never
// re-authored), the same pattern lib/decisionSupportCoach.ts (Phase 40),
// lib/scenarioCoach.ts (Phase 39), lib/performanceAttributionCoach.ts
// (Phase 38), and lib/riskExposureCoach.ts (Phase 37) already established.
// Every explanation below is deterministic, template-based prose about
// CONCEPTS only — never a trade recommendation, never a buy/sell signal,
// never a market forecast. "Never recommend trades" is enforced
// structurally: no function here takes a symbol, a position, a live
// quote, or an account figure as input — only a topic key.

import { COACH_DISCLAIMER } from "./coach.js";

export const REBALANCING_COACH_TOPICS = ["portfolio_allocation", "rebalancing_concepts", "diversification", "capital_efficiency", "portfolio_construction"] as const;
export type RebalancingCoachTopic = (typeof REBALANCING_COACH_TOPICS)[number];

export interface RebalancingCoachExplanation {
  topic: RebalancingCoachTopic;
  title: string;
  explanation: string[];
  disclaimer: string;
}

const EXPLANATIONS: Record<RebalancingCoachTopic, { title: string; explanation: string[] }> = {
  portfolio_allocation: {
    title: "Portfolio Allocation",
    explanation: [
      "Allocation is simply how a portfolio's capital is actually split — by holding, by sector, by strategy, or across engines. This platform's own Rebalancing Engine never computes a new allocation figure of its own; every number is read directly from an already-shipped, already-tested engine (Portfolio Construction's own current-vs-target weights, the Risk & Exposure Engine's own cross-engine capital/sector/strategy allocation).",
      "Current allocation is a market-value-weighted read of what you actually hold today. Target allocation is a stored, user-set intention for what each holding should be. The two are compared honestly — never silently reconciled or overridden.",
      "Allocation is a description of where capital sits right now, not a judgment about whether that's the right place for it — that remains your own call.",
    ],
  },
  rebalancing_concepts: {
    title: "Rebalancing Concepts",
    explanation: [
      "Rebalancing means bringing a portfolio's actual weights back toward its own stated target weights after market moves have caused drift — it is a planning and comparison exercise, not an automated action. This platform never places, schedules, or submits an order of any kind.",
      "Drift is the difference between a holding's current (market-value-weighted) percentage of the portfolio and its own stored target percentage. A common real-world convention (used here as a disclosed, named threshold) treats drift beyond roughly 5 percentage points as worth reviewing.",
      "'Capital movement required' is a dollar figure — how much would need to move in or out of a holding to close its own drift exactly — never a suggested number of shares to buy or sell, and never an execution plan.",
    ],
  },
  diversification: {
    title: "Diversification",
    explanation: [
      "Diversification describes how spread out a portfolio's exposure is — across symbols, sectors, and strategies — reused directly from the Risk & Exposure Engine's and Portfolio Concentration's own already-computed figures.",
      "A concentrated position or sector isn't automatically wrong — it may be a deliberate, high-conviction choice — but this platform surfaces the real percentage honestly so you can decide whether that concentration is intentional.",
      "This platform's own named concentration caps (a single-symbol cap and a sector cap, both disclosed elsewhere in this codebase) are the same thresholds every allocation-aware module already reuses — never redefined per module.",
    ],
  },
  capital_efficiency: {
    title: "Capital Efficiency",
    explanation: [
      "Capital efficiency here means simply seeing where capital currently sits — cash, buying power, and allocated positions — across Investing, Trading, and Options, reused directly from the Risk & Exposure Engine's own already-computed Capital Allocation and Buying Power Overview.",
      "Investing, Trading, and Options capital figures are always shown side by side, never summed into one blended 'total capital' number — a target-weight construction book, a real trading account, and an options income book are genuinely different kinds of capital, and combining them would misrepresent all three.",
      "'Capital to deploy' and 'capital to raise' in the Rebalancing Planner are the sum of a portfolio's own positive and negative capital-movement figures against a proposed set of target weights — arithmetic over already-computed drift, never a new capital-allocation model.",
    ],
  },
  portfolio_construction: {
    title: "Portfolio Construction",
    explanation: [
      "Portfolio construction is the discipline of deciding a portfolio's shape deliberately — target weights per holding, sector limits, capital budgets — rather than accumulating positions one attractive-looking idea at a time with no view of the whole.",
      "This platform's own Portfolio Construction module (target weights per Investing holding) is the one place a real, stored target allocation exists in this codebase — Trading positions and Options trades carry no target-weight field, so the Rebalancing Planner's Current-vs-Target comparison is honestly Investing-only, never approximated for the other two engines.",
      "A well-constructed portfolio is one whose real allocation matches its own stated intentions — this platform helps you see the gap, never tells you how to close it.",
    ],
  },
};

export function explainRebalancingTopic(topic: string): RebalancingCoachExplanation | null {
  if (!(REBALANCING_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as RebalancingCoachTopic;
  const { title, explanation } = EXPLANATIONS[t];
  return { topic: t, title, explanation, disclaimer: COACH_DISCLAIMER };
}

export function allRebalancingTopics(): RebalancingCoachExplanation[] {
  return REBALANCING_COACH_TOPICS.map((t) => explainRebalancingTopic(t)!);
}

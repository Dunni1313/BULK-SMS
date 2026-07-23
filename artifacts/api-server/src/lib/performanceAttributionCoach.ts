// Phase 38 — Institutional Performance & Attribution Engine.
//
// Reuses the existing Institutional AI Coach's own disclaimer contract
// (lib/coach.ts's COACH_DISCLAIMER, imported unmodified — never
// re-authored), the same pattern lib/riskExposureCoach.ts already
// established (Phase 37). Every explanation below is deterministic,
// template-based prose about CONCEPTS only — never a trade recommendation,
// never a forward-looking performance prediction, never a portfolio
// optimisation suggestion. "Never recommend trades" is enforced
// structurally: no function here takes a symbol, a position, a live quote,
// or an account figure as input — only a topic key.

import { COACH_DISCLAIMER } from "./coach.js";

export const PERFORMANCE_ATTRIBUTION_COACH_TOPICS = ["performance_metrics", "attribution", "capital_efficiency", "risk_adjusted_returns", "portfolio_interpretation"] as const;
export type PerformanceAttributionCoachTopic = (typeof PERFORMANCE_ATTRIBUTION_COACH_TOPICS)[number];

export interface PerformanceAttributionCoachExplanation {
  topic: PerformanceAttributionCoachTopic;
  title: string;
  explanation: string[];
  disclaimer: string;
}

const EXPLANATIONS: Record<PerformanceAttributionCoachTopic, { title: string; explanation: string[] }> = {
  performance_metrics: {
    title: "Performance Metrics, Across Every Engine",
    explanation: [
      "This dashboard reports what already happened, using only real, already-persisted data — Investing's unrealized P&L on holdings you still own, Trading's realized P&L on positions you've already closed, and Options' realized P&L on trades you've already closed.",
      "Investing and Trading/Options are genuinely different measures, and this dashboard never blends them: Investing holdings are continuously held, so their P&L is unrealized (it moves with the market price); Trading and Options positions are round-tripped, so their P&L is realized (locked in once the position closes).",
      "Win rate, average win, average loss, largest winner, and largest loser are all computed the same simple, transparent way for Trading and Options — a decided trade either made or lost money, and the figures are a straight tally, never a smoothed or adjusted number.",
    ],
  },
  attribution: {
    title: "Attribution — Where Your Performance Actually Came From",
    explanation: [
      "Attribution breaks a total P&L figure down into the pieces that produced it — by sector (Investing), by strategy (Trading and Options), and by asset/symbol (all three engines) — so you can see whether your performance is broad-based or concentrated in a small number of positions.",
      "Trading's strategy attribution uses a best-effort link to your own Trading Journal entries (matched by the position they reference) — a position with no matching journal entry, or one whose entry has no setup type recorded, is honestly bucketed as 'Unclassified' rather than guessed.",
      "This dashboard never attributes performance to a factor it can't actually observe in your own real data — every attribution bucket here is a straight sum of real, already-recorded P&L, grouped by a real, already-recorded field.",
    ],
  },
  capital_efficiency: {
    title: "Capital Efficiency",
    explanation: [
      "Capital efficiency asks a different question than raw P&L: not 'how much did you make,' but 'how much did you make relative to how much capital you actually had committed.'",
      "Each engine uses the most defensible real denominator available to it: Investing uses total cost basis (what you actually paid for your holdings); Trading uses the entry cost basis of closed positions; Options uses the recorded max-loss capital committed on closed positions.",
      "This dashboard never recommends redeploying capital to a 'more efficient' area — it reports how efficiently your own already-committed capital has performed, for your own review.",
    ],
  },
  risk_adjusted_returns: {
    title: "Risk-Adjusted Returns (Sharpe & Sortino)",
    explanation: [
      "A raw return figure doesn't tell you how much risk was taken to earn it — two traders can have the same average return with very different amounts of volatility behind it. Sharpe and Sortino ratios adjust for that.",
      "These are TRADE-RETURN-based measures here, not time-series measures: they're computed from the spread of individual real closed trades' own percentage returns, using the exact same mean/standard-deviation formula this platform's own backtesting engines already use — never a fabricated daily-return series, since no periodic real portfolio-value history exists for any engine.",
      "Sortino is the same idea as Sharpe but only penalizes downside volatility (losing trades), not upside volatility (winning trades) — a trader with big wins and small, consistent losses can have a much better Sortino than Sharpe ratio.",
      "Investing holdings are continuously held, not discrete round-trip trades, so there's no realized-trade-return series to compute either ratio from — this dashboard honestly reports that as unavailable rather than approximating it from unrealized price moves.",
    ],
  },
  portfolio_interpretation: {
    title: "Interpreting the Combined View",
    explanation: [
      "The Combined view lays Investing, Trading, and Options side by side — never blended into one number, since an unrealized Investing figure and a realized Trading/Options figure aren't the same kind of thing and summing them would be misleading.",
      "Look for concentration first: if Sector Attribution, Strategy Attribution, or Asset Attribution shows most of your performance coming from one bucket, that's worth understanding — good or bad — before drawing a broader conclusion about your overall process.",
      "The Historical Performance Timeline combines real, monthly realized P&L from Trading and Options with real, user-saved market-value snapshots from Investing — an honestly different kind of data point for Investing (a stock/value measure) than for Trading/Options (a monthly flow), never fabricated to look like the same thing.",
      "This dashboard interprets what already happened — it never forecasts what will happen next, never suggests a rebalancing or hedging action, and never scores your process with a fabricated 'skill' rating.",
    ],
  },
};

export function explainPerformanceAttributionTopic(topic: string): PerformanceAttributionCoachExplanation | null {
  if (!(PERFORMANCE_ATTRIBUTION_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as PerformanceAttributionCoachTopic;
  const { title, explanation } = EXPLANATIONS[t];
  return { topic: t, title, explanation, disclaimer: COACH_DISCLAIMER };
}

export function allPerformanceAttributionTopics(): PerformanceAttributionCoachExplanation[] {
  return PERFORMANCE_ATTRIBUTION_COACH_TOPICS.map((t) => explainPerformanceAttributionTopic(t)!);
}

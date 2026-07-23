// Phase 39 — Institutional Scenario & Stress Testing Engine.
//
// Reuses the existing Institutional AI Coach's own disclaimer contract
// (lib/coach.ts's COACH_DISCLAIMER, imported unmodified — never
// re-authored), the same pattern lib/riskExposureCoach.ts (Phase 37) and
// lib/performanceAttributionCoach.ts (Phase 38) already established.
// Every explanation below is deterministic, template-based prose about
// CONCEPTS only — never a trade recommendation, never a hedging
// recommendation, never a market forecast, never a probability estimate
// of a scenario actually happening. "Never recommend trades" is enforced
// structurally: no function here takes a symbol, a position, a live
// quote, or an account figure as input — only a topic key.

import { COACH_DISCLAIMER } from "./coach.js";

export const SCENARIO_COACH_TOPICS = ["scenario_analysis", "stress_testing", "portfolio_resilience", "greeks_impact", "capital_impact"] as const;
export type ScenarioCoachTopic = (typeof SCENARIO_COACH_TOPICS)[number];

export interface ScenarioCoachExplanation {
  topic: ScenarioCoachTopic;
  title: string;
  explanation: string[];
  disclaimer: string;
}

const EXPLANATIONS: Record<ScenarioCoachTopic, { title: string; explanation: string[] }> = {
  scenario_analysis: {
    title: "Scenario Analysis",
    explanation: [
      "Scenario analysis asks a single, precise question: 'if this hypothetical market move happened right now, what would happen to my portfolio?' — it is a repricing exercise over your own real, already-open holdings and positions, never a prediction that the move will actually occur.",
      "This dashboard reprices your real Investing holdings, Trading positions, and Options trades under the exact same named scenario at once, so you can see whether a single hypothetical move would affect all three engines the same way or very differently.",
      "Every scenario here is deterministic — the same shock always produces the same repriced result for the same portfolio. This platform never runs a Monte Carlo simulation or generates a random scenario; every scenario is one you (or a named preset) explicitly chose.",
    ],
  },
  stress_testing: {
    title: "Stress Testing",
    explanation: [
      "Stress testing is scenario analysis pushed to a deliberately severe hypothetical — a large market move, a large volatility spike, or a large rate move — specifically to see how much damage a genuinely bad day could do, not how likely that day is.",
      "This dashboard's Options view reuses the platform's own already-built What-If Stress Test engine directly — the same repricing math (Black-Scholes) your Portfolio Stress Test & Scenario Simulator page already uses, applied here alongside Investing and Trading.",
      "A stress test never tells you the odds of the scenario happening — it only tells you what would happen to your real portfolio if it did, for your own review before deciding how much risk feels acceptable to carry.",
    ],
  },
  portfolio_resilience: {
    title: "Portfolio Resilience",
    explanation: [
      "Resilience is how much of your portfolio's value survives a genuinely bad scenario intact — a resilient portfolio loses less, in dollar and percentage terms, than a fragile one under the same hypothetical shock.",
      "Comparing the Portfolio Impact Summary across several named scenarios (not just one) is how resilience actually becomes visible — a portfolio that looks fine under a small move but falls apart under a large one is a genuinely different risk profile than one that degrades gradually and proportionally.",
      "This dashboard never scores your portfolio's 'resilience' with a single fabricated number — it shows you the real, repriced impact under each scenario side by side, and you draw your own conclusion.",
    ],
  },
  greeks_impact: {
    title: "Greeks Impact Under Stress",
    explanation: [
      "An options portfolio's own Greeks (delta, gamma, theta, vega) describe how its value moves as underlying price, time, and volatility change — but those Greeks are themselves computed at today's market conditions, and can shift meaningfully once a large shock actually happens.",
      "The Options Greeks Impact figures on this dashboard show exactly that: how your portfolio's own net delta/gamma/theta/vega would look immediately AFTER a scenario's shock, not just before it — reused directly, unmodified, from the platform's own existing stress-test repricing.",
      "A portfolio that looks delta-neutral today can become meaningfully directional after a large price move, purely because gamma changes each position's own delta as the underlying moves — this is exactly the kind of shift Greeks Impact is built to surface honestly.",
    ],
  },
  capital_impact: {
    title: "Capital Impact",
    explanation: [
      "Capital impact asks how a hypothetical scenario would change the capital picture of your portfolio — its total value, the capital already committed/at risk, and (for Options) buying power still available to deploy.",
      "This dashboard's structural, maxLoss-based risk figures for Options are intentionally shown as unchanged across every price/volatility scenario — a defined-risk options strategy's own reserved margin does not move just because the underlying's mark-to-market value does; that's a real, correct property of defined-risk strategies, not an unimplemented feature.",
      "This dashboard never recommends redeploying capital based on a scenario's outcome — it reports the real, repriced capital picture for your own review.",
    ],
  },
};

export function explainScenarioTopic(topic: string): ScenarioCoachExplanation | null {
  if (!(SCENARIO_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as ScenarioCoachTopic;
  const { title, explanation } = EXPLANATIONS[t];
  return { topic: t, title, explanation, disclaimer: COACH_DISCLAIMER };
}

export function allScenarioTopics(): ScenarioCoachExplanation[] {
  return SCENARIO_COACH_TOPICS.map((t) => explainScenarioTopic(t)!);
}

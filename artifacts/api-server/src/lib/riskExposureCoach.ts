// Phase 37 — Institutional Risk & Exposure Intelligence Engine.
//
// Reuses the existing Institutional AI Coach's own disclaimer contract
// (lib/coach.ts's COACH_DISCLAIMER, imported unmodified — never
// re-authored). Every explanation below is deterministic, template-based
// prose about CONCEPTS only — never a trade recommendation, never a
// hedging/rebalancing recommendation, never a directional forecast, never
// AI-based risk scoring. "Never recommend trades or positions" is
// enforced structurally: no function here takes a symbol, a strike, a
// live quote, or an account figure as input — only a topic key.

import { COACH_DISCLAIMER } from "./coach.js";

export const RISK_EXPOSURE_COACH_TOPICS = ["risk", "exposure", "diversification", "concentration", "position_sizing", "capital_allocation", "greeks"] as const;
export type RiskExposureCoachTopic = (typeof RISK_EXPOSURE_COACH_TOPICS)[number];

export interface RiskExposureCoachExplanation {
  topic: RiskExposureCoachTopic;
  title: string;
  explanation: string[];
  disclaimer: string;
}

const EXPLANATIONS: Record<RiskExposureCoachTopic, { title: string; explanation: string[] }> = {
  risk: {
    title: "Risk, Across Every Engine",
    explanation: [
      "Risk means different, concrete things depending on the engine: for Investing it's how concentrated your holdings are by symbol/sector and how sensitive the portfolio is to the market (beta); for Trading it's your position sizing discipline, stop/target coverage, and aggregate dollar risk versus a named cap; for Options it's capital-at-risk, buying power committed, and net portfolio Greeks.",
      "This dashboard never blends those three into a single fabricated 'risk score' across engines — each engine's own risk read is shown honestly, side by side, using the exact same deterministic scoring each engine's own dedicated page already computes.",
      "Reviewing risk regularly, across all three engines together, is how you notice when one part of your overall financial picture has quietly become the dominant source of risk to the whole.",
    ],
  },
  exposure: {
    title: "Exposure",
    explanation: [
      "Exposure is how much of your capital, and how much of your risk, is actually committed to the market right now — not the same as account size, since undeployed cash and buying power aren't 'exposed' to anything.",
      "This dashboard shows exposure from each engine's own real data: Investing's total market value across every held symbol, Trading's account value and open-position dollar risk, and Options' portfolio value, buying power, and net Greeks.",
      "A Cross-Engine Exposure view exists specifically so you can see all three at once — the same real figures each engine's own page already shows, simply presented together.",
    ],
  },
  diversification: {
    title: "Diversification",
    explanation: [
      "Diversification is the inverse of concentration — spreading capital and risk across enough distinct symbols, sectors, and strategies that no single adverse move can materially damage your overall position.",
      "Sector Concentration on this dashboard combines Investing's own sector-exposure figures (from the Investing Risk Engine) with Options' own sector-allocation figures (from the Portfolio Risk Dashboard) — the same real, already-computed numbers each engine already reports.",
      "This dashboard never recommends a specific rebalancing action to improve diversification — it surfaces the current picture for your own review.",
    ],
  },
  concentration: {
    title: "Concentration",
    explanation: [
      "Concentration measures how much of your risk sits in one place — a single symbol, sector, or strategy — across each engine's own real open holdings/positions.",
      "The Correlation Overview on this dashboard is a genuinely honest signal, not a fabricated statistic: it reports which real symbols you actually hold in more than one engine at once (e.g., the same stock held as an Investing position and also underlying an open options trade) — a real cross-engine overlap, never a computed correlation coefficient this platform has no historical price data to support.",
      "A Concentration Timeline shows how your own real, saved Investing risk snapshots and Options exposure figures have moved over time — never a forecast of where concentration is headed.",
    ],
  },
  position_sizing: {
    title: "Position Sizing",
    explanation: [
      "Position sizing bounds how much any single position can risk relative to your total capital, so no one position — however attractive — can do outsized damage on its own.",
      "The Trading Risk view reused on this dashboard scores your largest open position's own dollar risk against a named cap, and separately checks what fraction of your open positions actually have both a stop and a target defined.",
      "This dashboard never tells you what size a position 'should' be — it reports your own already-entered positions' real sizing discipline for review.",
    ],
  },
  capital_allocation: {
    title: "Capital Allocation",
    explanation: [
      "Capital allocation is how much of your total capital, across Investing, Trading, and Options together, is actually deployed versus held back — a decision made independently of any single position's own attractiveness.",
      "The Capital Allocation view on this dashboard shows each engine's own real committed capital figure side by side: Investing's total market value, Trading's account value, and Options' portfolio value — reused directly, never recomputed.",
      "Buying Power Overview does the same for the capital genuinely still available to deploy in Trading and Options.",
    ],
  },
  greeks: {
    title: "Portfolio Greeks",
    explanation: [
      "Portfolio Greeks are the sum of every open options position's own Greeks — net delta, net theta, net gamma, net vega for the whole options account, not any single trade in isolation.",
      "The Greeks Summary on this dashboard is reused directly, unmodified, from the existing Portfolio Risk Dashboard's own net-Greeks computation — never a second, competing calculation.",
      "A portfolio can look balanced position-by-position and still carry a large, unintended net directional or volatility bet once every position is summed — Portfolio Greeks is the number that actually reveals it.",
    ],
  },
};

export function explainRiskExposureTopic(topic: string): RiskExposureCoachExplanation | null {
  if (!(RISK_EXPOSURE_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as RiskExposureCoachTopic;
  const { title, explanation } = EXPLANATIONS[t];
  return { topic: t, title, explanation, disclaimer: COACH_DISCLAIMER };
}

export function allRiskExposureTopics(): RiskExposureCoachExplanation[] {
  return RISK_EXPOSURE_COACH_TOPICS.map((t) => explainRiskExposureTopic(t)!);
}

// Phase 43 — Institutional Watchlists & Opportunity Dashboard.
//
// Reuses the existing Institutional AI Coach's own disclaimer contract
// (lib/coach.ts's COACH_DISCLAIMER, imported unmodified — never
// re-authored), the same pattern lib/complianceCoach.ts (Phase 42),
// lib/rebalancingCoach.ts (Phase 41), and every earlier engine's own coach
// module already established. Every explanation below is deterministic,
// template-based prose about CONCEPTS only — never a trade recommendation,
// never a buy/sell signal, never a market forecast. "Never recommend
// trades" is enforced structurally: no function here takes a symbol, a
// position, a live quote, or an account figure as input — only a topic key.

import { COACH_DISCLAIMER } from "./coach.js";

export const WATCHLISTS_COACH_TOPICS = ["watchlists", "research_workflow", "institutional_monitoring", "portfolio_organisation", "asset_tracking"] as const;
export type WatchlistsCoachTopic = (typeof WATCHLISTS_COACH_TOPICS)[number];

export interface WatchlistsCoachExplanation {
  topic: WatchlistsCoachTopic;
  title: string;
  explanation: string[];
  disclaimer: string;
}

const EXPLANATIONS: Record<WatchlistsCoachTopic, { title: string; explanation: string[] }> = {
  watchlists: {
    title: "Watchlists",
    explanation: [
      "A watchlist is simply a named collection of symbols you've chosen to track — nothing more. This platform never auto-creates a watchlist or auto-adds a symbol to one; every list and every entry originates from an explicit action you took.",
      "You can maintain as many watchlists as you like, label each one 'personal' or 'institutional' as a way of organising your own workflow, and reorder both the lists themselves and the symbols within them manually.",
      "A watchlist is a monitoring tool, not a decision engine — it shows you what you've chosen to track, not what to do about it.",
    ],
  },
  research_workflow: {
    title: "Research Workflow",
    explanation: [
      "A disciplined research workflow starts with tracking candidates before you act on them — adding a symbol to a watchlist is often the very first step, well before any position exists.",
      "This platform's own Research Terminal, Opportunity Discovery, and Investment Committee Workbench are all designed to be used alongside a watchlist: you track a symbol here, then investigate it in depth elsewhere.",
      "Tags, categories, and notes exist so you can record your own reasoning for tracking a symbol — a durable research trail, never a suggested action.",
    ],
  },
  institutional_monitoring: {
    title: "Institutional Monitoring",
    explanation: [
      "Institutional monitoring means watching a defined universe of assets against real, already-computed portfolio data — allocation, performance, compliance status, scenario impact — continuously, not just at the moment you place a trade.",
      "This platform's own Opportunity Overview reuses the exact same Risk & Exposure, Performance, Scenario, and Compliance engines that power the rest of the platform — nothing here computes a second, competing figure.",
      "Monitoring is honest about what it doesn't know: a watched symbol you don't currently hold anywhere shows plainly as 'not held' rather than a fabricated position.",
    ],
  },
  portfolio_organisation: {
    title: "Portfolio Organisation",
    explanation: [
      "Organising your research separately from your actual holdings — via watchlists, categories, and tags — keeps 'what I'm tracking' distinct from 'what I own,' which is a core institutional discipline.",
      "Watchlist Health rolls up how many of a list's own symbols are actually held, in breach of a compliance policy, or contributing meaningfully to your book — a structural view of the list itself, not of any one symbol.",
      "This platform never blends Investing, Trading, and Options figures into a single number — a watchlist's own health always shows each engine's contribution honestly, side by side.",
    ],
  },
  asset_tracking: {
    title: "Asset Tracking",
    explanation: [
      "Tracking an asset means recording your own categorisation (a category, a set of tags, free-form notes) alongside real, already-computed figures about that asset wherever it happens to be held.",
      "This platform's own per-symbol analytics show allocation, performance, Greeks (where applicable), scenario impact, and compliance status pulled directly from wherever the symbol actually appears in your book — never invented for a symbol you don't hold.",
      "Tracking is descriptive, not predictive: every figure describes a real, current state, never a forecast of where that state is headed.",
    ],
  },
};

export function explainWatchlistsTopic(topic: string): WatchlistsCoachExplanation | null {
  if (!(WATCHLISTS_COACH_TOPICS as readonly string[]).includes(topic)) return null;
  const t = topic as WatchlistsCoachTopic;
  const { title, explanation } = EXPLANATIONS[t];
  return { topic: t, title, explanation, disclaimer: COACH_DISCLAIMER };
}

export function allWatchlistsTopics(): WatchlistsCoachExplanation[] {
  return WATCHLISTS_COACH_TOPICS.map((t) => explainWatchlistsTopic(t)!);
}

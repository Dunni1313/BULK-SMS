// v1.5.0, Sprint 20 — Institutional Market Intelligence Engine.
//
// NOT another Research module. NOT another dashboard. Research is
// user-created; Market Intelligence is external context. This file is the
// per-user ENTITY-LINKING layer over the backend's stateless
// MarketIntelligenceItem feed (lib/marketIntelligence.ts, api-server) —
// every function here is pure composition over already-computed data,
// zero new scoring formula, zero duplicate calculation.
//
// REUSE MAP:
//   Watchlist Integration -> the caller supplies the union of watched
//     symbols (Value Watchlist + the Institutional Watchlists Engine,
//     both already-shipped systems) — this module only intersects that
//     set against each item's own affectedAssets, never a second fetch.
//   Knowledge Graph integration -> lib/knowledgeGraph.ts's own
//     relatedEntities()/relatedEntitiesWithinTwoHops() (Sprint 17), called
//     directly against the derived `company:{SYMBOL}` node every affected
//     asset already produces — no new node type, no new persisted entity.
//   Playbook integration -> lib/playbooks.ts's own getPlaybook() (Sprint
//     18) — a static category -> playbook id map is this file's only new
//     content, and it names real, already-shipped playbook ids only.
//   AI Market Coach -> the exact same deterministic-narrative pattern
//     already established by buildDecisionCoachNarrative()/
//     buildPortfolioCoachNarrative()/buildWorkflowCoachNarrative()/
//     buildPlaybookCoachNarrative()/buildDecisionReviewCoachNarrative()
//     (Sprints 13/15/16/18/19) — zero LLM calls, never invents a fact not
//     already present on the item, never predicts price direction, never
//     issues a trading signal.

import type { MarketIntelligenceItem, MarketIntelligenceCategory } from "@workspace/api-client-react";
import { getPlaybook } from "./playbooks";
import { relatedResearchStrategiesLessons, type KnowledgeGraph } from "./knowledgeGraph";

export interface MarketIntelligenceRelatedEntity {
  label: string;
  href: string | null;
}

export interface MarketIntelligenceRelatedPlaybook {
  id: string;
  name: string;
  href: string;
}

export interface MarketIntelligenceView extends MarketIntelligenceItem {
  /** True when at least one affected asset is on a watched list, or the
   * item is market-wide (macro/central bank) — disclosed exception, since
   * a market-wide macro read genuinely affects every portfolio regardless
   * of what's on a watchlist. */
  isWatched: boolean;
  /** high-impact AND (watched or actually held) — never a fabricated
   * importance score, purely a boolean AND of two already-known facts. */
  isPriority: boolean;
  relatedResearch: MarketIntelligenceRelatedEntity[];
  relatedStrategies: MarketIntelligenceRelatedEntity[];
  relatedLessons: MarketIntelligenceRelatedEntity[];
  /** Subset of affectedAssets the user actually holds, per the caller-
   * supplied held-symbols set. */
  relatedHoldings: string[];
  relatedPlaybook: MarketIntelligenceRelatedPlaybook | null;
}

// One suggested playbook per category — every id is real and already
// shipped (Sprint 18); never a fabricated playbook. Categories not listed
// here (e.g. the reserved-but-empty ones) simply suggest none.
const CATEGORY_PLAYBOOK: Partial<Record<MarketIntelligenceCategory, string>> = {
  macro: "risk-review",
  economic_events: "risk-review",
  central_banks: "risk-review",
  volatility: "risk-review",
  market_breadth: "risk-review",
  options_activity: "risk-review",
  earnings: "investment-research",
  corporate_actions: "portfolio-review",
  indices: "portfolio-review",
};

const MARKET_WIDE_CATEGORIES = new Set<MarketIntelligenceCategory>(["macro", "central_banks"]);

export function enrichMarketIntelligenceItem(
  item: MarketIntelligenceItem,
  graph: KnowledgeGraph,
  watchedSymbols: ReadonlySet<string>,
  heldSymbols: ReadonlySet<string>,
): MarketIntelligenceView {
  const affectedUpper = item.affectedAssets.map((s) => s.toUpperCase());
  const isWatched = affectedUpper.some((s) => watchedSymbols.has(s)) || MARKET_WIDE_CATEGORIES.has(item.category);
  const relatedHoldings = affectedUpper.filter((s) => heldSymbols.has(s));

  const relatedResearch: MarketIntelligenceRelatedEntity[] = [];
  const relatedStrategies: MarketIntelligenceRelatedEntity[] = [];
  const relatedLessons: MarketIntelligenceRelatedEntity[] = [];
  for (const sym of affectedUpper) {
    const found = relatedResearchStrategiesLessons(graph, sym);
    for (const r of found.research) {
      if (!relatedResearch.some((e) => e.label === r.node.label)) relatedResearch.push({ label: r.node.label, href: r.node.href });
    }
    for (const r of found.strategies) {
      if (!relatedStrategies.some((e) => e.label === r.node.label)) relatedStrategies.push({ label: r.node.label, href: r.node.href });
    }
    for (const r of found.lessons) {
      if (!relatedLessons.some((e) => e.label === r.node.label)) relatedLessons.push({ label: r.node.label, href: r.node.href });
    }
  }

  const playbookId = CATEGORY_PLAYBOOK[item.category];
  const playbook = playbookId ? getPlaybook(playbookId) : null;
  const relatedPlaybook: MarketIntelligenceRelatedPlaybook | null = playbook ? { id: playbook.id, name: playbook.name, href: `/playbooks?playbookId=${playbook.id}` } : null;

  const isPriority = item.impact === "high" && (isWatched || relatedHoldings.length > 0);

  return { ...item, isWatched, isPriority, relatedResearch, relatedStrategies, relatedLessons, relatedHoldings, relatedPlaybook };
}

export function enrichMarketIntelligenceFeed(
  items: MarketIntelligenceItem[],
  graph: KnowledgeGraph,
  watchedSymbols: ReadonlySet<string>,
  heldSymbols: ReadonlySet<string>,
): MarketIntelligenceView[] {
  return items.map((item) => enrichMarketIntelligenceItem(item, graph, watchedSymbols, heldSymbols));
}

// ─── Command Centre / page groupings — pure filters, no new scoring ─────

export function watchlistRelevantItems(items: MarketIntelligenceView[]): MarketIntelligenceView[] {
  return items.filter((i) => i.isWatched);
}

export function priorityItems(items: MarketIntelligenceView[]): MarketIntelligenceView[] {
  return items.filter((i) => i.isPriority);
}

export function todaysKeyEvents(items: MarketIntelligenceView[], todayIso: string): MarketIntelligenceView[] {
  return items.filter((i) => i.timestamp.slice(0, 10) === todayIso.slice(0, 10) && i.impact !== "low");
}

export function upcomingEconomicReleases(items: MarketIntelligenceView[]): MarketIntelligenceView[] {
  return items.filter((i) => i.category === "economic_events" || i.category === "central_banks");
}

export function portfolioRelevantItems(items: MarketIntelligenceView[]): MarketIntelligenceView[] {
  // Deliberately reuses the same watchlist-relevance set as "portfolio
  // news" — see docs/v1.5.0-Sprint-20-Market-Intelligence-Engine.md for
  // why this is one honest, unified relevance concept rather than a
  // second, overlapping computation (no duplicate risk calculations).
  return items.filter((i) => i.isWatched || i.relatedHoldings.length > 0);
}

// ─── AI Market Coach — deterministic, zero LLM calls, never predicts
// price direction or issues a trading signal. Mirrors
// buildDecisionReviewCoachNarrative()'s exact established shape
// (Sprint 19). ────────────────────────────────────────────────────────

export interface MarketIntelligenceCoachNarrative {
  whyThisMatters: string;
  affectedAssets: string;
  affectedHoldings: string;
  researchToReview: string;
  playbooksToConsider: string;
}

export function buildMarketIntelligenceCoachNarrative(item: MarketIntelligenceView): MarketIntelligenceCoachNarrative {
  const riskLine = item.potentialRisks.length > 0 ? `Potential risks: ${item.potentialRisks.join(" ")}` : "No specific risk was flagged for this item.";
  const oppLine = item.potentialOpportunities.length > 0 ? `Potential opportunities: ${item.potentialOpportunities.join(" ")}` : "No specific opportunity was flagged for this item.";
  const whyThisMatters = `${item.summary} ${riskLine} ${oppLine}`;

  const affectedAssets = item.affectedAssets.length > 0 ? `Directly affects: ${item.affectedAssets.join(", ")}.` : "This is a market-wide item — no single symbol is directly named.";

  const affectedHoldings =
    item.relatedHoldings.length > 0
      ? `You currently hold or are exposed to: ${item.relatedHoldings.join(", ")}.`
      : item.isWatched
        ? "None of your current holdings are directly named, but this is relevant to a symbol you're watching, or affects the broad market."
        : "This does not appear to directly affect any symbol you currently hold or watch.";

  const researchToReview = item.relatedResearch.length > 0 ? `Related research already on file: ${item.relatedResearch.map((r) => r.label).join(", ")}.` : "No related research notebook is on file for the affected asset(s) yet — consider starting one.";

  const playbooksToConsider = item.relatedPlaybook ? `Consider revisiting the "${item.relatedPlaybook.name}" playbook for how to process this kind of item.` : "No specific playbook is suggested for this category.";

  return { whyThisMatters, affectedAssets, affectedHoldings, researchToReview, playbooksToConsider };
}

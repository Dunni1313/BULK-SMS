// v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine.
//
// NOT another scanner. NOT another watchlist. NOT another Research module.
// The disciplined front door to the platform: every institutional workflow
// should begin with discovering, capturing, and prioritising opportunities.
//
// DISCLOSED NAMING-COLLISION DECISION (see
// docs/v1.5.0-Sprint-21-Opportunity-Discovery-Engine.md §1 for the full
// reuse audit): this codebase already has a Phase 15 "Institutional
// Opportunity Discovery Engine" — a stock-universe scanner/ranking system
// (pages/OpportunityDiscovery.tsx, route /opportunity-discovery) — exactly
// the kind of "stock screener" this sprint's own spec lists as STRICTLY
// OUT OF SCOPE. To avoid confusing the two, every file/route/nav entry
// this sprint adds is named "Opportunity Pipeline," never "Opportunity
// Discovery." The two systems are never merged.
//
// DISCOVERY IS PURE FRONTEND COMPOSITION — deliberately, per the explicit
// "No new external data providers" / "Reuse first" instructions. Every
// signal below is read directly off an already-existing, already-fetched
// hook's own output:
//   - Market Intelligence (lib/marketIntelligence.ts, Sprint 20) — its own
//     isPriority/isWatched items, categorised straight through.
//   - Watchlists — ValueWatchlistItem's own already-computed
//     priceTargetCrossed/marginOfSafetyTargetCrossed (via ?checkTargets=true,
//     Phase 2 Sprint 27) and lastResearchedAt (a real, already-stored
//     field — never a new staleness formula beyond a simple age check).
//   - Portfolio & Risk Intelligence (Sprint 15) — its own already-computed
//     weakestFactor, reused verbatim as the "portfolio gap" signal.
//   - Knowledge Graph (Sprint 17) — its own already-computed emergingThemes.
//   - Research Notes (Phase 12, investing_research_notes) — a note's mere
//     existence is "previously researched"; nothing here re-derives what a
//     note contains.
// Zero new detection formula beyond simple category/threshold mapping —
// the same discipline every other reuse-first module in this codebase
// follows.

import type { MarketIntelligenceView } from "./marketIntelligence";
import type { ValueWatchlistItem, ResearchNoteItem } from "@workspace/api-client-react";
import type { HealthFactor } from "./portfolioRiskIntelligence";
import type { KnowledgeInsights } from "./knowledgeGraph";

export type OpportunityCategory =
  | "watchlist_event"
  | "economic_release"
  | "earnings"
  | "corporate_action"
  | "portfolio_gap"
  | "sector_development"
  | "macro_change"
  | "knowledge_graph_relationship"
  | "previously_researched"
  | "research_update_needed";

export type OpportunityPriority = "low" | "medium" | "high";

export interface DiscoveredOpportunity {
  /** Deterministic, so repeated discovery runs against the same underlying
   * data never produce a different id for the same real signal. */
  id: string;
  title: string;
  category: OpportunityCategory;
  origin: string;
  evidence: string[];
  relatedAssets: string[];
  relatedSectors: string[];
  priority: OpportunityPriority;
}

const RESEARCH_STALE_DAYS = 90;

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (24 * 60 * 60 * 1000);
}

// ─── Market Intelligence → Discovered Opportunities ─────────────────────

const MARKET_INTELLIGENCE_CATEGORY_MAP: Record<string, OpportunityCategory> = {
  macro: "macro_change",
  economic_events: "economic_release",
  central_banks: "macro_change",
  earnings: "earnings",
  corporate_actions: "corporate_action",
  sector_trends: "sector_development",
  commodities: "sector_development",
  currencies: "macro_change",
  indices: "sector_development",
  volatility: "sector_development",
  options_activity: "sector_development",
  market_breadth: "sector_development",
  sentiment: "sector_development",
};

export function fromMarketIntelligence(items: MarketIntelligenceView[]): DiscoveredOpportunity[] {
  return items
    .filter((i) => i.isPriority || i.isWatched)
    .map((i) => ({
      id: `market-intelligence:${i.id}`,
      title: i.headline,
      category: MARKET_INTELLIGENCE_CATEGORY_MAP[i.category] ?? "sector_development",
      origin: `Market Intelligence — ${i.source}`,
      evidence: [i.summary, ...i.potentialRisks, ...i.potentialOpportunities].filter((e) => e.length > 0),
      relatedAssets: i.affectedAssets,
      relatedSectors: i.affectedSectors,
      priority: i.isPriority ? "high" : i.impact === "medium" ? "medium" : "low",
    }));
}

// ─── Watchlist events (target crossings + stale research) ───────────────

export function fromWatchlistEvents(items: ValueWatchlistItem[]): DiscoveredOpportunity[] {
  const out: DiscoveredOpportunity[] = [];
  for (const w of items) {
    const crossed: string[] = [];
    if (w.priceTargetCrossed) crossed.push(`Price target crossed (current price ${w.currentPrice ?? "—"}, desired buy price ${w.desiredBuyPrice ?? "—"}).`);
    if (w.marginOfSafetyTargetCrossed) crossed.push(`Margin-of-safety target crossed (fair value estimate ${w.fairValueEstimate ?? "—"}).`);
    if (crossed.length > 0) {
      out.push({
        id: `watchlist-event:${w.symbol}`,
        title: `${w.symbol}: watchlist target crossed`,
        category: "watchlist_event",
        origin: "Watchlist — target crossing (checkTargets)",
        evidence: crossed,
        relatedAssets: [w.symbol],
        relatedSectors: [],
        priority: "high",
      });
    }
  }
  return out;
}

export function fromStaleWatchlistResearch(items: ValueWatchlistItem[]): DiscoveredOpportunity[] {
  const out: DiscoveredOpportunity[] = [];
  for (const w of items) {
    const age = daysAgo(w.lastResearchedAt ?? null);
    if (age === null || age >= RESEARCH_STALE_DAYS) {
      out.push({
        id: `research-update-needed:${w.symbol}`,
        title: `${w.symbol}: research needs an update`,
        category: "research_update_needed",
        origin: "Watchlist — lastResearchedAt",
        evidence: [age === null ? "Never marked as researched." : `Last researched ${Math.round(age)} days ago.`],
        relatedAssets: [w.symbol],
        relatedSectors: [],
        priority: "low",
      });
    }
  }
  return out;
}

// ─── Portfolio gap (Portfolio & Risk Intelligence's own weakest factor) ──

export function fromPortfolioGap(weakestFactor: HealthFactor | null): DiscoveredOpportunity[] {
  if (!weakestFactor || !weakestFactor.available) return [];
  return [
    {
      id: `portfolio-gap:${weakestFactor.code}`,
      title: `Portfolio gap: ${weakestFactor.label}`,
      category: "portfolio_gap",
      origin: `Portfolio & Risk Intelligence — ${weakestFactor.sourceModule}`,
      evidence: [weakestFactor.detail],
      relatedAssets: [],
      relatedSectors: [],
      priority: "medium",
    },
  ];
}

// ─── Knowledge Graph (emerging themes) ───────────────────────────────────

export function fromEmergingThemes(emergingThemes: KnowledgeInsights["emergingThemes"]): DiscoveredOpportunity[] {
  return emergingThemes.map((t) => ({
    id: `knowledge-graph-relationship:${t.node.id}`,
    title: `Emerging theme: ${t.node.label}`,
    category: "knowledge_graph_relationship" as const,
    origin: "Knowledge Graph — emerging themes",
    evidence: [`Connected to ${t.connections} recent ${t.connections === 1 ? "entity" : "entities"}.`],
    relatedAssets: [],
    relatedSectors: [],
    priority: "low" as const,
  }));
}

// ─── Previously researched companies (Research Notes) ───────────────────

export function fromPreviouslyResearched(notes: ResearchNoteItem[], excludeSymbols: ReadonlySet<string>): DiscoveredOpportunity[] {
  const bySymbol = new Map<string, ResearchNoteItem>();
  for (const n of notes) {
    if (excludeSymbols.has(n.symbol.toUpperCase())) continue;
    const existing = bySymbol.get(n.symbol);
    if (!existing || new Date(n.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) bySymbol.set(n.symbol, n);
  }
  return Array.from(bySymbol.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
    .map((n) => ({
      id: `previously-researched:${n.symbol}`,
      title: `${n.symbol}: previously researched`,
      category: "previously_researched" as const,
      origin: "Research Notes",
      evidence: [n.note],
      relatedAssets: [n.symbol],
      relatedSectors: [],
      priority: "low" as const,
    }));
}

// ─── Compose every source into one list ──────────────────────────────────

export function discoverOpportunities(sources: {
  marketIntelligence: MarketIntelligenceView[];
  watchlist: ValueWatchlistItem[];
  weakestFactor: HealthFactor | null;
  emergingThemes: KnowledgeInsights["emergingThemes"];
  researchNotes: ResearchNoteItem[];
}): DiscoveredOpportunity[] {
  const marketIntel = fromMarketIntelligence(sources.marketIntelligence);
  const watchlistEvents = fromWatchlistEvents(sources.watchlist);
  const staleResearch = fromStaleWatchlistResearch(sources.watchlist);
  const portfolioGap = fromPortfolioGap(sources.weakestFactor);
  const themes = fromEmergingThemes(sources.emergingThemes);

  const alreadyCoveredSymbols = new Set(
    [...marketIntel, ...watchlistEvents, ...staleResearch].flatMap((o) => o.relatedAssets.map((s) => s.toUpperCase())),
  );
  const previouslyResearched = fromPreviouslyResearched(sources.researchNotes, alreadyCoveredSymbols);

  return [...marketIntel, ...watchlistEvents, ...staleResearch, ...portfolioGap, ...themes, ...previouslyResearched];
}

// ─── AI Discovery Coach — deterministic, zero LLM calls, never recommends
// buying/selling or predicts market direction. Mirrors
// buildMarketIntelligenceCoachNarrative()'s exact established shape
// (Sprint 20). ───────────────────────────────────────────────────────────

export interface OpportunityCoachNarrative {
  whySurfaced: string;
  evidence: string;
  affectedHoldings: string;
  additionalResearchNeeded: string;
}

export function buildOpportunityCoachNarrative(opportunity: DiscoveredOpportunity, heldSymbols: ReadonlySet<string>): OpportunityCoachNarrative {
  const whySurfaced = `This surfaced from ${opportunity.origin}.`;
  const evidence = opportunity.evidence.length > 0 ? `Supporting evidence: ${opportunity.evidence.join(" ")}` : "No specific evidence was attached to this opportunity.";
  const held = opportunity.relatedAssets.filter((a) => heldSymbols.has(a.toUpperCase()));
  const affectedHoldings = held.length > 0 ? `You currently hold or are exposed to: ${held.join(", ")}.` : "This does not appear to directly affect any symbol you currently hold.";
  const additionalResearchNeeded =
    opportunity.category === "previously_researched" || opportunity.category === "research_update_needed"
      ? "Consider reviewing or refreshing your existing research note for the affected asset(s) before promoting this further."
      : "Consider opening the Research Workspace for the affected asset(s) if you decide this is worth pursuing.";
  return { whySurfaced, evidence, affectedHoldings, additionalResearchNeeded };
}

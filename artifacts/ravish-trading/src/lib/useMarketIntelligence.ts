// v1.5.0, Sprint 20 — Institutional Market Intelligence Engine.
//
// Orchestrates the backend's stateless GET /market-intelligence feed
// against real, already-fetched, per-user data — mirrors
// useDecisionQualityEngine.ts's/usePlaybooks.ts's own established
// composition pattern exactly. Watchlist Integration reuses BOTH existing
// watchlist systems (the flat Value Watchlist, Sprint 27, and the named/
// taggable Institutional Watchlists Engine, Phase 43) — never a third.
// "Held" symbols reuse the Institutional Watchlists Engine's own already-
// computed per-symbol heldInInvesting/heldInTrading/heldInOptions flags
// (Phase 43's opportunityOverview) — a disclosed, honest simplification:
// this only knows a symbol is genuinely held when that symbol is ALSO on
// one of the user's watchlists, never a fabricated platform-wide holdings
// scan. Portfolio Integration's broader exposure/sector/macro/currency
// summary reuses usePortfolioRiskIntelligence() (Sprint 15) directly —
// zero duplicate risk calculation.

import { useMemo } from "react";
import { useGetMarketIntelligence, useGetValueWatchlist, useGetWatchlistsDashboard, useListJournalEntries } from "@workspace/api-client-react";
import { useKnowledgeGraph } from "./useKnowledgeGraph";
import { usePortfolioRiskIntelligence, type UsePortfolioRiskIntelligenceResult } from "./usePortfolioRiskIntelligence";
import { enrichMarketIntelligenceFeed, type MarketIntelligenceView } from "./marketIntelligence";
import { buildKnowledgeInsights, type KnowledgeGraph, type KnowledgeInsights } from "./knowledgeGraph";
import type { MarketIntelligenceCategoryMeta } from "@workspace/api-client-react";

export interface UseMarketIntelligenceResult {
  loading: boolean;
  items: MarketIntelligenceView[];
  categories: MarketIntelligenceCategoryMeta[];
  portfolioIntelligence: UsePortfolioRiskIntelligenceResult;
  /** Reused directly from the Knowledge Graph (Sprint 17) — never a second,
   * duplicate computation. Command Centre's own "Emerging Themes" section
   * reads this same field. */
  emergingThemes: KnowledgeInsights["emergingThemes"];
  graph: KnowledgeGraph;
  /** v1.5.0, Sprint 21 — exposed additively (was already computed
   * internally) so the new Opportunity Pipeline Engine can reuse the exact
   * same "held" concept for its own AI Discovery Coach, rather than
   * re-deriving it a second time. */
  heldSymbols: ReadonlySet<string>;
  generatedAt: string | null;
  reload: () => void;
}

export function useMarketIntelligence(): UseMarketIntelligenceResult {
  const { data: feed, isLoading: feedLoading, refetch } = useGetMarketIntelligence();
  const { data: valueWatchlist, isLoading: valueWatchlistLoading } = useGetValueWatchlist();
  const { data: watchlistsDashboard, isLoading: watchlistsLoading } = useGetWatchlistsDashboard();
  const knowledge = useKnowledgeGraph();
  const portfolioIntelligence = usePortfolioRiskIntelligence();
  const { data: journalEntries } = useListJournalEntries();

  const watchedSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const w of valueWatchlist ?? []) set.add(w.symbol.toUpperCase());
    for (const i of watchlistsDashboard?.items ?? []) set.add(i.symbol.toUpperCase());
    return set;
  }, [valueWatchlist, watchlistsDashboard]);

  const heldSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const s of watchlistsDashboard?.opportunityOverview ?? []) {
      if (s.heldInInvesting || s.heldInTrading || s.heldInOptions) set.add(s.symbol.toUpperCase());
    }
    return set;
  }, [watchlistsDashboard]);

  const items = useMemo(() => {
    if (!feed) return [];
    return enrichMarketIntelligenceFeed(feed.items, knowledge.graph, watchedSymbols, heldSymbols);
  }, [feed, knowledge.graph, watchedSymbols, heldSymbols]);

  const emergingThemes = useMemo(
    () => buildKnowledgeInsights(knowledge.graph, journalEntries ?? [], portfolioIntelligence.risk).emergingThemes,
    [knowledge.graph, journalEntries, portfolioIntelligence.risk],
  );

  const loading = feedLoading || valueWatchlistLoading || watchlistsLoading || knowledge.loading;

  return {
    loading,
    items,
    categories: feed?.categories ?? [],
    portfolioIntelligence,
    emergingThemes,
    graph: knowledge.graph,
    heldSymbols,
    generatedAt: feed?.generatedAt ?? null,
    reload: () => {
      refetch();
      knowledge.reload();
    },
  };
}

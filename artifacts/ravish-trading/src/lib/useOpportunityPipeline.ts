// v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine (built as
// a distinctly-named "Opportunity Pipeline" — see lib/opportunityPipeline.ts's
// own header comment for the disclosed naming-collision reasoning against
// the pre-existing Phase 15 Opportunity Discovery scanner).
//
// Orchestrates the pure discoverOpportunities() composition against real,
// already-fetched data — mirrors useMarketIntelligence.ts's own established
// pattern (Sprint 20) exactly: reuse useMarketIntelligence() wholesale
// (itself already composing Market Intelligence + both Watchlist systems +
// Portfolio & Risk Intelligence + Knowledge Graph) rather than re-fetching
// any of that, and fetch Research Notes/manage captured Opportunity
// Pipeline items via the backend's own dedicated persistence routes.

import { useMemo } from "react";
import {
  useGetValueWatchlist,
  useGetAllResearchNotes,
  useListOpportunityPipelineItems,
  useCaptureOpportunityPipelineItem,
  useUpdateOpportunityPipelineItem,
  useDeleteOpportunityPipelineItem,
  getListOpportunityPipelineItemsQueryKey,
  type OpportunityPipelineItem,
  type CaptureOpportunityPipelineItemInput,
  type UpdateOpportunityPipelineItemInput,
} from "@workspace/api-client-react";
import { useMarketIntelligence } from "./useMarketIntelligence";
import { discoverOpportunities, type DiscoveredOpportunity } from "./opportunityPipeline";

export interface UseOpportunityPipelineResult {
  loading: boolean;
  discovered: DiscoveredOpportunity[];
  captured: OpportunityPipelineItem[];
  heldSymbols: ReadonlySet<string>;
  capture: (input: CaptureOpportunityPipelineItemInput) => Promise<void>;
  update: (id: number, input: UpdateOpportunityPipelineItemInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
  reload: () => void;
}

export function useOpportunityPipeline(): UseOpportunityPipelineResult {
  const marketIntel = useMarketIntelligence();
  const { data: watchlist, isLoading: watchlistLoading } = useGetValueWatchlist({ checkTargets: "true" });
  const { data: researchNotes, isLoading: notesLoading } = useGetAllResearchNotes();
  const { data: captured, isLoading: capturedLoading, refetch: refetchCaptured } = useListOpportunityPipelineItems();

  const captureMutation = useCaptureOpportunityPipelineItem({
    mutation: { onSuccess: () => refetchCaptured() },
  });
  const updateMutation = useUpdateOpportunityPipelineItem({
    mutation: { onSuccess: () => refetchCaptured() },
  });
  const deleteMutation = useDeleteOpportunityPipelineItem({
    mutation: { onSuccess: () => refetchCaptured() },
  });

  const discovered = useMemo(() => {
    if (marketIntel.loading || watchlistLoading || notesLoading) return [];
    return discoverOpportunities({
      marketIntelligence: marketIntel.items,
      watchlist: watchlist ?? [],
      weakestFactor: marketIntel.portfolioIntelligence.weakestFactor,
      emergingThemes: marketIntel.emergingThemes,
      researchNotes: researchNotes ?? [],
    });
  }, [marketIntel.loading, marketIntel.items, marketIntel.portfolioIntelligence.weakestFactor, marketIntel.emergingThemes, watchlistLoading, watchlist, notesLoading, researchNotes]);

  const loading = marketIntel.loading || watchlistLoading || notesLoading || capturedLoading;

  return {
    loading,
    discovered,
    captured: captured ?? [],
    heldSymbols: marketIntel.heldSymbols,
    capture: async (input) => {
      await captureMutation.mutateAsync({ data: input });
    },
    update: async (id, input) => {
      await updateMutation.mutateAsync({ id, data: input });
    },
    remove: async (id) => {
      await deleteMutation.mutateAsync({ id });
    },
    reload: () => {
      marketIntel.reload();
      refetchCaptured();
    },
  };
}

export { getListOpportunityPipelineItemsQueryKey };

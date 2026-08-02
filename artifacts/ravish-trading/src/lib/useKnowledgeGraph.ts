// v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph.
//
// Orchestrates knowledgeGraph.ts's pure buildKnowledgeGraph() against real,
// already-fetched data — mirrors useWorkflowAutomation.ts's own established
// pattern (Sprint 16) exactly: reuse useTradeLifecyclePipeline() (Sprint 14)
// and usePortfolioRiskIntelligence() (Sprint 15) wholesale rather than
// re-deriving anything either already computes, and fetch Notebooks/
// Strategies across all 3 coachIds the same plain-fetch way
// useTradeLifecyclePipeline() itself already fetches Trade Plans.

import { useEffect, useState, useCallback, useMemo } from "react";
import { listNotebooks, type AiNotebook } from "./ai-coach/notebooksApi";
import { listStrategies, type AiStrategy } from "./ai-coach/strategiesApi";
import type { CoachId } from "./ai-coach/capabilityRegistry";
import { useTradeLifecyclePipeline } from "./useTradeLifecycle";
import { usePortfolioRiskIntelligence } from "./usePortfolioRiskIntelligence";
import { useListJournalEntries } from "@workspace/api-client-react";
import { buildKnowledgeGraph, type KnowledgeGraph } from "./knowledgeGraph";

const COACH_IDS: CoachId[] = ["investing", "trading", "options"];

export interface UseKnowledgeGraphResult {
  loading: boolean;
  graph: KnowledgeGraph;
  notebooks: AiNotebook[];
  strategies: AiStrategy[];
  reload: () => void;
}

export function useKnowledgeGraph(): UseKnowledgeGraphResult {
  const [loading, setLoading] = useState(true);
  const [notebooks, setNotebooks] = useState<AiNotebook[]>([]);
  const [strategies, setStrategies] = useState<AiStrategy[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const bumpReload = useCallback(() => setReloadTick((t) => t + 1), []);

  const pipeline = useTradeLifecyclePipeline();
  const intelligence = usePortfolioRiskIntelligence();
  const { data: journalEntries } = useListJournalEntries();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function load() {
      const [nbByCoach, stratByCoach] = await Promise.all([
        Promise.all(COACH_IDS.map((c) => listNotebooks(c, { includeArchived: true }).catch((): AiNotebook[] => []))),
        Promise.all(COACH_IDS.map((c) => listStrategies(c, { includeArchived: true }).catch((): AiStrategy[] => []))),
      ]);
      if (cancelled) return;
      setNotebooks(nbByCoach.flat());
      setStrategies(stratByCoach.flat());
      setLoading(false);
    }
    load().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const graph = useMemo(
    () =>
      buildKnowledgeGraph({
        notebooks,
        strategies,
        lifecycleRecords: pipeline.records,
        journalEntries: journalEntries ?? [],
        portfolioHealth: intelligence.health,
        riskReport: intelligence.risk,
      }),
    [notebooks, strategies, pipeline.records, journalEntries, intelligence.health, intelligence.risk],
  );

  const reload = useCallback(() => {
    bumpReload();
    pipeline.reload();
    // usePortfolioRiskIntelligence() has no reload of its own — it derives
    // entirely from TanStack Query hooks that already refetch on their own
    // normal cache lifecycle, matching that hook's own established shape.
  }, [bumpReload, pipeline]);

  return {
    loading: loading || pipeline.loading || intelligence.loading,
    graph,
    notebooks,
    strategies,
    reload,
  };
}

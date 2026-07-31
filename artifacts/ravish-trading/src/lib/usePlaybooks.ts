// v1.5.0, Sprint 18 — Institutional Playbooks & Operating Procedures Engine.
//
// Orchestrates playbookProgress.ts's pure functions against real,
// already-fetched data — mirrors useWorkflowAutomation.ts's own
// established pattern exactly (Sprint 16): reuse the exact same list
// functions/hooks those two sprints already call, never a second,
// duplicate fetch layer.

import { useEffect, useState, useCallback, useMemo } from "react";
import { listNotebooks, type AiNotebook } from "./ai-coach/notebooksApi";
import { listStrategies, type AiStrategy } from "./ai-coach/strategiesApi";
import type { CoachId } from "./ai-coach/capabilityRegistry";
import { useTradeLifecyclePipeline } from "./useTradeLifecycle";
import { usePortfolioRiskIntelligence } from "./usePortfolioRiskIntelligence";
import { buildKnowledgeGraph, type KnowledgeGraph } from "./knowledgeGraph";
import type { RiskIntelligenceReport } from "./portfolioRiskIntelligence";
import {
  computeAllPlaybooksProgress,
  currentPlaybook,
  recommendedNextPlaybook,
  type PlaybookProgress,
  type PlaybookProgressContext,
} from "./playbookProgress";
import { loadPlaybookAcknowledgements, acknowledgePlaybookStage as persistAck, unacknowledgePlaybookStage as persistUnack } from "./playbook-acknowledgements";
import { useListJournalEntries, useGetLearningProgress, type JournalEntry } from "@workspace/api-client-react";

const COACH_IDS: CoachId[] = ["investing", "trading", "options"];

export interface UsePlaybooksResult {
  loading: boolean;
  progresses: PlaybookProgress[];
  current: PlaybookProgress | null;
  recommendedNext: PlaybookProgress | null;
  boundTradePlanId: number | null;
  setBoundTradePlanId: (id: number | null) => void;
  acknowledge: (playbookId: string, stageId: string) => void;
  unacknowledge: (playbookId: string, stageId: string) => void;
  reload: () => void;
  /** The same Knowledge Graph (Sprint 17) this hook composed internally to
   * score playbook progress — exposed so the execution page can surface
   * Related Knowledge directly, via the graph's own exported traversal
   * functions, never a second, duplicate graph. */
  graph: KnowledgeGraph;
  journalEntries: JournalEntry[];
  portfolioRisk: RiskIntelligenceReport | null;
  tradePlanOptions: { id: number; title: string; coachId: CoachId }[];
}

export function usePlaybooks(): UsePlaybooksResult {
  const [notebooksByCoach, setNotebooksByCoach] = useState<Partial<Record<CoachId, AiNotebook[]>>>({});
  const [strategiesByCoach, setStrategiesByCoach] = useState<Partial<Record<CoachId, AiStrategy[]>>>({});
  const [fetchLoading, setFetchLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [manualAcks, setManualAcks] = useState<Set<string>>(() => loadPlaybookAcknowledgements());
  const [boundTradePlanId, setBoundTradePlanId] = useState<number | null>(null);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setFetchLoading(true);

    async function load() {
      const [notebookLists, strategyLists] = await Promise.all([
        Promise.all(COACH_IDS.map((c) => listNotebooks(c).catch((): AiNotebook[] => []))),
        Promise.all(COACH_IDS.map((c) => listStrategies(c).catch((): AiStrategy[] => []))),
      ]);
      if (cancelled) return;
      const notebooks: Partial<Record<CoachId, AiNotebook[]>> = {};
      const strategies: Partial<Record<CoachId, AiStrategy[]>> = {};
      COACH_IDS.forEach((c, i) => {
        notebooks[c] = notebookLists[i];
        strategies[c] = strategyLists[i];
      });
      setNotebooksByCoach(notebooks);
      setStrategiesByCoach(strategies);
      setFetchLoading(false);
    }

    load().catch(() => {
      if (!cancelled) setFetchLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const pipeline = useTradeLifecyclePipeline();
  const portfolio = usePortfolioRiskIntelligence();
  const { data: journalEntries } = useListJournalEntries();
  const { data: learningProgress } = useGetLearningProgress();

  const loading = fetchLoading || pipeline.loading || portfolio.loading;

  const graph = useMemo(
    () =>
      buildKnowledgeGraph({
        notebooks: COACH_IDS.flatMap((c) => notebooksByCoach[c] ?? []),
        strategies: COACH_IDS.flatMap((c) => strategiesByCoach[c] ?? []),
        lifecycleRecords: pipeline.records,
        journalEntries: journalEntries ?? [],
        portfolioHealth: portfolio.health,
        riskReport: portfolio.risk,
      }),
    [notebooksByCoach, strategiesByCoach, pipeline.records, journalEntries, portfolio.health, portfolio.risk],
  );

  const learningPathsInProgress = useMemo(
    () => (learningProgress?.pathCompletion ?? []).filter((p) => p.percentComplete > 0).length,
    [learningProgress],
  );

  const progresses = useMemo(() => {
    const ctx: PlaybookProgressContext = {
      notebooksByCoach,
      strategiesByCoach,
      lifecycleRecords: pipeline.records,
      portfolioHealth: portfolio.health,
      portfolioRisk: portfolio.risk,
      weakestPortfolioFactor: portfolio.weakestFactor,
      journalEntries: journalEntries ?? [],
      learningPathsInProgress,
      graph,
      manualAcks,
      boundTradePlanId,
    };
    return computeAllPlaybooksProgress(ctx);
  }, [notebooksByCoach, strategiesByCoach, pipeline.records, portfolio.health, portfolio.risk, portfolio.weakestFactor, journalEntries, learningPathsInProgress, graph, manualAcks, boundTradePlanId]);

  const acknowledge = useCallback((playbookId: string, stageId: string) => {
    persistAck(playbookId, stageId);
    setManualAcks((prev) => new Set(prev).add(`${playbookId}:${stageId}`));
  }, []);

  const unacknowledge = useCallback((playbookId: string, stageId: string) => {
    persistUnack(playbookId, stageId);
    setManualAcks((prev) => {
      const next = new Set(prev);
      next.delete(`${playbookId}:${stageId}`);
      return next;
    });
  }, []);

  const tradePlanOptions = useMemo(
    () => pipeline.records.filter((r) => r.currentStage !== "archived").map((r) => ({ id: r.tradePlan.id, title: r.tradePlan.title, coachId: r.tradePlan.coachId })),
    [pipeline.records],
  );

  return {
    loading,
    progresses,
    current: currentPlaybook(progresses),
    recommendedNext: recommendedNextPlaybook(progresses),
    boundTradePlanId,
    setBoundTradePlanId,
    acknowledge,
    unacknowledge,
    reload,
    graph,
    journalEntries: journalEntries ?? [],
    portfolioRisk: portfolio.risk,
    tradePlanOptions,
  };
}

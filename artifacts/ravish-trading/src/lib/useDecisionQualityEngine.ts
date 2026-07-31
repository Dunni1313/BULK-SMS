// v1.5.0, Sprint 19 — Institutional Decision Quality & Review Engine.
//
// Orchestrates decisionReview.ts's/decisionReviewTrends.ts's pure
// functions against real, already-fetched data — mirrors
// useWorkflowAutomation.ts's/usePlaybooks.ts's own established pattern
// exactly. The one genuinely new fetch pattern this sprint introduces
// (per-plan TradePlanDetail/MissingTradePlanInfoResult/strategy detail
// for EVERY review-eligible plan, not just the single most-recent one
// useActiveDecisionSummary() fetches) is a direct extension of that same
// hook's own established per-plan fetch — never a second, different
// fetch approach.

import { useEffect, useState, useCallback, useMemo } from "react";
import { getTradePlan, getMissingTradePlanInformation } from "./ai-coach/tradePlansApi";
import { getStrategy, getMissingSections, type AiStrategyDetail, type MissingSectionsResult } from "./ai-coach/strategiesApi";
import { computeCoreDecisionStages } from "./decisionWorkflow";
import { useTradeLifecyclePipeline } from "./useTradeLifecycle";
import { NEUTRAL_REVIEW, NEUTRAL_PORTFOLIO } from "./useDecisionWorkflow";
import { useKnowledgeGraph } from "./useKnowledgeGraph";
import { useListJournalEntries } from "@workspace/api-client-react";
import { PLAYBOOKS } from "./playbooks";
import { computePlaybookProgress, type PlaybookProgressContext } from "./playbookProgress";
import { loadPlaybookAcknowledgements } from "./playbook-acknowledgements";
import { computeDecisionReview, type DecisionReview } from "./decisionReview";
import { computeDecisionQualityTrends, computeRecurringPlaybookDeviations, type DecisionQualityTrend, type RecurringPlaybookDeviation } from "./decisionReviewTrends";
import type { KnowledgeGraph } from "./knowledgeGraph";
import type { JournalEntry } from "@workspace/api-client-react";

const TRADE_PLAN_BOUND_PLAYBOOKS = PLAYBOOKS.filter((p) => p.entityBinding === "trade-plan");

export interface UseDecisionQualityEngineResult {
  loading: boolean;
  reviews: DecisionReview[];
  pendingReviewCount: number;
  trends: DecisionQualityTrend[];
  recurringDeviations: RecurringPlaybookDeviation[];
  graph: KnowledgeGraph;
  journalEntries: JournalEntry[];
  reload: () => void;
}

export function useDecisionQualityEngine(): UseDecisionQualityEngineResult {
  const pipeline = useTradeLifecyclePipeline();
  const knowledge = useKnowledgeGraph();
  const { data: journalEntries } = useListJournalEntries();

  const [reviews, setReviews] = useState<DecisionReview[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  const eligibleRecords = useMemo(() => pipeline.records.filter((r) => r.linkedExecution !== null), [pipeline.records]);

  useEffect(() => {
    if (pipeline.loading || knowledge.loading) return;
    let cancelled = false;
    setFetchLoading(true);

    async function load() {
      const manualAcks = loadPlaybookAcknowledgements();

      const computed = await Promise.all(
        eligibleRecords.map(async (record) => {
          try {
            const [plan, missing] = await Promise.all([
              getTradePlan(record.tradePlan.id),
              getMissingTradePlanInformation(record.tradePlan.id),
            ]);
            let strat: AiStrategyDetail | null = null;
            let stratMissing: MissingSectionsResult | null = null;
            if (plan.strategyId !== null) {
              [strat, stratMissing] = await Promise.all([
                getStrategy(plan.strategyId).catch(() => null),
                getMissingSections(plan.strategyId).catch(() => null),
              ]);
            }
            const coreStages = computeCoreDecisionStages({
              tradePlan: plan,
              missingInfo: missing,
              strategy: strat,
              strategyMissingSections: stratMissing,
              review: NEUTRAL_REVIEW,
              portfolio: NEUTRAL_PORTFOLIO,
            });

            const journalEntry = (journalEntries ?? []).find((j) => j.id === record.journalStatus.journalEntryId) ?? null;

            const playbookProgresses = TRADE_PLAN_BOUND_PLAYBOOKS.map((playbook) => {
              const ctx: PlaybookProgressContext = {
                notebooksByCoach: {},
                strategiesByCoach: {},
                lifecycleRecords: pipeline.records,
                portfolioHealth: null,
                portfolioRisk: null,
                weakestPortfolioFactor: null,
                journalEntries: journalEntries ?? [],
                learningPathsInProgress: 0,
                graph: knowledge.graph,
                manualAcks,
                boundTradePlanId: plan.id,
              };
              return computePlaybookProgress(playbook, ctx);
            });

            return computeDecisionReview({ tradePlan: plan, coreStages, record, journalEntry, playbookProgresses });
          } catch {
            // A single plan's own detail fetch failing (e.g. deleted mid-session)
            // never breaks every other decision's review — it's simply excluded.
            return null;
          }
        }),
      );

      if (cancelled) return;
      const nonNull = computed.filter((r): r is DecisionReview => r !== null);
      nonNull.sort((a, b) => new Date(a.executedAt ?? a.updatedAt).getTime() - new Date(b.executedAt ?? b.updatedAt).getTime());
      setReviews(nonNull);
      setFetchLoading(false);
    }

    load().catch(() => {
      if (!cancelled) setFetchLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleRecords, pipeline.loading, knowledge.loading, reloadTick]);

  const pendingReviewCount = useMemo(
    () => eligibleRecords.filter((r) => r.currentStage === "open-position" || r.currentStage === "managing" || r.currentStage === "closed" || r.currentStage === "journal-pending").length,
    [eligibleRecords],
  );

  const trends = useMemo(() => computeDecisionQualityTrends(reviews), [reviews]);
  const recurringDeviations = useMemo(() => computeRecurringPlaybookDeviations(reviews), [reviews]);

  return {
    loading: pipeline.loading || knowledge.loading || fetchLoading,
    reviews,
    pendingReviewCount,
    trends,
    recurringDeviations,
    graph: knowledge.graph,
    journalEntries: journalEntries ?? [],
    reload: () => {
      reload();
      pipeline.reload();
      knowledge.reload();
    },
  };
}

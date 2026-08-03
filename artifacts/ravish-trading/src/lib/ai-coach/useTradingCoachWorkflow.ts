// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. The single
// orchestration hook every mounted <AiTradingCoachPanel/> uses.
//
// Nests already-existing hooks exactly the way usePortfolioRiskIntelligence()
// is nested by useWorkflowAutomation()/useKnowledgeGraph()/usePlaybooks()
// elsewhere in this codebase (Phase 2's own established composition
// pattern) — never re-fetches, never recomputes a value another hook
// already computed. Reads:
//   - useGetScannerResults()            (Scanner.tsx)
//   - useOpportunityPipeline()          (OpportunityPipeline.tsx)
//   - useActiveDecisionSummary()        (DecisionWorkflow.tsx)
//   - useTradeLifecyclePipeline()       (ExecutionLifecycleManager.tsx)
//   - useListTradingJournalEntries()    (TradingJournal.tsx)
// and this sprint's own new, small state surface:
//   - getAiTradingCoachState() / updateAiTradingCoachPreferences() /
//     updateAiTradingCoachDailyState()  (aiTradingCoachApi.ts)
//
// Produces one ready-to-render DailyWorkflowResult (via the pure
// computeDailyWorkflow()) plus the mutation callers every panel action
// needs (markStepComplete/markStepSkipped/declareNoTrade/setExperienceLevel/
// toggleBeginnerMode).

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetScannerResults, useListTradingJournalEntries } from "@workspace/api-client-react";
import { useOpportunityPipeline } from "../useOpportunityPipeline";
import { useActiveDecisionSummary } from "../useDecisionWorkflow";
import { useTradeLifecyclePipeline } from "../useTradeLifecycle";
import {
  getAiTradingCoachState,
  updateAiTradingCoachPreferences,
  updateAiTradingCoachDailyState,
  type ExperienceLevel,
} from "./aiTradingCoachApi";
import {
  computeDailyWorkflow,
  type DailyWorkflowResult,
  type DailyWorkflowStepId,
  type WorkflowSignals,
} from "./tradingCoachWorkflow";

const AI_TRADING_COACH_STATE_QUERY_KEY = ["ai-trading-coach", "state"] as const;

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export interface UseTradingCoachWorkflowResult {
  loading: boolean;
  workflow: DailyWorkflowResult | null;
  activeTradePlanId: number | null;
  experienceLevel: ExperienceLevel;
  beginnerModeEnabled: boolean;
  marketIsOpen: boolean | null;
  noTradeReason: string | null;
  markStepComplete: (stepId: DailyWorkflowStepId) => void;
  markStepSkipped: (stepId: DailyWorkflowStepId) => void;
  declareNoTrade: (reason: string) => void;
  clearNoTrade: () => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  toggleBeginnerMode: (enabled: boolean) => void;
}

export function useTradingCoachWorkflow(): UseTradingCoachWorkflowResult {
  const queryClient = useQueryClient();

  const coachState = useQuery({
    queryKey: AI_TRADING_COACH_STATE_QUERY_KEY,
    queryFn: getAiTradingCoachState,
    staleTime: 30_000,
  });

  const scanner = useGetScannerResults();
  const opportunityPipeline = useOpportunityPipeline();
  const activeDecision = useActiveDecisionSummary();
  const lifecycle = useTradeLifecyclePipeline();
  const journal = useListTradingJournalEntries();

  const invalidateState = () => queryClient.invalidateQueries({ queryKey: AI_TRADING_COACH_STATE_QUERY_KEY });

  const preferencesMutation = useMutation({
    mutationFn: updateAiTradingCoachPreferences,
    onSuccess: invalidateState,
  });
  const dailyStateMutation = useMutation({
    mutationFn: updateAiTradingCoachDailyState,
    onSuccess: invalidateState,
  });

  const loading =
    coachState.isLoading ||
    scanner.isLoading ||
    opportunityPipeline.loading ||
    activeDecision.loading ||
    lifecycle.loading ||
    journal.isLoading;

  const signals: WorkflowSignals | null = useMemo(() => {
    if (!coachState.data) return null;
    const today = new Date();
    return {
      marketClock: coachState.data.marketClock ? { isOpen: coachState.data.marketClock.isOpen } : null,
      scanner: {
        hasResultsToday: (scanner.data ?? []).some((r) => isSameCalendarDay(new Date(r.createdAt), today)),
      },
      opportunityPipeline: { hasCapturedItems: opportunityPipeline.captured.length > 0 },
      activeDecision: {
        tradePlanId: activeDecision.tradePlan?.id ?? null,
        tradePlanStatus: activeDecision.tradePlan?.status ?? null,
        scoreLabel: activeDecision.score?.label ?? null,
      },
      lifecycleRecords: lifecycle.records.map((r) => ({
        currentStage: r.currentStage,
        journalState: r.journalStatus.state,
        outstandingTaskCount: r.outstandingTasks.length,
      })),
      journal: {
        hasEntryToday: (journal.data ?? []).some((e) => isSameCalendarDay(new Date(e.createdAt), today)),
      },
    };
  }, [coachState.data, scanner.data, opportunityPipeline.captured, activeDecision.tradePlan, activeDecision.score, lifecycle.records, journal.data]);

  const workflow: DailyWorkflowResult | null = useMemo(() => {
    if (!signals || !coachState.data) return null;
    return computeDailyWorkflow(signals, {
      completedStepIds: coachState.data.dailyState.completedStepIds as DailyWorkflowStepId[],
      skippedStepIds: coachState.data.dailyState.skippedStepIds as DailyWorkflowStepId[],
      noTradeReason: coachState.data.dailyState.noTradeReason,
    });
  }, [signals, coachState.data]);

  function withStep(stepId: DailyWorkflowStepId, kind: "completed" | "skipped") {
    if (!coachState.data) return;
    const current = coachState.data.dailyState;
    const nextCompleted = kind === "completed" ? [...new Set([...current.completedStepIds, stepId])] : current.completedStepIds;
    const nextSkipped = kind === "skipped" ? [...new Set([...current.skippedStepIds, stepId])] : current.skippedStepIds;
    dailyStateMutation.mutate({ completedStepIds: nextCompleted, skippedStepIds: nextSkipped });
  }

  return {
    loading,
    workflow,
    activeTradePlanId: activeDecision.tradePlan?.id ?? null,
    experienceLevel: coachState.data?.preferences.experienceLevel ?? "beginner",
    beginnerModeEnabled: coachState.data?.preferences.beginnerModeEnabled ?? true,
    marketIsOpen: coachState.data?.marketClock.isOpen ?? null,
    noTradeReason: coachState.data?.dailyState.noTradeReason ?? null,
    markStepComplete: (stepId) => withStep(stepId, "completed"),
    markStepSkipped: (stepId) => withStep(stepId, "skipped"),
    declareNoTrade: (reason) => dailyStateMutation.mutate({ noTradeReason: reason }),
    clearNoTrade: () => dailyStateMutation.mutate({ noTradeReason: null }),
    setExperienceLevel: (level) => preferencesMutation.mutate({ experienceLevel: level }),
    toggleBeginnerMode: (enabled) => preferencesMutation.mutate({ beginnerModeEnabled: enabled }),
  };
}

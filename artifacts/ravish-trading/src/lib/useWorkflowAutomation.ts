// v1.5.0, Sprint 16 — Institutional Workflow Automation Engine.
//
// Orchestrates workflowAutomation.ts's pure functions against real,
// already-fetched data — mirrors useTradeLifecycle.ts's and
// usePortfolioRiskIntelligence.ts's own established pattern exactly:
// reuse the exact same list functions/hooks those two sprints already
// call, never a second, duplicate fetch layer.

import { useEffect, useState, useCallback, useMemo } from "react";
import { listNotebooks, type AiNotebook } from "./ai-coach/notebooksApi";
import { listStrategies, type AiStrategy } from "./ai-coach/strategiesApi";
import type { CoachId } from "./ai-coach/capabilityRegistry";
import { useTradeLifecyclePipeline } from "./useTradeLifecycle";
import { usePortfolioRiskIntelligence } from "./usePortfolioRiskIntelligence";
import { computeWorkflowTasks, applyDismissals, type WorkflowTask, type WorkflowAutomationInput } from "./workflowAutomation";
import { loadWorkflowDismissals, dismissWorkflowTask as persistDismissal } from "./workflow-dismissals";

const COACH_IDS: CoachId[] = ["investing", "trading", "options"];

export interface UseWorkflowAutomationResult {
  loading: boolean;
  tasks: WorkflowTask[];
  activeTasks: WorkflowTask[];
  recentlyCompleted: WorkflowTask[];
  dismissed: WorkflowTask[];
  dismiss: (taskId: string) => void;
  reload: () => void;
}

export function useWorkflowAutomation(): UseWorkflowAutomationResult {
  const [notebooksByCoach, setNotebooksByCoach] = useState<Partial<Record<CoachId, AiNotebook[]>>>({});
  const [strategiesByCoach, setStrategiesByCoach] = useState<Partial<Record<CoachId, AiStrategy[]>>>({});
  const [fetchLoading, setFetchLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => loadWorkflowDismissals());

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

  const loading = fetchLoading || pipeline.loading || portfolio.loading;

  const tasks = useMemo(() => {
    const input: WorkflowAutomationInput = {
      notebooksByCoach,
      strategiesByCoach,
      lifecycleRecords: pipeline.records,
      portfolioHealth: portfolio.health,
      portfolioRisk: portfolio.risk,
      weakestPortfolioFactor: portfolio.weakestFactor,
    };
    const computed = computeWorkflowTasks(input);
    return applyDismissals(computed, dismissedIds);
  }, [notebooksByCoach, strategiesByCoach, pipeline.records, portfolio.health, portfolio.risk, portfolio.weakestFactor, dismissedIds]);

  const dismiss = useCallback((taskId: string) => {
    persistDismissal(taskId);
    setDismissedIds((prev) => new Set(prev).add(taskId));
  }, []);

  const activeTasks = useMemo(() => tasks.filter((t) => t.status === "pending" || t.status === "in-progress" || t.status === "waiting"), [tasks]);
  const recentlyCompleted = useMemo(() => tasks.filter((t) => t.status === "completed"), [tasks]);
  const dismissed = useMemo(() => tasks.filter((t) => t.status === "dismissed"), [tasks]);

  return { loading, tasks, activeTasks, recentlyCompleted, dismissed, dismiss, reload };
}

// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. Smart Navigation:
// maps each Daily Workflow step to the ONE existing page (and, where a
// real deep-linking convention already exists, entity id) that already
// implements that step's functionality. Introduces zero new routes —
// every destination below is verified, real, and already shipped:
//
//   - "/"                  InstitutionalCommandCentre (daily briefing, all 3 engines at a glance)
//   - "/scanner"           Scanner.tsx (useGetScannerResults/useRunScanner)
//   - "/opportunity-pipeline" OpportunityPipeline.tsx (useOpportunityPipeline)
//   - "/trading-research"  TradingResearch.tsx — embeds BOTH the trading-engine
//                          research content AND the TradePlannerSidebar/TradePlanList
//                          (lib/ai-coach/*) that create/manage the very
//                          TradePlan entities this workflow's later steps
//                          read (via useActiveDecisionSummary). Research and
//                          Trade Planning deliberately share this one
//                          destination — they are, honestly, the same page
//                          in this codebase today, not two.
//   - "/decision-workflow" DecisionWorkflow.tsx — the existing, dedicated
//                          per-trade-plan decision-quality checklist
//                          (?planId= deep-link precedent already
//                          established by that page itself).
//   - "/execution-lifecycle" ExecutionLifecycleManager.tsx — the existing
//                          per-trade-plan pipeline-stage/outstanding-tasks
//                          tracker; reused for BOTH Execution Preparation
//                          (its own "outstandingTasks" readiness checklist)
//                          and Position Monitoring (its own open-position/
//                          managing stage tracking) — same underlying
//                          TradeLifecycleRecord, two different moments in
//                          its lifecycle.
//   - "/trade-execution-center" TradeExecutionCenter.tsx — the existing,
//                          protected-logic-backed, guided
//                          Scanner->...->Trade Monitor execution flow. The
//                          Daily Workflow Engine never bypasses this; it
//                          only opens it.
//   - "/trading-journal"   TradingJournal.tsx (useListTradingJournalEntries)
//   - "/daily-report"      CrossEngineDailyReport.tsx — the existing
//                          end-of-day, all-3-engines summary.
//
// Deep-link param convention (?planId=<id>) mirrors this codebase's own
// established precedent (DecisionWorkflow.tsx, ExecutionLifecycleManager.tsx,
// InstitutionalPlaybooks.tsx's ?playbookId=) — never a newly-invented param
// shape.

import type { DailyWorkflowStepId } from "./tradingCoachWorkflow";

export interface WorkflowNavigationTarget {
  /** Route path with no query string. */
  path: string;
  /** Full href, including ?planId= when a real, known trade plan id applies. */
  href: string;
  /** Human label for the destination page, for UI copy ("Open Scanner"). */
  destinationLabel: string;
}

const DESTINATION_LABELS: Record<DailyWorkflowStepId, string> = {
  "morning-brief": "Command Centre",
  "market-scan": "Scanner",
  "opportunity-review": "Opportunity Pipeline",
  research: "Trading Research",
  "trade-planning": "Trading Research",
  "decision-risk-review": "Decision Workflow",
  "execution-preparation": "Execution Lifecycle Manager",
  execution: "Trade Execution Center",
  "position-monitoring": "Execution Lifecycle Manager",
  "trade-journal": "Trading Journal",
  "daily-review": "Daily Report",
};

const BASE_PATHS: Record<DailyWorkflowStepId, string> = {
  "morning-brief": "/",
  "market-scan": "/scanner",
  "opportunity-review": "/opportunity-pipeline",
  research: "/trading-research",
  "trade-planning": "/trading-research",
  "decision-risk-review": "/decision-workflow",
  "execution-preparation": "/execution-lifecycle",
  execution: "/trade-execution-center",
  "position-monitoring": "/execution-lifecycle",
  "trade-journal": "/trading-journal",
  "daily-review": "/daily-report",
};

/** Steps whose destination page honestly supports a ?planId= deep link. */
const PLAN_ID_AWARE_STEPS: ReadonlySet<DailyWorkflowStepId> = new Set([
  "decision-risk-review",
  "execution-preparation",
  "position-monitoring",
]);

export function resolveWorkflowNavigationTarget(
  stepId: DailyWorkflowStepId,
  activeTradePlanId: number | null,
): WorkflowNavigationTarget {
  const path = BASE_PATHS[stepId];
  const destinationLabel = DESTINATION_LABELS[stepId];
  const href =
    PLAN_ID_AWARE_STEPS.has(stepId) && activeTradePlanId != null ? `${path}?planId=${activeTradePlanId}` : path;
  return { path, href, destinationLabel };
}

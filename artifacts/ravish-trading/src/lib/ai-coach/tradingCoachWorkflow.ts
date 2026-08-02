// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. The Daily Workflow
// Engine's own pure-logic core.
//
// This module computes NOTHING that isn't already real, already-fetched
// data from an existing engine. It never calls a hook, never fetches, and
// never fabricates a completion signal the underlying data doesn't
// actually support — per the sprint's explicit "do not claim the AI has
// analysed information that is unavailable" requirement. Every field on
// `WorkflowSignals` below is a narrow, structurally-typed subset of a
// return shape from an already-shipped hook (found via this sprint's own
// mandatory reuse audit):
//
//   marketClock        <- GET /ai-trading-coach/state's own marketClock
//                          (lib/marketCalendar.ts's getMarketClockStatus(),
//                          reused verbatim server-side)
//   scanner            <- useGetScannerResults() (Scanner.tsx)
//   opportunityPipeline<- useOpportunityPipeline() (OpportunityPipeline.tsx)
//   activeDecision     <- useActiveDecisionSummary() (lib/useDecisionWorkflow.ts)
//   tradeLifecycle     <- useTradeLifecyclePipeline() (lib/useTradeLifecycle.ts)
//   journal            <- useListTradingJournalEntries() (TradingJournal.tsx)
//
// The one genuinely new thing this sprint introduces is the 11-step
// sequence/status vocabulary itself — a deliberate 6th "steps with
// states" model in this codebase (alongside WorkflowTaskStatus,
// PlaybookStageStatus, StageCompletionStatus, PipelineStageId, and
// TradePlanStatus, none of which fit a whole-trading-day guided sequence)
// — never a duplicate of, or a replacement for, the existing Workflow
// Automation Engine (lib/workflowAutomation.ts), which tracks a
// different, longer-horizon set of platform-wide tasks.

export type DailyWorkflowStepId =
  | "morning-brief"
  | "market-scan"
  | "opportunity-review"
  | "research"
  | "trade-planning"
  | "decision-risk-review"
  | "execution-preparation"
  | "execution"
  | "position-monitoring"
  | "trade-journal"
  | "daily-review";

export const DAILY_WORKFLOW_STEP_ORDER: DailyWorkflowStepId[] = [
  "morning-brief",
  "market-scan",
  "opportunity-review",
  "research",
  "trade-planning",
  "decision-risk-review",
  "execution-preparation",
  "execution",
  "position-monitoring",
  "trade-journal",
  "daily-review",
];

export const DAILY_WORKFLOW_STEP_LABELS: Record<DailyWorkflowStepId, string> = {
  "morning-brief": "Morning Brief",
  "market-scan": "Market Scan",
  "opportunity-review": "Opportunity Review",
  research: "Research",
  "trade-planning": "Trade Planning",
  "decision-risk-review": "Decision & Risk Review",
  "execution-preparation": "Execution Preparation",
  execution: "Execution",
  "position-monitoring": "Position Monitoring",
  "trade-journal": "Trade Journal",
  "daily-review": "Daily Review",
};

/** Roughly how long each step tends to take — shown as "Estimated Time", never a promise. */
export const DAILY_WORKFLOW_STEP_ESTIMATED_MINUTES: Record<DailyWorkflowStepId, number> = {
  "morning-brief": 3,
  "market-scan": 5,
  "opportunity-review": 5,
  research: 10,
  "trade-planning": 10,
  "decision-risk-review": 5,
  "execution-preparation": 3,
  execution: 5,
  "position-monitoring": 5,
  "trade-journal": 5,
  "daily-review": 5,
};

export type DailyWorkflowStepStatus =
  | "not-started"
  | "ready"
  | "active"
  | "completed"
  | "blocked"
  | "skipped"
  | "not-applicable";

// ─── Inputs (structural subsets of real, already-fetched hook data) ──────

export interface WorkflowMarketClockSignal {
  isOpen: boolean;
}

export interface WorkflowScannerSignal {
  hasResultsToday: boolean;
}

export interface WorkflowOpportunityPipelineSignal {
  hasCapturedItems: boolean;
}

export interface WorkflowActiveDecisionSignal {
  tradePlanId: number | null;
  tradePlanStatus: "draft" | "ready" | "watching" | "executed" | "cancelled" | "archived" | null;
  /** DecisionScore.label, read verbatim — never re-derived. */
  scoreLabel: "Well-Prepared" | "Developing" | "Early Stage" | "Just Started" | null;
}

export interface WorkflowLifecycleRecordSignal {
  currentStage:
    | "ideas"
    | "research"
    | "planning"
    | "decision-ready"
    | "ready-to-execute"
    | "open-position"
    | "managing"
    | "closed"
    | "journal-pending"
    | "reviewed"
    | "archived";
  journalState: "not-yet-applicable" | "missing" | "pending-reflection" | "reviewed";
  outstandingTaskCount: number;
}

export interface WorkflowJournalSignal {
  hasEntryToday: boolean;
}

export interface WorkflowSignals {
  marketClock: WorkflowMarketClockSignal | null;
  scanner: WorkflowScannerSignal;
  opportunityPipeline: WorkflowOpportunityPipelineSignal;
  activeDecision: WorkflowActiveDecisionSignal;
  lifecycleRecords: WorkflowLifecycleRecordSignal[];
  journal: WorkflowJournalSignal;
}

/** The persisted, per-trading-day slice (ai_trading_coach_daily_state). */
export interface WorkflowDailyProgress {
  completedStepIds: DailyWorkflowStepId[];
  skippedStepIds: DailyWorkflowStepId[];
  noTradeReason: string | null;
}

export interface DailyWorkflowStep {
  id: DailyWorkflowStepId;
  label: string;
  status: DailyWorkflowStepStatus;
  estimatedMinutes: number;
  /** Why this step is currently blocked, when status === "blocked". Never fabricated. */
  blockedReason: string | null;
}

export interface DailyWorkflowResult {
  steps: DailyWorkflowStep[];
  /** The one step the coach should recommend right now, or null when every applicable step is done. */
  primaryNextStepId: DailyWorkflowStepId | null;
  /** Real reason the primary step was chosen — used for the "Why" answer, never fabricated. */
  primaryReason: string;
  /** Steps counted as "applicable" today (excludes not-applicable) — the denominator for progress %. */
  applicableStepIds: DailyWorkflowStepId[];
  completedApplicableCount: number;
  completionPct: number;
  isDoneForToday: boolean;
}

const OPEN_POSITION_STAGES = new Set(["open-position", "managing"]);

function hasOpenPositionNeedingMonitoring(signals: WorkflowSignals): boolean {
  return signals.lifecycleRecords.some((r) => OPEN_POSITION_STAGES.has(r.currentStage));
}

function hasClosedTradeAwaitingJournal(signals: WorkflowSignals): boolean {
  return signals.lifecycleRecords.some((r) => r.currentStage === "closed" && r.journalState !== "reviewed" && r.journalState !== "not-yet-applicable");
}

function hasActiveTradePlanInProgress(signals: WorkflowSignals): boolean {
  const status = signals.activeDecision.tradePlanStatus;
  return status === "draft" || status === "ready" || status === "watching";
}

/**
 * Real, disclosed auto-detection: returns "completed" when an existing
 * module's own already-computed data unambiguously shows the step is
 * done, or null when there is no such signal (the step then falls back to
 * persisted/manual completion). Never guesses.
 */
function autoDetectedStatus(stepId: DailyWorkflowStepId, signals: WorkflowSignals): "completed" | null {
  switch (stepId) {
    case "market-scan":
      return signals.scanner.hasResultsToday ? "completed" : null;
    case "opportunity-review":
      return signals.opportunityPipeline.hasCapturedItems ? "completed" : null;
    case "trade-planning":
      return hasActiveTradePlanInProgress(signals) || signals.activeDecision.tradePlanStatus === "executed"
        ? "completed"
        : null;
    case "decision-risk-review":
      return signals.activeDecision.scoreLabel === "Well-Prepared" ? "completed" : null;
    case "execution-preparation":
      return signals.lifecycleRecords.some((r) => r.currentStage === "ready-to-execute" && r.outstandingTaskCount === 0)
        ? "completed"
        : null;
    case "execution":
      return hasOpenPositionNeedingMonitoring(signals) ? "completed" : null;
    case "position-monitoring":
      // Complete for today once nothing is left open (never claims "monitored" while a position is still open).
      return !hasOpenPositionNeedingMonitoring(signals) && signals.lifecycleRecords.length > 0 ? "completed" : null;
    case "trade-journal":
      return signals.journal.hasEntryToday ? "completed" : null;
    default:
      return null;
  }
}

/**
 * Steps that are genuinely not relevant today, per an honest, existing
 * signal — never a fabricated "skip". A market-closed day with no open
 * position and no trade plan in progress makes the whole new-trade
 * pipeline (scan through execution) not-applicable for today; an explicit
 * noTradeReason does the same. "No Trade" is a valid professional
 * outcome — this never blocks progress, it accurately relabels it.
 */
function isNotApplicableToday(
  stepId: DailyWorkflowStepId,
  signals: WorkflowSignals,
  progress: WorkflowDailyProgress,
): boolean {
  const NEW_TRADE_PIPELINE: DailyWorkflowStepId[] = [
    "market-scan",
    "opportunity-review",
    "research",
    "trade-planning",
    "decision-risk-review",
    "execution-preparation",
    "execution",
  ];
  if (!NEW_TRADE_PIPELINE.includes(stepId)) return false;

  const declaredNoTrade = progress.noTradeReason != null;
  const marketClosed = signals.marketClock != null && !signals.marketClock.isOpen;
  const nothingInProgress = !hasActiveTradePlanInProgress(signals) && !signals.scanner.hasResultsToday;

  return declaredNoTrade || (marketClosed && nothingInProgress);
}

function stepBlockedReason(stepId: DailyWorkflowStepId, signals: WorkflowSignals): string | null {
  if (stepId === "execution" && signals.marketClock != null && !signals.marketClock.isOpen) {
    return "Market is closed — execution is unavailable until the market reopens.";
  }
  return null;
}

export function computeDailyWorkflow(signals: WorkflowSignals, progress: WorkflowDailyProgress): DailyWorkflowResult {
  const completed = new Set(progress.completedStepIds);
  const skipped = new Set(progress.skippedStepIds);

  const steps: DailyWorkflowStep[] = DAILY_WORKFLOW_STEP_ORDER.map((id) => {
    const estimatedMinutes = DAILY_WORKFLOW_STEP_ESTIMATED_MINUTES[id];
    const label = DAILY_WORKFLOW_STEP_LABELS[id];

    if (skipped.has(id)) return { id, label, status: "skipped", estimatedMinutes, blockedReason: null };
    if (completed.has(id)) return { id, label, status: "completed", estimatedMinutes, blockedReason: null };
    if (isNotApplicableToday(id, signals, progress)) {
      return { id, label, status: "not-applicable", estimatedMinutes, blockedReason: null };
    }
    const auto = autoDetectedStatus(id, signals);
    if (auto === "completed") return { id, label, status: "completed", estimatedMinutes, blockedReason: null };

    const blockedReason = stepBlockedReason(id, signals);
    return { id, label, status: blockedReason ? "blocked" : "not-started", estimatedMinutes, blockedReason };
  });

  const isDone = (s: DailyWorkflowStep) => s.status === "completed" || s.status === "skipped" || s.status === "not-applicable";

  // Position Monitoring and Trade Journal can jump the queue: an existing
  // open position or a closed trade with no journal entry is real,
  // present-day work that should never wait behind a fresh new-trade
  // search the user hasn't started (and may not need to).
  let primaryStepId: DailyWorkflowStepId | null = null;
  let primaryReason = "";

  const positionMonitoringStep = steps.find((s) => s.id === "position-monitoring")!;
  const tradeJournalStep = steps.find((s) => s.id === "trade-journal")!;

  if (!isDone(positionMonitoringStep) && hasOpenPositionNeedingMonitoring(signals)) {
    primaryStepId = "position-monitoring";
    primaryReason = "You have an open position that needs to be monitored today.";
  } else if (!isDone(tradeJournalStep) && hasClosedTradeAwaitingJournal(signals)) {
    primaryStepId = "trade-journal";
    primaryReason = "A closed trade is still waiting on a journal reflection.";
  } else {
    for (const step of steps) {
      if (!isDone(step)) {
        primaryStepId = step.id;
        primaryReason = step.blockedReason ?? `The next step in today's sequence is ${step.label}.`;
        break;
      }
    }
  }

  const finalSteps = steps.map((s) => {
    if (s.id === primaryStepId) {
      return { ...s, status: (s.status === "blocked" ? "blocked" : "active") as DailyWorkflowStepStatus };
    }
    return s;
  });

  // The single step immediately after the active one, in sequence, becomes "ready" (it's
  // unblocked and will be next) — purely a display/sequencing signal, never a fabricated
  // completion. Every step further out stays "not-started". Exactly one step is ever "active".
  if (primaryStepId) {
    const primaryIndex = finalSteps.findIndex((s) => s.id === primaryStepId);
    const next = finalSteps[primaryIndex + 1];
    if (next && next.status === "not-started") {
      finalSteps[primaryIndex + 1] = { ...next, status: "ready" };
    }
  }

  const applicableStepIds = finalSteps.filter((s) => s.status !== "not-applicable").map((s) => s.id);
  const completedApplicableCount = finalSteps.filter((s) => s.status === "completed" || s.status === "skipped").length;
  const completionPct =
    applicableStepIds.length === 0 ? 0 : Math.round((completedApplicableCount / applicableStepIds.length) * 100);

  const isDoneForToday = primaryStepId === null;
  if (isDoneForToday) {
    primaryReason = "Every applicable step for today is complete. Nice work.";
  }

  return {
    steps: finalSteps,
    primaryNextStepId: primaryStepId,
    primaryReason,
    applicableStepIds,
    completedApplicableCount,
    completionPct,
    isDoneForToday,
  };
}

// ─── Achievements ──────────────────────────────────────────────────────
//
// The first achievement/milestone/competency system found anywhere in
// this codebase (confirmed by direct audit — none existed before this
// sprint). Rewards disciplined PROCESS, never trade count, risk-taking,
// execution frequency, or platform engagement — per the sprint's explicit
// requirement. Every achievement is derived from real, already-available
// signals (daily-state history + lifecycle records), never fabricated.

export type AchievementId =
  | "first-market-scan"
  | "first-research-review"
  | "first-trade-plan"
  | "first-journal-entry"
  | "ten-trades-journaled"
  | "hundred-trades-journaled"
  | "twenty-daily-checklists"
  | "thirty-days-no-unplanned-trade"
  | "consistent-journal-completion"
  | "complete-risk-review-streak";

export interface AchievementDefinition {
  id: AchievementId;
  label: string;
  description: string;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { id: "first-market-scan", label: "First Market Scan", description: "Ran your first market scan." },
  { id: "first-research-review", label: "First Research Review", description: "Completed your first Research step." },
  { id: "first-trade-plan", label: "First Completed Trade Plan", description: "Brought a trade plan to Ready." },
  { id: "first-journal-entry", label: "First Journal Entry", description: "Wrote your first trade journal reflection." },
  { id: "ten-trades-journaled", label: "Ten Trades Reviewed", description: "Journaled 10 closed trades." },
  { id: "hundred-trades-journaled", label: "Hundred Trades Reviewed", description: "Journaled 100 closed trades." },
  {
    id: "twenty-daily-checklists",
    label: "Twenty Completed Daily Checklists",
    description: "Completed 20 full daily workflows.",
  },
  {
    id: "thirty-days-no-unplanned-trade",
    label: "Thirty Days Without an Unplanned Trade",
    description: "30 consecutive trading days with every executed trade backed by a completed decision review.",
  },
  {
    id: "consistent-journal-completion",
    label: "Consistent Journal Completion",
    description: "Journaled every closed trade for 10 consecutive trading days.",
  },
  {
    id: "complete-risk-review-streak",
    label: "Complete Risk Review Streak",
    description: "Completed Decision & Risk Review before every execution for 10 consecutive trading days.",
  },
];

export interface AchievementProgressInputs {
  totalMarketScansRun: number;
  totalResearchStepsCompleted: number;
  totalTradePlansReadied: number;
  totalJournalEntries: number;
  totalCompletedDailyChecklists: number;
  /** Consecutive trading days ending today where every executed trade had a completed decision review. */
  consecutiveDisciplinedDays: number;
  /** Consecutive trading days ending today where every closed trade was journaled. */
  consecutiveJournaledDays: number;
}

export interface AchievementStatus extends AchievementDefinition {
  earned: boolean;
}

export function computeAchievements(inputs: AchievementProgressInputs): AchievementStatus[] {
  const earned: Record<AchievementId, boolean> = {
    "first-market-scan": inputs.totalMarketScansRun >= 1,
    "first-research-review": inputs.totalResearchStepsCompleted >= 1,
    "first-trade-plan": inputs.totalTradePlansReadied >= 1,
    "first-journal-entry": inputs.totalJournalEntries >= 1,
    "ten-trades-journaled": inputs.totalJournalEntries >= 10,
    "hundred-trades-journaled": inputs.totalJournalEntries >= 100,
    "twenty-daily-checklists": inputs.totalCompletedDailyChecklists >= 20,
    "thirty-days-no-unplanned-trade": inputs.consecutiveDisciplinedDays >= 30,
    "consistent-journal-completion": inputs.consecutiveJournaledDays >= 10,
    "complete-risk-review-streak": inputs.consecutiveDisciplinedDays >= 10,
  };
  return ACHIEVEMENT_DEFINITIONS.map((def) => ({ ...def, earned: earned[def.id] }));
}

// v1.5.0, Sprint 16 — Institutional Workflow Automation Engine.
//
// NOT an automation platform. NOT auto-trading. This module connects
// modules already built in Sprints 8-15 (and Phase 15/16's own AI Coach
// infrastructure) into one unified Task list — it introduces ZERO new
// scoring formulas, valuation models, or risk calculations. Every task
// below is a re-framing of an already-computed signal from an existing
// module into one consistent {status, originatingModule, trigger, reason,
// suggestedOutcome} shape. It NEVER places a trade, executes a broker
// action, or performs a hidden automation — every recommendation is a
// link plus an explanation; nothing here mutates any entity on its own.
//
// ─── REUSE MAP (see docs/v1.5.0-Sprint-16-Workflow-Automation-Engine.md
// for the full narrative version) ───────────────────────────────────────
//   Notebook/Strategy/Trade Plan lists  -> ai-coach/notebooksApi.ts,
//     strategiesApi.ts, tradePlansApi.ts (Sprints 7-10) — same list
//     functions useWorkflowSnapshot.ts (Sprint 12) already calls.
//   Trade-plan lifecycle stage/outstanding tasks/blocked reasons
//     -> lib/tradeLifecycle.ts's own computeTradeLifecycle() output,
//        consumed via useTradeLifecyclePipeline() (Sprint 14) — this
//        module reads currentStage/outstandingTasks/blockedReasons
//        directly, never re-deriving stage logic of its own.
//   Portfolio health/risk signals -> lib/portfolioRiskIntelligence.ts's
//     own PortfolioHealthScore/RiskIntelligenceReport (Sprint 15), via
//     usePortfolioRiskIntelligence().
//   Learning-lesson recommendations -> decisionWorkflow.ts's
//     DECISION_LEARNING_RECOMMENDATIONS, tradeLifecycle.ts's
//     LIFECYCLE_LEARNING_RECOMMENDATIONS, portfolioRiskIntelligence.ts's
//     PORTFOLIO_LEARNING_RECOMMENDATIONS — all 3 already-existing,
//     pre-verified tables, never a 4th duplicate.
//   AI Coach -> components/learn/AskCoachLauncher.tsx (Sprint L1) — the
//     one real AI Coach panel; this module's own narrative is a
//     deterministic template, mirroring buildDecisionCoachNarrative()/
//     buildPortfolioCoachNarrative()'s exact established pattern.
//   Notifications -> the platform's real platform_notifications table/
//     NotificationBell (Phase 4 Sprint 56) is reused, not duplicated —
//     see lib/workflowReminders.ts (backend) for the one small, new,
//     additive evaluator this sprint adds to that existing pipeline.
//
// Two of the sprint's own named automation arrows — "Journal completed ->
// Update Performance" and "Performance updated -> Refresh Portfolio
// Intelligence" — are honestly NOT modeled as dismissible tasks here: both
// Performance (Trade Performance/Performance Analytics pages) and
// Portfolio Intelligence (Sprint 15) are already live-computed on every
// page load from the platform's own real trades/positions data — there is
// no manual "update"/"refresh" step anywhere in this codebase for either,
// so inventing a task for a step that doesn't exist would itself be a
// fabrication. AUTOMATIC_CONNECTIONS below documents this transparently
// instead of silently omitting it.

import type { CoachId } from "./ai-coach/capabilityRegistry";
import type { AiNotebook } from "./ai-coach/notebooksApi";
import type { AiStrategy } from "./ai-coach/strategiesApi";
import type { TradeLifecycleRecord } from "./tradeLifecycle";
import type { PortfolioHealthScore, RiskIntelligenceReport, HealthFactor } from "./portfolioRiskIntelligence";
import { PORTFOLIO_LEARNING_RECOMMENDATIONS } from "./portfolioRiskIntelligence";

// ─── Task shape ──────────────────────────────────────────────────────────

export type WorkflowTaskStatus = "pending" | "in-progress" | "waiting" | "completed" | "dismissed";

export type WorkflowAutomationId =
  | "research-to-notebook"
  | "notebook-to-strategy"
  | "strategy-to-tradeplan"
  | "tradeplan-to-decision"
  | "decision-to-execution"
  | "trade-closed-to-journal"
  | "portfolio-risk-to-review"
  | "learning-weakness-to-practice";

export interface WorkflowLessonLink {
  pathKey: string;
  topicKey: string;
  label: string;
}

/** Every field the approved scope's own "Workflow Rules" section requires
 * be transparent: trigger, source module, reason, suggested outcome — a
 * task is never rendered without all four. */
export interface WorkflowTask {
  id: string;
  automation: WorkflowAutomationId;
  title: string;
  status: WorkflowTaskStatus;
  originatingModule: string;
  trigger: string;
  reason: string;
  suggestedOutcome: string;
  actionHref: string;
  actionLabel: string;
  relatedLesson: WorkflowLessonLink | null;
  /** ISO timestamp of the underlying entity's own last update, when known
   * — used only to bound how long a "completed" task stays visible (see
   * RECENTLY_COMPLETED_WINDOW_DAYS below), never displayed as a fabricated
   * "automation ran at" timestamp — nothing here runs on a schedule. */
  updatedAt: string | null;
}

export interface AutomaticConnection {
  trigger: string;
  outcome: string;
  reason: string;
}

export const AUTOMATIC_CONNECTIONS: AutomaticConnection[] = [
  {
    trigger: "Journal entry completed for a closed trade",
    outcome: "Performance figures already reflect it",
    reason: "Trade Performance/Performance Analytics are computed live from your own trades on every page load — there is no manual 'update' step to automate.",
  },
  {
    trigger: "Performance recalculated",
    outcome: "Portfolio & Risk Intelligence already reflects it",
    reason: "The Portfolio Health Score and Risk Intelligence report (Sprint 15) are likewise computed live from current data on every page load — there is no manual 'refresh' step to automate.",
  },
];

// Bounded so "Recently completed actions" reads as a real, recent log,
// never an unbounded permanent history this module was never built to
// persist.
const RECENTLY_COMPLETED_WINDOW_DAYS = 7;

function withinRecentWindow(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= RECENTLY_COMPLETED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function coachLabel(coachId: CoachId): string {
  if (coachId === "trading") return "Trading";
  if (coachId === "options") return "Options Income";
  return "Investing";
}

// ─── Input ───────────────────────────────────────────────────────────────

export interface WorkflowAutomationInput {
  notebooksByCoach: Partial<Record<CoachId, AiNotebook[]>>;
  strategiesByCoach: Partial<Record<CoachId, AiStrategy[]>>;
  lifecycleRecords: TradeLifecycleRecord[];
  portfolioHealth: PortfolioHealthScore | null;
  portfolioRisk: RiskIntelligenceReport | null;
  weakestPortfolioFactor: HealthFactor | null;
}

const COACH_IDS: CoachId[] = ["investing", "trading", "options"];

// ─── 1. Research -> Notebook ─────────────────────────────────────────────
// No "research completed" event exists anywhere in this codebase —
// browsing a research page (Value Research/Trading Research/Options) is
// never logged. Disclosed simplification: this is a standing starter
// recommendation, shown only while the user has zero notebooks across
// every engine, not a literal event-triggered task.

function researchToNotebookTasks(input: WorkflowAutomationInput): WorkflowTask[] {
  const totalNotebooks = COACH_IDS.reduce((sum, c) => sum + (input.notebooksByCoach[c]?.length ?? 0), 0);
  if (totalNotebooks > 0) return [];
  return [
    {
      id: "research-to-notebook:starter",
      automation: "research-to-notebook",
      title: "Capture your research in a Notebook",
      status: "pending",
      originatingModule: "Research",
      trigger: "No research notebooks exist yet in any engine.",
      reason: "A Notebook is where research evidence, references, and findings accumulate before a Strategy or Trade Plan is built on top of them — without one, research context tends to live only in memory.",
      suggestedOutcome: "Create your first Notebook to start capturing research.",
      actionHref: "/assistant",
      actionLabel: "Open AI Assistant",
      relatedLesson: null,
      updatedAt: null,
    },
  ];
}

// ─── 2. Notebook -> Strategy ──────────────────────────────────────────────

function notebookToStrategyTasks(input: WorkflowAutomationInput): WorkflowTask[] {
  const tasks: WorkflowTask[] = [];
  for (const coachId of COACH_IDS) {
    const notebooks = input.notebooksByCoach[coachId] ?? [];
    const strategies = (input.strategiesByCoach[coachId] ?? []).filter((s) => !s.archived);
    if (notebooks.length === 0 || strategies.length > 0) continue;
    tasks.push({
      id: `notebook-to-strategy:${coachId}`,
      automation: "notebook-to-strategy",
      title: `Turn your ${coachLabel(coachId)} research into a Strategy`,
      status: "pending",
      originatingModule: `Notebook (${coachLabel(coachId)})`,
      trigger: `${notebooks.length} notebook${notebooks.length === 1 ? "" : "s"} exist for ${coachLabel(coachId)}, but no Strategy has been created yet.`,
      reason: "Research without a defined Strategy has no repeatable rule set to evaluate future trade ideas against.",
      suggestedOutcome: `Create a ${coachLabel(coachId)} Strategy from your research.`,
      actionHref: "/assistant",
      actionLabel: "Open AI Assistant",
      relatedLesson: null,
      updatedAt: null,
    });
  }
  return tasks;
}

// ─── 3. Strategy -> Trade Plan ────────────────────────────────────────────

function strategyToTradePlanTasks(input: WorkflowAutomationInput): WorkflowTask[] {
  const tasks: WorkflowTask[] = [];
  const linkedStrategyIds = new Set(
    input.lifecycleRecords.map((r) => r.tradePlan.strategyId).filter((id): id is number => id !== null),
  );
  for (const coachId of COACH_IDS) {
    const approved = (input.strategiesByCoach[coachId] ?? []).filter((s) => s.status === "active");
    for (const strategy of approved) {
      const hasTradePlan = linkedStrategyIds.has(strategy.id);
      const recentlyLinked = input.lifecycleRecords.some((r) => r.tradePlan.strategyId === strategy.id && withinRecentWindow(r.tradePlan.updatedAt));
      if (hasTradePlan && !recentlyLinked) continue;
      tasks.push({
        id: `strategy-to-tradeplan:${strategy.id}`,
        automation: "strategy-to-tradeplan",
        title: `Build a Trade Plan from "${strategy.title}"`,
        status: hasTradePlan ? "completed" : "pending",
        originatingModule: `Strategy (${coachLabel(coachId)})`,
        trigger: hasTradePlan ? `A Trade Plan referencing "${strategy.title}" was created recently.` : `"${strategy.title}" is an approved (active) Strategy with no Trade Plan built from it yet.`,
        reason: "An approved Strategy with no Trade Plan is a rule set that hasn't yet been applied to a real opportunity.",
        suggestedOutcome: hasTradePlan ? "Already actioned — no further step needed." : `Create a Trade Plan using the "${strategy.title}" Strategy.`,
        actionHref: "/assistant",
        actionLabel: "Open AI Assistant",
        relatedLesson: null,
        updatedAt: hasTradePlan ? (input.lifecycleRecords.find((r) => r.tradePlan.strategyId === strategy.id)?.tradePlan.updatedAt ?? null) : null,
      });
    }
  }
  return tasks;
}

// ─── 4. Trade Plan -> Decision Engine ─────────────────────────────────────
// Reuses TradeLifecycleRecord.currentStage directly — zero new readiness
// math. "waiting" is used specifically for decision-ready, where the ONLY
// remaining blocker is a named, already-computed set of checklist items
// (outstandingTasks) — a genuine "blocked on a known precondition" state,
// distinct from research/planning's own "actively developing."

function tradePlanToDecisionTasks(input: WorkflowAutomationInput): WorkflowTask[] {
  const tasks: WorkflowTask[] = [];
  for (const r of input.lifecycleRecords) {
    if (r.currentStage === "archived") continue;
    let status: WorkflowTaskStatus | null = null;
    if (r.currentStage === "ideas") status = "pending";
    else if (r.currentStage === "research" || r.currentStage === "planning") status = "in-progress";
    else if (r.currentStage === "decision-ready") status = "waiting";
    if (status === null) continue;
    tasks.push({
      id: `tradeplan-to-decision:${r.tradePlan.id}`,
      automation: "tradeplan-to-decision",
      title: `Advance "${r.tradePlan.title}" toward a decision`,
      status,
      originatingModule: `Trade Plan (${coachLabel(r.tradePlan.coachId)})`,
      trigger: `"${r.tradePlan.title}" is currently at the "${r.currentStage}" stage of the Execution & Lifecycle pipeline.`,
      reason: "The Institutional Decision Engine scores readiness continuously — the sooner evidence gaps are closed, the sooner a plan can be objectively evaluated as Ready to Execute.",
      suggestedOutcome: r.outstandingTasks[0] ?? "Review this plan's Decision Workflow readiness.",
      actionHref: `/decision-workflow?planId=${r.tradePlan.id}`,
      actionLabel: "Open Decision Workflow",
      relatedLesson: null,
      updatedAt: r.tradePlan.updatedAt,
    });
  }
  return tasks;
}

// ─── 5. Decision Approved -> Prepare Execution Package ────────────────────

function decisionToExecutionTasks(input: WorkflowAutomationInput): WorkflowTask[] {
  const tasks: WorkflowTask[] = [];
  for (const r of input.lifecycleRecords) {
    if (r.currentStage === "ready-to-execute") {
      tasks.push({
        id: `decision-to-execution:${r.tradePlan.id}`,
        automation: "decision-to-execution",
        title: `Execution package ready for "${r.tradePlan.title}"`,
        status: "pending",
        originatingModule: `Trade Plan (${coachLabel(r.tradePlan.coachId)})`,
        trigger: `"${r.tradePlan.title}" reached a "Well-Prepared" decision score with its checklist complete.`,
        reason: "A written execution package is the last honest check against a plan before real money moves at your own external broker.",
        suggestedOutcome: "Review the generated Execution Package before acting.",
        actionHref: "/execution-lifecycle",
        actionLabel: "Open Execution & Lifecycle Manager",
        relatedLesson: null,
        updatedAt: r.tradePlan.updatedAt,
      });
    } else if (["open-position", "managing", "closed", "journal-pending", "reviewed"].includes(r.currentStage) && withinRecentWindow(r.tradePlan.updatedAt)) {
      tasks.push({
        id: `decision-to-execution:${r.tradePlan.id}`,
        automation: "decision-to-execution",
        title: `Execution package prepared for "${r.tradePlan.title}"`,
        status: "completed",
        originatingModule: `Trade Plan (${coachLabel(r.tradePlan.coachId)})`,
        trigger: `"${r.tradePlan.title}" was executed at your own external broker.`,
        reason: "The plan has already advanced past the execution-preparation stage.",
        suggestedOutcome: "Already actioned — no further step needed.",
        actionHref: "/execution-lifecycle",
        actionLabel: "Open Execution & Lifecycle Manager",
        relatedLesson: null,
        updatedAt: r.tradePlan.updatedAt,
      });
    }
  }
  return tasks;
}

// ─── 6. Trade Closed -> Journal ────────────────────────────────────────────

function tradeClosedToJournalTasks(input: WorkflowAutomationInput): WorkflowTask[] {
  const tasks: WorkflowTask[] = [];
  for (const r of input.lifecycleRecords) {
    if (r.currentStage === "closed") {
      tasks.push({
        id: `trade-closed-to-journal:${r.tradePlan.id}`,
        automation: "trade-closed-to-journal",
        title: `Journal "${r.tradePlan.title}"`,
        status: "pending",
        originatingModule: `Trade Plan (${coachLabel(r.tradePlan.coachId)})`,
        trigger: `"${r.tradePlan.title}" closed with no journal entry yet.`,
        reason: "A trade journaled while the reasoning is still fresh captures real decision quality; journaled days later, it's reconstructed from memory.",
        suggestedOutcome: "Log this trade in the Trade Journal.",
        actionHref: "/trading-journal",
        actionLabel: "Open Trading Journal",
        relatedLesson: r.learning.recommendedPathKey && r.learning.recommendedTopicKey ? { pathKey: r.learning.recommendedPathKey, topicKey: r.learning.recommendedTopicKey, label: r.learning.recommendedLabel ?? "Recommended lesson" } : null,
        updatedAt: r.tradePlan.updatedAt,
      });
    } else if (r.currentStage === "journal-pending") {
      tasks.push({
        id: `trade-closed-to-journal:${r.tradePlan.id}`,
        automation: "trade-closed-to-journal",
        title: `Complete the journal review for "${r.tradePlan.title}"`,
        status: "in-progress",
        originatingModule: `Trade Plan (${coachLabel(r.tradePlan.coachId)})`,
        trigger: `A journal entry exists for "${r.tradePlan.title}", but no lesson learned has been recorded yet.`,
        reason: "The lesson-learned field is what turns a log entry into an actual review — without it, nothing was learned, only recorded.",
        suggestedOutcome: "Add a lesson learned to complete this trade's review.",
        actionHref: "/trading-journal",
        actionLabel: "Open Trading Journal",
        relatedLesson: r.learning.recommendedPathKey && r.learning.recommendedTopicKey ? { pathKey: r.learning.recommendedPathKey, topicKey: r.learning.recommendedTopicKey, label: r.learning.recommendedLabel ?? "Recommended lesson" } : null,
        updatedAt: r.tradePlan.updatedAt,
      });
    } else if (r.currentStage === "reviewed" && withinRecentWindow(r.tradePlan.updatedAt)) {
      tasks.push({
        id: `trade-closed-to-journal:${r.tradePlan.id}`,
        automation: "trade-closed-to-journal",
        title: `Journal completed for "${r.tradePlan.title}"`,
        status: "completed",
        originatingModule: `Trade Plan (${coachLabel(r.tradePlan.coachId)})`,
        trigger: `"${r.tradePlan.title}" was reviewed with a lesson learned recorded.`,
        reason: "This trade's review is complete.",
        suggestedOutcome: "Already actioned — no further step needed.",
        actionHref: "/trading-journal",
        actionLabel: "Open Trading Journal",
        relatedLesson: null,
        updatedAt: r.tradePlan.updatedAt,
      });
    }
  }
  return tasks;
}

// ─── 7. Portfolio Risk Changed -> Recommend Portfolio Review ──────────────
// Reuses Sprint 15's own PortfolioHealthScore/RiskIntelligenceReport
// directly — zero new risk scoring.

function portfolioRiskToReviewTasks(input: WorkflowAutomationInput): WorkflowTask[] {
  const { portfolioHealth, portfolioRisk } = input;
  // A portfolio with zero available factors (a brand-new user with no
  // notebooks/strategies/trade plans/positions anywhere) legitimately
  // scores 0/"Poor" by construction (see computePortfolioHealthScore()'s
  // own honest-zero-when-nothing-available design) — that is NOT a real
  // elevated-risk reading, and recommending a "portfolio review" with
  // nothing to review would be a fabricated alarm. Require at least some
  // real signal (confidenceLevel above "Low") before this automation fires.
  if (!portfolioHealth || portfolioHealth.confidenceLevel === "Low") return [];
  const elevated = portfolioHealth.label === "Elevated Risk" || portfolioHealth.label === "Poor";
  const breachedSignal = portfolioRisk?.signals.find((s) => s.available && (s.code === "open_trade_risk" || s.code === "single_position_risk") && /breach|above|exceed/i.test(s.detail));
  if (!elevated && !breachedSignal) return [];
  return [
    {
      id: "portfolio-risk-to-review:current",
      automation: "portfolio-risk-to-review",
      title: "Review your portfolio risk",
      status: "pending",
      originatingModule: "Portfolio & Risk Intelligence",
      trigger: elevated ? `Portfolio Health Score is "${portfolioHealth.label}" (${portfolioHealth.overall}/100).` : (breachedSignal?.detail ?? "A risk signal reported an elevated reading."),
      reason: "Institutional desks review portfolio health on a fixed cadence, not reactively — an elevated reading is the platform's own cue that this cadence is due now.",
      suggestedOutcome: "Open Portfolio & Risk Intelligence to review the full breakdown.",
      actionHref: "/portfolio-risk-intelligence",
      actionLabel: "Open Portfolio & Risk Intelligence",
      relatedLesson: null,
      updatedAt: null,
    },
  ];
}

// ─── 8. Learning Weakness -> Recommend Practice ───────────────────────────
// Reuses Sprint 15's own weakestAvailableFactor()/PORTFOLIO_LEARNING_
// RECOMMENDATIONS directly — the single aggregation point, since every
// module's own weakest-signal lesson (Decision Workflow, Execution
// Lifecycle) already surfaces on that module's own task above via its
// `relatedLesson` field; this automation covers the portfolio-wide signal
// specifically, which has no other task to attach to.

function learningWeaknessToPracticeTasks(input: WorkflowAutomationInput): WorkflowTask[] {
  const { weakestPortfolioFactor } = input;
  if (!weakestPortfolioFactor || weakestPortfolioFactor.score === null || weakestPortfolioFactor.score >= 45) return [];
  const lesson = PORTFOLIO_LEARNING_RECOMMENDATIONS[weakestPortfolioFactor.code];
  if (!lesson) return [];
  return [
    {
      id: `learning-weakness-to-practice:${weakestPortfolioFactor.code}`,
      automation: "learning-weakness-to-practice",
      title: `Practice: ${lesson.label}`,
      status: "pending",
      originatingModule: "Portfolio & Risk Intelligence — Learning Centre",
      trigger: `${weakestPortfolioFactor.label} scored ${weakestPortfolioFactor.score}/100, your weakest available portfolio factor.`,
      reason: "A recurring weak factor across sessions is a real skill/process gap, not a one-off reading — targeted practice closes it faster than repeated exposure alone.",
      suggestedOutcome: `Review the "${lesson.label}" lesson.`,
      actionHref: `/learn/paths/${lesson.pathKey}`,
      actionLabel: "Open Learning Centre",
      relatedLesson: lesson,
      updatedAt: null,
    },
  ];
}

// ─── Orchestration ─────────────────────────────────────────────────────

export function computeWorkflowTasks(input: WorkflowAutomationInput): WorkflowTask[] {
  return [
    ...researchToNotebookTasks(input),
    ...notebookToStrategyTasks(input),
    ...strategyToTradePlanTasks(input),
    ...tradePlanToDecisionTasks(input),
    ...decisionToExecutionTasks(input),
    ...tradeClosedToJournalTasks(input),
    ...portfolioRiskToReviewTasks(input),
    ...learningWeaknessToPracticeTasks(input),
  ];
}

/** Applies a user's own dismissal choices (persisted client-side, see
 * lib/workflow-dismissals.ts) on top of the freshly-computed task list —
 * a dismissal is scoped to the exact entity id, never the whole automation
 * type, so dismissing today's recommendation for Trade Plan X never
 * silently suppresses a genuinely new, different recommendation for Trade
 * Plan Y later. */
export function applyDismissals(tasks: WorkflowTask[], dismissedIds: Set<string>): WorkflowTask[] {
  return tasks.map((t) => (dismissedIds.has(t.id) ? { ...t, status: "dismissed" as const } : t));
}

// ─── AI Workflow Coach — deterministic narrative over already-computed
// tasks, mirrors buildDecisionCoachNarrative()/buildPortfolioCoachNarrative()'s
// own established pattern exactly. Free-form Q&A still routes through the
// platform's existing AskCoachLauncher — never a second, duplicate AI
// system. ───────────────────────────────────────────────────────────────

export interface WorkflowCoachNarrative {
  summary: string;
  whyItMatters: string;
  ifIgnored: string;
  institutionalBestPractice: string;
  recommendedNextAction: string;
}

export function buildWorkflowCoachNarrative(task: WorkflowTask | null, activeCount: number): WorkflowCoachNarrative {
  if (!task) {
    return {
      summary: activeCount === 0 ? "No workflow recommendations right now — every connected module is caught up." : `${activeCount} workflow recommendation${activeCount === 1 ? "" : "s"} are available.`,
      whyItMatters: "Nothing needs your attention across Research, Strategy, Trade Plans, Decisions, Execution, Journal, or Portfolio Review at the moment.",
      ifIgnored: "Nothing — there is nothing pending to ignore.",
      institutionalBestPractice: "Review your workflow queue on a fixed cadence, the same way institutional desks review open items, rather than only when something breaks.",
      recommendedNextAction: "Check back after your next research session, trade, or portfolio review.",
    };
  }
  return {
    summary: `${task.title} — originating from ${task.originatingModule}.`,
    whyItMatters: task.reason,
    ifIgnored: task.status === "waiting" ? "This item stays blocked until its named precondition is resolved — it will not silently disappear or auto-resolve itself." : "This item will remain visible in your workflow queue until you act on it or dismiss it — nothing here executes on its own.",
    institutionalBestPractice: "Institutional workflows treat a recommendation as a queue item to be resolved or consciously deferred, never silently ignored.",
    recommendedNextAction: task.suggestedOutcome,
  };
}

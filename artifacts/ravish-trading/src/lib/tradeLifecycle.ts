// v1.5.0, Sprint 14 — Institutional Execution & Lifecycle Manager.
//
// PURE COMPOSITION, ZERO NEW SCORING FORMULA OF ITS OWN. This module does
// NOT execute trades and never will — the platform has no order-routing
// feature. It orchestrates the SAME Trade Plan (Sprint 10) and Decision
// Workflow (Sprint 13) data those modules already compute into one
// 11-stage institutional pipeline spanning before AND after a user
// executes manually at their own external broker.
//
// Stage derivation, entirely reused signals, nothing new invented:
//   ideas/research/planning/decision-ready/ready-to-execute
//     -> derived directly from decisionWorkflow.ts's own already-computed
//        DecisionScore.label and TradePlanDetail.checklistProgress.readyForEntry.
//        Zero new confidence math — this module only re-buckets an
//        already-computed label into a coarser pipeline position.
//   open-position/managing/closed/journal-pending/reviewed
//     -> derived from a LinkedExecution (the real trades/trading_positions
//        row the Trade Plan's own loose executedTradeRef points at, Sprint
//        10's own established design) and a real Journal Entry's own
//        lessonLearned field — never a fabricated "reviewed" flag.
//   archived -> TradePlanStatus "archived" (and "cancelled", parked here
//        too — see the `outcome` field below for the honest distinction).
//
// Scope decision, disclosed: "options" and "trading" coachId plans have a
// real, discrete trade/position row with its own open/closed lifecycle
// (trades / trading_positions tables) — the full 11-stage pipeline applies.
// "investing" coachId plans are typically buy-and-hold, with no discrete
// per-trade close event anywhere in this codebase — once executed, an
// investing plan's LinkedExecution is honestly `detailUnavailable: true`
// (never a fabricated open/closed/P&L reading) and the plan simply sits at
// "Open Position" (interpreted as "position tracked") until the user
// manually archives it. See docs/v1.5.0-Sprint-14-Institutional-Execution-Lifecycle.md.

import type { CoachId } from "./ai-coach/capabilityRegistry";
import type { TradePlan, TradePlanDetail } from "./ai-coach/tradePlansApi";
import type { AiStrategyDetail } from "./ai-coach/strategiesApi";
import {
  DECISION_LEARNING_RECOMMENDATIONS,
  type DecisionStage,
  type DecisionScore,
  type LearningContext,
} from "./decisionWorkflow";

// ─── Pipeline stages ─────────────────────────────────────────────────────

export type PipelineStageId =
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

export interface PipelineStageMeta {
  id: PipelineStageId;
  label: string;
  description: string;
}

export const PIPELINE_STAGES: PipelineStageMeta[] = [
  { id: "ideas", label: "Ideas", description: "A new trade plan with nothing documented yet." },
  { id: "research", label: "Research", description: "Market context and early evidence being gathered." },
  { id: "planning", label: "Planning", description: "Thesis, risk, and strategy taking shape." },
  { id: "decision-ready", label: "Decision Ready", description: "Every readiness signal is strong — checklist not yet complete." },
  { id: "ready-to-execute", label: "Ready to Execute", description: "Fully prepared. An execution package can be generated." },
  { id: "open-position", label: "Open Position", description: "Just executed at your own external broker." },
  { id: "managing", label: "Managing", description: "An open position being actively monitored." },
  { id: "closed", label: "Closed", description: "Position closed — not yet logged in the Trade Journal." },
  { id: "journal-pending", label: "Journal Pending", description: "Logged in the Trade Journal — reflection not yet added." },
  { id: "reviewed", label: "Reviewed", description: "Journaled with a lesson learned recorded." },
  { id: "archived", label: "Archived", description: "Closed out of the active pipeline." },
];

const STAGE_INDEX: Record<PipelineStageId, number> = Object.fromEntries(PIPELINE_STAGES.map((s, i) => [s.id, i])) as Record<PipelineStageId, number>;

export type LifecycleOutcome = "active" | "cancelled";

// ─── Linked execution — the real trades/trading_positions row a Trade
// Plan's own executedTradeRef points at, normalized to one small shape so
// the pipeline logic below never has to branch on coachId itself. ────────

export type LinkedExecutionKind = "options-trade" | "trading-position" | "investing-holding";

export interface LinkedExecution {
  kind: LinkedExecutionKind;
  status: "open" | "closed";
  openedAt: string | null;
  closedAt: string | null;
  symbol: string;
  quantity: number | null;
  /** Open risk in dollars. Honestly null when the linked row has no stop/max-loss to compute it from. */
  riskDollars: number | null;
  unrealizedPnl: number | null;
  realizedPnl: number | null;
  /** True when the plan is marked "executed" but no real trades/trading_positions row could be resolved
   * (always true for "investing" plans, since there is no discrete per-trade row for a buy-and-hold
   * position anywhere in this codebase) — never fabricated open/closed/P&L data in this case. */
  detailUnavailable: boolean;
}

// ─── Journal & performance status ───────────────────────────────────────

export type JournalStatusState = "not-yet-applicable" | "missing" | "pending-reflection" | "reviewed";

export interface JournalStatus {
  state: JournalStatusState;
  label: string;
  journalEntryId: number | null;
}

export type PerformanceStatusState = "not-yet-applicable" | "open" | "closed";

export interface PerformanceStatus {
  state: PerformanceStatusState;
  unrealizedPnl: number | null;
  realizedPnl: number | null;
}

// ─── The full lifecycle record for one Trade Plan ───────────────────────

export interface TradeLifecycleRecord {
  tradePlan: TradePlan;
  outcome: LifecycleOutcome;
  currentStage: PipelineStageId;
  previousStage: PipelineStageId | null;
  nextStage: PipelineStageId | null;
  completionPct: number;
  openRisk: number | null;
  timeInTradeDays: number | null;
  outstandingTasks: string[];
  journalStatus: JournalStatus;
  performanceStatus: PerformanceStatus;
  learning: LearningContext;
  linkedExecution: LinkedExecution | null;
  canMarkExecuted: boolean;
  canArchive: boolean;
  blockedReasons: { markExecuted: string | null; archive: string | null };
}

export interface ComputeTradeLifecycleInput {
  tradePlan: TradePlanDetail;
  decisionStages: DecisionStage[];
  decisionScore: DecisionScore;
  linkedExecution: LinkedExecution | null;
  journalEntry: { id: number; lessonLearned: string | null } | null;
  learning: LearningContext;
}

function isEmptyPlan(tradePlan: TradePlanDetail): boolean {
  return tradePlan.sections.length === 0 && tradePlan.checklistItems.length === 0;
}

function buildJournalStatus(linkedExecution: LinkedExecution | null, journalEntry: { id: number; lessonLearned: string | null } | null): JournalStatus {
  if (!linkedExecution || linkedExecution.status !== "closed") {
    return { state: "not-yet-applicable", label: "Not yet applicable — this trade isn't closed.", journalEntryId: null };
  }
  if (!journalEntry) {
    return { state: "missing", label: "No journal entry yet.", journalEntryId: null };
  }
  if (!journalEntry.lessonLearned || journalEntry.lessonLearned.trim() === "") {
    return { state: "pending-reflection", label: "Journal entry created — add a lesson learned to complete review.", journalEntryId: journalEntry.id };
  }
  return { state: "reviewed", label: "Reviewed — lesson learned recorded.", journalEntryId: journalEntry.id };
}

function buildPerformanceStatus(linkedExecution: LinkedExecution | null): PerformanceStatus {
  if (!linkedExecution) return { state: "not-yet-applicable", unrealizedPnl: null, realizedPnl: null };
  if (linkedExecution.status === "open") {
    return { state: "open", unrealizedPnl: linkedExecution.unrealizedPnl, realizedPnl: null };
  }
  return { state: "closed", unrealizedPnl: null, realizedPnl: linkedExecution.realizedPnl };
}

function timeInTradeDays(linkedExecution: LinkedExecution | null): number | null {
  if (!linkedExecution || !linkedExecution.openedAt) return null;
  const opened = new Date(linkedExecution.openedAt).getTime();
  if (Number.isNaN(opened)) return null;
  const end = linkedExecution.closedAt ? new Date(linkedExecution.closedAt).getTime() : Date.now();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.floor((end - opened) / (1000 * 60 * 60 * 24)));
}

// A freshly-opened position (< 1 full day) reads "Open Position"; beyond
// that it becomes "Managing" — an honest bucketing convention on real
// elapsed time, not a fabricated activity signal.
const MANAGING_THRESHOLD_DAYS = 1;

function derivePreExecutionStage(tradePlan: TradePlanDetail, decisionScore: DecisionScore): PipelineStageId {
  if (decisionScore.label === "Well-Prepared") {
    return tradePlan.checklistProgress.readyForEntry ? "ready-to-execute" : "decision-ready";
  }
  if (decisionScore.label === "Developing") return "planning";
  if (decisionScore.label === "Just Started" && isEmptyPlan(tradePlan)) return "ideas";
  return "research"; // "Early Stage", or "Just Started" with some real content already
}

function buildOutstandingTasks(
  stage: PipelineStageId,
  decisionStages: DecisionStage[],
  linkedExecution: LinkedExecution | null,
  journalStatus: JournalStatus,
): string[] {
  if (["ideas", "research", "planning", "decision-ready", "ready-to-execute"].includes(stage)) {
    return decisionStages.filter((s) => s.status === "missing" || s.status === "partial").map((s) => s.recommendedAction);
  }
  if (stage === "open-position" || stage === "managing") {
    const tasks: string[] = [];
    if (linkedExecution?.detailUnavailable) tasks.push("Confirm and log the full execution details for this position.");
    if (!linkedExecution?.detailUnavailable && linkedExecution?.riskDollars === null) {
      tasks.push("No stop defined — set one to track open risk on this position.");
    }
    return tasks;
  }
  if (stage === "closed") return ["Log this trade in the Trade Journal."];
  if (stage === "journal-pending") return ["Add a lesson learned to your journal entry to complete the review."];
  return [];
}

export function computeTradeLifecycle(input: ComputeTradeLifecycleInput): TradeLifecycleRecord {
  const { tradePlan, decisionStages, decisionScore, linkedExecution, journalEntry, learning } = input;

  const outcome: LifecycleOutcome = tradePlan.status === "cancelled" ? "cancelled" : "active";
  const journalStatus = buildJournalStatus(linkedExecution, journalEntry);

  let stage: PipelineStageId;
  if (tradePlan.status === "archived" || tradePlan.status === "cancelled") {
    stage = "archived";
  } else if (linkedExecution && !linkedExecution.detailUnavailable) {
    if (linkedExecution.status === "closed") {
      stage = journalStatus.state === "reviewed" ? "reviewed" : journalStatus.state === "pending-reflection" ? "journal-pending" : "closed";
    } else {
      const days = timeInTradeDays(linkedExecution);
      stage = days !== null && days >= MANAGING_THRESHOLD_DAYS ? "managing" : "open-position";
    }
  } else if (tradePlan.status === "executed") {
    // Executed but no real trades/trading_positions row resolved (always
    // true for "investing" plans) — honest best-effort placement, flagged
    // via linkedExecution.detailUnavailable rather than guessed detail.
    stage = "open-position";
  } else {
    stage = derivePreExecutionStage(tradePlan, decisionScore);
  }

  const idx = STAGE_INDEX[stage];
  const isCancelledArchive = tradePlan.status === "cancelled";
  const previousStage = !isCancelledArchive && idx > 0 ? PIPELINE_STAGES[idx - 1].id : null;
  const nextStage = !isCancelledArchive && idx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[idx + 1].id : null;
  const completionPct = Math.round(((idx + 1) / PIPELINE_STAGES.length) * 100);

  const openRisk = linkedExecution && linkedExecution.status === "open" ? linkedExecution.riskDollars : null;
  const performanceStatus = buildPerformanceStatus(linkedExecution);
  const outstandingTasks = buildOutstandingTasks(stage, decisionStages, linkedExecution, journalStatus);

  const canMarkExecuted = stage === "ready-to-execute";
  const canArchive = outcome === "cancelled" || !["open-position", "managing", "closed", "journal-pending"].includes(stage);

  return {
    tradePlan,
    outcome,
    currentStage: stage,
    previousStage,
    nextStage,
    completionPct,
    openRisk,
    timeInTradeDays: timeInTradeDays(linkedExecution),
    outstandingTasks,
    journalStatus,
    performanceStatus,
    learning,
    linkedExecution,
    canMarkExecuted,
    canArchive,
    blockedReasons: {
      markExecuted: canMarkExecuted ? null : "This plan isn't Ready to Execute yet — resolve the outstanding readiness signals first.",
      archive: canArchive ? null : "Portfolio impact isn't finalized yet — journal and review this trade before archiving.",
    },
  };
}

// ─── Execution package — a professional, honest summary of an already-
// Ready-to-Execute plan's own already-documented fields. Never fabricates
// a value: a section the user never filled in reads "Not specified,"
// exactly as the plan itself would show it. ─────────────────────────────

export interface ExecutionPackage {
  instrument: string | null;
  direction: string | null;
  entry: string | null;
  stop: string | null;
  targets: string[];
  positionSize: string | null;
  risk: string | null;
  decisionScore: number;
  decisionScoreLabel: DecisionScore["label"];
  strategyTitle: string | null;
  notes: string | null;
  generatedAt: string;
}

export function buildExecutionPackage(tradePlan: TradePlanDetail, decisionScore: DecisionScore, strategy: AiStrategyDetail | null): ExecutionPackage {
  const sectionContent = (kind: string): string | null => {
    const found = tradePlan.sections.find((s) => s.kind === kind);
    const content = found?.content?.trim();
    return content ? content : null;
  };
  return {
    instrument: [tradePlan.plannedAsset, tradePlan.assetClass].filter((v): v is string => !!v).join(" · ") || null,
    direction: tradePlan.direction,
    entry: sectionContent("entry_zone"),
    stop: sectionContent("stop_loss"),
    targets: [sectionContent("target_1"), sectionContent("target_2"), sectionContent("target_3")].filter((v): v is string => !!v),
    positionSize: sectionContent("position_size_notes"),
    risk: sectionContent("maximum_risk"),
    decisionScore: decisionScore.overall,
    decisionScoreLabel: decisionScore.label,
    strategyTitle: strategy?.title ?? null,
    notes: sectionContent("personal_notes"),
    generatedAt: new Date().toISOString(),
  };
}

// ─── Learning integration for the post-execution stages. Pre-execution
// stages reuse decisionWorkflow.ts's own DECISION_LEARNING_RECOMMENDATIONS
// directly (via the weakest decision stage) — nothing duplicated there.
// Only the 5 post-execution stages that have no equivalent in the Decision
// Workflow need their own real, pre-verified pathKey/topicKey pairs
// (checked directly against learningPaths.ts before being committed, the
// same verification discipline Sprint 11/13 established). ────────────────

export const LIFECYCLE_LEARNING_RECOMMENDATIONS: Partial<
  Record<PipelineStageId, Partial<Record<CoachId, { pathKey: string; topicKey: string; label: string }>>>
> = {
  "open-position": {
    trading: { pathKey: "institutional", topicKey: "institutional-position-management", label: "Position Management" },
    options: { pathKey: "portfolio", topicKey: "portfolio-managing-positions", label: "Managing Existing Positions" },
    investing: { pathKey: "institutional-investing", topicKey: "investing-monitoring", label: "Investment Monitoring" },
  },
  managing: {
    trading: { pathKey: "trading-engine", topicKey: "trading-psychology-discipline", label: "Psychology & Discipline" },
    options: { pathKey: "portfolio", topicKey: "portfolio-managing-positions", label: "Managing Existing Positions" },
    investing: { pathKey: "institutional-investing", topicKey: "investing-monitoring", label: "Investment Monitoring" },
  },
  closed: {
    trading: { pathKey: "trading-engine", topicKey: "trading-journal-review", label: "Journal Review" },
    options: { pathKey: "trading-engine", topicKey: "trading-journal-review", label: "Journal Review" },
    investing: { pathKey: "institutional-investing", topicKey: "investing-rebalancing-and-review", label: "Rebalancing & Review" },
  },
  "journal-pending": {
    trading: { pathKey: "trading-engine", topicKey: "trading-journal-review", label: "Journal Review" },
    options: { pathKey: "trading-engine", topicKey: "trading-journal-review", label: "Journal Review" },
    investing: { pathKey: "institutional-investing", topicKey: "investing-rebalancing-and-review", label: "Rebalancing & Review" },
  },
  reviewed: {
    trading: { pathKey: "performance", topicKey: "performance-expectancy", label: "Expectancy" },
    options: { pathKey: "performance", topicKey: "performance-expectancy", label: "Expectancy" },
    investing: { pathKey: "institutional-investing", topicKey: "investing-rebalancing-and-review", label: "Rebalancing & Review" },
  },
};

const PRE_EXECUTION_STAGES: PipelineStageId[] = ["ideas", "research", "planning", "decision-ready", "ready-to-execute"];

export function recommendedLifecycleLesson(
  coachId: CoachId,
  stage: PipelineStageId,
  weakestDecisionStageId: DecisionStage["id"] | null,
): { pathKey: string; topicKey: string; label: string } | null {
  if (PRE_EXECUTION_STAGES.includes(stage)) {
    if (!weakestDecisionStageId) return null;
    return DECISION_LEARNING_RECOMMENDATIONS[weakestDecisionStageId]?.[coachId] ?? null;
  }
  return LIFECYCLE_LEARNING_RECOMMENDATIONS[stage]?.[coachId] ?? null;
}

// ─── AI Trade Manager guidance — deterministic institutional-practice
// text per stage, per the approved scope's own explicit ask ("what should
// happen now, why, institutional best practice, common mistakes, checklist
// before progressing"). Static reference content, not a new scoring
// formula — the real free-form Q&A still routes through the platform's
// existing AskCoachLauncher/AI Coach, never a second, duplicate AI system. ─

export interface StageGuidance {
  whatNow: string;
  why: string;
  bestPractice: string;
  commonMistakes: string[];
  checklist: string[];
}

export const STAGE_GUIDANCE: Record<PipelineStageId, StageGuidance> = {
  ideas: {
    whatNow: "Capture the idea's core thesis and the market context that triggered it.",
    why: "An idea with no documented context is impossible to evaluate objectively later, win or lose.",
    bestPractice: "Institutional desks log an idea the moment it forms — before conviction, not after.",
    commonMistakes: ["Skipping straight to a position size before the thesis is written down.", "Trading from memory instead of a documented plan."],
    checklist: ["Market context noted", "A one-sentence thesis exists"],
  },
  research: {
    whatNow: "Build out research: market context, and at least one supporting reference or notebook link.",
    why: "Evidence collected before conviction hardens is far less biased than evidence gathered to justify a decision already made.",
    bestPractice: "Separate 'what I observe' from 'what I believe' — cite the reference for each.",
    commonMistakes: ["Only searching for evidence that confirms the thesis.", "Treating a single data point as sufficient."],
    checklist: ["Market context documented", "At least one research or notebook reference linked"],
  },
  planning: {
    whatNow: "Write the thesis, define bias and catalysts, and begin documenting risk (stop, invalidation, risk/reward).",
    why: "A plan written before entry is a discipline tool; a plan written after entry is a rationalization.",
    bestPractice: "Define the invalidation level before the entry level — know what proves you wrong first.",
    commonMistakes: ["Defining a target before a stop.", "Leaving invalidation vague ('if it looks bad')."],
    checklist: ["Thesis, bias, and catalysts documented", "Stop-loss and invalidation defined"],
  },
  "decision-ready": {
    whatNow: "Every readiness signal is strong. Complete the remaining trade-plan checklist items.",
    why: "The checklist exists to catch the operational details a strong thesis can still miss (position sizing notes, exit plan, psychology check).",
    bestPractice: "Treat checklist completion as a gate, not a formality — an incomplete checklist is a real, named gap.",
    commonMistakes: ["Rushing past the checklist because the thesis feels strong.", "Skipping the psychology checklist under time pressure."],
    checklist: ["All required checklist items completed"],
  },
  "ready-to-execute": {
    whatNow: "Generate the execution package below and review it in full before acting.",
    why: "A written execution package is the last honest check against the plan before real money moves.",
    bestPractice: "Read the package aloud, or to someone else, before executing — catching a gap here is free; catching it after entry is not.",
    commonMistakes: ["Executing a different size or entry than the package documents.", "Skipping the package review because 'the plan is already in my head.'"],
    checklist: ["Execution package reviewed", "Executed manually at your own external broker", "Trade plan marked executed with a real reference"],
  },
  "open-position": {
    whatNow: "Confirm the position is accurately logged, including a stop, if one applies to this instrument.",
    why: "The first hours after entry are when execution slippage or logging errors are easiest to catch and fix.",
    bestPractice: "Verify entry price, size, and stop against the actual broker fill — not the plan's intended values.",
    commonMistakes: ["Assuming the fill matched the plan without checking.", "Never defining a stop because 'I'll watch it closely.'"],
    checklist: ["Fill details confirmed against the broker", "Stop (if applicable) recorded"],
  },
  managing: {
    whatNow: "Monitor at your own defined checkpoints — don't manage reactively to every price tick.",
    why: "Frequent, undisciplined check-ins correlate with worse outcomes than a fixed review cadence.",
    bestPractice: "Review against the plan's own invalidation/target levels, not against how the position 'feels' today.",
    commonMistakes: ["Moving a stop further away after it's already been threatened.", "Ignoring a genuine invalidation signal because 'it might come back.'"],
    checklist: ["Position still aligned with its original thesis", "Stop/target levels still current"],
  },
  closed: {
    whatNow: "Log this trade in the Trade Journal while the reasoning is still fresh.",
    why: "A trade journaled days later is reconstructed from memory, not recorded from experience.",
    bestPractice: "Journal every closed trade — wins included. Process quality, not just outcome, is what a journal measures.",
    commonMistakes: ["Only journaling losing trades.", "Journaling the outcome without the actual decision process."],
    checklist: ["Journal entry created for this closed trade"],
  },
  "journal-pending": {
    whatNow: "Add a lesson learned to the journal entry to complete the review.",
    why: "The lesson-learned field is what turns a log entry into an actual review — without it, nothing was learned, only recorded.",
    bestPractice: "Ask one honest question: what would I do differently, or the same, next time?",
    commonMistakes: ["Leaving the lesson-learned field blank because the trade was routine.", "Writing a lesson that doesn't reference what actually happened."],
    checklist: ["Lesson learned recorded"],
  },
  reviewed: {
    whatNow: "This trade is fully reviewed. Archive it once its portfolio impact is settled, or leave it visible for reference.",
    why: "A reviewed trade is a completed data point for future performance analysis, not something requiring further action.",
    bestPractice: "Periodically revisit reviewed trades in aggregate (Performance Review) rather than one at a time.",
    commonMistakes: ["Re-litigating a fully reviewed trade instead of moving on.", "Never revisiting reviewed trades in aggregate."],
    checklist: ["Reflected in Performance Review", "Archive when no longer needed for active reference"],
  },
  archived: {
    whatNow: "Nothing further — this plan is out of the active pipeline.",
    why: "Archiving keeps the active pipeline focused on what still needs attention.",
    bestPractice: "Archived plans remain available for reference — archiving is a filter, not a deletion.",
    commonMistakes: [],
    checklist: [],
  },
};

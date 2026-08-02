// v1.5.0, Sprint 18 — Institutional Playbooks & Operating Procedures Engine.
//
// Pure composition logic scoring lib/playbooks.ts's static content against
// real, already-computed platform state — mirrors lib/workflowAutomation.ts's
// own "reads currentStage/outstandingTasks directly, never re-derives stage
// math of its own" discipline exactly. Every "complete" reading below
// traces back to a real field on TradeLifecycleRecord/PortfolioHealthScore/
// RiskIntelligenceReport/AiNotebook/AiStrategy — never a fabricated signal.
//
// Two stage-completion strategies, matching PlaybookStageSignalType:
//   "auto"   -> derived here from real platform state.
//   "manual" -> honestly reported "not tracked automatically" and scored
//               only from the user's own client-side acknowledgement (see
//               lib/playbook-acknowledgements.ts) — never presented as a
//               verified reading.

import type { CoachId } from "./ai-coach/capabilityRegistry";
import type { AiNotebook } from "./ai-coach/notebooksApi";
import type { AiStrategy } from "./ai-coach/strategiesApi";
import type { TradeLifecycleRecord } from "./tradeLifecycle";
import { PIPELINE_STAGES, type PipelineStageId } from "./tradeLifecycle";
import type { PortfolioHealthScore, RiskIntelligenceReport, HealthFactor } from "./portfolioRiskIntelligence";
import { hasBreachedRiskSignal } from "./workflowAutomation";
import type { JournalEntry } from "@workspace/api-client-react";
import { discoverPatterns, type KnowledgeGraph } from "./knowledgeGraph";
import { PLAYBOOKS, type Playbook, type PlaybookStage } from "./playbooks";
import { playbookStageAckKey } from "./playbook-acknowledgements";

export type PlaybookStageStatus = "not-started" | "in-progress" | "complete" | "blocked";

export interface PlaybookStageProgress {
  stage: PlaybookStage;
  status: PlaybookStageStatus;
  detail: string;
}

export interface PlaybookProgress {
  playbook: Playbook;
  boundEntityLabel: string | null;
  stages: PlaybookStageProgress[];
  completedCount: number;
  totalCount: number;
  progressPct: number;
  blockedStages: PlaybookStageProgress[];
  recommendedNextStage: PlaybookStageProgress | null;
  overallStatus: "not-started" | "in-progress" | "complete";
}

export interface PlaybookProgressContext {
  notebooksByCoach: Partial<Record<CoachId, AiNotebook[]>>;
  strategiesByCoach: Partial<Record<CoachId, AiStrategy[]>>;
  lifecycleRecords: TradeLifecycleRecord[];
  portfolioHealth: PortfolioHealthScore | null;
  portfolioRisk: RiskIntelligenceReport | null;
  weakestPortfolioFactor: HealthFactor | null;
  journalEntries: JournalEntry[];
  learningPathsInProgress: number;
  graph: KnowledgeGraph;
  manualAcks: Set<string>;
  /** When set, entity-bound playbooks (entityBinding === "trade-plan") are
   * scored against this one specific TradeLifecycleRecord instead of the
   * aggregate signals above. Honestly falls back to "not-started" for
   * every stage when no record with this id can be found — never a
   * fabricated reading for a plan that doesn't exist. */
  boundTradePlanId: number | null;
}

const COACH_IDS: CoachId[] = ["investing", "trading", "options"];

function totalNotebooks(ctx: PlaybookProgressContext): number {
  return COACH_IDS.reduce((sum, c) => sum + (ctx.notebooksByCoach[c]?.length ?? 0), 0);
}

function allStrategies(ctx: PlaybookProgressContext): AiStrategy[] {
  return COACH_IDS.flatMap((c) => ctx.strategiesByCoach[c] ?? []);
}

function anyNotebookHasTags(ctx: PlaybookProgressContext): boolean {
  return COACH_IDS.some((c) => (ctx.notebooksByCoach[c] ?? []).some((n) => n.tags.length > 0));
}

function stageIndexOf(id: PipelineStageId): number {
  return PIPELINE_STAGES.findIndex((s) => s.id === id);
}

/** Shared by every "trade-plan"-bound stage — an honest reading of where
 * the bound record's own currentStage sits relative to the stage this
 * playbook step represents. "blocked" is reported only when the record is
 * genuinely stuck at this exact stage with real, already-computed
 * outstanding tasks (TradeLifecycleRecord.outstandingTasks) — never a
 * fabricated blocker. */
function lifecycleStageStatus(record: TradeLifecycleRecord | null, reachedAt: PipelineStageId): { status: PlaybookStageStatus; detail: string } {
  if (!record) return { status: "not-started", detail: "No Trade Plan selected yet." };
  const currentIdx = stageIndexOf(record.currentStage);
  const targetIdx = stageIndexOf(reachedAt);
  if (currentIdx > targetIdx || record.currentStage === "archived") {
    return { status: "complete", detail: `"${record.tradePlan.title}" has moved past this stage (currently: ${record.currentStage}).` };
  }
  if (currentIdx === targetIdx) {
    if (record.outstandingTasks.length > 0) {
      return { status: "blocked", detail: `Stuck at this stage — ${record.outstandingTasks[0]}` };
    }
    return { status: "in-progress", detail: `"${record.tradePlan.title}" is currently at this stage.` };
  }
  return { status: "not-started", detail: `"${record.tradePlan.title}" hasn't reached this stage yet (currently: ${record.currentStage}).` };
}

function manualStatus(playbookId: string, stageId: string, ctx: PlaybookProgressContext): { status: PlaybookStageStatus; detail: string } {
  const acked = ctx.manualAcks.has(playbookStageAckKey(playbookId, stageId));
  return {
    status: acked ? "complete" : "not-started",
    detail: acked
      ? "Marked done for your own reference — not automatically verified by the platform."
      : "Not tracked automatically — mark this done for your own reference once you've completed it.",
  };
}

// ─── Per-playbook auto-status resolution ───────────────────────────────

function boundRecord(ctx: PlaybookProgressContext): TradeLifecycleRecord | null {
  if (ctx.boundTradePlanId === null) return null;
  return ctx.lifecycleRecords.find((r) => r.tradePlan.id === ctx.boundTradePlanId) ?? null;
}

const TRADE_PLAN_STAGE_TARGETS: Record<string, PipelineStageId> = {
  "capture-plan-idea": "ideas",
  "document-plan-context": "research",
  "set-risk-parameters": "planning",
  "run-checklist": "decision-ready",
  "review-evidence": "research",
  "review-thesis-risk": "planning",
  "check-strategy-alignment": "planning",
  "confirm-well-prepared": "decision-ready",
  "confirm-readiness": "decision-ready",
  "generate-package": "ready-to-execute",
  "execute-and-log": "open-position",
  "confirm-execution-logged": "open-position",
  "close-and-confirm": "closed",
  "log-journal-entry": "journal-pending",
  "record-lesson": "reviewed",
};

function resolveAutoStage(playbook: Playbook, stage: PlaybookStage, ctx: PlaybookProgressContext): { status: PlaybookStageStatus; detail: string } {
  // ─── Entity-bound trade-lifecycle playbooks ───────────────────────────
  const target = TRADE_PLAN_STAGE_TARGETS[stage.id];
  if (target) {
    return lifecycleStageStatus(boundRecord(ctx), target);
  }
  if (stage.id === "track-open-risk") {
    const record = boundRecord(ctx);
    if (!record) return { status: "not-started", detail: "No Trade Plan selected yet." };
    if (!["open-position", "managing", "closed", "journal-pending", "reviewed"].includes(record.currentStage)) {
      return { status: "not-started", detail: "This trade hasn't been executed yet." };
    }
    if (record.openRisk === null) {
      return { status: "in-progress", detail: "No stop defined yet — open risk isn't tracked until one is set." };
    }
    return { status: "complete", detail: `Open risk tracked: $${record.openRisk.toFixed(2)}.` };
  }

  // ─── Investment Research (aggregate) ──────────────────────────────────
  if (playbook.id === "investment-research") {
    const count = totalNotebooks(ctx);
    if (stage.id === "capture-idea") {
      return count > 0
        ? { status: "complete", detail: `${count} research notebook${count === 1 ? "" : "s"} exist across your engines.` }
        : { status: "not-started", detail: "No research notebooks exist yet." };
    }
    if (stage.id === "document-evidence") {
      if (count === 0) return { status: "not-started", detail: "No research notebooks exist yet." };
      return anyNotebookHasTags(ctx)
        ? { status: "complete", detail: "At least one notebook is tagged, so the Knowledge Graph can connect it." }
        : { status: "in-progress", detail: "Notebooks exist, but none are tagged yet — tag them to connect research to strategies and trade plans." };
    }
  }

  // ─── Strategy Development (aggregate) ─────────────────────────────────
  if (playbook.id === "strategy-development") {
    const strategies = allStrategies(ctx);
    const active = strategies.filter((s) => s.status === "active");
    if (stage.id === "draft-strategy") {
      return strategies.length > 0
        ? { status: "complete", detail: `${strategies.length} strateg${strategies.length === 1 ? "y" : "ies"} exist.` }
        : { status: "not-started", detail: "No strategies exist yet." };
    }
    if (stage.id === "complete-sections") {
      if (active.length > 0) return { status: "complete", detail: `${active.length} strateg${active.length === 1 ? "y is" : "ies are"} active.` };
      return strategies.length > 0
        ? { status: "in-progress", detail: "Strategies exist in draft — complete their sections before approving." }
        : { status: "not-started", detail: "No strategies exist yet." };
    }
    if (stage.id === "approve-strategy") {
      if (active.length > 0) return { status: "complete", detail: `${active.length} strateg${active.length === 1 ? "y" : "ies"} approved for active use.` };
      return strategies.length > 0
        ? { status: "in-progress", detail: "Strategies exist but none are approved (active) yet." }
        : { status: "not-started", detail: "No strategies exist yet." };
    }
  }

  // ─── Portfolio Review (aggregate) ──────────────────────────────────────
  if (playbook.id === "portfolio-review") {
    const { portfolioHealth, portfolioRisk, weakestPortfolioFactor } = ctx;
    const hasSignal = !!portfolioHealth && portfolioHealth.confidenceLevel !== "Low";
    if (stage.id === "review-health-score") {
      if (!hasSignal) return { status: "not-started", detail: "No real portfolio signal available yet." };
      const elevated = portfolioHealth!.label === "Elevated Risk" || portfolioHealth!.label === "Poor";
      return elevated
        ? { status: "in-progress", detail: `Health Score is "${portfolioHealth!.label}" (${portfolioHealth!.overall}/100) — needs attention.` }
        : { status: "complete", detail: `Health Score is "${portfolioHealth!.label}" (${portfolioHealth!.overall}/100).` };
    }
    if (stage.id === "review-exposure-allocation") {
      if (!hasSignal) return { status: "not-started", detail: "No real portfolio signal available yet." };
      return hasBreachedRiskSignal(portfolioRisk)
        ? { status: "in-progress", detail: "A risk signal is reporting a breach — review it before considering this stage done." }
        : { status: "complete", detail: "No breached exposure/allocation signal currently reported." };
    }
    if (stage.id === "identify-weakest-factor") {
      return weakestPortfolioFactor
        ? { status: "complete", detail: `Weakest factor: ${weakestPortfolioFactor.label}${weakestPortfolioFactor.score !== null ? ` (${weakestPortfolioFactor.score}/100)` : ""}.` }
        : { status: "not-started", detail: "No real portfolio signal available yet." };
    }
  }

  // ─── Risk Review (aggregate) ────────────────────────────────────────────
  if (playbook.id === "risk-review") {
    const { portfolioRisk } = ctx;
    const singlePosition = portfolioRisk?.signals.find((s) => s.code === "single_position_risk");
    const totalRisk = portfolioRisk?.signals.find((s) => s.code === "open_trade_risk" || s.code === "total_portfolio_risk");
    if (stage.id === "review-single-position-risk") {
      if (!singlePosition?.available) return { status: "not-started", detail: "No single-position risk signal available yet." };
      return /breach|above|exceed/i.test(singlePosition.detail)
        ? { status: "in-progress", detail: singlePosition.headline }
        : { status: "complete", detail: singlePosition.headline };
    }
    if (stage.id === "review-total-risk") {
      if (!totalRisk?.available) return { status: "not-started", detail: "No total portfolio risk signal available yet." };
      return /breach|above|exceed/i.test(totalRisk.detail)
        ? { status: "in-progress", detail: totalRisk.headline }
        : { status: "complete", detail: totalRisk.headline };
    }
  }

  // ─── Weekly Investment Committee (aggregate) ───────────────────────────
  if (playbook.id === "weekly-investment-committee") {
    if (stage.id === "review-pipeline") {
      return ctx.lifecycleRecords.length > 0
        ? { status: "complete", detail: `${ctx.lifecycleRecords.length} trade plan(s) in the pipeline to review.` }
        : { status: "not-started", detail: "No trade plans exist yet — nothing in the pipeline." };
    }
    if (stage.id === "review-workflow-queue") {
      const anyEntity = totalNotebooks(ctx) > 0 || allStrategies(ctx).length > 0 || ctx.lifecycleRecords.length > 0;
      return anyEntity
        ? { status: "complete", detail: "There is real workflow activity to review this week." }
        : { status: "not-started", detail: "Nothing has been created yet across research, strategy, or trade plans." };
    }
  }

  // ─── Quarterly Performance Review (aggregate) ──────────────────────────
  if (playbook.id === "quarterly-performance-review") {
    if (stage.id === "review-performance") {
      const closed = ctx.lifecycleRecords.filter((r) => r.performanceStatus.state === "closed");
      if (ctx.lifecycleRecords.length === 0) return { status: "not-started", detail: "No trade plans exist yet." };
      return closed.length > 0
        ? { status: "complete", detail: `${closed.length} closed trade(s) with real performance data to review.` }
        : { status: "in-progress", detail: "Trade plans exist, but none have closed with realized performance yet." };
    }
    if (stage.id === "review-patterns") {
      if (ctx.journalEntries.length === 0) return { status: "not-started", detail: "No journal entries exist yet." };
      const patterns = discoverPatterns(ctx.graph, ctx.journalEntries, ctx.portfolioRisk);
      return { status: "complete", detail: patterns.length > 0 ? `${patterns.length} pattern(s) found in Pattern Discovery.` : "Reviewed — no recurring pattern found yet (needs at least 2 corroborating journal entries)." };
    }
    if (stage.id === "review-learning-progress") {
      return ctx.learningPathsInProgress > 0
        ? { status: "complete", detail: `${ctx.learningPathsInProgress} learning path(s) in progress or completed.` }
        : { status: "not-started", detail: "No Learning Centre progress recorded yet." };
    }
  }

  return { status: "not-started", detail: "No signal available for this stage yet." };
}

export function computeStageStatus(playbook: Playbook, stage: PlaybookStage, ctx: PlaybookProgressContext): PlaybookStageProgress {
  const { status, detail } = stage.signalType === "manual" ? manualStatus(playbook.id, stage.id, ctx) : resolveAutoStage(playbook, stage, ctx);
  return { stage, status, detail };
}

export function computePlaybookProgress(playbook: Playbook, ctx: PlaybookProgressContext): PlaybookProgress {
  const stages = playbook.stages.map((s) => computeStageStatus(playbook, s, ctx));
  const completedCount = stages.filter((s) => s.status === "complete").length;
  const totalCount = stages.length;
  const progressPct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const blockedStages = stages.filter((s) => s.status === "blocked");
  const recommendedNextStage = stages.find((s) => s.status === "not-started" || s.status === "in-progress" || s.status === "blocked") ?? null;
  const overallStatus: PlaybookProgress["overallStatus"] = completedCount === totalCount && totalCount > 0 ? "complete" : completedCount > 0 || stages.some((s) => s.status !== "not-started") ? "in-progress" : "not-started";
  const boundEntityLabel = playbook.entityBinding === "trade-plan" ? (boundRecord(ctx)?.tradePlan.title ?? null) : null;

  return { playbook, boundEntityLabel, stages, completedCount, totalCount, progressPct, blockedStages, recommendedNextStage, overallStatus };
}

export function computeAllPlaybooksProgress(ctx: PlaybookProgressContext): PlaybookProgress[] {
  return PLAYBOOKS.map((p) => computePlaybookProgress(p, ctx));
}

/** Command Centre's own "current playbook" pick — the in-progress playbook
 * with the most completed stages (i.e. the one furthest along right now),
 * never a fabricated "you started this" claim when nothing has any real
 * signal at all. */
export function currentPlaybook(progresses: PlaybookProgress[]): PlaybookProgress | null {
  const inProgress = progresses.filter((p) => p.overallStatus === "in-progress");
  if (inProgress.length === 0) return null;
  return [...inProgress].sort((a, b) => b.completedCount - a.completedCount)[0];
}

/** Command Centre's own "recommended next procedure" — the first
 * not-started playbook whose prerequisites are honestly already met,
 * in the same fixed content order lib/playbooks.ts declares them. Never
 * recommends a playbook already in progress or complete. */
export function recommendedNextPlaybook(progresses: PlaybookProgress[]): PlaybookProgress | null {
  return progresses.find((p) => p.overallStatus === "not-started") ?? null;
}

// ─── AI Playbook Coach — deterministic narrative over already-authored
// playbook content, mirroring buildDecisionCoachNarrative()/
// buildPortfolioCoachNarrative()/buildWorkflowCoachNarrative()'s own
// established pattern exactly (Sprints 13/15/16). Never invents a process
// step beyond what lib/playbooks.ts already documents. ───────────────────

export interface PlaybookCoachNarrative {
  whyThisStageExists: string;
  professionalExpectations: string;
  typicalInstitutionalProcess: string;
  commonErrors: string[];
  whenToStopAndReassess: string;
  relatedLessons: { pathKey: string; topicKey: string; label: string }[];
  relatedHistoricalExamples: string;
}

export function buildPlaybookCoachNarrative(playbook: Playbook, stageProgress: PlaybookStageProgress | null): PlaybookCoachNarrative {
  if (!stageProgress) {
    return {
      whyThisStageExists: `${playbook.name}: ${playbook.purpose}`,
      professionalExpectations: playbook.objective,
      typicalInstitutionalProcess: playbook.institutionalNotes[0] ?? "No further institutional note recorded for this playbook.",
      commonErrors: playbook.commonMistakes,
      whenToStopAndReassess: "Pick a stage below to get stage-specific guidance.",
      relatedLessons: playbook.relatedLearning,
      relatedHistoricalExamples: playbook.relatedKnowledge,
    };
  }
  const { stage, status } = stageProgress;
  return {
    whyThisStageExists: stage.purpose,
    professionalExpectations: stage.whyItMatters,
    typicalInstitutionalProcess: playbook.institutionalNotes[0] ?? "No further institutional note recorded for this playbook.",
    commonErrors: playbook.commonMistakes,
    whenToStopAndReassess:
      status === "blocked"
        ? "This stage is genuinely blocked right now — stop and resolve the named blocker before proceeding, rather than working around it."
        : "If this stage's required actions don't genuinely apply to your situation, stop and reconsider whether this is the right playbook before forcing it to fit.",
    relatedLessons: playbook.relatedLearning,
    relatedHistoricalExamples: playbook.relatedKnowledge,
  };
}

// v1.5.0, Sprint 19 — Institutional Decision Quality & Review Engine.
//
// NOT another analytics dashboard. NOT another trade journal. NOT another
// performance report. This module evaluates the QUALITY of a completed
// decision's own process — never the outcome. It never places a trade,
// never modifies a Playbook, and never computes a P&L figure of its own —
// every dollar figure shown here is a direct read of a field already
// computed by lib/tradeLifecycle.ts (Sprint 14).
//
// ─── REUSE MAP (see docs/v1.5.0-Sprint-19-Decision-Quality-Review.md for
// the full narrative version) ───────────────────────────────────────────
//   Research/Evidence/Strategy/Risk quality -> lib/decisionWorkflow.ts's
//     own DecisionStage[] (Sprint 13, computeCoreDecisionStages()) — the
//     "research"/"evidence"/"strategy"/"risk" stages' own already-computed
//     .confidence/.status are read directly, never re-scored.
//   Journal completeness / Post-trade reflection / Portfolio outcome ->
//     lib/tradeLifecycle.ts's own TradeLifecycleRecord.journalStatus/
//     .performanceStatus/.openRisk/.learning (Sprint 14) — read directly.
//   Playbook adherence -> lib/playbookProgress.ts's own
//     computePlaybookProgress() (Sprint 18), bound to this exact Trade
//     Plan id — the SAME function the Playbooks page itself calls, never
//     a second scoring pass.
//   Knowledge Graph references -> lib/knowledgeGraph.ts's own
//     relatedEntities()/relatedEntitiesWithinTwoHops()/discoverPatterns()
//     (Sprint 17), called directly from the execution page.
//   AI Coach -> the same deterministic-narrative pattern established by
//     buildDecisionCoachNarrative()/buildPortfolioCoachNarrative()/
//     buildWorkflowCoachNarrative()/buildPlaybookCoachNarrative() (Sprints
//     13/15/16/18) — see buildDecisionReviewCoachNarrative() below.
//
// Four genuinely new, honest signals this sprint adds — none a duplicate
// of anything above, all direct presence/consistency reads of data this
// codebase already fetches for other purposes, never a fabricated score:
//   "Alternative scenarios considered" — the platform has no dedicated
//     bull/bear/base-case field, so this reads the Trade Plan's own
//     confirmation_rules section (a real, existing TradePlanSectionKind,
//     Sprint 10) — the closest honest existing proxy for "did the plan
//     document what would confirm or invalidate its own scenario."
//   "Position sizing" — reads the Trade Plan's own position_size_notes
//     section (also pre-existing, Sprint 10).
//   "Decision rationale" — compares the Trade Plan's own pre-trade thesis
//     documentation (the "thesis" DecisionStage's confidence) against the
//     linked Journal entry's own POST-trade thesis/entryReasoning fields
//     (Alpaca Trading Expansion wave) — genuinely new because nothing in
//     this codebase currently compares pre- vs. post-trade articulation.
//   "Execution discipline" — reads the Trade Plan's own already-computed
//     checklistProgress (required-items-completed ratio, Sprint 10),
//     honestly disclosed as reflecting the plan's CURRENT checklist state
//     rather than a historical snapshot at the moment of execution (no
//     such snapshot is persisted anywhere in this codebase).

import type { CoachId } from "./ai-coach/capabilityRegistry";
import type { TradePlanDetail, TradePlanSectionKind } from "./ai-coach/tradePlansApi";
import type { DecisionStage, DecisionStageId, DecisionScore } from "./decisionWorkflow";
import { statusFromConfidence } from "./decisionWorkflow";
import type { TradeLifecycleRecord, PipelineStageId } from "./tradeLifecycle";
import type { PlaybookProgress } from "./playbookProgress";
import type { JournalEntry } from "@workspace/api-client-react";

export type ReviewFieldStatus = "strong" | "adequate" | "weak" | "not-applicable";

export type DecisionReviewFieldId =
  | "research-quality"
  | "evidence-completeness"
  | "alternative-scenarios"
  | "strategy-alignment"
  | "risk-planning"
  | "position-sizing"
  | "decision-rationale"
  | "execution-discipline"
  | "journal-completeness"
  | "post-trade-reflection"
  | "portfolio-impact";

export interface DecisionReviewField {
  id: DecisionReviewFieldId;
  label: string;
  status: ReviewFieldStatus;
  /** null when this field is deliberately excluded from the process-quality
   * score — currently only "portfolio-impact," per the explicit "never
   * reward lucky outcomes / never punish disciplined losses" instruction. */
  confidence: number | null;
  evidenceSummary: string;
  evidenceHref: string | null;
}

export interface DecisionReviewPlaybookAdherence {
  playbookId: string;
  playbookName: string;
  completedStages: number;
  totalStages: number;
  incompleteStageTitles: string[];
}

export interface DecisionReviewOutcome {
  state: TradeLifecycleRecord["performanceStatus"]["state"];
  realizedPnl: number | null;
  unrealizedPnl: number | null;
  openRisk: number | null;
}

export interface DecisionReviewProcessQuality {
  score: number;
  label: "Excellent Process" | "Solid Process" | "Developing Process" | "Needs Attention";
  componentFieldIds: DecisionReviewFieldId[];
}

export interface DecisionReview {
  tradePlanId: number;
  tradePlanTitle: string;
  coachId: CoachId;
  symbol: string | null;
  currentStage: PipelineStageId;
  executedAt: string | null;
  updatedAt: string;
  fields: DecisionReviewField[];
  processQuality: DecisionReviewProcessQuality;
  outcome: DecisionReviewOutcome;
  playbookAdherence: DecisionReviewPlaybookAdherence[];
  learningEngaged: boolean;
}

function sectionContent(tradePlan: TradePlanDetail, kind: TradePlanSectionKind): string | null {
  const section = tradePlan.sections.find((s) => s.kind === kind);
  const content = section?.content?.trim();
  return content && content.length > 0 ? content : null;
}

function stageById(stages: DecisionStage[], id: DecisionStageId): DecisionStage | null {
  return stages.find((s) => s.id === id) ?? null;
}

function fieldFromStage(id: DecisionReviewFieldId, label: string, stage: DecisionStage | null, href: string): DecisionReviewField {
  if (!stage || stage.confidence === null) {
    return { id, label, status: "not-applicable", confidence: null, evidenceSummary: stage?.recommendedAction ?? "No signal available.", evidenceHref: href };
  }
  return {
    id,
    label,
    status: stage.status === "complete" ? "strong" : stage.status === "partial" ? "adequate" : stage.status === "missing" ? "weak" : "not-applicable",
    confidence: stage.confidence,
    evidenceSummary: stage.recommendedAction,
    evidenceHref: href,
  };
}

function fieldFromPresence(id: DecisionReviewFieldId, label: string, present: boolean, presentSummary: string, absentSummary: string, href: string): DecisionReviewField {
  const confidence = present ? 100 : 0;
  const status = statusFromConfidence(confidence);
  return {
    id,
    label,
    status: status === "complete" ? "strong" : status === "missing" ? "weak" : "adequate",
    confidence,
    evidenceSummary: present ? presentSummary : absentSummary,
    evidenceHref: href,
  };
}

export interface ComputeDecisionReviewInput {
  tradePlan: TradePlanDetail;
  coreStages: DecisionStage[];
  record: TradeLifecycleRecord;
  journalEntry: JournalEntry | null;
  /** Playbook progress for this exact Trade Plan, already computed via
   * lib/playbookProgress.ts's own computePlaybookProgress() for each of
   * the 5 trade-lifecycle-bound playbooks — never recomputed here. */
  playbookProgresses: PlaybookProgress[];
}

const SCORE_LABEL_THRESHOLDS: { min: number; label: DecisionReviewProcessQuality["label"] }[] = [
  { min: 80, label: "Excellent Process" },
  { min: 60, label: "Solid Process" },
  { min: 35, label: "Developing Process" },
  { min: 0, label: "Needs Attention" },
];

function scoreLabel(score: number): DecisionReviewProcessQuality["label"] {
  return SCORE_LABEL_THRESHOLDS.find((t) => score >= t.min)!.label;
}

/**
 * Honestly returns null when this Trade Plan has not yet been executed —
 * there is no completed decision to review yet. Never fabricates a review
 * for a still-in-progress plan.
 */
export function computeDecisionReview(input: ComputeDecisionReviewInput): DecisionReview | null {
  const { tradePlan, coreStages, record, journalEntry, playbookProgresses } = input;
  if (!record.linkedExecution) return null;

  const researchField = fieldFromStage("research-quality", "Research Quality", stageById(coreStages, "research"), "/assistant");
  const evidenceField = fieldFromStage("evidence-completeness", "Evidence Completeness", stageById(coreStages, "evidence"), "/assistant");
  const strategyField = fieldFromStage("strategy-alignment", "Strategy Alignment", stageById(coreStages, "strategy"), "/assistant");
  const riskField = fieldFromStage("risk-planning", "Risk Planning", stageById(coreStages, "risk"), "/assistant");

  const confirmationRules = sectionContent(tradePlan, "confirmation_rules");
  const scenariosField = fieldFromPresence(
    "alternative-scenarios",
    "Alternative Scenarios Considered",
    !!confirmationRules,
    "Confirmation/invalidation criteria were documented — evidence the scenario was thought through both ways.",
    "No confirmation rules documented — no evidence the plan considered what would prove it wrong.",
    "/assistant",
  );

  const positionSizeNotes = sectionContent(tradePlan, "position_size_notes");
  const sizingField = fieldFromPresence(
    "position-sizing",
    "Position Sizing",
    !!positionSizeNotes,
    "Position size notes were documented before execution.",
    "No position sizing rationale was documented before execution.",
    "/assistant",
  );

  const thesisStage = stageById(coreStages, "thesis");
  const preTradeThesisDocumented = (thesisStage?.confidence ?? 0) >= 100;
  const postTradeRationaleRecorded = !!(journalEntry?.thesis?.trim() || journalEntry?.entryReasoning?.trim());
  const rationaleConfidence = preTradeThesisDocumented && postTradeRationaleRecorded ? 100 : preTradeThesisDocumented || postTradeRationaleRecorded ? 50 : 0;
  const rationaleStatus = statusFromConfidence(rationaleConfidence);
  const rationaleField: DecisionReviewField = {
    id: "decision-rationale",
    label: "Decision Rationale",
    status: rationaleStatus === "complete" ? "strong" : rationaleStatus === "partial" ? "adequate" : "weak",
    confidence: rationaleConfidence,
    evidenceSummary:
      preTradeThesisDocumented && postTradeRationaleRecorded
        ? "Thesis was documented before entry and re-articulated in the Trade Journal — consistent reasoning end to end."
        : preTradeThesisDocumented
          ? "Thesis was documented before entry, but the Journal entry doesn't re-articulate why the trade was actually taken."
          : postTradeRationaleRecorded
            ? "The Journal entry explains the reasoning, but no pre-trade thesis was documented in the plan itself."
            : "No pre-trade thesis and no post-trade rationale were documented anywhere.",
    evidenceHref: journalEntry ? "/trading-journal" : "/assistant",
  };

  const { requiredItems, completedRequiredItems } = tradePlan.checklistProgress;
  const disciplineField: DecisionReviewField =
    requiredItems === 0
      ? { id: "execution-discipline", label: "Execution Discipline", status: "not-applicable", confidence: null, evidenceSummary: "No checklist template was ever applied to this plan — discipline can't be assessed against a checklist that doesn't exist.", evidenceHref: "/assistant" }
      : (() => {
          const confidence = Math.round((completedRequiredItems / requiredItems) * 100);
          const status = statusFromConfidence(confidence);
          return {
            id: "execution-discipline" as const,
            label: "Execution Discipline",
            status: status === "complete" ? "strong" : status === "partial" ? "adequate" : "weak",
            confidence,
            evidenceSummary: `${completedRequiredItems}/${requiredItems} required checklist items complete (reflects the plan's current checklist state, not a historical snapshot at execution time).`,
            evidenceHref: "/assistant",
          };
        })();

  const journalState = record.journalStatus.state;
  const journalConfidence = journalState === "not-yet-applicable" ? null : journalState === "missing" ? 0 : journalState === "pending-reflection" ? 50 : 100;
  const journalField: DecisionReviewField = {
    id: "journal-completeness",
    label: "Journal Completeness",
    status: journalConfidence === null ? "not-applicable" : journalConfidence >= 100 ? "strong" : journalConfidence >= 50 ? "adequate" : "weak",
    confidence: journalConfidence,
    evidenceSummary: record.journalStatus.label,
    evidenceHref: "/trading-journal",
  };

  const reflectionConfidence = journalState === "not-yet-applicable" ? null : journalState === "reviewed" ? 100 : 0;
  const reflectionField: DecisionReviewField = {
    id: "post-trade-reflection",
    label: "Post-Trade Reflection",
    status: reflectionConfidence === null ? "not-applicable" : reflectionConfidence === 100 ? "strong" : "weak",
    confidence: reflectionConfidence,
    evidenceSummary: reflectionConfidence === 100 ? "A lesson learned was recorded for this decision." : reflectionConfidence === 0 ? "No lesson learned has been recorded for this decision yet." : "Not yet applicable.",
    evidenceHref: "/trading-journal",
  };

  // Deliberately EXCLUDED from process-quality scoring (confidence always
  // null) — this field shows real dollar figures for context only. Scoring
  // a "decision quality" review on P&L would directly violate the
  // approved scope's "never reward lucky outcomes / never punish
  // disciplined losses" instruction.
  const outcomeField: DecisionReviewField = {
    id: "portfolio-impact",
    label: "Portfolio Impact",
    status: "not-applicable",
    confidence: null,
    evidenceSummary:
      record.performanceStatus.state === "closed"
        ? `Closed${record.performanceStatus.realizedPnl != null ? `, realized P&L ${record.performanceStatus.realizedPnl >= 0 ? "+" : ""}${record.performanceStatus.realizedPnl.toFixed(2)}` : ""}. Shown for context only — never scored as part of process quality.`
        : record.performanceStatus.state === "open"
          ? `Still open${record.performanceStatus.unrealizedPnl != null ? `, unrealized P&L ${record.performanceStatus.unrealizedPnl >= 0 ? "+" : ""}${record.performanceStatus.unrealizedPnl.toFixed(2)}` : ""}. Shown for context only.`
          : "Outcome not yet known.",
    evidenceHref: "/execution-lifecycle",
  };

  const fields = [researchField, evidenceField, scenariosField, strategyField, riskField, sizingField, rationaleField, disciplineField, journalField, reflectionField, outcomeField];

  const scored = fields.filter((f): f is DecisionReviewField & { confidence: number } => f.confidence !== null);
  const score = scored.length === 0 ? 0 : Math.round(scored.reduce((sum, f) => sum + f.confidence, 0) / scored.length);

  const playbookAdherence: DecisionReviewPlaybookAdherence[] = playbookProgresses.map((p) => ({
    playbookId: p.playbook.id,
    playbookName: p.playbook.name,
    completedStages: p.completedCount,
    totalStages: p.totalCount,
    incompleteStageTitles: p.stages.filter((s) => s.status !== "complete").map((s) => s.stage.title),
  }));

  return {
    tradePlanId: tradePlan.id,
    tradePlanTitle: tradePlan.title,
    coachId: tradePlan.coachId,
    symbol: tradePlan.plannedAsset,
    currentStage: record.currentStage,
    executedAt: tradePlan.executedAt,
    updatedAt: tradePlan.updatedAt,
    fields,
    processQuality: { score, label: scoreLabel(score), componentFieldIds: scored.map((f) => f.id) },
    outcome: { state: record.performanceStatus.state, realizedPnl: record.performanceStatus.realizedPnl, unrealizedPnl: record.performanceStatus.unrealizedPnl, openRisk: record.openRisk },
    playbookAdherence,
    learningEngaged: record.learning.engagedWithRecommendedLesson,
  };
}

// ─── AI Decision Review Coach — deterministic narrative over already-
// computed review fields, mirroring buildWorkflowCoachNarrative()/
// buildPlaybookCoachNarrative()'s own established pattern exactly (Sprints
// 16/18). Coaches, never judges: no field is ever described as a "failed"
// or "good" trade — only as a documented or undocumented step in the
// process. ───────────────────────────────────────────────────────────────

export interface DecisionReviewCoachNarrative {
  strongParts: string[];
  weakParts: string[];
  missedOpportunities: string[];
  institutionalBestPractice: string;
  recurringPatterns: string;
  recommendedLearning: string;
  relatedPlaybooks: string[];
}

export function buildDecisionReviewCoachNarrative(review: DecisionReview, recurringDeviationSummary: string | null): DecisionReviewCoachNarrative {
  const strongParts = review.fields.filter((f) => f.status === "strong").map((f) => `${f.label}: ${f.evidenceSummary}`);
  const weakParts = review.fields.filter((f) => f.status === "weak").map((f) => `${f.label}: ${f.evidenceSummary}`);
  const missedOpportunities = review.playbookAdherence.flatMap((p) => p.incompleteStageTitles.map((title) => `${p.playbookName}: ${title}`));

  return {
    strongParts: strongParts.length > 0 ? strongParts : ["No field reached a clearly 'strong' reading on this decision yet — see Weak Parts below for where to focus."],
    weakParts: weakParts.length > 0 ? weakParts : ["No field reads clearly 'weak' — the documented process was reasonably complete."],
    missedOpportunities: missedOpportunities.length > 0 ? missedOpportunities : ["No playbook stage was left incomplete for this decision."],
    institutionalBestPractice: "Institutional review separates process from outcome deliberately — a well-documented, disciplined decision that lost money is still a good decision; an undocumented lucky win is still a process gap. Review the fields above, not the P&L.",
    recurringPatterns: recurringDeviationSummary ?? "Not enough reviewed decisions yet to identify a recurring pattern — this needs at least 2 reviewed decisions sharing the same gap.",
    recommendedLearning: weakParts.length > 0 ? "Start with the weakest field above — its own evidence link points to where to close the gap." : "No specific gap to target right now — keep the process consistent on the next decision.",
    relatedPlaybooks: review.playbookAdherence.map((p) => p.playbookName),
  };
}

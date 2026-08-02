// v1.5.0, Sprint 13 — Institutional Decision Engine.
//
// PURE COMPOSITION, ZERO NEW SCORING FORMULAS OF ITS OWN BUSINESS LOGIC.
// A "Decision" in this module is not a new stored entity — it IS an
// existing Trade Plan (Sprint 10), reused as-is. Direct inspection of
// tradePlansApi.ts found the Trade Plan already models almost the entire
// requested workflow as its own 21 structured sections plus a real,
// already-computed checklist-completion engine
// (TradePlanDetail.checklistProgress) and a "what's missing"
// endpoint (getMissingTradePlanInformation) — reusing these directly
// satisfies "Do not duplicate storage. Reference existing data." literally,
// and needs zero new database table.
//
// Stage -> TradePlanSectionKind mapping (all real, pre-existing kinds from
// tradePlansApi.ts, Sprint 10 — nothing invented here):
//   research  -> market_context
//   evidence  -> research_reference, notebook_reference
//   thesis    -> trade_thesis, bias, catalysts
//   risk      -> stop_loss, maximum_risk, invalidation, risk_reward
//   tradePlan -> TradePlanDetail.checklistProgress.progressPct directly
//                (the SAME "Trade Plan Quality" signal the sprint's own
//                Decision Score example names — reused, not recomputed)
//
// "strategy" is scored from the linked AiStrategy's own
// getMissingSections() completeness (Sprint 9) when strategyId is set,
// honestly "missing" when no strategy is linked yet — never fabricated.
//
// "execution"/"review"/"portfolio" are informational/contextual rather
// than scored pre-execution — a pending decision hasn't been executed
// yet, and treating that as a scoring deficiency would be misleading, not
// honest guidance.
//
// "learning" reflects whether the user has engaged with the ONE
// recommended lesson for this decision's weakest scored stage (via
// DECISION_LEARNING_RECOMMENDATIONS, all real, pre-verified pathKey/
// topicKey pairs from learningPaths.ts, the same verification discipline
// Sprint 11's moduleLearnRegistry.ts already established).

import type { CoachId } from "./ai-coach/capabilityRegistry";
import type { TradePlanDetail, TradePlanSectionKind, MissingTradePlanInfoResult } from "./ai-coach/tradePlansApi";
import type { AiStrategyDetail } from "./ai-coach/strategiesApi";
import type { MissingSectionsResult } from "./ai-coach/strategiesApi";

export type DecisionStageId =
  | "research"
  | "evidence"
  | "thesis"
  | "risk"
  | "strategy"
  | "tradePlan"
  | "execution"
  | "review"
  | "portfolio"
  | "learning";

export type StageCompletionStatus = "complete" | "partial" | "missing" | "not-applicable";

export interface DecisionStage {
  id: DecisionStageId;
  label: string;
  status: StageCompletionStatus;
  /** 0-100, or null when the stage is genuinely not-applicable yet (e.g. execution/review/portfolio pre-trade). */
  confidence: number | null;
  missingInfo: string[];
  recommendedAction: string;
  href: string | null;
}

export interface DecisionScore {
  overall: number;
  label: "Well-Prepared" | "Developing" | "Early Stage" | "Just Started";
  /** Which stages actually fed the overall average — never a fabricated component. */
  componentStageIds: DecisionStageId[];
}

const RESEARCH_KINDS: TradePlanSectionKind[] = ["market_context"];
const EVIDENCE_KINDS: TradePlanSectionKind[] = ["research_reference", "notebook_reference"];
const THESIS_KINDS: TradePlanSectionKind[] = ["trade_thesis", "bias", "catalysts"];
const RISK_KINDS: TradePlanSectionKind[] = ["stop_loss", "maximum_risk", "invalidation", "risk_reward"];

const SECTION_LABELS: Record<TradePlanSectionKind, string> = {
  market_context: "Market Context",
  trade_thesis: "Trade Thesis",
  bias: "Bias",
  catalysts: "Catalysts",
  entry_zone: "Entry Zone",
  confirmation_rules: "Confirmation Rules",
  invalidation: "Invalidation",
  stop_loss: "Stop Loss",
  target_1: "Target 1",
  target_2: "Target 2",
  target_3: "Target 3",
  risk_reward: "Risk / Reward",
  maximum_risk: "Maximum Risk",
  position_size_notes: "Position Size Notes",
  trade_management: "Trade Management",
  exit_plan: "Exit Plan",
  psychology_checklist: "Psychology Checklist",
  personal_notes: "Personal Notes",
  attachment: "Attachments",
  research_reference: "Research References",
  notebook_reference: "Notebook References",
};

function kindGroupConfidence(
  kinds: TradePlanSectionKind[],
  missingInfo: MissingTradePlanInfoResult,
): { confidence: number; missing: TradePlanSectionKind[] } {
  const missing = kinds.filter((k) => missingInfo.missing.includes(k));
  const presentCount = kinds.length - missing.length;
  const confidence = kinds.length === 0 ? 100 : Math.round((presentCount / kinds.length) * 100);
  return { confidence, missing };
}

function statusFromConfidence(confidence: number): StageCompletionStatus {
  if (confidence >= 100) return "complete";
  if (confidence > 0) return "partial";
  return "missing";
}

export interface ReviewContext {
  /** Whether a journal entry already exists referencing the resulting trade/position. Null before execution. */
  hasJournalEntry: boolean | null;
}

export interface PortfolioContext {
  /** Whether the planned symbol currently appears among the user's real, already-fetched open positions/watchlist. */
  currentlyHeldOrWatched: boolean;
  sourceLabel: string;
}

export interface LearningContext {
  /** Whether the user has viewed/completed the ONE recommended lesson for this decision's weakest stage. */
  engagedWithRecommendedLesson: boolean;
  recommendedPathKey: string | null;
  recommendedTopicKey: string | null;
  recommendedLabel: string | null;
}

export interface ComputeCoreDecisionStagesInput {
  tradePlan: TradePlanDetail;
  missingInfo: MissingTradePlanInfoResult;
  strategy: AiStrategyDetail | null;
  strategyMissingSections: MissingSectionsResult | null;
  review: ReviewContext;
  portfolio: PortfolioContext;
}

// v1.5.0, Sprint 13 — real, pre-verified pathKey/topicKey pairs (checked
// directly against learningPaths.ts's own LEARNING_PATHS array before
// being committed, the same verification discipline moduleLearnRegistry.ts
// established in Sprint 11 — never guessed). "strategy"/"tradePlan" reuse
// Sprint 11's own already-verified registry entries directly rather than
// re-declaring them a second time.
export const DECISION_LEARNING_RECOMMENDATIONS: Partial<
  Record<DecisionStageId, Partial<Record<CoachId, { pathKey: string; topicKey: string; label: string }>>>
> = {
  research: {
    investing: { pathKey: "institutional-investing", topicKey: "investing-research-workflow", label: "Research Workflow" },
    trading: { pathKey: "trading-engine", topicKey: "trading-market-structure", label: "Market Structure" },
  },
  thesis: {
    investing: { pathKey: "institutional-investing", topicKey: "investing-margin-of-safety", label: "Margin of Safety" },
  },
  risk: {
    trading: { pathKey: "trading-engine", topicKey: "trading-risk-management", label: "Risk Management" },
    options: { pathKey: "options-income-engine", topicKey: "options-risk-management", label: "Options Risk Management" },
    investing: { pathKey: "institutional", topicKey: "institutional-risk-contribution", label: "Risk Contribution" },
  },
  strategy: {
    investing: { pathKey: "ai-academy", topicKey: "ai-team-overview", label: "AI Team Overview" },
    trading: { pathKey: "ai-academy", topicKey: "ai-team-overview", label: "AI Team Overview" },
    options: { pathKey: "ai-academy", topicKey: "ai-team-overview", label: "AI Team Overview" },
  },
  tradePlan: {
    investing: { pathKey: "trading-engine", topicKey: "trading-trade-planning", label: "Trade Planning" },
    trading: { pathKey: "trading-engine", topicKey: "trading-trade-planning", label: "Trade Planning" },
    options: { pathKey: "trading-engine", topicKey: "trading-trade-planning", label: "Trade Planning" },
  },
};

function recommendedLessonFor(coachId: CoachId, weakestStageId: DecisionStageId | null) {
  if (!weakestStageId) return null;
  return DECISION_LEARNING_RECOMMENDATIONS[weakestStageId]?.[coachId] ?? null;
}

// Computes the 9 core stages (everything except "learning," which needs
// the CORE stages' own result first, to know which stage is weakest —
// see buildLearningStage() below and the orchestrating hook that composes
// the two in the correct order).
export function computeCoreDecisionStages(input: ComputeCoreDecisionStagesInput): DecisionStage[] {
  const { tradePlan, missingInfo, strategy, strategyMissingSections, review, portfolio } = input;

  const research = kindGroupConfidence(RESEARCH_KINDS, missingInfo);
  const evidence = kindGroupConfidence(EVIDENCE_KINDS, missingInfo);
  const thesis = kindGroupConfidence(THESIS_KINDS, missingInfo);
  const risk = kindGroupConfidence(RISK_KINDS, missingInfo);
  const tradePlanConfidence = tradePlan.checklistProgress.progressPct;

  const strategyConfidence = strategy ? (strategyMissingSections?.completenessPct ?? 0) : null;

  const stages: DecisionStage[] = [
    {
      id: "research",
      label: "Research",
      status: statusFromConfidence(research.confidence),
      confidence: research.confidence,
      missingInfo: research.missing.map((k) => SECTION_LABELS[k]),
      recommendedAction: research.missing.length > 0 ? `Add ${research.missing.map((k) => SECTION_LABELS[k]).join(", ")} to the trade plan.` : "Research context is documented.",
      href: `/assistant`,
    },
    {
      id: "evidence",
      label: "Evidence Collection",
      status: statusFromConfidence(evidence.confidence),
      confidence: evidence.confidence,
      missingInfo: evidence.missing.map((k) => SECTION_LABELS[k]),
      recommendedAction: evidence.missing.length > 0 ? "Link a research reference or a notebook to this trade plan." : "Evidence is linked.",
      href: `/assistant`,
    },
    {
      id: "thesis",
      label: "Investment / Trade Thesis",
      status: statusFromConfidence(thesis.confidence),
      confidence: thesis.confidence,
      missingInfo: thesis.missing.map((k) => SECTION_LABELS[k]),
      recommendedAction: thesis.missing.length > 0 ? `Write ${thesis.missing.map((k) => SECTION_LABELS[k]).join(", ")}.` : "Thesis is documented.",
      href: `/assistant`,
    },
    {
      id: "risk",
      label: "Risk Assessment",
      status: statusFromConfidence(risk.confidence),
      confidence: risk.confidence,
      missingInfo: risk.missing.map((k) => SECTION_LABELS[k]),
      recommendedAction: risk.missing.length > 0 ? `Define ${risk.missing.map((k) => SECTION_LABELS[k]).join(", ")}.` : "Risk is defined.",
      href: `/assistant`,
    },
    {
      id: "strategy",
      label: "Strategy Selection",
      status: strategy ? statusFromConfidence(strategyConfidence ?? 0) : "missing",
      confidence: strategyConfidence,
      missingInfo: strategy ? (strategyMissingSections?.missing ?? []).map(String) : ["No strategy linked"],
      recommendedAction: strategy ? "Strategy is linked." : "Link an existing strategy, or build a new one.",
      href: `/assistant`,
    },
    {
      id: "tradePlan",
      label: "Trade Plan",
      status: statusFromConfidence(tradePlanConfidence),
      confidence: tradePlanConfidence,
      missingInfo: tradePlan.checklistItems.filter((c) => c.required && !c.completed).map((c) => c.label),
      recommendedAction: tradePlan.checklistProgress.readyForEntry ? "Trade plan checklist is ready for entry." : "Complete the remaining required checklist items.",
      href: `/assistant`,
    },
    {
      id: "execution",
      label: "Execution (External Broker)",
      status: tradePlan.executedTradeRef ? "complete" : "not-applicable",
      confidence: null,
      missingInfo: [],
      recommendedAction: tradePlan.executedTradeRef
        ? "Executed."
        : "Execute manually at your own external broker, then mark the trade plan executed.",
      href: null,
    },
    {
      id: "review",
      label: "Trade Review",
      status: !tradePlan.executedTradeRef ? "not-applicable" : review.hasJournalEntry ? "complete" : "missing",
      confidence: !tradePlan.executedTradeRef ? null : review.hasJournalEntry ? 100 : 0,
      missingInfo: !tradePlan.executedTradeRef || review.hasJournalEntry ? [] : ["Journal entry"],
      recommendedAction: !tradePlan.executedTradeRef
        ? "Available once executed."
        : review.hasJournalEntry
          ? "Reviewed in the Trade Journal."
          : "Log this trade in the Trade Journal.",
      href: "/trading-journal",
    },
    {
      id: "portfolio",
      label: "Portfolio Impact",
      status: "not-applicable",
      confidence: null,
      missingInfo: [],
      recommendedAction: portfolio.currentlyHeldOrWatched
        ? `Already reflected in your ${portfolio.sourceLabel}.`
        : `Not currently held or watched — review portfolio impact before executing.`,
      href: "/portfolio-dashboard",
    },
  ];

  return stages;
}

// Built separately from computeCoreDecisionStages() because it needs that
// function's own result first (to know which stage is weakest) — see
// buildLearningContext() above and the orchestrating hook, which calls
// these three functions in order: core stages -> weakest stage ->
// learning context -> this function -> [...coreStages, learningStage].
export function buildLearningStage(learning: LearningContext): DecisionStage {
  return {
    id: "learning",
    label: "Continuous Learning",
    status: learning.recommendedTopicKey ? (learning.engagedWithRecommendedLesson ? "complete" : "missing") : "not-applicable",
    confidence: null, // informational/coaching only — never part of the Decision Score itself.
    missingInfo: learning.recommendedTopicKey && !learning.engagedWithRecommendedLesson ? [learning.recommendedLabel ?? "Recommended lesson"] : [],
    recommendedAction: learning.recommendedTopicKey
      ? learning.engagedWithRecommendedLesson
        ? "Recommended lesson viewed."
        : `Review "${learning.recommendedLabel}" — recommended for this decision's weakest area.`
      : "No specific lesson recommended right now.",
    href: "/learn",
  };
}

// Per the sprint's own Decision Score examples (research completeness,
// risk assessment, strategy readiness, trade plan quality, overall
// confidence) — deliberately excludes "review"/"portfolio" (both
// genuinely not-applicable pre-execution, confidence null already, so
// they'd never contribute anyway) and "learning" (a coaching nudge, not a
// decision-readiness signal — never penalizes/rewards the score for
// lesson engagement).
const SCORED_STAGE_IDS: DecisionStageId[] = ["research", "evidence", "thesis", "risk", "strategy", "tradePlan"];

export function computeDecisionScore(stages: DecisionStage[]): DecisionScore {
  const scored = stages.filter((s) => SCORED_STAGE_IDS.includes(s.id) && s.confidence !== null);
  const overall = scored.length === 0 ? 0 : Math.round(scored.reduce((sum, s) => sum + (s.confidence ?? 0), 0) / scored.length);
  const label: DecisionScore["label"] = overall >= 80 ? "Well-Prepared" : overall >= 60 ? "Developing" : overall >= 35 ? "Early Stage" : "Just Started";
  return { overall, label, componentStageIds: scored.map((s) => s.id) };
}

export function weakestScoredStage(stages: DecisionStage[]): DecisionStage | null {
  const scored = stages.filter((s) => SCORED_STAGE_IDS.includes(s.id) && s.confidence !== null);
  if (scored.length === 0) return null;
  return [...scored].sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0))[0];
}

// ─── AI Decision Coach — deterministic text templating over the already-
// computed stages/score above, never a new scoring formula and never an
// LLM call of its own (the page's real "Ask the AI Coach" button reuses
// the platform's existing AskCoachLauncher/AI Coach directly). This is the
// same "compose a plain-English explanation from already-computed fields"
// pattern useWorkflowSnapshot.ts's NotificationsCard action-item list
// already established, Sprint 12. ─────────────────────────────────────

export interface DecisionCoachNarrative {
  scoreExplanation: string;
  positiveFactors: string[];
  negativeFactors: string[];
  missingEvidence: string[];
  assumptionsToTest: string[];
  risksToReview: string[];
  nextReview: string;
}

// A factor "contributes positively" at a high, honest confidence bar
// (>=70) and "reduces confidence" below a middling one (<50) — a stage
// sitting between the two is neither praised nor blamed, it's simply
// "developing," matching the same spirit as DecisionScore's own label
// bands just above. Never fabricated: only stages that actually fed the
// score (SCORED_STAGE_IDS, confidence !== null) are considered.
const POSITIVE_FACTOR_THRESHOLD = 70;
const NEGATIVE_FACTOR_THRESHOLD = 50;

function scoredFactorLines(stages: DecisionStage[], score: DecisionScore): { positive: string[]; negative: string[] } {
  const scored = stages.filter((s) => score.componentStageIds.includes(s.id) && s.confidence !== null);
  const positive = scored
    .filter((s) => (s.confidence ?? 0) >= POSITIVE_FACTOR_THRESHOLD)
    .map((s) => `${s.label} (${s.confidence}%)`);
  const negative = scored
    .filter((s) => (s.confidence ?? 0) < NEGATIVE_FACTOR_THRESHOLD)
    .map((s) => `${s.label} (${s.confidence}%)${s.missingInfo.length > 0 ? ` — ${s.missingInfo[0]}` : ""}`);
  return { positive, negative };
}

export function buildDecisionCoachNarrative(
  stages: DecisionStage[],
  score: DecisionScore,
  weakest: DecisionStage | null,
): DecisionCoachNarrative {
  const scoredLabels = stages.filter((s) => score.componentStageIds.includes(s.id)).map((s) => s.label);
  const scoreExplanation =
    score.componentStageIds.length === 0
      ? "No scored readiness signals are available yet — start with Research and Risk Assessment."
      : `Your Decision Score is ${score.overall}/100 (${score.label}), averaged across ${score.componentStageIds.length} readiness signal${score.componentStageIds.length === 1 ? "" : "s"}: ${scoredLabels.join(", ")}.`;

  const { positive: positiveFactors, negative: negativeFactors } = scoredFactorLines(stages, score);

  const missingEvidence = stages
    .filter((s) => (s.id === "research" || s.id === "evidence") && s.missingInfo.length > 0)
    .flatMap((s) => s.missingInfo.map((m) => `${s.label}: ${m}`));

  const thesisStage = stages.find((s) => s.id === "thesis");
  const assumptionsToTest =
    thesisStage && thesisStage.missingInfo.length > 0
      ? thesisStage.missingInfo.map((m) => `Thesis: ${m} not yet documented.`)
      : ["Thesis is documented — verify the stated assumptions against real invalidation triggers before acting."];

  const riskStage = stages.find((s) => s.id === "risk");
  const risksToReview =
    riskStage && riskStage.missingInfo.length > 0
      ? riskStage.missingInfo.map((m) => `Risk: ${m} not yet defined.`)
      : ["Risk is defined — review stop-loss/maximum-risk sizing against your own account risk tolerance."];

  const nextReview = weakest
    ? `${weakest.label} (${weakest.confidence ?? 0}%): ${weakest.recommendedAction}`
    : "All scored stages are complete for this decision — no immediate readiness gap.";

  return { scoreExplanation, positiveFactors, negativeFactors, missingEvidence, assumptionsToTest, risksToReview, nextReview };
}

// ─── Decision Trace — a reusable, per-factor explainability panel.
// Explicitly, per the approved scope: "the trace should reference existing
// module data rather than duplicating it" — every field below is derived
// directly from the already-computed DecisionStage array (itself already
// pure composition over Trade Plan/Strategy data, see the top of this
// file); no new scoring, no new database read. Never displayed without a
// score — the panel and the score are rendered together on the page. ────

export type DecisionTraceIcon = "check" | "warning" | "unavailable";

export interface DecisionTraceEntry {
  id: DecisionStageId;
  label: string;
  icon: DecisionTraceIcon;
  statusLabel: string;
  detail: string;
  sourceModule: string;
  assumption: string | null;
}

// "Which module supplied the information" — named explicitly per the
// approved scope, so a user never has to guess where a figure came from.
const TRACE_SOURCE_MODULES: Record<DecisionStageId, string> = {
  research: "Trade Plan — Market Context section",
  evidence: "Trade Plan — Research/Notebook reference sections",
  thesis: "Trade Plan — Thesis, Bias & Catalysts sections",
  risk: "Trade Plan — Stop Loss, Max Risk, Invalidation & Risk/Reward sections",
  strategy: "Strategy Builder",
  tradePlan: "Trade Plan checklist engine",
  execution: "Trade Plan — executed trade reference",
  review: "Trading Journal",
  portfolio: "Value Watchlist / Trading Positions / Open Options Trades",
  learning: "Learning Centre",
};

const TRACE_LABELS: Record<DecisionStageId, string> = {
  research: "Research Completeness",
  evidence: "Evidence Collection",
  thesis: "Investment / Trade Thesis",
  risk: "Risk Assessment",
  strategy: "Strategy Validation",
  tradePlan: "Trade Plan",
  execution: "Execution",
  review: "Journal History",
  portfolio: "Portfolio Exposure",
  learning: "Continuous Learning",
};

function confidenceStrengthLabel(confidence: number): string {
  if (confidence >= 90) return "Strong";
  if (confidence >= 70) return "Solid";
  if (confidence >= 50) return "Moderate";
  if (confidence > 0) return "Weak";
  return "Missing";
}

function traceEntryFor(stage: DecisionStage): DecisionTraceEntry {
  const sourceModule = TRACE_SOURCE_MODULES[stage.id];
  const label = TRACE_LABELS[stage.id];
  const assumption =
    stage.id === "thesis" || stage.id === "risk"
      ? stage.missingInfo.length > 0
        ? `Assumes ${stage.missingInfo.join(", ")} will be documented before acting.`
        : "Assumes the documented thesis/risk figures remain valid at entry."
      : null;

  if (stage.status === "not-applicable") {
    return { id: stage.id, label, icon: "unavailable", statusLabel: "Not yet applicable", detail: stage.recommendedAction, sourceModule, assumption };
  }
  if (stage.status === "complete") {
    const statusLabel = stage.confidence !== null ? confidenceStrengthLabel(stage.confidence) : "Complete";
    return { id: stage.id, label, icon: "check", statusLabel, detail: stage.recommendedAction, sourceModule, assumption };
  }
  // partial or missing — always a real, named gap, never a bare "incomplete."
  const gap = stage.missingInfo[0];
  const statusLabel =
    stage.status === "partial"
      ? `Moderate${gap ? ` — missing ${gap}` : ""}`
      : gap
        ? `Missing ${gap}`
        : "Missing";
  return { id: stage.id, label, icon: "warning", statusLabel, detail: stage.recommendedAction, sourceModule, assumption };
}

export function buildDecisionTrace(stages: DecisionStage[]): DecisionTraceEntry[] {
  return stages.map(traceEntryFor);
}

export function buildLearningContext(
  coachId: CoachId,
  weakestStageId: DecisionStageId | null,
  completedLessonKeys: string[],
  recentHistory: { itemKey: string }[],
): LearningContext {
  const rec = recommendedLessonFor(coachId, weakestStageId);
  if (!rec) {
    return { engagedWithRecommendedLesson: false, recommendedPathKey: null, recommendedTopicKey: null, recommendedLabel: null };
  }
  const engaged = completedLessonKeys.includes(rec.topicKey) || recentHistory.some((h) => h.itemKey === rec.topicKey);
  return {
    engagedWithRecommendedLesson: engaged,
    recommendedPathKey: rec.pathKey,
    recommendedTopicKey: rec.topicKey,
    recommendedLabel: rec.label,
  };
}

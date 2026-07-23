// Phase 32 — Institutional Trading Analytics Engine.
//
// ANALYTICS AND REPORTING PHASE. This file computes nothing new: every
// figure below is a direct read, count, tally, or simple aggregate (sum/
// average/bucket) of data ALREADY PERSISTED by an earlier phase, or of a
// value an already-shipped, already-tested engine already computed
// (computeChecklistCompletion(), activeSessionsAt(), getLearningProgress()).
// Nothing here implements or evaluates ICT/SMC/ASAD/Trader Bill/Tom Nash/
// Dunni Framework, generates a trading signal, predicts a probability, or
// executes anything against a broker. No automated entries/exits.
//
// Genuine, disclosed scope boundary: there is no persisted history of
// Market Structure/Liquidity/Session analyses (those engines compute live
// from a MarketDataProvider on every request, they are never logged) — so
// Structure Analytics and Liquidity Analytics here are honestly built from
// the two real, PERSISTED proxies that do exist: (1) how many times the
// Structure/Liquidity Trading AI Coach was consulted (learning_progress
// itemType="coach" rows), and (2) how many registered strategies cite
// Market Structure/Liquidity as required evidence (trading_strategies.
// requiredEvidence). Neither is a re-derivation of a structure/liquidity
// reading itself — both are usage counts over already-recorded rows.
//
// Session Analytics reuses activeSessionsAt() (lib/trading/sessionService.ts,
// Phase 25/27) completely unmodified to classify real
// trading_positions.entryDate timestamps into the 4 real named sessions
// (sydney/tokyo/london/new_york) — never a synthetic session, never a new
// classification rule. The brief's own "London / New York / Asia /
// overlap" vocabulary is a pure relabeling for display: Asia = sydney +
// tokyo combined, overlap = any timestamp where activeSessionsAt() itself
// returns more than one session name.

import {
  computeChecklistCompletion,
  EVIDENCE_SOURCE_TYPES,
  type StrategyMetadata,
  type StrategyChecklistInstance,
  type EvidenceSourceType,
} from "./tradingStrategyFramework.js";
import { activeSessionsAt } from "./trading/sessionService.js";
import type { TradingSessionName } from "./tradingDomainModel.js";
import type { LearningProgressSummary } from "./learningProgress.js";
import { TRADING_COACH_TYPES, type TradingCoachType } from "./tradingCoach.js";

// ─── Overview ────────────────────────────────────────────────────────────

export interface TradingAnalyticsOverview {
  tradesReviewed: number; // trading_positions row count
  plansCreated: number; // trading_trade_plans row count
  journalEntries: number; // trading_journal_entries row count
  workspaceNotes: number; // trading_workspace_notes row count (excluding Strategy Notes, see below)
  strategiesRegistered: number;
  checklistInstances: number;
  generatedAt: string;
}

export interface MinimalPositionRow {
  entryDate: Date | string;
  stopPrice: number | null;
  targetPrice: number | null;
}

export interface MinimalTradePlanRow {
  accountRiskPct: number;
  riskRewardRatio: number | null;
  positionSize: number | null;
}

export interface MinimalJournalRow {
  mood: string;
  setupType: string | null;
  lessonLearned: string | null;
  rMultiple: number | null;
}

export interface MinimalWorkspaceNoteRow {
  symbol: string;
}

export function buildOverview(
  positions: MinimalPositionRow[],
  plans: MinimalTradePlanRow[],
  journalEntries: MinimalJournalRow[],
  workspaceNotes: MinimalWorkspaceNoteRow[],
  strategies: StrategyMetadata[],
  checklists: StrategyChecklistInstance[],
): TradingAnalyticsOverview {
  return {
    tradesReviewed: positions.length,
    plansCreated: plans.length,
    journalEntries: journalEntries.length,
    // Strategy Notes (Phase 31) are stored in the same table under a
    // STRATEGY:<id> pseudo-symbol — excluded here so "workspace usage"
    // only counts genuine per-symbol Trade Workspace notes, never double-
    // counting Strategy Workbench activity that has its own section below.
    workspaceNotes: workspaceNotes.filter((n) => !n.symbol.startsWith("STRATEGY:")).length,
    strategiesRegistered: strategies.length,
    checklistInstances: checklists.length,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Strategy Usage Analytics ────────────────────────────────────────────

export interface StrategyUsageAnalytics {
  strategiesRegistered: number;
  checklistInstances: number;
  checklistsComplete: number;
  checklistsInProgress: number;
  overallChecklistCompletionPct: number; // 0-100, honestly 0 when there are no checklists
  requiredEvidenceByType: Record<EvidenceSourceType, number>; // how many strategies declare each evidence type required
  evidenceLinksAttachedByType: Record<EvidenceSourceType, number>; // how many real checklist items actually carry an evidence link of that type
}

export function buildStrategyUsageAnalytics(
  strategies: StrategyMetadata[],
  checklists: StrategyChecklistInstance[],
): StrategyUsageAnalytics {
  const requiredEvidenceByType = Object.fromEntries(EVIDENCE_SOURCE_TYPES.map((t) => [t, 0])) as Record<EvidenceSourceType, number>;
  for (const s of strategies) {
    for (const ev of s.requiredEvidence) requiredEvidenceByType[ev] = (requiredEvidenceByType[ev] ?? 0) + 1;
  }

  const evidenceLinksAttachedByType = Object.fromEntries(EVIDENCE_SOURCE_TYPES.map((t) => [t, 0])) as Record<EvidenceSourceType, number>;
  for (const c of checklists) {
    for (const item of c.items) {
      for (const link of item.evidenceLinks) evidenceLinksAttachedByType[link.sourceType] = (evidenceLinksAttachedByType[link.sourceType] ?? 0) + 1;
    }
  }

  const checklistsComplete = checklists.filter((c) => c.status === "complete").length;
  const completionPcts = checklists.map((c) => computeChecklistCompletion(c.items).percentComplete);
  const overallChecklistCompletionPct =
    completionPcts.length === 0 ? 0 : Math.round((completionPcts.reduce((a, b) => a + b, 0) / completionPcts.length) * 10) / 10;

  return {
    strategiesRegistered: strategies.length,
    checklistInstances: checklists.length,
    checklistsComplete,
    checklistsInProgress: checklists.length - checklistsComplete,
    overallChecklistCompletionPct,
    requiredEvidenceByType,
    evidenceLinksAttachedByType,
  };
}

// ─── Journal Analytics ────────────────────────────────────────────────────

export interface RMultipleBucket {
  label: string;
  min: number | null; // null = unbounded below
  max: number | null; // null = unbounded above
  count: number;
}

export interface JournalAnalytics {
  entryCount: number;
  moodTally: Record<string, number>;
  setupTypeTally: Record<string, number>;
  lessonRecordedCount: number;
  lessonRecordedPct: number; // 0-100
  rMultipleEntriesCount: number; // entries that actually recorded an rMultiple
  averageRMultiple: number | null; // null when no entry recorded one — never fabricated
  rMultipleDistribution: RMultipleBucket[];
}

const R_MULTIPLE_BUCKETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "< -1R", min: null, max: -1 },
  { label: "-1R to 0R", min: -1, max: 0 },
  { label: "0R to 1R", min: 0, max: 1 },
  { label: "1R to 2R", min: 1, max: 2 },
  { label: "> 2R", min: 2, max: null },
];

export function buildJournalAnalytics(entries: MinimalJournalRow[]): JournalAnalytics {
  const moodTally: Record<string, number> = {};
  const setupTypeTally: Record<string, number> = {};
  let lessonRecordedCount = 0;
  const rMultiples: number[] = [];

  for (const e of entries) {
    moodTally[e.mood] = (moodTally[e.mood] ?? 0) + 1;
    if (e.setupType) setupTypeTally[e.setupType] = (setupTypeTally[e.setupType] ?? 0) + 1;
    if (e.lessonLearned && e.lessonLearned.trim().length > 0) lessonRecordedCount += 1;
    if (e.rMultiple !== null && e.rMultiple !== undefined && Number.isFinite(e.rMultiple)) rMultiples.push(e.rMultiple);
  }

  const rMultipleDistribution: RMultipleBucket[] = R_MULTIPLE_BUCKETS.map((b) => ({
    ...b,
    count: rMultiples.filter((r) => (b.min === null || r >= b.min) && (b.max === null || r < b.max)).length,
  }));

  return {
    entryCount: entries.length,
    moodTally,
    setupTypeTally,
    lessonRecordedCount,
    lessonRecordedPct: entries.length === 0 ? 0 : Math.round((lessonRecordedCount / entries.length) * 1000) / 10,
    rMultipleEntriesCount: rMultiples.length,
    averageRMultiple: rMultiples.length === 0 ? null : Math.round((rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length) * 100) / 100,
    rMultipleDistribution,
  };
}

// ─── Risk Analytics ───────────────────────────────────────────────────────
// Deliberately scoped to real, already-recorded Trade Plan parameters —
// never a re-run of the live, provider-dependent Risk Engine (a real-time
// analysis, not a history log). Position-sizing/stop-target discipline
// figures over already-open positions are likewise a direct read.

export interface RiskAnalytics {
  plansWithRiskParams: number;
  averageAccountRiskPct: number | null;
  riskRewardDistribution: RMultipleBucket[]; // reuses the same bucket shape for R:R ratios
  averageRiskRewardRatio: number | null;
  positionsWithBothStopAndTarget: number;
  positionsWithNeitherStopNorTarget: number;
  openPositionsCount: number;
  stopTargetDisciplinePct: number; // 0-100, % of positions with both a stop and a target set
}

const RR_BUCKETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "< 1:1", min: null, max: 1 },
  { label: "1:1 to 2:1", min: 1, max: 2 },
  { label: "2:1 to 3:1", min: 2, max: 3 },
  { label: "> 3:1", min: 3, max: null },
];

export function buildRiskAnalytics(plans: MinimalTradePlanRow[], positions: MinimalPositionRow[]): RiskAnalytics {
  const riskPcts = plans.map((p) => p.accountRiskPct).filter((v) => Number.isFinite(v));
  const rrRatios = plans.map((p) => p.riskRewardRatio).filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));

  const riskRewardDistribution: RMultipleBucket[] = RR_BUCKETS.map((b) => ({
    ...b,
    count: rrRatios.filter((r) => (b.min === null || r >= b.min) && (b.max === null || r < b.max)).length,
  }));

  const withBoth = positions.filter((p) => p.stopPrice !== null && p.targetPrice !== null).length;
  const withNeither = positions.filter((p) => p.stopPrice === null && p.targetPrice === null).length;

  return {
    plansWithRiskParams: plans.length,
    averageAccountRiskPct: riskPcts.length === 0 ? null : Math.round((riskPcts.reduce((a, b) => a + b, 0) / riskPcts.length) * 100) / 100,
    riskRewardDistribution,
    averageRiskRewardRatio: rrRatios.length === 0 ? null : Math.round((rrRatios.reduce((a, b) => a + b, 0) / rrRatios.length) * 100) / 100,
    positionsWithBothStopAndTarget: withBoth,
    positionsWithNeitherStopNorTarget: withNeither,
    openPositionsCount: positions.length,
    stopTargetDisciplinePct: positions.length === 0 ? 0 : Math.round((withBoth / positions.length) * 1000) / 10,
  };
}

// ─── Learning Analytics ───────────────────────────────────────────────────
// A pure reformatting of getLearningProgress()'s own already-computed
// LearningProgressSummary — no recomputation, no prediction.

export interface WeakTopicPath {
  pathKey: string;
  title: string;
  percentComplete: number;
}

export interface LearningAnalytics {
  lessonsViewed: number;
  lessonsCompleted: number;
  glossaryTermsViewed: number;
  strategiesViewed: number;
  coachesViewed: number;
  totalTopics: number;
  completedTopics: number;
  remainingTopics: number;
  // Paths below a completion threshold, sorted lowest-first — never a
  // prediction of what a user "should" study next, just an honest sort of
  // real, already-computed percentages.
  weakestPaths: WeakTopicPath[];
}

const WEAK_PATH_THRESHOLD_PCT = 50;

export function buildLearningAnalytics(progress: LearningProgressSummary): LearningAnalytics {
  const totalTopics = progress.pathCompletion.reduce((sum, p) => sum + p.topicsTotal, 0);
  const completedTopics = progress.pathCompletion.reduce((sum, p) => sum + p.topicsCompleted, 0);

  const weakestPaths = [...progress.pathCompletion]
    .filter((p) => p.topicsTotal > 0 && p.percentComplete < WEAK_PATH_THRESHOLD_PCT)
    .sort((a, b) => a.percentComplete - b.percentComplete)
    .map((p) => ({ pathKey: p.pathKey, title: p.title, percentComplete: p.percentComplete }));

  return {
    lessonsViewed: progress.lessonsViewed,
    lessonsCompleted: progress.lessonsCompleted,
    glossaryTermsViewed: progress.glossaryTermsViewed,
    strategiesViewed: progress.strategiesViewed,
    coachesViewed: progress.coachesViewed,
    totalTopics,
    completedTopics,
    remainingTopics: totalTopics - completedTopics,
    weakestPaths,
  };
}

// ─── Coach Analytics ──────────────────────────────────────────────────────
// Parses the already-recorded learning_progress itemKey format
// "<coachType>:<symbolOrAccount>" (established by
// components/coach/TradingCoachDrawer.tsx, Phase 29) — never a new
// tracking mechanism, purely a read of what's already there.

export interface CoachUsageRow {
  coach: TradingCoachType;
  label: string;
  viewCount: number;
}

export interface CoachAnalytics {
  totalCoachViews: number;
  byType: CoachUsageRow[]; // one row per TradingCoachType, zero-filled for types never used
  mostRecentCoach: TradingCoachType | null;
  mostRecentScope: string | null; // the symbol or "account" the most recent view was scoped to
  mostRecentViewedAt: string | null;
}

export interface CoachProgressRow {
  itemKey: string;
  viewedAt: string;
}

const TRADING_COACH_LABELS_FOR_ANALYTICS: Record<TradingCoachType, string> = {
  structure: "Structure Coach",
  liquidity: "Liquidity Coach",
  session: "Session Coach",
  risk: "Risk Coach",
  "trade-plan": "Trade Plan Coach",
  journal: "Journal Coach",
  scenario: "Scenario Coach",
  psychology: "Psychology & Discipline Coach",
  strategy: "Strategy Coach",
};

export function buildCoachAnalytics(coachRows: CoachProgressRow[]): CoachAnalytics {
  const counts = Object.fromEntries(TRADING_COACH_TYPES.map((t) => [t, 0])) as Record<TradingCoachType, number>;
  let mostRecent: { coach: TradingCoachType; scope: string; viewedAt: string } | null = null;

  for (const row of coachRows) {
    const sepIdx = row.itemKey.indexOf(":");
    if (sepIdx < 0) continue;
    const coach = row.itemKey.slice(0, sepIdx) as TradingCoachType;
    const scope = row.itemKey.slice(sepIdx + 1);
    if (!TRADING_COACH_TYPES.includes(coach)) continue;
    counts[coach] += 1;
    if (!mostRecent || new Date(row.viewedAt).getTime() > new Date(mostRecent.viewedAt).getTime()) {
      mostRecent = { coach, scope, viewedAt: row.viewedAt };
    }
  }

  const byType: CoachUsageRow[] = TRADING_COACH_TYPES.map((coach) => ({
    coach,
    label: TRADING_COACH_LABELS_FOR_ANALYTICS[coach],
    viewCount: counts[coach],
  }));

  return {
    totalCoachViews: coachRows.length,
    byType,
    mostRecentCoach: mostRecent?.coach ?? null,
    mostRecentScope: mostRecent?.scope ?? null,
    mostRecentViewedAt: mostRecent?.viewedAt ?? null,
  };
}

// ─── Session Analytics ────────────────────────────────────────────────────
// Reuses activeSessionsAt() (unmodified) to classify real position entry
// timestamps. "Asia" = sydney + tokyo combined; "overlap" = any timestamp
// where more than one session window was open.

export type SessionDisplayLabel = "Asia" | "London" | "New York" | "Overlap";

export interface SessionActivityRow {
  label: SessionDisplayLabel;
  count: number;
}

export interface SessionAnalytics {
  totalClassified: number; // positions with a resolvable entryDate
  activity: SessionActivityRow[]; // Asia / London / New York / Overlap, in that order
  rawSessionCounts: Record<TradingSessionName, number>; // the underlying real 4-window tally, for detail views
}

export function buildSessionAnalytics(positions: MinimalPositionRow[]): SessionAnalytics {
  const rawSessionCounts: Record<TradingSessionName, number> = { sydney: 0, tokyo: 0, london: 0, new_york: 0 };
  let asia = 0;
  let london = 0;
  let newYork = 0;
  let overlap = 0;
  let totalClassified = 0;

  for (const p of positions) {
    const date = p.entryDate instanceof Date ? p.entryDate : new Date(p.entryDate);
    if (Number.isNaN(date.getTime())) continue;
    totalClassified += 1;
    const active = activeSessionsAt(date);
    for (const s of active) rawSessionCounts[s] += 1;
    if (active.length > 1) overlap += 1;
    if (active.includes("sydney") || active.includes("tokyo")) asia += 1;
    if (active.includes("london")) london += 1;
    if (active.includes("new_york")) newYork += 1;
  }

  return {
    totalClassified,
    activity: [
      { label: "Asia", count: asia },
      { label: "London", count: london },
      { label: "New York", count: newYork },
      { label: "Overlap", count: overlap },
    ],
    rawSessionCounts,
  };
}

// ─── Structure / Liquidity Analytics ──────────────────────────────────────
// Disclosed proxy, per this file's own header comment: no structure/
// liquidity analysis is ever persisted, so these count real USAGE of the
// existing Structure/Liquidity Coach and real strategy evidence citations
// — never a re-derivation of a structure/liquidity reading itself.

export interface EngineUsageAnalytics {
  coachViewCount: number;
  strategiesRequiringAsEvidence: number;
  evidenceLinksAttached: number;
}

export function buildStructureAnalytics(coachAnalytics: CoachAnalytics, strategyUsage: StrategyUsageAnalytics): EngineUsageAnalytics {
  return {
    coachViewCount: coachAnalytics.byType.find((r) => r.coach === "structure")?.viewCount ?? 0,
    strategiesRequiringAsEvidence: strategyUsage.requiredEvidenceByType.structure,
    evidenceLinksAttached: strategyUsage.evidenceLinksAttachedByType.structure,
  };
}

export function buildLiquidityAnalytics(coachAnalytics: CoachAnalytics, strategyUsage: StrategyUsageAnalytics): EngineUsageAnalytics {
  return {
    coachViewCount: coachAnalytics.byType.find((r) => r.coach === "liquidity")?.viewCount ?? 0,
    strategiesRequiringAsEvidence: strategyUsage.requiredEvidenceByType.liquidity,
    evidenceLinksAttached: strategyUsage.evidenceLinksAttachedByType.liquidity,
  };
}

// ─── Checklist Analytics ──────────────────────────────────────────────────

export interface ChecklistAnalyticsRow {
  strategyId: number;
  strategyName: string;
  instanceCount: number;
  completeCount: number;
  averagePercentComplete: number;
}

export interface ChecklistAnalytics {
  totalInstances: number;
  totalComplete: number;
  totalInProgress: number;
  overallCompletionPct: number;
  byStrategy: ChecklistAnalyticsRow[];
}

export function buildChecklistAnalytics(
  strategies: StrategyMetadata[],
  checklists: StrategyChecklistInstance[],
): ChecklistAnalytics {
  const nameById = new Map(strategies.map((s) => [s.id, s.name]));
  const byStrategyMap = new Map<number, StrategyChecklistInstance[]>();
  for (const c of checklists) {
    const list = byStrategyMap.get(c.strategyId) ?? [];
    list.push(c);
    byStrategyMap.set(c.strategyId, list);
  }

  const byStrategy: ChecklistAnalyticsRow[] = [...byStrategyMap.entries()].map(([strategyId, list]) => {
    const pcts = list.map((c) => computeChecklistCompletion(c.items).percentComplete);
    return {
      strategyId,
      strategyName: nameById.get(strategyId) ?? `Strategy #${strategyId}`,
      instanceCount: list.length,
      completeCount: list.filter((c) => c.status === "complete").length,
      averagePercentComplete: pcts.length === 0 ? 0 : Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10,
    };
  });

  const totalComplete = checklists.filter((c) => c.status === "complete").length;

  return {
    totalInstances: checklists.length,
    totalComplete,
    totalInProgress: checklists.length - totalComplete,
    overallCompletionPct:
      checklists.length === 0
        ? 0
        : Math.round(
            (checklists.map((c) => computeChecklistCompletion(c.items).percentComplete).reduce((a, b) => a + b, 0) / checklists.length) * 10,
          ) / 10,
    byStrategy,
  };
}

// ─── Full Dashboard Composition ───────────────────────────────────────────

export interface TradingAnalyticsDashboard {
  overview: TradingAnalyticsOverview;
  strategyUsage: StrategyUsageAnalytics;
  journal: JournalAnalytics;
  risk: RiskAnalytics;
  learning: LearningAnalytics;
  coach: CoachAnalytics;
  session: SessionAnalytics;
  structure: EngineUsageAnalytics;
  liquidity: EngineUsageAnalytics;
  checklist: ChecklistAnalytics;
}

export function buildTradingAnalyticsDashboard(input: {
  positions: MinimalPositionRow[];
  plans: MinimalTradePlanRow[];
  journalEntries: MinimalJournalRow[];
  workspaceNotes: MinimalWorkspaceNoteRow[];
  strategies: StrategyMetadata[];
  checklists: StrategyChecklistInstance[];
  learningProgress: LearningProgressSummary;
  coachProgressRows: CoachProgressRow[];
}): TradingAnalyticsDashboard {
  const strategyUsage = buildStrategyUsageAnalytics(input.strategies, input.checklists);
  const coach = buildCoachAnalytics(input.coachProgressRows);

  return {
    overview: buildOverview(input.positions, input.plans, input.journalEntries, input.workspaceNotes, input.strategies, input.checklists),
    strategyUsage,
    journal: buildJournalAnalytics(input.journalEntries),
    risk: buildRiskAnalytics(input.plans, input.positions),
    learning: buildLearningAnalytics(input.learningProgress),
    coach,
    session: buildSessionAnalytics(input.positions),
    structure: buildStructureAnalytics(coach, strategyUsage),
    liquidity: buildLiquidityAnalytics(coach, strategyUsage),
    checklist: buildChecklistAnalytics(input.strategies, input.checklists),
  };
}

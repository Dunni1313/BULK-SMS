// Phase 33 — Institutional Executive Intelligence & Reporting Hub.
//
// AGGREGATION, REPORTING AND EXECUTIVE-WORKFLOW PHASE. PURE COMPOSITION —
// this file introduces no new engine, no new scoring system, no automated
// entry/exit, no trading signal, no forecast, no AI prediction, and no
// probability engine. It unifies the Institutional Investing Engine's own
// analytics (lib/investingAnalytics.ts, this phase) and the Institutional
// Trading Engine's own analytics (lib/tradingAnalytics.ts, Phase 32,
// reused here completely UNMODIFIED) into a single executive view, plus two
// genuinely new-but-still-purely-aggregating pieces this phase adds: a
// Reporting Summary (a tally over the shared institutional_reports table)
// and an Activity Timeline (a chronological merge of several tables' own
// already-persisted timestamped rows). Nothing here is fetched from a live
// market-data provider, an AI model, or a broker.
//
// Ten sections, matching the phase brief's own requested shape exactly:
//   overview     — Executive Overview (a small cross-engine KPI rollup)
//   investing    — Investing Summary  (= the full InvestingAnalyticsDashboard)
//   trading      — Trading Summary    (= the full TradingAnalyticsDashboard, Phase 32, untouched)
//   strategy     — Strategy Summary   (= trading.strategyUsage, a pass-through, not a duplicate)
//   portfolio    — Portfolio Summary  (= investing.portfolio, a pass-through, not a duplicate)
//   risk         — Risk Summary       (a small cross-engine risk rollup)
//   learning     — Learning Summary   (= trading.learning, reused as-is — LEARNING_PATHS
//                                        already spans both engines, so this is genuinely
//                                        cross-engine data already, never recomputed twice)
//   coach        — AI Coach Summary   (combines both engines' own already-correctly-scoped
//                                        coach totals — see the note below on why this never
//                                        double-counts)
//   reporting    — Reporting Summary  (new: tally + most-recent over institutional_reports)
//   activity     — Activity Timeline  (new: chronological merge of several already-persisted
//                                        tables' own rows)
//
// Coach-total note: lib/investingAnalytics.ts's own buildCoachAnalytics()
// (this phase) and lib/tradingAnalytics.ts's own buildCoachAnalytics()
// (Phase 32) each independently, correctly filter learning_progress rows to
// only their own engine's coach-type vocabulary before counting — see
// lib/investingAnalytics.ts's header comment for the full disclosed design
// note on why this matters (both a "risk" investing coach and a "risk"
// trading coach exist, and both engines' coaches share the same
// learning_progress itemType). Trading's own dashboard.coach.totalCoachViews
// field is DELIBERATELY NOT reused directly here — Trading's own
// buildCoachAnalytics() still reports it as the RAW unfiltered row count
// (a pre-existing, already-shipped Phase 32 behavior this phase does not
// modify), so this file instead derives "trading coach views" as the sum
// of trading.coach.byType's own per-coach counts (which ARE correctly
// filtered), the same technique investingAnalytics.ts's own totalCoachViews
// already uses — avoiding any double-counting without touching Phase 32's
// shipped code at all.

import type { InvestingAnalyticsDashboard } from "./investingAnalytics.js";
import type { TradingAnalyticsDashboard, LearningAnalytics } from "./tradingAnalytics.js";

// ─── Executive Overview ───────────────────────────────────────────────────

export interface ExecutiveOverview {
  portfoliosCreated: number;
  holdingsTracked: number;
  researchNotesWritten: number;
  watchlistItems: number;
  committeeSnapshotsSaved: number;
  tradesReviewed: number;
  tradePlansCreated: number;
  journalEntries: number;
  strategiesRegistered: number;
  checklistInstances: number;
  learningTopicsCompleted: number;
  learningTopicsTotal: number;
  totalCoachViews: number;
  reportsGenerated: number;
  reportCategoriesUsed: number;
  generatedAt: string;
  // A single deterministic, rule-based sentence built only from the fields
  // above — never LLM-generated, never a prediction, never a recommendation.
  summary: string;
}

function buildExecutiveOverview(
  investing: InvestingAnalyticsDashboard,
  trading: TradingAnalyticsDashboard,
  learning: LearningAnalytics,
  totalCoachViews: number,
  reportsGenerated: number,
  reportCategoriesUsed: number,
): ExecutiveOverview {
  const summary =
    `${investing.overview.portfoliosCreated} investing portfolio(s), ${trading.overview.tradesReviewed} trading position(s) reviewed, ` +
    `${investing.overview.committeeSnapshotsSaved} committee snapshot(s), ${trading.overview.strategiesRegistered} strategy(ies) registered, ` +
    `${learning.completedTopics} of ${learning.totalTopics} learning topic(s) completed, ${totalCoachViews} AI Coach view(s), ` +
    `${reportsGenerated} report(s) generated across ${reportCategoriesUsed} categor${reportCategoriesUsed === 1 ? "y" : "ies"}.`;

  return {
    portfoliosCreated: investing.overview.portfoliosCreated,
    holdingsTracked: investing.overview.holdingsTracked,
    researchNotesWritten: investing.overview.researchNotesWritten,
    watchlistItems: investing.overview.watchlistItems,
    committeeSnapshotsSaved: investing.overview.committeeSnapshotsSaved,
    tradesReviewed: trading.overview.tradesReviewed,
    tradePlansCreated: trading.overview.plansCreated,
    journalEntries: trading.overview.journalEntries,
    strategiesRegistered: trading.overview.strategiesRegistered,
    checklistInstances: trading.overview.checklistInstances,
    learningTopicsCompleted: learning.completedTopics,
    learningTopicsTotal: learning.totalTopics,
    totalCoachViews,
    reportsGenerated,
    reportCategoriesUsed,
    generatedAt: new Date().toISOString(),
    summary,
  };
}

// ─── Risk Summary ──────────────────────────────────────────────────────────
// A small cross-engine rollup, never a re-run of either engine's own live
// risk analysis — every field here is a direct pass-through/read of a
// value each engine's own dashboard already computed from persisted data.

export interface ExecutiveRiskSummary {
  investingRiskSnapshotsSaved: number;
  investingMostRecentRiskScore: number | null;
  tradingOpenPositionsCount: number;
  tradingStopTargetDisciplinePct: number;
}

function buildExecutiveRiskSummary(investing: InvestingAnalyticsDashboard, trading: TradingAnalyticsDashboard): ExecutiveRiskSummary {
  return {
    investingRiskSnapshotsSaved: investing.risk.snapshotCount,
    investingMostRecentRiskScore: investing.risk.mostRecentOverallScore,
    tradingOpenPositionsCount: trading.risk.openPositionsCount,
    tradingStopTargetDisciplinePct: trading.risk.stopTargetDisciplinePct,
  };
}

// ─── AI Coach Summary ──────────────────────────────────────────────────────

export interface ExecutiveCoachSummary {
  investingCoachViews: number;
  tradingCoachViews: number;
  totalCoachViews: number;
  mostRecentEngine: "investing" | "trading" | null;
  mostRecentCoach: string | null;
  mostRecentViewedAt: string | null;
}

function buildExecutiveCoachSummary(investing: InvestingAnalyticsDashboard, trading: TradingAnalyticsDashboard): ExecutiveCoachSummary {
  // trading.coach.totalCoachViews is deliberately NOT used here — see this
  // file's own header comment. tradingCoachViews is instead derived from
  // byType's own correctly-filtered per-coach counts.
  const tradingCoachViews = trading.coach.byType.reduce((sum, r) => sum + r.viewCount, 0);
  const investingCoachViews = investing.coach.totalCoachViews;

  const investingMostRecent = investing.coach.mostRecentViewedAt ? new Date(investing.coach.mostRecentViewedAt).getTime() : null;
  const tradingMostRecent = trading.coach.mostRecentViewedAt ? new Date(trading.coach.mostRecentViewedAt).getTime() : null;

  let mostRecentEngine: "investing" | "trading" | null = null;
  let mostRecentCoach: string | null = null;
  let mostRecentViewedAt: string | null = null;
  if (investingMostRecent !== null && (tradingMostRecent === null || investingMostRecent >= tradingMostRecent)) {
    mostRecentEngine = "investing";
    mostRecentCoach = investing.coach.mostRecentCoach;
    mostRecentViewedAt = investing.coach.mostRecentViewedAt;
  } else if (tradingMostRecent !== null) {
    mostRecentEngine = "trading";
    mostRecentCoach = trading.coach.mostRecentCoach;
    mostRecentViewedAt = trading.coach.mostRecentViewedAt;
  }

  return {
    investingCoachViews,
    tradingCoachViews,
    totalCoachViews: investingCoachViews + tradingCoachViews,
    mostRecentEngine,
    mostRecentCoach,
    mostRecentViewedAt,
  };
}

// ─── Reporting Summary ─────────────────────────────────────────────────────
// A pure tally over the shared institutional_reports table (Phase 22) — no
// new report content, purely counting/sorting already-saved rows.

export interface MinimalReportRow {
  id: number;
  reportType: string;
  title: string;
  createdAt: Date | string;
}

export interface ReportingSummaryTypeRow {
  reportType: string;
  count: number;
}

export interface RecentReportRef {
  id: number;
  reportType: string;
  title: string;
  createdAt: string;
}

export interface ExecutiveReportingSummary {
  totalReports: number;
  distinctReportTypesUsed: number;
  byType: ReportingSummaryTypeRow[]; // sorted by count, descending
  recentReports: RecentReportRef[]; // most recent N, newest first
}

const RECENT_REPORTS_LIMIT = 10;

// Version 1.0.0 Finalization hardening — totalCount is an optional,
// explicit override for the TRUE total row count. Genuine bug found and
// fixed this pass: routes/executiveIntelligence.ts's own reportRows query
// caps at RECENT_ROWS_LIMIT (50, for the recent-activity/byType-breakdown
// use case, a legitimate and disclosed bound) BEFORE ever reaching this
// function — so for any user with more than 50 reports, `rows.length`
// silently stopped being the true total and got permanently stuck at 50,
// never increasing again no matter how many more reports were generated.
// Defaults to `rows.length` (unchanged, byte-identical behavior) when
// omitted — lib/portfolioWorkspace.ts's own call site never hits this bug
// in the first place, since its own query is genuinely unbounded, so it
// intentionally does not pass this parameter.
export function buildReportingSummary(rows: MinimalReportRow[], limit: number = RECENT_REPORTS_LIMIT, totalCount?: number): ExecutiveReportingSummary {
  const tally: Record<string, number> = {};
  for (const r of rows) tally[r.reportType] = (tally[r.reportType] ?? 0) + 1;
  const byType: ReportingSummaryTypeRow[] = Object.entries(tally)
    .map(([reportType, count]) => ({ reportType, count }))
    .sort((a, b) => b.count - a.count);

  const recentReports: RecentReportRef[] = [...rows]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map((r) => ({ id: r.id, reportType: r.reportType, title: r.title, createdAt: new Date(r.createdAt).toISOString() }));

  return {
    totalReports: totalCount ?? rows.length,
    distinctReportTypesUsed: byType.length,
    byType,
    recentReports,
  };
}

// ─── Activity Timeline ─────────────────────────────────────────────────────
// A chronological merge of several already-persisted tables' own rows —
// never a new event log, never a fabricated activity. Each source table is
// read exactly as it already exists; this function only sorts and caps.

export type ExecutiveActivityEntryType =
  | "journal-entry"
  | "committee-snapshot"
  | "risk-snapshot"
  | "optimisation-review"
  | "research-note"
  | "report-generated"
  | "notification";

export type ExecutiveActivityEngine = "investing" | "trading" | "platform";

export interface ExecutiveActivityEntry {
  type: ExecutiveActivityEntryType;
  engine: ExecutiveActivityEngine;
  label: string;
  detail: string;
  occurredAt: string;
  symbol: string | null;
  // A relative deep-link path the frontend can navigate to for more detail
  // — e.g. the Reporting Centre for a saved report, the Investment
  // Committee Workbench for a committee snapshot. Null when no dedicated
  // detail page exists for this entry type.
  linkPath: string | null;
}

export interface ActivityTimelineInput {
  journalEntries: { title: string; createdAt: Date | string }[];
  committeeSnapshots: { symbol: string; recommendation: string; createdAt: Date | string }[];
  riskSnapshots: { overallScore: number | null; createdAt: Date | string }[];
  optimisationReviews: { symbol: string | null; action: string; createdAt: Date | string }[];
  researchNotes: { symbol: string; createdAt: Date | string }[];
  reports: MinimalReportRow[];
  notifications: { title: string; message: string; relatedSymbol: string | null; createdAt: Date | string }[];
}

const ACTIVITY_TIMELINE_LIMIT = 50;

export function buildActivityTimeline(input: ActivityTimelineInput, limit: number = ACTIVITY_TIMELINE_LIMIT): ExecutiveActivityEntry[] {
  const entries: ExecutiveActivityEntry[] = [];

  for (const j of input.journalEntries) {
    entries.push({
      type: "journal-entry",
      engine: "trading",
      label: "Trading Journal Entry",
      detail: j.title,
      occurredAt: new Date(j.createdAt).toISOString(),
      symbol: null,
      linkPath: "/trading-journal",
    });
  }

  for (const c of input.committeeSnapshots) {
    entries.push({
      type: "committee-snapshot",
      engine: "investing",
      label: "Investment Committee Snapshot",
      detail: `${c.symbol}: ${c.recommendation}`,
      occurredAt: new Date(c.createdAt).toISOString(),
      symbol: c.symbol,
      linkPath: `/investment-committee-workbench?symbol=${encodeURIComponent(c.symbol)}`,
    });
  }

  for (const r of input.riskSnapshots) {
    entries.push({
      type: "risk-snapshot",
      engine: "investing",
      label: "Portfolio Risk Snapshot",
      detail: r.overallScore !== null ? `Overall risk score: ${r.overallScore}` : "Risk score unavailable at time of save",
      occurredAt: new Date(r.createdAt).toISOString(),
      symbol: null,
      linkPath: "/portfolio-risk-dashboard",
    });
  }

  for (const o of input.optimisationReviews) {
    entries.push({
      type: "optimisation-review",
      engine: "investing",
      label: "Portfolio Optimisation Review",
      detail: o.symbol ? `${o.symbol}: ${o.action}` : `Portfolio-level review: ${o.action}`,
      occurredAt: new Date(o.createdAt).toISOString(),
      symbol: o.symbol,
      linkPath: "/portfolio-optimizer",
    });
  }

  for (const n of input.researchNotes) {
    entries.push({
      type: "research-note",
      engine: "investing",
      label: "Research Note",
      detail: `Note added for ${n.symbol}`,
      occurredAt: new Date(n.createdAt).toISOString(),
      symbol: n.symbol,
      linkPath: `/research-terminal?symbol=${encodeURIComponent(n.symbol)}`,
    });
  }

  for (const r of input.reports) {
    entries.push({
      type: "report-generated",
      engine: "platform",
      label: "Report Generated",
      detail: r.title,
      occurredAt: new Date(r.createdAt).toISOString(),
      symbol: null,
      linkPath: "/reporting-centre",
    });
  }

  for (const n of input.notifications) {
    entries.push({
      type: "notification",
      engine: "platform",
      label: n.title,
      detail: n.message,
      occurredAt: new Date(n.createdAt).toISOString(),
      symbol: n.relatedSymbol,
      linkPath: null,
    });
  }

  return entries.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, limit);
}

// ─── Full Hub Composition ──────────────────────────────────────────────────

export interface ExecutiveIntelligenceHub {
  overview: ExecutiveOverview;
  investing: InvestingAnalyticsDashboard;
  trading: TradingAnalyticsDashboard;
  strategy: TradingAnalyticsDashboard["strategyUsage"];
  portfolio: InvestingAnalyticsDashboard["portfolio"];
  risk: ExecutiveRiskSummary;
  learning: LearningAnalytics;
  coach: ExecutiveCoachSummary;
  reporting: ExecutiveReportingSummary;
  activity: ExecutiveActivityEntry[];
}

export function buildExecutiveIntelligenceHub(input: {
  investing: InvestingAnalyticsDashboard;
  trading: TradingAnalyticsDashboard;
  reportRows: MinimalReportRow[];
  // Version 1.0.0 Finalization — the TRUE total report count for this
  // user, when the caller's own reportRows query is itself bounded (see
  // buildReportingSummary's own header comment). Optional, defaulting to
  // reportRows.length, so every existing caller/test is unaffected.
  totalReportsOverride?: number;
  activityInput: ActivityTimelineInput;
}): ExecutiveIntelligenceHub {
  const { investing, trading } = input;
  const reporting = buildReportingSummary(input.reportRows, undefined, input.totalReportsOverride);
  const coach = buildExecutiveCoachSummary(investing, trading);
  const overview = buildExecutiveOverview(investing, trading, trading.learning, coach.totalCoachViews, reporting.totalReports, reporting.distinctReportTypesUsed);

  return {
    overview,
    investing,
    trading,
    strategy: trading.strategyUsage,
    portfolio: investing.portfolio,
    risk: buildExecutiveRiskSummary(investing, trading),
    learning: trading.learning,
    coach,
    reporting,
    activity: buildActivityTimeline(input.activityInput),
  };
}

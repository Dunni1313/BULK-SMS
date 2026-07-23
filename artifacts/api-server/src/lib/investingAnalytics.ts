// Phase 33 — Institutional Executive Intelligence & Reporting Hub.
//
// ANALYTICS AND REPORTING PHASE. This file computes nothing new: every
// figure below is a direct read, count, tally, or simple aggregate (sum/
// average/bucket) of data ALREADY PERSISTED by an earlier phase for the
// Institutional Investing Engine — portfolios, holdings, research notes,
// the value watchlist, saved Investment Committee decision snapshots,
// saved portfolio risk snapshots, saved optimisation reviews, saved
// screener criteria, and Institutional AI Coach usage. Nothing here
// implements or evaluates a new valuation model, generates a trading/
// investing signal, predicts a probability, or executes anything against a
// broker. This is the Investing Engine's own analog of
// lib/tradingAnalytics.ts (Phase 32) — same discipline, mirrored shape,
// applied to the Investing Engine's own already-persisted tables.
//
// Genuine, disclosed design note: lib/tradingAnalytics.ts's own
// buildCoachAnalytics() reports `totalCoachViews` as the RAW row count of
// every learning_progress row with itemType="coach" passed to it — but
// since BOTH the Investing Engine's 8 coaches (investingCoach.ts) and the
// Trading Engine's 9 coaches (tradingCoach.ts) share that exact same
// itemType, a user who has viewed coaches from both engines would have
// Trading's own totalCoachViews figure quietly include Investing coach
// views too (and vice versa, if this file made the same choice). This
// file's own buildCoachAnalytics() below deliberately does NOT repeat that
// pattern: totalCoachViews here is derived as the sum of `byType`'s own
// per-coach counts, each of which is only incremented when the row's
// itemKey prefix matches one of THIS engine's own 8 CoachTypes — a row
// belonging to the other engine's coach vocabulary is silently excluded
// from every count in this file, never double-counted. See
// lib/executiveIntelligence.ts for how the two engines' coach totals are
// combined without inflation.

import { COACH_TYPES, COACH_LABELS, type CoachType } from "./investingCoach.js";

// ─── Overview ────────────────────────────────────────────────────────────

export interface InvestingAnalyticsOverview {
  portfoliosCreated: number; // investing_portfolios row count
  holdingsTracked: number; // investing_holdings row count
  researchNotesWritten: number; // investing_research_notes row count
  watchlistItems: number; // value_watchlist row count
  committeeSnapshotsSaved: number; // investing_decision_snapshots row count
  riskSnapshotsSaved: number; // investing_risk_snapshots row count
  optimisationReviewsSaved: number; // investing_optimisation_reviews row count
  savedScreens: number; // investing_saved_screens row count
  generatedAt: string;
}

export interface MinimalPortfolioRow {
  id: number;
}

export interface MinimalHoldingRow {
  portfolioId: number;
  symbol: string;
}

export interface MinimalResearchNoteRow {
  symbol: string;
  createdAt: Date | string;
}

export interface MinimalWatchlistRow {
  symbol: string;
  category: string;
  currentDecision: string;
}

export interface MinimalDecisionSnapshotRow {
  symbol: string;
  recommendation: string;
  confidence: number;
  createdAt: Date | string;
}

export interface MinimalRiskSnapshotRow {
  overallScore: number | null;
  createdAt: Date | string;
}

export interface MinimalOptimisationReviewRow {
  symbol: string | null; // carried through for the Activity Timeline (lib/executiveIntelligence.ts); never read by buildOptimisationAnalytics()
  action: string;
  createdAt: Date | string;
}

export interface MinimalSavedScreenRow {
  id: number;
}

export function buildOverview(
  portfolios: MinimalPortfolioRow[],
  holdings: MinimalHoldingRow[],
  researchNotes: MinimalResearchNoteRow[],
  watchlist: MinimalWatchlistRow[],
  decisionSnapshots: MinimalDecisionSnapshotRow[],
  riskSnapshots: MinimalRiskSnapshotRow[],
  optimisationReviews: MinimalOptimisationReviewRow[],
  savedScreens: MinimalSavedScreenRow[],
): InvestingAnalyticsOverview {
  return {
    portfoliosCreated: portfolios.length,
    holdingsTracked: holdings.length,
    researchNotesWritten: researchNotes.length,
    watchlistItems: watchlist.length,
    committeeSnapshotsSaved: decisionSnapshots.length,
    riskSnapshotsSaved: riskSnapshots.length,
    optimisationReviewsSaved: optimisationReviews.length,
    savedScreens: savedScreens.length,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Portfolio Analytics ──────────────────────────────────────────────────

export interface InvestingPortfolioAnalytics {
  portfolioCount: number;
  totalHoldings: number;
  averageHoldingsPerPortfolio: number; // 0 when there are no portfolios, never fabricated
  distinctSymbolsHeld: number;
}

export function buildPortfolioAnalytics(portfolios: MinimalPortfolioRow[], holdings: MinimalHoldingRow[]): InvestingPortfolioAnalytics {
  const distinctSymbolsHeld = new Set(holdings.map((h) => h.symbol.toUpperCase())).size;
  return {
    portfolioCount: portfolios.length,
    totalHoldings: holdings.length,
    averageHoldingsPerPortfolio: portfolios.length === 0 ? 0 : Math.round((holdings.length / portfolios.length) * 10) / 10,
    distinctSymbolsHeld,
  };
}

// ─── Research Analytics ───────────────────────────────────────────────────

export interface InvestingResearchAnalytics {
  noteCount: number;
  distinctSymbolsResearched: number;
  mostRecentNoteAt: string | null; // null when no note has ever been written — never fabricated
}

export function buildResearchAnalytics(notes: MinimalResearchNoteRow[]): InvestingResearchAnalytics {
  const distinctSymbolsResearched = new Set(notes.map((n) => n.symbol.toUpperCase())).size;
  let mostRecent: number | null = null;
  for (const n of notes) {
    const t = new Date(n.createdAt).getTime();
    if (mostRecent === null || t > mostRecent) mostRecent = t;
  }
  return {
    noteCount: notes.length,
    distinctSymbolsResearched,
    mostRecentNoteAt: mostRecent === null ? null : new Date(mostRecent).toISOString(),
  };
}

// ─── Watchlist Analytics ──────────────────────────────────────────────────

export interface InvestingWatchlistAnalytics {
  itemCount: number;
  categoryTally: Record<string, number>;
  decisionTally: Record<string, number>;
}

export function buildWatchlistAnalytics(rows: MinimalWatchlistRow[]): InvestingWatchlistAnalytics {
  const categoryTally: Record<string, number> = {};
  const decisionTally: Record<string, number> = {};
  for (const r of rows) {
    categoryTally[r.category] = (categoryTally[r.category] ?? 0) + 1;
    decisionTally[r.currentDecision] = (decisionTally[r.currentDecision] ?? 0) + 1;
  }
  return { itemCount: rows.length, categoryTally, decisionTally };
}

// ─── Committee (Decision Snapshot) Analytics ──────────────────────────────
// Reads the real, persisted trace of Investment Committee activity — the
// investing_decision_snapshots table, written only via an explicit "Save
// Snapshot" action (Phase 14). The live Investment Committee verdict itself
// (ValueResearchReport.investmentCommittee) is never re-derived here.

export interface InvestingCommitteeAnalytics {
  snapshotCount: number;
  recommendationTally: Record<string, number>;
  mostRecentSymbol: string | null;
  mostRecentRecommendation: string | null;
  mostRecentConfidence: number | null;
  mostRecentSavedAt: string | null;
}

export function buildCommitteeAnalytics(rows: MinimalDecisionSnapshotRow[]): InvestingCommitteeAnalytics {
  const recommendationTally: Record<string, number> = {};
  let mostRecent: MinimalDecisionSnapshotRow | null = null;
  for (const r of rows) {
    recommendationTally[r.recommendation] = (recommendationTally[r.recommendation] ?? 0) + 1;
    if (!mostRecent || new Date(r.createdAt).getTime() > new Date(mostRecent.createdAt).getTime()) mostRecent = r;
  }
  return {
    snapshotCount: rows.length,
    recommendationTally,
    mostRecentSymbol: mostRecent?.symbol ?? null,
    mostRecentRecommendation: mostRecent?.recommendation ?? null,
    mostRecentConfidence: mostRecent?.confidence ?? null,
    mostRecentSavedAt: mostRecent ? new Date(mostRecent.createdAt).toISOString() : null,
  };
}

// ─── Risk (Save-Snapshot) Analytics ───────────────────────────────────────
// Deliberately scoped to real, already-saved investing_risk_snapshots rows
// (Phase 2 Sprint 29's own explicit "Save Snapshot" action) — never a
// re-run of the live Portfolio Risk Engine, which is a real-time analysis,
// not a history log.

export interface InvestingRiskAnalytics {
  snapshotCount: number;
  mostRecentOverallScore: number | null;
  averageOverallScore: number | null; // over rows with a non-null score; null when none scored
  mostRecentSavedAt: string | null;
}

export function buildRiskAnalytics(rows: MinimalRiskSnapshotRow[]): InvestingRiskAnalytics {
  let mostRecent: MinimalRiskSnapshotRow | null = null;
  for (const r of rows) {
    if (!mostRecent || new Date(r.createdAt).getTime() > new Date(mostRecent.createdAt).getTime()) mostRecent = r;
  }
  const scored = rows.map((r) => r.overallScore).filter((s): s is number => s !== null && s !== undefined && Number.isFinite(s));
  return {
    snapshotCount: rows.length,
    mostRecentOverallScore: mostRecent?.overallScore ?? null,
    averageOverallScore: scored.length === 0 ? null : Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10,
    mostRecentSavedAt: mostRecent ? new Date(mostRecent.createdAt).toISOString() : null,
  };
}

// ─── Optimisation Review Analytics ────────────────────────────────────────

export interface InvestingOptimisationAnalytics {
  reviewCount: number;
  actionTally: Record<string, number>;
  mostRecentAction: string | null;
  mostRecentSavedAt: string | null;
}

export function buildOptimisationAnalytics(rows: MinimalOptimisationReviewRow[]): InvestingOptimisationAnalytics {
  const actionTally: Record<string, number> = {};
  let mostRecent: MinimalOptimisationReviewRow | null = null;
  for (const r of rows) {
    actionTally[r.action] = (actionTally[r.action] ?? 0) + 1;
    if (!mostRecent || new Date(r.createdAt).getTime() > new Date(mostRecent.createdAt).getTime()) mostRecent = r;
  }
  return {
    reviewCount: rows.length,
    actionTally,
    mostRecentAction: mostRecent?.action ?? null,
    mostRecentSavedAt: mostRecent ? new Date(mostRecent.createdAt).toISOString() : null,
  };
}

// ─── Coach Analytics ──────────────────────────────────────────────────────
// Parses the already-recorded learning_progress itemKey format
// "<coachType>:<symbol>" (established by components/coach/CoachDrawer.tsx,
// Phase 21) — never a new tracking mechanism. See this file's own header
// comment for why totalCoachViews here is derived from byType rather than
// the raw row count.

export interface InvestingCoachUsageRow {
  coach: CoachType;
  label: string;
  viewCount: number;
}

export interface InvestingCoachAnalytics {
  totalCoachViews: number;
  byType: InvestingCoachUsageRow[]; // one row per CoachType, zero-filled for types never used
  mostRecentCoach: CoachType | null;
  mostRecentScope: string | null; // the symbol the most recent view was scoped to
  mostRecentViewedAt: string | null;
}

export interface CoachProgressRow {
  itemKey: string;
  viewedAt: string;
}

export function buildCoachAnalytics(coachRows: CoachProgressRow[]): InvestingCoachAnalytics {
  const counts = Object.fromEntries(COACH_TYPES.map((t) => [t, 0])) as Record<CoachType, number>;
  let mostRecent: { coach: CoachType; scope: string; viewedAt: string } | null = null;

  for (const row of coachRows) {
    const sepIdx = row.itemKey.indexOf(":");
    if (sepIdx < 0) continue;
    const coach = row.itemKey.slice(0, sepIdx) as CoachType;
    const scope = row.itemKey.slice(sepIdx + 1);
    // A row whose prefix isn't one of THIS engine's own coach types belongs
    // to the Trading Engine's coach vocabulary (both share the same
    // learning_progress itemType) — silently excluded, never counted here.
    if (!COACH_TYPES.includes(coach)) continue;
    counts[coach] += 1;
    if (!mostRecent || new Date(row.viewedAt).getTime() > new Date(mostRecent.viewedAt).getTime()) {
      mostRecent = { coach, scope, viewedAt: row.viewedAt };
    }
  }

  const byType: InvestingCoachUsageRow[] = COACH_TYPES.map((coach) => ({
    coach,
    label: COACH_LABELS[coach],
    viewCount: counts[coach],
  }));

  return {
    totalCoachViews: byType.reduce((sum, r) => sum + r.viewCount, 0),
    byType,
    mostRecentCoach: mostRecent?.coach ?? null,
    mostRecentScope: mostRecent?.scope ?? null,
    mostRecentViewedAt: mostRecent?.viewedAt ?? null,
  };
}

// ─── Full Dashboard Composition ───────────────────────────────────────────

export interface InvestingAnalyticsDashboard {
  overview: InvestingAnalyticsOverview;
  portfolio: InvestingPortfolioAnalytics;
  research: InvestingResearchAnalytics;
  watchlist: InvestingWatchlistAnalytics;
  committee: InvestingCommitteeAnalytics;
  risk: InvestingRiskAnalytics;
  optimisation: InvestingOptimisationAnalytics;
  coach: InvestingCoachAnalytics;
}

export function buildInvestingAnalyticsDashboard(input: {
  portfolios: MinimalPortfolioRow[];
  holdings: MinimalHoldingRow[];
  researchNotes: MinimalResearchNoteRow[];
  watchlist: MinimalWatchlistRow[];
  decisionSnapshots: MinimalDecisionSnapshotRow[];
  riskSnapshots: MinimalRiskSnapshotRow[];
  optimisationReviews: MinimalOptimisationReviewRow[];
  savedScreens: MinimalSavedScreenRow[];
  coachProgressRows: CoachProgressRow[];
}): InvestingAnalyticsDashboard {
  return {
    overview: buildOverview(
      input.portfolios,
      input.holdings,
      input.researchNotes,
      input.watchlist,
      input.decisionSnapshots,
      input.riskSnapshots,
      input.optimisationReviews,
      input.savedScreens,
    ),
    portfolio: buildPortfolioAnalytics(input.portfolios, input.holdings),
    research: buildResearchAnalytics(input.researchNotes),
    watchlist: buildWatchlistAnalytics(input.watchlist),
    committee: buildCommitteeAnalytics(input.decisionSnapshots),
    risk: buildRiskAnalytics(input.riskSnapshots),
    optimisation: buildOptimisationAnalytics(input.optimisationReviews),
    coach: buildCoachAnalytics(input.coachProgressRows),
  };
}

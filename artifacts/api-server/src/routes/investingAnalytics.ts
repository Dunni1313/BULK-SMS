// Phase 33 — Institutional Executive Intelligence & Reporting Hub.
//
// Thin route wrapper, zero business logic of its own beyond resolving the
// calling user's own already-persisted rows and handing them to
// lib/investingAnalytics.ts's pure aggregation functions. One eager route
// returning the full dashboard payload in one call, mirroring
// GET /trading/analytics's own Phase 32 precedent — small, bounded per-user
// row counts across 8 tables, cheap enough to compute eagerly.

import { Router, type IRouter } from "express";
import {
  db,
  investingPortfoliosTable,
  investingHoldingsTable,
  investingResearchNotesTable,
  valueWatchlistTable,
  investingDecisionSnapshotsTable,
  investingRiskSnapshotsTable,
  investingOptimisationReviewsTable,
  investingSavedScreensTable,
  learningProgressTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetInvestingAnalyticsDashboardResponse } from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { buildInvestingAnalyticsDashboard } from "../lib/investingAnalytics.js";

const router: IRouter = Router();

export async function loadInvestingAnalyticsInputs(userId: string) {
  const [portfolioRows, holdingRows, noteRows, watchlistRows, decisionRows, riskRows, optimisationRows, screenRows] = await Promise.all([
    db.select().from(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId)),
    db.select().from(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId)),
    db.select().from(investingResearchNotesTable).where(eq(investingResearchNotesTable.userId, userId)),
    db.select().from(valueWatchlistTable).where(eq(valueWatchlistTable.userId, userId)),
    db.select().from(investingDecisionSnapshotsTable).where(eq(investingDecisionSnapshotsTable.userId, userId)),
    db.select().from(investingRiskSnapshotsTable).where(eq(investingRiskSnapshotsTable.userId, userId)),
    db.select().from(investingOptimisationReviewsTable).where(eq(investingOptimisationReviewsTable.userId, userId)),
    db.select().from(investingSavedScreensTable).where(eq(investingSavedScreensTable.userId, userId)),
  ]);

  // learning_progress rows scoped to itemType="coach" — the exact same
  // already-persisted rows components/coach/CoachDrawer.tsx (Phase 21)
  // writes on every "mark as viewed" action, read here directly rather
  // than re-derived. Note this includes BOTH engines' coach rows (the
  // Trading Engine shares this itemType too) — buildCoachAnalytics() below
  // correctly filters to only this engine's own CoachType prefixes.
  const coachRows = await db
    .select({ itemKey: learningProgressTable.itemKey, viewedAt: learningProgressTable.viewedAt, itemType: learningProgressTable.itemType })
    .from(learningProgressTable)
    .where(eq(learningProgressTable.userId, userId));
  const onlyCoachRows = coachRows.filter((r) => r.itemType === "coach").map((r) => ({ itemKey: r.itemKey, viewedAt: r.viewedAt.toISOString() }));

  return {
    portfolios: portfolioRows.map((p) => ({ id: p.id })),
    holdings: holdingRows.map((h) => ({ portfolioId: h.portfolioId, symbol: h.symbol })),
    researchNotes: noteRows.map((n) => ({ symbol: n.symbol, createdAt: n.createdAt })),
    watchlist: watchlistRows.map((w) => ({ symbol: w.symbol, category: w.category, currentDecision: w.currentDecision })),
    decisionSnapshots: decisionRows.map((d) => ({ symbol: d.symbol, recommendation: d.recommendation, confidence: d.confidence, createdAt: d.createdAt })),
    riskSnapshots: riskRows.map((r) => ({ overallScore: r.overallScore, createdAt: r.createdAt })),
    optimisationReviews: optimisationRows.map((o) => ({ symbol: o.symbol, action: o.action, createdAt: o.createdAt })),
    savedScreens: screenRows.map((s) => ({ id: s.id })),
    coachProgressRows: onlyCoachRows,
  };
}

router.get("/investing/analytics", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const inputs = await loadInvestingAnalyticsInputs(userId);
  const dashboard = buildInvestingAnalyticsDashboard(inputs);
  res.json(GetInvestingAnalyticsDashboardResponse.parse(dashboard));
});

export default router;

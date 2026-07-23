// Phase 33 — Institutional Executive Intelligence & Reporting Hub.
//
// Thin route wrapper, zero business logic of its own beyond resolving the
// calling user's own already-persisted rows across BOTH engines and
// handing them to lib/executiveIntelligence.ts's pure composition function.
// Reuses loadInvestingAnalyticsInputs() (this phase) and
// loadTradingAnalyticsInputs() (Phase 32, imported unmodified) exactly as
// their own standalone routes already do — zero duplicated aggregation
// logic. One eager route, mirroring every prior "small, bounded per-user
// row counts, cheap enough to compute eagerly" precedent in this codebase
// (Phase 3 Sprint 50's Institutional Dashboard, Phase 32's Trading
// Analytics Dashboard).

import { Router, type IRouter } from "express";
import {
  db,
  institutionalReportsTable,
  platformNotificationsTable,
  tradingJournalEntriesTable,
} from "@workspace/db";
import { count, desc, eq } from "drizzle-orm";
import { GetExecutiveIntelligenceHubResponse } from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { buildInvestingAnalyticsDashboard } from "../lib/investingAnalytics.js";
import { buildTradingAnalyticsDashboard } from "../lib/tradingAnalytics.js";
import { buildExecutiveIntelligenceHub, type ActivityTimelineInput, type MinimalReportRow } from "../lib/executiveIntelligence.js";
import { loadInvestingAnalyticsInputs } from "./investingAnalytics.js";
import { loadTradingAnalyticsInputs } from "./tradingAnalytics.js";

const router: IRouter = Router();

// Bounded, consistent with the Activity Timeline's own 50-entry output cap
// — no unbounded table scan for a user with a long history.
const RECENT_ROWS_LIMIT = 50;

export async function loadExecutiveIntelligenceInputs(userId: string) {
  const [investingInputs, tradingInputs, reportRows, totalReportsRow, notificationRows, journalRowsForTimeline] = await Promise.all([
    loadInvestingAnalyticsInputs(userId),
    loadTradingAnalyticsInputs(userId),
    db
      .select({ id: institutionalReportsTable.id, reportType: institutionalReportsTable.reportType, title: institutionalReportsTable.title, createdAt: institutionalReportsTable.createdAt })
      .from(institutionalReportsTable)
      .where(eq(institutionalReportsTable.userId, userId))
      .orderBy(desc(institutionalReportsTable.createdAt))
      .limit(RECENT_ROWS_LIMIT),
    // A genuine, uncapped COUNT(*) — separate from the bounded fetch
    // above. Version 1.0.0 Finalization fix: the bounded fetch's own
    // row count is only ever correct for a user with RECENT_ROWS_LIMIT
    // or fewer reports; past that, `reportRows.length` silently and
    // permanently understates the true total. See
    // lib/executiveIntelligence.ts's buildReportingSummary() header
    // comment for the full explanation.
    db.select({ value: count() }).from(institutionalReportsTable).where(eq(institutionalReportsTable.userId, userId)),
    db
      .select({
        title: platformNotificationsTable.title,
        message: platformNotificationsTable.message,
        relatedSymbol: platformNotificationsTable.relatedSymbol,
        createdAt: platformNotificationsTable.createdAt,
      })
      .from(platformNotificationsTable)
      .where(eq(platformNotificationsTable.userId, userId))
      .orderBy(desc(platformNotificationsTable.createdAt))
      .limit(RECENT_ROWS_LIMIT),
    db
      .select({ title: tradingJournalEntriesTable.title, createdAt: tradingJournalEntriesTable.createdAt })
      .from(tradingJournalEntriesTable)
      .where(eq(tradingJournalEntriesTable.userId, userId))
      .orderBy(desc(tradingJournalEntriesTable.createdAt))
      .limit(RECENT_ROWS_LIMIT),
  ]);

  const reports: MinimalReportRow[] = reportRows.map((r) => ({ id: r.id, reportType: r.reportType, title: r.title, createdAt: r.createdAt }));
  const totalReports = totalReportsRow[0]?.value ?? reports.length;

  const activityInput: ActivityTimelineInput = {
    journalEntries: journalRowsForTimeline.map((j) => ({ title: j.title, createdAt: j.createdAt })),
    committeeSnapshots: investingInputs.decisionSnapshots.map((d) => ({ symbol: d.symbol, recommendation: d.recommendation, createdAt: d.createdAt })),
    riskSnapshots: investingInputs.riskSnapshots.map((r) => ({ overallScore: r.overallScore, createdAt: r.createdAt })),
    optimisationReviews: investingInputs.optimisationReviews.map((o) => ({ symbol: o.symbol, action: o.action, createdAt: o.createdAt })),
    researchNotes: investingInputs.researchNotes.map((n) => ({ symbol: n.symbol, createdAt: n.createdAt })),
    reports,
    notifications: notificationRows.map((n) => ({ title: n.title, message: n.message, relatedSymbol: n.relatedSymbol, createdAt: n.createdAt })),
  };

  return { investingInputs, tradingInputs, reportRows: reports, totalReports, activityInput };
}

router.get("/executive/intelligence", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const { investingInputs, tradingInputs, reportRows, totalReports, activityInput } = await loadExecutiveIntelligenceInputs(userId);
  const investing = buildInvestingAnalyticsDashboard(investingInputs);
  const trading = buildTradingAnalyticsDashboard(tradingInputs);
  const hub = buildExecutiveIntelligenceHub({ investing, trading, reportRows, totalReportsOverride: totalReports, activityInput });
  res.json(GetExecutiveIntelligenceHubResponse.parse(hub));
});

export default router;

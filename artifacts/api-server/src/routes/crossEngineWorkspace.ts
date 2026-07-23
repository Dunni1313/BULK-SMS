// Phase 34 — Cross-Engine Orchestration & Unified Workspace.
//
// Thin route wrapper, zero business logic of its own beyond resolving the
// calling user's own already-persisted rows and handing them to
// lib/crossEngineWorkspace.ts's pure functions (and, for the Overview
// route, Phase 33's own already-shipped executive-intelligence composition,
// reused completely unmodified — zero duplicated aggregation logic).
//
// Two routes:
//   GET /workspace/overview — the eager Unified Workspace payload: the
//     full Phase 33 Executive Intelligence Hub, plus this phase's own
//     extended Recent Activity, Cross-Engine Recent Items, and Cross-
//     Engine Tasks. Small, bounded per-user row counts across a handful of
//     tables — cheap enough to compute eagerly, mirroring every prior
//     "small bounded aggregation" precedent in this codebase (Phase 3
//     Sprint 50, Phase 32, Phase 33).
//   GET /workspace/search?q= — on-demand deterministic Global Search over
//     the same 9 entity categories. Re-fetches the calling user's own rows
//     on every call (no caching) — the same "cheap, bounded, per-user"
//     precedent, since this is a search-as-you-type surface the frontend
//     is expected to debounce, not a heavy computation.

import { Router, type IRouter } from "express";
import {
  db,
  investingPortfoliosTable,
  investingHoldingsTable,
  investingResearchNotesTable,
  investingDecisionSnapshotsTable,
  tradingTradePlansTable,
  tradingJournalEntriesTable,
  tradingStrategiesTable,
  tradingPositionsTable,
  platformNotificationsTable,
  institutionalReportsTable,
  learningProgressTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  GetCrossEngineWorkspaceOverviewResponse,
  GetCrossEngineWorkspaceSearchResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { buildInvestingAnalyticsDashboard } from "../lib/investingAnalytics.js";
import { buildTradingAnalyticsDashboard } from "../lib/tradingAnalytics.js";
import { buildExecutiveIntelligenceHub } from "../lib/executiveIntelligence.js";
import {
  buildCrossEngineWorkspaceHub,
  buildGlobalSearchResults,
  type WorkspaceSearchEntities,
  type WorkspaceActivityExtraInput,
} from "../lib/crossEngineWorkspace.js";
import { loadExecutiveIntelligenceInputs } from "./executiveIntelligence.js";
import { allLearningTopics } from "../lib/learningPaths.js";

const router: IRouter = Router();

// Bounded, matching Phase 33's own reports-fetch cap precedent — no
// unbounded table scan for a user with a long report history.
const REPORT_ROWS_LIMIT = 200;

export async function loadWorkspaceExtras(userId: string) {
  const [portfolioRows, holdingRows, noteRows, snapshotRows, planRows, journalRows, strategyRows, notificationRows, positionRows, progressRows, reportRows] =
    await Promise.all([
      db.select().from(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId)),
      db.select().from(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId)),
      db.select().from(investingResearchNotesTable).where(eq(investingResearchNotesTable.userId, userId)),
      db.select().from(investingDecisionSnapshotsTable).where(eq(investingDecisionSnapshotsTable.userId, userId)),
      db.select().from(tradingTradePlansTable).where(eq(tradingTradePlansTable.userId, userId)),
      db.select().from(tradingJournalEntriesTable).where(eq(tradingJournalEntriesTable.userId, userId)),
      db.select().from(tradingStrategiesTable).where(eq(tradingStrategiesTable.userId, userId)),
      db.select().from(platformNotificationsTable).where(eq(platformNotificationsTable.userId, userId)),
      db.select().from(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId)),
      db.select().from(learningProgressTable).where(eq(learningProgressTable.userId, userId)),
      db
        .select({ id: institutionalReportsTable.id, reportType: institutionalReportsTable.reportType, title: institutionalReportsTable.title, createdAt: institutionalReportsTable.createdAt })
        .from(institutionalReportsTable)
        .where(eq(institutionalReportsTable.userId, userId))
        .orderBy(desc(institutionalReportsTable.createdAt))
        .limit(REPORT_ROWS_LIMIT),
    ]);

  const catalogTopics = allLearningTopics();
  const learningTopics = catalogTopics.map((t) => ({ pathKey: t.pathKey, topicKey: t.topic.key, title: t.topic.title }));

  const searchEntities: WorkspaceSearchEntities = {
    portfolios: portfolioRows.map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt })),
    holdings: holdingRows.map((h) => ({ id: h.id, portfolioId: h.portfolioId, symbol: h.symbol, createdAt: h.createdAt })),
    researchNotes: noteRows.map((n) => ({ id: n.id, symbol: n.symbol, note: n.note, createdAt: n.createdAt })),
    committeeSnapshots: snapshotRows.map((s) => ({ id: s.id, symbol: s.symbol, recommendation: s.recommendation, createdAt: s.createdAt })),
    tradePlans: planRows.map((p) => ({ id: p.id, symbol: p.symbol, direction: p.direction, status: p.status, createdAt: p.createdAt })),
    tradingJournal: journalRows.map((j) => ({ id: j.id, title: j.title, content: j.content, createdAt: j.createdAt })),
    strategies: strategyRows.map((s) => ({ id: s.id, name: s.name, description: s.description, category: s.category, createdAt: s.createdAt })),
    reports: reportRows,
    learningTopics,
  };

  const activityExtra: WorkspaceActivityExtraInput = {
    tradePlans: planRows.map((p) => ({ symbol: p.symbol, direction: p.direction, createdAt: p.createdAt })),
    strategies: strategyRows.map((s) => ({ name: s.name, category: s.category, createdAt: s.createdAt })),
    learningCompletions: progressRows
      .filter((r) => r.itemType === "lesson" && r.completedAt !== null)
      .map((r) => {
        const topic = catalogTopics.find((t) => t.topic.key === r.itemKey);
        return { title: topic ? topic.topic.title : r.itemKey, completedAt: r.completedAt as Date };
      }),
  };

  const unreadNotificationsCount = notificationRows.filter((n) => !n.isRead).length;
  const positionsMissingStopOrTargetCount = positionRows.filter(
    (p) => p.status === "open" && (p.stopPrice === null || p.targetPrice === null),
  ).length;
  const portfolioIdsWithHoldings = new Set(holdingRows.map((h) => h.portfolioId));
  const portfoliosWithoutHoldingsCount = portfolioRows.filter((p) => !portfolioIdsWithHoldings.has(p.id)).length;

  return {
    searchEntities,
    activityExtra,
    unreadNotificationsCount,
    positionsMissingStopOrTargetCount,
    portfoliosWithoutHoldingsCount,
  };
}

router.get("/workspace/overview", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const { investingInputs, tradingInputs, reportRows, activityInput } = await loadExecutiveIntelligenceInputs(userId);
  const investing = buildInvestingAnalyticsDashboard(investingInputs);
  const trading = buildTradingAnalyticsDashboard(tradingInputs);
  const intelligence = buildExecutiveIntelligenceHub({ investing, trading, reportRows, activityInput });

  const extras = await loadWorkspaceExtras(userId);
  const workspace = buildCrossEngineWorkspaceHub({
    activityInput,
    activityExtra: extras.activityExtra,
    searchEntities: extras.searchEntities,
    tasksInput: {
      unreadNotificationsCount: extras.unreadNotificationsCount,
      positionsMissingStopOrTargetCount: extras.positionsMissingStopOrTargetCount,
      portfoliosWithoutHoldingsCount: extras.portfoliosWithoutHoldingsCount,
      strategyChecklistsInProgress: trading.strategyUsage.checklistsInProgress,
    },
  });

  res.json(
    GetCrossEngineWorkspaceOverviewResponse.parse({
      intelligence,
      recentActivity: workspace.recentActivity,
      recentItems: workspace.recentItems,
      tasks: workspace.tasks,
      generatedAt: workspace.generatedAt,
    }),
  );
});

router.get("/workspace/search", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const extras = await loadWorkspaceExtras(userId);
  const results = buildGlobalSearchResults(q, extras.searchEntities);
  res.json(GetCrossEngineWorkspaceSearchResponse.parse({ query: q, results, totalMatches: results.length }));
});

export default router;

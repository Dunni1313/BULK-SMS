// Phase 32 — Institutional Trading Analytics Engine.
//
// Thin route wrapper, zero business logic of its own beyond resolving the
// calling user's own already-persisted rows and handing them to
// lib/tradingAnalytics.ts's pure aggregation functions. One eager route
// returning the full dashboard payload in one call, mirroring Phase 3
// Sprint 50's own Institutional Dashboard precedent ("small, bounded item
// counts per user, cheap enough to compute eagerly").

import { Router, type IRouter } from "express";
import {
  db,
  tradingPositionsTable,
  tradingTradePlansTable,
  tradingJournalEntriesTable,
  tradingWorkspaceNotesTable,
  tradingStrategiesTable,
  tradingStrategyChecklistsTable,
  learningProgressTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetTradingAnalyticsDashboardResponse } from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { buildTradingAnalyticsDashboard } from "../lib/tradingAnalytics.js";
import { getLearningProgress } from "../lib/learningProgress.js";
import type { StrategyMetadata, StrategyCategory, EvidenceSourceType, StrategyChecklistInstance, StrategyChecklistItemState } from "../lib/tradingStrategyFramework.js";
import type { Timeframe } from "../lib/tradingMarketData.js";

const router: IRouter = Router();

export async function loadTradingAnalyticsInputs(userId: string) {
  const [positionRows, planRows, journalRows, noteRows, strategyRows, checklistRows, progress] = await Promise.all([
    db.select().from(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId)),
    db.select().from(tradingTradePlansTable).where(eq(tradingTradePlansTable.userId, userId)),
    db.select().from(tradingJournalEntriesTable).where(eq(tradingJournalEntriesTable.userId, userId)),
    db.select().from(tradingWorkspaceNotesTable).where(eq(tradingWorkspaceNotesTable.userId, userId)),
    db.select().from(tradingStrategiesTable).where(eq(tradingStrategiesTable.userId, userId)),
    db.select().from(tradingStrategyChecklistsTable).where(eq(tradingStrategyChecklistsTable.userId, userId)),
    getLearningProgress(userId),
  ]);

  const strategies: StrategyMetadata[] = strategyRows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category as StrategyCategory,
    timeframes: r.timeframes as Timeframe[],
    markets: r.markets as string[],
    requiredEvidence: r.requiredEvidence as EvidenceSourceType[],
    checklist: r.checklist as StrategyMetadata["checklist"],
    educationalNotes: r.educationalNotes,
    references: r.references as string[],
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const checklists: StrategyChecklistInstance[] = checklistRows.map((c) => ({
    id: c.id,
    strategyId: c.strategyId,
    symbol: c.symbol ?? null,
    status: c.status as "in_progress" | "complete",
    items: c.items as StrategyChecklistItemState[],
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  // learning_progress rows scoped to itemType="coach" — the exact same
  // already-persisted rows components/coach/TradingCoachDrawer.tsx (Phase
  // 29) writes on every "mark as viewed" action, read here directly rather
  // than re-derived.
  const coachRows = await db
    .select({ itemKey: learningProgressTable.itemKey, viewedAt: learningProgressTable.viewedAt, itemType: learningProgressTable.itemType })
    .from(learningProgressTable)
    .where(eq(learningProgressTable.userId, userId));
  const onlyCoachRows = coachRows.filter((r) => r.itemType === "coach").map((r) => ({ itemKey: r.itemKey, viewedAt: r.viewedAt.toISOString() }));

  return {
    positions: positionRows.map((p) => ({ entryDate: p.entryDate, stopPrice: p.stopPrice, targetPrice: p.targetPrice })),
    plans: planRows.map((p) => ({ accountRiskPct: p.accountRiskPct, riskRewardRatio: p.riskRewardRatio, positionSize: p.positionSize })),
    journalEntries: journalRows.map((j) => ({ mood: j.mood, setupType: j.setupType, lessonLearned: j.lessonLearned, rMultiple: j.rMultiple })),
    workspaceNotes: noteRows.map((n) => ({ symbol: n.symbol })),
    strategies,
    checklists,
    learningProgress: progress,
    coachProgressRows: onlyCoachRows,
  };
}

router.get("/trading/analytics", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const inputs = await loadTradingAnalyticsInputs(userId);
  const dashboard = buildTradingAnalyticsDashboard(inputs);
  res.json(GetTradingAnalyticsDashboardResponse.parse(dashboard));
});

export default router;

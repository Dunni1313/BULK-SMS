// Phase 35 — Institutional Options Income Engine (Foundation).
//
// Thin route wrapper, zero business logic of its own beyond resolving the
// calling user's own already-persisted `trades` rows and handing them to
// lib/optionsIncomeAnalytics.ts's pure aggregation functions. Reuses
// lib/positionSizing.ts's own already-exported, already-tested
// currentOpenTrades()/buildSnapshot() (Position Sizing sprint) for open-
// position rows and portfolio-wide Greeks/risk totals — zero duplicated
// query or aggregation logic. Live per-position Greeks reuse coach.ts's
// own positionGreeks() (Strategy Academy/Coach sprints), the same
// function every other Greeks-aware surface in this codebase already
// calls.
//
// Four routes:
//   GET /options-income/dashboard — the eager Income Overview/Strategy
//     Mix/Upcoming Expirations payload.
//   GET /options-income/positions?status=open|closed|all — the full
//     Position Model list (Underlying/Strategy/Expiration/Premium/
//     Collateral/Greeks/Status/Lifecycle/Notes).
//   PATCH /options-income/positions/:id/notes — the one genuine gap this
//     phase's audit found (no existing route could edit a trade's own
//     `notes` column) — deliberately scoped to the notes field only,
//     never touching status/legs/pricing/execution.
//   GET /options-income/strategy-library — the static 9-strategy template
//     catalog.

import { Router, type IRouter } from "express";
import { db, tradesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  GetOptionsIncomeDashboardResponse,
  ListOptionsIncomePositionsResponse,
  UpdateOptionsIncomePositionNotesBody,
  ListOptionsIncomePositionsResponseItem,
  GetOptionsStrategyLibraryResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { currentOpenTrades, type TradeRow } from "../lib/positionSizing.js";
import { positionGreeks } from "../lib/coach.js";
import type { QuoteLeg } from "../lib/optionsMath.js";
import { buildOptionsIncomeDashboard, buildPositionView, type MinimalPositionRow } from "../lib/optionsIncomeAnalytics.js";
import { allOptionsStrategyTemplates } from "../lib/optionsStrategyLibrary.js";
import type { ThetaPosition } from "../lib/thetaIncome.js";

const router: IRouter = Router();

async function closedTradeRows(userId: string) {
  return db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "closed")));
}

function greeksFor(row: Pick<TradeRow, "symbol" | "legs">) {
  return positionGreeks(row.symbol, row.legs as QuoteLeg[]);
}

// Exported so routes/institutionalReporting.ts's Options Income Summary
// Report (Phase 35) can reuse the exact same resolution — the same
// currentOpenTrades()/closedTradeRows()/positionGreeks() calls this route
// itself makes — rather than duplicating this mapping logic, matching the
// established loadTradingAnalyticsInputs()/loadExecutiveIntelligenceInputs()
// precedent.
export async function loadOptionsIncomeSummaryInputs(userId: string) {
  const [openRows, closedRows] = await Promise.all([currentOpenTrades(userId), closedTradeRows(userId)]);

  const thetaPositions: ThetaPosition[] = openRows.map((r) => ({
    symbol: r.symbol,
    strategy: r.strategy,
    theta: greeksFor(r).theta,
  }));

  return {
    openRows: openRows.map((r) => ({ id: r.id, symbol: r.symbol, strategy: r.strategy, credit: r.credit, maxLoss: r.maxLoss, expiration: r.expiration })),
    closedRows: closedRows.map((r) => ({ credit: r.credit })),
    thetaPositions,
  };
}

router.get("/options-income/dashboard", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const inputs = await loadOptionsIncomeSummaryInputs(userId);
  const dashboard = buildOptionsIncomeDashboard(inputs);
  res.json(GetOptionsIncomeDashboardResponse.parse(dashboard));
});

router.get("/options-income/positions", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const status = typeof req.query.status === "string" ? req.query.status : "open";

  let rows: (typeof tradesTable.$inferSelect)[];
  if (status === "open") {
    rows = await db.select().from(tradesTable).where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "open")));
  } else if (status === "closed") {
    rows = await closedTradeRows(userId);
  } else {
    rows = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
  }

  const positions = rows.map((r) => {
    const minimal: MinimalPositionRow = {
      id: r.id,
      symbol: r.symbol,
      strategy: r.strategy,
      status: r.status,
      credit: r.credit,
      maxLoss: r.maxLoss,
      maxProfit: r.maxProfit,
      expiration: r.expiration,
      openDate: r.openDate,
      closeDate: r.closeDate,
      exitReason: r.exitReason,
      notes: r.notes,
      currentPnl: r.currentPnl,
    };
    return buildPositionView(minimal, greeksFor(r));
  });

  res.json(ListOptionsIncomePositionsResponse.parse(positions));
});

router.patch("/options-income/positions/:id/notes", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid position id" });
    return;
  }

  const parsed = UpdateOptionsIncomePositionNotesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const [existing] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  const [updated] = await db
    .update(tradesTable)
    .set({ notes: parsed.data.notes })
    .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, userId)))
    .returning();

  const minimal: MinimalPositionRow = {
    id: updated.id,
    symbol: updated.symbol,
    strategy: updated.strategy,
    status: updated.status,
    credit: updated.credit,
    maxLoss: updated.maxLoss,
    maxProfit: updated.maxProfit,
    expiration: updated.expiration,
    openDate: updated.openDate,
    closeDate: updated.closeDate,
    exitReason: updated.exitReason,
    notes: updated.notes,
    currentPnl: updated.currentPnl,
  };
  res.json(ListOptionsIncomePositionsResponseItem.parse(buildPositionView(minimal, greeksFor(updated))));
});

router.get("/options-income/strategy-library", async (_req, res): Promise<void> => {
  res.json(GetOptionsStrategyLibraryResponse.parse(allOptionsStrategyTemplates()));
});

export default router;

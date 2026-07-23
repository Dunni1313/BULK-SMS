// Phase 30 — Institutional Strategy Framework.
//
// Real persistence for a Strategy Checklist INSTANCE — a specific
// application of a strategy's own checklist template to one real use.
// Mirrors routes/tradingTradePlans.ts's own list/create/get/update/delete
// pattern. Every query is ownership-scoped via getScopedUserId(req); a
// checklist is additionally scoped to its own parent strategy (also
// ownership-checked) so a user can never create or read a checklist
// against a strategy that isn't theirs.
//
// Zero strategy-specific checklist content: every item's label/required
// flag is copied at instantiation time from the parent strategy's own
// user-authored template (instantiateChecklistItems()) — this route
// never hardcodes an item.

import { Router, type IRouter } from "express";
import { db, tradingStrategiesTable, tradingStrategyChecklistsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  ListTradingStrategyChecklistsResponse,
  GetTradingStrategyChecklistResponse,
  UpdateTradingStrategyChecklistResponse,
  CreateTradingStrategyChecklistBody,
  UpdateTradingStrategyChecklistBody,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import {
  instantiateChecklistItems,
  deriveChecklistStatus,
  type StrategyChecklistItemState,
} from "../lib/tradingStrategyFramework.js";

const router: IRouter = Router();

function formatChecklist(row: typeof tradingStrategyChecklistsTable.$inferSelect) {
  return {
    id: row.id,
    strategyId: row.strategyId,
    symbol: row.symbol ?? null,
    status: row.status as "in_progress" | "complete",
    items: row.items as StrategyChecklistItemState[],
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function resolveOwnedStrategy(userId: string, strategyId: number) {
  const [row] = await db
    .select()
    .from(tradingStrategiesTable)
    .where(and(eq(tradingStrategiesTable.id, strategyId), eq(tradingStrategiesTable.userId, userId)));
  return row ?? null;
}

router.get("/trading/strategies/:strategyId/checklists", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.strategyId) ? req.params.strategyId[0] : req.params.strategyId;
  const strategyId = parseInt(raw, 10);
  if (isNaN(strategyId)) {
    res.status(400).json({ error: "Invalid strategy id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const strategy = await resolveOwnedStrategy(userId, strategyId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  const rows = await db
    .select()
    .from(tradingStrategyChecklistsTable)
    .where(and(eq(tradingStrategyChecklistsTable.strategyId, strategyId), eq(tradingStrategyChecklistsTable.userId, userId)))
    .orderBy(desc(tradingStrategyChecklistsTable.createdAt));

  res.json(ListTradingStrategyChecklistsResponse.parse(rows.map(formatChecklist)));
});

router.get("/trading/strategy-checklists/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .select()
    .from(tradingStrategyChecklistsTable)
    .where(and(eq(tradingStrategyChecklistsTable.id, id), eq(tradingStrategyChecklistsTable.userId, userId)));

  if (!row) {
    res.status(404).json({ error: "Checklist not found" });
    return;
  }

  res.json(GetTradingStrategyChecklistResponse.parse(formatChecklist(row)));
});

router.post("/trading/strategies/:strategyId/checklists", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.strategyId) ? req.params.strategyId[0] : req.params.strategyId;
  const strategyId = parseInt(raw, 10);
  if (isNaN(strategyId)) {
    res.status(400).json({ error: "Invalid strategy id" });
    return;
  }

  const parsed = CreateTradingStrategyChecklistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const strategy = await resolveOwnedStrategy(userId, strategyId);
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  const items = instantiateChecklistItems(
    strategy.checklist as { id: string; label: string; required: boolean }[],
  );

  const [row] = await db
    .insert(tradingStrategyChecklistsTable)
    .values({
      userId,
      strategyId,
      symbol: parsed.data.symbol?.toUpperCase() ?? null,
      status: deriveChecklistStatus(items),
      items,
      notes: "",
    })
    .returning();

  res.status(201).json(GetTradingStrategyChecklistResponse.parse(formatChecklist(row)));
});

router.patch("/trading/strategy-checklists/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateTradingStrategyChecklistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const [existing] = await db
    .select()
    .from(tradingStrategyChecklistsTable)
    .where(and(eq(tradingStrategyChecklistsTable.id, id), eq(tradingStrategyChecklistsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Checklist not found" });
    return;
  }

  const d = parsed.data;
  const items = (d.items ?? (existing.items as StrategyChecklistItemState[])) as StrategyChecklistItemState[];
  const notes = d.notes ?? existing.notes;
  const status = deriveChecklistStatus(items);

  const [row] = await db
    .update(tradingStrategyChecklistsTable)
    .set({ items, notes, status })
    .where(and(eq(tradingStrategyChecklistsTable.id, id), eq(tradingStrategyChecklistsTable.userId, userId)))
    .returning();

  res.json(UpdateTradingStrategyChecklistResponse.parse(formatChecklist(row)));
});

router.delete("/trading/strategy-checklists/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(tradingStrategyChecklistsTable)
    .where(and(eq(tradingStrategyChecklistsTable.id, id), eq(tradingStrategyChecklistsTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Checklist not found" });
    return;
  }

  res.status(204).send();
});

export default router;

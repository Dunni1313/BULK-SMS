// Phase 30 — Institutional Strategy Framework.
//
// Real persistence for user-authored Strategy Metadata. Mirrors
// routes/tradingTradePlans.ts's own list/create/get/update/delete
// pattern directly. Every query is scoped via getScopedUserId(req) and
// the established and(eq(id), eq(userId)) ownership pattern — 404, never
// a separate 403.
//
// Zero trading logic: the only computation here is
// validateStrategyMetadata() (lib/tradingStrategyFramework.ts), a purely
// structural check (non-empty fields, valid enum values, unique
// checklist ids) — never a judgment on whether a strategy is "good."

import { Router, type IRouter } from "express";
import { db, tradingStrategiesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  ListTradingStrategiesResponse,
  GetTradingStrategyResponse,
  UpdateTradingStrategyResponse,
  CreateTradingStrategyBody,
  UpdateTradingStrategyBody,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import {
  validateStrategyMetadata,
  type StrategyMetadataInput,
  type StrategyCategory,
  type EvidenceSourceType,
} from "../lib/tradingStrategyFramework.js";
import type { Timeframe } from "../lib/tradingMarketData.js";

const router: IRouter = Router();

function formatStrategy(row: typeof tradingStrategiesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category as StrategyCategory,
    timeframes: row.timeframes as Timeframe[],
    markets: row.markets as string[],
    requiredEvidence: row.requiredEvidence as EvidenceSourceType[],
    checklist: row.checklist,
    educationalNotes: row.educationalNotes,
    references: row.references as string[],
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/trading/strategies", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(tradingStrategiesTable)
    .where(eq(tradingStrategiesTable.userId, userId))
    .orderBy(desc(tradingStrategiesTable.createdAt));

  res.json(ListTradingStrategiesResponse.parse(rows.map(formatStrategy)));
});

router.get("/trading/strategies/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .select()
    .from(tradingStrategiesTable)
    .where(and(eq(tradingStrategiesTable.id, id), eq(tradingStrategiesTable.userId, userId)));

  if (!row) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  res.json(GetTradingStrategyResponse.parse(formatStrategy(row)));
});

router.post("/trading/strategies", async (req, res): Promise<void> => {
  const parsed = CreateTradingStrategyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;
  const input: StrategyMetadataInput = {
    name: d.name,
    description: d.description,
    category: d.category as StrategyCategory,
    timeframes: d.timeframes as Timeframe[],
    markets: d.markets,
    requiredEvidence: d.requiredEvidence as EvidenceSourceType[],
    checklist: d.checklist,
    educationalNotes: d.educationalNotes ?? "",
    references: d.references,
    version: d.version ?? "1.0.0",
  };

  const issues = validateStrategyMetadata(input);
  if (issues.length > 0) {
    res.status(400).json({ error: "Invalid strategy metadata", issues });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .insert(tradingStrategiesTable)
    .values({
      userId,
      name: input.name,
      description: input.description,
      category: input.category,
      timeframes: input.timeframes,
      markets: input.markets,
      requiredEvidence: input.requiredEvidence,
      checklist: input.checklist,
      educationalNotes: input.educationalNotes,
      references: input.references,
      version: input.version,
    })
    .returning();

  res.status(201).json(GetTradingStrategyResponse.parse(formatStrategy(row)));
});

router.patch("/trading/strategies/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateTradingStrategyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const [existing] = await db
    .select()
    .from(tradingStrategiesTable)
    .where(and(eq(tradingStrategiesTable.id, id), eq(tradingStrategiesTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  const d = parsed.data;
  const merged: StrategyMetadataInput = {
    name: d.name ?? existing.name,
    description: d.description ?? existing.description,
    category: (d.category as StrategyCategory) ?? (existing.category as StrategyCategory),
    timeframes: (d.timeframes as Timeframe[]) ?? (existing.timeframes as Timeframe[]),
    markets: d.markets ?? (existing.markets as string[]),
    requiredEvidence: (d.requiredEvidence as EvidenceSourceType[]) ?? (existing.requiredEvidence as EvidenceSourceType[]),
    checklist: d.checklist ?? existing.checklist,
    educationalNotes: d.educationalNotes ?? existing.educationalNotes,
    references: d.references ?? (existing.references as string[]),
    version: d.version ?? existing.version,
  };

  const issues = validateStrategyMetadata(merged);
  if (issues.length > 0) {
    res.status(400).json({ error: "Invalid strategy metadata", issues });
    return;
  }

  const [row] = await db
    .update(tradingStrategiesTable)
    .set(merged)
    .where(and(eq(tradingStrategiesTable.id, id), eq(tradingStrategiesTable.userId, userId)))
    .returning();

  res.json(UpdateTradingStrategyResponse.parse(formatStrategy(row)));
});

router.delete("/trading/strategies/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  // Checklists reference this strategy via a real FK with ON DELETE
  // CASCADE (lib/db/src/schema/tradingStrategyChecklists.ts) — the
  // explicit delete below is redundant with the DB's own cascade but
  // keeps the ownership check symmetric with every other route in this
  // file; harmless if the row is already gone.
  const [row] = await db
    .delete(tradingStrategiesTable)
    .where(and(eq(tradingStrategiesTable.id, id), eq(tradingStrategiesTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  res.status(204).send();
});

export default router;

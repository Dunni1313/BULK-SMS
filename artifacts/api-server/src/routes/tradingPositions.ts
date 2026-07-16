// Phase 3, Sprint 44 — Institutional Trading Engine, Trading Positions
// (basic CRUD) (approved Phase 3 plan §15, this sprint's own kickoff
// decision; see docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 44
// as-built note).
//
// Objective: give the Risk Management panel (this sprint's primary
// deliverable) real position data to score against — `trading_positions`
// has existed since Sprint 32, but no route ever read or wrote it (Sprint
// 39's Trading Journal CRUD only loosely *references* position ids, never
// creates them). Without this, the Risk panel would always read an empty
// table and honestly show "no open positions" — never useful.
//
// Mirrors routes/tradingJournal.ts's own Sprint 39 list/create/get/update/
// delete pattern directly, adapted (not rewritten) for the
// tradingPositionsTable schema. Every query is scoped via
// getScopedUserId(req) and the established and(eq(id), eq(userId))
// ownership pattern — 404, never a separate 403, for both "doesn't exist"
// and "isn't yours", matching every route in this codebase since Sprint 7.
//
// No route-level provider/candle/market-data access here — this route only
// persists user-authored position records; buildTradingRiskAnalysis()'s
// own provider resolution happens in routes/tradingRisk.ts.

import { Router, type IRouter } from "express";
import { db, tradingPositionsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  ListTradingPositionsResponse,
  GetTradingPositionResponse,
  UpdateTradingPositionResponse,
  CreateTradingPositionBody,
  UpdateTradingPositionBody,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

function formatPosition(p: typeof tradingPositionsTable.$inferSelect) {
  return {
    ...p,
    exitPrice: p.exitPrice ?? null,
    exitDate: p.exitDate ? p.exitDate.toISOString() : null,
    stopPrice: p.stopPrice ?? null,
    targetPrice: p.targetPrice ?? null,
    entryDate: p.entryDate.toISOString(),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/trading/positions", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const positions = await db
    .select()
    .from(tradingPositionsTable)
    .where(eq(tradingPositionsTable.userId, userId))
    .orderBy(desc(tradingPositionsTable.createdAt));

  res.json(ListTradingPositionsResponse.parse(positions.map(formatPosition)));
});

router.post("/trading/positions", async (req, res): Promise<void> => {
  const parsed = CreateTradingPositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;
  const userId = await getScopedUserId(req);

  const [position] = await db
    .insert(tradingPositionsTable)
    .values({
      userId,
      symbol: d.symbol,
      instrumentType: d.instrumentType ?? "stock",
      side: d.side ?? "long",
      status: d.status ?? "open",
      quantity: d.quantity,
      entryPrice: d.entryPrice,
      exitPrice: d.exitPrice ?? null,
      stopPrice: d.stopPrice ?? null,
      targetPrice: d.targetPrice ?? null,
      notes: d.notes ?? "",
    })
    .returning();

  res.status(201).json(GetTradingPositionResponse.parse(formatPosition(position)));
});

router.get("/trading/positions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [position] = await db
    .select()
    .from(tradingPositionsTable)
    .where(and(eq(tradingPositionsTable.id, id), eq(tradingPositionsTable.userId, userId)));

  if (!position) {
    res.status(404).json({ error: "Trading position not found" });
    return;
  }

  res.json(GetTradingPositionResponse.parse(formatPosition(position)));
});

router.patch("/trading/positions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateTradingPositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const [position] = await db
    .update(tradingPositionsTable)
    .set(parsed.data)
    .where(and(eq(tradingPositionsTable.id, id), eq(tradingPositionsTable.userId, userId)))
    .returning();

  if (!position) {
    res.status(404).json({ error: "Trading position not found" });
    return;
  }

  res.json(UpdateTradingPositionResponse.parse(formatPosition(position)));
});

router.delete("/trading/positions/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [position] = await db
    .delete(tradingPositionsTable)
    .where(and(eq(tradingPositionsTable.id, id), eq(tradingPositionsTable.userId, userId)))
    .returning();

  if (!position) {
    res.status(404).json({ error: "Trading position not found" });
    return;
  }

  res.status(204).send();
});

export default router;

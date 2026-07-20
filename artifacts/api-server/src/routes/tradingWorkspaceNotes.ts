// Phase 25 — Institutional Trade Workspace.
//
// The Engine 2 counterpart to stockAnalyst.ts's own /research-notes
// endpoints (Phase 17) — a lightweight, per-user, per-symbol free-text
// note, deliberately distinct from trading_journal_entries (a deeper,
// structured post-trade review). Mirrors that exact list/get-by-symbol/
// create/update/delete pattern, zero new business logic.

import { Router, type IRouter } from "express";
import { db, tradingWorkspaceNotesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  ListTradingWorkspaceNotesResponse,
  ListTradingWorkspaceNotesResponseItem,
  UpdateTradingWorkspaceNoteResponse,
  CreateTradingWorkspaceNoteBody,
  UpdateTradingWorkspaceNoteBody,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

function formatNote(n: typeof tradingWorkspaceNotesTable.$inferSelect) {
  return {
    id: n.id,
    symbol: n.symbol,
    note: n.note,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

router.get("/trading/workspace-notes", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(tradingWorkspaceNotesTable)
    .where(eq(tradingWorkspaceNotesTable.userId, userId))
    .orderBy(desc(tradingWorkspaceNotesTable.createdAt));
  res.json(ListTradingWorkspaceNotesResponse.parse(rows.map(formatNote)));
});

router.get("/trading/workspace-notes/:symbol", async (req, res): Promise<void> => {
  const symbol = (Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol).toUpperCase();
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(tradingWorkspaceNotesTable)
    .where(and(eq(tradingWorkspaceNotesTable.userId, userId), eq(tradingWorkspaceNotesTable.symbol, symbol)))
    .orderBy(desc(tradingWorkspaceNotesTable.createdAt));
  res.json(ListTradingWorkspaceNotesResponse.parse(rows.map(formatNote)));
});

router.post("/trading/workspace-notes", async (req, res): Promise<void> => {
  const parsed = CreateTradingWorkspaceNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .insert(tradingWorkspaceNotesTable)
    .values({ userId, symbol: parsed.data.symbol.toUpperCase(), note: parsed.data.note })
    .returning();
  res.status(201).json(ListTradingWorkspaceNotesResponseItem.parse(formatNote(row)));
});

router.patch("/trading/workspace-notes/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateTradingWorkspaceNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .update(tradingWorkspaceNotesTable)
    .set({ note: parsed.data.note, updatedAt: new Date() })
    .where(and(eq(tradingWorkspaceNotesTable.id, id), eq(tradingWorkspaceNotesTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Workspace note not found" });
    return;
  }
  res.json(UpdateTradingWorkspaceNoteResponse.parse(formatNote(row)));
});

router.delete("/trading/workspace-notes/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(tradingWorkspaceNotesTable)
    .where(and(eq(tradingWorkspaceNotesTable.id, id), eq(tradingWorkspaceNotesTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Workspace note not found" });
    return;
  }
  res.status(204).send();
});

export default router;

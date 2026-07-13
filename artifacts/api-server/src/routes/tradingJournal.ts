// Phase 3, Sprint 39 — Institutional Trading Engine, Trading Journal (Core +
// basic CRUD) (approved Phase 3 plan §16; see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 39 as-built note).
//
// Objective (§16): journal Engine 2 positions, reusing the proven
// journal_entries shape — mirrors routes/journal.ts's own
// list/create/get/update pattern directly, adapted (not rewritten) for the
// tradingJournalEntriesTable schema already created in Sprint 32
// (title/content/mood/tags/lessonLearned core fields, plus
// tradingPositionId — a loose, unenforced reference to trading_positions,
// same precedent as journal_entries.trade_id — and trading-relevant
// nullable fields: entryPrice/exitPrice/rMultiple/setupType, in place of
// the options-specific credit/POP/EV fields journal_entries carries).
//
// Every query is scoped via getScopedUserId(req) and the established
// and(eq(id), eq(userId)) ownership pattern — 404, never a separate 403,
// for both "doesn't exist" and "isn't yours", matching every route in this
// codebase since Sprint 7. This sprint additionally ships a DELETE
// endpoint (routes/journal.ts's own options-side route has none) since
// "basic CRUD" was the explicit approved scope for this sprint.
//
// No route-level provider/candle/market-data access here — trading journal
// entries are user-authored text, not derived from SIMULATED market data.

import { Router, type IRouter } from "express";
import { db, tradingJournalEntriesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  ListTradingJournalEntriesResponse,
  GetTradingJournalEntryResponse,
  UpdateTradingJournalEntryResponse,
  CreateTradingJournalEntryBody,
  UpdateTradingJournalEntryBody,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

function formatEntry(e: typeof tradingJournalEntriesTable.$inferSelect) {
  return {
    ...e,
    lessonLearned: e.lessonLearned ?? null,
    tags: e.tags || [],
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

router.get("/trading/journal", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const entries = await db
    .select()
    .from(tradingJournalEntriesTable)
    .where(eq(tradingJournalEntriesTable.userId, userId))
    .orderBy(desc(tradingJournalEntriesTable.createdAt));

  res.json(ListTradingJournalEntriesResponse.parse(entries.map(formatEntry)));
});

router.post("/trading/journal", async (req, res): Promise<void> => {
  const parsed = CreateTradingJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;
  const userId = await getScopedUserId(req);

  const [entry] = await db
    .insert(tradingJournalEntriesTable)
    .values({
      userId,
      tradingPositionId: d.tradingPositionId ?? null,
      title: d.title,
      content: d.content,
      mood: d.mood,
      lessonLearned: d.lessonLearned ?? null,
      tags: d.tags || [],
      setupType: d.setupType ?? null,
      entryPrice: d.entryPrice ?? null,
      exitPrice: d.exitPrice ?? null,
      rMultiple: d.rMultiple ?? null,
    })
    .returning();

  res.status(201).json(GetTradingJournalEntryResponse.parse(formatEntry(entry)));
});

router.get("/trading/journal/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [entry] = await db
    .select()
    .from(tradingJournalEntriesTable)
    .where(and(eq(tradingJournalEntriesTable.id, id), eq(tradingJournalEntriesTable.userId, userId)));

  if (!entry) {
    res.status(404).json({ error: "Trading journal entry not found" });
    return;
  }

  res.json(GetTradingJournalEntryResponse.parse(formatEntry(entry)));
});

router.patch("/trading/journal/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateTradingJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const [entry] = await db
    .update(tradingJournalEntriesTable)
    .set(parsed.data)
    .where(and(eq(tradingJournalEntriesTable.id, id), eq(tradingJournalEntriesTable.userId, userId)))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Trading journal entry not found" });
    return;
  }

  res.json(UpdateTradingJournalEntryResponse.parse(formatEntry(entry)));
});

router.delete("/trading/journal/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [entry] = await db
    .delete(tradingJournalEntriesTable)
    .where(and(eq(tradingJournalEntriesTable.id, id), eq(tradingJournalEntriesTable.userId, userId)))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Trading journal entry not found" });
    return;
  }

  res.status(204).send();
});

export default router;

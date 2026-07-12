import { Router, type IRouter } from "express";
import { db, journalEntriesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  ListJournalEntriesResponse,
  GetJournalEntryResponse,
  UpdateJournalEntryResponse,
  CreateJournalEntryBody,
  UpdateJournalEntryBody,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

function formatEntry(e: typeof journalEntriesTable.$inferSelect) {
  return {
    ...e,
    lessonLearned: e.lessonLearned ?? null,
    tags: e.tags || [],
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

router.get("/journal", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const entries = await db
    .select()
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, userId))
    .orderBy(desc(journalEntriesTable.createdAt));

  res.json(ListJournalEntriesResponse.parse(entries.map(formatEntry)));
});

router.post("/journal", async (req, res): Promise<void> => {
  const parsed = CreateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;
  const userId = await getScopedUserId(req);

  const [entry] = await db
    .insert(journalEntriesTable)
    .values({
      userId,
      tradeId: d.tradeId ?? null,
      title: d.title,
      content: d.content,
      mood: d.mood,
      lessonLearned: d.lessonLearned ?? null,
      tags: d.tags || [],
      strategy: d.strategy ?? null,
      entryCredit: d.entryCredit ?? null,
      maxProfit: d.maxProfit ?? null,
      maxLoss: d.maxLoss ?? null,
      ev: d.ev ?? null,
      pop: d.pop ?? null,
      ravishScore: d.ravishScore ?? null,
      exitReason: d.exitReason ?? null,
      realizedPnl: d.realizedPnl ?? null,
    })
    .returning();

  res.status(201).json(GetJournalEntryResponse.parse(formatEntry(entry)));
});

router.get("/journal/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [entry] = await db
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, userId)));

  if (!entry) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }

  res.json(GetJournalEntryResponse.parse(formatEntry(entry)));
});

router.patch("/journal/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const [entry] = await db
    .update(journalEntriesTable)
    .set(parsed.data)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, userId)))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }

  res.json(UpdateJournalEntryResponse.parse(formatEntry(entry)));
});

export default router;

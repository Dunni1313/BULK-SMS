import { pgTable, serial, uuid, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 3 — nullable multi-tenancy anchor. Not yet backfilled,
  // enforced, or read/written by any route (see the approved Phase 1 plan §2.5).
  userId: uuid("user_id"),
  tradeId: integer("trade_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  mood: text("mood").notNull().default("neutral"),
  lessonLearned: text("lesson_learned"),
  tags: text("tags").array().notNull().default([]),
  strategy: text("strategy"),
  entryCredit: real("entry_credit"),
  maxProfit: real("max_profit"),
  maxLoss: real("max_loss"),
  ev: real("ev"),
  pop: real("pop"),
  ravishScore: real("ravish_score"),
  exitReason: text("exit_reason"),
  realizedPnl: real("realized_pnl"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;

import { pgTable, serial, uuid, text, real, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 4 — backfilled and enforced (see the approved Phase 1
  // plan §2.5 steps 4-5). ON DELETE RESTRICT: deleting a user must never
  // silently delete their trade/journal/report history (§2.4).
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  tradeId: integer("trade_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  mood: text("mood").notNull().default("neutral"),
  lessonLearned: text("lesson_learned"),
  // Trade History, Performance Analytics & Trading Journal sprint — the case
  // for taking the trade, and what specifically triggered entry, distinct
  // from the general-purpose `content` notes field.
  thesis: text("thesis"),
  entryReasoning: text("entry_reasoning"),
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
}, (table) => [
  index("journal_entries_user_id_idx").on(table.userId),
]);

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;

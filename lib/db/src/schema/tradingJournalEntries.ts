import { pgTable, serial, uuid, integer, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 3, Sprint 32 — Institutional Trading Engine, Market Data Foundation
// (approved Phase 3 plan, Sprint 32; §16, §25 Decision 2). A new table with
// a schema closely mirroring the existing `journal_entries` table's own
// core shape (title/content/mood/tags/lessonLearned) rather than either
// forking options-specific fields (entryCredit/maxProfit/pop/ev/
// ravishScore) or overloading that table's `trade_id` (which means
// something specific to Engine 3's own `trades` table) — see the plan's §0
// Correction 2.
//
// `tradingPositionId` deliberately has NO foreign key constraint —
// mirrors `journal_entries.trade_id`'s own established precedent exactly
// (a loose, unenforced reference), the same choice made for the same
// reason: a journal entry can outlive/reference a position record without
// a hard DB-level dependency on it.
//
// Brand-new table: NOT NULL from creation except the genuinely-optional
// fields (tradingPositionId, lessonLearned, setupType, entry/exit price,
// rMultiple). userId mandatory + ON DELETE RESTRICT.
export const tradingJournalEntriesTable = pgTable("trading_journal_entries", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  tradingPositionId: integer("trading_position_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  mood: text("mood").notNull().default("neutral"),
  tags: text("tags").array().notNull().default([]),
  lessonLearned: text("lesson_learned"),
  setupType: text("setup_type"),
  entryPrice: real("entry_price"),
  exitPrice: real("exit_price"),
  rMultiple: real("r_multiple"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("trading_journal_entries_user_id_idx").on(table.userId),
]);

export const insertTradingJournalEntrySchema = createInsertSchema(tradingJournalEntriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTradingJournalEntry = z.infer<typeof insertTradingJournalEntrySchema>;
export type TradingJournalEntryRow = typeof tradingJournalEntriesTable.$inferSelect;

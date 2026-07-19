import { pgTable, serial, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 14 — Institutional Investment Decision Engine. A plain, free-text,
// per-user, per-symbol Decision Note — mirrors investing_research_notes
// (Phase 12) exactly, but deliberately a SEPARATE table: Research Notes are
// general research jottings independent of any decision output, while
// Decision Notes are attached specifically to the Decision Engine's own
// Notes tab (e.g. "revisit after Q3 earnings," "conviction changed after
// reading the 10-Q"). Not tied to a decision snapshot via a foreign key — a
// note can exist for a symbol with no saved snapshot at all, or persist
// across many snapshots.
export const investingDecisionNotesTable = pgTable(
  "investing_decision_notes",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    symbol: text("symbol").notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("investing_decision_notes_user_id_idx").on(table.userId),
    index("investing_decision_notes_user_symbol_idx").on(table.userId, table.symbol),
  ],
);

export const insertInvestingDecisionNoteSchema = createInsertSchema(investingDecisionNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvestingDecisionNote = z.infer<typeof insertInvestingDecisionNoteSchema>;
export type InvestingDecisionNoteRow = typeof investingDecisionNotesTable.$inferSelect;

import { pgTable, serial, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 12 — Institutional Investing Engine Consolidation & Integration.
// Research Notes: the one genuinely-missing, purely-additive piece of
// user state this phase's audit identified with no existing equivalent
// anywhere in the codebase (verified by grep before this file was
// written — zero prior matches for "research note" in lib/ or routes/).
//
// A plain, free-text, per-user, per-symbol note — deliberately NOT a
// second watchlist, NOT a second research-history mechanism (that
// already exists: stock_analysis_history, Phase 1 Sprint 4), and NOT
// tied to a specific watchlist row via a foreign key (a note can exist
// for a symbol the user never added to their watchlist, or after they
// remove it from the watchlist — the note is the user's own durable
// record, independent of watchlist membership).
export const investingResearchNotesTable = pgTable(
  "investing_research_notes",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    symbol: text("symbol").notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("investing_research_notes_user_id_idx").on(table.userId),
    index("investing_research_notes_user_symbol_idx").on(table.userId, table.symbol),
  ],
);

export const insertInvestingResearchNoteSchema = createInsertSchema(investingResearchNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvestingResearchNote = z.infer<typeof insertInvestingResearchNoteSchema>;
export type InvestingResearchNoteRow = typeof investingResearchNotesTable.$inferSelect;

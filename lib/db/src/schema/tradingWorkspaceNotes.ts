import { pgTable, serial, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 25 — Institutional Trade Workspace.
//
// A plain, free-text, per-user, per-symbol note — the Engine 2 counterpart
// to investing_research_notes (Phase 12). Deliberately distinct from
// trading_journal_entries (a deeper, structured post-trade review record)
// — this is a lightweight, in-the-moment annotation, not tied to any
// specific trade/position/plan.
export const tradingWorkspaceNotesTable = pgTable(
  "trading_workspace_notes",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    symbol: text("symbol").notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trading_workspace_notes_user_id_idx").on(table.userId),
    index("trading_workspace_notes_user_symbol_idx").on(table.userId, table.symbol),
  ],
);

export const insertTradingWorkspaceNoteSchema = createInsertSchema(tradingWorkspaceNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTradingWorkspaceNote = z.infer<typeof insertTradingWorkspaceNoteSchema>;
export type TradingWorkspaceNoteRow = typeof tradingWorkspaceNotesTable.$inferSelect;

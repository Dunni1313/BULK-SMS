import { pgTable, serial, uuid, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 3, Sprint 32 — Institutional Trading Engine, Market Data Foundation
// (approved Phase 3 plan, Sprint 32; §25 Decision 2: new tables, not a
// retrofit of the options-coupled `trades` table — see the plan's §0
// Correction 3 and §6).
//
// Instrument-agnostic open/closed position ledger for Engine 2. Distinct
// from `trades` (Engine 3's real, options-legs-coupled executed-position
// ledger — legs jsonb, credit/pop/ev/ravishScore required) and from
// `investing_holdings` (Engine 1's target-weight allocation, not an
// executed position) — a genuinely different concept from both, not a
// naming collision.
//
// `instrumentType` is free text (not a DB enum), matching
// `investing_filing_analysis.filing_type`'s established precedent, so
// options/futures support later needs no schema change.
//
// Brand-new table: NOT NULL from creation (except the honestly-nullable
// exit/stop/target fields — a position may not have an exit yet, or no
// stop/target set), no nullable->backfill->enforce migration needed (same
// precedent as platform_audit_log, Sprint 10). userId is mandatory + ON
// DELETE RESTRICT, matching every other user-scoped table.
//
// Advisory/analysis only — Engine 2 has no broker integration in this phase
// (Phase 3 plan §19); this table is never written to by any automated
// execution path.
export const tradingPositionsTable = pgTable("trading_positions", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  symbol: text("symbol").notNull(),
  instrumentType: text("instrument_type").notNull().default("stock"),
  side: text("side").notNull().default("long"),
  status: text("status").notNull().default("open"),
  quantity: real("quantity").notNull().default(0),
  entryPrice: real("entry_price").notNull().default(0),
  entryDate: timestamp("entry_date", { withTimezone: true }).notNull().defaultNow(),
  exitPrice: real("exit_price"),
  exitDate: timestamp("exit_date", { withTimezone: true }),
  stopPrice: real("stop_price"),
  targetPrice: real("target_price"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("trading_positions_user_id_idx").on(table.userId),
]);

export const insertTradingPositionSchema = createInsertSchema(tradingPositionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTradingPosition = z.infer<typeof insertTradingPositionSchema>;
export type TradingPositionRow = typeof tradingPositionsTable.$inferSelect;

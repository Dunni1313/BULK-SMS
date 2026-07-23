import { pgTable, serial, uuid, text, real, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 4 — backfilled and enforced (see the approved Phase 1
  // plan §2.5 steps 4-5). ON DELETE RESTRICT: deleting a user must never
  // silently delete their trade/journal/report history (§2.4).
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  symbol: text("symbol").notNull(),
  strategy: text("strategy").notNull(),
  status: text("status").notNull().default("pending"),
  executionMode: text("execution_mode").notNull().default("manual"),
  legs: jsonb("legs").notNull().default([]),
  openDate: timestamp("open_date", { withTimezone: true }).notNull().defaultNow(),
  closeDate: timestamp("close_date", { withTimezone: true }),
  expiration: text("expiration"),
  credit: real("credit").notNull().default(0),
  maxProfit: real("max_profit").notNull().default(0),
  maxLoss: real("max_loss").notNull().default(0),
  currentPnl: real("current_pnl"),
  currentPnlPercent: real("current_pnl_percent"),
  pop: real("pop").notNull().default(0),
  ev: real("ev").notNull().default(0),
  theta: real("theta").notNull().default(0),
  ravishScore: real("ravish_score").notNull().default(0),
  // Implied volatility of the underlying at entry. Nullable so pre-existing rows
  // (opened before the Adjustment Engine) still load; the IV-expansion signal
  // falls back to an IV-rank proxy when this is null.
  entryIv: real("entry_iv"),
  exitReason: text("exit_reason"),
  notes: text("notes"),
  scannerResultId: integer("scanner_result_id"),
  alpacaOrderId: text("alpaca_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("trades_user_id_idx").on(table.userId),
  // Phase 9 — Production Readiness. `and(eq(status, ...), eq(userId, ...))`
  // is the single most common query shape against this table (Portfolio,
  // Trades list, the daily report, the automation scheduler's own
  // candidate/position lookups, position sizing, trade adjustment preview,
  // getAccountValue's realized-P&L sum) — this composite lets Postgres
  // satisfy all of them from the index alone instead of a user_id-only
  // index lookup followed by a row-by-row status filter.
  index("trades_user_id_status_idx").on(table.userId, table.status),
]);

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, createdAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;

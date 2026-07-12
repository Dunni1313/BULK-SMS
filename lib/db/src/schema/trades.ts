import { pgTable, serial, uuid, text, real, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 3 — nullable multi-tenancy anchor. Not yet backfilled,
  // enforced, or read/written by any route (see the approved Phase 1 plan §2.5).
  userId: uuid("user_id"),
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
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, createdAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;

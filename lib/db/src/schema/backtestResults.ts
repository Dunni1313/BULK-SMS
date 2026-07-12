import { pgTable, serial, uuid, text, real, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const backtestResultsTable = pgTable("backtest_results", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 3 — nullable multi-tenancy anchor. Not yet backfilled,
  // enforced, or read/written by any route (see the approved Phase 1 plan §2.5).
  userId: uuid("user_id"),
  symbol: text("symbol").notNull(),
  strategy: text("strategy").notNull(),
  period: text("period").notNull(),
  winRate: real("win_rate").notNull().default(0),
  avgWin: real("avg_win").notNull().default(0),
  avgLoss: real("avg_loss").notNull().default(0),
  expectancy: real("expectancy").notNull().default(0),
  maxDrawdown: real("max_drawdown").notNull().default(0),
  sharpeRatio: real("sharpe_ratio").notNull().default(0),
  sortinoRatio: real("sortino_ratio").notNull().default(0),
  totalTrades: integer("total_trades").notNull().default(0),
  totalReturn: real("total_return").notNull().default(0),
  evPerTrade: real("ev_per_trade").notNull().default(0),
  evMonthly: real("ev_monthly").notNull().default(0),
  evAnnualized: real("ev_annualized").notNull().default(0),
  equityCurve: jsonb("equity_curve").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBacktestResultSchema = createInsertSchema(backtestResultsTable).omit({ id: true, createdAt: true });
export type InsertBacktestResult = z.infer<typeof insertBacktestResultSchema>;
export type BacktestResult = typeof backtestResultsTable.$inferSelect;

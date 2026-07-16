import { pgTable, serial, uuid, text, real, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 3, Sprint 49 — Institutional Trading Engine, Backtesting (approved
// Phase 3 plan §18; see docs/Phase-3-Trading-Engine-Execution-Plan.md's
// Sprint 49 as-built note).
//
// Reuses the options-side backtest_results table's persisted-results
// SHAPE (a promoted headline-columns-plus-jsonb pattern), not the table
// itself and not its options-specific simulation logic — genuinely new
// table, deliberately, since Engine 2's own KPI vocabulary (winRate/avgR/
// maxDrawdownPct/totalReturnPct/sharpeRatio) differs from the options
// table's own (avgWin/avgLoss/ev*/sortinoRatio), and this table's
// tradeLog is a REAL trade-by-trade log from a genuine walk-forward
// simulation, not a fabricated equity curve. `backtest_results` itself is
// not modified.
//
// userId mandatory + ON DELETE RESTRICT, matching every other user-scoped
// table. Brand-new table, NOT NULL from creation (except the honestly-
// nullable KPI fields, since a strategy that never triggers a signal has
// no win rate to report), no backfill needed (zero existing rows, same
// precedent as platform_audit_log/investing_filing_analysis).
export const tradingBacktestResultsTable = pgTable("trading_backtest_results", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  symbol: text("symbol").notNull(),
  strategy: text("strategy").notNull(),
  interval: text("interval").notNull(),
  dataSource: text("data_source").notNull().default("SIMULATED"),
  candleCount: integer("candle_count").notNull().default(0),
  available: boolean("available").notNull().default(true),
  unavailableReason: text("unavailable_reason"),
  totalTrades: integer("total_trades").notNull().default(0),
  winRate: real("win_rate"),
  avgR: real("avg_r"),
  totalReturnPct: real("total_return_pct"),
  maxDrawdownPct: real("max_drawdown_pct"),
  sharpeRatio: real("sharpe_ratio"),
  equityCurve: jsonb("equity_curve").notNull().default([]),
  tradeLog: jsonb("trade_log").notNull().default([]),
  summary: text("summary").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("trading_backtest_results_user_id_idx").on(table.userId),
]);

export const insertTradingBacktestResultSchema = createInsertSchema(tradingBacktestResultsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTradingBacktestResult = z.infer<typeof insertTradingBacktestResultSchema>;
export type TradingBacktestResultRow = typeof tradingBacktestResultsTable.$inferSelect;

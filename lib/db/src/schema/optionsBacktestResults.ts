import { pgTable, serial, uuid, text, real, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 4, Sprint 58 — Options Engine-Native Backtesting (Route + UI)
// (approved Phase 4 plan, Sprint 58). See
// manual-migrations/016_options_backtest_results.sql for the full
// rationale, including why this is a brand-new table (not a reuse of
// trading_backtest_results or the legacy backtest_results) and why it
// carries two separate data-source columns rather than one.
//
// userId mandatory + ON DELETE RESTRICT, matching every other user-scoped
// table. Brand-new table, NOT NULL from creation except the honestly-
// nullable KPI fields, no backfill needed.
export const optionsBacktestResultsTable = pgTable("options_backtest_results", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  symbol: text("symbol").notNull(),
  strategy: text("strategy").notNull(),
  underlyingDataSource: text("underlying_data_source").notNull().default("SIMULATED"),
  optionsDataSource: text("options_data_source").notNull().default("SIMULATED"),
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
  index("options_backtest_results_user_id_idx").on(table.userId),
]);

export const insertOptionsBacktestResultSchema = createInsertSchema(optionsBacktestResultsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertOptionsBacktestResult = z.infer<typeof insertOptionsBacktestResultSchema>;
export type OptionsBacktestResultRow = typeof optionsBacktestResultsTable.$inferSelect;

import { pgTable, serial, uuid, text, real, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Task #66 — Buffett-style value-investing module. A persisted snapshot of a
// generated value-investor research run for a single symbol. The full structured
// 15-section research report lives in `valueResearchJson`; the scalar columns are
// denormalised ratings for cheap listing/sorting on history views.
//
// ALL fundamentals behind these ratings are SIMULATED/deterministic — never live
// broker/market data. Advisory/education only; this table never drives execution.
export const stockAnalysisHistoryTable = pgTable("stock_analysis_history", {
  id: serial("id").primaryKey(),
  // Phase 1, Sprint 4 — backfilled and enforced (see the approved Phase 1
  // plan §2.5 steps 4-5). ON DELETE RESTRICT: deleting a user must never
  // silently delete their trade/journal/report history (§2.4).
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  symbol: text("symbol").notNull(),
  analysisDate: text("analysis_date").notNull(), // YYYY-MM-DD
  businessQualityScore: real("business_quality_score").notNull().default(0),
  businessQualityRating: text("business_quality_rating").notNull().default("Average"),
  moatRating: text("moat_rating").notNull().default("None"),
  financialStrength: text("financial_strength").notNull().default("Acceptable"),
  valuationRating: text("valuation_rating").notNull().default("Fair"),
  marginOfSafety: text("margin_of_safety").notNull().default("None"),
  valueInvestorDecision: text("value_investor_decision").notNull().default("WATCHLIST"),
  stockVsOptionsDecision: text("stock_vs_options_decision").notNull().default("Watchlist only"),
  dataSource: text("data_source").notNull().default("SIMULATED"),
  valueResearchJson: jsonb("value_research_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("stock_analysis_history_user_id_idx").on(table.userId),
]);

export const insertStockAnalysisHistorySchema = createInsertSchema(stockAnalysisHistoryTable).omit({
  id: true,
  createdAt: true,
});
export type InsertStockAnalysisHistory = z.infer<typeof insertStockAnalysisHistorySchema>;
export type StockAnalysisHistoryRow = typeof stockAnalysisHistoryTable.$inferSelect;

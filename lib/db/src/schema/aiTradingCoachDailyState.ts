import { pgTable, serial, uuid, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. One row per
// (userId, tradingDate), mirroring intelligence_snapshots' own
// (userId, snapshotDate) unique-upsert precedent — see
// 045_ai_trading_coach.sql's own header comment for the full rationale.
// completedStepIds/skippedStepIds are jsonb string arrays of
// DailyWorkflowStepId values (artifacts/ravish-trading/src/lib/
// tradingCoachWorkflow.ts's own 11-step model) — never hidden reasoning,
// secrets, or a second copy of any trading calculation.
export const aiTradingCoachDailyStateTable = pgTable(
  "ai_trading_coach_daily_state",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    tradingDate: text("trading_date").notNull(),
    completedStepIds: jsonb("completed_step_ids").notNull().default([]).$type<string[]>(),
    skippedStepIds: jsonb("skipped_step_ids").notNull().default([]).$type<string[]>(),
    noTradeReason: text("no_trade_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_trading_coach_daily_state_user_id_idx").on(table.userId),
    uniqueIndex("ai_trading_coach_daily_state_user_date_idx").on(table.userId, table.tradingDate),
  ],
);

export type AiTradingCoachDailyStateRow = typeof aiTradingCoachDailyStateTable.$inferSelect;
export type NewAiTradingCoachDailyStateRow = typeof aiTradingCoachDailyStateTable.$inferInsert;

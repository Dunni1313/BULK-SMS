import { pgTable, serial, uuid, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 25 — Institutional Trade Workspace.
//
// Real persistence for the TradePlan domain concept (in-memory only since
// Phase 24). NOT foreign-keyed to trading_positions — a plan may never
// become a position, and a position may exist without a formal plan,
// mirroring trading_journal_entries.trading_position_id's own established
// loose-reference precedent.
//
// Brand-new table: NOT NULL from creation except the two honestly-
// nullable derived fields (positionSize/riskRewardRatio — computeRiskParameters()
// itself already treats these as nullable), no backfill needed. userId is
// mandatory + ON DELETE RESTRICT, matching every other user-scoped table.
export const tradingTradePlansTable = pgTable(
  "trading_trade_plans",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    symbol: text("symbol").notNull(),
    direction: text("direction").notNull(),
    status: text("status").notNull().default("draft"),
    thesis: text("thesis").notNull(),
    accountRiskPct: real("account_risk_pct").notNull(),
    entryPrice: real("entry_price").notNull(),
    stopPrice: real("stop_price").notNull(),
    targetPrice: real("target_price").notNull(),
    positionSize: real("position_size"),
    riskRewardRatio: real("risk_reward_ratio"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("trading_trade_plans_user_id_idx").on(table.userId),
    index("trading_trade_plans_user_symbol_idx").on(table.userId, table.symbol),
  ],
);

export const insertTradingTradePlanSchema = createInsertSchema(tradingTradePlansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTradingTradePlan = z.infer<typeof insertTradingTradePlanSchema>;
export type TradingTradePlanRow = typeof tradingTradePlansTable.$inferSelect;

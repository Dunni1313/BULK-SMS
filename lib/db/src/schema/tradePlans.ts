// v1.5.0, Sprint 10 — Institutional Trade Planner. See manual migration
// 043_trade_plans.sql for the full rationale. A Trade Plan is a fully
// prepared trade before execution — planning only, no execution/order/
// broker concept anywhere in this schema. Named tradePlansTable (not
// tradingTradePlansTable, the distinct Phase 25 table) — that older table
// is a narrower, Trading-Engine-specific numeric plan with no sections/
// versions/checklist system; this one is the coach-agnostic (trading,
// investing, options) planning engine the AI Coach framework composes on.
import { pgTable, serial, uuid, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { aiWorkspacesTable } from "./aiWorkspaces";
import { aiStrategiesTable } from "./aiStrategies";

export const TRADE_PLAN_STATUSES = ["draft", "ready", "watching", "executed", "cancelled", "archived"] as const;
export type TradePlanStatus = (typeof TRADE_PLAN_STATUSES)[number];

export const TRADE_PLAN_DIRECTIONS = ["long", "short"] as const;
export type TradePlanDirection = (typeof TRADE_PLAN_DIRECTIONS)[number];

export const tradePlansTable = pgTable(
  "trade_plans",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    // Detach, don't destroy — the same policy as ai_strategies.workspace_id.
    workspaceId: integer("workspace_id").references(() => aiWorkspacesTable.id, { onDelete: "set null" }),
    coachId: text("coach_id").notNull(),
    // "Linked Strategy" from the spec's structure list — a real FK, not a
    // section row, so the relationship is never stored twice.
    strategyId: integer("strategy_id").references(() => aiStrategiesTable.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    plannedAsset: text("planned_asset"),
    assetClass: text("asset_class"),
    direction: text("direction"),
    status: text("status").notNull().default("draft"),
    pinned: boolean("pinned").notNull().default(false),
    tags: text("tags").array().notNull().default([]),
    currentVersion: integer("current_version").notNull().default(1),
    // Future execution linkage without implementing execution — a loose,
    // unenforced reference, mirroring trading_journal_entries' own
    // tradingPositionId precedent.
    executedTradeRef: text("executed_trade_ref"),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trade_plans_user_id_idx").on(table.userId),
    index("trade_plans_workspace_id_idx").on(table.workspaceId),
    index("trade_plans_strategy_id_idx").on(table.strategyId),
    index("trade_plans_coach_id_idx").on(table.coachId),
    index("trade_plans_status_idx").on(table.status),
  ],
);

export const insertTradePlanSchema = createInsertSchema(tradePlansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTradePlan = z.infer<typeof insertTradePlanSchema>;
export type TradePlan = typeof tradePlansTable.$inferSelect;

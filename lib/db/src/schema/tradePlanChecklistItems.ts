// v1.5.0, Sprint 10 — Institutional Trade Planner. See manual migration
// 043_trade_plans.sql for the full rationale. The Checklist Engine's
// persistent per-item storage — required/optional items with a
// completion flag; a plan's progress percentage is always derived from
// these rows (never itself stored). Coach-specific checklist *templates*
// are pure application data (lib/tradePlanChecklistTemplates.ts), not a
// DB concept — this table only holds the actual, per-plan items a user
// has added (whether seeded from a template or written by hand).
import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tradePlansTable } from "./tradePlans";

export const tradePlanChecklistItemsTable = pgTable(
  "trade_plan_checklist_items",
  {
    id: serial("id").primaryKey(),
    tradePlanId: integer("trade_plan_id")
      .notNull()
      .references(() => tradePlansTable.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    required: boolean("required").notNull().default(true),
    completed: boolean("completed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trade_plan_checklist_items_trade_plan_idx").on(table.tradePlanId)],
);

export const insertTradePlanChecklistItemSchema = createInsertSchema(tradePlanChecklistItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTradePlanChecklistItem = z.infer<typeof insertTradePlanChecklistItemSchema>;
export type TradePlanChecklistItem = typeof tradePlanChecklistItemsTable.$inferSelect;

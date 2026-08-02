// v1.5.0, Sprint 10 — Institutional Trade Planner. See manual migration
// 043_trade_plans.sql for the full rationale. Every edit (top-level field
// change or any section change) appends an immutable row here — `snapshot`
// is a complete jsonb copy of the plan's own top-level fields plus every
// section's content/references at that moment, enabling true restore
// without depending on trade_plan_sections' own current, mutable state.
// Never rewritten in place — restoring a prior version appends a
// brand-new version of its own (an immutable, git-like log), mirroring
// ai_strategy_versions exactly.
import { pgTable, serial, uuid, integer, text, jsonb, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tradePlansTable } from "./tradePlans";
import { usersTable } from "./users";

export const tradePlanVersionsTable = pgTable(
  "trade_plan_versions",
  {
    id: serial("id").primaryKey(),
    tradePlanId: integer("trade_plan_id")
      .notNull()
      .references(() => tradePlansTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    changeSummary: text("change_summary"),
    authorUserId: uuid("author_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trade_plan_versions_trade_plan_idx").on(table.tradePlanId, table.version),
    unique("trade_plan_versions_plan_version_unique").on(table.tradePlanId, table.version),
  ],
);

export const insertTradePlanVersionSchema = createInsertSchema(tradePlanVersionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTradePlanVersion = z.infer<typeof insertTradePlanVersionSchema>;
export type TradePlanVersion = typeof tradePlanVersionsTable.$inferSelect;

// The shape persisted inside `snapshot` — a complete, self-contained copy
// of the plan's own state at the moment the version was created.
export interface TradePlanSnapshot {
  title: string;
  workspaceId: number | null;
  strategyId: number | null;
  plannedAsset: string | null;
  assetClass: string | null;
  direction: string | null;
  status: string;
  tags: string[];
  sections: Array<{
    kind: string;
    content: string | null;
    refNotebookId: number | null;
    refConversationId: number | null;
    refFileId: number | null;
  }>;
  checklistItems: Array<{
    label: string;
    required: boolean;
    completed: boolean;
    sortOrder: number;
  }>;
}

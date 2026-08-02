// v1.5.0, Sprint 9 — AI Strategy Builder. See manual migration
// 042_ai_strategies.sql for the full rationale. Every edit (top-level
// field change or any section change) appends an immutable row here —
// `snapshot` is a complete jsonb copy of the strategy's own top-level
// fields plus every section's content/references at that moment, enabling
// true restore without depending on ai_strategy_sections' own current,
// mutable state. Never rewritten in place — restoring a prior version
// appends a brand-new version of its own (an immutable, git-like log).
import { pgTable, serial, uuid, integer, text, jsonb, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiStrategiesTable } from "./aiStrategies";
import { usersTable } from "./users";

export const aiStrategyVersionsTable = pgTable(
  "ai_strategy_versions",
  {
    id: serial("id").primaryKey(),
    strategyId: integer("strategy_id")
      .notNull()
      .references(() => aiStrategiesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    changeSummary: text("change_summary"),
    authorUserId: uuid("author_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_strategy_versions_strategy_idx").on(table.strategyId, table.version),
    unique("ai_strategy_versions_strategy_version_unique").on(table.strategyId, table.version),
  ],
);

export const insertAiStrategyVersionSchema = createInsertSchema(aiStrategyVersionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAiStrategyVersion = z.infer<typeof insertAiStrategyVersionSchema>;
export type AiStrategyVersion = typeof aiStrategyVersionsTable.$inferSelect;

// The shape persisted inside `snapshot` — a complete, self-contained copy
// of the strategy's own state at the moment the version was created.
export interface StrategySnapshot {
  title: string;
  description: string | null;
  strategyType: string;
  assetClass: string | null;
  folder: string | null;
  status: string;
  tags: string[];
  sections: Array<{
    kind: string;
    content: string | null;
    refNotebookId: number | null;
    refConversationId: number | null;
    refFileId: number | null;
  }>;
}

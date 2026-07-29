// v1.5.0, Sprint 9 — AI Strategy Builder. See manual migration
// 042_ai_strategies.sql for the full rationale (workspace_id nullable +
// SET NULL, mirroring ai_notebooks.workspace_id's own Sprint 8 precedent;
// strategyType/assetClass/folder/status are all free text, deliberately
// not DB enums, so new templates/folders never require a schema change).
//
// coachId is deliberately free text, not a Postgres enum — restricted at
// the application layer to "trading" | "investing" | "options" (reused
// directly from aiCoachConversations.ts's own COACH_IDS, not redefined),
// matching this codebase's established free-text-discriminator convention.
import { pgTable, serial, uuid, text, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { aiWorkspacesTable } from "./aiWorkspaces";

export const STRATEGY_STATUSES = ["draft", "active", "retired"] as const;
export type StrategyStatus = (typeof STRATEGY_STATUSES)[number];

export const aiStrategiesTable = pgTable(
  "ai_strategies",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    // Nullable: a strategy may or may not belong to a workspace.
    // ON DELETE SET NULL: deleting a workspace detaches its strategies
    // rather than destroying a curated playbook (see migration 042's own
    // header comment for the full rationale).
    workspaceId: integer("workspace_id").references(() => aiWorkspacesTable.id, { onDelete: "set null" }),
    coachId: text("coach_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    // Free text, not a DB enum — the approved scope's own explicit
    // requirement: "the architecture must allow additional templates
    // later without schema changes." The 17 named starter templates live
    // in lib/strategyTemplates.ts as an extensible application-level
    // registry, never a migration.
    strategyType: text("strategy_type").notNull(),
    assetClass: text("asset_class"),
    // Nullable folder override (Trading/Investing/Options/Templates/
    // Personal/the explicitly-future Shared) — when unset, the UI derives
    // a default folder from coachId.
    folder: text("folder"),
    // Free text, application-validated against STRATEGY_STATUSES above,
    // not a DB CHECK — the same forward-compatibility convention as
    // strategyType/folder.
    status: text("status").notNull().default("draft"),
    pinned: boolean("pinned").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    tags: text("tags").array().notNull().default([]),
    // Denormalized pointer to the "live" ai_strategy_versions row, for
    // cheap reads without a join on every list request.
    currentVersion: integer("current_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_strategies_user_coach_idx").on(table.userId, table.coachId, table.updatedAt),
    index("ai_strategies_workspace_idx").on(table.workspaceId),
  ],
);

export const insertAiStrategySchema = createInsertSchema(aiStrategiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiStrategy = z.infer<typeof insertAiStrategySchema>;
export type AiStrategy = typeof aiStrategiesTable.$inferSelect;

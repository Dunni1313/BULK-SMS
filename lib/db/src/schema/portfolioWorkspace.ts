import { pgTable, serial, uuid, text, integer, timestamp, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 44 — Institutional Portfolio Workspace & Workflow Center.
//
// Three genuinely new persistence primitives, all monitoring/organisation
// only — none of them execute, recommend, or automate anything:
//
// 1. portfolio_workflow_instances — tracks a user's own progress through a
//    deterministic, static Workflow Center catalog (lib/portfolioWorkflows.ts
//    holds the actual workflow/step DEFINITIONS; this table only tracks
//    which steps a specific run of a specific workflow has been marked
//    complete). `workflow_key` is free text referencing a catalog key, not
//    a DB enum — matching investing_watchlists.kind's/
//    compliance_policies.policy_type's own established free-text
//    precedent, so a future catalog addition needs no migration.
//    `completed_step_keys` is a jsonb string array (matching
//    trading_strategies.ts's/investing_watchlist_items.tags' own
//    established jsonb(...).notNull().$type<string[]>() pattern for
//    array-typed columns). A workflow instance reaching "completed" status
//    is a deterministic computation (every step in the catalog's own step
//    list has been checked off) — bookkeeping over a user's own explicit
//    checklist actions, never automation of any trading/execution
//    behaviour.
//
// 2. workspace_pinned_resources — a user's own explicit pins (the
//    kickoff's "Pinned Resources" and "Favorites" are the same underlying
//    concept in this implementation — see docs/Institutional-Workspace-Model.md
//    for the disclosed design decision) across any of the resource types
//    the kickoff names: dashboards, reports, watchlists, strategies,
//    learning topics, or a plain recent page. `resource_type`/`resource_key`
//    are both free text (not a DB enum) for the same forward-compatibility
//    reason as workflow_key above. A unique (user_id, resource_type,
//    resource_key) constraint prevents pinning the same resource twice.
//    Nothing is ever auto-pinned — every row originates from an explicit
//    user action.
//
// 3. workspace_recent_views — a per-user log of resources explicitly opened
//    FROM the Portfolio Workspace itself (its own quick-action links,
//    pinned-resource links, and recent-reports/active-workflow links) —
//    deliberately NOT a global, every-page-in-the-app view tracker (that
//    would mean instrumenting all ~90 existing pages, a wholly disproportionate
//    and out-of-scope undertaking for an orchestration-only phase). This
//    scope boundary is disclosed in docs/Institutional-Workspace-Model.md.
//    recordRecentView() (lib/workspacePins.ts) deletes any existing row for
//    the same (user_id, resource_type, resource_key) before inserting a
//    fresh one, so the "recently viewed" list always shows distinct
//    resources ordered by their own most-recent view, never a spam of
//    duplicate rows for the same resource.
//
// All three tables: user_id -> users.id stays the universal ON DELETE
// RESTRICT convention. Brand-new tables, NOT NULL from creation, no
// nullable->backfill->enforce migration needed (same precedent as
// platform_audit_log/investing_filing_analysis/compliance_policies/
// investing_watchlists).

export const portfolioWorkflowInstancesTable = pgTable(
  "portfolio_workflow_instances",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    workflowKey: text("workflow_key").notNull(),
    status: text("status").notNull().default("active"),
    completedStepKeys: jsonb("completed_step_keys").notNull().default([]).$type<string[]>(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("portfolio_workflow_instances_user_id_idx").on(table.userId)],
);

export const workspacePinnedResourcesTable = pgTable(
  "workspace_pinned_resources",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    resourceType: text("resource_type").notNull(),
    resourceKey: text("resource_key").notNull(),
    label: text("label").notNull(),
    linkPath: text("link_path").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("workspace_pinned_resources_user_id_idx").on(table.userId),
    unique("workspace_pinned_resources_user_resource_unique").on(table.userId, table.resourceType, table.resourceKey),
  ],
);

export const workspaceRecentViewsTable = pgTable(
  "workspace_recent_views",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    resourceType: text("resource_type").notNull(),
    resourceKey: text("resource_key").notNull(),
    label: text("label").notNull(),
    linkPath: text("link_path").notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("workspace_recent_views_user_id_idx").on(table.userId),
    index("workspace_recent_views_user_viewed_at_idx").on(table.userId, table.viewedAt),
  ],
);

export const insertPortfolioWorkflowInstanceSchema = createInsertSchema(portfolioWorkflowInstancesTable).omit({
  id: true,
  userId: true,
  status: true,
  completedStepKeys: true,
  startedAt: true,
  completedAt: true,
  updatedAt: true,
});
export type InsertPortfolioWorkflowInstance = z.infer<typeof insertPortfolioWorkflowInstanceSchema>;
export type PortfolioWorkflowInstanceRow = typeof portfolioWorkflowInstancesTable.$inferSelect;

export const insertWorkspacePinnedResourceSchema = createInsertSchema(workspacePinnedResourcesTable).omit({
  id: true,
  userId: true,
  sortOrder: true,
  createdAt: true,
});
export type InsertWorkspacePinnedResource = z.infer<typeof insertWorkspacePinnedResourceSchema>;
export type WorkspacePinnedResourceRow = typeof workspacePinnedResourcesTable.$inferSelect;

export const insertWorkspaceRecentViewSchema = createInsertSchema(workspaceRecentViewsTable).omit({
  id: true,
  userId: true,
  viewedAt: true,
});
export type InsertWorkspaceRecentView = z.infer<typeof insertWorkspaceRecentViewSchema>;
export type WorkspaceRecentViewRow = typeof workspaceRecentViewsTable.$inferSelect;

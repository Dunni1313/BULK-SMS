import { pgTable, serial, uuid, text, boolean, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Phase 10 — Institutional Platform Polish & Control Center. A "workspace"
// is a named, saved widget layout for the Institutional Home page — this
// single table backs both the Workspace System (save/rename/duplicate/
// delete/switch named layouts) and the Personal Dashboard (pin/hide/
// reorder/resize widgets), since a personalized dashboard IS just the
// currently-active workspace's own widget config. Brand-new table, NOT
// NULL from creation, no backfill needed — same precedent as
// platform_notifications/learning_progress.
//
// widgetConfig is a jsonb array of {id, visible, size, order} entries —
// intentionally NOT a fixed set of columns, since new widgets will be
// added over time without a schema migration. "size" is a binary
// normal/compact toggle rather than freeform pixel dimensions — a
// deliberate, disclosed scope decision (see docs/Institutional-Control-Center.md)
// favoring a robust, keyboard-operable, easily-testable control over a
// full drag-resize grid library.
//
// isActive marks which workspace is currently in use; the partial unique
// index (mirroring platform_notifications' own precedent) guarantees at
// most one active workspace per user at a time. A user's very first
// workspace ("Default") is lazily created on first access, mirroring
// getSettingsRow()'s own established lazy-create pattern.
export const dashboardWorkspacesTable = pgTable(
  "dashboard_workspaces",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(false),
    widgetConfig: jsonb("widget_config").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("dashboard_workspaces_user_id_idx").on(table.userId),
    uniqueIndex("dashboard_workspaces_user_name_idx").on(table.userId, table.name),
    uniqueIndex("dashboard_workspaces_active_idx")
      .on(table.userId)
      .where(sql`${table.isActive} = true`),
  ],
);

export const insertDashboardWorkspaceSchema = createInsertSchema(dashboardWorkspacesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDashboardWorkspace = z.infer<typeof insertDashboardWorkspaceSchema>;
export type DashboardWorkspaceRow = typeof dashboardWorkspacesTable.$inferSelect;

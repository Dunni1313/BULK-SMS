// Phase 44 — Institutional Portfolio Workspace & Workflow Center.
//
// WORKSPACE section: Pinned Resources (a.k.a. Favorites — the same
// underlying persistence, see docs/Institutional-Workspace-Model.md for
// the disclosed design decision), Recently Viewed, and a static, curated
// Quick Actions list. No resource is ever auto-pinned and no view is ever
// auto-recorded outside an explicit action the user took from within the
// Portfolio Workspace itself.

import { db, workspacePinnedResourcesTable, workspaceRecentViewsTable, type WorkspacePinnedResourceRow, type WorkspaceRecentViewRow } from "@workspace/db";
import { and, eq, asc, desc } from "drizzle-orm";

// ─── Pinned Resources (Favorites) ───────────────────────────────────────

function pinToApi(row: WorkspacePinnedResourceRow) {
  return {
    id: row.id,
    resourceType: row.resourceType,
    resourceKey: row.resourceKey,
    label: row.label,
    linkPath: row.linkPath,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}
export type PinnedResourceView = ReturnType<typeof pinToApi>;

export async function listPinnedResources(userId: string): Promise<PinnedResourceView[]> {
  const rows = await db
    .select()
    .from(workspacePinnedResourcesTable)
    .where(eq(workspacePinnedResourcesTable.userId, userId))
    .orderBy(asc(workspacePinnedResourcesTable.sortOrder), asc(workspacePinnedResourcesTable.createdAt));
  return rows.map(pinToApi);
}

export interface PinResourceInput {
  resourceType: string;
  resourceKey: string;
  label: string;
  linkPath: string;
}

// Database-maintenance fix (not part of any UX/feature sprint) — see
// docs/Database-Concurrency-Fixes.md. Was a plain INSERT relying on
// catching a thrown unique-violation exception (identified by Postgres
// error code 23505 on err.cause) to detect an already-pinned resource —
// correct in outcome but noisy: Postgres logs a full ERROR at the
// database level for every such exception regardless of whether the
// application catches it. ON CONFLICT DO NOTHING is silent at the
// database level on a genuine duplicate; the caller distinguishes that
// case from success by whether a row was returned, with identical
// external behavior (the "duplicate" sentinel, and the 409 the one
// caller of this function already maps it to).
export async function pinResource(userId: string, input: PinResourceInput): Promise<PinnedResourceView | "duplicate"> {
  const [row] = await db
    .insert(workspacePinnedResourcesTable)
    .values({ ...input, userId })
    .onConflictDoNothing({
      target: [
        workspacePinnedResourcesTable.userId,
        workspacePinnedResourcesTable.resourceType,
        workspacePinnedResourcesTable.resourceKey,
      ],
    })
    .returning();
  return row ? pinToApi(row) : "duplicate";
}

export async function unpinResource(userId: string, id: number): Promise<boolean> {
  const [row] = await db
    .delete(workspacePinnedResourcesTable)
    .where(and(eq(workspacePinnedResourcesTable.id, id), eq(workspacePinnedResourcesTable.userId, userId)))
    .returning({ id: workspacePinnedResourcesTable.id });
  return !!row;
}

export async function reorderPinnedResources(userId: string, orderedIds: number[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(workspacePinnedResourcesTable)
        .set({ sortOrder: index })
        .where(and(eq(workspacePinnedResourcesTable.id, id), eq(workspacePinnedResourcesTable.userId, userId))),
    ),
  );
}

// ─── Recently Viewed ─────────────────────────────────────────────────────
// Deliberately scoped to resources explicitly opened FROM the Portfolio
// Workspace itself (its own quick-action links, pinned-resource links, and
// recent-reports/active-workflow links) — never a global, every-page-in-
// the-app view tracker. See docs/Institutional-Workspace-Model.md for the
// disclosed scope boundary.

const RECENT_VIEWS_LIMIT = 20;

function viewToApi(row: WorkspaceRecentViewRow) {
  return {
    id: row.id,
    resourceType: row.resourceType,
    resourceKey: row.resourceKey,
    label: row.label,
    linkPath: row.linkPath,
    viewedAt: row.viewedAt.toISOString(),
  };
}
export type RecentViewEntry = ReturnType<typeof viewToApi>;

export interface RecordViewInput {
  resourceType: string;
  resourceKey: string;
  label: string;
  linkPath: string;
}

// Deletes any existing row for the same (user, resourceType, resourceKey)
// before inserting a fresh one, so the recent list always shows distinct
// resources ordered by their own most-recent view, never a spam of
// duplicate rows for the same resource.
export async function recordRecentView(userId: string, input: RecordViewInput): Promise<RecentViewEntry> {
  await db
    .delete(workspaceRecentViewsTable)
    .where(
      and(
        eq(workspaceRecentViewsTable.userId, userId),
        eq(workspaceRecentViewsTable.resourceType, input.resourceType),
        eq(workspaceRecentViewsTable.resourceKey, input.resourceKey),
      ),
    );
  const [row] = await db
    .insert(workspaceRecentViewsTable)
    .values({ ...input, userId })
    .returning();
  return viewToApi(row);
}

export async function listRecentViews(userId: string, limit: number = RECENT_VIEWS_LIMIT): Promise<RecentViewEntry[]> {
  const rows = await db
    .select()
    .from(workspaceRecentViewsTable)
    .where(eq(workspaceRecentViewsTable.userId, userId))
    .orderBy(desc(workspaceRecentViewsTable.viewedAt))
    .limit(limit);
  return rows.map(viewToApi);
}

// ─── Quick Actions ───────────────────────────────────────────────────────
// A fixed, curated, deterministic list of navigation shortcuts into
// already-shipped surfaces — never persisted, never user-configurable,
// the same "static catalog" precedent as WORKFLOW_CATALOG
// (lib/portfolioWorkflows.ts) and dashboardWorkspaces.ts's own
// DEFAULT_WIDGET_IDS.

export interface QuickAction {
  key: string;
  label: string;
  linkPath: string;
}

export const WORKSPACE_QUICK_ACTIONS: QuickAction[] = [
  { key: "start_morning_review", label: "Start Morning Review", linkPath: "/portfolio-workspace?tab=workflows" },
  { key: "open_watchlists", label: "Open Watchlists & Opportunity Dashboard", linkPath: "/watchlists-engine" },
  { key: "open_risk_overview", label: "Open Risk & Exposure Engine", linkPath: "/risk-exposure-engine" },
  { key: "open_performance_overview", label: "Open Performance & Attribution Engine", linkPath: "/performance-attribution-engine" },
  { key: "open_compliance_overview", label: "Open Monitoring & Compliance Engine", linkPath: "/monitoring-compliance-engine" },
  { key: "open_reporting_centre", label: "Open Reporting Centre", linkPath: "/reporting-centre" },
  { key: "generate_workspace_summary", label: "Generate Portfolio Workspace Summary Report", linkPath: "/reporting-centre" },
];

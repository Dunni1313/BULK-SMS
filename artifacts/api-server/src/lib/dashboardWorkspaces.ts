// Phase 10 — Institutional Platform Polish & Control Center. Backs both
// the Workspace System (named, saved widget layouts) and the Personal
// Dashboard (pin/hide/reorder/resize widgets on the Institutional Home
// page) — a workspace IS the currently-active widget config, per
// dashboardWorkspaces.ts's own schema-level doc comment.
//
// Zero trading, execution, pricing, portfolio, or risk calculations —
// this module only reads/writes UI layout preferences.

import { db, dashboardWorkspacesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export interface WidgetConfigEntry {
  id: string;
  visible: boolean;
  size: "normal" | "compact";
  order: number;
}

// The canonical widget list for the Institutional Home page — every
// widget id referenced anywhere in Home.tsx must appear here so a fresh
// user's default workspace has a real, honest entry for it (never a
// silently-missing widget). Order here is the default display order.
export const DEFAULT_WIDGET_IDS = [
  "portfolio-health",
  "market-status",
  "open-positions",
  "todays-pnl",
  "theta-income",
  "buying-power",
  "risk",
  "upcoming-events",
  "ai-briefing",
  "mentor-summary",
  "recent-activity",
  "notifications",
  "quick-actions",
  // Phase 12 — Institutional Investing Engine Consolidation & Integration.
  "watchlist-summary",
] as const;

export function defaultWidgetConfig(): WidgetConfigEntry[] {
  return DEFAULT_WIDGET_IDS.map((id, index) => ({
    id,
    visible: true,
    size: "normal" as const,
    order: index,
  }));
}

function toApi(row: typeof dashboardWorkspacesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    isActive: row.isActive,
    widgetConfig: row.widgetConfig as WidgetConfigEntry[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Lazily creates a user's very first ("Default") workspace, mirroring
// getSettingsRow()'s own established lazy-create pattern — never throws
// for a brand-new user with no rows yet.
export async function getOrCreateActiveWorkspace(userId: string) {
  const existing = await db
    .select()
    .from(dashboardWorkspacesTable)
    .where(and(eq(dashboardWorkspacesTable.userId, userId), eq(dashboardWorkspacesTable.isActive, true)))
    .limit(1);
  if (existing[0]) return toApi(existing[0]);

  // No active workspace at all — either this is a genuinely new user, or
  // (defensively) something cleared the active flag. Either way, the
  // honest recovery is the same: ensure a Default workspace exists and is
  // active, never fabricate an in-memory-only result the client can't
  // actually save changes against.
  const anyRow = await db
    .select()
    .from(dashboardWorkspacesTable)
    .where(eq(dashboardWorkspacesTable.userId, userId))
    .limit(1);
  if (anyRow[0]) {
    const [reactivated] = await db
      .update(dashboardWorkspacesTable)
      .set({ isActive: true })
      .where(eq(dashboardWorkspacesTable.id, anyRow[0].id))
      .returning();
    return toApi(reactivated);
  }

  const [created] = await db
    .insert(dashboardWorkspacesTable)
    .values({ userId, name: "Default", isDefault: true, isActive: true, widgetConfig: defaultWidgetConfig() })
    .returning();
  return toApi(created);
}

export async function listWorkspaces(userId: string) {
  // Ensure at least one (the Default) workspace exists before listing,
  // so a brand-new user's dropdown is never honestly empty.
  await getOrCreateActiveWorkspace(userId);
  const rows = await db
    .select()
    .from(dashboardWorkspacesTable)
    .where(eq(dashboardWorkspacesTable.userId, userId))
    .orderBy(dashboardWorkspacesTable.createdAt);
  return rows.map(toApi);
}

export async function createWorkspace(userId: string, name: string, widgetConfig?: WidgetConfigEntry[]) {
  const [created] = await db
    .insert(dashboardWorkspacesTable)
    .values({
      userId,
      name,
      isDefault: false,
      isActive: false,
      widgetConfig: widgetConfig ?? defaultWidgetConfig(),
    })
    .returning();
  return toApi(created);
}

export async function updateWorkspace(
  userId: string,
  id: number,
  patch: { name?: string; widgetConfig?: WidgetConfigEntry[] },
) {
  const [row] = await db
    .update(dashboardWorkspacesTable)
    .set(patch)
    .where(and(eq(dashboardWorkspacesTable.id, id), eq(dashboardWorkspacesTable.userId, userId)))
    .returning();
  return row ? toApi(row) : null;
}

export async function duplicateWorkspace(userId: string, id: number, newName: string) {
  const [source] = await db
    .select()
    .from(dashboardWorkspacesTable)
    .where(and(eq(dashboardWorkspacesTable.id, id), eq(dashboardWorkspacesTable.userId, userId)))
    .limit(1);
  if (!source) return null;
  const [created] = await db
    .insert(dashboardWorkspacesTable)
    .values({
      userId,
      name: newName,
      isDefault: false,
      isActive: false,
      widgetConfig: source.widgetConfig,
    })
    .returning();
  return toApi(created);
}

export async function deleteWorkspace(userId: string, id: number): Promise<"deleted" | "not_found" | "is_last"> {
  const rows = await db.select().from(dashboardWorkspacesTable).where(eq(dashboardWorkspacesTable.userId, userId));
  const target = rows.find((r) => r.id === id);
  if (!target) return "not_found";
  // Never let a user delete their only remaining workspace — the
  // Institutional Home page always needs at least one to render against.
  if (rows.length <= 1) return "is_last";

  await db
    .delete(dashboardWorkspacesTable)
    .where(and(eq(dashboardWorkspacesTable.id, id), eq(dashboardWorkspacesTable.userId, userId)));

  // If the deleted workspace was the active one, activate another
  // deterministically (the oldest remaining) so the user is never left
  // with no active workspace at all.
  if (target.isActive) {
    const remaining = rows.filter((r) => r.id !== id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (remaining[0]) {
      await db.update(dashboardWorkspacesTable).set({ isActive: true }).where(eq(dashboardWorkspacesTable.id, remaining[0].id));
    }
  }
  return "deleted";
}

export async function activateWorkspace(userId: string, id: number) {
  const [target] = await db
    .select()
    .from(dashboardWorkspacesTable)
    .where(and(eq(dashboardWorkspacesTable.id, id), eq(dashboardWorkspacesTable.userId, userId)))
    .limit(1);
  if (!target) return null;

  // Clear every other workspace's active flag first, then set this one —
  // two statements, not one atomic UPSERT, since Drizzle's own update()
  // doesn't support a "set false everywhere else" clause; the partial
  // unique index on isActive still guarantees correctness even under a
  // concurrent activate call, since the second writer's UPDATE would
  // violate the unique index and fail loudly rather than silently
  // leaving two active workspaces.
  await db
    .update(dashboardWorkspacesTable)
    .set({ isActive: false })
    .where(and(eq(dashboardWorkspacesTable.userId, userId), eq(dashboardWorkspacesTable.isActive, true)));
  const [activated] = await db
    .update(dashboardWorkspacesTable)
    .set({ isActive: true })
    .where(eq(dashboardWorkspacesTable.id, id))
    .returning();
  return toApi(activated);
}

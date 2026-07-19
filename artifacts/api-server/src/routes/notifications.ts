// Phase 4, Sprint 56 — Alerts & Notifications (approved Phase 4 plan,
// Sprint 56; see docs/Phase-4-Master-Execution-Plan.md's Sprint 56 as-built
// note). In-app notification center — the project owner's own explicit
// kickoff decision (email/push both need real credentials/infrastructure
// this session doesn't have).
//
// Every query is ownership-scoped via getScopedUserId(req) and the
// established and(eq(id), eq(userId)) pattern — 404, never a separate 403,
// matching every user-authored-resource route in this codebase since
// Sprint 7.
//
// POST /notifications/check is a thin, explicit, user-triggered wrapper
// around lib/notifications.ts's evaluateAndPersistAlertsForUser() — the
// exact same detection functions the background scheduler (index.ts's
// startAlertsScheduler, mirroring Sprint 52's startRequestMetricsTimer
// precedent of only starting from the real server entrypoint, never during
// tests) calls on an interval. Never a side effect of a plain GET.

import { Router, type IRouter } from "express";
import { db, platformNotificationsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { ListNotificationsResponse, CheckNotificationsResponse, UpdateNotificationBody, UpdateNotificationResponse } from "@workspace/api-zod";
import { evaluateAndPersistAlertsForUser } from "../lib/notifications.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

// Exported (Phase 19 — Investment Committee Workbench) so the new
// Investment Memo composition (routes/stockAnalyst.ts's own
// /investment-memo/:symbol) can reuse this exact field mapping for its
// symbol-filtered Monitoring Summary section, instead of duplicating it.
export function formatNotification(n: typeof platformNotificationsTable.$inferSelect) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    dataSource: n.dataSource,
    relatedSymbol: n.relatedSymbol,
    isRead: n.isRead,
    severity: n.severity,
    previousValue: n.previousValue,
    currentValue: n.currentValue,
    evidence: (n.evidence as string[] | null) ?? [],
    recommendedAction: n.recommendedAction,
    createdAt: n.createdAt.toISOString(),
  };
}

router.get("/notifications", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(platformNotificationsTable)
    .where(eq(platformNotificationsTable.userId, userId))
    .orderBy(desc(platformNotificationsTable.createdAt));

  res.json(ListNotificationsResponse.parse(rows.map(formatNotification)));
});

router.post("/notifications/check", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const created = await evaluateAndPersistAlertsForUser(userId);
  res.json(CheckNotificationsResponse.parse(created.map(formatNotification)));
});

router.patch("/notifications/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateNotificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .update(platformNotificationsTable)
    .set({ isRead: parsed.data.isRead })
    .where(and(eq(platformNotificationsTable.id, id), eq(platformNotificationsTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(UpdateNotificationResponse.parse(formatNotification(row)));
});

export default router;

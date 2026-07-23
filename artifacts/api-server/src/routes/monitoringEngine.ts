// Phase 16 — Institutional Monitoring & Alerts Engine.
//
// Thin route wrapper, zero business logic of its own — every real
// evaluation (symbol/portfolio change-detection, opportunity matching)
// lives in lib/monitoringEngine.ts; every persistence/dedup mechanic lives
// in lib/notifications.ts's own persistAlertCandidates(), reused verbatim.
import { Router, type IRouter } from "express";
import { db, platformNotificationsTable, investingAlertNotesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  FullMonitoringCheckResponse,
  GetAlertNotesResponse,
  AddAlertNoteBody,
  AddAlertNoteResponse,
  UpdateAlertNoteBody,
  UpdateAlertNoteResponse,
  DeleteAlertNoteResponse,
} from "@workspace/api-zod";
import { getFundamentalsProvider } from "../lib/fundamentals.js";
import { evaluateAndPersistAlertsForUser, persistAlertCandidates, type AlertCandidate } from "../lib/notifications.js";
import { evaluateOpportunityMonitoringAlerts } from "../lib/monitoringEngine.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

function formatNotification(n: typeof platformNotificationsTable.$inferSelect) {
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

router.post("/monitoring-engine/check", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const bounded = await evaluateAndPersistAlertsForUser(userId);

  const provider = await getFundamentalsProvider(userId);
  const opportunityCandidates: AlertCandidate[] = await evaluateOpportunityMonitoringAlerts(userId, provider).catch(() => []);
  const opportunityCreated = await persistAlertCandidates(userId, opportunityCandidates);

  res.json(FullMonitoringCheckResponse.parse([...bounded, ...opportunityCreated].map(formatNotification)));
});

function alertNoteItem(r: typeof investingAlertNotesTable.$inferSelect) {
  return {
    id: r.id,
    notificationId: r.notificationId,
    symbol: r.symbol,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/monitoring-engine/alert-notes", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const notificationIdRaw = req.query.notificationId;
  const symbolRaw = req.query.symbol;

  const conditions = [eq(investingAlertNotesTable.userId, userId)];
  if (typeof notificationIdRaw === "string" && Number.isInteger(Number(notificationIdRaw))) {
    conditions.push(eq(investingAlertNotesTable.notificationId, Number(notificationIdRaw)));
  }
  if (typeof symbolRaw === "string" && symbolRaw.trim()) {
    conditions.push(eq(investingAlertNotesTable.symbol, symbolRaw.trim().toUpperCase()));
  }

  const rows = await db
    .select()
    .from(investingAlertNotesTable)
    .where(and(...conditions))
    .orderBy(desc(investingAlertNotesTable.createdAt));
  res.json(GetAlertNotesResponse.parse(rows.map(alertNoteItem)));
});

router.post("/monitoring-engine/alert-notes", async (req, res): Promise<void> => {
  const parsed = AddAlertNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .insert(investingAlertNotesTable)
    .values({
      userId,
      notificationId: parsed.data.notificationId ?? null,
      symbol: parsed.data.symbol ? parsed.data.symbol.toUpperCase() : null,
      note: parsed.data.note,
    })
    .returning();
  res.json(AddAlertNoteResponse.parse(alertNoteItem(row)));
});

router.patch("/monitoring-engine/alert-notes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid alert note id" });
    return;
  }
  const parsed = UpdateAlertNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .update(investingAlertNotesTable)
    .set({ note: parsed.data.note, updatedAt: new Date() })
    .where(and(eq(investingAlertNotesTable.id, id), eq(investingAlertNotesTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Alert note not found" });
    return;
  }
  res.json(UpdateAlertNoteResponse.parse(alertNoteItem(row)));
});

router.delete("/monitoring-engine/alert-notes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid alert note id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(investingAlertNotesTable)
    .where(and(eq(investingAlertNotesTable.id, id), eq(investingAlertNotesTable.userId, userId)))
    .returning({ id: investingAlertNotesTable.id });
  res.json(DeleteAlertNoteResponse.parse({ success: !!row }));
});

export default router;

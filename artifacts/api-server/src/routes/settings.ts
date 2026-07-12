import { Router, type IRouter } from "express";
import { db, settingsTable, recordAuditEvent } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetSettingsResponse,
  UpdateSettingsResponse,
  UpdateSettingsBody,
  GetFundamentalsProviderStatusResponse,
} from "@workspace/api-zod";
import {
  fundamentalsConnectionStatus,
  getLastLiveFetch,
  getFundamentalsProviderStatuses,
} from "../lib/fundamentals.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

// Phase 1, Sprint 5 — settings is now per-user, not a singleton (§2.3). Every
// select/update is scoped by userId; this was the highest-priority leak in
// the whole phase (the old version had no WHERE clause at all on update).
// `userId` is resolved via the legacy-owner stand-in (see lib/legacyOwner.ts)
// until Sprint 6 (auth) provides the real authenticated request's userId.
export async function getOrCreateSettings(userId: string) {
  const existing = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.userId, userId))
    .limit(1);
  if (existing.length > 0) return existing[0];

  const [created] = await db
    .insert(settingsTable)
    .values({
      userId,
      executionMode: "manual",
      maxRiskPerTrade: 1.0,
      maxPortfolioRisk: 10.0,
      profitTarget50: 50.0,
      profitTarget75: 75.0,
      profitTarget90: 90.0,
      stopLossMultiplier: 2.0,
      alpacaConnected: false,
      alpacaApiKey: null,
      defaultDte: 45,
      shortDelta: 0.20,
      minIvRank: 30.0,
    })
    .returning();

  return created;
}

router.get("/settings", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const settings = await getOrCreateSettings(userId);
  // fundamentalsConnected reflects whether a live provider is actually usable
  // (selected provider + matching API key present), never a stale stored value.
  res.json(
    GetSettingsResponse.parse({
      ...settings,
      fundamentalsConnected: fundamentalsConnectionStatus(settings).connected,
      fundamentalsLastFetchedAt: getLastLiveFetch()?.at ?? null,
    }),
  );
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  await getOrCreateSettings(userId);

  const [updated] = await db
    .update(settingsTable)
    .set(parsed.data)
    .where(eq(settingsTable.userId, userId))
    .returning();

  // Phase 1, Sprint 10 — settings.updated audit event (plan §6.3), so the
  // newly-scoped per-user settings changes (including the automation kill
  // switches) are auditable from day one. metadata carries only the changed
  // field NAMES, never their values — settings includes alpacaApiKey, and no
  // secret value may ever land in the audit trail.
  await recordAuditEvent({
    userId,
    engine: "platform",
    eventType: "settings.updated",
    action: "updated",
    result: "success",
    resourceType: "settings",
    resourceId: String(updated.id),
    metadata: { changedFields: Object.keys(parsed.data) },
  });

  res.json(
    UpdateSettingsResponse.parse({
      ...updated,
      fundamentalsConnected: fundamentalsConnectionStatus(updated).connected,
      fundamentalsLastFetchedAt: getLastLiveFetch()?.at ?? null,
    }),
  );
});

// Live-provider status surface: the most recent rate-limit/outage per live
// fundamentals provider, so operators see degradation at a glance instead of
// discovering it one symbol at a time. Observability only — never mutates state.
router.get("/fundamentals/provider-status", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const settings = await getOrCreateSettings(userId);
  res.json(
    GetFundamentalsProviderStatusResponse.parse({
      statuses: getFundamentalsProviderStatuses(settings),
    }),
  );
});

export default router;

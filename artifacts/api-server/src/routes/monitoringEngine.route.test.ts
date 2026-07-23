// Phase 16 — Institutional Monitoring & Alerts Engine. Live route
// integration test proving the HTTP wiring for POST /monitoring-engine/check
// and the Alert Notes CRUD — the underlying detection/diff logic itself is
// already covered by lib/monitoringEngine.test.ts's 27 tests against
// isolated, fresh users; this file only proves the routes correctly call
// through to it and that Alert Notes persists/round-trips correctly.
//
// Uses the shared legacy-owner account (unauthenticated requests resolve to
// it, per tenantScope.ts), matching routes/notifications.route.test.ts's own
// precedent — so assertions here are deliberately per-item (find by a
// randomly-generated, collision-safe fake symbol) rather than aggregate
// counts, since this account's rows are shared across sibling test files.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { eq, and } from "drizzle-orm";
import { db, investingSavedScreensTable, investingMonitoringStatesTable } from "@workspace/db";
import { getLegacyOwnerUserId } from "../lib/legacyOwner.js";

function randomSymbol(): string {
  return "M" + Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
}

interface NotificationResponse {
  id: number;
  type: string;
  title: string;
  message: string;
  dataSource: string;
  relatedSymbol: string | null;
  isRead: boolean;
  severity: string;
  previousValue: string | null;
  currentValue: string | null;
  evidence: string[];
  recommendedAction: string | null;
  createdAt: string;
}

interface AlertNoteResponse {
  id: number;
  notificationId: number | null;
  symbol: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe("Monitoring Engine routes (live, real Postgres, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server.close();
  });

  describe("POST /monitoring-engine/check", () => {
    it(
      "returns a well-shaped, enriched array (reason/evidence/previous/current/severity/recommended action all present)",
      async () => {
        const res = await fetch(`${baseUrl}/api/monitoring-engine/check`, { method: "POST" });
        expect(res.status).toBe(200);
        const body = await json<NotificationResponse[]>(res);
        expect(Array.isArray(body)).toBe(true);
        for (const n of body) {
          expect(n).toHaveProperty("severity");
          expect(n).toHaveProperty("evidence");
          expect(n).toHaveProperty("previousValue");
          expect(n).toHaveProperty("currentValue");
          expect(n).toHaveProperty("recommendedAction");
          expect(n).toHaveProperty("createdAt");
          expect(Array.isArray(n.evidence)).toBe(true);
        }
      },
      30_000,
    );

    it("includes Opportunity Alerts (on-demand only) once a saved screen has an established baseline that later changes", async () => {
      // Two full /monitoring-engine/check calls in this one test, each doing
      // a real ~70-symbol opportunity scan plus the bounded evaluators —
      // generous per-test timeout, matching Sprint 73's own precedent for
      // heavier live-DB test scenarios.
      const created = await json<{ id: number; name: string }>(
        await fetch(`${baseUrl}/api/opportunity-discovery/saved-screens`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: `Route Test Screen ${Date.now()}`, filters: {} }),
        }),
      );

      try {
        // First call establishes the baseline for this brand-new screen —
        // never fabricates a "new match" against a non-existent prior state.
        const firstBody = await json<NotificationResponse[]>(
          await fetch(`${baseUrl}/api/monitoring-engine/check`, { method: "POST" }),
        );
        expect(firstBody.some((n) => n.type === "opportunity_match" && n.title.includes(created.name))).toBe(false);

        const userId = await getLegacyOwnerUserId();
        // Directly empty the just-written baseline (mirrors
        // lib/monitoringEngine.test.ts's own "synthetically-emptied prior
        // list" technique) so the very next check treats every ranked
        // symbol as a genuinely new match, proving the route really does
        // call through to evaluateOpportunityMonitoringAlerts() and persist
        // its output via the shared persistAlertCandidates().
        await db
          .update(investingMonitoringStatesTable)
          .set({ stateJson: [] })
          .where(
            and(
              eq(investingMonitoringStatesTable.userId, userId),
              eq(investingMonitoringStatesTable.entityType, "saved_screen"),
              eq(investingMonitoringStatesTable.entityKey, String(created.id)),
            ),
          );

        const secondBody = await json<NotificationResponse[]>(
          await fetch(`${baseUrl}/api/monitoring-engine/check`, { method: "POST" }),
        );
        const matches = secondBody.filter((n) => n.type === "opportunity_match" && n.title.includes(created.name));
        expect(matches.length).toBeGreaterThan(0);
        expect(matches[0].dataSource).toBe("SIMULATED");
        expect(matches[0].evidence.length).toBeGreaterThan(0);
      } finally {
        await fetch(`${baseUrl}/api/opportunity-discovery/saved-screens/${created.id}`, { method: "DELETE" });
        const userId = await getLegacyOwnerUserId();
        await db
          .delete(investingMonitoringStatesTable)
          .where(
            and(
              eq(investingMonitoringStatesTable.userId, userId),
              eq(investingMonitoringStatesTable.entityType, "saved_screen"),
              eq(investingMonitoringStatesTable.entityKey, String(created.id)),
            ),
          );
      }
    }, 30_000);
  });

  describe("Alert Notes CRUD", () => {
    it("creates, lists (filtered by symbol), updates, and deletes a note, 404ing for a nonexistent id", async () => {
      const symbol = randomSymbol();
      const createRes = await fetch(`${baseUrl}/api/monitoring-engine/alert-notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol, note: "Watching this one closely." }),
      });
      expect(createRes.status).toBe(200);
      const created = await json<AlertNoteResponse>(createRes);
      expect(created.symbol).toBe(symbol);
      expect(created.note).toBe("Watching this one closely.");
      expect(created.notificationId).toBeNull();

      const listRes = await fetch(`${baseUrl}/api/monitoring-engine/alert-notes?symbol=${symbol}`);
      expect(listRes.status).toBe(200);
      const list = await json<AlertNoteResponse[]>(listRes);
      expect(list.find((n) => n.id === created.id)).toBeTruthy();

      const updateRes = await fetch(`${baseUrl}/api/monitoring-engine/alert-notes/${created.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "Updated: still watching." }),
      });
      expect(updateRes.status).toBe(200);
      const updated = await json<AlertNoteResponse>(updateRes);
      expect(updated.note).toBe("Updated: still watching.");

      const deleteRes = await fetch(`${baseUrl}/api/monitoring-engine/alert-notes/${created.id}`, { method: "DELETE" });
      expect(deleteRes.status).toBe(200);
      expect((await json<{ success: boolean }>(deleteRes)).success).toBe(true);

      const afterDeleteList = await json<AlertNoteResponse[]>(
        await fetch(`${baseUrl}/api/monitoring-engine/alert-notes?symbol=${symbol}`),
      );
      expect(afterDeleteList.find((n) => n.id === created.id)).toBeUndefined();
    });

    it("404s on PATCH/DELETE for a nonexistent alert note id", async () => {
      const patchRes = await fetch(`${baseUrl}/api/monitoring-engine/alert-notes/999999999`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "irrelevant" }),
      });
      expect(patchRes.status).toBe(404);

      const deleteRes = await fetch(`${baseUrl}/api/monitoring-engine/alert-notes/999999999`, { method: "DELETE" });
      const deleteBody = await json<{ success: boolean }>(deleteRes);
      expect(deleteBody.success).toBe(false);
    });

    it("400s for a non-numeric alert note id, and for a missing required field on create", async () => {
      const patchRes = await fetch(`${baseUrl}/api/monitoring-engine/alert-notes/not-a-number`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "irrelevant" }),
      });
      expect(patchRes.status).toBe(400);

      const createRes = await fetch(`${baseUrl}/api/monitoring-engine/alert-notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(createRes.status).toBe(400);
    });

    it("filters the list by notificationId when supplied", async () => {
      const a = await json<AlertNoteResponse>(
        await fetch(`${baseUrl}/api/monitoring-engine/alert-notes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notificationId: 123456789, note: "Tied to a specific alert." }),
        }),
      );
      try {
        const filtered = await json<AlertNoteResponse[]>(
          await fetch(`${baseUrl}/api/monitoring-engine/alert-notes?notificationId=123456789`),
        );
        expect(filtered.every((n) => n.notificationId === 123456789)).toBe(true);
        expect(filtered.find((n) => n.id === a.id)).toBeTruthy();
      } finally {
        await fetch(`${baseUrl}/api/monitoring-engine/alert-notes/${a.id}`, { method: "DELETE" });
      }
    });
  });
});

// v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine. Live
// route integration test for the Opportunity Pipeline surface. Uses the
// real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts, and REQUIRE_AUTH is off by default), exercising full
// CRUD end-to-end over real HTTP. IDOR / cross-user isolation at the
// query level is covered separately in lib/tenantIsolation.test.ts,
// matching the established pattern for every other per-user table.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface OpportunityPipelineItemResponse {
  id: number;
  title: string;
  category: string;
  origin: string;
  evidence: string[];
  relatedAssets: string[];
  relatedSectors: string[];
  priority: string;
  stage: string;
  stageLabel: string;
  nextRecommendedAction: string;
  linkedNotebookId: number | null;
  relatedResearchSymbol: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

describe("Opportunity Pipeline routes (live, real Postgres)", () => {
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

  it("captures, lists, updates stage/priority, and deletes an opportunity pipeline item (full CRUD)", async () => {
    const createRes = await fetch(`${baseUrl}/api/opportunity-pipeline/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "AAPL: watchlist margin-of-safety target crossed",
        category: "watchlist_event",
        origin: "Watchlist — margin-of-safety target crossed (checkTargets)",
        evidence: ["Current price is at least 20% below fair value estimate."],
        relatedAssets: ["AAPL"],
        relatedSectors: [],
        priority: "high",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as OpportunityPipelineItemResponse;
    expect(created.id).toBeGreaterThan(0);
    expect(created.category).toBe("watchlist_event");
    expect(created.stage).toBe("discovered");
    expect(created.stageLabel).toBe("Discovered");
    expect(created.nextRecommendedAction.length).toBeGreaterThan(0);
    expect(created.linkedNotebookId).toBeNull();
    expect(created.relatedResearchSymbol).toBeNull();
    expect(created.archivedAt).toBeNull();

    const listRes = await fetch(`${baseUrl}/api/opportunity-pipeline/items`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as OpportunityPipelineItemResponse[];
    expect(list.some((i) => i.id === created.id)).toBe(true);

    const patchRes = await fetch(`${baseUrl}/api/opportunity-pipeline/items/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: "research-candidate", priority: "medium", relatedResearchSymbol: "AAPL" }),
    });
    expect(patchRes.status).toBe(200);
    const updated = (await patchRes.json()) as OpportunityPipelineItemResponse;
    expect(updated.stage).toBe("research-candidate");
    expect(updated.stageLabel).toBe("Research Candidate");
    expect(updated.priority).toBe("medium");
    expect(updated.relatedResearchSymbol).toBe("AAPL");
    // Every prior field not part of this PATCH is untouched — never
    // silently reset.
    expect(updated.title).toBe(created.title);
    expect(updated.evidence).toEqual(created.evidence);

    const deleteRes = await fetch(`${baseUrl}/api/opportunity-pipeline/items/${created.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(200);
    expect(((await deleteRes.json()) as { success: boolean }).success).toBe(true);

    const listAfterDelete = (await (await fetch(`${baseUrl}/api/opportunity-pipeline/items`)).json()) as OpportunityPipelineItemResponse[];
    expect(listAfterDelete.some((i) => i.id === created.id)).toBe(false);
  });

  it("stamps archivedAt when moved to the archived stage, and clears it if moved back out", async () => {
    const createRes = await fetch(`${baseUrl}/api/opportunity-pipeline/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Sector development — semiconductors",
        category: "sector_development",
        origin: "Market Intelligence — sector_trends",
        evidence: ["Real evidence line."],
        relatedAssets: [],
        relatedSectors: ["Semiconductors"],
        priority: "low",
      }),
    });
    const created = (await createRes.json()) as OpportunityPipelineItemResponse;

    const archiveRes = await fetch(`${baseUrl}/api/opportunity-pipeline/items/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: "archived" }),
    });
    const archived = (await archiveRes.json()) as OpportunityPipelineItemResponse;
    expect(archived.archivedAt).not.toBeNull();
    expect(archived.nextRecommendedAction).toMatch(/no further action/i);

    const revivedRes = await fetch(`${baseUrl}/api/opportunity-pipeline/items/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: "screening" }),
    });
    const revived = (await revivedRes.json()) as OpportunityPipelineItemResponse;
    expect(revived.archivedAt).toBeNull();

    await fetch(`${baseUrl}/api/opportunity-pipeline/items/${created.id}`, { method: "DELETE" });
  });

  it("404s on PATCH/DELETE for a non-existent id, 400 for a non-numeric id, 400 for a missing required field", async () => {
    const patchMissing = await fetch(`${baseUrl}/api/opportunity-pipeline/items/999999999`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: "screening" }),
    });
    expect(patchMissing.status).toBe(404);

    const deleteMissing = await fetch(`${baseUrl}/api/opportunity-pipeline/items/999999999`, { method: "DELETE" });
    expect(((await deleteMissing.json()) as { success: boolean }).success).toBe(false);

    const invalidId = await fetch(`${baseUrl}/api/opportunity-pipeline/items/not-a-number`, { method: "DELETE" });
    expect(invalidId.status).toBe(400);

    const missingField = await fetch(`${baseUrl}/api/opportunity-pipeline/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: "earnings" }),
    });
    expect(missingField.status).toBe(400);
  });

  it("never carries a trading-signal or recommendation-to-trade field — out of scope by design", async () => {
    const createRes = await fetch(`${baseUrl}/api/opportunity-pipeline/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Earnings in 5 days",
        category: "earnings",
        origin: "Market Intelligence — earnings",
        evidence: ["Earnings scheduled."],
        relatedAssets: ["MSFT"],
        relatedSectors: [],
        priority: "medium",
      }),
    });
    const created = (await createRes.json()) as Record<string, unknown>;
    expect(created).not.toHaveProperty("signal");
    expect(created).not.toHaveProperty("recommendation");
    expect(created).not.toHaveProperty("buySignal");
    expect(created).not.toHaveProperty("priceTarget");
    await fetch(`${baseUrl}/api/opportunity-pipeline/items/${created.id}`, { method: "DELETE" });
  });
});

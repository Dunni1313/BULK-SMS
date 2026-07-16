// Phase 3, Sprint 39 — live route integration test for the Trading Journal
// surface. Uses the real app + a real Postgres connection (no auth session
// needed — unauthenticated requests resolve to the legacy-owner stand-in
// per tenantScope.ts, and REQUIRE_AUTH is off by default), exercising full
// CRUD end-to-end over real HTTP. IDOR / cross-user isolation at the query
// level is covered separately in lib/tenantIsolation.test.ts, matching the
// established pattern for trades/journal_entries/value_watchlist.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface TradingJournalEntry {
  id: number;
  tradingPositionId: number | null;
  title: string;
  content: string;
  mood: string;
  lessonLearned: string | null;
  tags: string[];
  setupType: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  rMultiple: number | null;
  createdAt: string;
  updatedAt: string;
}

describe("Trading Journal routes (live, real Postgres)", () => {
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

  it("creates, lists, gets, updates, and deletes a trading journal entry (full CRUD)", async () => {
    const createRes = await fetch(`${baseUrl}/api/trading/journal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "AAPL breakout entry",
        content: "Entered on a clean structure break above the 20-day high.",
        mood: "confident",
        tags: ["breakout", "AAPL"],
        setupType: "breakout",
        entryPrice: 195.5,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as TradingJournalEntry;
    expect(created.id).toBeGreaterThan(0);
    expect(created.title).toBe("AAPL breakout entry");
    expect(created.mood).toBe("confident");
    expect(created.tags).toEqual(["breakout", "AAPL"]);
    expect(created.lessonLearned).toBeNull();
    expect(created.tradingPositionId).toBeNull();

    const listRes = await fetch(`${baseUrl}/api/trading/journal`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as TradingJournalEntry[];
    expect(list.some((e) => e.id === created.id)).toBe(true);

    const getRes = await fetch(`${baseUrl}/api/trading/journal/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as TradingJournalEntry;
    expect(fetched.id).toBe(created.id);

    const patchRes = await fetch(`${baseUrl}/api/trading/journal/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lessonLearned: "Waited for volume confirmation next time.", exitPrice: 205, rMultiple: 2.1 }),
    });
    expect(patchRes.status).toBe(200);
    const updated = (await patchRes.json()) as TradingJournalEntry;
    expect(updated.lessonLearned).toBe("Waited for volume confirmation next time.");
    expect(updated.exitPrice).toBe(205);
    expect(updated.rMultiple).toBe(2.1);
    // Fields not included in the PATCH body must be unchanged.
    expect(updated.title).toBe("AAPL breakout entry");

    const deleteRes = await fetch(`${baseUrl}/api/trading/journal/${created.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);

    const getAfterDeleteRes = await fetch(`${baseUrl}/api/trading/journal/${created.id}`);
    expect(getAfterDeleteRes.status).toBe(404);
  });

  it("accepts a tradingPositionId reference without requiring the position to actually exist (loose reference, per journal_entries.trade_id precedent)", async () => {
    const createRes = await fetch(`${baseUrl}/api/trading/journal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Linked to a position",
        content: "content",
        mood: "neutral",
        tradingPositionId: 999999,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as TradingJournalEntry;
    expect(created.tradingPositionId).toBe(999999);
  });

  it("returns 400 for a missing required field", async () => {
    const res = await fetch(`${baseUrl}/api/trading/journal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "no title", mood: "neutral" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid mood enum value, never silently accepting it", async () => {
    const res = await fetch(`${baseUrl}/api/trading/journal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "t", content: "c", mood: "ecstatic" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 (not a fabricated success) for GET/PATCH/DELETE on a nonexistent id", async () => {
    const getRes = await fetch(`${baseUrl}/api/trading/journal/999999999`);
    expect(getRes.status).toBe(404);

    const patchRes = await fetch(`${baseUrl}/api/trading/journal/999999999`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    expect(patchRes.status).toBe(404);

    const deleteRes = await fetch(`${baseUrl}/api/trading/journal/999999999`, { method: "DELETE" });
    expect(deleteRes.status).toBe(404);
  });

  it("returns 400 for a non-numeric id, never attempting a NaN-id query", async () => {
    const res = await fetch(`${baseUrl}/api/trading/journal/not-a-number`);
    expect(res.status).toBe(400);
  });
});

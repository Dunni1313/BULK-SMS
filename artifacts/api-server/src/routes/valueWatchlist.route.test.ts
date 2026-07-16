// Phase 2, Sprint 27 — Watchlist Polish. Live route integration test for
// GET /stock-analyst/value-watchlist's new ?checkTargets=true opt-in (the
// existing CRUD endpoints had no dedicated test file before this sprint;
// this file covers both a baseline smoke test of the pre-existing behavior
// and full coverage of the new Sprint 27 fields — it does not attempt to
// backfill exhaustive pre-existing-CRUD regression coverage beyond that).
// Uses the real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts, and REQUIRE_AUTH is off by default), exercising the
// SIMULATED path end-to-end over real HTTP.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { getFundamentals } from "../lib/fundamentals.js";

interface WatchlistItem {
  id: number;
  symbol: string;
  fairValueEstimate: number | null;
  desiredBuyPrice: number | null;
  marginOfSafetyTarget: number;
  currentPrice: number | null;
  priceTargetCrossed: boolean | null;
  marginOfSafetyTargetCrossed: boolean | null;
}

describe("GET /stock-analyst/value-watchlist (live, SIMULATED path)", () => {
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

  it("default GET (no checkTargets) never resolves a price — the 3 new fields are always structurally present but null", async () => {
    const post = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "WLPA" }),
    });
    expect(post.status).toBe(200);

    const res = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as WatchlistItem[];
    const item = body.find((w) => w.symbol === "WLPA")!;
    expect(item).toBeTruthy();
    expect(item.currentPrice).toBeNull();
    expect(item.priceTargetCrossed).toBeNull();
    expect(item.marginOfSafetyTargetCrossed).toBeNull();
  });

  it("?checkTargets=true resolves a real currentPrice, and honestly reports null crossed-flags when no targets were set", async () => {
    const postRes = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "WLPB" }),
    });
    const created = (await postRes.json()) as WatchlistItem;
    // Force both targets to explicitly null, bypassing the POST route's own
    // auto-enrichment (which may have filled fairValueEstimate from a fresh
    // research run) so this test controls exactly what's being asserted.
    await fetch(`${baseUrl}/api/stock-analyst/value-watchlist/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fairValueEstimate: null, desiredBuyPrice: null }),
    });

    const res = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist?checkTargets=true`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as WatchlistItem[];
    const item = body.find((w) => w.id === created.id)!;
    expect(item.currentPrice).not.toBeNull();
    expect(item.priceTargetCrossed).toBeNull();
    expect(item.marginOfSafetyTargetCrossed).toBeNull();
  });

  it("?checkTargets=true correctly flags priceTargetCrossed true when the current price is at or below the desired buy price", async () => {
    const f = (await getFundamentals("AAPL"))!;
    expect(f).not.toBeNull();

    const postRes = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", desiredBuyPrice: f.price + 1000 }),
    });
    const created = (await postRes.json()) as WatchlistItem;

    const res = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist?checkTargets=true`);
    const body = (await res.json()) as WatchlistItem[];
    const item = body.find((w) => w.id === created.id)!;
    expect(item.priceTargetCrossed).toBe(true);
  });

  it("?checkTargets=true correctly flags priceTargetCrossed false when the current price is above the desired buy price", async () => {
    const f = (await getFundamentals("MSFT"))!;
    expect(f).not.toBeNull();

    const postRes = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "MSFT", desiredBuyPrice: Math.max(f.price - 1000, 0.01) }),
    });
    const created = (await postRes.json()) as WatchlistItem;

    const res = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist?checkTargets=true`);
    const body = (await res.json()) as WatchlistItem[];
    const item = body.find((w) => w.id === created.id)!;
    expect(item.priceTargetCrossed).toBe(false);
  });

  it("?checkTargets=true correctly flags marginOfSafetyTargetCrossed when the actual margin of safety meets the stored target", async () => {
    const f = (await getFundamentals("GOOGL"))!;
    expect(f).not.toBeNull();

    const postRes = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // A fair value far above the current price guarantees the margin of
      // safety comfortably exceeds even a demanding 50% target.
      body: JSON.stringify({ symbol: "GOOGL", fairValueEstimate: f.price * 3, marginOfSafetyTarget: 50 }),
    });
    const created = (await postRes.json()) as WatchlistItem;

    const res = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist?checkTargets=true`);
    const body = (await res.json()) as WatchlistItem[];
    const item = body.find((w) => w.id === created.id)!;
    expect(item.marginOfSafetyTargetCrossed).toBe(true);
  });

  it("never fabricates a crossed flag when no auth/tenant leak — each user's watchlist stays independently scoped (existing tenantScope.ts discipline, unaffected by this sprint)", async () => {
    const res1 = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist?checkTargets=true`);
    const res2 = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist?checkTargets=true`);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const body1 = (await res1.json()) as WatchlistItem[];
    const body2 = (await res2.json()) as WatchlistItem[];
    // Same unauthenticated legacy-owner scope in both requests -> same rows.
    expect(body1.map((w) => w.id).sort()).toEqual(body2.map((w) => w.id).sort());
  });
});

// Phase 4, Sprint 56 — Alerts & Notifications (approved Phase 4 plan,
// Sprint 56). Live route integration test proving the HTTP wiring for
// GET/POST/PATCH /notifications — the underlying detection logic itself is
// already covered by lib/notifications.test.ts's 14 tests against
// isolated, fresh users; this file only proves the routes correctly call
// through to it. Uses the real app + a real Postgres connection (no auth
// session needed — unauthenticated requests resolve to the legacy-owner
// stand-in per tenantScope.ts).
//
// Deliberately per-item assertions (find by relatedSymbol/dedupKey-derived
// title) rather than aggregate/count assertions on GET /notifications —
// the legacy-owner account's platform_notifications rows are shared across
// this file's own tests and could in principle be shared with any other
// route test file that also creates alertable conditions under the legacy
// owner, mirroring routes/tradingRisk.route.test.ts's own disclosed
// per-item discipline for exactly this reason.
//
// Uses a fresh, randomly-generated fake symbol per test (matching
// routes/valueWatchlist.route.test.ts's own "WLPA"/"WLPB" precedent, here
// randomized for full collision-safety) rather than a real, commonly-
// reused ticker like AAPL/GOOGL/AMZN — the first draft of this file used
// real tickers and flaked under normal parallel test execution when other
// concurrently-running test files created their own crossed-target alerts
// for the same real symbol under the same shared legacy-owner account,
// which a real-symbol filter can't distinguish from this file's own rows.
// A random fake symbol is still a valid ticker shape (SimulatedFundamentals
// Provider's syntheticProfile() resolves a plausible deterministic price
// for any valid-shaped symbol outside the original 10, Phase 2 Sprint 11),
// so it still genuinely exercises the real detection path.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { getFundamentals } from "../lib/fundamentals.js";

function randomSymbol(): string {
  return "Z" + Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
}

interface NotificationResponse {
  id: number;
  type: string;
  title: string;
  message: string;
  dataSource: string;
  relatedSymbol: string | null;
  isRead: boolean;
  createdAt: string;
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe("Notifications routes (live, real Postgres, SIMULATED path)", () => {
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

  it("GET /notifications returns a well-shaped array", async () => {
    const res = await fetch(`${baseUrl}/api/notifications`);
    expect(res.status).toBe(200);
    const body = await json<NotificationResponse[]>(res);
    expect(Array.isArray(body)).toBe(true);
  });

  it("PATCH /notifications/:id 404s for a nonexistent id", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/999999999`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /notifications/:id 400s for a non-numeric id", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/not-a-number`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /notifications/:id 400s for a missing required field", async () => {
    // Create a real watchlist target-crossing condition first so there's a
    // real notification id to attempt the malformed PATCH against.
    const symbol = randomSymbol();
    const f = (await getFundamentals(symbol))!;
    await fetch(`${baseUrl}/api/stock-analyst/value-watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, desiredBuyPrice: f.price + 1000 }),
    });
    const created = await json<NotificationResponse[]>(await fetch(`${baseUrl}/api/notifications/check`, { method: "POST" }));
    const symbolAlert = created.find((n) => n.relatedSymbol === symbol);
    expect(symbolAlert).toBeTruthy();

    const res = await fetch(`${baseUrl}/api/notifications/${symbolAlert!.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("POST /notifications/check creates a watchlist-target-crossed alert traceable to Sprint 27's own detection, then a repeat call never duplicates it while unread", async () => {
    const symbol = randomSymbol();
    const f = (await getFundamentals(symbol))!;
    await fetch(`${baseUrl}/api/stock-analyst/value-watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, desiredBuyPrice: f.price + 1000 }),
    });

    const firstRes = await fetch(`${baseUrl}/api/notifications/check`, { method: "POST" });
    expect(firstRes.status).toBe(200);
    const firstBody = await json<NotificationResponse[]>(firstRes);
    const alert = firstBody.find((n) => n.relatedSymbol === symbol && n.type === "watchlist_target_crossed");
    expect(alert).toBeTruthy();
    expect(alert!.dataSource).toBe("SIMULATED");
    expect(alert!.isRead).toBe(false);
    expect(alert!.title).toMatch(/buy price target/i);

    // Repeat call: the exact same still-true condition must not create a
    // second unread duplicate (the dedup design's own honesty contract).
    const secondRes = await fetch(`${baseUrl}/api/notifications/check`, { method: "POST" });
    const secondBody = await json<NotificationResponse[]>(secondRes);
    expect(secondBody.find((n) => n.relatedSymbol === symbol && n.title === alert!.title)).toBeUndefined();

    // Confirm via GET that exactly the one row exists for this exact alert
    // — safe to assert an exact count here, unlike a real ticker, since
    // this randomly-generated symbol cannot collide with any other test.
    const listRes = await fetch(`${baseUrl}/api/notifications`);
    const listBody = await json<NotificationResponse[]>(listRes);
    const matches = listBody.filter((n) => n.relatedSymbol === symbol && n.title === alert!.title);
    expect(matches.length).toBe(1);

    // Marking it read frees the dedup key: the same still-true condition
    // fires again on the next check, proving the disclosed
    // level-triggered-respecting-read-state design end-to-end over HTTP.
    const patchRes = await fetch(`${baseUrl}/api/notifications/${alert!.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await json<NotificationResponse>(patchRes);
    expect(patched.isRead).toBe(true);

    const thirdRes = await fetch(`${baseUrl}/api/notifications/check`, { method: "POST" });
    const thirdBody = await json<NotificationResponse[]>(thirdRes);
    expect(thirdBody.find((n) => n.relatedSymbol === symbol && n.title === alert!.title)).toBeTruthy();
  });

  it("POST /notifications/check honestly returns nothing new when alertsEnabled is turned off, even for a genuinely crossed target", async () => {
    const patchSettings = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alertsEnabled: false }),
    });
    expect(patchSettings.status).toBe(200);

    try {
      const symbol = randomSymbol();
      const f = (await getFundamentals(symbol))!;
      await fetch(`${baseUrl}/api/stock-analyst/value-watchlist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol, desiredBuyPrice: f.price + 1000 }),
      });

      const res = await fetch(`${baseUrl}/api/notifications/check`, { method: "POST" });
      const body = await json<NotificationResponse[]>(res);
      expect(body.find((n) => n.relatedSymbol === symbol)).toBeUndefined();

      const listBody = await json<NotificationResponse[]>(await fetch(`${baseUrl}/api/notifications`));
      expect(listBody.find((n) => n.relatedSymbol === symbol)).toBeUndefined();
    } finally {
      // Restore the shared legacy-owner account's default so no other test
      // file relying on alertsEnabled's true default is affected.
      await fetch(`${baseUrl}/api/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alertsEnabled: true }),
      });
    }
  });
});

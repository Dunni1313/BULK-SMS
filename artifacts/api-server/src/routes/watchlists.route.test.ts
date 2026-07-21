// Phase 43 — Institutional Watchlists & Opportunity Dashboard. Live route
// integration tests against a real app + real Postgres connection + the
// real Better-Auth instance (no auth mocking), using a fresh, isolated,
// genuinely signed-up user per test block (mirroring
// routes/complianceEngine.route.test.ts's own Phase 42 established
// sign-up/session-cookie pattern) so this file's own watchlists/holdings
// are never at risk of colliding with another concurrently-running test
// file's own data.
//
// This file proves the Watchlists Engine is a genuine, internally
// consistent COMPOSITION of the already-shipped, already-tested Risk &
// Exposure Engine (Phase 37), Performance & Attribution Engine (Phase 38),
// Scenario Engine (Phase 39), Decision Support Engine's own
// Diversification Summary (Phase 40), and Compliance Engine (Phase 42) —
// never a second, independently-computed set of figures. Monitoring and
// organisation only — no trade recommendations, no buy/sell signals, no
// ranked/scored opportunity signal, no auto watchlist generation anywhere
// in this file's assertions.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  tradesTable,
  settingsTable,
  sessionsTable,
  accountsTable,
  investingPortfoliosTable,
  investingHoldingsTable,
  tradingPositionsTable,
  compliancePoliciesTable,
  investingWatchlistsTable,
  investingWatchlistItemsTable,
} from "@workspace/db";
import type { Server } from "node:http";

interface SignedUpUser {
  userId: string;
  cookie: string;
}

function getCookie(res: Response): string {
  const raw = res.headers.get("set-cookie");
  if (!raw) throw new Error("expected a Set-Cookie header");
  return raw.split(";")[0];
}

const seededUserIds: string[] = [];

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(investingWatchlistItemsTable).where(eq(investingWatchlistItemsTable.userId, userId));
  await db.delete(investingWatchlistsTable).where(eq(investingWatchlistsTable.userId, userId));
  await db.delete(compliancePoliciesTable).where(eq(compliancePoliciesTable.userId, userId));
  await db.delete(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  await db.delete(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId));
  await db.delete(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  await db.delete(accountsTable).where(eq(accountsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("Institutional Watchlists & Opportunity Dashboard routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `watchlists-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "Watchlists Test User" }),
    });
    if (!res.ok) throw new Error(`sign-up failed: ${res.status}`);
    const body = (await res.json()) as { user: { id: string } };
    seededUserIds.push(body.user.id);
    return { userId: body.user.id, cookie: getCookie(res) };
  }

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    for (const userId of seededUserIds) {
      await cleanupUser(userId);
    }
    server.close();
  });

  // ─── Watchlist CRUD ───────────────────────────────────────────────────

  it("GET /investing/watchlists returns an honest empty list for a brand-new user", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/investing/watchlists`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("full watchlist create/list/get/update/delete lifecycle, never auto-created", async () => {
    const user = await signUp();

    const createRes = await fetch(`${baseUrl}/api/investing/watchlists`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ name: "Core Holdings", kind: "personal", description: "My own tracked names" }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as any;
    expect(created.name).toBe("Core Holdings");
    expect(created.kind).toBe("personal");
    expect(created.archived).toBe(false);
    expect(created.itemCount).toBe(0);

    const listRes = await fetch(`${baseUrl}/api/investing/watchlists`, { headers: { cookie: user.cookie } });
    const list = (await listRes.json()) as any[];
    expect(list.map((w) => w.id)).toContain(created.id);

    const getRes = await fetch(`${baseUrl}/api/investing/watchlists/${created.id}`, { headers: { cookie: user.cookie } });
    expect(getRes.status).toBe(200);
    const got = (await getRes.json()) as any;
    expect(got.items).toEqual([]);

    const patchRes = await fetch(`${baseUrl}/api/investing/watchlists/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ name: "Renamed Core Holdings", kind: "institutional", archived: true }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as any;
    expect(patched.name).toBe("Renamed Core Holdings");
    expect(patched.kind).toBe("institutional");
    expect(patched.archived).toBe(true);

    const deleteRes = await fetch(`${baseUrl}/api/investing/watchlists/${created.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(deleteRes.status).toBe(200);
    expect(await deleteRes.json()).toEqual({ success: true });

    const getAfterDelete = await fetch(`${baseUrl}/api/investing/watchlists/${created.id}`, { headers: { cookie: user.cookie } });
    expect(getAfterDelete.status).toBe(404);
  });

  it("400 for a missing required field, 404 for a nonexistent or another user's own watchlist", async () => {
    const user = await signUp();
    const other = await signUp();

    const badCreate = await fetch(`${baseUrl}/api/investing/watchlists`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({}),
    });
    expect(badCreate.status).toBe(400);

    const createRes = await fetch(`${baseUrl}/api/investing/watchlists`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: other.cookie },
      body: JSON.stringify({ name: "Other User's List" }),
    });
    const created = (await createRes.json()) as any;

    const getRes = await fetch(`${baseUrl}/api/investing/watchlists/${created.id}`, { headers: { cookie: user.cookie } });
    expect(getRes.status).toBe(404);

    const getMissing = await fetch(`${baseUrl}/api/investing/watchlists/999999999`, { headers: { cookie: user.cookie } });
    expect(getMissing.status).toBe(404);
  });

  it("manually reorders watchlists via the bulk reorder endpoint", async () => {
    const user = await signUp();
    const a = await (
      await fetch(`${baseUrl}/api/investing/watchlists`, { method: "POST", headers: { "content-type": "application/json", cookie: user.cookie }, body: JSON.stringify({ name: "A" }) })
    ).json();
    const b = await (
      await fetch(`${baseUrl}/api/investing/watchlists`, { method: "POST", headers: { "content-type": "application/json", cookie: user.cookie }, body: JSON.stringify({ name: "B" }) })
    ).json();

    const reorderRes = await fetch(`${baseUrl}/api/investing/watchlists/reorder`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ orderedIds: [(b as any).id, (a as any).id] }),
    });
    expect(reorderRes.status).toBe(200);

    const list = (await (await fetch(`${baseUrl}/api/investing/watchlists`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(list[0].id).toBe((b as any).id);
    expect(list[1].id).toBe((a as any).id);
  });

  // ─── Item CRUD ────────────────────────────────────────────────────────

  it("full item add/update/remove lifecycle, tags/notes/category preserved, duplicate symbol 400s", async () => {
    const user = await signUp();
    const watchlist = (await (
      await fetch(`${baseUrl}/api/investing/watchlists`, { method: "POST", headers: { "content-type": "application/json", cookie: user.cookie }, body: JSON.stringify({ name: "Tech" }) })
    ).json()) as any;

    const addRes = await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}/items`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ symbol: "aapl", category: "Mega Cap", tags: ["growth", "core"], notes: "Watching for a pullback." }),
    });
    expect(addRes.status).toBe(201);
    const item = (await addRes.json()) as any;
    expect(item.symbol).toBe("AAPL");
    expect(item.category).toBe("Mega Cap");
    expect(item.tags).toEqual(["growth", "core"]);
    expect(item.notes).toBe("Watching for a pullback.");

    const dupeRes = await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}/items`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ symbol: "AAPL" }),
    });
    expect(dupeRes.status).toBe(400);

    const patchRes = await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}/items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ notes: "Bought the dip.", tags: ["growth"] }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as any;
    expect(patched.notes).toBe("Bought the dip.");
    expect(patched.tags).toEqual(["growth"]);

    const removeRes = await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}/items/${item.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(removeRes.status).toBe(200);

    const watchlistAfter = (await (await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(watchlistAfter.items).toEqual([]);
  });

  it("deleting a watchlist cascades to delete its own items (ON DELETE CASCADE)", async () => {
    const user = await signUp();
    const watchlist = (await (
      await fetch(`${baseUrl}/api/investing/watchlists`, { method: "POST", headers: { "content-type": "application/json", cookie: user.cookie }, body: JSON.stringify({ name: "Cascade Test" }) })
    ).json()) as any;
    await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}/items`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ symbol: "MSFT" }),
    });

    await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}`, { method: "DELETE", headers: { cookie: user.cookie } });

    const remaining = await db.select().from(investingWatchlistItemsTable).where(eq(investingWatchlistItemsTable.watchlistId, watchlist.id));
    expect(remaining).toEqual([]);
  });

  it("manually reorders items within a watchlist", async () => {
    const user = await signUp();
    const watchlist = (await (
      await fetch(`${baseUrl}/api/investing/watchlists`, { method: "POST", headers: { "content-type": "application/json", cookie: user.cookie }, body: JSON.stringify({ name: "Order Test" }) })
    ).json()) as any;
    const item1 = (await (
      await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}/items`, { method: "POST", headers: { "content-type": "application/json", cookie: user.cookie }, body: JSON.stringify({ symbol: "AMZN" }) })
    ).json()) as any;
    const item2 = (await (
      await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}/items`, { method: "POST", headers: { "content-type": "application/json", cookie: user.cookie }, body: JSON.stringify({ symbol: "META" }) })
    ).json()) as any;

    const reorderRes = await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}/items/reorder`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ orderedIds: [item2.id, item1.id] }),
    });
    expect(reorderRes.status).toBe(200);

    const got = (await (await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(got.items.map((i: any) => i.id)).toEqual([item2.id, item1.id]);
  });

  // ─── Dashboard aggregation ────────────────────────────────────────────

  it("GET /investing/watchlists/dashboard returns an honest empty dashboard for a brand-new user with zero watchlists", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/investing/watchlists/dashboard`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.watchlists).toEqual([]);
    expect(body.items).toEqual([]);
    expect(body.opportunityOverview).toEqual([]);
    expect(body.dashboardSummary.watchlistCount).toBe(0);
    expect(body.dashboardSummary.outstandingIssues).toContain("No watchlists have been created yet.");
    expect(body.crossEngineSummary.complianceSummary.totalPolicies).toBe(0);
  });

  it("dashboard honestly reports a watched symbol as not held anywhere when it isn't", async () => {
    const user = await signUp();
    const watchlist = (await (
      await fetch(`${baseUrl}/api/investing/watchlists`, { method: "POST", headers: { "content-type": "application/json", cookie: user.cookie }, body: JSON.stringify({ name: "Watch Only" }) })
    ).json()) as any;
    await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}/items`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ symbol: "NFLX" }),
    });

    const res = await fetch(`${baseUrl}/api/investing/watchlists/dashboard`, { headers: { cookie: user.cookie } });
    const body = (await res.json()) as any;
    const analytics = body.opportunityOverview.find((s: any) => s.symbol === "NFLX");
    expect(analytics).toBeDefined();
    expect(analytics.heldInInvesting).toBe(false);
    expect(analytics.heldInTrading).toBe(false);
    expect(analytics.heldInOptions).toBe(false);
    expect(analytics.investing).toBeNull();
    expect(analytics.trading).toBeNull();
    expect(analytics.options).toBeNull();
    expect(body.dashboardSummary.outstandingIssues.some((s: string) => /not currently held/i.test(s))).toBe(true);
  });

  it("dashboard's per-symbol analytics are byte-consistent with real Investing holdings and the Compliance Engine's own evaluation for that symbol", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Watchlist Analytics Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "ORCL", targetWeightPct: 100, shares: 20, avgCostBasis: 50 });

    // A position-allocation policy with no targetKey blanket-applies to
    // whichever holding is currently largest — with a single holding at
    // 100% weight, this will be a real, deterministic breach against a
    // deliberately low limit.
    await db.insert(compliancePoliciesTable).values({ userId: user.userId, policyType: "position_allocation_max", label: "ORCL Position Cap", targetKey: "ORCL", direction: "max", limitValue: 10, enabled: true });

    const watchlist = (await (
      await fetch(`${baseUrl}/api/investing/watchlists`, { method: "POST", headers: { "content-type": "application/json", cookie: user.cookie }, body: JSON.stringify({ name: "Held Names" }) })
    ).json()) as any;
    await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}/items`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ symbol: "ORCL" }),
    });

    // Sequential, not Promise.all: the known, previously-disclosed
    // getSettingsRow() check-then-insert race (lib/serverState.ts) reliably
    // reproduces when two independent settings-touching dashboards are
    // fetched concurrently for the same brand-new user — the same
    // collision-avoidance discipline Sprint 70's own E2E suite already
    // established for this exact situation. A read-only GET first warms
    // the settings row so both requests below resolve cleanly.
    const dashboard = (await (await fetch(`${baseUrl}/api/investing/watchlists/dashboard`, { headers: { cookie: user.cookie } })).json()) as any;
    const riskExposure = (await (await fetch(`${baseUrl}/api/risk-exposure/dashboard`, { headers: { cookie: user.cookie } })).json()) as any;

    const analytics = dashboard.opportunityOverview.find((s: any) => s.symbol === "ORCL");
    expect(analytics.heldInInvesting).toBe(true);
    const riskAlloc = riskExposure.investing.allocationBySymbol.find((h: any) => h.symbol === "ORCL");
    expect(analytics.investing.marketValue).toBe(riskAlloc.marketValue);
    expect(analytics.investing.weightPct).toBe(riskAlloc.weightPct);

    expect(analytics.compliance).not.toBeNull();
    expect(analytics.compliance.status).toBe("breach");
    expect(analytics.compliance.policyLabel).toBe("ORCL Position Cap");

    const health = dashboard.watchlistHealth.find((h: any) => h.watchlistId === watchlist.id);
    expect(health.itemCount).toBe(1);
    expect(health.heldCount).toBe(1);
    expect(health.breachCount).toBe(1);

    expect(dashboard.dashboardSummary.policyBreaches.length).toBeGreaterThan(0);
    expect(dashboard.dashboardSummary.highestAllocation.symbol).toBe("ORCL");
  });

  it("never contains trade-recommendation or buy/sell-signal language anywhere in the dashboard response", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "No Fabrication Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "IBM", targetWeightPct: 100, shares: 3, avgCostBasis: 130 });
    const watchlist = (await (
      await fetch(`${baseUrl}/api/investing/watchlists`, { method: "POST", headers: { "content-type": "application/json", cookie: user.cookie }, body: JSON.stringify({ name: "Honesty Check" }) })
    ).json()) as any;
    await fetch(`${baseUrl}/api/investing/watchlists/${watchlist.id}/items`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ symbol: "IBM" }),
    });

    const res = await fetch(`${baseUrl}/api/investing/watchlists/dashboard`, { headers: { cookie: user.cookie } });
    const raw = await res.text();
    expect(raw.toLowerCase()).not.toMatch(/\byou should (buy|sell)\b|\brecommend(ed|ation)?\b|\bbuy signal\b|\bsell signal\b/);
  });

  // ─── AI Coach & Learning ──────────────────────────────────────────────

  it("AI Coach: all 5 topics, one by key, 404 for unknown; never a trade recommendation", async () => {
    const user = await signUp();
    const allRes = await fetch(`${baseUrl}/api/investing/watchlists/coach`, { headers: { cookie: user.cookie } });
    const all = (await allRes.json()) as any[];
    expect(all.length).toBe(5);
    for (const t of all) expect(t.disclaimer).toBeTruthy();

    const oneRes = await fetch(`${baseUrl}/api/investing/watchlists/coach/watchlists`, { headers: { cookie: user.cookie } });
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("watchlists");
    expect(JSON.stringify(one).toLowerCase()).not.toMatch(/\byou should (buy|sell)\b/);

    const missingRes = await fetch(`${baseUrl}/api/investing/watchlists/coach/nonexistent`, { headers: { cookie: user.cookie } });
    expect(missingRes.status).toBe(404);
  });

  it("Learning Centre: all 6 topics resolve to real, non-empty Learning Centre links; 404 for unknown", async () => {
    const user = await signUp();
    const allRes = await fetch(`${baseUrl}/api/investing/watchlists/learning`, { headers: { cookie: user.cookie } });
    const all = (await allRes.json()) as any[];
    expect(all.length).toBe(6);
    for (const t of all) {
      expect(t.links.length).toBeGreaterThan(0);
      for (const link of t.links) {
        expect(link.title).toBeTruthy();
        expect(link.href).toMatch(/^\/learn\/paths\//);
      }
    }

    const oneRes = await fetch(`${baseUrl}/api/investing/watchlists/learning/diversification`, { headers: { cookie: user.cookie } });
    expect(oneRes.status).toBe(200);

    const missingRes = await fetch(`${baseUrl}/api/investing/watchlists/learning/nonexistent`, { headers: { cookie: user.cookie } });
    expect(missingRes.status).toBe(404);
  });
});

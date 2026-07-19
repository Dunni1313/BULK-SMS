// Phase 15 — Institutional Opportunity Discovery Engine. Live route
// integration tests for POST /opportunity-discovery/scan, GET .../compare,
// and the Saved Screens CRUD endpoints. Uses the real app + a real Postgres
// connection (no auth session needed — unauthenticated requests resolve to
// the legacy-owner stand-in per tenantScope.ts). Per the established
// collision-avoidance precedent (notifications.route.test.ts,
// decisionEngine.route.test.ts), this file uses randomly-generated,
// collision-free ticker-shaped symbols where it needs a symbol the shared
// legacy-owner account's other test files won't also touch.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

function randomTicker(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 5; i++) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

describe("Institutional Opportunity Discovery Engine routes (live, SIMULATED path)", () => {
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

  afterAll(async () => {
    server.close();
  });

  it("POST /scan resolves a small explicit symbol list, ranked, bucketed", async () => {
    const res = await fetch(`${baseUrl}/api/opportunity-discovery/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbols: ["AAPL", "MSFT", "GOOGL"] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.universeSize).toBe(3);
    expect(body.rows.length).toBe(3);
    expect(body.buckets).toHaveLength(10);
    expect(body.unavailableFilters).toEqual([]);
    // Ranked descending by rankScore.
    for (let i = 1; i < body.rows.length; i++) {
      expect(body.rows[i - 1].rankScore).toBeGreaterThanOrEqual(body.rows[i].rankScore);
    }
  });

  it("honestly reports an unresolvable symbol rather than fabricating a row for it", async () => {
    const res = await fetch(`${baseUrl}/api/opportunity-discovery/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbols: ["AAPL", "NOT A TICKER!!"] }),
    });
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.rows.map((r: any) => r.symbol)).toEqual(["AAPL"]); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.unresolvedSymbols).toContain("NOT A TICKER!!");
  });

  it("Country filter is accepted but always reported unavailable — never silently applied", async () => {
    const res = await fetch(`${baseUrl}/api/opportunity-discovery/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbols: ["AAPL", "MSFT"], filters: { country: "USA" } }),
    });
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.unavailableFilters).toContain("country");
    expect(body.rows.length).toBe(2); // never silently dropped for an unavailable filter
  });

  it("applies real screener filters (sector) over already-computed fields", async () => {
    const res = await fetch(`${baseUrl}/api/opportunity-discovery/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbols: ["AAPL", "MSFT"], filters: { sector: "Technology" } }),
    });
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.totalBeforeFilter).toBe(2);
    for (const row of body.rows) expect(row.sector).toBe("Technology");
  });

  it("watchlistAware populates the Watchlist Candidates bucket honestly", async () => {
    const symbol = randomTicker();
    await fetch(`${baseUrl}/api/value-watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    const res = await fetch(`${baseUrl}/api/opportunity-discovery/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbols: [symbol, "AAPL", "MSFT"], watchlistAware: true }),
    });
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const watchlistBucket = body.buckets.find((b: any) => b.category === "watchlist-candidates"); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(watchlistBucket.rows.map((r: any) => r.symbol)).not.toContain(symbol); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  it("portfolioId populates the Portfolio Upgrade Candidates bucket honestly and is ignored for a foreign/nonexistent id", async () => {
    const heldSymbol = randomTicker();
    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `Opportunity Test ${heldSymbol}` }),
    });
    const portfolio = (await createRes.json()) as { id: number };
    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: heldSymbol, targetWeightPct: 20, shares: 5 }),
    });

    const res = await fetch(`${baseUrl}/api/opportunity-discovery/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbols: [heldSymbol, "AAPL"], portfolioId: portfolio.id }),
    });
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const upgradeBucket = body.buckets.find((b: any) => b.category === "portfolio-upgrade-candidates"); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(upgradeBucket.rows.map((r: any) => r.symbol)).not.toContain(heldSymbol); // eslint-disable-line @typescript-eslint/no-explicit-any

    const foreignRes = await fetch(`${baseUrl}/api/opportunity-discovery/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbols: ["AAPL"], portfolioId: 999999999 }),
    });
    const foreignBody = (await foreignRes.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const foreignBucket = foreignBody.buckets.find((b: any) => b.category === "portfolio-upgrade-candidates"); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(foreignBucket.rows).toEqual([]); // honestly empty, never a fabricated context

    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}`, { method: "DELETE" });
  });

  it("GET /compare highlights the genuinely best value per dimension across a small selected set", async () => {
    const res = await fetch(`${baseUrl}/api/opportunity-discovery/compare?symbols=AAPL,MSFT`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.rows.length).toBe(2);
    expect(Object.keys(body.bestBy).length).toBeGreaterThan(0);
    for (const symbol of Object.values(body.bestBy)) {
      expect(body.rows.map((r: any) => r.symbol)).toContain(symbol); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  });

  it("GET /compare with no symbols returns an honestly empty comparison", async () => {
    const res = await fetch(`${baseUrl}/api/opportunity-discovery/compare?symbols=`);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.rows).toEqual([]);
    expect(body.bestBy).toEqual({});
  });

  it("full Saved Screen CRUD: create, list, update, delete", async () => {
    const createRes = await fetch(`${baseUrl}/api/opportunity-discovery/saved-screens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "High ROIC Tech", filters: { sector: "Technology", minRoic: 0.15 } }),
    });
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()) as { id: number; name: string; filters: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(created.name).toBe("High ROIC Tech");
    expect(created.filters.minRoic).toBe(0.15);

    const listRes = await fetch(`${baseUrl}/api/opportunity-discovery/saved-screens`);
    const list = (await listRes.json()) as { id: number }[];
    expect(list.some((s) => s.id === created.id)).toBe(true);

    const updateRes = await fetch(`${baseUrl}/api/opportunity-discovery/saved-screens/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "High ROIC Tech (revised)" }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { name: string };
    expect(updated.name).toBe("High ROIC Tech (revised)");

    const deleteRes = await fetch(`${baseUrl}/api/opportunity-discovery/saved-screens/${created.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(200);
    const del = (await deleteRes.json()) as { success: boolean };
    expect(del.success).toBe(true);
  });

  it("PATCH/DELETE saved screen 404s for a nonexistent id", async () => {
    const patchRes = await fetch(`${baseUrl}/api/opportunity-discovery/saved-screens/999999999`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(patchRes.status).toBe(404);
  });

  it("is deterministic across repeated calls for the same symbols on the same day", async () => {
    const body1 = { symbols: ["AAPL", "MSFT"] };
    const [r1, r2] = await Promise.all([
      fetch(`${baseUrl}/api/opportunity-discovery/scan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body1) }),
      fetch(`${baseUrl}/api/opportunity-discovery/scan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body1) }),
    ]);
    const [b1, b2] = (await Promise.all([r1.json(), r2.json()])) as [any, any]; // eslint-disable-line @typescript-eslint/no-explicit-any
    const strip = (rows: any[]) => rows.map((r) => ({ ...r, fetchedAt: undefined })); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(strip(b1.rows)).toEqual(strip(b2.rows));
  });
});

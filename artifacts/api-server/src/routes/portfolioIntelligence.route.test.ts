// Phase 13 — Institutional Portfolio Manager. Live route integration tests
// for the new /intelligence, /watchlist-comparison, /snapshots, and /notes
// endpoints on the existing Portfolio Construction route file. Uses the real
// app + a real Postgres connection (no auth session needed — unauthenticated
// requests resolve to the legacy-owner stand-in per tenantScope.ts). Per the
// established collision-avoidance precedent (notifications.route.test.ts,
// optionsBacktest.route.test.ts), this file uses randomly-generated,
// collision-free ticker-shaped symbols since it shares the legacy-owner
// account's tables with every other route test file running in this suite.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

function randomTicker(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 5; i++) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

interface PortfolioSummary {
  id: number;
  name: string;
}

interface Holding {
  id: number;
  symbol: string;
}

describe("Portfolio Intelligence routes (live, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;
  let portfolioId: number;
  const symbolA = randomTicker();
  const symbolB = randomTicker();

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `Intelligence Test ${symbolA}` }),
    });
    const portfolio = (await createRes.json()) as PortfolioSummary;
    portfolioId = portfolio.id;

    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: symbolA, targetWeightPct: 60, shares: 10, avgCostBasis: 50 }),
    });
    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: symbolB, targetWeightPct: 40, shares: 5 }),
    });
  });

  afterAll(async () => {
    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}`, { method: "DELETE" });
    server.close();
  });

  it("GET /intelligence returns a fully-shaped analysis with real avgCostBasis-driven performance", async () => {
    const res = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/intelligence`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.holdings).toHaveLength(2);
    expect(body.qualityScore).toBeDefined();
    expect(body.allocation.byCountry.available).toBe(false);
    expect(body.allocation.byCurrency.available).toBe(false);
    const a = body.holdings.find((h: { symbol: string }) => h.symbol === symbolA);
    expect(a.avgCostBasis).toBe(50);
    expect(a.costBasisValue).toBe(500);
    expect(a.marketValue).not.toBeNull();
    expect(a.unrealizedPnl).not.toBeNull();
    expect(body.risk.overall).toBeDefined();
    expect(body.risk.concentration).toBeDefined();
    expect(body.risk.qualityDrift.score).toBeNull(); // no prior snapshot yet
  });

  it("404s for a nonexistent portfolio", async () => {
    const res = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/999999999/intelligence`);
    expect(res.status).toBe(404);
  });

  it("GET /watchlist-comparison honestly classifies overlap between the watchlist and this portfolio", async () => {
    const addWatch = await fetch(`${baseUrl}/api/stock-analyst/value-watchlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: symbolA }),
    });
    const watchlistRow = (await addWatch.json()) as { id: number };

    const res = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/watchlist-comparison`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.inBoth).toContain(symbolA);
    expect(body.onlyInPortfolio).toContain(symbolB);
    expect(body.onlyInWatchlist).not.toContain(symbolA);

    await fetch(`${baseUrl}/api/stock-analyst/value-watchlist/${watchlistRow.id}`, { method: "DELETE" });
  });

  it("POST /snapshots saves a composite snapshot, and GET /snapshots lists it newest-first", async () => {
    const saveRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/snapshots`, {
      method: "POST",
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(saved.portfolioId).toBe(portfolioId);
    expect(saved.holdingsCount).toBe(2);
    expect(saved.analysis).toBeDefined();

    const listRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/snapshots`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { id: number }[];
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].id).toBe(saved.id);

    // A second /intelligence call now honestly reports a real (zero, since
    // nothing changed) quality drift instead of "insufficient data".
    const intelRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/intelligence`);
    const intel = (await intelRes.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(intel.risk.qualityDrift.score).not.toBeNull();
  });

  it("full note CRUD: create, list, update, delete", async () => {
    const addRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "Watching for a pullback before adding more." }),
    });
    expect(addRes.status).toBe(200);
    const note = (await addRes.json()) as { id: number; note: string };
    expect(note.note).toBe("Watching for a pullback before adding more.");

    const listRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/notes`);
    const list = (await listRes.json()) as { id: number }[];
    expect(list.some((n) => n.id === note.id)).toBe(true);

    const updateRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/notes/${note.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "Updated thesis note." }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { note: string };
    expect(updated.note).toBe("Updated thesis note.");

    const deleteRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/notes/${note.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
    expect((await deleteRes.json()) as { success: boolean }).toEqual({ success: true });

    const patchNonexistent = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/notes/999999999`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "nope" }),
    });
    expect(patchNonexistent.status).toBe(404);
  });

  it("holdings created/updated with avgCostBasis round-trip correctly through the CRUD routes", async () => {
    const addRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: randomTicker(), targetWeightPct: 0, shares: 1, avgCostBasis: 42.5 }),
    });
    const holding = (await addRes.json()) as Holding & { avgCostBasis: number | null };
    expect(holding.avgCostBasis).toBe(42.5);

    const patchRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/holdings/${holding.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avgCostBasis: 55 }),
    });
    const patched = (await patchRes.json()) as { avgCostBasis: number | null };
    expect(patched.avgCostBasis).toBe(55);

    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/holdings/${holding.id}`, { method: "DELETE" });
  });
});

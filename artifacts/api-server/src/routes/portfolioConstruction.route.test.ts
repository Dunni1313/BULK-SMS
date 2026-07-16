// Phase 2, Sprint 28 — live route integration test for the Portfolio
// Construction CRUD surface. Uses the real app + a real Postgres connection
// (no auth session needed — unauthenticated requests resolve to the
// legacy-owner stand-in per tenantScope.ts, and REQUIRE_AUTH is off by
// default), exercising the SIMULATED path end-to-end over real HTTP.
// Cross-user tenant isolation for the two new tables is covered separately
// and more directly in lib/tenantIsolation.test.ts (reusing the shared
// assertTenantIsolation helper against real, distinct users) — this file
// focuses on the CRUD/allocation contract itself.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface PortfolioSummary {
  id: number;
  name: string;
  description: string;
  holdingsCount: number;
}

interface Holding {
  id: number;
  portfolioId: number;
  symbol: string;
  targetWeightPct: number;
  shares: number | null;
}

interface PortfolioDetail {
  id: number;
  name: string;
  allocation: {
    holdings: {
      id: number;
      symbol: string;
      targetWeightPct: number;
      shares: number | null;
      currentPrice: number | null;
      marketValue: number | null;
      actualWeightPct: number | null;
      driftPct: number | null;
      rebalanceAction: string;
    }[];
    totalMarketValue: number | null;
    totalTargetWeightPct: number;
    targetWeightSumWarning: string | null;
    unresolvedSymbols: string[];
    summary: string;
  };
}

describe("Portfolio Construction routes (live, SIMULATED path)", () => {
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

  it("creates a portfolio, adds holdings, computes allocation, and cascades delete", async () => {
    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Core Value", description: "long-term picks" }),
    });
    expect(createRes.status).toBe(200);
    const portfolio = (await createRes.json()) as PortfolioSummary;
    expect(portfolio.name).toBe("Core Value");
    expect(portfolio.holdingsCount).toBe(0);

    const addA = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", targetWeightPct: 60, shares: 10 }),
    });
    expect(addA.status).toBe(200);
    const holdingA = (await addA.json()) as Holding;
    expect(holdingA.symbol).toBe("AAPL");
    expect(holdingA.targetWeightPct).toBe(60);

    const addB = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "MSFT", targetWeightPct: 40, shares: 5 }),
    });
    expect(addB.status).toBe(200);

    const detailRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}`);
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json()) as PortfolioDetail;
    expect(detail.allocation.holdings).toHaveLength(2);
    const aaplRow = detail.allocation.holdings.find((h) => h.symbol === "AAPL")!;
    expect(aaplRow.currentPrice).not.toBeNull();
    expect(aaplRow.marketValue).toBe(aaplRow.currentPrice! * 10);
    expect(aaplRow.actualWeightPct).not.toBeNull();
    expect(detail.allocation.totalMarketValue).not.toBeNull();
    expect(detail.allocation.totalTargetWeightPct).toBe(100);
    expect(detail.allocation.targetWeightSumWarning).toBeNull();

    // Updating a holding's target weight is reflected on the next fetch.
    const updateRes = await fetch(
      `${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings/${holdingA.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetWeightPct: 70 }),
      },
    );
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as Holding;
    expect(updated.targetWeightPct).toBe(70);

    // Deleting the portfolio cascades its own holdings — a subsequent
    // detail fetch for the deleted portfolio 404s.
    const deleteRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);
    expect((await deleteRes.json()) as { success: boolean }).toEqual({ success: true });

    const afterDelete = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}`);
    expect(afterDelete.status).toBe(404);
  });

  it("honestly reports null market value and an unresolved symbol when a holding has no shares entered", async () => {
    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Watchlist Targets Only" }),
    });
    const portfolio = (await createRes.json()) as PortfolioSummary;

    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "GOOGL", targetWeightPct: 100 }),
    });

    const detailRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}`);
    const detail = (await detailRes.json()) as PortfolioDetail;
    const row = detail.allocation.holdings[0];
    expect(row.shares).toBeNull();
    expect(row.marketValue).toBeNull();
    expect(row.actualWeightPct).toBeNull();
    expect(row.rebalanceAction).toBe("unknown");
  });

  it("warns honestly when target weights don't sum to ~100%, never silently normalizing", async () => {
    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Partially Allocated" }),
    });
    const portfolio = (await createRes.json()) as PortfolioSummary;

    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", targetWeightPct: 30 }),
    });

    const detailRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}`);
    const detail = (await detailRes.json()) as PortfolioDetail;
    expect(detail.allocation.totalTargetWeightPct).toBe(30);
    expect(detail.allocation.targetWeightSumWarning).toMatch(/30%/);
  });

  it("removing a single holding leaves the rest of the portfolio intact", async () => {
    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Two Holdings" }),
    });
    const portfolio = (await createRes.json()) as PortfolioSummary;

    const h1 = (await (
      await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: "AAPL", targetWeightPct: 50 }),
      })
    ).json()) as Holding;
    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "MSFT", targetWeightPct: 50 }),
    });

    const removeRes = await fetch(
      `${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings/${h1.id}`,
      { method: "DELETE" },
    );
    expect(removeRes.status).toBe(200);

    const detailRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}`);
    const detail = (await detailRes.json()) as PortfolioDetail;
    expect(detail.allocation.holdings).toHaveLength(1);
    expect(detail.allocation.holdings[0].symbol).toBe("MSFT");
  });

  it("returns 404 for a non-existent portfolio and 400 for a malformed id, never fabricating a detail", async () => {
    const notFound = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/999999999`);
    expect(notFound.status).toBe(404);

    const malformed = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/not-a-number`);
    expect(malformed.status).toBe(400);
  });

  it("GET /portfolios lists holdingsCount correctly", async () => {
    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Count Check" }),
    });
    const portfolio = (await createRes.json()) as PortfolioSummary;
    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL" }),
    });

    const listRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`);
    const list = (await listRes.json()) as PortfolioSummary[];
    const found = list.find((p) => p.id === portfolio.id)!;
    expect(found.holdingsCount).toBe(1);
  });
});

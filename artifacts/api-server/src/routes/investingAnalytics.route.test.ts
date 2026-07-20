// Phase 33 — Institutional Executive Intelligence & Reporting Hub. Live
// route integration tests for GET /investing/analytics against a real app +
// real Postgres connection (no auth session needed — unauthenticated
// requests resolve to the legacy-owner stand-in per tenantScope.ts,
// matching every other route test in this codebase). Every created row is
// deleted at the end of its own test to avoid polluting the shared
// legacy-owner account for sibling test files, mirroring
// routes/tradingAnalytics.route.test.ts's own established pattern.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

interface DashboardBody {
  overview: {
    portfoliosCreated: number;
    holdingsTracked: number;
    researchNotesWritten: number;
    watchlistItems: number;
    committeeSnapshotsSaved: number;
    riskSnapshotsSaved: number;
    optimisationReviewsSaved: number;
    savedScreens: number;
    generatedAt: string;
  };
  portfolio: { portfolioCount: number; totalHoldings: number; distinctSymbolsHeld: number };
  research: { noteCount: number; distinctSymbolsResearched: number };
  watchlist: { itemCount: number; categoryTally: Record<string, number> };
  committee: { snapshotCount: number; mostRecentSymbol: string | null };
  risk: { snapshotCount: number; mostRecentOverallScore: number | null };
  optimisation: { reviewCount: number; mostRecentAction: string | null };
  coach: { totalCoachViews: number; byType: { coach: string; viewCount: number }[]; mostRecentCoach: string | null };
}

interface PortfolioResponse {
  id: number;
}

describe("Institutional Investing Analytics Engine routes (live, real Postgres)", () => {
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

  async function post(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  async function get(path: string): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`);
  }
  async function del(path: string): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`, { method: "DELETE" });
  }

  it("returns a well-shaped dashboard even for a shared account with no dedicated fixtures created yet", async () => {
    const res = await get("/investing/analytics");
    expect(res.status).toBe(200);
    const body = (await res.json()) as DashboardBody;
    expect(typeof body.overview.portfoliosCreated).toBe("number");
    expect(typeof body.overview.generatedAt).toBe("string");
    expect(body.coach.byType).toHaveLength(8);
  });

  it("reflects a newly created portfolio in overview and portfolio analytics", async () => {
    const before = (await (await get("/investing/analytics")).json()) as DashboardBody;

    const portfolioRes = await post("/portfolio-construction/portfolios", { name: `Analytics Portfolio ${randomUUID()}` });
    expect(portfolioRes.status).toBe(200);
    const portfolio = (await portfolioRes.json()) as PortfolioResponse;

    const after = (await (await get("/investing/analytics")).json()) as DashboardBody;
    expect(after.overview.portfoliosCreated).toBe(before.overview.portfoliosCreated + 1);
    expect(after.portfolio.portfolioCount).toBe(before.portfolio.portfolioCount + 1);

    await del(`/portfolio-construction/portfolios/${portfolio.id}`);
  });

  it("reflects a newly created research note in overview and research analytics", async () => {
    const before = (await (await get("/investing/analytics")).json()) as DashboardBody;
    const symbol = `ANLT${randomUUID().slice(0, 4).toUpperCase()}`;

    const noteRes = await post("/stock-analyst/research-notes", { symbol, note: "A real research note for analytics testing." });
    expect(noteRes.status).toBe(200);
    const note = (await noteRes.json()) as { id: number };

    const after = (await (await get("/investing/analytics")).json()) as DashboardBody;
    expect(after.overview.researchNotesWritten).toBe(before.overview.researchNotesWritten + 1);
    expect(after.research.distinctSymbolsResearched).toBe(before.research.distinctSymbolsResearched + 1);

    await del(`/stock-analyst/research-notes/${note.id}`);
  });

  it("reflects a newly created watchlist item in overview and watchlist analytics", async () => {
    const before = (await (await get("/investing/analytics")).json()) as DashboardBody;
    const symbol = `ANLT${randomUUID().slice(0, 4).toUpperCase()}`;

    const wlRes = await post("/stock-analyst/value-watchlist", { symbol, category: "Researching", reason: "Analytics test." });
    expect(wlRes.status).toBe(200);
    const item = (await wlRes.json()) as { id: number };

    const after = (await (await get("/investing/analytics")).json()) as DashboardBody;
    expect(after.overview.watchlistItems).toBe(before.overview.watchlistItems + 1);
    expect(after.watchlist.categoryTally.Researching).toBe((before.watchlist.categoryTally.Researching ?? 0) + 1);

    await del(`/stock-analyst/value-watchlist/${item.id}`);
  });

  it("reflects a real Institutional AI Coach view in coach analytics, never counting a Trading Engine coach row", async () => {
    const before = (await (await get("/investing/analytics")).json()) as DashboardBody;

    // Mirrors the exact real learning_progress row components/coach/CoachDrawer.tsx
    // writes on a "mark as viewed" action — itemType="coach", itemKey="<coach>:<symbol>".
    const viewRes = await post("/learning-centre/progress/view", { itemType: "coach", itemKey: `valuation:${randomUUID()}` });
    expect(viewRes.status).toBe(200);

    const after = (await (await get("/investing/analytics")).json()) as DashboardBody;
    expect(after.coach.totalCoachViews).toBe(before.coach.totalCoachViews + 1);
    expect(after.coach.mostRecentCoach).toBe("valuation");
    const valuationRow = after.coach.byType.find((r) => r.coach === "valuation")!;
    expect(valuationRow.viewCount).toBe((before.coach.byType.find((r) => r.coach === "valuation")?.viewCount ?? 0) + 1);
  });

  it("never fabricates a signal/score/prediction field anywhere in the live response", async () => {
    const res = await get("/investing/analytics");
    const body = await res.json();
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"tradingsignal"|"forecast"/);
  });
});

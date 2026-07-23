// Phase 34 — Cross-Engine Orchestration & Unified Workspace. Live route
// integration tests for GET /workspace/overview and GET /workspace/search
// against a real app + real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts, matching every other route test in this codebase).
// Every fixture uses a randomly-generated, collision-free symbol/name so
// this file never collides with any sibling test file sharing the same
// legacy-owner account, and every created row is deleted in its own test
// (or an afterAll block) to avoid polluting that shared account.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

interface OverviewBody {
  intelligence: { overview: { generatedAt: string } };
  recentActivity: { type: string; engine: string; label: string; detail: string; occurredAt: string; symbol: string | null; linkPath: string | null }[];
  recentItems: { category: string; label: string; detail: string; occurredAt: string; linkPath: string }[];
  tasks: { code: string; label: string; count: number; linkPath: string }[];
  generatedAt: string;
}

interface SearchBody {
  query: string;
  results: { category: string; id: string; label: string; detail: string; occurredAt: string | null; linkPath: string }[];
  totalMatches: number;
}

describe("Cross-Engine Orchestration & Unified Workspace routes (live, real Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  const cleanupPlanIds: number[] = [];
  const cleanupStrategyIds: number[] = [];
  const cleanupPortfolioIds: number[] = [];

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
    for (const id of cleanupPlanIds) await del(`/trading/trade-plans/${id}`);
    for (const id of cleanupStrategyIds) await del(`/trading/strategies/${id}`);
    for (const id of cleanupPortfolioIds) await del(`/portfolio-construction/portfolios/${id}`);
    server.close();
  });

  it("GET /workspace/overview returns a well-shaped payload with all 4 sections even for a shared account", async () => {
    const res = await get("/workspace/overview");
    expect(res.status).toBe(200);
    const body = (await res.json()) as OverviewBody;
    expect(typeof body.intelligence.overview.generatedAt).toBe("string");
    expect(Array.isArray(body.recentActivity)).toBe(true);
    expect(Array.isArray(body.recentItems)).toBe(true);
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(typeof body.generatedAt).toBe("string");
  });

  it("a newly created Trade Plan appears in the extended Recent Activity timeline as trade-plan-created", async () => {
    const symbol = `WKSP${randomUUID().slice(0, 4).toUpperCase()}`;
    const planRes = await post("/trading/trade-plans", {
      symbol,
      direction: "long",
      thesis: "Cross-Engine Workspace timeline test.",
      accountRiskPct: 1,
      entryPrice: 100,
      stopPrice: 95,
      targetPrice: 115,
    });
    expect(planRes.status).toBe(201);
    const plan = (await planRes.json()) as { id: number };
    cleanupPlanIds.push(plan.id);

    const body = (await (await get("/workspace/overview")).json()) as OverviewBody;
    const match = body.recentActivity.find((a) => a.type === "trade-plan-created" && a.symbol === symbol);
    expect(match).toBeTruthy();
    expect(match?.detail).toBe(`${symbol} (long)`);
    expect(match?.linkPath).toContain(symbol);

    // Also confirmed via the Cross-Engine Recent Items view.
    const recentItem = body.recentItems.find((i) => i.category === "trade-plan" && i.label === symbol);
    expect(recentItem).toBeTruthy();
  });

  it("a newly registered Strategy appears in the extended Recent Activity timeline as strategy-registered", async () => {
    const name = `Workspace Strategy ${randomUUID().slice(0, 8)}`;
    const stratRes = await post("/trading/strategies", {
      name,
      description: "A strategy created for the Cross-Engine Workspace timeline test.",
      category: "trend",
      timeframes: ["1h", "1D"],
      markets: ["equities"],
      requiredEvidence: ["structure"],
      checklist: [{ id: "c1", label: "Confirm trend direction", required: true }],
      references: [],
    });
    expect(stratRes.status).toBe(201);
    const strat = (await stratRes.json()) as { id: number };
    cleanupStrategyIds.push(strat.id);

    const body = (await (await get("/workspace/overview")).json()) as OverviewBody;
    const match = body.recentActivity.find((a) => a.type === "strategy-registered" && a.detail.startsWith(name));
    expect(match).toBeTruthy();
    expect(match?.symbol).toBeNull();
  });

  it("surfaces the portfolios-without-holdings task for a freshly created empty portfolio", async () => {
    const name = `Workspace Empty Portfolio ${randomUUID().slice(0, 8)}`;
    const pRes = await post("/portfolio-construction/portfolios", { name });
    expect(pRes.status).toBe(200);
    const portfolio = (await pRes.json()) as { id: number };
    cleanupPortfolioIds.push(portfolio.id);

    const body = (await (await get("/workspace/overview")).json()) as OverviewBody;
    const task = body.tasks.find((t) => t.code === "portfolios-without-holdings");
    expect(task).toBeTruthy();
    expect(task!.count).toBeGreaterThan(0);

    const recentItem = body.recentItems.find((i) => i.category === "portfolio" && i.label === name);
    expect(recentItem).toBeTruthy();
  });

  it("GET /workspace/search returns no results for an empty query", async () => {
    const res = await get("/workspace/search?q=");
    expect(res.status).toBe(200);
    const body = (await res.json()) as SearchBody;
    expect(body.results).toEqual([]);
    expect(body.totalMatches).toBe(0);
  });

  it("GET /workspace/search finds a newly created Trade Plan by symbol substring, case-insensitively", async () => {
    const symbol = `SRCH${randomUUID().slice(0, 4).toUpperCase()}`;
    const planRes = await post("/trading/trade-plans", {
      symbol,
      direction: "short",
      thesis: "Cross-Engine Workspace search test.",
      accountRiskPct: 1,
      entryPrice: 300,
      stopPrice: 310,
      targetPrice: 270,
    });
    expect(planRes.status).toBe(201);
    const plan = (await planRes.json()) as { id: number };
    cleanupPlanIds.push(plan.id);

    const res = await get(`/workspace/search?q=${symbol.toLowerCase()}`);
    const body = (await res.json()) as SearchBody;
    const match = body.results.find((r) => r.category === "trade-plan" && r.label.includes(symbol));
    expect(match).toBeTruthy();
    expect(match?.linkPath).toContain(symbol);
  });

  it("GET /workspace/search never fabricates a match for a substring that isn't present", async () => {
    const res = await get(`/workspace/search?q=zzz-genuinely-not-present-${randomUUID()}`);
    const body = (await res.json()) as SearchBody;
    expect(body.results).toEqual([]);
    expect(body.totalMatches).toBe(0);
  });

  it("GET /workspace/search finds a Learning Topic by title with an honestly null occurredAt", async () => {
    const res = await get("/workspace/search?q=stocks");
    const body = (await res.json()) as SearchBody;
    const topic = body.results.find((r) => r.category === "learning-topic");
    expect(topic).toBeTruthy();
    expect(topic?.occurredAt).toBeNull();
  });

  it("never fabricates a signal/score/prediction field anywhere in either live response", async () => {
    const [overviewRes, searchRes] = await Promise.all([get("/workspace/overview"), get("/workspace/search?q=a")]);
    const overviewSerialized = JSON.stringify(await overviewRes.json()).toLowerCase();
    const searchSerialized = JSON.stringify(await searchRes.json()).toLowerCase();
    expect(overviewSerialized).not.toMatch(/"probability"|"prediction"|"tradingsignal"|"forecast"/);
    expect(searchSerialized).not.toMatch(/"probability"|"prediction"|"tradingsignal"|"forecast"/);
  });
});

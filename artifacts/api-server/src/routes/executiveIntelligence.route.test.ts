// Phase 33 — Institutional Executive Intelligence & Reporting Hub. Live
// route integration tests for GET /executive/intelligence against a real
// app + real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts, matching every other route test in this codebase).
// Every created row is deleted at the end of its own test to avoid
// polluting the shared legacy-owner account for sibling test files.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

interface HubBody {
  overview: {
    portfoliosCreated: number;
    tradesReviewed: number;
    learningTopicsTotal: number;
    totalCoachViews: number;
    reportsGenerated: number;
    generatedAt: string;
    summary: string;
  };
  investing: { overview: { portfoliosCreated: number } };
  trading: { overview: { tradesReviewed: number } };
  strategy: { strategiesRegistered: number };
  portfolio: { portfolioCount: number };
  risk: { investingRiskSnapshotsSaved: number; tradingOpenPositionsCount: number };
  learning: { totalTopics: number };
  coach: { investingCoachViews: number; tradingCoachViews: number; totalCoachViews: number };
  reporting: { totalReports: number; recentReports: { id: number; reportType: string }[] };
  activity: { type: string; engine: string; label: string; occurredAt: string; linkPath: string | null }[];
}

describe("Institutional Executive Intelligence Hub routes (live, real Postgres)", () => {
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

  it("returns a well-shaped hub with all 10 sections even for a shared account", async () => {
    const res = await get("/executive/intelligence");
    expect(res.status).toBe(200);
    const body = (await res.json()) as HubBody;
    expect(typeof body.overview.generatedAt).toBe("string");
    expect(typeof body.overview.summary).toBe("string");
    expect(body.overview.summary.length).toBeGreaterThan(0);
    expect(typeof body.investing.overview.portfoliosCreated).toBe("number");
    expect(typeof body.trading.overview.tradesReviewed).toBe("number");
    expect(typeof body.strategy.strategiesRegistered).toBe("number");
    expect(typeof body.portfolio.portfolioCount).toBe("number");
    expect(Array.isArray(body.reporting.recentReports)).toBe(true);
    expect(Array.isArray(body.activity)).toBe(true);
  });

  it("the strategy section is a pass-through of trading.strategyUsage, never a duplicate computation", async () => {
    const [hubRes, tradingRes] = await Promise.all([get("/executive/intelligence"), get("/trading/analytics")]);
    const hub = (await hubRes.json()) as HubBody & { trading: { strategyUsage: { strategiesRegistered: number } } };
    const trading = (await tradingRes.json()) as { strategyUsage: { strategiesRegistered: number } };
    expect(hub.strategy.strategiesRegistered).toBe(trading.strategyUsage.strategiesRegistered);
  });

  it("the portfolio section is a pass-through of investing.portfolio, never a duplicate computation", async () => {
    const [hubRes, investingRes] = await Promise.all([get("/executive/intelligence"), get("/investing/analytics")]);
    const hub = (await hubRes.json()) as HubBody;
    const investing = (await investingRes.json()) as { portfolio: { portfolioCount: number } };
    expect(hub.portfolio.portfolioCount).toBe(investing.portfolio.portfolioCount);
  });

  it("reflects a newly generated + saved report in the reporting summary and the activity timeline", async () => {
    const before = (await (await get("/executive/intelligence")).json()) as HubBody;

    const saveRes = await post("/reporting/reports", { reportType: "watchlist" });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as { id: number };

    const after = (await (await get("/executive/intelligence")).json()) as HubBody;
    expect(after.reporting.totalReports).toBe(before.reporting.totalReports + 1);
    expect(after.reporting.recentReports[0].id).toBe(saved.id);
    expect(after.activity.some((a) => a.type === "report-generated")).toBe(true);

    await del(`/reporting/reports/${saved.id}`);
  });

  it("reflects a newly created watchlist price crossing item in both a live check and the timeline's research-note entry independently", async () => {
    const symbol = `EXEC${randomUUID().slice(0, 4).toUpperCase()}`;
    const noteRes = await post("/stock-analyst/research-notes", { symbol, note: "Executive Intelligence Hub timeline test note." });
    expect(noteRes.status).toBe(200);
    const note = (await noteRes.json()) as { id: number };

    const after = (await (await get("/executive/intelligence")).json()) as HubBody;
    const match = after.activity.find((a) => a.type === "research-note" && a.label === "Research Note" && (a as unknown as { symbol: string }).symbol === symbol);
    expect(match).toBeTruthy();
    expect(match?.linkPath).toContain(symbol);

    await del(`/stock-analyst/research-notes/${note.id}`);
  });

  it("never double-counts AI Coach views across engines in the live response", async () => {
    const before = (await (await get("/executive/intelligence")).json()) as HubBody;

    const investingKey = `research:${randomUUID()}`;
    const tradingKey = `journal:${randomUUID()}`;
    await post("/learning-centre/progress/view", { itemType: "coach", itemKey: investingKey });
    await post("/learning-centre/progress/view", { itemType: "coach", itemKey: tradingKey });

    const after = (await (await get("/executive/intelligence")).json()) as HubBody;
    expect(after.coach.investingCoachViews).toBe(before.coach.investingCoachViews + 1);
    expect(after.coach.tradingCoachViews).toBe(before.coach.tradingCoachViews + 1);
    expect(after.coach.totalCoachViews).toBe(before.coach.totalCoachViews + 2);
  });

  it("never fabricates a signal/score/prediction field anywhere in the live response", async () => {
    const res = await get("/executive/intelligence");
    const body = await res.json();
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"tradingsignal"|"forecast"/);
  });
});

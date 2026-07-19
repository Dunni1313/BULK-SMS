// Phase 19 — Institutional Investment Committee Workbench. Live route
// integration tests for GET /stock-analyst/investment-memo/:symbol and
// GET /stock-analyst/decision/snapshots/recent. Uses the real app + a real
// Postgres connection (no auth session needed — unauthenticated requests
// resolve to the legacy-owner stand-in per tenantScope.ts). Per the
// established collision-avoidance precedent (notifications.route.test.ts,
// decisionEngine.route.test.ts), this file uses randomly-generated,
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

const HEADINGS = [
  "Business Summary",
  "Business Quality",
  "Competitive Advantage",
  "Financial Strength",
  "Valuation Summary",
  "Margin of Safety",
  "Decision Engine",
  "Investment Committee Verdict",
  "Portfolio Impact",
  "Risk Summary",
  "Catalysts",
  "Research Notes",
  "Monitoring Summary",
  "Conclusion",
];

describe("Institutional Investment Committee Workbench routes (live, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;
  const symbol = randomTicker();

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

  it("GET /investment-memo/:symbol returns all 14 required sections, reusing the Decision Engine's own recommendation", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/investment-memo/${symbol}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.symbol).toBe(symbol);
    expect(["Buy", "Accumulate", "Hold", "Reduce", "Sell", "Avoid"]).toContain(body.recommendation);
    expect(body.sections.map((s: any) => s.heading)).toEqual(HEADINGS); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.disclaimer).toContain("Educational value-investing research only");
    expect(body.overview).toContain("No LLM narration, no new scoring, no price prediction.");

    // Cross-check against the live Decision Engine route — never a
    // second, independently-computed recommendation.
    const decisionRes = await fetch(`${baseUrl}/api/stock-analyst/decision/${symbol}`);
    const decision = (await decisionRes.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.recommendation).toBe(decision.recommendation);
    expect(body.confidence).toBe(decision.confidence);
  });

  it("404s for an invalid ticker shape", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/investment-memo/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
  });

  it("is deterministic across repeated calls for the same symbol on the same day", async () => {
    const [r1, r2] = await Promise.all([
      fetch(`${baseUrl}/api/stock-analyst/investment-memo/${symbol}`),
      fetch(`${baseUrl}/api/stock-analyst/investment-memo/${symbol}`),
    ]);
    const [b1, b2] = (await Promise.all([r1.json(), r2.json()])) as [any, any]; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(b1.recommendation).toBe(b2.recommendation);
    expect(b1.sections).toEqual(b2.sections);
  });

  it("Research Notes section reflects a real, already-saved research note for this symbol — never fabricated", async () => {
    const before = (await (await fetch(`${baseUrl}/api/stock-analyst/investment-memo/${symbol}`)).json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const beforeSection = before.sections.find((s: any) => s.heading === "Research Notes"); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(beforeSection.paragraphs[0]).toBe("No research notes recorded for this symbol yet.");

    await fetch(`${baseUrl}/api/stock-analyst/research-notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, note: "Watching this one for the next earnings call." }),
    });

    const after = (await (await fetch(`${baseUrl}/api/stock-analyst/investment-memo/${symbol}`)).json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const afterSection = after.sections.find((s: any) => s.heading === "Research Notes"); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(afterSection.paragraphs.join(" ")).toContain("Watching this one for the next earnings call.");
  });

  it("?portfolioId= supplies real Portfolio Impact context, reusing the same helper the Decision Engine route uses", async () => {
    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `Memo Test ${symbol}` }),
    });
    const portfolio = (await createRes.json()) as { id: number };
    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, targetWeightPct: 25, shares: 10 }),
    });

    const res = await fetch(`${baseUrl}/api/stock-analyst/investment-memo/${symbol}?portfolioId=${portfolio.id}`);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const section = body.sections.find((s: any) => s.heading === "Portfolio Impact"); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(section.paragraphs[0]).toContain("Already held");

    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}`, { method: "DELETE" });
  });

  it("GET /decision/snapshots/recent lists a just-saved snapshot for this symbol, newest first", async () => {
    await fetch(`${baseUrl}/api/stock-analyst/decision/${symbol}/snapshots`, { method: "POST" });

    const res = await fetch(`${baseUrl}/api/stock-analyst/decision/snapshots/recent`);
    expect(res.status).toBe(200);
    const list = (await res.json()) as { id: number; symbol: string; createdAt: string }[];
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.length).toBeLessThanOrEqual(20);
    expect(list.some((s) => s.symbol === symbol)).toBe(true);
    // Newest first: every entry's createdAt is >= the next one's.
    for (let i = 0; i < list.length - 1; i++) {
      expect(new Date(list[i].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(list[i + 1].createdAt).getTime());
    }
  });
});

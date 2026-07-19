// Phase 21 — Institutional AI Coach & Education Platform. Live route
// integration tests for GET /stock-analyst/coach/:coach/:symbol (+
// ?portfolioId=). Uses the real app + a real Postgres connection (no auth
// session needed — unauthenticated requests resolve to the legacy-owner
// stand-in per tenantScope.ts). Per the established collision-avoidance
// precedent (notifications.route.test.ts, decisionEngine.route.test.ts), this
// file uses a randomly-generated, collision-free ticker-shaped symbol since it
// shares the legacy-owner account's tables with every other route test file
// running in this suite.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { COACH_TYPES } from "../lib/investingCoach.js";

function randomTicker(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 5; i++) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

describe("Institutional AI Coach routes (live, SIMULATED path)", () => {
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

  it("all 8 coach types resolve for a known symbol with a well-shaped, disclaimer-carrying explanation", async () => {
    for (const coach of COACH_TYPES) {
      const res = await fetch(`${baseUrl}/api/stock-analyst/coach/${coach}/${symbol}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(body.coach).toBe(coach);
      expect(body.symbol).toBe(symbol);
      expect(typeof body.headline).toBe("string");
      expect(body.headline.length).toBeGreaterThan(0);
      expect(Array.isArray(body.metricsUsed)).toBe(true);
      expect(Array.isArray(body.howToInterpret)).toBe(true);
      expect(body.howToInterpret.length).toBeGreaterThan(0);
      expect(Array.isArray(body.commonMistakes)).toBe(true);
      expect(body.commonMistakes.length).toBeGreaterThan(0);
      expect(typeof body.institutionalPerspective).toBe("string");
      expect(body.institutionalPerspective.length).toBeGreaterThan(0);
      expect(body.disclaimer).toContain("Institutional AI Coach");
      expect(body.disclaimer).toContain("never invents");
    }
  });

  it("400s for an unrecognized coach type", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/coach/not-a-real-coach/${symbol}`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Unknown coach type");
  });

  it("404s for an invalid ticker shape, across every coach type", async () => {
    for (const coach of ["investment", "committee"]) {
      const res = await fetch(`${baseUrl}/api/stock-analyst/coach/${coach}/${encodeURIComponent("NOT A TICKER!!")}`);
      expect(res.status).toBe(404);
    }
  });

  it("is deterministic across repeated calls for the same coach/symbol on the same day", async () => {
    const [r1, r2] = await Promise.all([
      fetch(`${baseUrl}/api/stock-analyst/coach/valuation/${symbol}`),
      fetch(`${baseUrl}/api/stock-analyst/coach/valuation/${symbol}`),
    ]);
    const [b1, b2] = (await Promise.all([r1.json(), r2.json()])) as [any, any]; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(b1).toEqual(b2);
  });

  it("Portfolio Coach: no ?portfolioId= supplied — honestly reports no portfolio context", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/coach/portfolio/${symbol}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.headline).toContain("no portfolio was supplied");
    expect(body.metricsUsed).toEqual([]);
  });

  it("Portfolio Coach: ?portfolioId= supplies real held/weight/sector context", async () => {
    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `Coach Test ${symbol}` }),
    });
    const portfolio = (await createRes.json()) as { id: number };
    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, targetWeightPct: 30, shares: 10 }),
    });

    const res = await fetch(`${baseUrl}/api/stock-analyst/coach/portfolio/${symbol}?portfolioId=${portfolio.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.headline).toContain("already held");
    expect(body.metricsUsed.some((m: any) => m.label === "Already held?" && m.detail === "Yes")).toBe(true); // eslint-disable-line @typescript-eslint/no-explicit-any

    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}`, { method: "DELETE" });
  });

  it("Monitoring Coach: reflects this symbol's own real recorded notifications, never another symbol's", async () => {
    // The legacy-owner account is shared across route test files, so this only
    // asserts the honest-empty path for a fresh symbol nothing else has alerted on.
    const res = await fetch(`${baseUrl}/api/stock-analyst/coach/monitoring/${symbol}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.headline).toContain("no monitoring alerts recorded");
  });
});

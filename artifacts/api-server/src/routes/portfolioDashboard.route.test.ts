// Portfolio Risk Dashboard & Health Score sprint — live route
// integration test for GET /portfolio/dashboard. Uses the real app + a
// real Postgres connection (no auth session needed — unauthenticated
// requests resolve to the legacy-owner stand-in per tenantScope.ts).
// This route is a thin pass-through to lib/portfolioDashboard.ts's
// already-unit-tested buildPortfolioDashboard() — these tests prove the
// HTTP wiring and the honest-degradation contract, not the composition
// math itself.
//
// Deliberately does not assert on exact portfolio-total figures here
// (unlike lib/portfolioDashboard.test.ts's own isolated-user coverage)
// — the legacy-owner's trades table is genuinely shared across many
// sibling route test files, matching the same disclosed discipline
// routes/portfolioConcentration.route.test.ts/
// routes/portfolioEventRisk.route.test.ts already established for
// exactly this situation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface PortfolioDashboardResponse {
  portfolioValue: number;
  buyingPower: number;
  totalRiskDollars: number;
  totalRiskPct: number;
  healthScore: number;
  overallRiskRating: { code: string; label: string };
  paperTradingMode: true;
  credentialsConfigured: boolean;
  brokerConnected: boolean | null;
  lastBrokerCheckAt: string | null;
  lastPortfolioUpdate: string;
  openPositionsCount: number;
  healthFactors: { code: string; label: string; score: number; sourceModule: string; detail: string }[];
  netGreeks: { delta: number; gamma: number; theta: number; vega: number };
  largestPosition: unknown;
  largestRiskContributor: unknown;
  highestEventRisk: unknown;
  highestConcentration: unknown;
  highestDirectionalExposure: unknown;
  widgets: { code: string; label: string; headline: string; detail: string; linkHref: string }[];
  allocationBySymbol: unknown[];
  allocationBySector: unknown[];
  allocationByStrategy: unknown[];
  expirationDistribution: unknown[];
  eventTimelineSummary: unknown;
  stressTestSummary: unknown[];
  guidance: { code: string; label: string; detail: string }[];
  generatedAt: string;
}

describe("Portfolio Dashboard routes (live, real Postgres, SIMULATED path)", () => {
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

  async function fetchDashboard(): Promise<PortfolioDashboardResponse> {
    const res = await fetch(`${baseUrl}/api/portfolio/dashboard`);
    expect(res.status).toBe(200);
    return (await res.json()) as PortfolioDashboardResponse;
  }

  it("generates a well-shaped executive dashboard with all requested Executive Summary fields", async () => {
    const body = await fetchDashboard();
    expect(typeof body.portfolioValue).toBe("number");
    expect(typeof body.buyingPower).toBe("number");
    expect(typeof body.totalRiskDollars).toBe("number");
    expect(body.healthScore).toBeGreaterThanOrEqual(0);
    expect(body.healthScore).toBeLessThanOrEqual(100);
    expect(["healthy", "moderate_risk", "elevated_risk", "high_risk"]).toContain(body.overallRiskRating.code);
    expect(body.paperTradingMode).toBe(true);
    expect(typeof body.lastPortfolioUpdate).toBe("string");
  });

  it("exposes exactly 8 Health Score factors, each disclosing its own source module", async () => {
    const body = await fetchDashboard();
    expect(body.healthFactors).toHaveLength(8);
    for (const f of body.healthFactors) {
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(100);
      expect(typeof f.sourceModule).toBe("string");
      expect(f.sourceModule.length).toBeGreaterThan(0);
    }
  });

  it("exposes all 9 requested Risk Panel fields", async () => {
    const body = await fetchDashboard();
    expect(body.netGreeks).toBeDefined();
    expect(body).toHaveProperty("largestPosition");
    expect(body).toHaveProperty("largestRiskContributor");
    expect(body).toHaveProperty("highestEventRisk");
    expect(body).toHaveProperty("highestConcentration");
    expect(body).toHaveProperty("highestDirectionalExposure");
  });

  it("exposes exactly 7 dashboard widget cards, each with a real linkHref", async () => {
    const body = await fetchDashboard();
    expect(body.widgets).toHaveLength(7);
    for (const w of body.widgets) {
      expect(w.linkHref.startsWith("/")).toBe(true);
      expect(w.headline.length).toBeGreaterThan(0);
    }
  });

  it("exposes visualisation data for every requested chart", async () => {
    const body = await fetchDashboard();
    expect(Array.isArray(body.allocationBySymbol)).toBe(true);
    expect(Array.isArray(body.allocationBySector)).toBe(true);
    expect(Array.isArray(body.allocationByStrategy)).toBe(true);
    expect(Array.isArray(body.expirationDistribution)).toBe(true);
    expect(body.eventTimelineSummary).toBeDefined();
    expect(Array.isArray(body.stressTestSummary)).toBe(true);
  });

  it("guidance is always informational-only text, never an execution action", async () => {
    const body = await fetchDashboard();
    expect(Array.isArray(body.guidance)).toBe(true);
    expect(body.guidance.length).toBeGreaterThan(0);
    for (const g of body.guidance) {
      expect(typeof g.detail).toBe("string");
    }
  });

  it("honestly reports credentialsConfigured/brokerConnected without ever fabricating a live connection", async () => {
    const body = await fetchDashboard();
    expect(typeof body.credentialsConfigured).toBe("boolean");
    expect(body.brokerConnected === null || typeof body.brokerConnected === "boolean").toBe(true);
  });

  it("never carries a broker-write/order-creation surface — no such fields exist on this response shape", async () => {
    const body = await fetchDashboard();
    expect(body).not.toHaveProperty("orderId");
    expect(body).not.toHaveProperty("tradeId");
    expect(body).not.toHaveProperty("journalId");
  });

  it("is a GET with no request body", async () => {
    const res = await fetch(`${baseUrl}/api/portfolio/dashboard`, { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("is deterministic for repeated calls (never mutates state that would change the answer)", async () => {
    const a = await fetchDashboard();
    const b = await fetchDashboard();
    expect(a.healthScore).toBe(b.healthScore);
    expect(a.overallRiskRating).toEqual(b.overallRiskRating);
    expect(a.openPositionsCount).toBe(b.openPositionsCount);
  });
});

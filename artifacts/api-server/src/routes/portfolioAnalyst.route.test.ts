// AI Portfolio Analyst sprint — Phase 8, Sprint 3. Live route
// integration test for GET /portfolio-analyst. Uses the real app + a
// real Postgres connection (no auth session needed — unauthenticated
// requests resolve to the legacy-owner stand-in per tenantScope.ts, the
// same established pattern routes/intelligence.route.test.ts already
// uses). This route is a thin pass-through to
// lib/portfolioAnalyst.ts's already-unit-tested buildPortfolioAnalyst()
// (see lib/portfolioAnalyst.test.ts's own isolated-user coverage) —
// these tests prove the HTTP wiring, response shape, and the never-a-
// broker-write/order-creation contract.
//
// Deliberately does not assert on exact portfolio-total figures here
// (unlike lib/portfolioAnalyst.test.ts's own isolated-user coverage) —
// the legacy-owner's trades table is genuinely shared across many
// sibling route test files, matching the same disclosed discipline
// routes/portfolioDashboard.route.test.ts/routes/intelligence.route.test.ts
// already established for exactly this situation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface PortfolioAnalystResponse {
  paperTradingMode: true;
  deterministicAnalysis: true;
  executiveBriefing: { headline: string; bullets: string[]; generatedAt: string };
  snapshot: { healthScore: number; buyingPower: number; openPositionsCount: number; monthlyTheta: number; totalRiskDollars: number };
  healthSummary: { overallHealthScore: number; strengths: unknown[]; weaknesses: unknown[]; drivers: unknown[] };
  riskSummary: { highestRisk: string; largestExposure: string; guidance: unknown[] };
  incomeSummary: { monthlyTheta: number; bySymbol: unknown[]; byStrategy: unknown[] };
  greeksSummary: { delta: number; gamma: number; theta: number; vega: number; educationalLinks: unknown[] };
  eventSummary: { safePositionsCount: number; atRiskPositionsCount: number; expirationClusters: unknown[] };
  learningSummary: { health: { category: string }; risk: { category: string }; income: { category: string }; greeks: { category: string }; event: { category: string } };
  timeline: { asOf: string; comparedTo: string | null; newIssues: unknown[]; resolvedIssues: unknown[]; persistentIssues: unknown[]; thisWeek: { daysRecorded: number; trend: string } };
  institutionalInsights: { text: string; category: string }[];
  generatedAt: string;
}

describe("GET /portfolio-analyst (live, real Postgres, SIMULATED path)", () => {
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

  async function fetchAnalyst(): Promise<PortfolioAnalystResponse> {
    const res = await fetch(`${baseUrl}/api/portfolio-analyst`);
    expect(res.status).toBe(200);
    return (await res.json()) as PortfolioAnalystResponse;
  }

  it("generates a well-shaped, deterministic-analysis, Paper-Trading result", async () => {
    const body = await fetchAnalyst();
    expect(body.paperTradingMode).toBe(true);
    expect(body.deterministicAnalysis).toBe(true);
    expect(typeof body.generatedAt).toBe("string");
  });

  it("Executive Briefing has a non-empty headline and bullet list", async () => {
    const body = await fetchAnalyst();
    expect(body.executiveBriefing.headline.length).toBeGreaterThan(0);
    expect(body.executiveBriefing.bullets.length).toBeGreaterThan(0);
  });

  it("Portfolio Snapshot exposes real, well-typed figures", async () => {
    const body = await fetchAnalyst();
    expect(typeof body.snapshot.healthScore).toBe("number");
    expect(typeof body.snapshot.buyingPower).toBe("number");
    expect(typeof body.snapshot.openPositionsCount).toBe("number");
    expect(typeof body.snapshot.monthlyTheta).toBe("number");
  });

  it("Health Summary exposes strengths/weaknesses/drivers arrays", async () => {
    const body = await fetchAnalyst();
    expect(Array.isArray(body.healthSummary.strengths)).toBe(true);
    expect(Array.isArray(body.healthSummary.weaknesses)).toBe(true);
    expect(Array.isArray(body.healthSummary.drivers)).toBe(true);
    expect(body.healthSummary.drivers.length).toBe(8);
  });

  it("Risk Summary exposes a real highestRisk string and guidance array", async () => {
    const body = await fetchAnalyst();
    expect(typeof body.riskSummary.highestRisk).toBe("string");
    expect(Array.isArray(body.riskSummary.guidance)).toBe(true);
  });

  it("Income Summary's monthlyTheta mirrors the Snapshot's own monthlyTheta exactly — never two competing figures", async () => {
    const body = await fetchAnalyst();
    expect(body.incomeSummary.monthlyTheta).toBe(body.snapshot.monthlyTheta);
  });

  it("Greeks Summary carries a real 4-Greek reading plus non-empty educational links", async () => {
    const body = await fetchAnalyst();
    expect(typeof body.greeksSummary.delta).toBe("number");
    expect(typeof body.greeksSummary.gamma).toBe("number");
    expect(typeof body.greeksSummary.theta).toBe("number");
    expect(typeof body.greeksSummary.vega).toBe("number");
    expect(body.greeksSummary.educationalLinks.length).toBeGreaterThan(0);
  });

  it("Event Summary's safe + at-risk counts are real, non-negative integers", async () => {
    const body = await fetchAnalyst();
    expect(body.eventSummary.safePositionsCount).toBeGreaterThanOrEqual(0);
    expect(body.eventSummary.atRiskPositionsCount).toBeGreaterThanOrEqual(0);
  });

  it("Learning Summary attaches a real, correct category to every one of the 5 sections", async () => {
    const body = await fetchAnalyst();
    expect(body.learningSummary.health.category).toBe("portfolio_health");
    expect(body.learningSummary.risk.category).toBe("concentration");
    expect(body.learningSummary.income.category).toBe("theta_income");
    expect(body.learningSummary.greeks.category).toBe("greeks_exposure");
    expect(body.learningSummary.event.category).toBe("event_risk");
  });

  it("Portfolio Timeline exposes real entries arrays and a This Week summary", async () => {
    const body = await fetchAnalyst();
    expect(Array.isArray(body.timeline.newIssues)).toBe(true);
    expect(Array.isArray(body.timeline.resolvedIssues)).toBe(true);
    expect(Array.isArray(body.timeline.persistentIssues)).toBe(true);
    expect(typeof body.timeline.thisWeek.daysRecorded).toBe("number");
    expect(["improving", "declining", "stable", "insufficient_history"]).toContain(body.timeline.thisWeek.trend);
  });

  it("Institutional Insights is a real array of deterministic, template-sourced observations", async () => {
    const body = await fetchAnalyst();
    expect(Array.isArray(body.institutionalInsights)).toBe(true);
    for (const insight of body.institutionalInsights) {
      expect(insight.text.length).toBeGreaterThan(0);
      expect(insight.category.length).toBeGreaterThan(0);
    }
  });

  it("never carries a broker-write/order-creation/trade-recommendation surface — no such fields exist on this response shape", async () => {
    const body = await fetchAnalyst();
    expect(body).not.toHaveProperty("orderId");
    expect(body).not.toHaveProperty("tradeId");
    expect(body).not.toHaveProperty("journalId");
    expect(body).not.toHaveProperty("recommendation");
    expect(body).not.toHaveProperty("action");
    expect(body).not.toHaveProperty("tradeRecommendation");
  });

  it("is a GET with no request body", async () => {
    const res = await fetch(`${baseUrl}/api/portfolio-analyst`, { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("is deterministic for repeated same-day calls (never mutates state that would change the answer)", async () => {
    const a = await fetchAnalyst();
    const b = await fetchAnalyst();
    expect(a.healthSummary.overallHealthScore).toBe(b.healthSummary.overallHealthScore);
    expect(a.institutionalInsights).toEqual(b.institutionalInsights);
    expect(a.executiveBriefing.bullets).toEqual(b.executiveBriefing.bullets);
  });
});

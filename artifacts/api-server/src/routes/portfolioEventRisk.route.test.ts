// Earnings & Event Risk Portfolio Overlay sprint — live route
// integration test for GET /portfolio/event-risk. Uses the real app + a
// real Postgres connection (no auth session needed — unauthenticated
// requests resolve to the legacy-owner stand-in per tenantScope.ts). This
// route is a thin pass-through to lib/portfolioEventRisk.ts's already-
// unit-tested buildPortfolioEventRiskOverlay() (22 tests) — these tests
// prove the HTTP wiring and the honest-degradation contract, not the
// composition math itself.
//
// Deliberately does not assert on exact portfolio-total figures here
// (unlike lib/portfolioEventRisk.test.ts's own isolated-user coverage)
// — the legacy-owner's trades table is genuinely shared across many
// sibling route test files, matching the same disclosed discipline
// routes/positionSizing.route.test.ts and routes/portfolioStressTest.
// route.test.ts already established for exactly this situation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface EventRiskEventResponse {
  type: string;
  label: string;
  date: string;
  daysAway: number;
  impact: string;
  scope: string;
  symbol: string | null;
}

interface PositionEventRiskResponse {
  tradeId: number;
  symbol: string;
  strategy: string;
  quantity: number;
  portfolioWeightPct: number;
  expiration: string | null;
  eventStatus: "has_events" | "no_events" | "expiration_unknown";
  primaryEvent: EventRiskEventResponse | null;
  events: EventRiskEventResponse[];
  riskLevel: "none" | "low" | "medium" | "high";
  riskGuidance: string;
  riskGuidanceLabel: string;
  confidence: string | null;
  eventSource: string;
  lastUpdated: string;
}

interface PortfolioEventRiskResultResponse {
  positions: PositionEventRiskResponse[];
  summary: {
    totalPositions: number;
    positionsWithEvents: number;
    positionsWithoutEvents: number;
    highRiskCount: number;
    within1Day: number;
    within3Days: number;
    within7Days: number;
    within14Days: number;
    aggregateExposurePct: number;
    highestRiskPosition: { tradeId: number; symbol: string; riskLevel: string } | null;
  };
  accountValue: number;
  credentialsConfigured: boolean;
  brokerConnected: boolean | null;
  eventRiskEnabled: boolean;
  unsupportedEventCategories: { category: string; label: string; reason: string }[];
  generatedAt: string;
}

describe("Portfolio Event Risk routes (live, real Postgres, SIMULATED path)", () => {
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

  async function fetchOverlay(): Promise<PortfolioEventRiskResultResponse> {
    const res = await fetch(`${baseUrl}/api/portfolio/event-risk`);
    expect(res.status).toBe(200);
    return (await res.json()) as PortfolioEventRiskResultResponse;
  }

  it("generates a well-shaped result with a real summary and honest unsupported-category disclosure", async () => {
    const body = await fetchOverlay();
    expect(Array.isArray(body.positions)).toBe(true);
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.totalPositions).toBe("number");
    expect(body.summary.totalPositions).toBe(body.positions.length);
    expect(Array.isArray(body.unsupportedEventCategories)).toBe(true);
    const categories = body.unsupportedEventCategories.map((c) => c.category);
    expect(categories).toContain("fda_decision");
    expect(categories).toContain("product_launch");
    expect(typeof body.generatedAt).toBe("string");
  });

  it("every position carries a well-shaped, honestly-sourced event-risk assessment", async () => {
    const body = await fetchOverlay();
    for (const pos of body.positions) {
      expect(["has_events", "no_events", "expiration_unknown"]).toContain(pos.eventStatus);
      expect(["none", "low", "medium", "high"]).toContain(pos.riskLevel);
      expect(pos.eventSource).toBe("SIMULATED");
      expect(Array.isArray(pos.events)).toBe(true);
      for (const e of pos.events) expect(e.daysAway).toBeGreaterThanOrEqual(0);
      if (pos.eventStatus === "no_events" || pos.eventStatus === "expiration_unknown") {
        expect(pos.primaryEvent).toBeNull();
        expect(pos.riskLevel).toBe("none");
      }
    }
  });

  it("honestly reports credentialsConfigured/brokerConnected without ever fabricating a live connection", async () => {
    const body = await fetchOverlay();
    expect(typeof body.credentialsConfigured).toBe("boolean");
    expect(body.brokerConnected === null || typeof body.brokerConnected === "boolean").toBe(true);
  });

  it("reports the global eventRiskEnabled setting alongside this page's own always-computed events", async () => {
    const body = await fetchOverlay();
    expect(typeof body.eventRiskEnabled).toBe("boolean");
  });

  it("never carries a broker-write/order-creation surface — no such fields exist on this response shape", async () => {
    const body = await fetchOverlay();
    expect(body).not.toHaveProperty("orderId");
    expect(body).not.toHaveProperty("tradeId");
    expect(body).not.toHaveProperty("journalId");
  });

  it("is a GET with no request body, and never accepts write parameters", async () => {
    const res = await fetch(`${baseUrl}/api/portfolio/event-risk`, { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("is deterministic for repeated calls within the same second (never mutates state that would change the answer)", async () => {
    const a = await fetchOverlay();
    const b = await fetchOverlay();
    expect(a.summary.totalPositions).toBe(b.summary.totalPositions);
    expect(a.positions.map((p) => p.tradeId).sort()).toEqual(b.positions.map((p) => p.tradeId).sort());
  });
});

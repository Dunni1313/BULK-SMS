// Correlation & Concentration Risk Overlay sprint — live route
// integration test for GET /portfolio/concentration. Uses the real app
// + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts). This route is a thin pass-through to
// lib/portfolioConcentration.ts's already-unit-tested
// buildPortfolioConcentrationOverlay() (22 tests) — these tests prove
// the HTTP wiring and the honest-degradation contract, not the
// composition math itself.
//
// Deliberately does not assert on exact portfolio-total figures here
// (unlike lib/portfolioConcentration.test.ts's own isolated-user
// coverage) — the legacy-owner's trades table is genuinely shared
// across many sibling route test files, matching the same disclosed
// discipline routes/positionSizing.route.test.ts and
// routes/portfolioEventRisk.route.test.ts already established for
// exactly this situation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface ConcentrationBucketResponse {
  key: string;
  label: string;
  positionCount: number;
  weightPct: number;
}

interface ConcentrationBreakdownResponse {
  dimension: string;
  buckets: ConcentrationBucketResponse[];
  concentrationScore: number;
  largestBucket: ConcentrationBucketResponse | null;
}

interface PortfolioConcentrationResultResponse {
  totalPositions: number;
  totalPortfolioValue: number;
  accountValue: number;
  netGreeks: { delta: number; gamma: number; theta: number; vega: number };
  netBeta: null;
  netBetaUnavailableReason: string;
  netDirectionalExposure: {
    longExposureDollars: number;
    shortExposureDollars: number;
    netExposureDollars: number;
    netBiasLabel: string;
  };
  breakdowns: {
    symbol: ConcentrationBreakdownResponse;
    underlying: ConcentrationBreakdownResponse;
    sector: ConcentrationBreakdownResponse;
    strategy: ConcentrationBreakdownResponse;
    expiration: ConcentrationBreakdownResponse;
    assetClass: ConcentrationBreakdownResponse;
    directionalBias: ConcentrationBreakdownResponse;
  };
  longShort: { longExposureDollars: number; shortExposureDollars: number; longPct: number; shortPct: number };
  callPut: { callNotional: number; putNotional: number; callPct: number; putPct: number };
  greeksContributions: unknown[];
  clusters: unknown[];
  summary: { concentrationScore: number; diversificationScore: number; portfolioHealthLabel: string };
  riskGuidance: { code: string; label: string; advisories: unknown[] };
  credentialsConfigured: boolean;
  brokerConnected: boolean | null;
  sectorDataSource: string;
  generatedAt: string;
}

describe("Portfolio Concentration routes (live, real Postgres, SIMULATED path)", () => {
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

  async function fetchOverlay(): Promise<PortfolioConcentrationResultResponse> {
    const res = await fetch(`${baseUrl}/api/portfolio/concentration`);
    expect(res.status).toBe(200);
    return (await res.json()) as PortfolioConcentrationResultResponse;
  }

  it("generates a well-shaped result with real net Greeks and all 7 breakdown dimensions", async () => {
    const body = await fetchOverlay();
    expect(typeof body.totalPositions).toBe("number");
    expect(body.netGreeks).toBeDefined();
    for (const dim of ["symbol", "underlying", "sector", "strategy", "expiration", "assetClass", "directionalBias"] as const) {
      expect(body.breakdowns[dim]).toBeDefined();
      expect(Array.isArray(body.breakdowns[dim].buckets)).toBe(true);
    }
    expect(typeof body.generatedAt).toBe("string");
  });

  it("always honestly reports net beta as unavailable, never fabricated", async () => {
    const body = await fetchOverlay();
    expect(body.netBeta).toBeNull();
    expect(body.netBetaUnavailableReason).toMatch(/no beta figure exists/i);
  });

  it("always discloses the sector data source as known-universe metadata", async () => {
    const body = await fetchOverlay();
    expect(body.sectorDataSource).toBe("KNOWN_UNIVERSE_METADATA");
  });

  it("honestly reports credentialsConfigured/brokerConnected without ever fabricating a live connection", async () => {
    const body = await fetchOverlay();
    expect(typeof body.credentialsConfigured).toBe("boolean");
    expect(body.brokerConnected === null || typeof body.brokerConnected === "boolean").toBe(true);
  });

  it("never carries a broker-write/order-creation surface — no such fields exist on this response shape", async () => {
    const body = await fetchOverlay();
    expect(body).not.toHaveProperty("orderId");
    expect(body).not.toHaveProperty("tradeId");
    expect(body).not.toHaveProperty("journalId");
  });

  it("is a GET with no request body", async () => {
    const res = await fetch(`${baseUrl}/api/portfolio/concentration`, { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("is deterministic for repeated calls (never mutates state that would change the answer)", async () => {
    const a = await fetchOverlay();
    const b = await fetchOverlay();
    expect(a.totalPositions).toBe(b.totalPositions);
    expect(a.summary.concentrationScore).toBe(b.summary.concentrationScore);
  });
});

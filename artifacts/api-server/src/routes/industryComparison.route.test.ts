// Phase 2, Sprint 20 — live route integration test for
// GET /stock-analyst/industry-comparison/:symbol. Uses the real app + a real
// Postgres connection (no auth session needed — unauthenticated requests
// resolve to the legacy-owner stand-in per tenantScope.ts, and REQUIRE_AUTH is
// off by default), exercising the SIMULATED path end-to-end over real HTTP.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

describe("GET /stock-analyst/industry-comparison/:symbol (live, SIMULATED path)", () => {
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

  it("returns a peer comparison for a known symbol", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/industry-comparison/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      symbol: string;
      sector: string;
      industry: string;
      peerGroup: unknown[];
      metrics: unknown[];
    };
    expect(body.symbol).toBe("AAPL");
    expect(body.sector).toBe("Technology");
    expect(body.industry).toBe("Consumer Electronics");
    expect(Array.isArray(body.peerGroup)).toBe(true);
    expect(body.peerGroup.length).toBeGreaterThan(0);
    expect(body.metrics.length).toBe(17);
  });

  it("returns 404 for an invalid ticker shape, never fabricating a comparison", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/industry-comparison/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unknown symbol/i);
  });

  it("never triggers extra peer fetches from the main value-research report", async () => {
    // Sanity check on the scope-discipline decision: the main report endpoint
    // still responds normally and carries no industry-comparison-shaped field
    // beyond the new sector/industry header fields — buildValueResearchReport()
    // never calls buildIndustryComparison().
    const res = await fetch(`${baseUrl}/api/stock-analyst/value/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("sector");
    expect(body).toHaveProperty("industry");
    expect(body).not.toHaveProperty("peerGroup");
    expect(body).not.toHaveProperty("competitivePosition");
  });
});

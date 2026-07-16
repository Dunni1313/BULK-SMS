// Phase 3, Sprint 50 — Institutional Dashboard (approved Phase 3 plan
// §3/§4/§21; see docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 50
// as-built note). Live, end-to-end smoke test proving the Dashboard's own
// literal acceptance bar (§22, "Sprint 46 (Dashboard)"): "one symbol lookup
// surfaces Structure + Liquidity + Multi-Timeframe + Probability + Regime +
// Risk without any additional navigation" — mirroring Phase 2 Sprint 31's
// companyResearchUnification.route.test.ts pattern exactly, applied to
// Engine 2.
//
// No new production route or business logic is exercised here that wasn't
// already shipped and independently tested in Sprints 33-38/40-44 — this
// file only proves the concurrent-resolution guarantee the new dashboard
// UI (pages/InstitutionalDashboard.tsx) depends on.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

describe("Institutional Dashboard — one symbol lookup, every Engine 2 signal (live, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;
  const symbol = "AAPL";

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

  it("GET /trading/structure/:symbol resolves for the dashboard's symbol", async () => {
    const res = await fetch(`${baseUrl}/api/trading/structure/${symbol}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);
    expect(body.dataSource).toBe("SIMULATED");
  });

  it("GET /trading/multi-timeframe/:symbol resolves for the dashboard's symbol", async () => {
    const res = await fetch(`${baseUrl}/api/trading/multi-timeframe/${symbol}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);
  });

  it("GET /trading/regime/:symbol resolves for the dashboard's symbol", async () => {
    const res = await fetch(`${baseUrl}/api/trading/regime/${symbol}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);
  });

  it("GET /trading/probability/:symbol resolves for the dashboard's symbol", async () => {
    const res = await fetch(`${baseUrl}/api/trading/probability/${symbol}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);
  });

  it("GET /trading/liquidity/:symbol resolves for the dashboard's symbol", async () => {
    const res = await fetch(`${baseUrl}/api/trading/liquidity/${symbol}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);
  });

  it("GET /trading/risk resolves (portfolio-wide, not per-symbol, per the Dashboard's own always-visible design)", async () => {
    const res = await fetch(`${baseUrl}/api/trading/risk`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(typeof body.overall.label).toBe("string");
  });

  it("every per-symbol Engine 2 signal resolves for the same symbol concurrently, with zero 404s — the literal 'no additional navigation' guarantee", async () => {
    const paths = [
      `/api/trading/structure/${symbol}`,
      `/api/trading/multi-timeframe/${symbol}`,
      `/api/trading/regime/${symbol}`,
      `/api/trading/probability/${symbol}`,
      `/api/trading/liquidity/${symbol}`,
    ];
    const results = await Promise.all(paths.map((p) => fetch(`${baseUrl}${p}`)));
    for (const r of results) {
      expect(r.status).toBe(200);
    }
  });

  it("an unknown symbol 404s consistently across every per-symbol signal — never a partial/fabricated dashboard", async () => {
    const unknown = "NOTASYMBOL";
    const paths = [
      `/api/trading/structure/${unknown}`,
      `/api/trading/multi-timeframe/${unknown}`,
      `/api/trading/regime/${unknown}`,
      `/api/trading/probability/${unknown}`,
      `/api/trading/liquidity/${unknown}`,
    ];
    const results = await Promise.all(paths.map((p) => fetch(`${baseUrl}${p}`)));
    for (const r of results) {
      expect(r.status).toBe(404);
    }
  });
});

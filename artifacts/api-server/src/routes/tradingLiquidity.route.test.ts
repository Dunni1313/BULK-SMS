// Phase 3, Sprint 45 — live route integration test for the Liquidity
// surface, the sixth bounded slice of the Route+UI backlog reduction. Uses
// the real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts). This route is a thin pass-through to Sprint 35's
// already-unit-tested buildLiquidityAnalysis() — these tests prove the HTTP
// wiring, not the liquidity math itself.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface LiquidityResponse {
  symbol: string;
  interval: string;
  dataSource: string;
  candleCount: number;
  currentPrice: number;
  volumeProfile: { price: number; volume: number; pctOfTotal: number }[];
  avgDollarVolume: number;
  liquidityScore: number;
  liquidityBand: string;
  buySellPressure: { buyPct: number; sellPct: number; direction: string };
  confidenceLevel: string;
  summary: string;
}

describe("Liquidity routes (live, real Postgres, SIMULATED path)", () => {
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

  it("resolves a well-shaped liquidity analysis for a known symbol, defaulting to 1D/90 candles", async () => {
    const res = await fetch(`${baseUrl}/api/trading/liquidity/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as LiquidityResponse;
    expect(body.symbol).toBe("AAPL");
    expect(body.interval).toBe("1D");
    expect(body.dataSource).toBe("SIMULATED");
    expect(body.candleCount).toBe(90);
    expect(["High", "Moderate", "Low"]).toContain(body.liquidityBand);
    expect(["High", "Moderate", "Low"]).toContain(body.confidenceLevel);
    expect(["buying", "selling", "neutral"]).toContain(body.buySellPressure.direction);
    expect(Array.isArray(body.volumeProfile)).toBe(true);
  });

  it("respects ?interval= and ?lookback= query overrides", async () => {
    const res = await fetch(`${baseUrl}/api/trading/liquidity/MSFT?interval=1h&lookback=30`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as LiquidityResponse;
    expect(body.interval).toBe("1h");
    expect(body.candleCount).toBe(30);
  });

  it("returns 404 for an invalid ticker shape, never fabricating an analysis", async () => {
    const res = await fetch(`${baseUrl}/api/trading/liquidity/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid interval value", async () => {
    const res = await fetch(`${baseUrl}/api/trading/liquidity/AAPL?interval=3w`);
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-positive lookback value", async () => {
    const res = await fetch(`${baseUrl}/api/trading/liquidity/AAPL?lookback=0`);
    expect(res.status).toBe(400);
  });

  it("is deterministic across repeated calls for the same symbol/interval/lookback", async () => {
    const a = await (await fetch(`${baseUrl}/api/trading/liquidity/NVDA?interval=1D&lookback=60`)).json();
    const b = await (await fetch(`${baseUrl}/api/trading/liquidity/NVDA?interval=1D&lookback=60`)).json();
    expect(a).toEqual(b);
  });
});

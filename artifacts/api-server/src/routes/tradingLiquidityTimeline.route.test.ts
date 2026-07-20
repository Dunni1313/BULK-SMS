// Phase 27 — Institutional Liquidity & Session Workbench. Live route
// integration test for the thin Liquidity Timeline route wrapper. Mirrors
// routes/tradingLiquidity.route.test.ts's own established pattern.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface LiquidityTimelinePoint {
  liquidityBand: string;
  liquidityScore: number;
  buySellDirection: string;
}

interface LiquidityTimelineResponse {
  symbol: string;
  interval: string;
  dataSource: string;
  candleCount: number;
  points: LiquidityTimelinePoint[];
  relativeLiquidity: string;
  averageLiquidityScore: number | null;
  keyLiquidityZones: { price: number; volume: number; pctOfTotal: number }[];
  summary: string;
}

describe("Trading Liquidity Timeline routes (live, real Postgres, SIMULATED path)", () => {
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

  it("resolves a well-shaped liquidity timeline for a known symbol using default 1D/90 params", async () => {
    const res = await fetch(`${baseUrl}/api/trading/liquidity-timeline/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as LiquidityTimelineResponse;
    expect(body.symbol).toBe("AAPL");
    expect(body.interval).toBe("1D");
    expect(body.dataSource).toBe("SIMULATED");
    expect(body.points.length).toBeGreaterThan(0);
    expect(["Above Average", "Below Average", "Average", "Insufficient Data"]).toContain(body.relativeLiquidity);
  });

  it("never fabricates key liquidity zones with no real candle volume behind them", async () => {
    const res = await fetch(`${baseUrl}/api/trading/liquidity-timeline/AAPL`);
    const body = (await res.json()) as LiquidityTimelineResponse;
    for (const zone of body.keyLiquidityZones) {
      expect(zone.volume).toBeGreaterThan(0);
    }
  });

  it("returns 404 for an invalid ticker shape, never fabricating a timeline", async () => {
    const res = await fetch(`${baseUrl}/api/trading/liquidity-timeline/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
  });

  it("is deterministic across repeated calls for the same symbol", async () => {
    const first = await (await fetch(`${baseUrl}/api/trading/liquidity-timeline/NVDA`)).json();
    const second = await (await fetch(`${baseUrl}/api/trading/liquidity-timeline/NVDA`)).json();
    expect(first).toEqual(second);
  });
});

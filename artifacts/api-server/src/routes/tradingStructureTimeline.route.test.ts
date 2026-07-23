// Phase 26 — Institutional Market Structure Workbench. Live route
// integration test for the Structure Shift Timeline surface. Uses the real
// app + a real Postgres connection (no auth session needed — unauthenticated
// requests resolve to the legacy-owner stand-in per tenantScope.ts). This
// route is a thin pass-through to lib/tradingStructureTimeline.ts's already-
// unit-tested buildStructureShiftTimeline() — these tests prove the HTTP
// wiring, not the event-derivation math itself. Mirrors
// routes/tradingStructure.route.test.ts's own Sprint 40 pattern exactly.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface TimelineResponse {
  symbol: string;
  interval: string;
  dataSource: string;
  candleCount: number;
  events: { time: string; type: string; label: string; price: number; detail: string }[];
  summary: string;
}

describe("Structure Shift Timeline routes (live, real Postgres, SIMULATED path)", () => {
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

  it("resolves a well-shaped timeline for a known symbol, defaulting to 1D/90 candles", async () => {
    const res = await fetch(`${baseUrl}/api/trading/structure-timeline/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as TimelineResponse;
    expect(body.symbol).toBe("AAPL");
    expect(body.interval).toBe("1D");
    expect(body.dataSource).toBe("SIMULATED");
    expect(body.candleCount).toBe(90);
    expect(Array.isArray(body.events)).toBe(true);
    for (const e of body.events) {
      expect([
        "higher_high",
        "higher_low",
        "lower_high",
        "lower_low",
        "trend_change",
        "range_entry",
        "range_exit",
        "support_test",
        "resistance_test",
      ]).toContain(e.type);
    }
  });

  it("respects ?interval= and ?lookback= query overrides", async () => {
    const res = await fetch(`${baseUrl}/api/trading/structure-timeline/MSFT?interval=1h&lookback=30`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as TimelineResponse;
    expect(body.interval).toBe("1h");
    expect(body.candleCount).toBe(30);
  });

  it("returns 404 for an invalid ticker shape, never fabricating a timeline", async () => {
    const res = await fetch(`${baseUrl}/api/trading/structure-timeline/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid interval value", async () => {
    const res = await fetch(`${baseUrl}/api/trading/structure-timeline/AAPL?interval=3w`);
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-positive lookback value", async () => {
    const res = await fetch(`${baseUrl}/api/trading/structure-timeline/AAPL?lookback=0`);
    expect(res.status).toBe(400);
  });

  it("is deterministic across repeated calls for the same symbol/interval/lookback", async () => {
    const a = await (await fetch(`${baseUrl}/api/trading/structure-timeline/NVDA?interval=1D&lookback=60`)).json();
    const b = await (await fetch(`${baseUrl}/api/trading/structure-timeline/NVDA?interval=1D&lookback=60`)).json();
    expect(a).toEqual(b);
  });
});

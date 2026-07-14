// Phase 4, Sprint 55 — Macro/Regime Side-by-Side View (approved Phase 4
// plan, Sprint 55; see docs/Phase-4-Master-Execution-Plan.md's Sprint 55
// as-built note). Live, end-to-end smoke test for the new
// GET /stock-analyst/macro route — a thin pass-through to the already-unit-
// tested buildMacroContext() (lib/investingMacro.ts, Phase 2 Sprint 26;
// see lib/investingMacro.test.ts for the formula/determinism coverage this
// file deliberately does not re-derive). This file only proves the route
// itself: it resolves, it's global (not symbol-scoped), and it's honestly
// labeled SIMULATED.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

describe("GET /stock-analyst/macro — Engine 1's global macro/rate-regime context (live, SIMULATED path)", () => {
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

  it("resolves with a well-shaped, honestly-labeled macro context", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/macro`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(["rising_rates", "falling_rates", "stable_rates"]).toContain(body.regime);
    expect(typeof body.regimeLabel).toBe("string");
    expect(typeof body.rateTrendPct).toBe("number");
    expect(body.dataSource).toBe("SIMULATED");
    expect(body.summary).toMatch(/SIMULATED/);
  });

  it("is global, not symbol-scoped — no path parameter, and the response carries no symbol field", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/macro`);
    const body = await json(res);
    expect(body.symbol).toBeUndefined();
  });

  it("is deterministic across repeated calls on the same day — never a re-rolled value mid-request", async () => {
    const [a, b] = await Promise.all([
      fetch(`${baseUrl}/api/stock-analyst/macro`),
      fetch(`${baseUrl}/api/stock-analyst/macro`),
    ]);
    const [bodyA, bodyB] = await Promise.all([json(a), json(b)]);
    expect(bodyA).toEqual(bodyB);
  });
});

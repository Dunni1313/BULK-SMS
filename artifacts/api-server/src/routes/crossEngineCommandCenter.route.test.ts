// Phase 4, Sprint 54 — Cross-Engine Command Center (approved Phase 4 plan,
// Sprint 54; see docs/Phase-4-Master-Execution-Plan.md's Sprint 54 as-built
// note). Live, end-to-end smoke test proving the Command Center's own
// literal acceptance bar: "one symbol lookup shows Engine 1's Investment
// Committee verdict and Engine 2's technical read on one screen; read-only,
// zero new engine calculations; live end-to-end test proves both resolve
// concurrently for the same symbol" — mirroring Phase 2 Sprint 31's
// companyResearchUnification.route.test.ts and Phase 3 Sprint 50's
// institutionalDashboard.route.test.ts pattern exactly, applied across the
// two engines this sprint pairs.
//
// No new production route or business logic is exercised here that wasn't
// already shipped and independently tested: GET /stock-analyst/value/:symbol
// (Engine 1, Phase 2 Sprints 11-31, its own investmentCommittee field since
// Sprint 17) and GET /trading/regime/:symbol (Engine 2, Phase 3 Sprint 42).
// This file only proves the concurrent-resolution guarantee the new
// Cross-Engine Verdict UI (pages/InstitutionalDashboard.tsx) depends on.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

describe("Cross-Engine Command Center — Engine 1 Investment Committee + Engine 2 technical read, one symbol (live, SIMULATED path)", () => {
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

  it("GET /stock-analyst/value/:symbol resolves and carries a well-shaped Investment Committee verdict (Engine 1)", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/value/${symbol}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);
    expect(["Buy", "Hold", "Wait"]).toContain(body.investmentCommittee.consolidatedVerdict);
    expect(["unanimous", "majority", "split", "insufficient-data"]).toContain(body.investmentCommittee.agreement);
    expect(typeof body.investmentCommittee.summary).toBe("string");
  });

  it("GET /trading/regime/:symbol resolves and carries a well-shaped technical read (Engine 2)", async () => {
    const res = await fetch(`${baseUrl}/api/trading/regime/${symbol}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.symbol).toBe(symbol);
    expect(typeof body.regimeLabel).toBe("string");
    expect(typeof body.summary).toBe("string");
  });

  it("both engines' reads resolve concurrently for the same symbol, with zero 404s — the literal 'on one screen' guarantee", async () => {
    const [committeeRes, technicalRes] = await Promise.all([
      fetch(`${baseUrl}/api/stock-analyst/value/${symbol}`),
      fetch(`${baseUrl}/api/trading/regime/${symbol}`),
    ]);
    expect(committeeRes.status).toBe(200);
    expect(technicalRes.status).toBe(200);

    const [committeeBody, technicalBody] = await Promise.all([json(committeeRes), json(technicalRes)]);
    expect(committeeBody.symbol).toBe(symbol);
    expect(technicalBody.symbol).toBe(symbol);
  });

  it("an unknown symbol 404s consistently across both engines — never a partial/fabricated command center", async () => {
    const unknown = "NOTASYMBOL";
    const [committeeRes, technicalRes] = await Promise.all([
      fetch(`${baseUrl}/api/stock-analyst/value/${unknown}`),
      fetch(`${baseUrl}/api/trading/regime/${unknown}`),
    ]);
    expect(committeeRes.status).toBe(404);
    expect(technicalRes.status).toBe(404);
  });

  it("neither engine's own response gained a field the other doesn't already have — read-only cross-reference, zero new engine calculations", async () => {
    const [committeeRes, technicalRes] = await Promise.all([
      fetch(`${baseUrl}/api/stock-analyst/value/${symbol}`),
      fetch(`${baseUrl}/api/trading/regime/${symbol}`),
    ]);
    const [committeeBody, technicalBody] = await Promise.all([json(committeeRes), json(technicalRes)]);
    // Engine 1's report has no Engine-2-shaped regime field, and Engine 2's
    // regime response has no Engine-1-shaped investmentCommittee field —
    // this sprint only reads and pairs two already-independent reports in
    // the UI, it never merges or extends either engine's own contract.
    expect(committeeBody.regimeLabel).toBeUndefined();
    expect(technicalBody.investmentCommittee).toBeUndefined();
  });
});

// Phase 5, Sprint 68 — Cross-Engine Daily Report (approved Phase 5 roadmap
// review). Live route integration test proving the HTTP wiring for
// GET/POST /cross-engine-report(/narrate) — the underlying
// composition logic itself is already covered by
// lib/crossEngineDailyReport.test.ts's own fixtures against isolated, fresh
// users; this file only proves the routes correctly call through to it.
// Uses the real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts).
//
// Deliberately shape-only assertions here, not exact counts — the shared
// legacy-owner account's watchlist/trading-positions/trades rows are
// populated by dozens of other sibling test files across this whole suite,
// the same established discipline routes/tradingRisk.route.test.ts (Sprint
// 44) and routes/phase4Unification.route.test.ts (Sprint 64) already follow
// for this exact shared-account situation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

describe("Cross-Engine Daily Report routes (live, SIMULATED path)", () => {
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

  it("GET /cross-engine-report resolves a well-shaped report covering all 3 engines, no LLM call", async () => {
    const res = await fetch(`${baseUrl}/api/cross-engine-report`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(typeof body.date).toBe("string");
    expect(typeof body.generatedAt).toBe("string");
    expect(body.engine1.macro).toBeTruthy();
    expect(Array.isArray(body.engine1.watchlistCrossings)).toBe(true);
    expect(body.engine2.risk).toBeTruthy();
    expect(typeof body.engine3.healthScore).toBe("number");
    expect(typeof body.summary).toBe("string");
    expect(body.disclaimer).toMatch(/advisory\/education only/i);
  });

  it("GET is deterministic across repeated calls (excluding generatedAt)", async () => {
    const [r1, r2] = await Promise.all([
      fetch(`${baseUrl}/api/cross-engine-report`),
      fetch(`${baseUrl}/api/cross-engine-report`),
    ]);
    const [b1, b2] = await Promise.all([json(r1), json(r2)]);
    const { generatedAt: g1, ...rest1 } = b1;
    const { generatedAt: g2, ...rest2 } = b2;
    void g1;
    void g2;
    expect(rest1).toEqual(rest2);
  });

  it("POST /cross-engine-report/narrate resolves a narration grounded in the same deterministic report, never blocking on or replacing the eager GET", async () => {
    const res = await fetch(`${baseUrl}/api/cross-engine-report/narrate`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(typeof body.narrative).toBe("string");
    expect(body.narrative.length).toBeGreaterThan(0);
    expect(["llm", "template"]).toContain(body.narrativeSource);
  });

  it("honestly falls back to the deterministic template in this key-less session — never a fabricated narration", async () => {
    const res = await fetch(`${baseUrl}/api/cross-engine-report/narrate`, { method: "POST" });
    const body = await json(res);
    // No LLM key is configured anywhere in this session (the same unbroken
    // disclosure every prior sprint has made) — the narration honestly
    // falls back to the deterministic template, never fabricated prose.
    expect(body.narrativeSource).toBe("template");
  });

  it("GET and POST /narrate resolve concurrently with zero errors — the eager data and the on-demand narration are genuinely independent actions", async () => {
    const [getRes, narrateRes] = await Promise.all([
      fetch(`${baseUrl}/api/cross-engine-report`),
      fetch(`${baseUrl}/api/cross-engine-report/narrate`, { method: "POST" }),
    ]);
    expect(getRes.status).toBe(200);
    expect(narrateRes.status).toBe(200);
  });

  // Regression protection: /cross-engine-report was deliberately NOT named
  // /reports/cross-engine-daily during implementation — that path collided
  // with routes/portfolioAI.ts's own pre-existing GET/DELETE /reports/:id
  // (Express matched "cross-engine-daily" as the :id param and 400'd with
  // "Invalid report id" before this router's own handler ever ran). This
  // test proves both namespaces resolve correctly and neither shadows the
  // other, now that they're distinct.
  it("does not collide with Engine 3's own pre-existing /reports/:id route", async () => {
    const ownReportRes = await fetch(`${baseUrl}/api/cross-engine-report`);
    expect(ownReportRes.status).toBe(200);

    const engine3ReportRes = await fetch(`${baseUrl}/api/reports/999999999`);
    expect(engine3ReportRes.status).toBe(404); // "Report not found" — Engine 3's own route, own contract, unaffected
    const engine3Body = await json(engine3ReportRes);
    expect(engine3Body.error).toMatch(/report not found/i);
  });
});

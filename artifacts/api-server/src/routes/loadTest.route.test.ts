// Phase 6, Sprint 73 — Load & Chaos Testing: Automation Scheduler.
//
// HTTP-level load scenarios against real, already-shipped routes, using
// the exact real-app-instance + native fetch() pattern every prior
// *.route.test.ts file already uses (e.g. tradingStructure.route.test.ts,
// Sprint 40) — no new npm dependency, no external load-generation tool
// (per this sprint's own approved tooling decision). Concurrency is
// achieved with Promise.allSettled via lib/loadTestHarness.ts.
//
// Scope: read-only, globally-scoped routes only (health check, Engine 2's
// market-structure route, which Sprint 40's own header comment confirms
// needs no ownership/tenant scoping). This file deliberately never fires
// concurrent load against a per-user route with the shared legacy-owner
// account — that would risk exactly the "shared-legacy-owner-account
// live-Postgres-parallelism flake" category already disclosed since
// Sprint 20 and reproduced repeatedly in this session's own E2E runs. The
// automation-scheduler-specific load/chaos scenarios (this sprint's own
// primary target, per the plan) live in lib/schedulerLoad.test.ts and
// lib/schedulerChaos.test.ts instead, against freshly-created, isolated
// per-test users — never the shared account.
//
// Thresholds below are DELIBERATELY GENEROUS — this suite proves the
// server stays responsive and correct under concurrent load in this
// shared, resource-constrained sandbox, not a strict performance SLA. See
// this sprint's own CLAUDE.md/Phase 6 doc entries for the full
// methodology and limitations discussion.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { runConcurrent, summarizeLatencies, successCount, type LatencySummary } from "../lib/loadTestHarness.js";

// Rounds a LatencySummary's ms fields to whole numbers for readable
// console.info output — informational only, no assertion depends on this.
function roundSummary(s: LatencySummary): Record<string, number> {
  return {
    count: s.count,
    minMs: Math.round(s.minMs),
    avgMs: Math.round(s.avgMs),
    p50Ms: Math.round(s.p50Ms),
    p95Ms: Math.round(s.p95Ms),
    p99Ms: Math.round(s.p99Ms),
    maxMs: Math.round(s.maxMs),
  };
}

describe("Load testing — read-only, globally-scoped routes (Sprint 73)", () => {
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

  it("handles 100 concurrent health-check requests, all succeeding, with stable latency", async () => {
    const CONCURRENCY = 100;
    const { outcomes, latenciesMs, totalMs } = await runConcurrent(CONCURRENCY, async () => {
      const res = await fetch(`${baseUrl}/api/healthz`);
      if (!res.ok) throw new Error(`unexpected status ${res.status}`);
      return res.status;
    });

    expect(successCount(outcomes)).toBe(CONCURRENCY);
    const summary = summarizeLatencies(latenciesMs);
    // eslint-disable-next-line no-console
    console.info("[load] /api/healthz x100 concurrent:", { totalMs: Math.round(totalMs), ...roundSummary(summary) });
    // Generous ceilings — a cheap, DB-free route under 100-way concurrency in
    // this shared sandbox. Catches genuine hangs/regressions, not sandbox jitter.
    expect(summary.p95Ms).toBeLessThan(3000);
    expect(totalMs).toBeLessThan(5000);
  }, 30000);

  it("handles 25 concurrent real-computation requests (Engine 2 market structure) across several symbols, all succeeding", async () => {
    const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "SPY"];
    const CONCURRENCY = 25;
    const { outcomes, latenciesMs, totalMs } = await runConcurrent(CONCURRENCY, async (i) => {
      const symbol = symbols[i % symbols.length];
      const res = await fetch(`${baseUrl}/api/trading/structure/${symbol}`);
      if (!res.ok) throw new Error(`unexpected status ${res.status} for ${symbol}`);
      const body = (await res.json()) as { symbol: string; dataSource: string };
      if (body.symbol !== symbol) throw new Error(`symbol mismatch: expected ${symbol}, got ${body.symbol}`);
      if (body.dataSource !== "SIMULATED") throw new Error(`unexpected dataSource: ${body.dataSource}`);
      return body;
    });

    expect(successCount(outcomes)).toBe(CONCURRENCY);
    const summary = summarizeLatencies(latenciesMs);
    // eslint-disable-next-line no-console
    console.info("[load] /api/trading/structure/:symbol x25 concurrent:", {
      totalMs: Math.round(totalMs),
      ...roundSummary(summary),
    });
    // A real per-request computation (candle generation + swing/zone analysis),
    // still CPU-bound and DB-free — generous ceiling for this sandbox.
    expect(summary.p95Ms).toBeLessThan(5000);
    expect(totalMs).toBeLessThan(10000);
  }, 30000);

  it("gracefully returns honest 404s under concurrent load for an unresolvable symbol — never a fabricated result, never a crash", async () => {
    const CONCURRENCY = 20;
    const { outcomes } = await runConcurrent(CONCURRENCY, async () => {
      const res = await fetch(`${baseUrl}/api/trading/structure/NOTATICKER!!`);
      return res.status;
    });
    const statuses = outcomes.map((o) => (o.status === "fulfilled" ? o.value : -1));
    expect(statuses.every((s) => s === 404)).toBe(true);
  }, 30000);

  it("stays responsive to a fresh request immediately after a 100-way burst (no lingering degradation)", async () => {
    await runConcurrent(100, async () => {
      const res = await fetch(`${baseUrl}/api/healthz`);
      return res.status;
    });
    const start = performance.now();
    const res = await fetch(`${baseUrl}/api/healthz`);
    const elapsedMs = performance.now() - start;
    expect(res.status).toBe(200);
    expect(elapsedMs).toBeLessThan(2000);
  }, 30000);
});

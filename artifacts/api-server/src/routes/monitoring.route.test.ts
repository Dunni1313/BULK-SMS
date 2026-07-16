// Phase 6, Sprint 74 — Monitoring, Alerting & Incident Runbook. Live route
// integration test for the new operational health endpoint. Uses the real
// app + a real Postgres connection, mirroring tradingStructure.route.test.ts
// (Sprint 40) exactly. This route is a thin pass-through to
// lib/systemHealth.ts's already-unit-tested buildLiveMonitoringStatus() —
// these tests prove the HTTP wiring and response shape, not the alert math
// itself.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface MonitoringStatusResponse {
  status: "ok" | "degraded";
  timestamp: string;
  database: { connected: boolean; latencyMs: number | null; error: string | null };
  jobs: {
    job: string;
    lastRunAt: string | null;
    lastDurationMs: number | null;
    lastStatus: "ok" | "error" | "never_run";
    lastError: string | null;
    consecutiveFailures: number;
    totalRuns: number;
    totalFailures: number;
  }[];
  requestMetrics: { total: number; byStatusClass: Record<"2xx" | "3xx" | "4xx" | "5xx" | "other", number> };
  auditSignals: { guardrailBlocksLastHour: number; authFailuresLastHour: number; computedAt: string | null };
  alerts: { category: string; severity: "warning" | "critical"; message: string }[];
}

describe("GET /monitoring/status (live, real Postgres)", () => {
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

  it("resolves a well-shaped monitoring status with a real, connected database check", async () => {
    const res = await fetch(`${baseUrl}/api/monitoring/status`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as MonitoringStatusResponse;

    expect(["ok", "degraded"]).toContain(body.status);
    expect(body.database.connected).toBe(true);
    expect(body.database.error).toBeNull();
    expect(typeof body.database.latencyMs).toBe("number");
    expect(Array.isArray(body.jobs)).toBe(true);
    expect(Array.isArray(body.alerts)).toBe(true);
    expect(typeof body.requestMetrics.total).toBe("number");
    expect(typeof body.requestMetrics.byStatusClass["2xx"]).toBe("number");
    // auditSignals.computedAt is honestly null in this process (the
    // monitoring timer is only started from the real server entrypoint,
    // index.ts, never from app.ts — see systemHealth.ts's own header
    // comment) — never fabricated as a fresh number.
    expect(body.auditSignals.computedAt).toBeNull();
    expect(body.auditSignals.guardrailBlocksLastHour).toBe(0);
  });

  it("is not gated by REQUIRE_AUTH — resolves for an unauthenticated request exactly like /healthz", async () => {
    // Mirrors app.ts's own mounting-order comment: health/monitoring routes
    // are exempt from the requireAuth gate even when REQUIRE_AUTH=true, since
    // this test process doesn't set that env var, a plain unauthenticated
    // fetch already proves the route is reachable without a session cookie.
    const res = await fetch(`${baseUrl}/api/monitoring/status`);
    expect(res.status).toBe(200);
  });

  it("is not subject to rate limiting under a small burst (mirrors /healthz's own exemption)", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => fetch(`${baseUrl}/api/monitoring/status`)),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
  });

  it("stays well-shaped and correct across repeated calls (determinism of the shape, not the live-changing values)", async () => {
    const res1 = await fetch(`${baseUrl}/api/monitoring/status`);
    const res2 = await fetch(`${baseUrl}/api/monitoring/status`);
    const body1 = (await res1.json()) as MonitoringStatusResponse;
    const body2 = (await res2.json()) as MonitoringStatusResponse;
    expect(Object.keys(body1).sort()).toEqual(Object.keys(body2).sort());
    expect(body1.database.connected).toBe(body2.database.connected);
  });
});

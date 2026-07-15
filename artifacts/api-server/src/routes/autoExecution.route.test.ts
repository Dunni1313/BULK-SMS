// Phase 5, Sprint 67 — Testing & Security Audit checkpoint, first bounded slice
// (a dedicated review of the auto-execution/auto-adjustment kill-switch and
// guardrail logic; see .agents/memory/kill-switch-security-review.md for the
// full write-up).
//
// This file closes finding #2 of that review: routes/autoExecution.ts had ZERO
// dedicated route-level tests before this sprint — none of its 5 routes had
// ever been exercised through the real Express route + getScopedUserId +
// response-schema-parsing chain, only through direct calls to the underlying
// lib functions (lib/phase6.test.ts, lib/autoScheduler.multiUser.test.ts). For
// the only user-facing surface that can manually trigger real automated
// trading, this was a real gap.
//
// Live, end-to-end HTTP tests against the real app + a real Postgres
// connection (unauthenticated requests resolve to the legacy-owner stand-in
// per tenantScope.ts, the same convention every route test in this codebase
// uses). This file mutates the shared legacy-owner account's kill-switch
// settings — its own original values are read first and restored in
// afterAll, the same discipline notifications.route.test.ts (Sprint 56)
// established for exactly this shared-account situation.
//
// The manual trigger routes are proven NOT to be a bypass path: calling them
// while disarmed reports blocked:true with the kill-switch reason, identical
// to what the scheduler itself would report — never executing anything.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

describe("Auto-execution routes — kill-switch respected, never bypassed (live, real Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let originalSettings: Json;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const res = await fetch(`${baseUrl}/api/settings`);
    originalSettings = await json(res);
  });

  afterAll(async () => {
    // Restore the shared legacy-owner account's exact original kill-switch
    // state so no sibling test file relying on it is affected.
    await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        executionMode: originalSettings.executionMode,
        autoExecuteEnabled: originalSettings.autoExecuteEnabled,
        autoAdjustEnabled: originalSettings.autoAdjustEnabled,
      }),
    });
    server.close();
  });

  it("GET /execution/auto/status returns a well-shaped status reflecting the current kill-switch state", async () => {
    const res = await fetch(`${baseUrl}/api/execution/auto/status`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(typeof body.armed).toBe("boolean");
    expect(typeof body.autoExecuteEnabled).toBe("boolean");
    expect(body.guardrails).toBeTruthy();
    expect(body.today).toBeTruthy();
  });

  it("POST /execution/auto/run is honestly blocked, never executes anything, when the master kill switch is off", async () => {
    const disarmRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ executionMode: "full_auto", autoExecuteEnabled: false }),
    });
    expect(disarmRes.status).toBe(200);

    const statusRes = await fetch(`${baseUrl}/api/execution/auto/status`);
    const status = await json(statusRes);
    expect(status.armed).toBe(false);

    const runRes = await fetch(`${baseUrl}/api/execution/auto/run`, { method: "POST" });
    expect(runRes.status).toBe(200);
    const run = await json(runRes);
    expect(run.blocked).toBe(true);
    expect(run.blockReason).toMatch(/kill switch/i);
    expect(run.executed).toBe(0);
  });

  it("POST /execution/auto/adjust/run is honestly blocked, never closes anything, when the master kill switch is off (checked before the subordinate switch)", async () => {
    const disarmRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ executionMode: "full_auto", autoExecuteEnabled: false, autoAdjustEnabled: true }),
    });
    expect(disarmRes.status).toBe(200);

    const runRes = await fetch(`${baseUrl}/api/execution/auto/adjust/run`, { method: "POST" });
    expect(runRes.status).toBe(200);
    const run = await json(runRes);
    expect(run.blocked).toBe(true);
    // The master kill switch is checked BEFORE the subordinate auto-adjust
    // switch (autoAdjustAllowed()'s own documented precedence) — the block
    // reason must name the master switch, not the subordinate one, even
    // though the subordinate is armed=true here.
    expect(run.blockReason).toMatch(/master kill switch/i);
  });

  it("POST /execution/auto/adjust/run is honestly blocked when the master switch is armed but the subordinate auto-adjust switch is off", async () => {
    const patchRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: false }),
    });
    expect(patchRes.status).toBe(200);

    const runRes = await fetch(`${baseUrl}/api/execution/auto/adjust/run`, { method: "POST" });
    expect(runRes.status).toBe(200);
    const run = await json(runRes);
    expect(run.blocked).toBe(true);
    expect(run.blockReason).toMatch(/auto-adjust switch is off/i);

    // Restore full disarm immediately so subsequent tests in this file (and
    // any concurrently-running sibling file sharing the legacy-owner account)
    // never observe an accidentally-armed master switch.
    await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ autoExecuteEnabled: false }),
    });
  });

  it("GET /execution/auto/log and /execution/auto/adjust/log resolve as well-shaped arrays, including the blocked decisions just recorded", async () => {
    const [logRes, adjustLogRes] = await Promise.all([
      fetch(`${baseUrl}/api/execution/auto/log`),
      fetch(`${baseUrl}/api/execution/auto/adjust/log`),
    ]);
    expect(logRes.status).toBe(200);
    expect(adjustLogRes.status).toBe(200);
    const log = (await logRes.json()) as Json[];
    const adjustLog = (await adjustLogRes.json()) as Json[];
    expect(Array.isArray(log)).toBe(true);
    expect(Array.isArray(adjustLog)).toBe(true);
    // Per-item assertion, not an aggregate count — this shared legacy-owner
    // log accumulates rows across every test file that exercises either
    // engine, the same established discipline as tradingRisk.route.test.ts
    // (Sprint 44) for exactly this shared-table situation.
    expect(adjustLog.some((r) => r.decision === "blocked" && /kill switch/i.test(r.reason))).toBe(true);
  });
});

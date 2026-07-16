// Phase 6, Sprint 74 — Monitoring, Alerting & Incident Runbook. Unit tests
// for the monitoring module's own logic, independent of any real interval
// timer. checkDatabaseConnectivity()/computeAuditSignals() run against the
// real test database (same convention as every other lib/*.test.ts file
// that talks to Postgres); evaluateAlerts()/recordJobRun()/
// logAndPersistAlerts() are tested with constructed fixtures.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, usersTable, settingsTable, scannerResultsTable, autoExecutionLogTable, platformAuditLogTable } from "@workspace/db";
import {
  recordJobRun,
  getJobHealthSnapshot,
  checkDatabaseConnectivity,
  computeAuditSignals,
  evaluateAlerts,
  runMonitoringCycle,
  buildLiveMonitoringStatus,
  logAndPersistAlerts,
  resetSystemHealthForTest,
  JOB_FAILURE_ALERT_THRESHOLD,
  JOB_STALE_MULTIPLIER,
  GUARDRAIL_BLOCK_RATE_ALERT_THRESHOLD,
  AUTH_FAILURE_RATE_ALERT_THRESHOLD,
  type JobHealth,
  type DbHealthCheck,
} from "./systemHealth.js";
import { logger } from "./logger.js";

function healthyDb(): DbHealthCheck {
  return { connected: true, latencyMs: 1, error: null };
}

function freshJob(overrides: Partial<JobHealth> = {}): JobHealth {
  return {
    job: "test-job",
    lastRunAt: new Date().toISOString(),
    lastDurationMs: 10,
    lastStatus: "ok",
    lastError: null,
    consecutiveFailures: 0,
    totalRuns: 1,
    totalFailures: 0,
    ...overrides,
  };
}

describe("recordJobRun / getJobHealthSnapshot", () => {
  beforeEach(() => {
    resetSystemHealthForTest();
  });

  it("starts a never-tracked job as absent from the snapshot (never fabricated)", () => {
    expect(getJobHealthSnapshot()).toEqual([]);
  });

  it("records a successful run", () => {
    recordJobRun("job-a", { success: true, durationMs: 42 });
    const [job] = getJobHealthSnapshot();
    expect(job.lastStatus).toBe("ok");
    expect(job.lastDurationMs).toBe(42);
    expect(job.consecutiveFailures).toBe(0);
    expect(job.totalRuns).toBe(1);
    expect(job.totalFailures).toBe(0);
    expect(job.lastError).toBeNull();
  });

  it("records a failed run and increments consecutiveFailures/totalFailures", () => {
    recordJobRun("job-a", { success: false, durationMs: 5, error: "boom" });
    const [job] = getJobHealthSnapshot();
    expect(job.lastStatus).toBe("error");
    expect(job.lastError).toBe("boom");
    expect(job.consecutiveFailures).toBe(1);
    expect(job.totalFailures).toBe(1);
  });

  it("resets consecutiveFailures back to 0 the moment a run succeeds again", () => {
    recordJobRun("job-a", { success: false, durationMs: 5, error: "boom" });
    recordJobRun("job-a", { success: false, durationMs: 5, error: "boom" });
    recordJobRun("job-a", { success: true, durationMs: 5 });
    const [job] = getJobHealthSnapshot();
    expect(job.consecutiveFailures).toBe(0);
    expect(job.totalRuns).toBe(3);
    expect(job.totalFailures).toBe(2); // total is cumulative, never reset
  });

  it("tracks multiple distinct jobs independently", () => {
    recordJobRun("job-a", { success: true, durationMs: 1 });
    recordJobRun("job-b", { success: false, durationMs: 1, error: "x" });
    const jobs = getJobHealthSnapshot();
    expect(jobs).toHaveLength(2);
    expect(jobs.find((j) => j.job === "job-a")?.lastStatus).toBe("ok");
    expect(jobs.find((j) => j.job === "job-b")?.lastStatus).toBe("error");
  });
});

describe("checkDatabaseConnectivity", () => {
  it("reports connected:true with a real latency against the real test database", async () => {
    const result = await checkDatabaseConnectivity();
    expect(result.connected).toBe(true);
    expect(result.error).toBeNull();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe("evaluateAlerts", () => {
  it("returns no alerts for a fully healthy snapshot", () => {
    const alerts = evaluateAlerts({
      database: healthyDb(),
      jobs: [freshJob()],
      requestMetrics: { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } },
      auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: 0 },
    });
    expect(alerts).toEqual([]);
  });

  it("flags database.unreachable as critical when the connectivity check failed", () => {
    const alerts = evaluateAlerts({
      database: { connected: false, latencyMs: null, error: "connection refused" },
      jobs: [],
      requestMetrics: { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } },
      auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: 0 },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ category: "database.unreachable", severity: "critical" });
    expect(alerts[0].message).toContain("connection refused");
  });

  it(`flags scheduler.repeated_failure once consecutiveFailures reaches the threshold (${JOB_FAILURE_ALERT_THRESHOLD})`, () => {
    const belowThreshold = evaluateAlerts({
      database: healthyDb(),
      jobs: [freshJob({ consecutiveFailures: JOB_FAILURE_ALERT_THRESHOLD - 1, lastStatus: "error" })],
      requestMetrics: { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } },
      auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: 0 },
    });
    expect(belowThreshold.filter((a) => a.category === "scheduler.repeated_failure")).toHaveLength(0);

    const atThreshold = evaluateAlerts({
      database: healthyDb(),
      jobs: [freshJob({ consecutiveFailures: JOB_FAILURE_ALERT_THRESHOLD, lastStatus: "error", lastError: "boom" })],
      requestMetrics: { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } },
      auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: 0 },
    });
    expect(atThreshold).toHaveLength(1);
    expect(atThreshold[0]).toMatchObject({ category: "scheduler.repeated_failure", severity: "critical" });
    expect(atThreshold[0].message).toContain("boom");
  });

  it(`flags scheduler.stuck when a job hasn't run in over ${JOB_STALE_MULTIPLIER}x its expected interval`, () => {
    const staleJob = freshJob({
      job: "auto-execution", // must match a key in JOB_EXPECTED_INTERVAL_MS (60_000ms)
      lastRunAt: new Date(Date.now() - 60_000 * JOB_STALE_MULTIPLIER - 5_000).toISOString(),
    });
    const alerts = evaluateAlerts({
      database: healthyDb(),
      jobs: [staleJob],
      requestMetrics: { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } },
      auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: 0 },
    });
    expect(alerts.some((a) => a.category === "scheduler.stuck")).toBe(true);
  });

  it("never flags scheduler.stuck for a job that has never run (honestly excluded, not fabricated)", () => {
    const neverRun = freshJob({ job: "auto-execution", lastRunAt: null, lastStatus: "never_run", totalRuns: 0 });
    const alerts = evaluateAlerts({
      database: healthyDb(),
      jobs: [neverRun],
      requestMetrics: { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } },
      auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: 0 },
    });
    expect(alerts.some((a) => a.category === "scheduler.stuck")).toBe(false);
  });

  it("flags errors.elevated_5xx_rate only once the minimum sample size is reached", () => {
    const tooFewRequests = evaluateAlerts({
      database: healthyDb(),
      jobs: [],
      requestMetrics: { total: 5, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 5, other: 0 } }, // 100% but tiny sample
      auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: 0 },
    });
    expect(tooFewRequests.some((a) => a.category === "errors.elevated_5xx_rate")).toBe(false);

    const genuineSpike = evaluateAlerts({
      database: healthyDb(),
      jobs: [],
      requestMetrics: { total: 100, byStatusClass: { "2xx": 80, "3xx": 0, "4xx": 5, "5xx": 15, other: 0 } }, // 15%
      auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: 0 },
    });
    expect(genuineSpike.some((a) => a.category === "errors.elevated_5xx_rate")).toBe(true);
  });

  it(`flags guardrail.elevated_block_rate only once past the threshold (${GUARDRAIL_BLOCK_RATE_ALERT_THRESHOLD}/hour)`, () => {
    const below = evaluateAlerts({
      database: healthyDb(),
      jobs: [],
      requestMetrics: { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } },
      auditSignals: { guardrailBlocksLastHour: GUARDRAIL_BLOCK_RATE_ALERT_THRESHOLD, authFailuresLastHour: 0 },
    });
    expect(below.some((a) => a.category === "guardrail.elevated_block_rate")).toBe(false);

    const above = evaluateAlerts({
      database: healthyDb(),
      jobs: [],
      requestMetrics: { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } },
      auditSignals: { guardrailBlocksLastHour: GUARDRAIL_BLOCK_RATE_ALERT_THRESHOLD + 1, authFailuresLastHour: 0 },
    });
    expect(above.some((a) => a.category === "guardrail.elevated_block_rate")).toBe(true);
  });

  it(`flags auth.elevated_failure_rate only once past the threshold (${AUTH_FAILURE_RATE_ALERT_THRESHOLD}/hour)`, () => {
    const above = evaluateAlerts({
      database: healthyDb(),
      jobs: [],
      requestMetrics: { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } },
      auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: AUTH_FAILURE_RATE_ALERT_THRESHOLD + 1 },
    });
    expect(above.some((a) => a.category === "auth.elevated_failure_rate")).toBe(true);
  });
});

describe("computeAuditSignals", () => {
  const seededUserIds: string[] = [];

  it("counts real rows in auto_execution_log/platform_audit_log from at least a known baseline (before/after, never asserting an exact global total against shared tables)", async () => {
    // These tables are genuinely global/shared with every other concurrently-
    // running test file (auto_execution_log has no userId column at all, by
    // design), so this proves the count increases by AT LEAST the rows this
    // test itself inserts — the same discipline Sprint 44's
    // tradingRisk.route.test.ts established for this exact situation.
    const before = await computeAuditSignals();

    const [user] = await db
      .insert(usersTable)
      .values({ email: `sprint74-audit-${randomUUID()}@example.com`, displayName: "audit-signal-test" })
      .returning({ id: usersTable.id });
    seededUserIds.push(user.id);
    await db.insert(settingsTable).values({ userId: user.id });
    const [scanner] = await db
      .insert(scannerResultsTable)
      .values({ userId: user.id, symbol: "SPY", strategy: "iron_condor", ravishScore: 1 })
      .returning({ id: scannerResultsTable.id });

    await db.insert(autoExecutionLogTable).values({
      runId: randomUUID(),
      kind: "open",
      decision: "blocked",
      reason: "sprint74 test row",
      symbol: "SPY",
    });

    const after = await computeAuditSignals();
    expect(after.guardrailBlocksLastHour).toBeGreaterThanOrEqual(before.guardrailBlocksLastHour + 1);

    await db.delete(scannerResultsTable).where(eq(scannerResultsTable.id, scanner.id));
  });
});

describe("logAndPersistAlerts — edge-triggered incident persistence", () => {
  beforeEach(() => {
    resetSystemHealthForTest();
  });

  it("persists a genuinely NEW alert to platform_audit_log, but not the same alert firing again on the next tick", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);

    const alert = { category: "test.category-a", severity: "critical" as const, message: "test alert one" };
    const status1 = {
      status: "degraded" as const,
      timestamp: new Date().toISOString(),
      database: healthyDb(),
      jobs: [],
      requestMetrics: { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } },
      auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: 0, computedAt: null },
      alerts: [alert],
    };

    const before = await db
      .select()
      .from(platformAuditLogTable)
      .where(and(eq(platformAuditLogTable.eventType, "monitoring.alert")));

    await logAndPersistAlerts(status1);
    await logAndPersistAlerts(status1); // same alert, still active — should NOT persist a second row

    const after = await db
      .select()
      .from(platformAuditLogTable)
      .where(and(eq(platformAuditLogTable.eventType, "monitoring.alert")));

    expect(after.length).toBe(before.length + 1);
    errorSpy.mockRestore();
  });

  it("re-persists an alert once it resolves and later reoccurs", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined as never);

    // A unique message per test run (not just a unique category) — the
    // query below filters by `reason`, and repeated real invocations of
    // this test against the same persistent Postgres database would
    // otherwise accumulate rows under a fixed string across runs.
    const runId = randomUUID();
    const category = `test.category-reoccur-${runId}`;
    const message = `reoccurring test alert ${runId}`;
    const withAlert = {
      status: "degraded" as const,
      timestamp: new Date().toISOString(),
      database: healthyDb(),
      jobs: [],
      requestMetrics: { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } },
      auditSignals: { guardrailBlocksLastHour: 0, authFailuresLastHour: 0, computedAt: null },
      alerts: [{ category, severity: "warning" as const, message }],
    };
    const resolved = { ...withAlert, status: "ok" as const, alerts: [] };

    await logAndPersistAlerts(withAlert); // fires (new)
    await logAndPersistAlerts(resolved); // resolves
    await logAndPersistAlerts(withAlert); // fires again — should persist again since it dropped out in between

    const rows = await db
      .select()
      .from(platformAuditLogTable)
      .where(and(eq(platformAuditLogTable.eventType, "monitoring.alert"), eq(platformAuditLogTable.reason, message)));
    expect(rows.length).toBe(2);
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("runMonitoringCycle / buildLiveMonitoringStatus", () => {
  beforeEach(() => {
    resetSystemHealthForTest();
  });

  it("runMonitoringCycle refreshes the cached audit signals with a real computedAt timestamp", async () => {
    const status = await runMonitoringCycle();
    expect(status.auditSignals.computedAt).not.toBeNull();
    expect(status.database.connected).toBe(true);
    expect(["ok", "degraded"]).toContain(status.status);
  });

  it("buildLiveMonitoringStatus honestly reports auditSignals.computedAt as null before the first monitoring cycle has ever run", async () => {
    const status = await buildLiveMonitoringStatus();
    expect(status.auditSignals.computedAt).toBeNull();
    expect(status.auditSignals.guardrailBlocksLastHour).toBe(0);
  });

  it("buildLiveMonitoringStatus reflects live job health immediately, without waiting for the periodic cache", async () => {
    recordJobRun("live-test-job", { success: false, durationMs: 1, error: "immediate failure" });
    const status = await buildLiveMonitoringStatus();
    expect(status.jobs.some((j) => j.job === "live-test-job" && j.lastStatus === "error")).toBe(true);
  });
});

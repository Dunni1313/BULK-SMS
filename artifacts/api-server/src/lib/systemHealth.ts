// Phase 6, Sprint 74 — Monitoring, Alerting & Incident Runbook (approved
// Phase 6 plan, Sprint 74). Reuses the existing `pino` structured-logging
// foundation and the `platform_audit_log`/`auto_execution_log` tables as
// the observability substrate, per the plan's own explicit reuse guidance
// — no new monitoring service or dependency of any kind.
//
// This module tracks background-job health (auto-execution, auto-adjustment,
// alerts — see index.ts/lib/notifications.ts for where recordJobRun() is
// called from), checks database connectivity, derives two alert signals
// directly from already-existing tables (a guardrail-block-rate spike from
// auto_execution_log, an elevated auth-failure rate from platform_audit_log
// — the literal "turn passive records into active alerting signals" the
// plan calls for), and persists genuinely NEW alerts (edge-triggered, never
// re-persisted every tick while still active) via the already-existing
// recordAuditEvent() writer (Sprint 10) — no new table, no migration.
//
// Read-only with respect to autoExecution.ts/autoAdjustment.ts/execution.ts/
// optionsMath.ts/risk.ts — this file never imports, calls, or modifies any
// of them. Job-health recording is wired in from index.ts (the scheduler
// tick) and lib/notifications.ts (the alerts tick), neither of which is a
// protected file.
//
// Design note on live vs. cached data (see docs/Incident-Response-Runbook.md
// for the operator-facing version of this): database connectivity, job
// health, and the current request-metrics window are all cheap, in-memory
// or single-row checks — GET /monitoring/status recomputes them fresh on
// every call. auto_execution_log has no index beyond its primary key (by
// design — CLAUDE.md rule 3 forbids touching that table's schema as part of
// general audit-log work, so no new index was added), so the two audit-
// derived signals are computed only on the periodic 5-minute timer tick
// (matching lib/notifications.ts's own alerts-scheduler cadence) and cached;
// the live endpoint reads that cache and reports honestly when it isn't
// available yet (a fresh server start, before the first tick).

import { and, count, eq, gte, sql } from "drizzle-orm";
import { db, autoExecutionLogTable, platformAuditLogTable, recordAuditEvent } from "@workspace/db";
import { logger } from "./logger.js";
import { getCurrentWindowSnapshot, type WindowCounts } from "./requestMetrics.js";

// ─── Job health ──────────────────────────────────────────────────────────

export interface JobHealth {
  job: string;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastStatus: "ok" | "error" | "never_run";
  lastError: string | null;
  consecutiveFailures: number;
  totalRuns: number;
  totalFailures: number;
}

const jobHealth = new Map<string, JobHealth>();

function freshJobHealth(job: string): JobHealth {
  return {
    job,
    lastRunAt: null,
    lastDurationMs: null,
    lastStatus: "never_run",
    lastError: null,
    consecutiveFailures: 0,
    totalRuns: 0,
    totalFailures: 0,
  };
}

// Called by index.ts's scheduler tick and lib/notifications.ts's alerts
// tick, wrapping their own existing calls — never changes what those calls
// do, only observes their outcome.
export function recordJobRun(
  job: string,
  outcome: { success: boolean; durationMs: number; error?: string },
): void {
  const existing = jobHealth.get(job) ?? freshJobHealth(job);
  existing.lastRunAt = new Date().toISOString();
  existing.lastDurationMs = outcome.durationMs;
  existing.lastStatus = outcome.success ? "ok" : "error";
  existing.lastError = outcome.success ? null : (outcome.error ?? "Unknown error");
  existing.totalRuns += 1;
  if (outcome.success) {
    existing.consecutiveFailures = 0;
  } else {
    existing.totalFailures += 1;
    existing.consecutiveFailures += 1;
  }
  jobHealth.set(job, existing);
}

export function getJobHealthSnapshot(): JobHealth[] {
  return Array.from(jobHealth.values()).map((j) => ({ ...j }));
}

// The interval each tracked job is expected to run at — a job whose
// lastRunAt is older than JOB_STALE_MULTIPLIER times its own interval (and
// which HAS run at least once) is flagged as possibly stuck. Named,
// documented starting defaults; tune with real production traffic data,
// matching Sprint 52's own measured-baseline precedent for rateLimit.ts.
export const JOB_EXPECTED_INTERVAL_MS: Record<string, number> = {
  "auto-execution": 60_000,
  "auto-adjustment": 60_000,
  alerts: 5 * 60_000,
};
export const JOB_STALE_MULTIPLIER = 2;
export const JOB_FAILURE_ALERT_THRESHOLD = 3;

// ─── Database connectivity ───────────────────────────────────────────────

export interface DbHealthCheck {
  connected: boolean;
  latencyMs: number | null;
  error: string | null;
}

export async function checkDatabaseConnectivity(): Promise<DbHealthCheck> {
  const start = performance.now();
  try {
    await db.execute(sql`select 1`);
    return { connected: true, latencyMs: Math.round(performance.now() - start), error: null };
  } catch (err) {
    return {
      connected: false,
      latencyMs: null,
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}

// ─── Audit-log-derived signals ───────────────────────────────────────────
// Turns the two already-existing tables into active alerting signals, per
// the plan's own explicit framing — never a new table, never a new write
// site on the hot path of either engine.

export interface AuditSignalCounts {
  guardrailBlocksLastHour: number;
  authFailuresLastHour: number;
}

export const GUARDRAIL_BLOCK_RATE_ALERT_THRESHOLD = 20; // blocked decisions/hour
export const AUTH_FAILURE_RATE_ALERT_THRESHOLD = 10; // auth.login_failed events/hour

// Deliberately queried only from the periodic timer tick (runMonitoringCycle),
// never from the live HTTP endpoint — auto_execution_log has no index beyond
// its primary key (CLAUDE.md rule 3: never modify that table's schema as
// part of general audit-log work), so this stays off the per-request path.
export async function computeAuditSignals(): Promise<AuditSignalCounts> {
  const oneHourAgo = new Date(Date.now() - 60 * 60_000);

  const [blockedRow] = await db
    .select({ n: count() })
    .from(autoExecutionLogTable)
    .where(and(eq(autoExecutionLogTable.decision, "blocked"), gte(autoExecutionLogTable.createdAt, oneHourAgo)));

  const [authFailRow] = await db
    .select({ n: count() })
    .from(platformAuditLogTable)
    .where(and(eq(platformAuditLogTable.eventType, "auth.login_failed"), gte(platformAuditLogTable.createdAt, oneHourAgo)));

  return {
    guardrailBlocksLastHour: blockedRow?.n ?? 0,
    authFailuresLastHour: authFailRow?.n ?? 0,
  };
}

export interface AuditSignals extends AuditSignalCounts {
  computedAt: string | null;
}

let cachedAuditSignals: AuditSignals = {
  guardrailBlocksLastHour: 0,
  authFailuresLastHour: 0,
  computedAt: null,
};

export function getCachedAuditSignals(): AuditSignals {
  return { ...cachedAuditSignals };
}

// ─── Alert evaluation (pure) ──────────────────────────────────────────────

export interface MonitoringAlert {
  category: string;
  severity: "warning" | "critical";
  message: string;
}

export function evaluateAlerts(input: {
  database: DbHealthCheck;
  jobs: JobHealth[];
  requestMetrics: WindowCounts;
  auditSignals: AuditSignalCounts;
}): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];

  if (!input.database.connected) {
    alerts.push({
      category: "database.unreachable",
      severity: "critical",
      message: `Database connectivity check failed: ${input.database.error ?? "unknown error"}`,
    });
  }

  for (const job of input.jobs) {
    if (job.consecutiveFailures >= JOB_FAILURE_ALERT_THRESHOLD) {
      alerts.push({
        category: "scheduler.repeated_failure",
        severity: "critical",
        message: `Job "${job.job}" has failed ${job.consecutiveFailures} times in a row (last error: ${job.lastError ?? "unknown"})`,
      });
    }
    const expectedIntervalMs = JOB_EXPECTED_INTERVAL_MS[job.job];
    if (job.lastRunAt && expectedIntervalMs) {
      const ageMs = Date.now() - new Date(job.lastRunAt).getTime();
      if (ageMs > expectedIntervalMs * JOB_STALE_MULTIPLIER) {
        alerts.push({
          category: "scheduler.stuck",
          severity: "critical",
          message: `Job "${job.job}" last ran ${Math.round(ageMs / 1000)}s ago, expected every ${Math.round(expectedIntervalMs / 1000)}s`,
        });
      }
    }
  }

  const ELEVATED_5XX_RATE_THRESHOLD = 0.1; // 10%
  const ELEVATED_5XX_MIN_SAMPLE = 20; // avoid false positives on tiny traffic
  if (input.requestMetrics.total >= ELEVATED_5XX_MIN_SAMPLE) {
    const rate = input.requestMetrics.byStatusClass["5xx"] / input.requestMetrics.total;
    if (rate > ELEVATED_5XX_RATE_THRESHOLD) {
      alerts.push({
        category: "errors.elevated_5xx_rate",
        severity: "warning",
        message: `5xx response rate is ${(rate * 100).toFixed(1)}% over the current request window (${input.requestMetrics.byStatusClass["5xx"]}/${input.requestMetrics.total})`,
      });
    }
  }

  if (input.auditSignals.guardrailBlocksLastHour > GUARDRAIL_BLOCK_RATE_ALERT_THRESHOLD) {
    alerts.push({
      category: "guardrail.elevated_block_rate",
      severity: "warning",
      message: `${input.auditSignals.guardrailBlocksLastHour} auto-execution/adjustment cycles were blocked by a guardrail in the last hour`,
    });
  }

  if (input.auditSignals.authFailuresLastHour > AUTH_FAILURE_RATE_ALERT_THRESHOLD) {
    alerts.push({
      category: "auth.elevated_failure_rate",
      severity: "warning",
      message: `${input.auditSignals.authFailuresLastHour} failed login attempts in the last hour`,
    });
  }

  return alerts;
}

// ─── Full status (live and cached-audit-signal variants) ─────────────────

export interface MonitoringStatus {
  status: "ok" | "degraded";
  timestamp: string;
  database: DbHealthCheck;
  jobs: JobHealth[];
  requestMetrics: WindowCounts;
  auditSignals: AuditSignals;
  alerts: MonitoringAlert[];
}

async function computeStatus(auditSignals: AuditSignals): Promise<MonitoringStatus> {
  const database = await checkDatabaseConnectivity();
  const jobs = getJobHealthSnapshot();
  const requestMetrics = getCurrentWindowSnapshot();
  const alerts = evaluateAlerts({ database, jobs, requestMetrics, auditSignals });
  return {
    status: alerts.length > 0 ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
    database,
    jobs,
    requestMetrics,
    auditSignals,
    alerts,
  };
}

// Called only by the periodic timer (startMonitoringTimer) — refreshes the
// audit-signal cache (the one genuinely non-cheap part of this module) and
// returns a full status snapshot for logAndPersistAlerts to act on.
export async function runMonitoringCycle(): Promise<MonitoringStatus> {
  const raw = await computeAuditSignals();
  cachedAuditSignals = { ...raw, computedAt: new Date().toISOString() };
  return computeStatus(cachedAuditSignals);
}

// Called by GET /monitoring/status — never triggers the audit-log scan
// itself, reads whatever the periodic timer last cached (honestly null
// before the first tick, never fabricated).
export async function buildLiveMonitoringStatus(): Promise<MonitoringStatus> {
  return computeStatus(getCachedAuditSignals());
}

// ─── Incident logging (edge-triggered) ────────────────────────────────────
// A genuinely NEW alert (one whose category wasn't active on the previous
// tick) is logged at warn/error AND persisted to platform_audit_log via the
// already-existing recordAuditEvent() writer — best-effort, matching that
// writer's own established non-throwing philosophy. An alert that's STILL
// active on a later tick is logged again (cheap, expected) but not
// re-persisted, avoiding unbounded audit-log growth for a condition that
// simply hasn't resolved yet. Once a category drops out of the alert list,
// its next reoccurrence is treated as new again.
let previouslyActiveCategories = new Set<string>();

export async function logAndPersistAlerts(status: MonitoringStatus): Promise<void> {
  const currentCategories = new Set(status.alerts.map((a) => a.category));

  for (const alert of status.alerts) {
    const level = alert.severity === "critical" ? "error" : "warn";
    logger[level]({ category: alert.category, severity: alert.severity }, alert.message);

    if (!previouslyActiveCategories.has(alert.category)) {
      await recordAuditEvent(
        {
          engine: "platform",
          eventType: "monitoring.alert",
          action: "detected",
          result: alert.severity === "critical" ? "failure" : "blocked",
          reason: alert.message,
          metadata: { category: alert.category, severity: alert.severity },
        },
        (err) => logger.error({ err, category: alert.category }, "Failed to persist monitoring alert to audit log"),
      );
    }
  }

  previouslyActiveCategories = currentCategories;
}

// ─── Periodic timer ────────────────────────────────────────────────────────
// Same "real entrypoint only, never app.ts, unref'd, idempotent" shape as
// lib/requestMetrics.ts's startRequestMetricsTimer() / lib/notifications.ts's
// startAlertsScheduler() — so the ~1,000+ existing tests that import app.js
// directly never accumulate a real setInterval.
const MONITORING_INTERVAL_MS = 5 * 60_000;
let monitoringTimer: NodeJS.Timeout | null = null;

export function startMonitoringTimer(): void {
  if (monitoringTimer) return;
  monitoringTimer = setInterval(() => {
    runMonitoringCycle()
      .then((status) => logAndPersistAlerts(status))
      .catch((err) => {
        logger.error({ err }, "Monitoring cycle tick failed");
      });
  }, MONITORING_INTERVAL_MS);
  monitoringTimer.unref();
}

export function stopMonitoringTimer(): void {
  if (monitoringTimer) {
    clearInterval(monitoringTimer);
    monitoringTimer = null;
  }
}

// Exported for tests only — resets all in-memory state between test cases.
export function resetSystemHealthForTest(): void {
  jobHealth.clear();
  cachedAuditSignals = { guardrailBlocksLastHour: 0, authFailuresLastHour: 0, computedAt: null };
  previouslyActiveCategories = new Set();
}

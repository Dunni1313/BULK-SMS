import app from "./app";
import { logger } from "./lib/logger";
import { runAutoExecutionCycleForAllUsers } from "./lib/autoExecution";
import { runAutoAdjustmentCycleForAllUsers } from "./lib/autoAdjustment";
import { startRequestMetricsTimer } from "./lib/requestMetrics";
import { startAlertsScheduler } from "./lib/notifications";
import { recordJobRun, startMonitoringTimer } from "./lib/systemHealth";

// Phase 6 — full-auto scheduler. Fires on an interval but is a guaranteed no-op
// unless mode=full_auto AND the master switch is armed (the cycle itself enforces
// every guardrail and the kill switch). Failures are logged and swallowed so the
// scheduler never crashes the server.
//
// Phase 1, Sprint 8 — each tick now runs one cycle PER armed user (see
// runAutoExecutionCycleForAllUsers/runAutoAdjustmentCycleForAllUsers) instead of
// one global cycle, since the kill switch and every guardrail are per-user as of
// Sprint 5's settings migration. A user with both switches off is simply never
// iterated — their positions are untouched, regardless of what any other user's
// cycle does.
const AUTO_CYCLE_INTERVAL_MS = 60_000;

function startAutoScheduler(): void {
  const tick = async (): Promise<void> => {
    // Phase 6, Sprint 74 — recordJobRun() is pure observation: it times and
    // records the outcome of the exact same call already made below, and
    // never changes what that call does or its return value.
    const execStart = performance.now();
    try {
      const results = await runAutoExecutionCycleForAllUsers();
      for (const result of results) {
        if (!result.blocked && result.scanned > 0) {
          logger.info(
            {
              runId: result.runId,
              executed: result.executed,
              skipped: result.skipped,
              rejected: result.rejected,
            },
            "Auto-execution cycle ran",
          );
        }
      }
      recordJobRun("auto-execution", { success: true, durationMs: performance.now() - execStart });
    } catch (err) {
      logger.error({ err }, "Auto-execution scheduler tick failed");
      recordJobRun("auto-execution", {
        success: false,
        durationMs: performance.now() - execStart,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }

    // Task #20 — auto-adjustment cycle. Same no-op-unless-armed contract (gated on
    // mode=full_auto AND the auto-adjust switch); only ever de-risks open trades.
    const adjStart = performance.now();
    try {
      const adjResults = await runAutoAdjustmentCycleForAllUsers();
      for (const adj of adjResults) {
        if (!adj.blocked && adj.executed > 0) {
          logger.info(
            { runId: adj.runId, executed: adj.executed, skipped: adj.skipped },
            "Auto-adjustment cycle ran",
          );
        }
      }
      recordJobRun("auto-adjustment", { success: true, durationMs: performance.now() - adjStart });
    } catch (err) {
      logger.error({ err }, "Auto-adjustment scheduler tick failed");
      recordJobRun("auto-adjustment", {
        success: false,
        durationMs: performance.now() - adjStart,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };
  const timer = setInterval(() => void tick(), AUTO_CYCLE_INTERVAL_MS);
  timer.unref();
  logger.info({ intervalMs: AUTO_CYCLE_INTERVAL_MS }, "Auto-execution scheduler started");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Phase 9 — Production Readiness. A last-resort safety net: without
// these, an error thrown outside any Express request handler (e.g. from
// inside the auto-execution/monitoring timers' own `void tick()` calls,
// though both already try/catch internally, or from a truly unexpected
// source) would otherwise crash the process silently or with no log
// line at all. Logs via the same pino logger every other line already
// goes through, then exits — letting the process manager (systemd,
// Docker, etc.) restart a clean instance rather than continuing to run
// in a possibly-corrupted state. Registered only from this real
// entrypoint, matching every other "real entrypoint only" timer above,
// so importing app.js directly in the ~90+ existing test files never
// registers a second, competing process-level handler.
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — exiting");
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection — exiting");
  process.exit(1);
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startAutoScheduler();
  // Phase 4, Sprint 52 — started only from the real server entrypoint, not
  // app.ts itself, so the ~90+ existing test files that import app.js
  // directly never accumulate a real setInterval (see
  // lib/requestMetrics.ts's own doc comment).
  startRequestMetricsTimer();
  // Phase 4, Sprint 56 — same "real entrypoint only" precedent as
  // startRequestMetricsTimer above. Wholly independent of
  // startAutoScheduler's own auto-execution/auto-adjustment cycles above —
  // never touches trades, the kill switch, or autoExecutionLog.
  startAlertsScheduler();
  // Phase 6, Sprint 74 — same "real entrypoint only" precedent as the two
  // timers above. Wholly independent of every engine's own logic; only
  // observes job outcomes recorded via recordJobRun() and periodically
  // evaluates already-existing tables for alert-worthy conditions.
  startMonitoringTimer();
});

import app from "./app";
import { logger } from "./lib/logger";
import { runAutoExecutionCycleForAllUsers } from "./lib/autoExecution";
import { runAutoAdjustmentCycleForAllUsers } from "./lib/autoAdjustment";
import { startRequestMetricsTimer } from "./lib/requestMetrics";
import { startAlertsScheduler } from "./lib/notifications";

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
    } catch (err) {
      logger.error({ err }, "Auto-execution scheduler tick failed");
    }

    // Task #20 — auto-adjustment cycle. Same no-op-unless-armed contract (gated on
    // mode=full_auto AND the auto-adjust switch); only ever de-risks open trades.
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
    } catch (err) {
      logger.error({ err }, "Auto-adjustment scheduler tick failed");
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
});

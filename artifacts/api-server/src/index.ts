import app from "./app";
import { logger } from "./lib/logger";
import { runAutoExecutionCycle } from "./lib/autoExecution";
import { runAutoAdjustmentCycle } from "./lib/autoAdjustment";

// Phase 6 — full-auto scheduler. Fires on an interval but is a guaranteed no-op
// unless mode=full_auto AND the master switch is armed (the cycle itself enforces
// every guardrail and the kill switch). Failures are logged and swallowed so the
// scheduler never crashes the server.
const AUTO_CYCLE_INTERVAL_MS = 60_000;

function startAutoScheduler(): void {
  const tick = async (): Promise<void> => {
    try {
      const result = await runAutoExecutionCycle();
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
    } catch (err) {
      logger.error({ err }, "Auto-execution scheduler tick failed");
    }

    // Task #20 — auto-adjustment cycle. Same no-op-unless-armed contract (gated on
    // mode=full_auto AND the auto-adjust switch); only ever de-risks open trades.
    try {
      const adj = await runAutoAdjustmentCycle();
      if (!adj.blocked && adj.executed > 0) {
        logger.info(
          { runId: adj.runId, executed: adj.executed, skipped: adj.skipped },
          "Auto-adjustment cycle ran",
        );
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
});

// Phase 4, Sprint 52 — Platform Hardening (approved Phase 4 plan, Sprint 52;
// see docs/Phase-4-Master-Execution-Plan.md's Sprint 52 as-built note).
//
// The "request-volume baseline" the plan requires before setting any rate-
// limit threshold — structured log counters, not a new dependency (pino,
// already in use, is the only thing this writes to). A lightweight
// in-memory counter, reset every REQUEST_METRICS_WINDOW_MS, logging a
// structured snapshot of request volume (total + per-status-code) so an
// operator watching production logs has real traffic data to inform future
// threshold tuning — this is the *ongoing* baseline capability; Sprint 52's
// own initial threshold values (see middlewares/rateLimit.ts) were set from
// a real, measured number: the busiest single existing test file makes 23
// HTTP requests against one server instance in a run (grep-counted across
// every routes/*.route.test.ts and lib/*.test.ts file before this sprint's
// implementation began), giving genuine headroom margin rather than a
// guessed default.
//
// Deliberately NOT a new metrics/APM dependency (Prometheus, OpenTelemetry,
// etc.) — the Phase 4 plan's own §11 recommendation was explicit: "a
// lightweight request-volume baseline... structured log counters, not a
// new dependency."

import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

export const REQUEST_METRICS_WINDOW_MS = 5 * 60_000; // 5 minutes

export interface WindowCounts {
  total: number;
  byStatusClass: Record<"2xx" | "3xx" | "4xx" | "5xx" | "other", number>;
}

function freshCounts(): WindowCounts {
  return { total: 0, byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 } };
}

let counts = freshCounts();
let windowStartedAt = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function statusClass(statusCode: number): keyof WindowCounts["byStatusClass"] {
  if (statusCode >= 200 && statusCode < 300) return "2xx";
  if (statusCode >= 300 && statusCode < 400) return "3xx";
  if (statusCode >= 400 && statusCode < 500) return "4xx";
  if (statusCode >= 500 && statusCode < 600) return "5xx";
  return "other";
}

// Exported for tests — proves the counting logic directly without waiting
// on a real interval tick.
export function recordRequest(statusCode: number): void {
  counts.total += 1;
  counts.byStatusClass[statusClass(statusCode)] += 1;
}

export function requestMetrics(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    recordRequest(res.statusCode);
  });
  next();
}

// Phase 6, Sprint 74 — a read-only snapshot of the CURRENT (not-yet-flushed)
// window, for lib/systemHealth.ts's live status endpoint. Deliberately never
// resets or logs anything itself — that stays flushRequestMetricsWindow's own
// job on its own 5-minute cadence.
export function getCurrentWindowSnapshot(): WindowCounts {
  return { total: counts.total, byStatusClass: { ...counts.byStatusClass } };
}

// Exported for tests — logs and resets the current window without waiting
// on the real interval.
export function flushRequestMetricsWindow(): void {
  const elapsedMs = Date.now() - windowStartedAt;
  if (counts.total > 0) {
    logger.info({ elapsedMs, ...counts }, "request volume snapshot");
  }
  counts = freshCounts();
  windowStartedAt = Date.now();
}

// Started once by app.ts (production/dev only — see startRequestMetricsTimer's
// own call site) so tests never have a dangling interval keeping the process
// alive.
export function startRequestMetricsTimer(): void {
  if (timer) return;
  timer = setInterval(flushRequestMetricsWindow, REQUEST_METRICS_WINDOW_MS);
  timer.unref();
}

export function stopRequestMetricsTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// Exported for tests only — resets in-memory state between test cases.
export function resetRequestMetricsForTest(): void {
  counts = freshCounts();
  windowStartedAt = Date.now();
}

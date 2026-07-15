// Phase 6, Sprint 73 — Load & Chaos Testing: Automation Scheduler.
//
// A small, dependency-free helper module for the load/chaos test suite —
// per the approved tooling decision (AskUserQuestion, this sprint's own
// kickoff), no external load-testing tool (k6/Artillery) was introduced.
// Every load/chaos scenario in this sprint is a plain Vitest test file
// that fans work out with Promise.allSettled and measures wall-clock
// latency with these pure helpers — the same "reuse existing testing
// infrastructure" discipline every prior Phase 6 sprint followed.
//
// This file is a testing UTILITY, not application runtime logic — it is
// never imported by any route, scheduler, or other production code path.

export interface ConcurrentRunResult<T> {
  /** One entry per task, in call order (not completion order). */
  outcomes: PromiseSettledResult<T>[];
  /** Wall-clock latency of each individual task, in call order. */
  latenciesMs: number[];
  /** Wall-clock time for the whole batch to settle. */
  totalMs: number;
}

/**
 * Runs `count` invocations of `fn` concurrently (fired together via
 * Promise.allSettled, never serialized), timing each one individually.
 * Never throws — a rejected task is captured in `outcomes`, not propagated,
 * so a single failure never aborts the rest of the batch.
 */
export async function runConcurrent<T>(
  count: number,
  fn: (index: number) => Promise<T>,
): Promise<ConcurrentRunResult<T>> {
  const latenciesMs: number[] = new Array(count).fill(0);
  const start = performance.now();
  const outcomes = await Promise.allSettled(
    Array.from({ length: count }, async (_, i) => {
      const taskStart = performance.now();
      try {
        return await fn(i);
      } finally {
        latenciesMs[i] = performance.now() - taskStart;
      }
    }),
  );
  const totalMs = performance.now() - start;
  return { outcomes, latenciesMs, totalMs };
}

export interface LatencySummary {
  count: number;
  minMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

/** Nearest-rank percentile — simple and sufficient for this sprint's
 * informational (not SLA-enforcing) latency reporting. */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, rank)];
}

export function summarizeLatencies(latenciesMs: number[]): LatencySummary {
  if (latenciesMs.length === 0) {
    return { count: 0, minMs: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  }
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count: sorted.length,
    minMs: sorted[0],
    avgMs: sum / sorted.length,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    maxMs: sorted[sorted.length - 1],
  };
}

export function successCount<T>(outcomes: PromiseSettledResult<T>[]): number {
  return outcomes.filter((o) => o.status === "fulfilled").length;
}

export function rejectionReasons<T>(outcomes: PromiseSettledResult<T>[]): unknown[] {
  return outcomes.filter((o): o is PromiseRejectedResult => o.status === "rejected").map((o) => o.reason);
}

// Phase 6, Sprint 73 — unit tests for the load/chaos test harness's own
// pure helper math (concurrency fan-out, percentile/summary calculation).
import { describe, it, expect } from "vitest";
import { runConcurrent, percentile, summarizeLatencies, successCount, rejectionReasons } from "./loadTestHarness.js";

describe("runConcurrent", () => {
  it("runs every task concurrently, not serially", async () => {
    const DELAY_MS = 40;
    const { totalMs, outcomes } = await runConcurrent(10, async () => {
      await new Promise((r) => setTimeout(r, DELAY_MS));
      return "ok";
    });
    // If these ran serially, 10 * 40ms = 400ms+. Concurrently, it should stay
    // well under that even accounting for scheduling jitter in a busy sandbox.
    expect(totalMs).toBeLessThan(DELAY_MS * 5);
    expect(successCount(outcomes)).toBe(10);
  });

  it("captures a rejection per-task without aborting the rest of the batch", async () => {
    const { outcomes, latenciesMs } = await runConcurrent(5, async (i) => {
      if (i === 2) throw new Error("boom");
      return i;
    });
    expect(successCount(outcomes)).toBe(4);
    expect(rejectionReasons(outcomes)).toHaveLength(1);
    expect((rejectionReasons(outcomes)[0] as Error).message).toBe("boom");
    expect(latenciesMs).toHaveLength(5);
    expect(latenciesMs.every((ms) => ms >= 0)).toBe(true);
  });

  it("preserves call order in the outcomes array (not completion order)", async () => {
    const { outcomes } = await runConcurrent(4, async (i) => {
      // Deliberately resolve out of order: task 0 is slowest, task 3 fastest.
      await new Promise((r) => setTimeout(r, (4 - i) * 5));
      return i;
    });
    const values = outcomes.map((o) => (o.status === "fulfilled" ? o.value : null));
    expect(values).toEqual([0, 1, 2, 3]);
  });
});

describe("percentile", () => {
  it("returns 0 for an empty array", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("returns the exact value for a single-element array at any percentile", () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 99)).toBe(42);
  });

  it("computes p50/p95/p99 via nearest-rank on a known sorted array", () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(95);
    expect(percentile(sorted, 99)).toBe(99);
    expect(percentile(sorted, 100)).toBe(100);
  });
});

describe("summarizeLatencies", () => {
  it("honestly reports all-zero for an empty input, never a fabricated figure", () => {
    expect(summarizeLatencies([])).toEqual({
      count: 0,
      minMs: 0,
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
    });
  });

  it("computes min/avg/max correctly regardless of input order", () => {
    const summary = summarizeLatencies([30, 10, 20]);
    expect(summary.count).toBe(3);
    expect(summary.minMs).toBe(10);
    expect(summary.maxMs).toBe(30);
    expect(summary.avgMs).toBe(20);
  });
});

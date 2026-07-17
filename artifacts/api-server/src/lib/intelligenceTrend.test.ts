// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Pure unit coverage of computeTrend(), the single shared
// trend-comparison primitive reused by the Observation, Health, and
// Timeline Engines. No database, no network — a plain comparison of two
// already-known numbers.

import { describe, it, expect } from "vitest";
import { computeTrend, DEFAULT_TREND_THRESHOLD_PCT } from "./intelligenceTrend.js";

describe("computeTrend", () => {
  it("reports insufficient_history when there is no prior value, never fabricating a trend", () => {
    const result = computeTrend(75, null);
    expect(result.direction).toBe("insufficient_history");
    expect(result.priorValue).toBeNull();
    expect(result.changeAbs).toBeNull();
    expect(result.changePct).toBeNull();
  });

  it("reports stable when the change is smaller than the disclosed threshold", () => {
    const result = computeTrend(100, 99, DEFAULT_TREND_THRESHOLD_PCT);
    expect(result.direction).toBe("stable");
    expect(result.changeAbs).toBe(1);
  });

  it("reports improving when the value rises beyond the threshold", () => {
    const result = computeTrend(120, 100, DEFAULT_TREND_THRESHOLD_PCT);
    expect(result.direction).toBe("improving");
    expect(result.changeAbs).toBe(20);
    expect(result.changePct).toBe(20);
  });

  it("reports declining when the value falls beyond the threshold", () => {
    const result = computeTrend(80, 100, DEFAULT_TREND_THRESHOLD_PCT);
    expect(result.direction).toBe("declining");
    expect(result.changeAbs).toBe(-20);
    expect(result.changePct).toBe(-20);
  });

  it("honors a custom threshold, treating a change below it as stable", () => {
    const result = computeTrend(105, 100, 10);
    expect(result.direction).toBe("stable");
  });

  it("honors a custom threshold, treating a change at or above it as a real trend", () => {
    const result = computeTrend(112, 100, 10);
    expect(result.direction).toBe("improving");
  });

  it("falls back to the absolute change (never a divide-by-zero fabrication) when the prior value is exactly zero", () => {
    const result = computeTrend(5, 0, DEFAULT_TREND_THRESHOLD_PCT);
    expect(result.changePct).toBeNull();
    expect(result.changeAbs).toBe(5);
    expect(result.direction).toBe("improving");
  });

  it("a zero prior value with a change smaller than the absolute threshold is honestly stable", () => {
    const result = computeTrend(1, 0, DEFAULT_TREND_THRESHOLD_PCT);
    expect(result.direction).toBe("stable");
  });

  it("is a pure function — repeated calls with the same inputs produce the same result", () => {
    const a = computeTrend(55, 40);
    const b = computeTrend(55, 40);
    expect(a).toEqual(b);
  });
});

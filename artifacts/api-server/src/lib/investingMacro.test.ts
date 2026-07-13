// Phase 2, Sprint 26 — Tom Nash Investment Engine, Enhancement II. Unit tests
// for the new self-contained SIMULATED macro/interest-rate regime proxy.

import { describe, it, expect } from "vitest";
import { buildMacroContext } from "./investingMacro.js";

describe("buildMacroContext", () => {
  it("is deterministic — the same date always produces the same regime and trend", () => {
    const a = buildMacroContext("2026-03-15");
    const b = buildMacroContext("2026-03-15");
    expect(a).toEqual(b);
  });

  it("differs across dates (seeded per-date, not a single global value)", () => {
    const a = buildMacroContext("2026-01-01");
    const b = buildMacroContext("2026-06-15");
    expect(a.regime !== b.regime || a.rateTrendPct !== b.rateTrendPct).toBe(true);
  });

  it("is always clearly labeled SIMULATED, never a real forecast", () => {
    const ctx = buildMacroContext("2026-03-15");
    expect(ctx.dataSource).toBe("SIMULATED");
    expect(ctx.summary).toMatch(/SIMULATED/);
    expect(ctx.summary).toMatch(/never a real forecast/i);
  });

  it("rateTrendPct is positive for rising_rates and negative for falling_rates", () => {
    // Scan a range of distinct dates to exercise both regime branches deterministically.
    let sawRising = false;
    let sawFalling = false;
    for (let day = 1; day <= 28; day++) {
      const ctx = buildMacroContext(`2026-01-${String(day).padStart(2, "0")}`);
      if (ctx.regime === "rising_rates") {
        expect(ctx.rateTrendPct).toBeGreaterThan(0);
        sawRising = true;
      } else if (ctx.regime === "falling_rates") {
        expect(ctx.rateTrendPct).toBeLessThan(0);
        sawFalling = true;
      } else {
        expect(Math.abs(ctx.rateTrendPct)).toBeLessThanOrEqual(0.0005);
      }
    }
    expect(sawRising).toBe(true);
    expect(sawFalling).toBe(true);
  });

  it("carries the requested asOf date and a human-readable regime label", () => {
    const ctx = buildMacroContext("2026-03-15");
    expect(ctx.asOf).toBe("2026-03-15");
    expect(["Rising-Rate Environment", "Falling-Rate Environment", "Stable-Rate Environment"]).toContain(ctx.regimeLabel);
  });

  it("never claims to fabricate or execute anything", () => {
    const ctx = buildMacroContext("2026-03-15");
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toContain("order");
    expect(serialized).not.toContain("execute");
  });
});

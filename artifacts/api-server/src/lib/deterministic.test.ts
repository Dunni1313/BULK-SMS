// Phase 2, Sprint 11 — regression coverage for the RNG/date helpers extracted
// from optionsMath.ts into their own engine-agnostic module (approved Phase 2
// plan, Sprint 11 "Universe Decoupling"). These tests lock in the exact
// determinism guarantee every simulated-data engine (options income and now
// investing) depends on: same seed in, same sequence out, forever.

import { describe, it, expect } from "vitest";
import { makeRng, todayStr } from "./deterministic.js";

describe("makeRng", () => {
  it("is deterministic: the same seed always produces the same sequence", () => {
    const a = makeRng("AAPL|2026-01-15");
    const b = makeRng("AAPL|2026-01-15");
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = makeRng("AAPL|2026-01-15");
    const b = makeRng("MSFT|2026-01-15");
    expect(a()).not.toBe(b());
  });

  it("always returns values in [0, 1)", () => {
    const rng = makeRng("some-seed");
    for (let i = 0; i < 50; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("todayStr", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(todayStr(new Date("2026-07-12T18:30:00.000Z"))).toBe("2026-07-12");
  });

  it("defaults to the current date when no argument is given", () => {
    const result = todayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

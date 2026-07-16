// Phase 2, Sprint 11 — pure, engine-agnostic deterministic helpers shared by
// every simulated-data engine in this codebase (options income, investing, and
// any future engine). Moved out of optionsMath.ts so the Investing Engine's
// simulated data no longer needs to import anything from the options engine —
// per the Architecture Blueprint, engines must never depend on each other's
// internals. optionsMath.ts re-exports these unchanged so every existing
// caller (scanner, execution, adjustment, etc.) is unaffected.

function hashStr(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: string): () => number {
  return mulberry32(hashStr(seed));
}

export function todayStr(date = new Date()): string {
  return date.toISOString().split("T")[0];
}

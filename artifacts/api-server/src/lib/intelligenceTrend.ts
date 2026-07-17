// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). A single, shared trend-comparison primitive reused by the
// Observation Engine, the Health Engine, and the Timeline Engine — so
// "is this figure improving, declining, or stable" is computed exactly
// once, never re-derived independently by each engine (the same
// "don't duplicate calculations" discipline this sprint's own
// instructions require applied *within* this sprint's own new code, not
// just against pre-existing modules).
//
// This is deliberately NOT a statistical model or a forecast — it is a
// plain comparison of two already-known numbers (today's already-
// computed figure vs. the most recently recorded prior snapshot's own
// already-computed figure), banded against a small, disclosed,
// percentage-point threshold. There is no fitting, no regression, no
// probability estimate — the exact same "simple, transparent threshold
// derivation over an already-computed figure" precedent this codebase
// has followed since Position Sizing's own
// BUYING_POWER_EXHAUSTION_THRESHOLD_PCT.

export type TrendDirection = "improving" | "declining" | "stable" | "insufficient_history";

export interface TrendResult {
  direction: TrendDirection;
  currentValue: number;
  priorValue: number | null;
  changeAbs: number | null;
  changePct: number | null;
}

// Named, disclosed default — a change smaller than this (as a % of the
// prior value, or as an absolute point difference for already-0-100-
// bounded scores) is treated as noise, not a genuine trend, avoiding a
// false "improving"/"declining" claim over an immaterial fluctuation.
export const DEFAULT_TREND_THRESHOLD_PCT = 2;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// `higherIsBetter` only affects nothing here — direction is always
// reported in terms of the RAW value's own movement ("improving" =
// value went up, "declining" = value went down). Callers building an
// observation/health interpretation decide whether "up" is good or bad
// for that particular metric (e.g. a rising Health Score is good, a
// rising Concentration score is not) — kept as a pure, unopinionated
// numeric comparison here, not a value judgment.
export function computeTrend(
  currentValue: number,
  priorValue: number | null,
  thresholdPct: number = DEFAULT_TREND_THRESHOLD_PCT,
): TrendResult {
  if (priorValue === null) {
    return { direction: "insufficient_history", currentValue, priorValue: null, changeAbs: null, changePct: null };
  }
  const changeAbs = round2(currentValue - priorValue);
  const changePct = priorValue !== 0 ? round2((changeAbs / Math.abs(priorValue)) * 100) : null;
  // A zero-valued prior figure can't honestly express a % change (0 ->
  // any nonzero value is a divide-by-zero) — fall back to the absolute
  // threshold in points, never a fabricated percentage.
  const magnitude = changePct !== null ? Math.abs(changePct) : Math.abs(changeAbs);
  if (magnitude < thresholdPct) {
    return { direction: "stable", currentValue, priorValue, changeAbs, changePct };
  }
  return {
    direction: changeAbs > 0 ? "improving" : "declining",
    currentValue,
    priorValue,
    changeAbs,
    changePct,
  };
}

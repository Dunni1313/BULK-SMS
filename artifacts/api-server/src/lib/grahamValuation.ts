// Phase 2, Sprint 12 — Graham Valuation Engine (approved Phase 2 plan, Sprint
// 12). A second, standalone, named valuation model alongside the existing
// blended analyzeValuation() (that function stays as-is this sprint — the
// approved plan's later sprints, not this one, split it out as "Buffett
// Valuation"). Deliberately conservative, per Benjamin Graham's own
// methodology: uses trailing EPS only (never forward estimates), and never
// fabricates a number when inputs are insufficient.
//
// PURE function over the provider-agnostic `Fundamentals` snapshot — like
// analyzeValuation, this never touches a provider directly, so it works
// identically whether `f` came from the SIMULATED provider or a future live
// FMP/Alpha Vantage fetch. No redesign needed when live data is wired up.
//
// SAFETY CONTRACT (same as analyzeValuation): advisory/education only; fair
// value is NEVER fabricated — when inputs are insufficient, this returns an
// explicit `{ available: false }` state.

import type { Fundamentals } from "./fundamentals.js";
import {
  classifyMarginOfSafety,
  type FairValueMethod,
  type MarginOfSafetyLabel,
  type ValuationRating,
} from "./valueInvesting.js";

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

export type GrahamValuation =
  | {
      available: true;
      price: number;
      // Classic Graham Number: sqrt(22.5 x EPS x Book Value/share). Null when
      // not computable (EPS or book value not positive) but the growth
      // formula method still is — the report shows whichever method(s) apply.
      grahamNumber: number | null;
      // Graham's growth formula: EPS x (8.5 + 2g) x 4.4/Y. Null when trailing
      // EPS is not positive.
      growthFormulaValue: number | null;
      fairValue: number;
      methods: FairValueMethod[];
      marginOfSafety: number; // fraction; positive => undervalued
      marginOfSafetyLabel: MarginOfSafetyLabel;
      rating: ValuationRating;
      summary: string;
    }
  | {
      available: false;
      price: number;
      reason: string;
      summary: string;
    };

// riskFreeRate: the "Y" in Graham's growth formula (current yield on
// high-grade corporate bonds). Approved Sprint 12 scope: defaults to the
// investingRiskFreeRate setting's own default (0.045) rather than threading
// the live per-user Settings value through the report-assembly path — that
// wiring is a later, one-parameter follow-up.
const DEFAULT_RISK_FREE_RATE = 0.045;

export function analyzeGrahamValuation(
  f: Fundamentals,
  riskFreeRate: number = DEFAULT_RISK_FREE_RATE,
): GrahamValuation {
  // Deliberately trailing EPS only — Graham's methodology is conservative and
  // distrustful of forward analyst estimates, unlike the blended model, which
  // prefers forward EPS when available.
  const eps = f.epsTtm;
  const methods: FairValueMethod[] = [];

  let grahamNumber: number | null = null;
  if (eps != null && eps > 0 && f.bookPerShare > 0) {
    grahamNumber = round(Math.sqrt(22.5 * eps * f.bookPerShare), 2);
    methods.push({
      method: "Graham Number",
      fairValue: grahamNumber,
      detail: `sqrt(22.5 × ${eps.toFixed(2)} EPS × ${f.bookPerShare.toFixed(2)} book value/share)`,
    });
  }

  let growthFormulaValue: number | null = null;
  if (eps != null && eps > 0) {
    const g = f.epsGrowth5y * 100; // Graham's formula expects growth as a whole number percent
    const yPct = riskFreeRate * 100;
    growthFormulaValue = round(eps * (8.5 + 2 * g) * (4.4 / yPct), 2);
    methods.push({
      method: "Graham Growth Formula",
      fairValue: growthFormulaValue,
      detail: `${eps.toFixed(2)} EPS × (8.5 + 2 × ${g.toFixed(1)}) × 4.4 / ${yPct.toFixed(1)}`,
    });
  }

  if (methods.length === 0) {
    return {
      available: false,
      price: f.price,
      reason: "No positive trailing EPS to anchor a Graham intrinsic-value estimate.",
      summary: `${f.symbol}: Graham fair value unavailable — trailing earnings are not positive, so intrinsic value cannot be estimated without fabricating a number.`,
    };
  }

  const fairValues = methods.map((m) => m.fairValue);
  const fairValue = round(fairValues.reduce((a, b) => a + b, 0) / fairValues.length, 2);
  const marginOfSafety = round((fairValue - f.price) / fairValue, 4);
  const { marginOfSafetyLabel, rating } = classifyMarginOfSafety(marginOfSafety);

  const mosPct = (marginOfSafety * 100).toFixed(0);
  const etfCaveat =
    f.kind === "etf"
      ? " Graham's per-company margin-of-safety framework has limited applicability to a diversified fund."
      : "";
  const summary =
    `${f.symbol} trades at $${f.price.toFixed(2)} vs a Graham fair-value estimate of $${fairValue.toFixed(2)}, ` +
    `a ${mosPct}% margin of safety (${marginOfSafetyLabel}). Rated ${rating}.${etfCaveat}`;

  return {
    available: true,
    price: f.price,
    grahamNumber,
    growthFormulaValue,
    fairValue,
    methods,
    marginOfSafety,
    marginOfSafetyLabel,
    rating,
    summary,
  };
}

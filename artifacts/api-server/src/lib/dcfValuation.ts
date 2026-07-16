// Phase 2, Sprint 13 — DCF Valuation Engine (approved Phase 2 plan, Sprint 13).
// A third, standalone, provider-agnostic valuation model alongside Graham
// (Sprint 12) and the existing blended model, following the exact same
// pattern: a pure function over the provider-agnostic `Fundamentals`
// snapshot, reusing `classifyMarginOfSafety()`/`FairValueMethod` so its
// output is shape-compatible with every other analyst in this engine —
// this is what keeps it "independent so it can later combine with Graham,
// Buffett, Tom Nash, and the AI Investment Committee" without redesign.
//
// SAFETY CONTRACT (same as Graham/the blended model): advisory/education
// only; fair value is NEVER fabricated — when free cash flow isn't positive,
// or the discount rate doesn't exceed the terminal growth rate, this returns
// an explicit `{ available: false }` state.

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

export type DcfConfidenceLabel = "High" | "Moderate" | "Low";

export type DcfValuation =
  | {
      available: true;
      price: number;
      discountRate: number;
      terminalGrowthRate: number;
      projectionYears: number;
      // Year 1..N projected FCF/share, oldest (year 1) to newest (year N).
      projectedFreeCashFlows: number[];
      // Undiscounted Gordon-growth terminal value as of the end of year N.
      terminalValue: number;
      fairValue: number;
      methods: FairValueMethod[];
      marginOfSafety: number; // fraction; positive => undervalued
      marginOfSafetyLabel: MarginOfSafetyLabel;
      rating: ValuationRating;
      confidenceLabel: DcfConfidenceLabel;
      confidenceExplanation: string;
      summary: string;
    }
  | {
      available: false;
      price: number;
      discountRate: number;
      terminalGrowthRate: number;
      reason: string;
      summary: string;
    };

// Approved Sprint 13 defaults: discountRate mirrors investingDefaultDiscountRate's
// own Sprint 11 default (0.09) — per-user Settings threading is explicitly
// deferred, same as Graham's riskFreeRate parameter. terminalGrowthRate and
// projectionYears are plain function-parameter defaults; no new Settings
// field is introduced this sprint.
const DEFAULT_DISCOUNT_RATE = 0.09;
const DEFAULT_TERMINAL_GROWTH_RATE = 0.025;
const DEFAULT_PROJECTION_YEARS = 5;

interface DcfProjection {
  projectedFreeCashFlows: number[];
  terminalValue: number;
  pvCashFlows: number;
  pvTerminalValue: number;
  fairValue: number;
}

// Pure DCF math, reused for the base case AND the bull/bear sensitivity cases
// that drive the confidence explanation below — a single source of truth for
// "how does the projection work" rather than duplicating it per case.
// Growth decays LINEARLY from `nearTermGrowth` (year 1) to `terminalGrowthRate`
// (year `projectionYears`), per the approved Sprint 13 decision. Returns null
// when the discount rate doesn't exceed the terminal growth rate (no finite
// terminal value) — the caller treats this as honestly unavailable.
function projectDcf(
  startingFcf: number,
  nearTermGrowth: number,
  terminalGrowthRate: number,
  discountRate: number,
  projectionYears: number,
): DcfProjection | null {
  if (discountRate <= terminalGrowthRate) return null;

  const projectedFreeCashFlows: number[] = [];
  let pvCashFlows = 0;
  let fcf = startingFcf;
  for (let year = 1; year <= projectionYears; year++) {
    const t = projectionYears > 1 ? (year - 1) / (projectionYears - 1) : 1;
    const yearGrowth = nearTermGrowth + (terminalGrowthRate - nearTermGrowth) * t;
    fcf = fcf * (1 + yearGrowth);
    projectedFreeCashFlows.push(round(fcf, 2));
    pvCashFlows += fcf / (1 + discountRate) ** year;
  }

  const terminalValue = round((fcf * (1 + terminalGrowthRate)) / (discountRate - terminalGrowthRate), 2);
  const pvTerminalValue = round(terminalValue / (1 + discountRate) ** projectionYears, 2);
  pvCashFlows = round(pvCashFlows, 2);

  return {
    projectedFreeCashFlows,
    terminalValue,
    pvCashFlows,
    pvTerminalValue,
    fairValue: round(pvCashFlows + pvTerminalValue, 2),
  };
}

// Deterministic confidence label + explanation: reruns the same projection
// under a +/-1% discount-rate and +/-0.5% terminal-growth swing (clamped so
// the bull case never lets the discount rate collapse onto the terminal
// rate) and describes how much that swing moves fair value. Never a
// fabricated/qualitative "confidence" — always traceable back to the same
// deterministic math.
function assessConfidence(
  startingFcf: number,
  nearTermGrowth: number,
  terminalGrowthRate: number,
  discountRate: number,
  projectionYears: number,
  fairValue: number,
): { confidenceLabel: DcfConfidenceLabel; confidenceExplanation: string } {
  const bearTerminal = terminalGrowthRate - 0.005;
  const bearDiscount = discountRate + 0.01;
  const bullTerminal = terminalGrowthRate + 0.005;
  const bullDiscount = Math.max(discountRate - 0.01, bullTerminal + 0.01);

  const bear = projectDcf(startingFcf, nearTermGrowth, bearTerminal, bearDiscount, projectionYears);
  const bull = projectDcf(startingFcf, nearTermGrowth, bullTerminal, bullDiscount, projectionYears);

  if (!bear || !bull || fairValue <= 0) {
    return {
      confidenceLabel: "Low",
      confidenceExplanation:
        "Sensitivity range could not be computed cleanly from these assumptions — treat this estimate with caution.",
    };
  }

  const spread = Math.abs(bull.fairValue - bear.fairValue) / fairValue;
  const spreadPct = (spread * 100).toFixed(0);

  if (spread < 0.35) {
    return {
      confidenceLabel: "High",
      confidenceExplanation: `Fair value is relatively insensitive to the discount-rate/terminal-growth assumptions — a ±1% discount-rate and ±0.5% terminal-growth swing moves fair value by about ${spreadPct}%.`,
    };
  }
  if (spread < 0.75) {
    return {
      confidenceLabel: "Moderate",
      confidenceExplanation: `Fair value is moderately sensitive to the discount-rate/terminal-growth assumptions — a ±1% discount-rate and ±0.5% terminal-growth swing moves fair value by about ${spreadPct}%. Treat this estimate as a range, not a single point figure.`,
    };
  }
  return {
    confidenceLabel: "Low",
    confidenceExplanation: `Fair value is highly sensitive to the discount-rate/terminal-growth assumptions — a ±1% discount-rate and ±0.5% terminal-growth swing moves fair value by about ${spreadPct}%. Treat this estimate with caution.`,
  };
}

export function analyzeDcfValuation(
  f: Fundamentals,
  discountRate: number = DEFAULT_DISCOUNT_RATE,
  terminalGrowthRate: number = DEFAULT_TERMINAL_GROWTH_RATE,
  projectionYears: number = DEFAULT_PROJECTION_YEARS,
): DcfValuation {
  const startingFcf = f.fcfPerShare;

  if (startingFcf == null || startingFcf <= 0) {
    return {
      available: false,
      price: f.price,
      discountRate,
      terminalGrowthRate,
      reason: "No positive free cash flow to anchor a discounted-cash-flow projection.",
      summary: `${f.symbol}: DCF fair value unavailable — free cash flow is not positive, so a multi-year projection cannot be built without fabricating a number.`,
    };
  }

  const projection = projectDcf(startingFcf, f.revenueGrowth5y, terminalGrowthRate, discountRate, projectionYears);
  if (!projection) {
    return {
      available: false,
      price: f.price,
      discountRate,
      terminalGrowthRate,
      reason: "Discount rate must exceed the terminal growth rate for a finite terminal value.",
      summary: `${f.symbol}: DCF fair value unavailable — the discount rate does not exceed the terminal growth rate.`,
    };
  }

  const { fairValue } = projection;
  const marginOfSafety = round((fairValue - f.price) / fairValue, 4);
  const { marginOfSafetyLabel, rating } = classifyMarginOfSafety(marginOfSafety);
  const { confidenceLabel, confidenceExplanation } = assessConfidence(
    startingFcf,
    f.revenueGrowth5y,
    terminalGrowthRate,
    discountRate,
    projectionYears,
    fairValue,
  );

  const methods: FairValueMethod[] = [
    {
      method: "Projected Cash Flows",
      fairValue: projection.pvCashFlows,
      detail: `Present value of ${projectionYears}-yr FCF projection discounted at ${(discountRate * 100).toFixed(1)}%`,
    },
    {
      method: "Terminal Value",
      fairValue: projection.pvTerminalValue,
      detail: `Gordon-growth terminal value ($${projection.terminalValue.toFixed(2)}) at ${(terminalGrowthRate * 100).toFixed(1)}% growth, discounted back ${projectionYears} yrs`,
    },
  ];

  const mosPct = (marginOfSafety * 100).toFixed(0);
  const etfCaveat =
    f.kind === "etf"
      ? " A multi-year cash-flow projection is a loose fit for a diversified fund's blended cash flows."
      : "";
  const summary =
    `${f.symbol} trades at $${f.price.toFixed(2)} vs a DCF fair-value estimate of $${fairValue.toFixed(2)} ` +
    `(${projectionYears}-yr projection, ${(discountRate * 100).toFixed(1)}% discount rate, ${(terminalGrowthRate * 100).toFixed(1)}% terminal growth), ` +
    `a ${mosPct}% margin of safety (${marginOfSafetyLabel}). Rated ${rating}.${etfCaveat}`;

  return {
    available: true,
    price: f.price,
    discountRate,
    terminalGrowthRate,
    projectionYears,
    projectedFreeCashFlows: projection.projectedFreeCashFlows,
    terminalValue: projection.terminalValue,
    fairValue,
    methods,
    marginOfSafety,
    marginOfSafetyLabel,
    rating,
    confidenceLabel,
    confidenceExplanation,
    summary,
  };
}

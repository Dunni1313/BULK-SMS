// Phase 2, Sprint 14 — Buffett Valuation Engine (approved Phase 2 plan,
// Sprint 14). A fourth, standalone, provider-agnostic valuation model
// alongside Graham (Sprint 12), DCF (Sprint 13), and the existing blended
// analyzeValuation() (deliberately kept, not retired — see the approved
// Sprint 14 plan's decision 1: retiring it would touch analyzeStockVsOptions,
// analyzeValueDecision, buffettChecklist, the report's required `valuation`
// field, and the heaviest existing test file for no real benefit, since the
// consolidation this sprint also builds (marginOfSafety.ts) works over any
// number of available models).
//
// Buffett-flavored, deliberately distinct in SHAPE from both other models:
// Graham applies fixed formulas; DCF projects multiple years explicitly;
// this model capitalizes owner earnings as a NO-GROWTH PERPETUITY at a
// quality/moat-adjusted required return — "pay up for a wonderful business,
// demand more margin of safety from a weak one," expressed quantitatively
// via the existing BusinessQuality/MoatAnalysis scores (zero new data).
//
// Owner earnings is approximated as `fcfPerShare` (same honest approximation
// DCF and the blended model already use) — a true net-income + D&A −
// maintenance-capex − ΔNWC breakdown needs Sprint 18's full statement data,
// not yet built. Never fabricated: `available: false` when FCF isn't
// positive.

import type { Fundamentals } from "./fundamentals.js";
import type { BusinessQuality, MoatAnalysis, MoatRating } from "./valueInvesting.js";
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
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export type BuffettValuation =
  | {
      available: true;
      price: number;
      ownerEarnings: number;
      requiredReturn: number;
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
      requiredReturn: number;
      reason: string;
      summary: string;
    };

// Approved Sprint 14 default: matches investingDefaultDiscountRate's own
// Sprint 11 default (0.09), same deferred-per-user-Settings-threading
// pattern as Graham/DCF's own defaults.
const DEFAULT_BASE_REQUIRED_RETURN = 0.09;
const MAX_QUALITY_DISCOUNT = 0.04;
const MIN_REQUIRED_RETURN = 0.03;

const MOAT_DISCOUNT: Record<MoatRating, number> = {
  Wide: 0.02,
  Medium: 0.012,
  Narrow: 0.006,
  None: 0,
};

// Deterministic heuristic, not a real WACC/CAPM model: a wider moat and a
// higher business-quality score both lower the required return (Buffett will
// pay a higher price / accept a lower yield for a wonderful, durable
// business), clamped so the required return never collapses to zero.
function qualityAdjustedRequiredReturn(
  baseRequiredReturn: number,
  bq: BusinessQuality,
  moat: MoatAnalysis,
): number {
  const qualityBonus = clamp(((bq.score - 50) / 50) * 0.02, 0, 0.02); // up to 2% for a ~100 score
  const moatBonus = MOAT_DISCOUNT[moat.rating];
  const discount = clamp(qualityBonus + moatBonus, 0, MAX_QUALITY_DISCOUNT);
  return round(clamp(baseRequiredReturn - discount, MIN_REQUIRED_RETURN, baseRequiredReturn), 4);
}

export function analyzeBuffettValuation(
  f: Fundamentals,
  bq: BusinessQuality,
  moat: MoatAnalysis,
  baseRequiredReturn: number = DEFAULT_BASE_REQUIRED_RETURN,
): BuffettValuation {
  const requiredReturn = qualityAdjustedRequiredReturn(baseRequiredReturn, bq, moat);
  const ownerEarnings = f.fcfPerShare;

  if (ownerEarnings == null || ownerEarnings <= 0) {
    return {
      available: false,
      price: f.price,
      requiredReturn,
      reason: "No positive free cash flow to approximate owner earnings.",
      summary: `${f.symbol}: Buffett fair value unavailable — owner earnings (approximated from free cash flow) are not positive, so a perpetuity value cannot be estimated without fabricating a number.`,
    };
  }

  const fairValue = round(ownerEarnings / requiredReturn, 2);
  const marginOfSafety = round((fairValue - f.price) / fairValue, 4);
  const { marginOfSafetyLabel, rating } = classifyMarginOfSafety(marginOfSafety);

  const methods: FairValueMethod[] = [
    {
      method: "Owner Earnings Perpetuity",
      fairValue,
      detail: `$${ownerEarnings.toFixed(2)} owner earnings (approximated from FCF) ÷ ${(requiredReturn * 100).toFixed(1)}% quality/moat-adjusted required return`,
    },
  ];

  const mosPct = (marginOfSafety * 100).toFixed(0);
  const etfCaveat =
    f.kind === "etf"
      ? " A single-enterprise owner-earnings capitalization is a loose fit for a diversified fund's blended cash flows."
      : "";
  const summary =
    `${f.symbol} trades at $${f.price.toFixed(2)} vs a Buffett fair-value estimate of $${fairValue.toFixed(2)} ` +
    `(owner earnings capitalized at a ${(requiredReturn * 100).toFixed(1)}% quality/moat-adjusted required return), ` +
    `a ${mosPct}% margin of safety (${marginOfSafetyLabel}). Rated ${rating}.${etfCaveat}`;

  return {
    available: true,
    price: f.price,
    ownerEarnings,
    requiredReturn,
    fairValue,
    methods,
    marginOfSafety,
    marginOfSafetyLabel,
    rating,
    summary,
  };
}

// Earnings engine: identifies near-term earnings events with elevated implied
// volatility and recommends the best premium-selling structure to harvest the
// post-report IV crush. Pure functions so the analysis is unit-testable without a
// database or network.

import { makeRng } from "./optionsMath.js";

export const EARNINGS_WINDOW_DAYS = 14;
export const MIN_EARNINGS_IV_RANK = 50;

export interface EarningsInput {
  symbol: string;
  name: string;
  price: number;
  iv: number;
  ivRank: number;
  ivBase: number; // long-run baseline IV for the symbol
  earningsInDays: number | null;
  earningsDate: string | null;
}

export interface EarningsPlay {
  symbol: string;
  name: string;
  price: number;
  earningsDate: string | null;
  daysToEarnings: number;
  iv: number;
  ivRank: number;
  expectedMovePct: number; // %
  expectedMoveDollars: number;
  historicalMovePct: number; // % typical absolute earnings move
  ivCrushPotentialPct: number; // estimated IV drop post-report, in %
  recommendedStrategy: "iron_fly" | "iron_condor" | "calendar_spread";
  rationale: string;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// Deterministic, symbol-stable typical earnings move (does not vary day to day).
function historicalMovePct(symbol: string): number {
  const rng = makeRng(`${symbol}|earnings-history`);
  return round1((0.03 + rng() * 0.09) * 100); // 3%–12%
}

// Returns a play when the event is within the window and IV rank is elevated.
export function analyzeEarnings(input: EarningsInput): EarningsPlay | null {
  if (input.earningsInDays === null) return null;
  if (input.earningsInDays > EARNINGS_WINDOW_DAYS) return null;
  if (input.ivRank <= MIN_EARNINGS_IV_RANK) return null;

  const days = Math.max(1, input.earningsInDays);
  const expectedMoveFrac = input.iv * Math.sqrt(days / 365);
  const expectedMovePct = round1(expectedMoveFrac * 100);
  const expectedMoveDollars = Math.round(input.price * expectedMoveFrac * 100) / 100;
  const histPct = historicalMovePct(input.symbol);

  // Estimated IV drop after the report: scales with IV rank and how far current IV
  // sits above the symbol's baseline.
  const elevation = clamp(input.iv / Math.max(input.ivBase, 0.01) - 1, 0, 2);
  const ivCrushPotentialPct = round1(
    clamp((input.ivRank / 100) * 0.4 + elevation * 0.3, 0.05, 0.6) * 100,
  );

  const overpriced = expectedMovePct > histPct;
  let recommendedStrategy: EarningsPlay["recommendedStrategy"];
  let rationale: string;
  if (input.ivRank >= 70 && overpriced) {
    recommendedStrategy = "iron_fly";
    rationale =
      "Very high IV rank and options pricing a larger move than history — short ATM iron fly to maximize IV-crush capture.";
  } else if (input.ivRank >= 60) {
    recommendedStrategy = "iron_condor";
    rationale =
      "High IV rank — defined-risk iron condor collects elevated premium with breakevens outside the expected move.";
  } else {
    recommendedStrategy = "calendar_spread";
    rationale =
      "Moderately elevated IV — calendar spread profits from front-month IV crush with limited capital at risk.";
  }

  return {
    symbol: input.symbol,
    name: input.name,
    price: input.price,
    earningsDate: input.earningsDate,
    daysToEarnings: days,
    iv: input.iv,
    ivRank: input.ivRank,
    expectedMovePct,
    expectedMoveDollars,
    historicalMovePct: histPct,
    ivCrushPotentialPct,
    recommendedStrategy,
    rationale,
  };
}

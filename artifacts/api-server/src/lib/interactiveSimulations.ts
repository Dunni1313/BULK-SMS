// AI Teacher & Learning Centre sprint — Interactive Education
// simulations. Every simulation is deterministic, computed on the
// server from either this platform's own real pricing engine
// (optionsMath.ts's bs(), the exact Black-Scholes function every real
// quote uses) or a standard, textbook formula (payoff-at-expiration,
// Herfindahl-Hirschman-Index concentration) — never a fabricated
// number, never randomness, never an LLM. Every response is clearly
// labeled by the caller as "Educational Simulation — Not Market Data —
// No Trade Recommendation" (enforced by the frontend, which always
// renders these fixed badges alongside any simulation result).
//
// Deliberately scoped: 6 simulation types covering most of the 9 named
// in the sprint's own request — Delta, Theta, Expected Move,
// Concentration, and Payoff Diagrams for Covered Call/Cash Secured
// Put/Iron Condor. The Wheel strategy's own payoff is the combination
// of the Covered Call and Cash Secured Put diagrams already offered
// (disclosed, not a separate 7th simulator), and Position Sizing is
// deliberately NOT re-simulated here with arbitrary numbers — this
// platform's own real Position Sizing & Portfolio Impact Calculator
// (/position-sizing) already computes that against a user's REAL
// portfolio, and duplicating it with fabricated inputs would be a
// strictly worse experience, not a better one; the Learning Centre
// links out to that real tool instead.

import { bs } from "./optionsMath.js";
import { computeExpectedMove } from "./earnings.js";

export type SimulationType = "delta" | "theta" | "expected_move" | "payoff" | "concentration";
export type PayoffStrategy = "covered_call" | "cash_secured_put" | "iron_condor";

export class SimulationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export interface SimulationPoint {
  x: number;
  y: number;
}

export interface SimulationResult {
  type: SimulationType;
  label: string;
  xLabel: string;
  yLabel: string;
  points: SimulationPoint[];
  summary: string;
  educationalSimulation: true;
  notMarketData: true;
  noTradeRecommendation: true;
}

function wrap(
  type: SimulationType,
  label: string,
  xLabel: string,
  yLabel: string,
  points: SimulationPoint[],
  summary: string,
): SimulationResult {
  return { type, label, xLabel, yLabel, points, summary, educationalSimulation: true, notMarketData: true, noTradeRecommendation: true };
}

// Delta sim: how a call's delta changes across a range of underlying
// prices, at a fixed strike/IV/DTE — reuses bs() directly.
export function simulateDelta(strike: number, iv: number, dte: number): SimulationResult {
  if (strike <= 0) throw new SimulationError("strike must be positive");
  if (iv <= 0 || iv > 3) throw new SimulationError("iv must be a positive fraction (e.g. 0.30 for 30%)");
  if (dte <= 0) throw new SimulationError("dte must be positive");
  const T = dte / 365;
  const points: SimulationPoint[] = [];
  for (let pct = -30; pct <= 30; pct += 2) {
    const price = strike * (1 + pct / 100);
    const g = bs(price, strike, T, iv, "call");
    points.push({ x: Math.round(price * 100) / 100, y: Math.round(g.delta * 1000) / 1000 });
  }
  return wrap(
    "delta",
    `Call Delta vs. Underlying Price (strike ${strike}, ${dte}d, IV ${(iv * 100).toFixed(0)}%)`,
    "Underlying Price",
    "Delta",
    points,
    `As the underlying rises from below to above the ${strike} strike, delta rises from near 0 toward 1 — this is the same real Black-Scholes pricing formula (bs()) every quote on this platform uses.`,
  );
}

// Theta sim: how an at-the-money option's theta accelerates as days to
// expiration shrink — reuses bs() directly.
export function simulateTheta(strike: number, iv: number): SimulationResult {
  if (strike <= 0) throw new SimulationError("strike must be positive");
  if (iv <= 0 || iv > 3) throw new SimulationError("iv must be a positive fraction (e.g. 0.30 for 30%)");
  const points: SimulationPoint[] = [];
  for (let dte = 60; dte >= 1; dte -= 2) {
    const T = dte / 365;
    const g = bs(strike, strike, T, iv, "call");
    points.push({ x: dte, y: Math.round(g.theta * 100 * 100) / 100 });
  }
  return wrap(
    "theta",
    `At-the-Money Theta vs. Days to Expiration (strike ${strike}, IV ${(iv * 100).toFixed(0)}%)`,
    "Days to Expiration",
    "Theta ($/day, per contract)",
    points,
    "Theta decay accelerates sharply as expiration approaches — the same real bs() pricing formula every quote uses, evaluated at a fixed at-the-money strike across shrinking time.",
  );
}

// Expected Move sim: the range across a range of days-to-expiration —
// reuses computeExpectedMove() directly (Sprint-added, extracted from
// lib/earnings.ts's own analyzeEarnings()).
export function simulateExpectedMove(price: number, iv: number): SimulationResult {
  if (price <= 0) throw new SimulationError("price must be positive");
  if (iv <= 0 || iv > 3) throw new SimulationError("iv must be a positive fraction (e.g. 0.30 for 30%)");
  const points: SimulationPoint[] = [];
  for (let dte = 1; dte <= 90; dte += 3) {
    const move = computeExpectedMove(price, iv, dte);
    points.push({ x: dte, y: move.pct });
  }
  return wrap(
    "expected_move",
    `Expected Move vs. Days to Expiration (price ${price}, IV ${(iv * 100).toFixed(0)}%)`,
    "Days to Expiration",
    "Expected Move (%)",
    points,
    "Expected move widens with the square root of time — a one-standard-deviation range, roughly a 68% chance the underlying stays inside it, reusing the exact same formula lib/earnings.ts's own earnings-play logic already computes.",
  );
}

// Payoff diagram: standard profit/loss AT EXPIRATION across a range of
// underlying prices — a different, complementary formula from bs()'s
// own before-expiration pricing (at expiration an option has no time
// value, only intrinsic value), the textbook payoff formula for each
// strategy, never a duplicate of the real-time pricing engine.
export function simulatePayoff(
  strategy: PayoffStrategy,
  params: { stockCostBasis?: number; callStrike?: number; callPremium?: number; putStrike?: number; putPremium?: number; longPutStrike?: number; longCallStrike?: number; netCredit?: number },
): SimulationResult {
  const centerStrike = params.callStrike ?? params.putStrike ?? params.stockCostBasis ?? 100;
  const points: SimulationPoint[] = [];
  const lo = centerStrike * 0.7;
  const hi = centerStrike * 1.3;
  const step = (hi - lo) / 40;

  for (let price = lo; price <= hi; price += step) {
    let pnl = 0;
    if (strategy === "covered_call") {
      const costBasis = params.stockCostBasis ?? centerStrike;
      const strike = params.callStrike ?? centerStrike;
      const premium = params.callPremium ?? 0;
      const stockPnl = (Math.min(price, strike) - costBasis) * 100;
      pnl = stockPnl + premium * 100;
    } else if (strategy === "cash_secured_put") {
      const strike = params.putStrike ?? centerStrike;
      const premium = params.putPremium ?? 0;
      const assignedLoss = Math.max(0, strike - price) * 100;
      pnl = premium * 100 - assignedLoss;
    } else if (strategy === "iron_condor") {
      const shortPut = params.putStrike ?? centerStrike * 0.95;
      const longPut = params.longPutStrike ?? shortPut - 5;
      const shortCall = params.callStrike ?? centerStrike * 1.05;
      const longCall = params.longCallStrike ?? shortCall + 5;
      const credit = params.netCredit ?? 1;
      const putSpreadLoss = clamp(shortPut - price, 0, shortPut - longPut);
      const callSpreadLoss = clamp(price - shortCall, 0, longCall - shortCall);
      pnl = (credit - putSpreadLoss - callSpreadLoss) * 100;
    } else {
      throw new SimulationError(`Unknown payoff strategy: ${strategy}`, 400);
    }
    points.push({ x: Math.round(price * 100) / 100, y: Math.round(pnl * 100) / 100 });
  }

  return wrap(
    "payoff",
    `${strategy.replace(/_/g, " ")} — Profit/Loss at Expiration`,
    "Underlying Price at Expiration",
    "Profit / Loss ($)",
    points,
    "A standard payoff-at-expiration diagram — every option in the structure has settled to pure intrinsic value, so this uses the textbook payoff formula, deliberately distinct from the real-time Black-Scholes pricing the platform's live quotes use before expiration.",
  );
}

// Concentration sim: textbook Herfindahl-Hirschman-Index over
// user-supplied HYPOTHETICAL position weights (never real portfolio
// data — a generic "explore the concept" tool; the real Concentration
// overlay at /concentration-risk computes this over a user's actual
// open positions).
export function simulateConcentration(weights: number[]): SimulationResult {
  if (weights.length === 0) throw new SimulationError("Provide at least one weight");
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) throw new SimulationError("Weights must sum to a positive number");
  const normalized = weights.map((w) => (w / total) * 100);
  const hhi = normalized.reduce((s, w) => s + w * w, 0) / 100; // 0-100 scale
  const points: SimulationPoint[] = normalized.map((w, i) => ({ x: i + 1, y: Math.round(w * 100) / 100 }));
  const label = hhi >= 50 ? "highly concentrated" : hhi >= 25 ? "moderately concentrated" : "well diversified";
  return wrap(
    "concentration",
    `Concentration (Herfindahl-Hirschman-Index) over ${weights.length} hypothetical positions`,
    "Position",
    "Weight (%)",
    points,
    `A hypothetical portfolio with these weights scores ${Math.round(hhi * 10) / 10}/100 on the standard HHI concentration measure (0 = perfectly diversified, 100 = a single position) — ${label}. This is a generic educational tool over made-up weights, not your real portfolio; see the Correlation & Concentration overlay for that.`,
  );
}

// Phase 24 — Institutional Trading Engine Foundation.
//
// Strategy service boundary. Genuinely new this phase — no Strategy
// Framework exists anywhere in Engine 2 today; the only "strategy"-shaped
// concept in the codebase is a handful of hardcoded backtest rule-sets
// inside lib/tradingBacktest.ts (trend-following/structure-breakout/
// mean-reversion), which stay exactly as they are.
//
// This file defines ONLY the shape a strategy will eventually be
// registered and described in — no strategy is implemented, no signal is
// generated, and STRATEGY_REGISTRY starts empty. Per the approved Phase 24
// scope ("No signal generation yet. No strategy logic yet."), a future
// phase is responsible for both real strategies and the code that
// evaluates one against a live MarketStructureAnalysis/LiquidityAnalysis.

import type { Timeframe } from "../tradingMarketData.js";

export type StrategyCategory = "trend" | "reversal" | "breakout" | "range";

export interface StrategyDefinition {
  key: string;
  label: string;
  category: StrategyCategory;
  description: string;
  timeframes: Timeframe[]; // timeframes this strategy is designed to run on
}

/**
 * Deliberately empty. Populated by a future phase once a real strategy
 * (with real entry/exit logic) exists to register — never seeded with a
 * placeholder entry, which would misrepresent an unimplemented strategy as
 * a real, selectable one.
 */
export const STRATEGY_REGISTRY: StrategyDefinition[] = [];

export function getStrategyByKey(key: string): StrategyDefinition | null {
  return STRATEGY_REGISTRY.find((s) => s.key === key) ?? null;
}

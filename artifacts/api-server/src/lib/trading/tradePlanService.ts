// Phase 24 — Institutional Trading Engine Foundation.
//
// Trade Plan service boundary. Genuinely new this phase. A Trade Plan is
// a human's own stated pre-trade intent (symbol, direction, entry/stop/
// target, thesis) — never a machine-generated signal. This module is
// deliberately in-memory only this phase: no trading_trade_plans table,
// no route, no persistence. Per the approved "foundation only" scope, a
// database migration is deferred until a real UI consumer (the Trade
// Workspace's own planning panel, a future phase) actually needs to save
// a plan across requests — the same "extract/persist on the second real
// consumer" discipline this codebase has followed since Phase 12.
//
// The only real logic here, computeRiskParameters() (re-exported from
// tradingDomainModel.ts), is pure arithmetic over numbers a human already
// supplied — never signal generation, never a recommendation on whether
// entry/stop/target are good levels.

import { randomUUID } from "node:crypto";
import {
  computeRiskParameters,
  type TradePlan,
  type TradeDirection,
  type TradePlanStatus,
  type RiskParameters,
} from "../tradingDomainModel.js";

export { computeRiskParameters };

export interface CreateTradePlanInput {
  symbol: string;
  direction: TradeDirection;
  thesis: string;
  accountRiskPct: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
}

/**
 * Builds a new, in-memory TradePlan (status always starts "draft") from a
 * human's own inputs. Does not persist anything — the caller owns storage
 * for now (e.g. component state in the Trade Workspace placeholder UI).
 */
export function createTradePlan(input: CreateTradePlanInput, accountValue: number | null): TradePlan {
  const risk: RiskParameters = computeRiskParameters(
    {
      accountRiskPct: input.accountRiskPct,
      entryPrice: input.entryPrice,
      stopPrice: input.stopPrice,
      targetPrice: input.targetPrice,
    },
    accountValue,
  );

  return {
    id: randomUUID(),
    symbol: input.symbol.toUpperCase(),
    direction: input.direction,
    status: "draft",
    thesis: input.thesis,
    risk,
    createdAt: new Date().toISOString(),
  };
}

const VALID_TRANSITIONS: Record<TradePlanStatus, TradePlanStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

/**
 * Advances a plan's status honestly — returns null (never a silently
 * mutated plan) when the requested transition isn't a valid one, e.g.
 * trying to re-open an already-closed plan.
 */
export function transitionTradePlanStatus(plan: TradePlan, next: TradePlanStatus): TradePlan | null {
  if (!VALID_TRANSITIONS[plan.status].includes(next)) return null;
  return { ...plan, status: next };
}

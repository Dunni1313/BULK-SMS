// Phase 24 — Institutional Trading Engine Foundation.
//
// The shared trading domain model. This file is deliberately the *only*
// place new Engine 2 architecture is defined this phase — per the approved
// scope, it establishes types only, no signal generation, no strategy
// logic. Nothing in this file decides whether a symbol is a good trade;
// it only gives every future Engine 2 module (order-block/FVG detection,
// a Strategy Framework, a real Trade Plan persistence layer) a shared,
// consistent vocabulary to speak in.
//
// REUSE DISCIPLINE: Market Structure (SwingPoint/SupportResistanceZone/
// TrendStructure/MarketStructureAnalysis), Liquidity, and the market-data
// primitives (Candle/Timeframe/MarketDataProvider) already exist, fully
// built and tested, since Phase 3 (Sprints 32-35) — they are re-exported
// here unmodified, never redefined. Only Order Blocks, Fair Value Gaps,
// Session Data, and the Trade Plan/Risk Parameters pair are genuinely new
// to this codebase; those are defined below for the first time.
//
// SAFETY CONTRACT: no function in this file inspects a candle series and
// produces a real OrderBlock[]/FairValueGap[] detection — that is
// explicitly deferred (see docs/Trading-Roadmap.md). The one real function
// here, computeRiskParameters(), is pure arithmetic over numbers a human
// already supplied (entry/stop/target/account risk) — it never predicts a
// direction, a level, or an outcome.

export type {
  Timeframe,
  Candle,
  MarketQuote,
  MarketDataProvider,
  TradingUniverseEntry,
} from "./tradingMarketData.js";

export type {
  TrendStructure,
  MarketStructureConfidenceLevel,
  SwingPoint,
  SupportResistanceZone,
  MarketStructureAnalysis,
} from "./tradingMarketStructure.js";

export type {
  LiquidityBand,
  LiquidityConfidenceLevel,
  PressureDirection,
  VolumeProfileLevel,
  BuySellPressure,
  LiquidityAnalysis,
} from "./tradingLiquidity.js";

import type { Timeframe } from "./tradingMarketData.js";

// ---------------------------------------------------------------------------
// Order Blocks — new this phase. A structural marker (the last opposing
// candle before a decisive, displacing move), not a signal: this file only
// defines the shape an order block is reported in, once a future phase
// builds real detection over a candle series.
// ---------------------------------------------------------------------------

export type OrderBlockDirection = "bullish" | "bearish";

export interface OrderBlock {
  id: string;
  symbol: string;
  interval: Timeframe;
  direction: OrderBlockDirection;
  time: string; // ISO timestamp of the originating candle's open
  high: number;
  low: number;
  mitigated: boolean; // has price traded back through this zone since it formed
}

// ---------------------------------------------------------------------------
// Fair Value Gaps — new this phase. A 3-candle imbalance marker.
// ---------------------------------------------------------------------------

export type FairValueGapDirection = "bullish" | "bearish";

export interface FairValueGap {
  id: string;
  symbol: string;
  interval: Timeframe;
  direction: FairValueGapDirection;
  startTime: string; // ISO timestamp of the first candle in the 3-candle pattern
  endTime: string; // ISO timestamp of the third candle in the 3-candle pattern
  gapHigh: number;
  gapLow: number;
  filled: boolean; // has price fully retraced through the gap since it formed
}

// ---------------------------------------------------------------------------
// Session Data — new this phase. Static reference data (session windows,
// in UTC) plus the shape a computed session read is reported in. The
// windows themselves are well-known market conventions, not derived from
// any live feed — the same category of static reference data as
// tradingMarketData.ts's own TRADING_MARKET_UNIVERSE.
// ---------------------------------------------------------------------------

export type TradingSessionName = "sydney" | "tokyo" | "london" | "new_york";

export interface TradingSessionWindow {
  name: TradingSessionName;
  label: string;
  startUtcHour: number; // 0-23, UTC
  endUtcHour: number; // 0-23, UTC — may be numerically less than startUtcHour (wraps past midnight)
}

export const TRADING_SESSION_WINDOWS: TradingSessionWindow[] = [
  { name: "sydney", label: "Sydney", startUtcHour: 21, endUtcHour: 6 },
  { name: "tokyo", label: "Tokyo", startUtcHour: 0, endUtcHour: 9 },
  { name: "london", label: "London", startUtcHour: 7, endUtcHour: 16 },
  { name: "new_york", label: "New York", startUtcHour: 12, endUtcHour: 21 },
];

export interface SessionData {
  symbol: string;
  asOf: string; // ISO timestamp
  activeSessions: TradingSessionName[]; // which windows are open at asOf
  sessionHigh: number | null;
  sessionLow: number | null;
}

// ---------------------------------------------------------------------------
// Trade Plans & Risk Parameters — new this phase. A pre-trade planning
// concept, distinct from tradingRisk.ts's TradingPositionInput (an already-
// open position) and distinct from a strategy's own signal — a Trade Plan
// is a human's own stated intent, never machine-generated.
// ---------------------------------------------------------------------------

export type TradeDirection = "long" | "short";
export type TradePlanStatus = "draft" | "active" | "closed" | "cancelled";

export interface RiskParameters {
  accountRiskPct: number; // % of account the human intends to risk, e.g. 1
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  positionSize: number | null; // derived, see computeRiskParameters()
  riskRewardRatio: number | null; // derived, see computeRiskParameters()
}

export interface TradePlan {
  id: string;
  symbol: string;
  direction: TradeDirection;
  status: TradePlanStatus;
  thesis: string; // free-text, human-authored rationale — never generated
  risk: RiskParameters;
  createdAt: string;
}

/**
 * Fills in the two derived RiskParameters fields (positionSize,
 * riskRewardRatio) from numbers a human already supplied. Pure arithmetic,
 * not a signal: it never decides whether entry/stop/target are good
 * levels, only what they imply given an account size. Returns the same
 * honest-null discipline every other analyzer in this codebase uses —
 * null, never a fabricated 0, when accountValue is not positive or the
 * stop distance is zero.
 */
export function computeRiskParameters(
  params: Omit<RiskParameters, "positionSize" | "riskRewardRatio">,
  accountValue: number | null,
): RiskParameters {
  const stopDistance = Math.abs(params.entryPrice - params.stopPrice);
  const rewardDistance = Math.abs(params.targetPrice - params.entryPrice);

  const riskRewardRatio = stopDistance > 0 ? Number((rewardDistance / stopDistance).toFixed(2)) : null;

  let positionSize: number | null = null;
  if (accountValue != null && accountValue > 0 && stopDistance > 0) {
    const riskDollars = accountValue * (params.accountRiskPct / 100);
    positionSize = Number((riskDollars / stopDistance).toFixed(4));
  }

  return { ...params, positionSize, riskRewardRatio };
}

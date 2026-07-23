// Trade History, Performance Analytics & Trading Journal sprint. Pure,
// I/O-free derivation and analytics functions over already-fetched local
// trade records (GET /trades) and reconciliation order entries
// (GET /broker/reconciliation, reused unmodified — no new broker
// endpoints). Every figure here is computed from real, already-stored
// data — never a fabricated or broker-derived value presented as real.
// Performance figures are explicitly LOCAL-ONLY: this platform has no
// broker-side realized P&L source (see docs/Alpaca-Paper-Trading-Architecture.md
// §4.6's own disclosure), so every calculation here is derived from local
// trade records, not Alpaca's own account activity.

import type { Trade, OrderReconciliationEntry } from "@workspace/api-client-react";

export type TradeDirection = "Long" | "Short";

// A net-credit spread (premium received) is conventionally "short" the
// spread; a net-debit spread (premium paid) is "long" it. This is a real,
// derived mapping onto the trade's own already-stored `credit` sign — not
// a fabricated classification.
export function tradeDirection(trade: Trade): TradeDirection {
  return trade.credit >= 0 ? "Short" : "Long";
}

// No literal "exit price"/"exit credit" is stored anywhere on a trade —
// only the realized dollar P&L (currentPnl) at close. For a credit spread,
// realizedPnl = creditReceivedAtEntry - costToClose, so costToClose =
// credit - realizedPnl. This is an honest, disclosed DERIVATION from
// already-real numbers, never a broker-reported fill price — returns null
// (never 0) whenever a trade hasn't actually closed with a known P&L yet.
export function derivedExitPrice(trade: Trade): number | null {
  if (trade.status !== "closed") return null;
  if (trade.currentPnl === null || trade.currentPnl === undefined) return null;
  return trade.credit - trade.currentPnl;
}

// Days held: open date to close date for a closed trade, or open date to
// "now" for one still open — so an open position's own holding period
// keeps advancing rather than reading a stale 0.
export function holdingPeriodDays(trade: Trade, now: Date = new Date()): number {
  const openMs = new Date(trade.openDate).getTime();
  const endMs = trade.closeDate ? new Date(trade.closeDate).getTime() : now.getTime();
  return Math.max(0, (endMs - openMs) / (24 * 60 * 60 * 1000));
}

// execution.ts assigns a `mock-<uuid>` order id when no broker credentials
// were configured at submission time — such a trade was never actually
// sent to Alpaca, so it has no real broker order to reconcile against.
export function isMockOrderId(alpacaOrderId: string | null | undefined): boolean {
  return !!alpacaOrderId && alpacaOrderId.startsWith("mock-");
}

// The number of spreads a trade represents — StoredLeg.quantity already
// bakes in (per-leg ratio × spread count); for every strategy this
// platform currently builds (uniform-ratio legs), the largest per-leg
// quantity IS the spread count. Mirrors the same derivation
// lib/brokerReconciliation.ts's own localSpreadQuantity() uses server-side
// (an independent client-side implementation, not shared code — this
// codebase has no frontend/backend shared-logic layer).
export function tradeSpreadQuantity(trade: Trade): number | null {
  if (trade.legs.length === 0) return null;
  return Math.max(...trade.legs.map((l) => l.quantity));
}

export interface PerformanceAnalytics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  /** Percentage 0-100, or null when there are no decided (win/loss) closed trades yet. */
  winRate: number | null;
  averageWin: number | null;
  averageLoss: number | null;
  averageHoldingDays: number | null;
  largestWinner: number | null;
  largestLoser: number | null;
  openTrades: number;
  closedTrades: number;
}

// Every figure here is derived exclusively from the local `trades` table —
// never from any broker endpoint. A trade only counts toward win/loss/
// averages once it is genuinely closed with a known realized P&L; an open
// or pending trade contributes to totalTrades/openTrades only.
export function computePerformanceAnalytics(trades: Trade[]): PerformanceAnalytics {
  const totalTrades = trades.length;
  const decidedClosed = trades.filter(
    (t) => t.status === "closed" && t.currentPnl !== null && t.currentPnl !== undefined,
  );
  const winning = decidedClosed.filter((t) => (t.currentPnl as number) > 0);
  const losing = decidedClosed.filter((t) => (t.currentPnl as number) < 0);
  const breakeven = decidedClosed.filter((t) => (t.currentPnl as number) === 0);
  const decidedCount = winning.length + losing.length;

  const winRate = decidedCount > 0 ? (winning.length / decidedCount) * 100 : null;
  const averageWin =
    winning.length > 0 ? winning.reduce((s, t) => s + (t.currentPnl as number), 0) / winning.length : null;
  const averageLoss =
    losing.length > 0 ? losing.reduce((s, t) => s + (t.currentPnl as number), 0) / losing.length : null;
  const averageHoldingDays =
    decidedClosed.length > 0
      ? decidedClosed.reduce((s, t) => s + holdingPeriodDays(t), 0) / decidedClosed.length
      : null;
  const largestWinner = winning.length > 0 ? Math.max(...winning.map((t) => t.currentPnl as number)) : null;
  const largestLoser = losing.length > 0 ? Math.min(...losing.map((t) => t.currentPnl as number)) : null;
  const openTrades = trades.filter((t) => t.status === "open" || t.status === "pending").length;
  const closedTrades = trades.filter((t) => t.status === "closed").length;

  return {
    totalTrades,
    winningTrades: winning.length,
    losingTrades: losing.length,
    breakevenTrades: breakeven.length,
    winRate,
    averageWin,
    averageLoss,
    averageHoldingDays,
    largestWinner,
    largestLoser,
    openTrades,
    closedTrades,
  };
}

export interface ReconciliationSuccessSummary {
  consideredCount: number;
  matchedCount: number;
  /** Percentage 0-100, or null when reconciliation hasn't been checked / nothing to consider yet. */
  successPercentage: number | null;
}

// Reuses GET /broker/reconciliation's own already-computed `orders[]` —
// zero new comparison logic. An order entry with zero issues is a clean,
// fully-reconciled pairing; any issue (missing at broker, missing locally,
// status/quantity/symbol mismatch) counts against the success rate.
export function computeReconciliationSuccess(
  orders: OrderReconciliationEntry[] | undefined,
): ReconciliationSuccessSummary {
  if (!orders || orders.length === 0) {
    return { consideredCount: 0, matchedCount: 0, successPercentage: null };
  }
  const matched = orders.filter((o) => o.issues.length === 0);
  return {
    consideredCount: orders.length,
    matchedCount: matched.length,
    successPercentage: (matched.length / orders.length) * 100,
  };
}

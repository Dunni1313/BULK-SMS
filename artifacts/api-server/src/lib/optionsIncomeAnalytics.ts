// Phase 35 — Institutional Options Income Engine (Foundation).
//
// ARCHITECTURE-ONLY FOUNDATION PHASE. No live brokerage execution, no
// auto trading, no auto adjustments, no AI predictions, no direction
// forecasting, no position recommendations, no trade alerts, no market
// timing. Every function below is a pure, deterministic aggregation,
// count, tally, or sum over data ALREADY PERSISTED in the `trades` table
// (Engine 3, the existing, mature options income platform) or over an
// already-computed value an existing module produces. Nothing here prices
// a leg, builds a quote, or computes a new Greek — that math lives
// entirely in optionsMath.ts/execution.ts/coach.ts, imported and reused,
// never duplicated or modified.
//
// A genuine finding from this phase's own audit, disclosed here: this
// file deliberately does NOT reuse lib/performanceAnalytics.ts's own
// thetaCollected/strategyBreakdown fields for "premium collected," even
// though those field names look like an exact match — performanceAnalytics.ts's
// own computeAnalytics() generates its trade history from a
// deterministically-SEEDED SYNTHETIC generator (generateTradeHistory()),
// not from this user's own real `trades` rows. Reusing it here would have
// quietly fabricated the Income Overview's own headline numbers. Instead,
// realized premium is summed directly from real, closed `trades.credit`
// rows, and projected income reuses lib/thetaIncome.ts's own
// computeThetaIncome() (a genuinely generic, real-data-agnostic
// aggregator) fed with LIVE per-position theta from coach.ts's own
// positionGreeks() — never the stale, entry-time trades.theta column.

import { computeThetaIncome, type ThetaIncome, type ThetaPosition } from "./thetaIncome.js";
import { getOptionsStrategyTemplate } from "./optionsStrategyLibrary.js";

// ─── Position Lifecycle ──────────────────────────────────────────────────
// A deterministic classifier over already-persisted trades columns only
// (status, closeDate, exitReason) — never a new prediction of what WILL
// happen to a position, only an honest label for what the record already
// shows.

export type PositionLifecycleStage =
  | "open"
  | "closed_expired"
  | "closed_assigned"
  | "closed_rolled"
  | "closed_manual"
  | "cancelled"
  | "rejected"
  | "unknown";

export interface MinimalLifecycleRow {
  status: string;
  exitReason: string | null;
}

export function derivePositionLifecycle(row: MinimalLifecycleRow): PositionLifecycleStage {
  if (row.status === "open" || row.status === "pending") return "open";
  if (row.status === "cancelled") return "cancelled";
  if (row.status === "rejected") return "rejected";
  if (row.status === "closed") {
    const reason = (row.exitReason ?? "").toLowerCase();
    if (reason.includes("expir")) return "closed_expired";
    if (reason.includes("assign")) return "closed_assigned";
    if (reason.includes("roll") || reason.includes("convert")) return "closed_rolled";
    return "closed_manual";
  }
  return "unknown";
}

// ─── Position Model ──────────────────────────────────────────────────────
// One deterministic view per position — every field is either a direct
// read of an already-persisted column, or a live recompute via an
// already-exported, already-tested function (positionGreeks). Collateral
// reuses trades.maxLoss directly: for every strategy this engine's own
// execution layer actually builds (iron_condor/iron_fly/calendar_spread),
// maxLoss already IS the real capital-at-risk/collateral figure computed
// at entry by optionsMath.ts's own buildIronCondor/buildIronFly/
// buildCalendar — never a second, independently-derived number.

export interface PositionGreeksLike {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface MinimalPositionRow {
  id: number;
  symbol: string;
  strategy: string;
  status: string;
  credit: number;
  maxLoss: number;
  maxProfit: number;
  expiration: string | null;
  openDate: Date | string;
  closeDate: Date | string | null;
  exitReason: string | null;
  notes: string | null;
  currentPnl: number | null;
}

export interface OptionsPositionView {
  id: number;
  underlying: string;
  strategy: string;
  strategyLabel: string | null; // from the Strategy Library, honestly null if unmapped
  expiration: string | null;
  premium: number;
  collateral: number;
  greeks: PositionGreeksLike;
  status: string;
  lifecycle: PositionLifecycleStage;
  notes: string | null;
  openDate: string;
  closeDate: string | null;
  realizedPnl: number | null;
}

export function buildPositionView(row: MinimalPositionRow, greeks: PositionGreeksLike): OptionsPositionView {
  // templateKeyFor() maps the real execution.ts strategy key
  // ("calendar_spread" -> "calendar") onto the Strategy Library's own
  // vocabulary, passing everything else through unchanged. A strategy
  // value with no matching template (e.g. "earnings") honestly resolves
  // to null via getOptionsStrategyTemplate() — never fabricated.
  const template = getOptionsStrategyTemplate(templateKeyFor(row.strategy));
  return {
    id: row.id,
    underlying: row.symbol,
    strategy: row.strategy,
    strategyLabel: template?.label ?? null,
    expiration: row.expiration,
    premium: row.credit,
    collateral: row.maxLoss,
    greeks,
    status: row.status,
    lifecycle: derivePositionLifecycle(row),
    notes: row.notes,
    openDate: new Date(row.openDate).toISOString(),
    closeDate: row.closeDate ? new Date(row.closeDate).toISOString() : null,
    realizedPnl: row.status === "closed" ? row.currentPnl : null,
  };
}

function templateKeyFor(executionStrategy: string): string {
  if (executionStrategy === "calendar_spread") return "calendar";
  return executionStrategy;
}

// ─── Income Overview ─────────────────────────────────────────────────────

export interface OptionsIncomeOverview {
  openPositionsCount: number;
  closedPositionsCount: number;
  totalCreditCollectedOpen: number; // real premium collected at entry for still-open positions
  totalRealizedPremium: number; // real, already-recorded credit summed over closed positions
  totalCapitalAllocated: number; // sum of open positions' own maxLoss — real capital at risk
  theta: ThetaIncome; // reused, unmodified computeThetaIncome() over live per-position theta
  generatedAt: string;
}

export function buildIncomeOverview(
  openRows: { credit: number; maxLoss: number }[],
  closedRows: { credit: number }[],
  thetaPositions: ThetaPosition[],
): OptionsIncomeOverview {
  return {
    openPositionsCount: openRows.length,
    closedPositionsCount: closedRows.length,
    totalCreditCollectedOpen: round2(openRows.reduce((s, r) => s + r.credit, 0)),
    totalRealizedPremium: round2(closedRows.reduce((s, r) => s + r.credit, 0)),
    totalCapitalAllocated: round2(openRows.reduce((s, r) => s + r.maxLoss, 0)),
    theta: computeThetaIncome(thetaPositions),
    generatedAt: new Date().toISOString(),
  };
}

// ─── Strategy Mix ────────────────────────────────────────────────────────

export interface StrategyMixEntry {
  strategy: string;
  strategyLabel: string | null;
  positionCount: number;
  capitalAllocated: number;
}

export function buildStrategyMix(openRows: { strategy: string; maxLoss: number }[]): StrategyMixEntry[] {
  const map = new Map<string, { count: number; capital: number }>();
  for (const r of openRows) {
    const existing = map.get(r.strategy) ?? { count: 0, capital: 0 };
    existing.count += 1;
    existing.capital += r.maxLoss;
    map.set(r.strategy, existing);
  }
  return [...map.entries()]
    .map(([strategy, v]) => ({
      strategy,
      strategyLabel: getOptionsStrategyTemplate(templateKeyFor(strategy))?.label ?? null,
      positionCount: v.count,
      capitalAllocated: round2(v.capital),
    }))
    .sort((a, b) => b.capitalAllocated - a.capitalAllocated);
}

// ─── Income Calendar (Upcoming Expirations) ────────────────────────────────
// Pure deterministic date math (days until an already-known expiration
// date) — never a prediction of price/outcome, only a calendar view of
// dates already recorded on open positions.

export interface UpcomingExpirationGroup {
  expiration: string;
  daysToExpiry: number;
  positions: { id: number; symbol: string; strategy: string; credit: number }[];
}

export function buildUpcomingExpirations(
  openRows: { id: number; symbol: string; strategy: string; credit: number; expiration: string | null }[],
  asOf: Date = new Date(),
): UpcomingExpirationGroup[] {
  const groups = new Map<string, UpcomingExpirationGroup>();
  for (const r of openRows) {
    if (!r.expiration) continue;
    const existing = groups.get(r.expiration);
    const entry = { id: r.id, symbol: r.symbol, strategy: r.strategy, credit: r.credit };
    if (existing) {
      existing.positions.push(entry);
    } else {
      const expiryDate = new Date(`${r.expiration}T00:00:00Z`);
      const asOfMidnight = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
      const daysToExpiry = Math.round((expiryDate.getTime() - asOfMidnight.getTime()) / 86_400_000);
      groups.set(r.expiration, { expiration: r.expiration, daysToExpiry, positions: [entry] });
    }
  }
  return [...groups.values()].sort((a, b) => a.daysToExpiry - b.daysToExpiry);
}

// ─── Full Dashboard Composition ─────────────────────────────────────────

export interface OptionsIncomeDashboard {
  overview: OptionsIncomeOverview;
  strategyMix: StrategyMixEntry[];
  upcomingExpirations: UpcomingExpirationGroup[];
  generatedAt: string;
}

export function buildOptionsIncomeDashboard(input: {
  openRows: { id: number; symbol: string; strategy: string; credit: number; maxLoss: number; expiration: string | null }[];
  closedRows: { credit: number }[];
  thetaPositions: ThetaPosition[];
}): OptionsIncomeDashboard {
  return {
    overview: buildIncomeOverview(input.openRows, input.closedRows, input.thetaPositions),
    strategyMix: buildStrategyMix(input.openRows),
    upcomingExpirations: buildUpcomingExpirations(input.openRows),
    generatedAt: new Date().toISOString(),
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

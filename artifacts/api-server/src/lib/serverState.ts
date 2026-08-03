// Shared server-side state helpers: settings singleton, account valuation,
// per-trade greeks computed from stored legs, and demo-trade seeding.
import { db, tradesTable, settingsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import {
  getSnapshot,
  bs,
  buildIronCondor,
  buildCalendar,
  type StrategyQuote,
} from "./optionsMath.js";
import { getLegacyOwnerUserId } from "./legacyOwner.js";

export const ACCOUNT_BASE = 125000;

export interface StoredLeg {
  side: "buy" | "sell";
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  openPrice: number;
  quantity: number;
}

// Phase 1, Sprint 5 — settings is now per-user. `userId` defaults to the
// legacy-owner stand-in (see lib/legacyOwner.ts) so every existing caller
// keeps working unchanged until Sprint 6/7 thread the real authenticated
// user through. The automation scheduler (autoExecution.ts/autoAdjustment.ts)
// deliberately keeps calling this with no argument — per the approved plan's
// §4.4, its real per-user multi-tenancy design is an explicit owner decision
// for a later, dedicated sprint, not something this sprint changes.
// Database-maintenance fix (not part of any UX/feature sprint) — see
// docs/Database-Concurrency-Fixes.md. Was a check-then-insert: a SELECT
// for an existing row, then an unconditional INSERT if none was found.
// Two concurrent callers for the same brand-new user (e.g. several
// widgets on the Institutional Home page each independently resolving
// this user's settings on first mount) could both pass the SELECT before
// either INSERT committed, so the second INSERT threw an uncaught
// unique-constraint violation on settings_user_id_unique — an uncaught
// 500, not a caught/handled duplicate. Replaced with a single atomic
// INSERT ... ON CONFLICT (user_id) DO UPDATE, which always RETURNING
// exactly one row in one round trip regardless of which concurrent
// caller's own INSERT statement actually wins the race — the losing
// caller's "update" is a genuine no-op (it writes user_id back to its
// own already-correct value), so no data is ever changed by the conflict
// path itself, only guaranteed-returned.
export async function getSettingsRow(userId?: string) {
  const resolvedUserId = userId ?? (await getLegacyOwnerUserId());
  const [row] = await db
    .insert(settingsTable)
    .values({ userId: resolvedUserId })
    .onConflictDoUpdate({
      target: settingsTable.userId,
      set: { userId: sql`excluded.user_id` },
    })
    .returning();
  return row;
}

export async function getAccountValue(userId: string): Promise<number> {
  const closed = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.status, "closed"), eq(tradesTable.userId, userId)));
  const realized = closed.reduce((s, t) => s + (t.currentPnl ?? 0), 0);
  return ACCOUNT_BASE + realized;
}

// Exported (additive, Portfolio Stress Test sprint) so
// lib/portfolioStressTest.ts can reuse the exact same days-to-expiration
// derivation this file's own computeTradeGreeks() already uses — zero
// behavior change to this file's own exports/tests.
export function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 30;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
}

export interface TradeGreeks {
  delta: number;
  gamma: number;
  theta: number; // dollars/day
  vega: number; // dollars per 1% vol
  costToClose: number; // dollars
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export function computeTradeGreeks(trade: {
  symbol: string;
  legs: unknown;
  credit: number;
  maxProfit: number;
}): TradeGreeks {
  const snap = getSnapshot(trade.symbol);
  const legs = (trade.legs as StoredLeg[]) ?? [];
  let delta = 0;
  let gamma = 0;
  let theta = 0;
  let vega = 0;
  let sellMid = 0;
  let buyMid = 0;
  if (snap) {
    for (const leg of legs) {
      const T = daysUntil(leg.expiration) / 365;
      const g = bs(snap.price, leg.strike, T, snap.iv, leg.optionType);
      const sign = leg.side === "sell" ? -1 : 1;
      delta += sign * g.delta * leg.quantity;
      gamma += sign * g.gamma * leg.quantity;
      theta += sign * g.theta * leg.quantity * 100;
      vega += sign * g.vega * leg.quantity * 100;
      if (leg.side === "sell") sellMid += g.price * leg.quantity;
      else buyMid += g.price * leg.quantity;
    }
  }
  const costToClose = (sellMid - buyMid) * 100;
  const unrealizedPnl = trade.credit - costToClose;
  const denom = Math.max(Math.abs(trade.credit), 1);
  return {
    delta: Math.round(delta * 1000) / 1000,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
    costToClose: Math.round(costToClose * 100) / 100,
    currentValue: Math.round(costToClose * 100) / 100,
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    unrealizedPnlPercent: Math.round((unrealizedPnl / denom) * 1000) / 10,
  };
}

// Seed a few realistic open positions so the portfolio/dashboard isn't empty.
export async function ensureSeedTrades(userId: string): Promise<void> {
  const existing = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.userId, userId))
    .limit(1);
  if (existing[0]) return;

  const quotes: (StrategyQuote | null)[] = [
    snapQuote("SPY", "ic"),
    snapQuote("QQQ", "ic"),
    snapQuote("NVDA", "cal"),
  ];

  // Phase 9 — Production Readiness. Previously 3 sequential single-row
  // INSERTs (3 round-trips); one real row's worth of output is unchanged,
  // this is a pure round-trip-count reduction, not a behavior change.
  const rows = quotes
    .filter((quote): quote is StrategyQuote => quote !== null)
    .map((quote) => ({
      userId,
      symbol: quote.symbol,
      strategy: quote.strategy,
      status: "open" as const,
      executionMode: "manual" as const,
      legs: quote.legs as unknown as typeof tradesTable.$inferInsert["legs"],
      expiration: quote.expiration,
      credit: quote.credit,
      maxProfit: quote.maxProfit,
      maxLoss: quote.maxLoss,
      pop: quote.pop,
      ev: quote.ev,
      theta: quote.theta,
      ravishScore: quote.ravishScore,
    }));

  if (rows.length === 0) return;
  await db.insert(tradesTable).values(rows);
}

function snapQuote(symbol: string, kind: "ic" | "cal"): StrategyQuote | null {
  const snap = getSnapshot(symbol);
  if (!snap) return null;
  return kind === "ic" ? buildIronCondor(snap) : buildCalendar(snap);
}

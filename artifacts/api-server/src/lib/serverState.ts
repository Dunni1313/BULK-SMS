// Shared server-side state helpers: settings singleton, account valuation,
// per-trade greeks computed from stored legs, and demo-trade seeding.
import { db, tradesTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getSnapshot,
  bs,
  buildIronCondor,
  buildCalendar,
  type StrategyQuote,
} from "./optionsMath.js";

export const ACCOUNT_BASE = 125000;

export interface StoredLeg {
  side: "buy" | "sell";
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  openPrice: number;
  quantity: number;
}

export async function getSettingsRow() {
  const existing = await db.select().from(settingsTable).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db.insert(settingsTable).values({}).returning();
  return created;
}

export async function getAccountValue(): Promise<number> {
  const closed = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.status, "closed"));
  const realized = closed.reduce((s, t) => s + (t.currentPnl ?? 0), 0);
  return ACCOUNT_BASE + realized;
}

function daysUntil(dateStr: string | null): number {
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
export async function ensureSeedTrades(): Promise<void> {
  const existing = await db.select().from(tradesTable).limit(1);
  if (existing[0]) return;

  const seeds: { quote: StrategyQuote | null }[] = [
    { quote: snapQuote("SPY", "ic") },
    { quote: snapQuote("QQQ", "ic") },
    { quote: snapQuote("NVDA", "cal") },
  ];

  for (const { quote } of seeds) {
    if (!quote) continue;
    await db.insert(tradesTable).values({
      symbol: quote.symbol,
      strategy: quote.strategy,
      status: "open",
      executionMode: "manual",
      legs: quote.legs as unknown as typeof tradesTable.$inferInsert["legs"],
      expiration: quote.expiration,
      credit: quote.credit,
      maxProfit: quote.maxProfit,
      maxLoss: quote.maxLoss,
      pop: quote.pop,
      ev: quote.ev,
      theta: quote.theta,
      ravishScore: quote.ravishScore,
    });
  }
}

function snapQuote(symbol: string, kind: "ic" | "cal"): StrategyQuote | null {
  const snap = getSnapshot(symbol);
  if (!snap) return null;
  return kind === "ic" ? buildIronCondor(snap) : buildCalendar(snap);
}

// Phase 3, Sprint 49 — Institutional Trading Engine, Backtesting (approved
// Phase 3 plan §18; see docs/Phase-3-Trading-Engine-Execution-Plan.md's
// Sprint 49 as-built note).
//
// Deliberately a thin route wrapper, matching every prior Engine 2 route's
// own established discipline — zero business logic here, calling straight
// through to lib/tradingBacktest.ts's already-tested buildTradingBacktest()
// via the Sprint 32 MarketDataProvider seam. The only genuinely new
// route-level responsibility is persisting the result to the calling
// user's own history, since this is the first Engine 2 module whose
// result is meant to be looked back on later (a backtest run, unlike a
// point-in-time structure/regime/probability read, is itself the record
// a trader wants to keep).
//
// POST /trading/backtest/run is ownership-scoped via getScopedUserId(req)
// — every persisted row belongs to exactly one user, matching
// routes/tradingJournal.ts's and routes/tradingPositions.ts's own
// established pattern — 404 for an unresolvable symbol, never a
// fabricated backtest. GET /trading/backtest/results lists only the
// calling user's own rows, newest first, matching every other
// user-scoped list endpoint's and(eq(userId))-only query shape.
//
// routes/backtest.ts (the options-side equity-curve generator) is not
// touched by this file at all.

import { Router, type IRouter } from "express";
import { db, tradingBacktestResultsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { buildTradingBacktest } from "../lib/tradingBacktest.js";
import { getMarketDataProvider } from "../lib/tradingMarketData.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { RunTradingBacktestBody, RunTradingBacktestResponse, ListTradingBacktestResultsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_LOOKBACK = 180;

// Newest-first, bounded — a history list, not a full dump, matching
// routes/tradingCoach.ts's own RECENT_JOURNAL_ENTRIES_LIMIT precedent for
// "how many rows is enough to be useful without being unbounded."
const RESULTS_LIST_LIMIT = 50;

function formatRow(row: typeof tradingBacktestResultsTable.$inferSelect) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    symbol: row.symbol,
    strategy: row.strategy,
    interval: row.interval,
    dataSource: row.dataSource,
    candleCount: row.candleCount,
    available: row.available,
    unavailableReason: row.unavailableReason ?? null,
    trades: row.tradeLog ?? [],
    totalTrades: row.totalTrades,
    winRate: row.winRate ?? null,
    avgR: row.avgR ?? null,
    totalReturnPct: row.totalReturnPct ?? null,
    maxDrawdownPct: row.maxDrawdownPct ?? null,
    sharpeRatio: row.sharpeRatio ?? null,
    equityCurve: row.equityCurve ?? [],
    summary: row.summary,
  };
}

router.post("/trading/backtest/run", async (req, res): Promise<void> => {
  const parsed = RunTradingBacktestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;

  const userId = await getScopedUserId(req);
  const provider = await getMarketDataProvider(userId);
  const result = await buildTradingBacktest(
    d.symbol,
    d.strategy,
    d.interval ?? "1D",
    d.lookback ?? DEFAULT_LOOKBACK,
    provider,
    { stopLossPct: d.stopLossPct, targetPct: d.targetPct },
  );

  if (!result) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  const [row] = await db
    .insert(tradingBacktestResultsTable)
    .values({
      userId,
      symbol: result.symbol,
      strategy: result.strategy,
      interval: result.interval,
      dataSource: result.dataSource,
      candleCount: result.candleCount,
      available: result.available,
      unavailableReason: result.unavailableReason,
      totalTrades: result.totalTrades,
      winRate: result.winRate,
      avgR: result.avgR,
      totalReturnPct: result.totalReturnPct,
      maxDrawdownPct: result.maxDrawdownPct,
      sharpeRatio: result.sharpeRatio,
      equityCurve: result.equityCurve,
      tradeLog: result.trades,
      summary: result.summary,
    })
    .returning();

  res.status(201).json(
    RunTradingBacktestResponse.parse({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      symbol: result.symbol,
      strategy: result.strategy,
      interval: result.interval,
      dataSource: result.dataSource,
      candleCount: result.candleCount,
      available: result.available,
      unavailableReason: result.unavailableReason,
      trades: result.trades,
      totalTrades: result.totalTrades,
      winRate: result.winRate,
      avgR: result.avgR,
      totalReturnPct: result.totalReturnPct,
      maxDrawdownPct: result.maxDrawdownPct,
      sharpeRatio: result.sharpeRatio,
      equityCurve: result.equityCurve,
      summary: result.summary,
    }),
  );
});

router.get("/trading/backtest/results", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(tradingBacktestResultsTable)
    .where(eq(tradingBacktestResultsTable.userId, userId))
    .orderBy(desc(tradingBacktestResultsTable.createdAt))
    .limit(RESULTS_LIST_LIMIT);

  res.json(ListTradingBacktestResultsResponse.parse(rows.map(formatRow)));
});

export default router;

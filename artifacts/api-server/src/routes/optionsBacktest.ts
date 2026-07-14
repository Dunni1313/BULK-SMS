// Phase 4, Sprint 58 — Options Engine-Native Backtesting (Route + UI)
// (approved Phase 4 plan, Sprint 58; conditional on Sprint 57's own Core
// output proving valuable — confirmed via a real 180-day SPY run producing
// 10 real trades, 90% win rate, deterministic across repeated calls; see
// docs/Phase-4-Master-Execution-Plan.md's Sprint 58 as-built note).
//
// Deliberately a thin route wrapper, mirroring
// routes/tradingBacktest.ts's own Sprint 49 established discipline — zero
// business logic here, calling straight through to
// lib/optionsBacktest.ts's already-tested buildOptionsBacktest() via the
// Sprint 32 MarketDataProvider seam. The only genuinely new route-level
// responsibility is persisting the result to the calling user's own
// history, the same "a backtest run is itself the record a trader wants
// to keep" reasoning routes/tradingBacktest.ts's own header comment
// already established.
//
// POST /options-backtest/run is ownership-scoped via getScopedUserId(req)
// — every persisted row belongs to exactly one user — 404 for an
// unresolvable symbol, never a fabricated backtest. GET
// /options-backtest/results lists only the calling user's own rows,
// newest first.
//
// routes/backtest.ts (the legacy options-side equity-curve generator) is
// not touched by this file at all.

import { Router, type IRouter } from "express";
import { db, optionsBacktestResultsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { buildOptionsBacktest, type OptionsBacktestStrategy } from "../lib/optionsBacktest.js";
import { getMarketDataProvider } from "../lib/tradingMarketData.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { RunOptionsBacktestBody, RunOptionsBacktestResponse, ListOptionsBacktestResultsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_LOOKBACK = 180;

// Newest-first, bounded — matches routes/tradingBacktest.ts's own
// RESULTS_LIST_LIMIT precedent.
const RESULTS_LIST_LIMIT = 50;

function formatRow(row: typeof optionsBacktestResultsTable.$inferSelect) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    symbol: row.symbol,
    strategy: row.strategy,
    underlyingDataSource: row.underlyingDataSource,
    optionsDataSource: row.optionsDataSource,
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

router.post("/options-backtest/run", async (req, res): Promise<void> => {
  const parsed = RunOptionsBacktestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;

  const userId = await getScopedUserId(req);
  const provider = await getMarketDataProvider(userId);
  const result = await buildOptionsBacktest(
    d.symbol,
    d.strategy as OptionsBacktestStrategy,
    d.lookback ?? DEFAULT_LOOKBACK,
    provider,
    {
      entryDte: d.entryDte,
      shortDelta: d.shortDelta,
      profitTargetPct: d.profitTargetPct,
      stopLossMultiple: d.stopLossMultiple,
      dteExitTrigger: d.dteExitTrigger,
    },
  );

  if (!result) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  const [row] = await db
    .insert(optionsBacktestResultsTable)
    .values({
      userId,
      symbol: result.symbol,
      strategy: result.strategy,
      underlyingDataSource: result.underlyingDataSource,
      optionsDataSource: result.optionsDataSource,
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
    RunOptionsBacktestResponse.parse({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      symbol: result.symbol,
      strategy: result.strategy,
      underlyingDataSource: result.underlyingDataSource,
      optionsDataSource: result.optionsDataSource,
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

router.get("/options-backtest/results", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(optionsBacktestResultsTable)
    .where(eq(optionsBacktestResultsTable.userId, userId))
    .orderBy(desc(optionsBacktestResultsTable.createdAt))
    .limit(RESULTS_LIST_LIMIT);

  res.json(ListOptionsBacktestResultsResponse.parse(rows.map(formatRow)));
});

export default router;

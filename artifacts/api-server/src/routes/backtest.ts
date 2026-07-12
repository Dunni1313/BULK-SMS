import { Router, type IRouter } from "express";
import { db, backtestResultsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  RunBacktestBody,
  RunBacktestResponse,
  ListBacktestResultsResponse,
} from "@workspace/api-zod";
import { makeRng } from "../lib/optionsMath.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

function generateEquityCurve(
  months: number,
  totalReturn: number,
  rng: () => number,
): { date: string; value: number; drawdown: number | null }[] {
  const points = [];
  let value = 100000;
  let peak = value;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  for (let i = 0; i <= months * 4; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * 7);
    const weeklyReturn = (totalReturn / 100 / (months * 4)) * (0.5 + rng());
    value = value * (1 + weeklyReturn - 0.002 + (rng() - 0.6) * 0.01);
    if (value > peak) peak = value;
    const drawdown = ((value - peak) / peak) * 100;
    points.push({
      date: d.toISOString().split("T")[0],
      value: Math.round(value * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    });
  }
  return points;
}

router.post("/backtest/run", async (req, res): Promise<void> => {
  const parsed = RunBacktestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { symbol, strategy, period } = parsed.data;
  const periodMonths = period === "5y" ? 60 : period === "2y" ? 24 : 12;

  // Deterministic per (symbol, strategy, period) so repeated backtests are stable.
  const rng = makeRng(`backtest-${symbol}-${strategy}-${period}`);

  const winRate = 0.65 + rng() * 0.20;
  const avgWin = 180 + rng() * 120;
  const avgLoss = 350 + rng() * 200;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;
  const totalTrades = Math.floor(periodMonths * 2.5);
  const totalReturn = expectancy * totalTrades / 1000;
  const sharpe = 0.8 + rng() * 1.4;

  const equityCurve = generateEquityCurve(periodMonths, totalReturn, rng);
  const drawdowns = equityCurve.map((p) => p.drawdown || 0);
  const maxDrawdown = Math.min(...drawdowns);

  const userId = await getScopedUserId(req);
  const [result] = await db
    .insert(backtestResultsTable)
    .values({
      userId,
      symbol,
      strategy,
      period,
      winRate,
      avgWin,
      avgLoss,
      expectancy,
      maxDrawdown: Math.abs(maxDrawdown),
      sharpeRatio: sharpe,
      sortinoRatio: sharpe * (1.1 + rng() * 0.3),
      totalTrades,
      totalReturn,
      evPerTrade: expectancy,
      evMonthly: expectancy * 2.5,
      evAnnualized: expectancy * 30,
      equityCurve: equityCurve as unknown as typeof backtestResultsTable.$inferInsert["equityCurve"],
    })
    .returning();

  res.json(
    RunBacktestResponse.parse({
      ...result,
      equityCurve: equityCurve,
      createdAt: result.createdAt.toISOString(),
    }),
  );
});

router.get("/backtest/results", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const results = await db
    .select()
    .from(backtestResultsTable)
    .where(eq(backtestResultsTable.userId, userId))
    .orderBy(desc(backtestResultsTable.createdAt))
    .limit(20);

  res.json(
    ListBacktestResultsResponse.parse(
      results.map((r) => ({
        ...r,
        equityCurve: (r.equityCurve as unknown[]) || [],
        createdAt: r.createdAt.toISOString(),
      })),
    ),
  );
});

export default router;

import { Router, type IRouter } from "express";
import { db, tradesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetPortfolioPositionsResponse,
  GetPortfolioGreeksResponse,
  GetPortfolioSummaryResponse,
  GetRiskStatusResponse,
  GetThetaIncomeResponse,
} from "@workspace/api-zod";
import { getSnapshot, bs } from "../lib/optionsMath.js";
import { computePortfolioRisk } from "../lib/risk.js";
import { computeThetaIncome } from "../lib/thetaIncome.js";
import {
  ACCOUNT_BASE,
  computeTradeGreeks,
  ensureSeedTrades,
  getAccountValue,
  getSettingsRow,
  type StoredLeg,
} from "../lib/serverState.js";

const router: IRouter = Router();

async function openTrades() {
  await ensureSeedTrades();
  return db.select().from(tradesTable).where(eq(tradesTable.status, "open"));
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 30;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
}

router.get("/portfolio/positions", async (_req, res): Promise<void> => {
  const trades = await openTrades();
  const snapCache = new Map<string, ReturnType<typeof getSnapshot>>();

  const positions = trades.map((t) => {
    const g = computeTradeGreeks(t);
    if (!snapCache.has(t.symbol)) snapCache.set(t.symbol, getSnapshot(t.symbol));
    const snap = snapCache.get(t.symbol);
    const legs = (t.legs as StoredLeg[]) ?? [];
    return {
      id: `pos-${t.id}`,
      symbol: t.symbol,
      strategy: t.strategy,
      legs: legs.map((leg) => {
        const T = daysUntil(leg.expiration) / 365;
        const currentPrice = snap
          ? Math.round(bs(snap.price, leg.strike, T, snap.iv, leg.optionType).price * 100) / 100
          : null;
        return {
          symbol: t.symbol,
          side: leg.side === "sell" ? ("short" as const) : ("long" as const),
          quantity: leg.quantity,
          strike: leg.strike,
          type: leg.optionType,
          expiration: leg.expiration,
          openPrice: leg.openPrice,
          currentPrice,
        };
      }),
      openDate: t.openDate.toISOString(),
      expiration: t.expiration,
      credit: t.credit,
      currentValue: g.currentValue,
      unrealizedPnl: g.unrealizedPnl,
      unrealizedPnlPercent: g.unrealizedPnlPercent,
      delta: g.delta,
      theta: g.theta,
      vega: g.vega,
      gamma: g.gamma,
      status: "open" as const,
    };
  });

  res.json(GetPortfolioPositionsResponse.parse(positions));
});

router.get("/portfolio/greeks", async (_req, res): Promise<void> => {
  const trades = await openTrades();

  let totalDelta = 0;
  let totalTheta = 0;
  let totalVega = 0;
  let totalGamma = 0;
  let directionalExposure = 0;

  for (const t of trades) {
    const g = computeTradeGreeks(t);
    totalDelta += g.delta;
    totalTheta += g.theta;
    totalVega += g.vega;
    totalGamma += g.gamma;
    const snap = getSnapshot(t.symbol);
    if (snap) directionalExposure += g.delta * snap.price;
  }

  totalDelta = Math.round(totalDelta * 100) / 100;
  totalTheta = Math.round(totalTheta * 100) / 100;
  totalVega = Math.round(totalVega * 100) / 100;
  totalGamma = Math.round(totalGamma * 1000) / 1000;
  directionalExposure = Math.round(directionalExposure);

  const deltaStatus =
    Math.abs(totalDelta) < 0.1 ? "neutral" : totalDelta > 0 ? "bullish" : "bearish";
  const deltaNeutralScore = Math.round(Math.max(0, 100 - Math.abs(totalDelta) * 200));
  const monthlyThetaProjection = Math.round(totalTheta * 30);

  const exposureLabel =
    deltaStatus === "neutral"
      ? "Delta-neutral — minimal directional risk"
      : deltaStatus === "bullish"
        ? `Bullish — gains ~$${Math.abs(directionalExposure)} per +1% underlying move`
        : `Bearish — gains ~$${Math.abs(directionalExposure)} per -1% underlying move`;

  const recommendations: string[] = [];
  if (deltaStatus === "neutral") {
    recommendations.push("Portfolio is near delta neutral — no adjustment needed");
  } else {
    recommendations.push(
      `Portfolio is ${deltaStatus} (delta ${totalDelta}). Consider an offsetting position to re-center.`,
    );
  }
  if (totalTheta > 0) {
    recommendations.push(
      `Positive theta of $${totalTheta.toFixed(2)}/day, projecting ~$${monthlyThetaProjection}/month`,
    );
  }
  if (totalVega < 0) {
    recommendations.push(
      `Short vega (${totalVega}) — you benefit from falling IV; trim if a vol spike is expected`,
    );
  } else if (totalVega > 0) {
    recommendations.push(`Long vega (${totalVega}) — you benefit from rising IV`);
  }

  res.json(
    GetPortfolioGreeksResponse.parse({
      totalDelta,
      totalTheta,
      totalVega,
      totalGamma,
      deltaStatus,
      deltaNeutralScore,
      directionalExposure,
      exposureLabel,
      dailyThetaIncome: totalTheta,
      monthlyThetaProjection,
      totalPositions: trades.length,
      recommendations,
    }),
  );
});

router.get("/portfolio/summary", async (_req, res): Promise<void> => {
  const trades = await openTrades();
  const accountValue = await getAccountValue();

  let unrealized = 0;
  let riskDollars = 0;
  for (const t of trades) {
    unrealized += computeTradeGreeks(t).unrealizedPnl;
    riskDollars += Math.max(0, t.maxLoss);
  }
  unrealized = Math.round(unrealized * 100) / 100;
  const totalPnl = accountValue - ACCOUNT_BASE + unrealized;

  res.json(
    GetPortfolioSummaryResponse.parse({
      accountValue: Math.round((accountValue + unrealized) * 100) / 100,
      cashBalance: Math.round((accountValue - riskDollars) * 100) / 100,
      buyingPower: Math.round((accountValue - riskDollars) * 2 * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      totalPnlPercent: Math.round((totalPnl / ACCOUNT_BASE) * 10000) / 100,
      dayPnl: unrealized,
      dayPnlPercent: Math.round((unrealized / ACCOUNT_BASE) * 10000) / 100,
      openPositions: trades.length,
      maxRiskUsed: Math.round((riskDollars / accountValue) * 10000) / 100,
    }),
  );
});

router.get("/portfolio/risk", async (_req, res): Promise<void> => {
  const trades = await openTrades();
  const accountValue = await getAccountValue();
  const settings = await getSettingsRow();

  const status = computePortfolioRisk(
    trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      strategy: t.strategy,
      credit: t.credit,
      maxLoss: t.maxLoss,
    })),
    accountValue,
    {
      maxRiskPerTrade: settings.maxRiskPerTrade,
      maxPortfolioRisk: settings.maxPortfolioRisk,
      stopLossMultiplier: settings.stopLossMultiplier,
      profitTarget50: settings.profitTarget50,
      profitTarget75: settings.profitTarget75,
      profitTarget90: settings.profitTarget90,
    },
  );

  res.json(GetRiskStatusResponse.parse(status));
});

// Theta income across daily/weekly/monthly/annualized horizons, with breakdowns.
router.get("/portfolio/theta", async (_req, res): Promise<void> => {
  const trades = await openTrades();
  const positions = trades.map((t) => ({
    symbol: t.symbol,
    strategy: t.strategy,
    theta: computeTradeGreeks(t).theta,
  }));
  res.json(GetThetaIncomeResponse.parse(computeThetaIncome(positions)));
});

export default router;

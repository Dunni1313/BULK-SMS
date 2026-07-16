import { Router, type IRouter } from "express";
import { db, scannerResultsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  GetScannerResultsResponse,
  RunScannerResponse,
  GetTopOpportunitiesResponse,
  GetEarningsScanResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import {
  UNIVERSE,
  UNIVERSE_SYMBOLS,
  getSnapshot,
  expirationFromDte,
  type StrategyQuote,
} from "../lib/optionsMath.js";
import { runScan } from "../lib/liveScanner.js";
import { analyzeEarnings } from "../lib/earnings.js";
import { setLastScanHealth } from "../lib/marketDataHealth.js";
import { getSettingsRow } from "../lib/serverState.js";

const router: IRouter = Router();

function quoteToRow(q: StrategyQuote, userId: string) {
  return {
    userId,
    symbol: q.symbol,
    strategy: q.strategy,
    expiration: q.expiration,
    daysToExpiry: q.daysToExpiry,
    shortPutStrike: q.shortPutStrike,
    shortCallStrike: q.shortCallStrike,
    longPutStrike: q.longPutStrike,
    longCallStrike: q.longCallStrike,
    credit: q.credit,
    maxProfit: q.maxProfit,
    maxLoss: q.maxLoss,
    pop: q.pop,
    ev: q.ev,
    theta: q.theta,
    vega: q.vega,
    ivRank: q.ivRank,
    ravishScore: q.ravishScore,
    ravishTier: q.ravishTier,
    returnOnCapital: q.returnOnCapital,
    eventRiskLevel: q.eventRiskLevel,
    eventRiskPenalty: q.eventRiskPenalty,
    eventRiskEvents: q.eventRiskEvents,
    status: "active",
  };
}

// Scan the universe through the active provider (mock or live), persisting the
// accepted strategies and caching the health metrics for the health panel.
async function scanAndPersist(
  userId: string,
  overrides: { shortDelta?: number; defaultDte?: number } = {},
) {
  const settings = await getSettingsRow(userId);
  const { quotes, health } = await runScan(
    {
      scannerMode: settings.scannerMode,
      marketDataProvider: settings.marketDataProvider,
      alpacaApiKey: settings.alpacaApiKey,
      shortDelta: overrides.shortDelta ?? settings.shortDelta,
      defaultDte: overrides.defaultDte ?? settings.defaultDte,
      eventRiskEnabled: settings.eventRiskEnabled,
    },
    UNIVERSE_SYMBOLS,
  );
  setLastScanHealth(health);
  return { rows: quotes.map((q) => quoteToRow(q, userId)), health };
}

router.get("/scanner/results", async (req, res): Promise<void> => {
  const strategy = req.query.strategy as string | undefined;
  const limit = Number(req.query.limit) || 20;

  const userId = await getScopedUserId(req);
  const results = await db
    .select()
    .from(scannerResultsTable)
    .where(eq(scannerResultsTable.userId, userId))
    .orderBy(desc(scannerResultsTable.ravishScore))
    .limit(200);

  const filtered = (strategy ? results.filter((r) => r.strategy === strategy) : results).slice(
    0,
    limit,
  );

  res.json(
    GetScannerResultsResponse.parse(
      filtered.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    ),
  );
});

router.post("/scanner/run", async (req, res): Promise<void> => {
  const shortDelta = req.body?.shortDelta != null ? Number(req.body.shortDelta) : undefined;
  const dte = req.body?.daysToExpiry != null ? Number(req.body.daysToExpiry) : undefined;

  const userId = await getScopedUserId(req);
  const { rows, health } = await scanAndPersist(userId, { shortDelta, defaultDte: dte });

  await db.delete(scannerResultsTable).where(eq(scannerResultsTable.userId, userId));
  if (rows.length > 0) {
    await db.insert(scannerResultsTable).values(rows);
  }

  res.json(
    RunScannerResponse.parse({
      status: "completed",
      message: `Scanner completed in ${health.mode} mode (${health.provider}). Found ${rows.length} qualifying opportunities after liquidity and EV filters.`,
      resultsCount: rows.length,
    }),
  );
});

router.get("/scanner/top", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  let all = await db
    .select()
    .from(scannerResultsTable)
    .where(and(eq(scannerResultsTable.status, "active"), eq(scannerResultsTable.userId, userId)))
    .orderBy(desc(scannerResultsTable.ravishScore))
    .limit(200);

  // Auto-seed on first load so the dashboard is never empty.
  if (all.length === 0) {
    const { rows } = await scanAndPersist(userId);
    if (rows.length > 0) {
      await db.insert(scannerResultsTable).values(rows);
      all = await db
        .select()
        .from(scannerResultsTable)
        .where(and(eq(scannerResultsTable.status, "active"), eq(scannerResultsTable.userId, userId)))
        .orderBy(desc(scannerResultsTable.ravishScore))
        .limit(200);
    }
  }

  const pick = (strategy: string) =>
    all
      .filter((r) => r.strategy === strategy)
      .slice(0, 3)
      .map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));

  res.json(
    GetTopOpportunitiesResponse.parse({
      ironCondors: pick("iron_condor"),
      ironFlys: pick("iron_fly"),
      calendarSpreads: pick("calendar_spread"),
      earnings: pick("earnings"),
      lastScanned: all[0]?.createdAt.toISOString() ?? null,
    }),
  );
});

// Earnings scanner: near-term events with elevated IV and a recommended structure.
router.get("/scanner/earnings", async (_req, res): Promise<void> => {
  const plays = [];
  for (const u of UNIVERSE) {
    const snap = getSnapshot(u.symbol);
    if (!snap) continue;
    const play = analyzeEarnings({
      symbol: snap.symbol,
      name: snap.name,
      price: snap.price,
      iv: snap.iv,
      ivRank: snap.ivRank,
      ivBase: u.ivBase,
      earningsInDays: snap.earningsInDays,
      earningsDate:
        snap.earningsInDays !== null ? expirationFromDte(snap.earningsInDays) : null,
    });
    if (play) plays.push(play);
  }
  plays.sort((a, b) => a.daysToEarnings - b.daysToEarnings);
  res.json(GetEarningsScanResponse.parse(plays));
});

export default router;

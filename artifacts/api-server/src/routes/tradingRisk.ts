// Phase 3, Sprint 44 — Institutional Trading Engine, Risk Management Route
// + UI (fifth bounded slice of the approved Route+UI backlog reduction —
// see docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 44 as-built
// note). Deliberately a thin route wrapper, mirroring
// routes/tradingStructure.ts's/tradingMultiTimeframe.ts's/tradingRegime.ts's/
// tradingProbability.ts's own Sprint 40-43 pattern — this endpoint contains
// zero risk-scoring logic of its own, calling straight through to Sprint
// 38's already-tested buildTradingRiskAnalysis() (which itself transitively
// resolves Sprint 36's Market Regime Engine — and through it Multi-
// Timeframe, Liquidity, Market Structure, and the MarketDataProvider — for
// each open, stop/target-defined position's probability context). Exposes
// an existing engine; does not reimplement one.
//
// Unlike Sprint 40-43's per-symbol routes, this route is portfolio-wide,
// not keyed by a searched symbol — it reads the calling user's own
// `trading_positions` rows (Sprint 44's new routes/tradingPositions.ts) and
// their own `tradingAccountValue` setting (Sprint 44's new settings
// column), so — unlike every prior Engine 2 route — it IS ownership-scoped
// via getScopedUserId(req), the same discipline routes/tradingJournal.ts
// and routes/tradingPositions.ts already apply to this user's own rows.
//
// Eager, no query overrides — always Sprint 38's own
// DEFAULT_RISK_PROBABILITY_HORIZON_DAYS.
//
// Never fabricates: a user with no positions or no account value set gets
// an honest "insufficient data" read from computeTradingRisk() itself —
// this route never substitutes a default account value or a fabricated
// position.

import { Router, type IRouter } from "express";
import { db, tradingPositionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { buildTradingRiskAnalysis, type TradingPositionInput } from "../lib/tradingRisk.js";
import { getMarketDataProvider } from "../lib/tradingMarketData.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { getSettingsRow } from "../lib/serverState.js";
import { GetTradingRiskResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trading/risk", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);

  const rows = await db.select().from(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  const positions: TradingPositionInput[] = rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    side: r.side === "short" ? "short" : "long",
    status: r.status === "closed" ? "closed" : "open",
    quantity: r.quantity,
    entryPrice: r.entryPrice,
    stopPrice: r.stopPrice ?? null,
    targetPrice: r.targetPrice ?? null,
  }));

  const settings = await getSettingsRow(userId);
  const provider = await getMarketDataProvider(userId);

  const analysis = await buildTradingRiskAnalysis(positions, settings.tradingAccountValue ?? null, provider);

  res.json(GetTradingRiskResponse.parse(analysis));
});

export default router;

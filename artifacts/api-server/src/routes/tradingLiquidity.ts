// Phase 3, Sprint 45 — Institutional Trading Engine, Liquidity Route + UI
// (sixth bounded slice of the approved Route+UI backlog reduction — see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 45 as-built note).
// Deliberately a thin route wrapper, mirroring routes/tradingStructure.ts's
// own Sprint 40 pattern exactly (including its ?interval=&lookback= query
// override support) — this endpoint contains zero business logic of its
// own, calling straight through to Sprint 35's already-tested
// buildLiquidityAnalysis() via Sprint 32's MarketDataProvider seam. Exposes
// an existing engine; does not reimplement or recalculate it.
//
// Per §21's own on-demand-vs-eager split ("Liquidity + Order Flow... are
// the heavier, on-demand-tab pattern"), this route backs an on-demand
// Trading Research tab (TradingResearch.tsx's new "Liquidity" tab),
// fetched only when that tab is actually opened for a searched symbol —
// unlike Sprints 40-43's eager cards, which fetch as soon as a symbol is
// searched.
//
// No ownership/tenant scoping needed — read-only market analysis, not a
// user-scoped resource, same as every prior per-symbol Engine 2 route.

import { Router, type IRouter } from "express";
import { buildLiquidityAnalysis } from "../lib/tradingLiquidity.js";
import { getMarketDataProvider, type Timeframe } from "../lib/tradingMarketData.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { GetTradingLiquidityResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const VALID_INTERVALS: Timeframe[] = ["1m", "5m", "15m", "1h", "1D"];
const DEFAULT_INTERVAL: Timeframe = "1D";
const DEFAULT_LOOKBACK = 90;

router.get("/trading/liquidity/:symbol", async (req, res): Promise<void> => {
  const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;

  const rawInterval = typeof req.query.interval === "string" ? req.query.interval : DEFAULT_INTERVAL;
  if (!VALID_INTERVALS.includes(rawInterval as Timeframe)) {
    res.status(400).json({ error: `Invalid interval — must be one of ${VALID_INTERVALS.join(", ")}` });
    return;
  }
  const interval = rawInterval as Timeframe;

  const rawLookback = typeof req.query.lookback === "string" ? Number(req.query.lookback) : DEFAULT_LOOKBACK;
  if (!Number.isFinite(rawLookback) || rawLookback <= 0) {
    res.status(400).json({ error: "Invalid lookback — must be a positive number" });
    return;
  }

  const userId = await getScopedUserId(req);
  const provider = await getMarketDataProvider(userId);
  const analysis = await buildLiquidityAnalysis(symbol, interval, rawLookback, provider);

  if (!analysis) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  res.json(GetTradingLiquidityResponse.parse(analysis));
});

export default router;

// Phase 27 — Institutional Liquidity & Session Workbench.
//
// Deliberately a thin route wrapper, mirroring routes/tradingStructure.ts's
// own established pattern — zero business logic of its own, calling
// straight through to the new tradingLiquidityTimeline.ts's already-tested
// buildLiquidityTimeline() via the existing MarketDataProvider seam.
// Path-parameter-only (default 1D/90, matching the existing Liquidity
// route's own defaults) — no query overrides needed this phase, so this
// route is fully documented and Orval-hook-friendly.

import { Router, type IRouter } from "express";
import { buildLiquidityTimeline } from "../lib/tradingLiquidityTimeline.js";
import { getMarketDataProvider } from "../lib/tradingMarketData.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { GetTradingLiquidityTimelineResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_INTERVAL = "1D" as const;
const DEFAULT_LOOKBACK = 90;

router.get("/trading/liquidity-timeline/:symbol", async (req, res): Promise<void> => {
  const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;

  const userId = await getScopedUserId(req);
  const provider = await getMarketDataProvider(userId);
  const timeline = await buildLiquidityTimeline(symbol, DEFAULT_INTERVAL, DEFAULT_LOOKBACK, provider);

  if (!timeline) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  res.json(GetTradingLiquidityTimelineResponse.parse(timeline));
});

export default router;

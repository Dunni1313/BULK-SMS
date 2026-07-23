// Phase 26 — Institutional Market Structure Workbench. Deliberately a thin
// route wrapper, mirroring routes/tradingStructure.ts's own Sprint 40
// pattern exactly — zero business logic of its own, calling straight
// through to lib/tradingStructureTimeline.ts's already-tested
// buildStructureShiftTimeline() via the existing MarketDataProvider seam.
// No ownership/tenant scoping needed — read-only market analysis, not a
// user-scoped resource.

import { Router, type IRouter } from "express";
import { buildStructureShiftTimeline } from "../lib/tradingStructureTimeline.js";
import { getMarketDataProvider, type Timeframe } from "../lib/tradingMarketData.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { GetTradingStructureTimelineResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const VALID_INTERVALS: Timeframe[] = ["1m", "5m", "15m", "1h", "1D"];
const DEFAULT_INTERVAL: Timeframe = "1D";
const DEFAULT_LOOKBACK = 90;

router.get("/trading/structure-timeline/:symbol", async (req, res): Promise<void> => {
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
  const timeline = await buildStructureShiftTimeline(symbol, interval, rawLookback, provider);

  if (!timeline) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  res.json(GetTradingStructureTimelineResponse.parse(timeline));
});

export default router;

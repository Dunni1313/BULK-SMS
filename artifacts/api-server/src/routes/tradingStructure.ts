// Phase 3, Sprint 40 — Institutional Trading Engine, Market Structure Route
// + UI (first bounded slice of the approved Route+UI backlog reduction —
// see docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 40 as-built
// note). Deliberately a thin route wrapper — this endpoint contains zero
// business logic of its own, calling straight through to Sprint 33's
// already-tested buildMarketStructureAnalysis() via Sprint 32's
// MarketDataProvider seam. Exposes an existing engine; does not reimplement
// one.
//
// No auth-gated data here beyond the standard per-user provider resolution
// (getMarketDataProvider(userId) — always SIMULATED today, per Sprint 32's
// own honest-fallback design) — this is read-only market analysis, not a
// user-scoped resource, so no ownership filtering is needed (unlike
// routes/tradingJournal.ts's user-authored rows).

import { Router, type IRouter } from "express";
import { buildMarketStructureAnalysis } from "../lib/tradingMarketStructure.js";
import { getMarketDataProvider, type Timeframe } from "../lib/tradingMarketData.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { GetTradingStructureResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const VALID_INTERVALS: Timeframe[] = ["1m", "5m", "15m", "1h", "1D"];
const DEFAULT_INTERVAL: Timeframe = "1D";
const DEFAULT_LOOKBACK = 90;

router.get("/trading/structure/:symbol", async (req, res): Promise<void> => {
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
  const analysis = await buildMarketStructureAnalysis(symbol, interval, rawLookback, provider);

  if (!analysis) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  res.json(GetTradingStructureResponse.parse(analysis));
});

export default router;

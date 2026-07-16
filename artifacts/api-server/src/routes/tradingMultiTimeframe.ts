// Phase 3, Sprint 41 — Institutional Trading Engine, Multi-Timeframe Route +
// UI (second bounded slice of the approved Route+UI backlog reduction —
// see docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 41 as-built
// note). Deliberately a thin route wrapper, mirroring
// routes/tradingStructure.ts's own Sprint 40 pattern exactly — this
// endpoint contains zero business logic of its own, calling straight
// through to Sprint 34's already-tested buildMultiTimeframeAnalysis() via
// Sprint 32's MarketDataProvider seam (which itself transitively resolves
// Sprint 33's Market Structure scorer once per timeframe). Exposes an
// existing engine; does not reimplement one.
//
// No query-parameter overrides on this route this sprint (deliberately
// simpler than Sprint 40's interval/lookback overrides) — the confluence
// panel always uses DEFAULT_MULTI_TIMEFRAMES (15m/1h/1D), the same default
// Sprint 34's own module exports. No ownership/tenant scoping needed — read-
// only market analysis, not a user-scoped resource.

import { Router, type IRouter } from "express";
import { buildMultiTimeframeAnalysis } from "../lib/tradingMultiTimeframe.js";
import { getMarketDataProvider } from "../lib/tradingMarketData.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { GetTradingMultiTimeframeResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trading/multi-timeframe/:symbol", async (req, res): Promise<void> => {
  const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;

  const userId = await getScopedUserId(req);
  const provider = await getMarketDataProvider(userId);
  const analysis = await buildMultiTimeframeAnalysis(symbol, provider);

  if (!analysis) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  res.json(GetTradingMultiTimeframeResponse.parse(analysis));
});

export default router;

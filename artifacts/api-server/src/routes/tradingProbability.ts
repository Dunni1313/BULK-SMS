// Phase 3, Sprint 43 — Institutional Trading Engine, Probability Route + UI
// (fourth bounded slice of the approved Route+UI backlog reduction — see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 43 as-built note).
// Deliberately a thin route wrapper, mirroring routes/tradingStructure.ts's,
// routes/tradingMultiTimeframe.ts's, and routes/tradingRegime.ts's own
// Sprint 40/41/42 pattern exactly — this endpoint contains zero business
// logic of its own, calling straight through to Sprint 37's already-tested
// buildProbabilityAnalysis() (which itself transitively resolves Sprint
// 36's Market Regime Engine, Sprint 34's Multi-Timeframe Engine, Sprint
// 35's Liquidity Engine, Sprint 33's Market Structure Engine, and Sprint
// 32's MarketDataProvider). Exposes an existing engine; does not
// reimplement one.
//
// Per §21's own on-demand-vs-eager split ("Market Structure + Regime
// Detection + Probability + Risk are cheap enough to compute eagerly"),
// this route is eager, matching Sprint 40/41/42's own precedent — no
// query-parameter overrides, always the default cone horizons and
// timeframe set.
//
// Disclosed scope choice, same pattern as Sprint 42: the response is a
// deliberate projection of ProbabilityAnalysis's own fields — the full
// nested `regime: TradingRegimeAnalysis` sub-analysis is omitted from this
// endpoint's documented contract (Zod's default non-strict `.parse()`
// naturally strips it) since the Market Regime card (Sprint 42) already
// surfaces that detail on the same page; only the probability-specific
// fields (current price, volatility, availability, the probability cone,
// confidence, summary) are exposed here.
//
// No ownership/tenant scoping needed — read-only market analysis, not a
// user-scoped resource.

import { Router, type IRouter } from "express";
import { buildProbabilityAnalysis } from "../lib/tradingProbability.js";
import { getMarketDataProvider } from "../lib/tradingMarketData.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { GetTradingProbabilityResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trading/probability/:symbol", async (req, res): Promise<void> => {
  const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;

  const userId = await getScopedUserId(req);
  const provider = await getMarketDataProvider(userId);
  const analysis = await buildProbabilityAnalysis(symbol, provider);

  if (!analysis) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  res.json(GetTradingProbabilityResponse.parse(analysis));
});

export default router;

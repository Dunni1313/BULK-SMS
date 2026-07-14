// Phase 3, Sprint 42 — Institutional Trading Engine, Market Regime Route +
// UI (third bounded slice of the approved Route+UI backlog reduction — see
// docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 42 as-built note).
// Deliberately a thin route wrapper, mirroring routes/tradingStructure.ts's
// and routes/tradingMultiTimeframe.ts's own Sprint 40/41 pattern exactly —
// this endpoint contains zero business logic of its own, calling straight
// through to Sprint 36's already-tested buildMarketRegimeAnalysis() (which
// itself transitively resolves Sprint 34's Multi-Timeframe Engine, Sprint
// 35's Liquidity Engine, Sprint 33's Market Structure Engine, and Sprint
// 32's MarketDataProvider). Exposes an existing engine; does not
// reimplement one.
//
// Per §21's own on-demand-vs-eager split ("Market Structure + Regime
// Detection + Probability + Risk are cheap enough to compute eagerly"),
// this route is eager, matching Sprint 40/41's own precedent — no
// query-parameter overrides, always the default timeframe set.
//
// Disclosed scope choice: the response is a deliberate projection of
// TradingRegimeAnalysis's own fields, not the full internal shape —
// `multiTimeframe`/`liquidity`'s full nested sub-analyses are omitted from
// this endpoint's documented contract (Zod's default non-strict `.parse()`
// naturally strips them) since Structure/Multi-Timeframe's own already-
// shipped cards on the same page already surface that detail; only the
// regime-specific summary fields (label, trend/volatility/liquidity axes,
// confidence, summary) are exposed here. Liquidity's own dedicated schema
// doesn't exist yet (its Route+UI remains backlogged), so this keeps
// Sprint 42 bounded to exactly "Regime route + panel" rather than
// prematurely modeling a schema for a module not in this sprint's scope.
//
// No ownership/tenant scoping needed — read-only market analysis, not a
// user-scoped resource.

import { Router, type IRouter } from "express";
import { buildMarketRegimeAnalysis } from "../lib/tradingRegime.js";
import { getMarketDataProvider } from "../lib/tradingMarketData.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { GetTradingRegimeResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trading/regime/:symbol", async (req, res): Promise<void> => {
  const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;

  const userId = await getScopedUserId(req);
  const provider = await getMarketDataProvider(userId);
  const analysis = await buildMarketRegimeAnalysis(symbol, provider);

  if (!analysis) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  res.json(GetTradingRegimeResponse.parse(analysis));
});

export default router;

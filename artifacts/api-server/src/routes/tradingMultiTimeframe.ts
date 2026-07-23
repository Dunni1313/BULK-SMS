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
// Phase 26 — Institutional Market Structure Workbench added an optional,
// backward-compatible ?timeframes= override (comma-separated Timeframe
// values, e.g. "5m,15m,1h,1D") so the Workbench's own Structure Matrix can
// request a caller-chosen subset of the 5 real timeframes the Market Data
// Provider actually supports — buildMultiTimeframeAnalysis() already
// accepted an arbitrary Timeframe[] since Sprint 34; this just wires that
// existing capability through. Omitted (every pre-Phase-26 caller),
// defaults to DEFAULT_MULTI_TIMEFRAMES exactly as before. Deliberately kept
// undocumented in openapi.yaml, matching Sprint 40's own disclosed
// precedent — documenting a path parameter and a query parameter together
// on the same operation triggers a known Orval zod+split-types codegen
// collision (duplicate GetXParams export); the override is fully
// functional server-side, just outside the formal typed contract. No
// ownership/tenant scoping needed — read-only market analysis, not a
// user-scoped resource.

import { Router, type IRouter } from "express";
import { buildMultiTimeframeAnalysis } from "../lib/tradingMultiTimeframe.js";
import { getMarketDataProvider, type Timeframe } from "../lib/tradingMarketData.js";
import { getScopedUserId } from "../lib/tenantScope.js";
import { GetTradingMultiTimeframeResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const VALID_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "1D"];

router.get("/trading/multi-timeframe/:symbol", async (req, res): Promise<void> => {
  const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;

  let timeframes: Timeframe[] | undefined;
  if (typeof req.query.timeframes === "string" && req.query.timeframes.length > 0) {
    const requested = req.query.timeframes.split(",").map((t) => t.trim());
    const invalid = requested.filter((t) => !VALID_TIMEFRAMES.includes(t as Timeframe));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Invalid timeframe(s): ${invalid.join(", ")} — must be one of ${VALID_TIMEFRAMES.join(", ")}` });
      return;
    }
    timeframes = requested as Timeframe[];
  }

  const userId = await getScopedUserId(req);
  const provider = await getMarketDataProvider(userId);
  const analysis = await buildMultiTimeframeAnalysis(symbol, provider, timeframes);

  if (!analysis) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  res.json(GetTradingMultiTimeframeResponse.parse(analysis));
});

export default router;

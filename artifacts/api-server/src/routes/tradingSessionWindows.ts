// Phase 27 — Institutional Liquidity & Session Workbench.
//
// Deliberately a thin route wrapper, mirroring routes/tradingSession.ts's
// own established pattern exactly — this endpoint contains zero business
// logic of its own, calling straight through to the new
// sessionWindows.ts's buildSessionWindows(), which itself reuses the
// existing MarketDataProvider seam and TRADING_SESSION_WINDOWS unmodified.
// Read-only market/session data, not a user-scoped resource — no
// ownership filtering needed. Path-parameter-only (no query overrides),
// so this route is fully documented in openapi.yaml and consumable via a
// normal generated Orval hook, unlike Phase 26's own undocumented
// ?timeframes=/?interval= overrides.

import { Router, type IRouter } from "express";
import { buildSessionWindows } from "../lib/trading/sessionWindows.js";
import { GetTradingSessionWindowsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trading/session-windows/:symbol", async (req, res): Promise<void> => {
  const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;

  const data = await buildSessionWindows(symbol);
  if (!data) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  res.json(GetTradingSessionWindowsResponse.parse(data));
});

export default router;

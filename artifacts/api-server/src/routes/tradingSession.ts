// Phase 25 — Institutional Trade Workspace.
//
// Deliberately a thin route wrapper, mirroring routes/tradingStructure.ts's
// own established pattern exactly — this endpoint contains zero business
// logic of its own, calling straight through to sessionService.ts's
// buildSessionData(), which itself reuses the existing MarketDataProvider
// seam (Sprint 32) and Phase 24's own already-defined TRADING_SESSION_WINDOWS.
// Read-only market/session data, not a user-scoped resource — no ownership
// filtering needed.

import { Router, type IRouter } from "express";
import { buildSessionData } from "../lib/trading/sessionService.js";
import { GetTradingSessionResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trading/session/:symbol", async (req, res): Promise<void> => {
  const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;

  const asOf = typeof req.query.asOf === "string" ? req.query.asOf : undefined;

  const data = await buildSessionData(symbol, asOf);
  if (!data) {
    res.status(404).json({ error: "Unknown or invalid symbol" });
    return;
  }

  res.json(GetTradingSessionResponse.parse(data));
});

export default router;

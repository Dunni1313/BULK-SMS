// v1.5.0, Sprint 20 — Institutional Market Intelligence Engine. A thin
// pass-through, mirroring routes/events.ts's own established pattern — zero
// business logic here, market-wide (not per-user) so no auth/tenant scoping
// is needed, matching GET /events and GET /briefing's own precedent.

import { Router, type IRouter } from "express";
import { GetMarketIntelligenceResponse } from "@workspace/api-zod";
import { UNIVERSE_SYMBOLS } from "../lib/optionsMath.js";
import { buildMarketIntelligenceFeed } from "../lib/marketIntelligence.js";

const router: IRouter = Router();

router.get("/market-intelligence", async (req, res): Promise<void> => {
  const horizonDays = Number(req.query.horizonDays) || 45;
  const feed = buildMarketIntelligenceFeed(Date.now(), UNIVERSE_SYMBOLS, horizonDays);
  res.json(GetMarketIntelligenceResponse.parse(feed));
});

export default router;

// Correlation & Concentration Risk Overlay sprint.
//
// One dedicated, read-only endpoint: builds a full portfolio
// concentration/correlation overlay via lib/portfolioConcentration.ts,
// which itself only ever reads local trade data and reuses
// lib/positionSizing.ts's/serverState.ts's existing, unmodified
// currentOpenTrades()/buildSnapshot()/computeTradeGreeks(). Never
// contacts a broker execution endpoint, never creates or modifies an
// order or position, never mutates the trades/journal/settings tables.
import { Router, type IRouter } from "express";
import { GetPortfolioConcentrationResponse } from "@workspace/api-zod";
import { buildPortfolioConcentrationOverlay } from "../lib/portfolioConcentration.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.get("/portfolio/concentration", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const result = await buildPortfolioConcentrationOverlay(userId);
  res.json(GetPortfolioConcentrationResponse.parse(result));
});

export default router;

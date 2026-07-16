// Earnings & Event Risk Portfolio Overlay sprint.
//
// One dedicated, read-only endpoint: builds a full portfolio event-risk
// overlay via lib/portfolioEventRisk.ts, which itself only ever reads
// local trade data and reuses eventRisk.ts's existing, unmodified
// getEventRiskForSymbol(). Never contacts a broker execution endpoint,
// never creates or modifies an order or position, never mutates the
// trades/journal/settings tables.
import { Router, type IRouter } from "express";
import { GetPortfolioEventRiskResponse } from "@workspace/api-zod";
import { buildPortfolioEventRiskOverlay } from "../lib/portfolioEventRisk.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.get("/portfolio/event-risk", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const result = await buildPortfolioEventRiskOverlay(userId);
  res.json(GetPortfolioEventRiskResponse.parse(result));
});

export default router;

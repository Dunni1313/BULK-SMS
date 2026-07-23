// Portfolio Risk Dashboard & Health Score sprint.
//
// One dedicated, read-only endpoint: builds a single executive dashboard
// via lib/portfolioDashboard.ts, which itself only composes the 3
// already-existing Paper Trading overlays (Portfolio Stress Test, the
// Earnings & Event Risk Portfolio Overlay, the Correlation &
// Concentration Risk Overlay) plus lib/positionSizing.ts's own existing
// currentOpenTrades()/buildSnapshot() — never a new pricing/provider
// call. Never contacts a broker execution endpoint, never creates or
// modifies an order or position, never mutates the trades/journal/
// settings tables.
import { Router, type IRouter } from "express";
import { GetPortfolioDashboardResponse } from "@workspace/api-zod";
import { buildPortfolioDashboard } from "../lib/portfolioDashboard.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.get("/portfolio/dashboard", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const result = await buildPortfolioDashboard(userId);
  res.json(GetPortfolioDashboardResponse.parse(result));
});

export default router;

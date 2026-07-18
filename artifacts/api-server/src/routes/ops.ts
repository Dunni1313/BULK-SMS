// Phase 11 — Live Market Operations & Production Validation. The
// Operations Dashboard's own routes — administrator-only (requireAdmin),
// per the phase's own "for administrators only" instruction. Every route
// here is a thin, read-only pass-through to an already-existing
// consolidation layer; zero new trading/execution/pricing/risk logic.
import { Router, type IRouter } from "express";
import { GetMarketDataValidationResponse } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { buildLiveMarketValidationReport } from "../lib/liveMarketValidation.js";
import { getSettingsRow } from "../lib/serverState.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.get("/ops/market-data-validation", requireAdmin, async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const settings = await getSettingsRow(userId);
  const report = await buildLiveMarketValidationReport(
    userId,
    { scannerMode: settings.scannerMode, marketDataProvider: settings.marketDataProvider, alpacaApiKey: settings.alpacaApiKey },
    { fundamentalsProvider: settings.fundamentalsProvider },
  );
  res.json(GetMarketDataValidationResponse.parse(report));
});

export default router;

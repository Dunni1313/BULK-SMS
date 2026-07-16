import { Router, type IRouter } from "express";
import { GetBrokerHealthResponse } from "@workspace/api-zod";
import { checkAlpacaBrokerHealth } from "../lib/providers/alpacaBroker.js";
import { getSettingsRow } from "../lib/serverState.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

// Read-only Alpaca Paper Trading broker/account health check. Performs a
// live, authenticated round trip to Alpaca (GET /v2/account, /v2/positions,
// /v2/orders) — never places, modifies, or cancels an order. Mirrors
// market-data/health's own thin route pattern: resolve the calling user's
// settings, delegate to a pure/isolated check function, return the result.
router.get("/broker/health", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const settings = await getSettingsRow(userId);
  const health = await checkAlpacaBrokerHealth(settings.alpacaApiKey);

  res.json(GetBrokerHealthResponse.parse(health));
});

export default router;

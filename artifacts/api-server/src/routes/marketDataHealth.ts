import { Router, type IRouter } from "express";
import { GetMarketDataHealthResponse } from "@workspace/api-zod";
import { selectProvider } from "../lib/providers/index.js";
import { getLastScanHealth } from "../lib/marketDataHealth.js";
import { getSettingsRow } from "../lib/serverState.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

// Market-data health: live provider/connection status merged with the metrics from
// the most recent scan (contracts scanned, rejections, positive-EV trades found).
router.get("/market-data/health", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const settings = await getSettingsRow(userId);
  const selection = selectProvider({
    scannerMode: settings.scannerMode,
    marketDataProvider: settings.marketDataProvider,
    alpacaApiKey: settings.alpacaApiKey,
  });
  const last = getLastScanHealth();

  res.json(
    GetMarketDataHealthResponse.parse({
      provider: selection.active,
      requestedProvider: selection.requested,
      mode: selection.mode,
      connected: selection.connected,
      reason: selection.reason,
      lastChainUpdate: last?.lastChainUpdate ?? null,
      symbolsScanned: last?.symbolsScanned ?? 0,
      contractsScanned: last?.contractsScanned ?? 0,
      rejectedByLiquidity: last?.rejectedByLiquidity ?? 0,
      rejectedByRisk: last?.rejectedByRisk ?? 0,
      positiveEvFound: last?.positiveEvFound ?? 0,
      lastScannedAt: last?.scannedAt ?? null,
    }),
  );
});

export default router;

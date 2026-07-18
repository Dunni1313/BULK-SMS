import { Router, type IRouter } from "express";
import {
  GetBrokerOrdersResponse,
  GetBrokerOrderResponse,
  GetBrokerReconciliationResponse,
  GetBrokerPositionsResponse,
  ListReconciliationReportsResponse,
  GetReconciliationReportResponse,
} from "@workspace/api-zod";
import { getAlpacaAllOrders, getAlpacaOrder, getAlpacaPositions, type BrokerFailureReason } from "../lib/providers/alpacaBroker.js";
import {
  buildReconciliation,
  saveReconciliationReport,
  listReconciliationReports,
  getReconciliationReport,
} from "../lib/brokerReconciliation.js";
import { getSettingsRow } from "../lib/serverState.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

function reasonForFailure(reason: BrokerFailureReason, message: string): string {
  switch (reason) {
    case "no_credentials":
      return "No Alpaca credentials configured";
    case "unauthorized":
      return "Alpaca rejected the configured credentials (authentication failed)";
    case "network_error":
      return `Could not reach Alpaca: ${message}`;
    case "http_error":
      return `Alpaca returned an error: ${message}`;
  }
}

// Read-only Alpaca Paper Trading order/reconciliation surface. Every route
// here only ever issues GET requests (via alpacaBroker.ts) and, for
// reconciliation, a SELECT against the local database — no order placement,
// modification, or cancellation, and no automatic correction of any local
// record. Mirrors routes/brokerHealth.ts's own thin-route/honest-degradation
// pattern exactly.

router.get("/broker/orders", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const settings = await getSettingsRow(userId);
  const checkedAt = new Date().toISOString();
  const result = await getAlpacaAllOrders(settings.alpacaApiKey);

  if (!result.ok) {
    res.json(
      GetBrokerOrdersResponse.parse({
        available: false,
        unavailableReason: reasonForFailure(result.reason, result.message),
        orders: [],
        checkedAt,
      }),
    );
    return;
  }

  res.json(
    GetBrokerOrdersResponse.parse({
      available: true,
      unavailableReason: null,
      orders: result.data,
      checkedAt,
    }),
  );
});

router.get("/broker/orders/:orderId", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const settings = await getSettingsRow(userId);
  const checkedAt = new Date().toISOString();
  const result = await getAlpacaOrder(req.params.orderId, settings.alpacaApiKey);

  if (!result.ok) {
    res.json(
      GetBrokerOrderResponse.parse({
        available: false,
        unavailableReason: reasonForFailure(result.reason, result.message),
        order: null,
        checkedAt,
      }),
    );
    return;
  }

  res.json(
    GetBrokerOrderResponse.parse({
      available: true,
      unavailableReason: null,
      order: result.data,
      checkedAt,
    }),
  );
});

// The raw broker position list (Paper Portfolio Dashboard's "Portfolio"
// refresh action) — distinct from GET /broker/reconciliation's own
// positions[], which is a LOCAL-vs-BROKER comparison, not a display list.
// This route surfaces Alpaca's own position fields (avg entry price, side,
// market value, unrealized P/L) directly, refreshable independently of
// both Broker Health and Reconciliation.
router.get("/broker/positions", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const settings = await getSettingsRow(userId);
  const checkedAt = new Date().toISOString();
  const result = await getAlpacaPositions(settings.alpacaApiKey);

  if (!result.ok) {
    res.json(
      GetBrokerPositionsResponse.parse({
        available: false,
        unavailableReason: reasonForFailure(result.reason, result.message),
        positions: [],
        checkedAt,
      }),
    );
    return;
  }

  res.json(
    GetBrokerPositionsResponse.parse({
      available: true,
      unavailableReason: null,
      positions: result.data,
      checkedAt,
    }),
  );
});

// Manual, on-demand only — this route is the sole entry point into
// buildReconciliation(); nothing calls it on a timer or schedule.
router.get("/broker/reconciliation", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const settings = await getSettingsRow(userId);
  const result = await buildReconciliation(userId, settings.alpacaApiKey);
  res.json(GetBrokerReconciliationResponse.parse(result));
});

// ─── Reconciliation reports (Phase 11 — Live Market Operations &
// Production Validation) ───────────────────────────────────────────────
// "Add reconciliation reports. Detect drift between broker and local
// state." Persists a snapshot of buildReconciliation() only when a user
// explicitly triggers this POST route — never on a schedule.

router.get("/broker/reconciliation/reports", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const reports = await listReconciliationReports(userId);
  res.json(ListReconciliationReportsResponse.parse({ reports }));
});

router.post("/broker/reconciliation/reports", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const settings = await getSettingsRow(userId);
  const result = await buildReconciliation(userId, settings.alpacaApiKey);
  const summary = await saveReconciliationReport(userId, result);
  // Orval deduplicated the standalone ReconciliationReportSummary schema
  // into ListReconciliationReportsResponse's own array-item shape (no
  // top-level export exists for it, since createReconciliationReport's
  // response is structurally identical) — this response is already a
  // correctly-typed TypeScript object from lib/brokerReconciliation.ts's
  // own ReconciliationReportSummary interface, so it's returned directly
  // rather than fighting the generator for a runtime-validation schema
  // that has no standalone name.
  res.status(201).json(summary);
});

router.get("/broker/reconciliation/reports/:id", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid report id" });
    return;
  }
  const report = await getReconciliationReport(userId, id);
  if (!report) {
    res.status(404).json({ error: "Reconciliation report not found" });
    return;
  }
  res.json(GetReconciliationReportResponse.parse(report));
});

export default router;

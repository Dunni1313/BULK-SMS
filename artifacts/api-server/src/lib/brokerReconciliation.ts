// Read-only Alpaca Paper Trading order/position reconciliation. Compares
// this platform's own local trade records against Alpaca's real Paper
// Trading orders and positions, and reports discrepancies honestly — it
// never corrects, cancels, closes, or modifies anything on either side.
// Foundation sprint scope, documented explicitly (see
// docs/Alpaca-Paper-Trading-Architecture.md):
//   - Only trades whose status is "pending" or "open" are considered — a
//     "closed" trade's opening order has already fully settled and is not
//     re-reconciled forever.
//   - Only trades with a real (non-mock) alpacaOrderId are "trackable" —
//     execution.ts assigns a `mock-<uuid>` id when no broker credentials
//     were configured at submission time; such a trade was never actually
//     sent to Alpaca, so comparing it against Alpaca's own data would be
//     comparing against something that was never there by design, not a
//     genuine discrepancy.
//   - Local spread quantity is derived assuming uniform-ratio legs (ratio 1
//     per leg), which is what optionsMath.ts's strategy builders currently
//     produce for every strategy this platform supports.
//   - Symbol comparison is a direct, case-insensitive match against
//     Alpaca's own top-level order `symbol` field — not independently
//     verified against a real multi-leg ("mleg") Alpaca order response in
//     this session, since no real credentials exist (see §9 of
//     docs/Broker-Health-API.md for the same standing disclosure).

import { db, tradesTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  getAlpacaAllOrders,
  getAlpacaPositions,
  type BrokerFailureReason,
} from "./providers/alpacaBroker.js";
import { normalizeLocalTradeStatus, isStatusContradiction, type NormalizedOrderStatus, type NormalizedLocalStatus } from "./providers/alpacaOrderLifecycle.js";
import { toOcc } from "./execution.js";
import type { StoredLeg } from "./serverState.js";

const MOCK_ORDER_ID_PREFIX = "mock-";

function isTrackableOrderId(id: string | null | undefined): id is string {
  return !!id && !id.startsWith(MOCK_ORDER_ID_PREFIX);
}

// Derive the local, aggregate spread quantity for a trade's legs. See this
// file's header for the uniform-ratio-legs assumption this relies on.
function localSpreadQuantity(legs: StoredLeg[]): number | null {
  if (legs.length === 0) return null;
  return Math.max(...legs.map((l) => l.quantity));
}

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

export type ReconciliationIssueType =
  | "missing_at_broker"
  | "missing_locally"
  | "status_mismatch"
  | "quantity_mismatch"
  | "symbol_mismatch";

export interface OrderReconciliationEntry {
  tradeId: number | null;
  alpacaOrderId: string | null;
  localSymbol: string | null;
  brokerSymbol: string | null;
  localStatus: NormalizedLocalStatus | null;
  brokerStatus: NormalizedOrderStatus | null;
  brokerRawStatus: string | null;
  localQuantity: number | null;
  brokerQuantity: number | null;
  filledQuantity: number | null;
  averageFillPrice: number | null;
  issues: ReconciliationIssueType[];
}

export interface PositionReconciliationEntry {
  occSymbol: string;
  tradeId: number | null;
  localQuantity: number | null;
  brokerQuantity: number | null;
  mismatch: boolean;
  detail: string;
}

export interface ReconciliationResult {
  available: boolean;
  unavailableReason: string | null;
  generatedAt: string;
  localOrdersConsidered: number;
  brokerOrdersConsidered: number;
  orders: OrderReconciliationEntry[];
  positions: PositionReconciliationEntry[];
  issueCount: number;
  fullyReconciled: boolean;
}

function emptyUnavailable(generatedAt: string, reason: string): ReconciliationResult {
  return {
    available: false,
    unavailableReason: reason,
    generatedAt,
    localOrdersConsidered: 0,
    brokerOrdersConsidered: 0,
    orders: [],
    positions: [],
    issueCount: 0,
    fullyReconciled: false,
  };
}

// The reconciliation orchestrator. Read-only end to end: it only ever
// issues GET requests to Alpaca (via alpacaBroker.ts) and a SELECT against
// the local database — no INSERT/UPDATE/DELETE of any kind, no order
// cancellation, no position closing, no automatic correction. Called only
// on demand (a route handler invoked by an explicit user action); nothing
// in this module runs on a timer or schedule.
export async function buildReconciliation(
  userId: string,
  settingsApiKey?: string | null,
): Promise<ReconciliationResult> {
  const generatedAt = new Date().toISOString();

  const [ordersResult, positionsResult] = await Promise.all([
    getAlpacaAllOrders(settingsApiKey),
    getAlpacaPositions(settingsApiKey),
  ]);

  if (!ordersResult.ok) {
    return emptyUnavailable(generatedAt, reasonForFailure(ordersResult.reason, ordersResult.message));
  }
  if (!positionsResult.ok) {
    return emptyUnavailable(generatedAt, reasonForFailure(positionsResult.reason, positionsResult.message));
  }

  const brokerOrders = ordersResult.data;
  const brokerPositions = positionsResult.data;

  const localTrades = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.userId, userId), inArray(tradesTable.status, ["pending", "open"])));

  const trackableTrades = localTrades.filter((t) => isTrackableOrderId(t.alpacaOrderId));

  const brokerOrderById = new Map(brokerOrders.map((o) => [o.id, o]));
  const matchedBrokerOrderIds = new Set<string>();

  const orderEntries: OrderReconciliationEntry[] = [];

  for (const trade of trackableTrades) {
    const orderId = trade.alpacaOrderId as string;
    const brokerOrder = brokerOrderById.get(orderId) ?? null;
    const legs = (trade.legs as StoredLeg[]) ?? [];
    const localQuantity = localSpreadQuantity(legs);
    const localStatus = normalizeLocalTradeStatus(trade.status);

    if (!brokerOrder) {
      orderEntries.push({
        tradeId: trade.id,
        alpacaOrderId: orderId,
        localSymbol: trade.symbol,
        brokerSymbol: null,
        localStatus,
        brokerStatus: null,
        brokerRawStatus: null,
        localQuantity,
        brokerQuantity: null,
        filledQuantity: null,
        averageFillPrice: null,
        issues: ["missing_at_broker"],
      });
      continue;
    }

    matchedBrokerOrderIds.add(brokerOrder.id);
    const issues: ReconciliationIssueType[] = [];
    if (isStatusContradiction(localStatus, brokerOrder.normalizedStatus)) issues.push("status_mismatch");
    if (localQuantity !== null && localQuantity !== brokerOrder.qty) issues.push("quantity_mismatch");
    if (trade.symbol.toUpperCase() !== brokerOrder.symbol.toUpperCase()) issues.push("symbol_mismatch");

    orderEntries.push({
      tradeId: trade.id,
      alpacaOrderId: orderId,
      localSymbol: trade.symbol,
      brokerSymbol: brokerOrder.symbol,
      localStatus,
      brokerStatus: brokerOrder.normalizedStatus,
      brokerRawStatus: brokerOrder.status,
      localQuantity,
      brokerQuantity: brokerOrder.qty,
      filledQuantity: brokerOrder.filledQty,
      averageFillPrice: brokerOrder.filledAvgPrice,
      issues,
    });
  }

  // Broker orders with no matching trackable local trade at all.
  for (const brokerOrder of brokerOrders) {
    if (matchedBrokerOrderIds.has(brokerOrder.id)) continue;
    orderEntries.push({
      tradeId: null,
      alpacaOrderId: brokerOrder.id,
      localSymbol: null,
      brokerSymbol: brokerOrder.symbol,
      localStatus: null,
      brokerStatus: brokerOrder.normalizedStatus,
      brokerRawStatus: brokerOrder.status,
      localQuantity: null,
      brokerQuantity: brokerOrder.qty,
      filledQuantity: brokerOrder.filledQty,
      averageFillPrice: brokerOrder.filledAvgPrice,
      issues: ["missing_locally"],
    });
  }

  // ─── Position reconciliation ────────────────────────────────────────────
  // Only genuinely "open" (filled) trades carry a live broker position — a
  // still-"pending" trade hasn't been observed to fill yet, so no position
  // is expected for it either way.
  const localPositionMap = new Map<string, { tradeId: number; netQuantity: number }>();
  for (const trade of trackableTrades) {
    if (trade.status !== "open") continue;
    const legs = (trade.legs as StoredLeg[]) ?? [];
    for (const leg of legs) {
      const occSymbol = toOcc(trade.symbol, leg.expiration, leg.optionType, leg.strike);
      const signedQty = (leg.side === "sell" ? -1 : 1) * leg.quantity;
      const existing = localPositionMap.get(occSymbol);
      if (existing) {
        existing.netQuantity += signedQty;
      } else {
        localPositionMap.set(occSymbol, { tradeId: trade.id, netQuantity: signedQty });
      }
    }
  }

  const brokerPositionMap = new Map(brokerPositions.map((p) => [p.symbol, p]));
  const allPositionSymbols = new Set<string>([...localPositionMap.keys(), ...brokerPositionMap.keys()]);

  const positionEntries: PositionReconciliationEntry[] = [];
  for (const occSymbol of allPositionSymbols) {
    const local = localPositionMap.get(occSymbol) ?? null;
    const broker = brokerPositionMap.get(occSymbol) ?? null;
    const localQuantity = local?.netQuantity ?? null;
    const brokerQuantity = broker?.qty ?? null;

    let mismatch = false;
    let detail: string;
    if (local && !broker) {
      mismatch = true;
      detail = "Local trade expects an open position at the broker, but none was found.";
    } else if (!local && broker) {
      mismatch = true;
      detail = "Alpaca reports an open position with no matching local trade.";
    } else if (localQuantity !== brokerQuantity) {
      mismatch = true;
      detail = `Quantity mismatch: local ${localQuantity}, broker ${brokerQuantity}.`;
    } else {
      detail = "Local and broker positions agree.";
    }

    positionEntries.push({
      occSymbol,
      tradeId: local?.tradeId ?? null,
      localQuantity,
      brokerQuantity,
      mismatch,
      detail,
    });
  }

  const issueCount =
    orderEntries.reduce((sum, e) => sum + e.issues.length, 0) +
    positionEntries.filter((p) => p.mismatch).length;

  return {
    available: true,
    unavailableReason: null,
    generatedAt,
    localOrdersConsidered: trackableTrades.length,
    brokerOrdersConsidered: brokerOrders.length,
    orders: orderEntries,
    positions: positionEntries,
    issueCount,
    fullyReconciled: issueCount === 0,
  };
}

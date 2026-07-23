// Paper Trading Order Preview & Risk Simulator sprint — live route
// integration test for POST /execution/order-preview. Uses the real app +
// a real Postgres connection (no auth session needed — unauthenticated
// requests resolve to the legacy-owner stand-in per tenantScope.ts). This
// route is a thin pass-through to lib/orderPreview.ts's already-unit-
// tested buildOrderPreview() (24 tests) — these tests prove the HTTP
// wiring and the honest-degradation contract, not the composition math
// itself.
//
// Deliberately does not assert on position-conflict/existing-order
// checklist items here (unlike lib/orderPreview.test.ts's own isolated-
// user coverage) — the legacy-owner's trades table is genuinely shared
// across many sibling route test files, matching the same disclosed
// discipline routes/tradingRisk.route.test.ts and
// routes/notifications.route.test.ts already established for exactly this
// situation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface OrderPreviewIssue {
  field: string;
  code: string;
  message: string;
}

interface OrderPreviewValidationItem {
  code: string;
  label: string;
  status: "ok" | "warning" | "blocked";
  detail: string;
}

interface OrderPreviewTicketResponse {
  symbol: string;
  strategy: string;
  quantity: number;
  netCredit: number;
  maxProfit: number;
  maxLoss: number;
  buyingPowerRequired: number;
  entryPricePerSpread: number;
  notionalValue: number;
  marginImpact: number;
  riskRewardRatio: number | null;
}

interface OrderPreviewResultResponse {
  available: boolean;
  inputIssues: OrderPreviewIssue[];
  ticket: OrderPreviewTicketResponse | null;
  preTradeChecklist: OrderPreviewValidationItem[];
  credentialsConfigured: boolean;
  brokerConnected: boolean | null;
  lastBrokerCheckAt: string | null;
  accountValue: number;
  generatedAt: string;
}

describe("Order Preview routes (live, real Postgres, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server.close();
  });

  async function preview(body: Record<string, unknown>): Promise<OrderPreviewResultResponse> {
    const res = await fetch(`${baseUrl}/api/execution/order-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    return (await res.json()) as OrderPreviewResultResponse;
  }

  it("honestly reports missing required fields for a completely empty preview", async () => {
    const body = await preview({});
    expect(body.available).toBe(false);
    expect(body.ticket).toBeNull();
    expect(body.inputIssues.length).toBeGreaterThan(0);
    expect(body.preTradeChecklist.length).toBe(8);
  });

  it("honestly reports an invalid quantity", async () => {
    const body = await preview({ symbol: "AAPL", strategy: "iron_condor", quantity: -1 });
    expect(body.available).toBe(false);
    expect(body.inputIssues.some((i) => i.field === "quantity")).toBe(true);
  });

  it("honestly reports an invalid/unresolvable symbol", async () => {
    const body = await preview({ symbol: "NOTASYMBOL!!", strategy: "iron_condor", quantity: 1 });
    expect(body.available).toBe(false);
    expect(body.inputIssues.some((i) => i.field === "symbol")).toBe(true);
  });

  it("generates a well-shaped, successful preview for a valid, known symbol", async () => {
    const body = await preview({ symbol: "SPY", strategy: "iron_condor", quantity: 1 });
    expect(body.available).toBe(true);
    expect(body.inputIssues).toEqual([]);
    expect(body.ticket).not.toBeNull();
    expect(body.ticket!.symbol).toBe("SPY");
    expect(body.ticket!.strategy).toBe("iron_condor");
    expect(typeof body.ticket!.entryPricePerSpread).toBe("number");
    expect(typeof body.ticket!.notionalValue).toBe("number");
    expect(body.ticket!.marginImpact).toBe(body.ticket!.maxLoss);
    expect(body.accountValue).toBeGreaterThan(0);
    expect(typeof body.generatedAt).toBe("string");

    // Never a broker-write/order-creation surface — no such fields exist
    // on this response shape at all.
    expect(body).not.toHaveProperty("orderId");
    expect(body).not.toHaveProperty("tradeId");
    expect(body).not.toHaveProperty("journalId");
  });

  it("is deterministic for the same input (never mutates state that would change the answer)", async () => {
    const a = await preview({ symbol: "QQQ", strategy: "iron_condor", quantity: 1 });
    const b = await preview({ symbol: "QQQ", strategy: "iron_condor", quantity: 1 });
    expect(a.ticket!.netCredit).toBe(b.ticket!.netCredit);
    expect(a.ticket!.maxLoss).toBe(b.ticket!.maxLoss);
    expect(a.ticket!.entryPricePerSpread).toBe(b.ticket!.entryPricePerSpread);
  });

  it("honestly reports no configured Alpaca credentials in this environment", async () => {
    const body = await preview({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 });
    expect(body.credentialsConfigured).toBe(false);
    const check = body.preTradeChecklist.find((c) => c.code === "credentials")!;
    expect(check.status).toBe("warning");
  });

  it("reflects a real (failing, no-credentials) Broker Health check via the already-existing GET /broker/health endpoint", async () => {
    const healthRes = await fetch(`${baseUrl}/api/broker/health`);
    expect(healthRes.status).toBe(200);

    const body = await preview({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 });
    expect(body.brokerConnected).toBe(false);
    const brokerCheck = body.preTradeChecklist.find((c) => c.code === "broker_connection")!;
    expect(brokerCheck.status).toBe("warning");
    const buyingPowerCheck = body.preTradeChecklist.find((c) => c.code === "buying_power")!;
    expect(buyingPowerCheck.status).toBe("warning");
    expect(buyingPowerCheck.detail).toMatch(/local estimate/i);
  });

  it("400s on a genuinely malformed request body (wrong type for quantity)", async () => {
    const res = await fetch(`${baseUrl}/api/execution/order-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", strategy: "iron_condor", quantity: "not-a-number" }),
    });
    expect(res.status).toBe(400);
  });
});

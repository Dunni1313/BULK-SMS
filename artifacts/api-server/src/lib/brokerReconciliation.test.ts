// Alpaca Paper Order Lifecycle & Reconciliation Foundation sprint —
// buildReconciliation() unit tests. Talks to a REAL Postgres database (via
// DATABASE_URL, same convention as autoScheduler.multiUser.test.ts and
// tenantIsolation.test.ts) for the local trades side, since the thing under
// test is the real SELECT + real comparison logic; the Alpaca side
// (getAlpacaAllOrders/getAlpacaPositions) is mocked, since no real Alpaca
// credentials exist in this environment.
//
// Entirely read-only: this suite never asserts, expects, or exercises any
// write to Alpaca, and buildReconciliation() itself contains no
// INSERT/UPDATE/DELETE against the local database either — only a SELECT.

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable } from "@workspace/db";
import type { AlpacaOrder, AlpacaPosition, BrokerResult } from "./providers/alpacaBroker.js";

const ordersMock = vi.fn<() => Promise<BrokerResult<AlpacaOrder[]>>>();
const positionsMock = vi.fn<() => Promise<BrokerResult<AlpacaPosition[]>>>();

vi.mock("./providers/alpacaBroker.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./providers/alpacaBroker.js")>();
  return {
    ...actual,
    getAlpacaAllOrders: () => ordersMock(),
    getAlpacaPositions: () => positionsMock(),
  };
});

const { buildReconciliation } = await import("./brokerReconciliation.js");

function order(over: Partial<AlpacaOrder> & Pick<AlpacaOrder, "id" | "symbol">): AlpacaOrder {
  return {
    side: "sell",
    qty: 1,
    type: "limit",
    status: "accepted",
    normalizedStatus: "accepted",
    filledQty: 0,
    filledAvgPrice: null,
    submittedAt: "2026-07-16T10:00:00Z",
    ...over,
  };
}

function position(over: Partial<AlpacaPosition> & Pick<AlpacaPosition, "symbol" | "qty">): AlpacaPosition {
  return {
    side: "long",
    marketValue: 0,
    avgEntryPrice: 0,
    unrealizedPl: 0,
    ...over,
  };
}

let userId: string;

beforeAll(async () => {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `broker-recon-${randomUUID()}@example.com`, displayName: "Broker Reconciliation Test" })
    .returning({ id: usersTable.id });
  userId = row.id;
});

// Every test inserts its own trade(s) against the same test user; cleaning
// up between tests (rather than only once at the very end) keeps each
// test's own buildReconciliation() call scoped to exactly the trades that
// test created — a leftover "open" trade from an earlier test would
// otherwise show up as a spurious missing_at_broker entry in a later test's
// own, differently-mocked broker response.
afterEach(async () => {
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
});

afterAll(async () => {
  await db.delete(usersTable).where(eq(usersTable.id, userId));
});

async function insertTrade(over: {
  symbol: string;
  status: "pending" | "open" | "closed";
  alpacaOrderId: string | null;
  legs?: { side: "buy" | "sell"; optionType: "call" | "put"; strike: number; expiration: string; openPrice: number; quantity: number }[];
}): Promise<number> {
  const [row] = await db
    .insert(tradesTable)
    .values({
      userId,
      symbol: over.symbol,
      strategy: "iron_condor",
      status: over.status,
      alpacaOrderId: over.alpacaOrderId,
      legs: (over.legs ?? []) as unknown as (typeof tradesTable.$inferInsert)["legs"],
    })
    .returning({ id: tradesTable.id });
  return row.id;
}

const IRON_CONDOR_LEGS = [
  { side: "sell" as const, optionType: "put" as const, strike: 400, expiration: "2026-12-18", openPrice: 2, quantity: 2 },
  { side: "buy" as const, optionType: "put" as const, strike: 390, expiration: "2026-12-18", openPrice: 1, quantity: 2 },
  { side: "sell" as const, optionType: "call" as const, strike: 450, expiration: "2026-12-18", openPrice: 2, quantity: 2 },
  { side: "buy" as const, optionType: "call" as const, strike: 460, expiration: "2026-12-18", openPrice: 1, quantity: 2 },
];

describe("buildReconciliation — credential/connectivity failures", () => {
  it("is honestly unavailable with no credentials configured, never fabricating a reconciled result", async () => {
    ordersMock.mockResolvedValue({ ok: false, reason: "no_credentials", message: "No Alpaca API key/secret configured" });
    positionsMock.mockResolvedValue({ ok: false, reason: "no_credentials", message: "No Alpaca API key/secret configured" });

    const result = await buildReconciliation(userId, null);
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toMatch(/no alpaca credentials configured/i);
    expect(result.orders).toEqual([]);
    expect(result.positions).toEqual([]);
    expect(result.fullyReconciled).toBe(false);
  });

  it("is honestly unavailable on an authentication failure", async () => {
    ordersMock.mockResolvedValue({ ok: false, reason: "unauthorized", status: 401, message: "unauthorized" });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "bad-key");
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toMatch(/authentication failed/i);
  });

  it("is honestly unavailable on a network failure", async () => {
    ordersMock.mockResolvedValue({ ok: false, reason: "network_error", message: "ECONNREFUSED" });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toMatch(/could not reach alpaca/i);
  });
});

describe("buildReconciliation — order reconciliation", () => {
  it("flags a local order missing at the broker", async () => {
    const orderId = `alpaca-${randomUUID()}`;
    const tradeId = await insertTrade({ symbol: "SPY", status: "open", alpacaOrderId: orderId, legs: IRON_CONDOR_LEGS });

    ordersMock.mockResolvedValue({ ok: true, data: [] });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    expect(result.available).toBe(true);
    const entry = result.orders.find((o) => o.tradeId === tradeId);
    expect(entry).toBeDefined();
    expect(entry!.issues).toEqual(["missing_at_broker"]);
    expect(entry!.brokerSymbol).toBeNull();
  });

  it("flags a broker order missing locally", async () => {
    ordersMock.mockResolvedValue({ ok: true, data: [order({ id: "orphan-order", symbol: "QQQ" })] });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    const entry = result.orders.find((o) => o.alpacaOrderId === "orphan-order");
    expect(entry).toBeDefined();
    expect(entry!.issues).toEqual(["missing_locally"]);
    expect(entry!.tradeId).toBeNull();
    expect(entry!.localSymbol).toBeNull();
  });

  it("flags a status contradiction (local 'open' vs. broker 'rejected')", async () => {
    const orderId = `alpaca-${randomUUID()}`;
    await insertTrade({ symbol: "AAPL", status: "open", alpacaOrderId: orderId, legs: IRON_CONDOR_LEGS });

    ordersMock.mockResolvedValue({
      ok: true,
      data: [order({ id: orderId, symbol: "AAPL", status: "rejected", normalizedStatus: "rejected", qty: 2 })],
    });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    const entry = result.orders.find((o) => o.alpacaOrderId === orderId);
    expect(entry!.issues).toContain("status_mismatch");
  });

  it("flags a quantity mismatch", async () => {
    const orderId = `alpaca-${randomUUID()}`;
    // Legs each carry quantity 2 (see IRON_CONDOR_LEGS) — the broker order
    // reports 3, a genuine mismatch.
    await insertTrade({ symbol: "MSFT", status: "open", alpacaOrderId: orderId, legs: IRON_CONDOR_LEGS });

    ordersMock.mockResolvedValue({ ok: true, data: [order({ id: orderId, symbol: "MSFT", qty: 3 })] });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    const entry = result.orders.find((o) => o.alpacaOrderId === orderId);
    expect(entry!.issues).toContain("quantity_mismatch");
    expect(entry!.localQuantity).toBe(2);
    expect(entry!.brokerQuantity).toBe(3);
  });

  it("flags a symbol mismatch", async () => {
    const orderId = `alpaca-${randomUUID()}`;
    await insertTrade({ symbol: "TSLA", status: "open", alpacaOrderId: orderId, legs: IRON_CONDOR_LEGS });

    ordersMock.mockResolvedValue({ ok: true, data: [order({ id: orderId, symbol: "NVDA", qty: 2 })] });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    const entry = result.orders.find((o) => o.alpacaOrderId === orderId);
    expect(entry!.issues).toContain("symbol_mismatch");
  });

  it("surfaces filled quantity and average fill price straight from the broker order", async () => {
    const orderId = `alpaca-${randomUUID()}`;
    await insertTrade({ symbol: "IWM", status: "open", alpacaOrderId: orderId, legs: IRON_CONDOR_LEGS });

    ordersMock.mockResolvedValue({
      ok: true,
      data: [
        order({
          id: orderId,
          symbol: "IWM",
          qty: 2,
          status: "filled",
          normalizedStatus: "filled",
          filledQty: 2,
          filledAvgPrice: 1.85,
        }),
      ],
    });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    const entry = result.orders.find((o) => o.alpacaOrderId === orderId);
    expect(entry!.filledQuantity).toBe(2);
    expect(entry!.averageFillPrice).toBe(1.85);
  });

  it("recognizes filled/partially-filled/rejected/cancelled/unknown broker statuses distinctly", async () => {
    const cases: { status: string; normalizedStatus: AlpacaOrder["normalizedStatus"] }[] = [
      { status: "filled", normalizedStatus: "filled" },
      { status: "partially_filled", normalizedStatus: "partially_filled" },
      { status: "rejected", normalizedStatus: "rejected" },
      { status: "canceled", normalizedStatus: "cancelled" },
      { status: "some_new_alpaca_status", normalizedStatus: "unknown" },
    ];

    const orderIds: string[] = [];
    for (const c of cases) {
      const orderId = `alpaca-${randomUUID()}`;
      orderIds.push(orderId);
      await insertTrade({ symbol: "GLD", status: "pending", alpacaOrderId: orderId, legs: IRON_CONDOR_LEGS });
    }

    ordersMock.mockResolvedValue({
      ok: true,
      data: cases.map((c, i) => order({ id: orderIds[i], symbol: "GLD", qty: 2, status: c.status, normalizedStatus: c.normalizedStatus })),
    });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    for (let i = 0; i < cases.length; i++) {
      const entry = result.orders.find((o) => o.alpacaOrderId === orderIds[i]);
      expect(entry!.brokerStatus).toBe(cases[i].normalizedStatus);
    }
  });

  it("never treats a mock-originated order id as trackable — no missing_at_broker for it", async () => {
    await insertTrade({ symbol: "SPY", status: "open", alpacaOrderId: `mock-${randomUUID()}`, legs: IRON_CONDOR_LEGS });

    ordersMock.mockResolvedValue({ ok: true, data: [] });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    expect(result.orders.some((o) => o.issues.includes("missing_at_broker") && o.localSymbol === "SPY")).toBe(false);
  });

  it("never considers a closed trade", async () => {
    const orderId = `alpaca-${randomUUID()}`;
    await insertTrade({ symbol: "DIA", status: "closed", alpacaOrderId: orderId, legs: IRON_CONDOR_LEGS });

    ordersMock.mockResolvedValue({ ok: true, data: [] });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    expect(result.orders.some((o) => o.alpacaOrderId === orderId)).toBe(false);
  });
});

describe("buildReconciliation — position reconciliation", () => {
  it("flags an open position missing at the broker", async () => {
    const orderId = `alpaca-${randomUUID()}`;
    await insertTrade({ symbol: "AMD", status: "open", alpacaOrderId: orderId, legs: IRON_CONDOR_LEGS });

    ordersMock.mockResolvedValue({ ok: true, data: [order({ id: orderId, symbol: "AMD", qty: 2 })] });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    const mismatched = result.positions.filter((p) => p.mismatch);
    expect(mismatched.length).toBeGreaterThan(0);
    expect(mismatched.every((p) => p.brokerQuantity === null)).toBe(true);
  });

  it("flags a broker position with no matching local trade", async () => {
    ordersMock.mockResolvedValue({ ok: true, data: [] });
    positionsMock.mockResolvedValue({ ok: true, data: [position({ symbol: "AMZN241220C00200000", qty: 3 })] });

    const result = await buildReconciliation(userId, "k");
    const entry = result.positions.find((p) => p.occSymbol === "AMZN241220C00200000");
    expect(entry).toBeDefined();
    expect(entry!.mismatch).toBe(true);
    expect(entry!.localQuantity).toBeNull();
    expect(entry!.detail).toMatch(/no matching local trade/i);
  });

  it("flags a quantity mismatch between local and broker positions", async () => {
    const orderId = `alpaca-${randomUUID()}`;
    // A single-leg trade to keep the derived OCC symbol/quantity simple and
    // exact: sell 2 puts @400 strike, 2026-12-18 expiration.
    await insertTrade({
      symbol: "PLTR",
      status: "open",
      alpacaOrderId: orderId,
      legs: [{ side: "sell", optionType: "put", strike: 40, expiration: "2026-12-18", openPrice: 1, quantity: 2 }],
    });

    ordersMock.mockResolvedValue({ ok: true, data: [order({ id: orderId, symbol: "PLTR", qty: 2 })] });
    // toOcc("PLTR", "2026-12-18", "put", 40) -> PLTR261218P00040000
    positionsMock.mockResolvedValue({ ok: true, data: [position({ symbol: "PLTR261218P00040000", qty: -1 })] });

    const result = await buildReconciliation(userId, "k");
    const entry = result.positions.find((p) => p.occSymbol === "PLTR261218P00040000");
    expect(entry).toBeDefined();
    expect(entry!.localQuantity).toBe(-2); // sell => signed negative
    expect(entry!.brokerQuantity).toBe(-1);
    expect(entry!.mismatch).toBe(true);
  });

  it("does not compare positions for a trade that is only 'pending' (never observed to fill)", async () => {
    const orderId = `alpaca-${randomUUID()}`;
    await insertTrade({ symbol: "COIN", status: "pending", alpacaOrderId: orderId, legs: IRON_CONDOR_LEGS });

    ordersMock.mockResolvedValue({ ok: true, data: [order({ id: orderId, symbol: "COIN", qty: 2 })] });
    positionsMock.mockResolvedValue({ ok: true, data: [] });

    const result = await buildReconciliation(userId, "k");
    // No position entries should reference this trade's own legs at all.
    expect(result.positions.length).toBe(0);
  });
});

describe("buildReconciliation — fully reconciled state", () => {
  it("reports fullyReconciled:true and issueCount:0 when everything genuinely agrees", async () => {
    const orderId = `alpaca-${randomUUID()}`;
    await insertTrade({
      symbol: "VOO",
      status: "open",
      alpacaOrderId: orderId,
      legs: [{ side: "sell", optionType: "call", strike: 500, expiration: "2026-11-20", openPrice: 3, quantity: 1 }],
    });

    ordersMock.mockResolvedValue({
      ok: true,
      data: [order({ id: orderId, symbol: "VOO", qty: 1, status: "filled", normalizedStatus: "filled", filledQty: 1, filledAvgPrice: 3.05 })],
    });
    // toOcc("VOO", "2026-11-20", "call", 500) -> VOO261120C00500000
    positionsMock.mockResolvedValue({ ok: true, data: [position({ symbol: "VOO261120C00500000", qty: -1 })] });

    const result = await buildReconciliation(userId, "k");
    expect(result.available).toBe(true);
    const orderEntry = result.orders.find((o) => o.alpacaOrderId === orderId);
    expect(orderEntry!.issues).toEqual([]);
    const positionEntry = result.positions.find((p) => p.occSymbol === "VOO261120C00500000");
    expect(positionEntry!.mismatch).toBe(false);
    expect(result.issueCount).toBe(0);
    expect(result.fullyReconciled).toBe(true);
  });
});

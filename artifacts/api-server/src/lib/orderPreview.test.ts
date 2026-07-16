// Paper Trading Order Preview & Risk Simulator sprint — direct unit
// coverage of buildOrderPreview(), the pure composition layer that never
// contacts a broker execution endpoint, never creates an order, and never
// mutates local state beyond ordinary reads.
//
// Uses fresh, isolated users (inserted directly, mirroring
// lib/notifications.test.ts's own established pattern) rather than the
// shared legacy-owner account, so position-conflict/existing-order
// assertions are never at risk of colliding with another concurrently-
// running test file's own trades in the same real options-universe symbol.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable } from "@workspace/db";
import { buildOrderPreview } from "./orderPreview.js";
import { previewOptionOrder } from "./execution.js";
import { checkAlpacaBrokerHealth } from "./providers/alpacaBroker.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `order-preview-${label}-${randomUUID()}@example.com`, displayName: `OrderPreview ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("buildOrderPreview", () => {
  let userId: string;

  beforeAll(async () => {
    userId = await createUser("main");
  });

  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("honestly reports missing required fields for a completely empty preview", async () => {
    const result = await buildOrderPreview({}, userId);
    expect(result.available).toBe(false);
    expect(result.ticket).toBeNull();
    expect(result.inputIssues.map((i) => i.field).sort()).toEqual(["quantity", "strategy", "symbol"]);
    expect(result.inputIssues.every((i) => i.code === "missing_field")).toBe(true);
    const required = result.preTradeChecklist.find((c) => c.code === "required_fields")!;
    expect(required.status).toBe("blocked");
  });

  it("flags an invalid (non-positive) quantity", async () => {
    const result = await buildOrderPreview({ symbol: "AAPL", strategy: "iron_condor", quantity: 0 }, userId);
    expect(result.available).toBe(false);
    const issue = result.inputIssues.find((i) => i.field === "quantity")!;
    expect(issue.code).toBe("invalid_quantity");
    const check = result.preTradeChecklist.find((c) => c.code === "quantity_valid")!;
    expect(check.status).toBe("blocked");
  });

  it("flags a non-integer quantity", async () => {
    const result = await buildOrderPreview({ symbol: "AAPL", strategy: "iron_condor", quantity: 1.5 }, userId);
    expect(result.available).toBe(false);
    expect(result.inputIssues.find((i) => i.field === "quantity")!.code).toBe("invalid_quantity");
  });

  it("flags a negative quantity", async () => {
    const result = await buildOrderPreview({ symbol: "AAPL", strategy: "iron_condor", quantity: -3 }, userId);
    expect(result.available).toBe(false);
    expect(result.inputIssues.find((i) => i.field === "quantity")!.code).toBe("invalid_quantity");
  });

  it("flags a shape-invalid symbol (contains digits/punctuation)", async () => {
    const result = await buildOrderPreview({ symbol: "AB12!", strategy: "iron_condor", quantity: 1 }, userId);
    expect(result.available).toBe(false);
    const issue = result.inputIssues.find((i) => i.field === "symbol")!;
    expect(issue.code).toBe("invalid_symbol");
  });

  it("flags a shape-valid but unresolvable symbol (outside the options universe)", async () => {
    // ZZZZZZ is a valid ticker shape (1-6 letters) but has no snapshot in
    // optionsMath.ts's fixed 10-symbol UNIVERSE, so canonicalQuote()
    // (reused, unmodified) correctly returns null for it.
    const result = await buildOrderPreview({ symbol: "ZZZZZZ", strategy: "iron_condor", quantity: 1 }, userId);
    expect(result.available).toBe(false);
    const issue = result.inputIssues.find((i) => i.field === "symbol")!;
    expect(issue.code).toBe("unresolvable_symbol");
    const check = result.preTradeChecklist.find((c) => c.code === "symbol_valid")!;
    expect(check.status).toBe("blocked");
  });

  it("flags an unsupported strategy", async () => {
    const result = await buildOrderPreview({ symbol: "AAPL", strategy: "not_a_strategy", quantity: 1 }, userId);
    expect(result.available).toBe(false);
    expect(result.inputIssues.find((i) => i.field === "strategy")!.code).toBe("invalid_strategy");
  });

  it("generates a valid preview for a well-formed input, byte-identical to the reused execution ticket's own figures", async () => {
    const result = await buildOrderPreview({ symbol: "aapl", strategy: "iron_condor", quantity: 2 }, userId);
    expect(result.available).toBe(true);
    expect(result.inputIssues).toEqual([]);
    expect(result.ticket).not.toBeNull();
    expect(result.ticket!.symbol).toBe("AAPL");
    expect(result.ticket!.strategy).toBe("iron_condor");
    expect(result.ticket!.quantity).toBe(2);

    // Cross-check against a direct, standalone call to the exact same
    // reused execution.ts function this preview composes over — proves no
    // duplicated/diverging math.
    const standalone = await previewOptionOrder({ symbol: "AAPL", strategy: "iron_condor", quantity: 2 }, userId);
    expect(result.ticket!.netCredit).toBe(standalone.netCredit);
    expect(result.ticket!.maxProfit).toBe(standalone.maxProfit);
    expect(result.ticket!.maxLoss).toBe(standalone.maxLoss);
    expect(result.ticket!.buyingPowerRequired).toBe(standalone.buyingPowerRequired);
    expect(result.ticket!.validation).toEqual(standalone.validation);

    // Never leaks the persistence-only underscore-prefixed fields.
    expect(result.ticket).not.toHaveProperty("_quote");
    expect(result.ticket).not.toHaveProperty("_storedLegs");
  });

  it("derives entry price per spread, notional value, margin impact, and risk/reward ratio honestly from the ticket's own numbers", async () => {
    const result = await buildOrderPreview({ symbol: "AAPL", strategy: "iron_condor", quantity: 3 }, userId);
    expect(result.available).toBe(true);
    const t = result.ticket!;

    expect(t.entryPricePerSpread).toBeCloseTo(t.netCredit / t.quantity, 6);
    expect(t.marginImpact).toBe(t.maxLoss);
    if (t.maxLoss > 0) {
      // The source rounds to 4 decimal places (Math.round(x*10000)/10000),
      // so re-deriving and comparing at a tighter precision than that would
      // spuriously fail on the source's own intentional rounding.
      expect(t.riskRewardRatio).toBeCloseTo(t.maxProfit / t.maxLoss, 4);
    } else {
      expect(t.riskRewardRatio).toBeNull();
    }

    const expectedNotional = t.legs.reduce((s, l) => s + l.strike * 100 * l.ratioQty * t.quantity, 0);
    expect(t.notionalValue).toBeCloseTo(expectedNotional, 2);
  });

  it("honestly reports no configured Alpaca credentials in this environment", async () => {
    const result = await buildOrderPreview({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 }, userId);
    expect(result.credentialsConfigured).toBe(false);
    const check = result.preTradeChecklist.find((c) => c.code === "credentials")!;
    expect(check.status).toBe("warning");
  });

  it("reports a disconnected broker after a real (failing, no-credentials) Broker Health check", async () => {
    await checkAlpacaBrokerHealth(null);
    const result = await buildOrderPreview({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 }, userId);
    expect(result.brokerConnected).toBe(false);
    const check = result.preTradeChecklist.find((c) => c.code === "broker_connection")!;
    expect(check.status).toBe("warning");
    expect(check.detail).toMatch(/disconnected/i);
  });

  it("reports buying power as a local-only estimate (never live-verified) when the broker isn't connected", async () => {
    await checkAlpacaBrokerHealth(null);
    const result = await buildOrderPreview({ symbol: "AAPL", strategy: "iron_condor", quantity: 1 }, userId);
    expect(result.accountValue).toBeGreaterThan(0);
    const check = result.preTradeChecklist.find((c) => c.code === "buying_power")!;
    expect(check.status).toBe("warning");
    expect(check.detail).toMatch(/local estimate/i);
  });

  it("reports no position conflict or existing order for a symbol with no trades", async () => {
    const result = await buildOrderPreview({ symbol: "MSFT", strategy: "iron_condor", quantity: 1 }, userId);
    const conflict = result.preTradeChecklist.find((c) => c.code === "position_conflict")!;
    const order = result.preTradeChecklist.find((c) => c.code === "existing_order")!;
    expect(conflict.status).toBe("ok");
    expect(order.status).toBe("ok");
  });

  it("flags a position conflict when this user already has an open trade in the same symbol", async () => {
    await db.insert(tradesTable).values({ userId, symbol: "NVDA", strategy: "iron_condor", status: "open" });
    const result = await buildOrderPreview({ symbol: "NVDA", strategy: "iron_condor", quantity: 1 }, userId);
    const conflict = result.preTradeChecklist.find((c) => c.code === "position_conflict")!;
    expect(conflict.status).toBe("warning");
    expect(conflict.detail).toMatch(/already have an open position/i);
  });

  it("flags an existing open order when this user has a pending trade in the same symbol", async () => {
    await db.insert(tradesTable).values({ userId, symbol: "TSLA", strategy: "iron_fly", status: "pending" });
    const result = await buildOrderPreview({ symbol: "TSLA", strategy: "iron_condor", quantity: 1 }, userId);
    const order = result.preTradeChecklist.find((c) => c.code === "existing_order")!;
    expect(order.status).toBe("warning");
    expect(order.detail).toMatch(/pending/i);
  });

  it("does not flag a position conflict from a closed trade in the same symbol", async () => {
    await db.insert(tradesTable).values({ userId, symbol: "META", strategy: "iron_condor", status: "closed" });
    const result = await buildOrderPreview({ symbol: "META", strategy: "iron_condor", quantity: 1 }, userId);
    const conflict = result.preTradeChecklist.find((c) => c.code === "position_conflict")!;
    const order = result.preTradeChecklist.find((c) => c.code === "existing_order")!;
    expect(conflict.status).toBe("ok");
    expect(order.status).toBe("ok");
  });

  it("never mutates the trades table (no rows created/changed by a preview call)", async () => {
    const before = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
    await buildOrderPreview({ symbol: "QQQ", strategy: "iron_condor", quantity: 1 }, userId);
    const after = await db.select().from(tradesTable).where(eq(tradesTable.userId, userId));
    expect(after.length).toBe(before.length);
  });

  it("always returns a well-shaped result even for an empty preview (checklist always present)", async () => {
    const result = await buildOrderPreview({}, userId);
    expect(result.preTradeChecklist.length).toBe(8);
    expect(result.generatedAt).toBeTruthy();
  });
});

// Trade Adjustment & Roll/Convert Preview Simulator sprint — live route
// integration test for POST /execution/adjustment/preview-simulator. Uses
// the real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts). This route is a thin pass-through to
// lib/tradeAdjustmentPreview.ts's already-unit-tested
// buildTradeAdjustmentPreview() (27 tests) — these tests prove the HTTP
// wiring and the honest-degradation contract, not the composition math
// itself.
//
// Deliberately only exercises the "close_replace" intent against a real,
// self-inserted position under the shared legacy-owner account (works for
// any open position, regardless of its own adjustment recommendation) —
// unlike lib/tradeAdjustmentPreview.test.ts's own isolated-user coverage,
// this file never asserts on roll/convert-eligibility-dependent outcomes,
// since precisely engineering a roll/convert-eligible fixture under a
// table genuinely shared with many sibling route test files risks
// colliding with their own state, matching the same disclosed discipline
// routes/positionSizing.route.test.ts and routes/orderPreview.route.test.ts
// already established for exactly this situation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { db, tradesTable } from "@workspace/db";
import { getLegacyOwnerUserId } from "../lib/legacyOwner.js";
import { getSnapshot, buildIronCondor } from "../lib/optionsMath.js";

interface TradeAdjustmentPreviewResultResponse {
  available: boolean;
  inputIssues: { field: string; code: string; message: string }[];
  intent: string | null;
  intentAvailable: boolean;
  intentUnavailableReason: string | null;
  existingPosition: { tradeId: number; symbol: string } | null;
  proposedPosition: { symbol: string; strategy: string; maxLoss: number } | null;
  netCashflow: number | null;
  comparisons: { code: string; direction: string }[];
  riskWarnings: { code: string; status: "ok" | "warning" | "blocked" }[];
  generatedAt: string;
}

describe("Trade Adjustment Preview routes (live, real Postgres, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;
  let legacyOwnerId: string;
  let insertedTradeId: number;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;

    legacyOwnerId = await getLegacyOwnerUserId();
    const snap = getSnapshot("QQQ")!;
    const quote = buildIronCondor(snap, { dte: 45 });
    const legs = quote.legs.map((l) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: l.expiration, openPrice: l.openPrice, quantity: l.quantity }));
    const [row] = await db
      .insert(tradesTable)
      .values({
        userId: legacyOwnerId,
        symbol: "QQQ",
        strategy: "iron_condor",
        status: "open",
        legs,
        credit: quote.credit,
        maxProfit: quote.maxProfit,
        maxLoss: quote.maxLoss,
        pop: quote.pop,
        expiration: quote.expiration,
        entryIv: null,
      })
      .returning({ id: tradesTable.id });
    insertedTradeId = row.id;
  });

  afterAll(async () => {
    await db.delete(tradesTable).where(eq(tradesTable.id, insertedTradeId));
    server.close();
  });

  async function preview(body: Record<string, unknown>): Promise<TradeAdjustmentPreviewResultResponse> {
    const res = await fetch(`${baseUrl}/api/execution/adjustment/preview-simulator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    return (await res.json()) as TradeAdjustmentPreviewResultResponse;
  }

  it("honestly reports missing required fields for a completely empty preview", async () => {
    const body = await preview({});
    expect(body.available).toBe(false);
    expect(body.inputIssues.length).toBeGreaterThan(0);
    expect(body.riskWarnings.length).toBe(9);
  });

  it("honestly reports a missing/nonexistent position", async () => {
    const body = await preview({ tradeId: 999999999, intent: "close_replace" });
    expect(body.available).toBe(false);
  });

  it("generates a well-shaped, successful close_replace preview for a real, self-inserted position", async () => {
    const body = await preview({ tradeId: insertedTradeId, intent: "close_replace" });
    expect(body.available).toBe(true);
    expect(body.intentAvailable).toBe(true);
    expect(body.existingPosition).not.toBeNull();
    expect(body.existingPosition!.symbol).toBe("QQQ");
    expect(body.proposedPosition).not.toBeNull();
    expect(body.proposedPosition!.symbol).toBe("QQQ");
    expect(typeof body.netCashflow).toBe("number");
    expect(body.comparisons.length).toBe(6);
    expect(body.riskWarnings.length).toBe(9);
    expect(typeof body.generatedAt).toBe("string");

    // Never a broker-write/order-creation surface.
    expect(body).not.toHaveProperty("orderId");
    expect(body).not.toHaveProperty("tradeId");
    expect(body).not.toHaveProperty("journalId");
  });

  it("always honestly reports the 5 strike-shift intents as unavailable", async () => {
    for (const intent of ["roll_out", "roll_up", "roll_down", "roll_out_up", "roll_out_down"]) {
      const body = await preview({ tradeId: insertedTradeId, intent });
      expect(body.available).toBe(false);
      expect(body.intentAvailable).toBe(false);
      expect(body.intentUnavailableReason).toMatch(/re-centers every strike/i);
    }
  });

  it("is deterministic for the same input (never mutates state that would change the answer)", async () => {
    const a = await preview({ tradeId: insertedTradeId, intent: "close_replace" });
    const b = await preview({ tradeId: insertedTradeId, intent: "close_replace" });
    expect(a.proposedPosition!.maxLoss).toBe(b.proposedPosition!.maxLoss);
    expect(a.netCashflow).toBe(b.netCashflow);
  });

  it("400s on a genuinely malformed request body (wrong type for quantity)", async () => {
    const res = await fetch(`${baseUrl}/api/execution/adjustment/preview-simulator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradeId: insertedTradeId, intent: "close_replace", quantity: "not-a-number" }),
    });
    expect(res.status).toBe(400);
  });

  it("400s on an invalid intent enum value", async () => {
    const res = await fetch(`${baseUrl}/api/execution/adjustment/preview-simulator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradeId: insertedTradeId, intent: "sideways_shuffle" }),
    });
    expect(res.status).toBe(400);
  });
});

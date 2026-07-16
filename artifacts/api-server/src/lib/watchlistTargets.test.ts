// Phase 4, Sprint 56 — Alerts & Notifications. Light regression coverage
// for computeWatchlistTargets() after its relocation out of
// routes/stockAnalyst.ts (Phase 2, Sprint 27) into this dedicated module —
// the exhaustive behavior coverage already exists at the route level
// (routes/valueWatchlist.route.test.ts, unmodified by this sprint, still
// passing against this same function via its new import path). This file
// only proves the relocation itself didn't change anything.

import { describe, it, expect } from "vitest";
import { computeWatchlistTargets } from "./watchlistTargets.js";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";
import type { valueWatchlistTable } from "@workspace/db";

type Row = typeof valueWatchlistTable.$inferSelect;

function row(overrides: Partial<Row>): Row {
  return {
    id: 1,
    userId: "00000000-0000-0000-0000-000000000000",
    symbol: "AAPL",
    category: "Researching",
    fairValueEstimate: null,
    desiredBuyPrice: null,
    marginOfSafetyTarget: 25,
    reason: "",
    currentDecision: "WATCHLIST",
    lastResearchedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Row;
}

describe("computeWatchlistTargets (post-relocation regression)", () => {
  const provider = new SimulatedFundamentalsProvider();

  it("honestly reports null for both flags when neither target is set", async () => {
    const check = await computeWatchlistTargets(row({}), provider);
    expect(check.currentPrice).not.toBeNull();
    expect(check.priceTargetCrossed).toBeNull();
    expect(check.marginOfSafetyTargetCrossed).toBeNull();
  });

  it("flags priceTargetCrossed true when the current price is at or below the desired buy price", async () => {
    const check = await computeWatchlistTargets(row({ desiredBuyPrice: 1_000_000 }), provider);
    expect(check.priceTargetCrossed).toBe(true);
  });

  it("flags priceTargetCrossed false when the current price is above the desired buy price", async () => {
    const check = await computeWatchlistTargets(row({ desiredBuyPrice: 0.01 }), provider);
    expect(check.priceTargetCrossed).toBe(false);
  });

  it("never resolves a price for an unresolvable symbol shape", async () => {
    const check = await computeWatchlistTargets(row({ symbol: "NOT A TICKER!!" }), provider);
    expect(check.currentPrice).toBeNull();
    expect(check.priceTargetCrossed).toBeNull();
    expect(check.marginOfSafetyTargetCrossed).toBeNull();
  });
});

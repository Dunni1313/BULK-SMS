// Phase 2, Sprint 11 — regression proof that SimulatedFundamentalsProvider's
// output for the 10 legacy symbols is byte-for-byte identical to what the
// pre-Sprint-11 optionsMath.getSnapshot()-based calculation produced, and that
// a previously-unsupported symbol now generates a valid SIMULATED report
// instead of null (approved Phase 2 plan, Sprint 11).
//
// The price check independently recomputes the ORIGINAL formula (hardcoded
// base prices, same seed format optionsMath.ts's UNIVERSE used) so a
// regression is caught even if investingUniverse.ts's own values were ever
// accidentally changed alongside the code under test.

import { describe, it, expect } from "vitest";
import { SimulatedFundamentalsProvider } from "./fundamentals.js";
import { makeRng } from "./deterministic.js";

// The exact base prices optionsMath.ts's UNIVERSE used for these 10 symbols
// before Sprint 11's universe decoupling.
const LEGACY_BASE_PRICES: Record<string, number> = {
  SPY: 540,
  QQQ: 460,
  IWM: 200,
  NVDA: 900,
  META: 510,
  AAPL: 195,
  AMZN: 185,
  MSFT: 420,
  GOOGL: 175,
  TSLA: 175,
};

function legacyPrice(symbol: string, dateStr: string): number {
  const rng = makeRng(`${symbol}|${dateStr}`);
  const drift = (rng() - 0.5) * 0.04;
  return Math.round(LEGACY_BASE_PRICES[symbol] * (1 + drift) * 100) / 100;
}

describe("SimulatedFundamentalsProvider — Sprint 11 regression: legacy 10 symbols unchanged", () => {
  const provider = new SimulatedFundamentalsProvider();
  const asOf = "2026-03-02";

  for (const symbol of Object.keys(LEGACY_BASE_PRICES)) {
    it(`${symbol}: price matches the pre-Sprint-11 optionsMath-derived formula exactly`, async () => {
      const f = await provider.getFundamentals(symbol, asOf);
      expect(f).not.toBeNull();
      expect(f!.price).toBe(legacyPrice(symbol, asOf));
    });
  }

  it("is stable across repeated calls for the same symbol/date", async () => {
    const a = await provider.getFundamentals("AAPL", asOf);
    const b = await provider.getFundamentals("AAPL", asOf);
    expect(a).toEqual(b);
  });
});

describe("SimulatedFundamentalsProvider — Sprint 11: symbols outside the legacy 10-symbol universe", () => {
  const provider = new SimulatedFundamentalsProvider();

  it("generates a valid SIMULATED report for a previously-unsupported symbol (IBM)", async () => {
    const f = await provider.getFundamentals("IBM", "2026-03-02");
    expect(f).not.toBeNull();
    expect(f!.symbol).toBe("IBM");
    expect(f!.dataSource).toBe("SIMULATED");
    expect(f!.price).toBeGreaterThan(0);
    // Never fabricate a plausible-sounding real company name for a symbol we
    // don't actually know — falls back to the ticker itself.
    expect(f!.name).toBe("IBM");
  });

  it("still honestly rejects clearly-invalid input", async () => {
    expect(await provider.getFundamentals("NOTASYMBOL")).toBeNull();
  });

  it("is deterministic for the same unsupported symbol", async () => {
    const a = await provider.getFundamentals("IBM", "2026-03-02");
    const b = await provider.getFundamentals("IBM", "2026-03-02");
    expect(a).toEqual(b);
  });
});

import { describe, it, expect } from "vitest";
import {
  validatePreTrade,
  toOcc,
  buildOptionOrderFromTrade,
  canonicalQuote,
  MIN_RAVISH_SCORE,
  MIN_LIQUIDITY_SCORE,
  type PreTradeInput,
} from "./execution.js";
import type { RiskLeg, RiskSettings } from "./risk.js";

const SETTINGS: RiskSettings = {
  maxRiskPerTrade: 1.0,
  maxPortfolioRisk: 10.0,
  stopLossMultiplier: 2.0,
  profitTarget50: 50,
  profitTarget75: 75,
  profitTarget90: 90,
};

const ACCOUNT = 125_000;

// A well-formed, defined-risk iron condor: short put + long put (lower wing),
// short call + long call (upper wing).
function ironCondorLegs(): RiskLeg[] {
  return [
    { side: "sell", optionType: "put", strike: 500, quantity: 1, expiration: "2026-07-18" },
    { side: "buy", optionType: "put", strike: 495, quantity: 1, expiration: "2026-07-18" },
    { side: "sell", optionType: "call", strike: 520, quantity: 1, expiration: "2026-07-18" },
    { side: "buy", optionType: "call", strike: 525, quantity: 1, expiration: "2026-07-18" },
  ];
}

function baseInput(overrides: Partial<PreTradeInput> = {}): PreTradeInput {
  return {
    legs: ironCondorLegs(),
    credit: 150,
    maxLoss: 350,
    ev: 40,
    ravishScore: 82,
    liquidityScore: 70,
    dataFresh: true,
    accountValue: ACCOUNT,
    openRiskDollars: 0,
    settings: SETTINGS,
    ...overrides,
  };
}

describe("validatePreTrade — pass", () => {
  it("accepts a well-formed iron condor within all limits", () => {
    const r = validatePreTrade(baseInput());
    expect(r.valid).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.checks.every((c) => c.passed)).toBe(true);
    expect(r.riskPct).toBeCloseTo(0.28, 2);
  });
});

describe("validatePreTrade — rejections", () => {
  it("rejects a naked short call (undefined risk)", () => {
    const legs: RiskLeg[] = [
      { side: "sell", optionType: "call", strike: 520, quantity: 1, expiration: "2026-07-18" },
    ];
    const r = validatePreTrade(baseInput({ legs }));
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /naked/i.test(v))).toBe(true);
    expect(r.checks.find((c) => c.label === "No naked calls")!.passed).toBe(false);
  });

  it("rejects a naked short put (undefined risk)", () => {
    const legs: RiskLeg[] = [
      { side: "sell", optionType: "put", strike: 500, quantity: 1, expiration: "2026-07-18" },
    ];
    const r = validatePreTrade(baseInput({ legs }));
    expect(r.valid).toBe(false);
    expect(r.checks.find((c) => c.label === "No naked puts")!.passed).toBe(false);
  });

  it("rejects non-positive expected value", () => {
    const r = validatePreTrade(baseInput({ ev: -25 }));
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /expected value/i.test(v))).toBe(true);
  });

  it("rejects a trade exceeding the per-trade risk cap (>1%)", () => {
    // 2000 / 125000 = 1.6% > 1% cap
    const r = validatePreTrade(baseInput({ maxLoss: 2000 }));
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /per-trade cap/i.test(v))).toBe(true);
    expect(r.riskPct).toBeCloseTo(1.6, 2);
  });

  it("rejects when portfolio risk after entry exceeds the cap (>10%)", () => {
    // existing 12000 + 1000 new = 13000 / 125000 = 10.4% > 10%; per-trade 0.8% is fine
    const r = validatePreTrade(baseInput({ maxLoss: 1000, openRiskDollars: 12_000 }));
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /portfolio risk/i.test(v))).toBe(true);
    expect(r.portfolioRiskAfterPct).toBeCloseTo(10.4, 1);
  });

  it("rejects a Ravish Score below the execution floor", () => {
    const r = validatePreTrade(baseInput({ ravishScore: MIN_RAVISH_SCORE - 5 }));
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /Ravish Score/i.test(v))).toBe(true);
  });

  it("rejects insufficient liquidity", () => {
    const r = validatePreTrade(baseInput({ liquidityScore: MIN_LIQUIDITY_SCORE - 1 }));
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /liquidity/i.test(v))).toBe(true);
  });

  it("rejects stale market data", () => {
    const r = validatePreTrade(baseInput({ dataFresh: false }));
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /stale/i.test(v))).toBe(true);
  });
});

describe("toOcc", () => {
  it("formats an OCC-21 option symbol", () => {
    expect(toOcc("AAPL", "2024-12-20", "call", 150)).toBe("AAPL241220C00150000");
    expect(toOcc("spy", "2026-07-18", "put", 500)).toBe("SPY260718P00500000");
  });

  it("zero-pads fractional strikes to thousandths", () => {
    expect(toOcc("SPY", "2026-07-18", "call", 512.5)).toBe("SPY260718C00512500");
  });
});

describe("buildOptionOrderFromTrade", () => {
  it("builds a 4-leg mleg credit order for an iron condor", () => {
    const quote = canonicalQuote("SPY", "iron_condor");
    expect(quote).not.toBeNull();
    const order = buildOptionOrderFromTrade(quote!, 1);
    expect(order.orderClass).toBe("mleg");
    expect(order.legs).toHaveLength(4);
    expect(order.legs.every((l) => /^SPY\d{6}[CP]\d{8}$/.test(l.occSymbol))).toBe(true);
    const sells = order.legs.filter((l) => l.side === "sell");
    const buys = order.legs.filter((l) => l.side === "buy");
    expect(sells).toHaveLength(2);
    expect(buys).toHaveLength(2);
    expect(order.legs.find((l) => l.side === "sell")!.positionIntent).toBe("sell_to_open");
  });

  it("builds a 2-leg order for a calendar spread", () => {
    const quote = canonicalQuote("SPY", "calendar_spread");
    expect(quote).not.toBeNull();
    const order = buildOptionOrderFromTrade(quote!, 1);
    expect(order.legs).toHaveLength(2);
  });

  it("scales the spread count via order quantity, keeping per-leg ratio fixed", () => {
    const quote = canonicalQuote("SPY", "iron_condor");
    const one = buildOptionOrderFromTrade(quote!, 1);
    const three = buildOptionOrderFromTrade(quote!, 3);
    expect(three.quantity).toBe(3);
    // Alpaca mleg semantics: ratio_qty is per-spread and stays fixed; the spread
    // count is carried by the order-level quantity.
    expect(three.legs[0].ratioQty).toBe(one.legs[0].ratioQty);
  });
});

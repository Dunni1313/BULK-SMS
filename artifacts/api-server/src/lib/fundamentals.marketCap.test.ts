// Phase 13 — Institutional Portfolio Manager. Unit tests for the new
// `marketCap` field on Fundamentals across all three providers. FMP's
// /profile and Alpha Vantage's OVERVIEW both already carry a documented
// market-cap field via calls this codebase already makes for sector/industry
// (Sprint 20) and deriveQualitative()'s own internal sizeScore (Sprint 15) —
// this sprint simply exposes it publicly, no new fetch.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  FmpFundamentalsProvider,
  AlphaVantageFundamentalsProvider,
  SimulatedFundamentalsProvider,
} from "./fundamentals.js";

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as unknown as Response;
}

const baseFmpEndpoints: Record<string, unknown> = {
  "/profile/": [{ companyName: "Acme Corp", price: 100, isEtf: false, mktCap: 5e11, sector: "Technology", industry: "Software", beta: 1.35 }],
  "/ratios-ttm/": [
    {
      dividendYielTTM: 0.01,
      grossProfitMarginTTM: 0.45,
      operatingProfitMarginTTM: 0.3,
      netProfitMarginTTM: 0.25,
      returnOnEquityTTM: 0.4,
      debtEquityRatioTTM: 0.5,
      interestCoverageTTM: 25,
      currentRatioTTM: 1.4,
    },
  ],
  "/key-metrics-ttm/": [
    {
      netIncomePerShareTTM: 6,
      revenuePerShareTTM: 24,
      bookValuePerShareTTM: 10,
      freeCashFlowPerShareTTM: 5,
      roicTTM: 0.3,
      cashPerShareTTM: 8,
    },
  ],
  "/financial-growth/": [{ revenueGrowth: 0.12, epsgrowth: 0.15 }],
  "/enterprise-values/": [],
  "/insider-trading?": [],
};

function mockFmp(extra: Record<string, unknown> = {}): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    for (const [key, data] of Object.entries({ ...baseFmpEndpoints, ...extra })) {
      if (url.includes(key)) return jsonResponse(data);
    }
    throw new Error(`unexpected url ${url}`);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SimulatedFundamentalsProvider — Phase 13 marketCap", () => {
  it("produces a deterministic marketCap spanning small-cap to mega-cap", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const f = await provider.getFundamentals("AAPL");
    expect(f!.marketCap).not.toBeNull();
    expect(f!.marketCap!).toBeGreaterThanOrEqual(1e8);
    expect(f!.marketCap!).toBeLessThanOrEqual(5e12);
  });

  it("is deterministic — repeated calls for the same symbol produce a byte-identical marketCap", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const a = await provider.getFundamentals("MSFT");
    const b = await provider.getFundamentals("MSFT");
    expect(a!.marketCap).toBe(b!.marketCap);
  });

  it("differs across symbols (seeded per-symbol, not a single global value)", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const a = await provider.getFundamentals("AAPL");
    const b = await provider.getFundamentals("GOOGL");
    expect(a!.marketCap).not.toBe(b!.marketCap);
  });
});

describe("FmpFundamentalsProvider — Phase 13 marketCap (mocked fetch, live verification deferred)", () => {
  it("maps marketCap directly from the already-fetched /profile response's mktCap", async () => {
    mockFmp();
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("ACME");
    expect(f).not.toBeNull();
    expect(f!.marketCap).toBe(5e11);
  });

  it("honestly reports null when the provider's profile omits mktCap", async () => {
    mockFmp({
      "/profile/": [{ companyName: "Acme Corp", price: 100, isEtf: false, sector: "Technology", industry: "Software", beta: 1.35 }],
    });
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("NOCAP");
    expect(f!.marketCap).toBeNull();
  });
});

describe("AlphaVantageFundamentalsProvider — Phase 13 marketCap (mocked fetch, live verification deferred)", () => {
  it("maps MarketCapitalization directly from the already-fetched OVERVIEW response", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("function=OVERVIEW"))
        return jsonResponse({
          Symbol: "ACME",
          Name: "Acme Corp",
          AssetType: "Common Stock",
          EPS: "6",
          Sector: "Technology",
          Industry: "Software",
          Beta: "0.92",
          MarketCapitalization: "750000000000",
        });
      if (url.includes("function=GLOBAL_QUOTE")) return jsonResponse({ "Global Quote": { "05. price": "100" } });
      if (url.includes("function=CASH_FLOW")) return jsonResponse({ annualReports: [] });
      if (url.includes("function=BALANCE_SHEET")) return jsonResponse({ annualReports: [] });
      throw new Error(`unexpected url ${url}`);
    });
    const provider = new AlphaVantageFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("ACME");
    expect(f!.marketCap).toBe(750000000000);
  });

  it("honestly reports null when OVERVIEW omits MarketCapitalization", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("function=OVERVIEW"))
        return jsonResponse({ Symbol: "NOCAP", Name: "No Cap Co", AssetType: "Common Stock", EPS: "6" });
      if (url.includes("function=GLOBAL_QUOTE")) return jsonResponse({ "Global Quote": { "05. price": "100" } });
      if (url.includes("function=CASH_FLOW")) return jsonResponse({ annualReports: [] });
      if (url.includes("function=BALANCE_SHEET")) return jsonResponse({ annualReports: [] });
      throw new Error(`unexpected url ${url}`);
    });
    const provider = new AlphaVantageFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("NOCAP");
    expect(f!.marketCap).toBeNull();
  });
});

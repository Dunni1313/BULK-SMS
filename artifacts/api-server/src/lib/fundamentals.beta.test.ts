// Phase 2, Sprint 29 — Portfolio Risk Analysis. Unit tests for the new
// `beta` field on Fundamentals across all three providers. FMP's /profile
// and Alpha Vantage's OVERVIEW both already carry a documented `beta` field
// via calls this codebase already makes for sector/industry (Sprint 20) —
// this sprint simply maps it, no new fetch.

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

describe("SimulatedFundamentalsProvider — Sprint 29 beta", () => {
  it("produces a deterministic beta in a plausible 0.5-2.0 range", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const f = await provider.getFundamentals("AAPL");
    expect(f!.beta).not.toBeNull();
    expect(f!.beta!).toBeGreaterThanOrEqual(0.5);
    expect(f!.beta!).toBeLessThanOrEqual(2.0);
  });

  it("is deterministic — repeated calls for the same symbol produce a byte-identical beta", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const a = await provider.getFundamentals("MSFT");
    const b = await provider.getFundamentals("MSFT");
    expect(a!.beta).toBe(b!.beta);
  });

  it("differs across symbols (seeded per-symbol, not a single global value)", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const a = await provider.getFundamentals("AAPL");
    const b = await provider.getFundamentals("GOOGL");
    expect(a!.beta).not.toBe(b!.beta);
  });
});

describe("FmpFundamentalsProvider — Sprint 29 beta (mocked fetch, live verification deferred)", () => {
  it("maps beta directly from the already-fetched /profile response", async () => {
    mockFmp();
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("ACME");
    expect(f).not.toBeNull();
    expect(f!.beta).toBe(1.35);
  });

  it("honestly reports null when the provider's profile omits beta", async () => {
    mockFmp({
      "/profile/": [{ companyName: "Acme Corp", price: 100, isEtf: false, mktCap: 5e11, sector: "Technology", industry: "Software" }],
    });
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("NOBETA");
    expect(f!.beta).toBeNull();
  });
});

describe("AlphaVantageFundamentalsProvider — Sprint 29 beta (mocked fetch, live verification deferred)", () => {
  it("maps Beta directly from the already-fetched OVERVIEW response", async () => {
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
        });
      if (url.includes("function=GLOBAL_QUOTE")) return jsonResponse({ "Global Quote": { "05. price": "100" } });
      if (url.includes("function=CASH_FLOW")) return jsonResponse({ annualReports: [] });
      if (url.includes("function=BALANCE_SHEET")) return jsonResponse({ annualReports: [] });
      throw new Error(`unexpected url ${url}`);
    });
    const provider = new AlphaVantageFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("ACME");
    expect(f!.beta).toBeCloseTo(0.92, 4);
  });

  it("honestly reports null when OVERVIEW omits Beta", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("function=OVERVIEW"))
        return jsonResponse({ Symbol: "NOBETA", Name: "No Beta Co", AssetType: "Common Stock", EPS: "6" });
      if (url.includes("function=GLOBAL_QUOTE")) return jsonResponse({ "Global Quote": { "05. price": "100" } });
      if (url.includes("function=CASH_FLOW")) return jsonResponse({ annualReports: [] });
      if (url.includes("function=BALANCE_SHEET")) return jsonResponse({ annualReports: [] });
      throw new Error(`unexpected url ${url}`);
    });
    const provider = new AlphaVantageFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("NOBETA");
    expect(f!.beta).toBeNull();
  });
});

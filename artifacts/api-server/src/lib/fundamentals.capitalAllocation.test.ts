// Phase 2, Sprint 24 — Tom Nash Investment Engine, Enhancement I: Capital
// Allocation, Buybacks & Insider Ownership. Unit tests for the new
// Fundamentals fields (insiderOwnershipPct, sharesOutstandingChange5y,
// netInsiderActivity) across all three providers.
//
// FMP's /enterprise-values and /insider-trading endpoints have no prior
// in-repo precedent (unlike ratios-ttm/key-metrics-ttm) and live verification
// could not be performed this session (no FMP_API_KEY available) — these
// tests cover the parsing/degrade-honestly logic against mocked fetch
// responses only, never a live call. Alpha Vantage implements no new fetch
// this sprint at all (a disclosed scope reduction): all three fields are
// asserted null.

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
  "/profile/": [{ companyName: "Acme Corp", price: 100, isEtf: false, mktCap: 5e11, sector: "Technology", industry: "Software" }],
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
};

function mockFmp(extra: Record<string, unknown | (() => Response)>): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    for (const [key, data] of Object.entries({ ...baseFmpEndpoints, ...extra })) {
      if (url.includes(key)) {
        if (typeof data === "function") return (data as () => Response)();
        return jsonResponse(data);
      }
    }
    throw new Error(`unexpected url ${url}`);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SimulatedFundamentalsProvider — Sprint 24 capital allocation fields", () => {
  it("produces deterministic, in-range aggregate values, never a named individual's transaction", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const f = await provider.getFundamentals("AAPL");
    expect(f).not.toBeNull();
    expect(f!.insiderOwnershipPct).not.toBeNull();
    expect(f!.insiderOwnershipPct!).toBeGreaterThanOrEqual(0.005);
    expect(f!.insiderOwnershipPct!).toBeLessThanOrEqual(0.155);
    expect(f!.sharesOutstandingChange5y).not.toBeNull();
    expect(f!.sharesOutstandingChange5y!).toBeGreaterThanOrEqual(-0.18);
    expect(f!.sharesOutstandingChange5y!).toBeLessThanOrEqual(0.12);
    expect(["buying", "selling", "neutral"]).toContain(f!.netInsiderActivity);
  });

  it("is deterministic — repeated calls for the same symbol produce byte-identical values", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const a = await provider.getFundamentals("MSFT");
    const b = await provider.getFundamentals("MSFT");
    expect(a!.insiderOwnershipPct).toBe(b!.insiderOwnershipPct);
    expect(a!.sharesOutstandingChange5y).toBe(b!.sharesOutstandingChange5y);
    expect(a!.netInsiderActivity).toBe(b!.netInsiderActivity);
  });

  it("differs across symbols (seeded per-symbol, not a single global value)", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const a = await provider.getFundamentals("AAPL");
    const b = await provider.getFundamentals("GOOGL");
    expect(
      a!.insiderOwnershipPct !== b!.insiderOwnershipPct ||
        a!.sharesOutstandingChange5y !== b!.sharesOutstandingChange5y,
    ).toBe(true);
  });
});

describe("FmpFundamentalsProvider — Sprint 24 capital allocation fetch (mocked fetch, live verification deferred)", () => {
  it("computes a 5-year shares-outstanding trend from /enterprise-values and never a named-individual insider claim", async () => {
    mockFmp({
      "/enterprise-values/": [
        { date: "2025-12-31", numberOfShares: 900 },
        { date: "2024-12-31", numberOfShares: 950 },
        { date: "2023-12-31", numberOfShares: 970 },
        { date: "2022-12-31", numberOfShares: 990 },
        { date: "2021-12-31", numberOfShares: 1000 },
      ],
      "/insider-trading?": [
        { transactionType: "P-Purchase", securitiesTransacted: 500 },
        { transactionType: "S-Sale", securitiesTransacted: 100 },
      ],
    });
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("ACME");
    expect(f).not.toBeNull();
    // (900 - 1000) / 1000 = -0.10 (net buybacks over 5 years).
    expect(f!.sharesOutstandingChange5y).toBeCloseTo(-0.1, 4);
    // 500 buy / 600 total = 83% buy share >= 0.6 threshold => "buying".
    expect(f!.netInsiderActivity).toBe("buying");
    // Never reliably available from a documented free-tier endpoint this
    // session could verify — honestly null, never guessed.
    expect(f!.insiderOwnershipPct).toBeNull();
  });

  it("classifies a majority-sell aggregate as 'selling'", async () => {
    mockFmp({
      "/enterprise-values/": [{ date: "2025-12-31", numberOfShares: 1000 }],
      "/insider-trading?": [
        { transactionType: "S-Sale", securitiesTransacted: 800 },
        { transactionType: "P-Purchase", securitiesTransacted: 100 },
      ],
    });
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("SELLR");
    expect(f!.netInsiderActivity).toBe("selling");
  });

  it("classifies a roughly balanced aggregate as 'neutral'", async () => {
    mockFmp({
      "/enterprise-values/": [{ date: "2025-12-31", numberOfShares: 1000 }],
      "/insider-trading?": [
        { transactionType: "S-Sale", securitiesTransacted: 500 },
        { transactionType: "P-Purchase", securitiesTransacted: 480 },
      ],
    });
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("NEUTRL");
    expect(f!.netInsiderActivity).toBe("neutral");
  });

  it("degrades honestly (both fields null) when /enterprise-values and /insider-trading fail, without blocking the main fetch", async () => {
    mockFmp({
      "/enterprise-values/": () => {
        throw new Error("network down");
      },
      "/insider-trading?": () => {
        throw new Error("network down");
      },
    });
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("DEGRAD");
    expect(f).not.toBeNull();
    expect(f!.dataSource).toBe("LIVE");
    expect(f!.sharesOutstandingChange5y).toBeNull();
    expect(f!.netInsiderActivity).toBeNull();
    expect(f!.insiderOwnershipPct).toBeNull();
  });

  it("degrades honestly when /enterprise-values and /insider-trading return an FMP error-shaped response", async () => {
    mockFmp({
      "/enterprise-values/": { "Error Message": "Limit Reach" },
      "/insider-trading?": { "Error Message": "Limit Reach" },
    });
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("ERRSHP");
    expect(f).not.toBeNull();
    expect(f!.sharesOutstandingChange5y).toBeNull();
    expect(f!.netInsiderActivity).toBeNull();
  });

  it("degrades honestly when the shares-outstanding series has fewer than 2 points", async () => {
    mockFmp({
      "/enterprise-values/": [{ date: "2025-12-31", numberOfShares: 1000 }],
      "/insider-trading?": [],
    });
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("ONEPT");
    expect(f!.sharesOutstandingChange5y).toBeNull();
    expect(f!.netInsiderActivity).toBeNull();
  });
});

describe("AlphaVantageFundamentalsProvider — Sprint 24 scope reduction (no fetch implemented)", () => {
  it("leaves all three capital-allocation fields honestly null", async () => {
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
        });
      if (url.includes("function=GLOBAL_QUOTE")) return jsonResponse({ "Global Quote": { "05. price": "100" } });
      if (url.includes("function=CASH_FLOW")) return jsonResponse({ annualReports: [] });
      if (url.includes("function=BALANCE_SHEET")) return jsonResponse({ annualReports: [] });
      throw new Error(`unexpected url ${url}`);
    });
    const provider = new AlphaVantageFundamentalsProvider("test-key");
    const f = await provider.getFundamentals("ACME");
    expect(f).not.toBeNull();
    expect(f!.insiderOwnershipPct).toBeNull();
    expect(f!.sharesOutstandingChange5y).toBeNull();
    expect(f!.netInsiderActivity).toBeNull();
  });
});

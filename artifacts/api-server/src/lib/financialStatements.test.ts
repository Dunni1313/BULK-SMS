// Phase 2, Sprint 19 — Financial Statement Analysis unit tests (approved Phase 2
// plan, Sprint 19). Fetched on demand only; never part of getFundamentals()/
// buildValueResearchReport(). Live FMP/Alpha Vantage verification is explicitly
// DEFERRED — no FMP_API_KEY or ALPHA_VANTAGE_API_KEY was available in this
// session, so these tests cover the parsing/fallback logic against mocked fetch
// responses, never a live call.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  FmpFundamentalsProvider,
  AlphaVantageFundamentalsProvider,
  SimulatedFundamentalsProvider,
  getFundamentals,
} from "./fundamentals.js";

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SimulatedFundamentalsProvider.getFinancialStatements", () => {
  it("returns 5 years of statements, clearly labeled SIMULATED", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const statements = await provider.getFinancialStatements("AAPL");
    expect(statements).not.toBeNull();
    expect(statements!.dataSource).toBe("SIMULATED");
    expect(statements!.symbol).toBe("AAPL");
    expect(statements!.incomeStatement).toHaveLength(5);
    expect(statements!.balanceSheet).toHaveLength(5);
    expect(statements!.cashFlow).toHaveLength(5);
  });

  it("is internally consistent with the existing simulated Fundamentals output — never an unrelated random source", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const f = await getFundamentals("AAPL");
    const statements = await provider.getFinancialStatements("AAPL");
    expect(f).not.toBeNull();
    expect(statements).not.toBeNull();

    // Every income-statement year's margins reconcile exactly against
    // Fundamentals' own margin fields (the same numbers, not independently
    // re-derived), and gross/operating splits are internally consistent.
    for (const y of statements!.incomeStatement) {
      expect(y.grossProfit).toBe(Math.round(y.revenue * f!.grossMargin));
      expect(y.costOfRevenue).toBe(y.revenue - y.grossProfit);
      expect(y.operatingIncome).toBe(Math.round(y.revenue * f!.operatingMargin));
      expect(y.operatingExpenses).toBe(y.grossProfit - y.operatingIncome);
    }
    // Revenue is strictly monotonic in the same direction as Fundamentals' own
    // revenueHistory (both derived from the same seeded growth rate).
    const revenues = statements!.incomeStatement.map((y) => y.revenue);
    const perShareHistory = f!.revenueHistory.slice(-5);
    for (let i = 1; i < revenues.length; i++) {
      const grew = perShareHistory[i] >= perShareHistory[i - 1];
      const revenueGrew = revenues[i] >= revenues[i - 1];
      expect(revenueGrew).toBe(grew);
    }
    // Balance sheet reconciles: assets = liabilities + equity, every year.
    for (const y of statements!.balanceSheet) {
      expect(y.totalAssets).toBe(y.totalLiabilities + y.totalEquity);
    }
    // Cash flow reconciles: FCF = Operating CF - Capex, every year.
    for (const y of statements!.cashFlow) {
      expect(y.freeCashFlow).toBe(y.operatingCashFlow - y.capitalExpenditures);
    }
  });

  it("is deterministic — repeated calls for the same symbol produce byte-identical statements", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const a = await provider.getFinancialStatements("MSFT");
    const b = await provider.getFinancialStatements("MSFT");
    expect(a!.incomeStatement).toEqual(b!.incomeStatement);
    expect(a!.balanceSheet).toEqual(b!.balanceSheet);
    expect(a!.cashFlow).toEqual(b!.cashFlow);
  });

  it("reports current assets/inventory as 0 for ETFs (not meaningful for a diversified fund), matching Financial Ratios' own ETF handling", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const statements = await provider.getFinancialStatements("SPY"); // ETF in INVESTING_UNIVERSE
    expect(statements).not.toBeNull();
    for (const y of statements!.balanceSheet) {
      expect(y.currentAssets).toBe(0);
      expect(y.inventory).toBe(0);
    }
  });

  it("honestly returns null for an invalid ticker shape, never fabricating statements", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const statements = await provider.getFinancialStatements("NOT A TICKER!!");
    expect(statements).toBeNull();
  });
});

describe("FmpFundamentalsProvider.getFinancialStatements (mocked fetch — live verification deferred, no FMP_API_KEY in this session)", () => {
  it("parses a successful 3-endpoint response into oldest-to-newest annual statements", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("/income-statement/"))
        return jsonResponse([
          { date: "2025-12-31", revenue: 200, costOfRevenue: 120, grossProfit: 80, operatingExpenses: 30, operatingIncome: 50, netIncome: 40 },
          { date: "2024-12-31", revenue: 180, costOfRevenue: 110, grossProfit: 70, operatingExpenses: 28, operatingIncome: 42, netIncome: 34 },
        ]);
      if (url.includes("/balance-sheet-statement/"))
        return jsonResponse([
          { date: "2025-12-31", totalAssets: 500, totalLiabilities: 200, totalStockholdersEquity: 300, totalCurrentAssets: 150, totalCurrentLiabilities: 80, inventory: 20, cashAndCashEquivalents: 60 },
        ]);
      if (url.includes("/cash-flow-statement/"))
        return jsonResponse([
          { date: "2025-12-31", operatingCashFlow: 60, capitalExpenditure: -10, freeCashFlow: 50, netCashUsedForInvestingActivites: -15, netCashUsedProvidedByFinancingActivities: -20 },
        ]);
      throw new Error(`unexpected url ${url}`);
    });

    const provider = new FmpFundamentalsProvider("test-key");
    const statements = await provider.getFinancialStatements("ACME");
    expect(statements).not.toBeNull();
    expect(statements!.dataSource).toBe("LIVE");
    // Most-recent-first from the API is reversed to oldest -> newest.
    expect(statements!.incomeStatement.map((y) => y.year)).toEqual(["2024-12-31", "2025-12-31"]);
    expect(statements!.incomeStatement[1].revenue).toBe(200);
    expect(statements!.balanceSheet[0].totalAssets).toBe(500);
    expect(statements!.cashFlow[0].capitalExpenditures).toBe(10); // sign normalized to positive
    expect(statements!.cashFlow[0].freeCashFlow).toBe(50);
  });

  it("throws on a rate-limited/error FMP response, never silently returning empty or fabricated statements", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({ "Error Message": "Limit Reach" }),
    );
    const provider = new FmpFundamentalsProvider("test-key");
    // A distinct symbol from the success-path test above — statementsCache is
    // keyed by symbol only (no asOf), so reusing "ACME" here would silently hit
    // that test's cached result instead of exercising this mocked error path.
    await expect(provider.getFinancialStatements("RATELMTD")).rejects.toThrow(/rate limit|error/i);
  });

  it("honestly returns null when all three statement endpoints come back empty", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse([]));
    const provider = new FmpFundamentalsProvider("test-key");
    const statements = await provider.getFinancialStatements("UNKNOWNXYZ");
    expect(statements).toBeNull();
  });
});

describe("AlphaVantageFundamentalsProvider.getFinancialStatements (mocked fetch — live verification deferred, no ALPHA_VANTAGE_API_KEY in this session)", () => {
  it("parses a successful annualReports response into oldest-to-newest annual statements", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("function=INCOME_STATEMENT"))
        return jsonResponse({
          annualReports: [
            { fiscalDateEnding: "2025-12-31", totalRevenue: "200", grossProfit: "80", operatingExpenses: "30", operatingIncome: "50", netIncome: "40" },
            { fiscalDateEnding: "2024-12-31", totalRevenue: "180", grossProfit: "70", operatingExpenses: "28", operatingIncome: "42", netIncome: "34" },
          ],
        });
      if (url.includes("function=BALANCE_SHEET"))
        return jsonResponse({
          annualReports: [
            { fiscalDateEnding: "2025-12-31", totalAssets: "500", totalLiabilities: "200", totalShareholderEquity: "300", totalCurrentAssets: "150", totalCurrentLiabilities: "80", inventory: "20", cashAndCashEquivalentsAtCarryingValue: "60" },
          ],
        });
      if (url.includes("function=CASH_FLOW"))
        return jsonResponse({
          annualReports: [
            { fiscalDateEnding: "2025-12-31", operatingCashflow: "60", capitalExpenditures: "10", cashflowFromInvestment: "-15", cashflowFromFinancing: "-20" },
          ],
        });
      throw new Error(`unexpected url ${url}`);
    });

    const provider = new AlphaVantageFundamentalsProvider("test-key");
    const statements = await provider.getFinancialStatements("ACME");
    expect(statements).not.toBeNull();
    expect(statements!.dataSource).toBe("LIVE");
    expect(statements!.incomeStatement.map((y) => y.year)).toEqual(["2024-12-31", "2025-12-31"]);
    expect(statements!.incomeStatement[1].revenue).toBe(200);
    expect(statements!.balanceSheet[0].totalAssets).toBe(500);
    // Alpha Vantage doesn't publish FCF directly — derived as OCF - Capex.
    expect(statements!.cashFlow[0].freeCashFlow).toBe(50);
  });

  it("throws on a rate-limited/Note Alpha Vantage response, never silently returning empty or fabricated statements", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({ Note: "Thank you for using Alpha Vantage! Our standard API rate limit is..." }),
    );
    const provider = new AlphaVantageFundamentalsProvider("test-key");
    // Distinct symbol from the success-path test above, for the same reason as
    // the FMP rate-limit test: statementsCache is keyed by symbol only.
    await expect(provider.getFinancialStatements("RATELMTD")).rejects.toThrow(/rate limit|error/i);
  });

  it("honestly returns null when all three statement endpoints come back with no annualReports", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse({}));
    const provider = new AlphaVantageFundamentalsProvider("test-key");
    const statements = await provider.getFinancialStatements("UNKNOWNXYZ");
    expect(statements).toBeNull();
  });
});

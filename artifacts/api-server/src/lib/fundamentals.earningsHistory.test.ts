// Phase 2, Sprint 25 — Earnings Intelligence Engine. Unit tests for the new
// getEarningsHistory() method across all three FundamentalsProvider
// implementations.
//
// FMP's historical-earnings-calendar endpoint and Alpha Vantage's EARNINGS
// function are both documented public API shapes, but LIVE VERIFICATION IS
// DEFERRED — no FMP_API_KEY or ALPHA_VANTAGE_API_KEY was available in this
// session, so these tests cover the parsing/error-handling logic against
// mocked fetch responses only, never a live call.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  FmpFundamentalsProvider,
  AlphaVantageFundamentalsProvider,
  SimulatedFundamentalsProvider,
  EARNINGS_QUARTERS_TRACKED,
} from "./fundamentals.js";

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SimulatedFundamentalsProvider.getEarningsHistory", () => {
  it("returns EARNINGS_QUARTERS_TRACKED quarters, clearly labeled SIMULATED", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const history = await provider.getEarningsHistory("AAPL");
    expect(history).not.toBeNull();
    expect(history!.dataSource).toBe("SIMULATED");
    expect(history!.symbol).toBe("AAPL");
    expect(history!.quarters.length).toBe(EARNINGS_QUARTERS_TRACKED);
  });

  it("is deterministic — repeated calls for the same symbol produce byte-identical quarters", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const a = await provider.getEarningsHistory("MSFT");
    const b = await provider.getEarningsHistory("MSFT");
    expect(a!.quarters).toEqual(b!.quarters);
  });

  it("every quarter carries a computed, non-fabricated surprise% consistent with its own actual/estimate", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const history = await provider.getEarningsHistory("GOOGL");
    for (const quarter of history!.quarters) {
      expect(quarter.epsActual).not.toBeNull();
      expect(quarter.epsEstimate).not.toBeNull();
      expect(quarter.revenueActual).not.toBeNull();
      expect(quarter.revenueEstimate).not.toBeNull();
      const expected = Math.round(((quarter.epsActual! - quarter.epsEstimate!) / Math.abs(quarter.epsEstimate!)) * 100 * 100) / 100;
      expect(quarter.epsSurprisePct).toBeCloseTo(expected, 2);
    }
  });

  it("honestly returns null for an invalid ticker shape, never fabricating history", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const history = await provider.getEarningsHistory("NOT A TICKER!!");
    expect(history).toBeNull();
  });

  it("differs across symbols (seeded per-symbol, not a single global sequence)", async () => {
    const provider = new SimulatedFundamentalsProvider();
    const a = await provider.getEarningsHistory("AAPL");
    const b = await provider.getEarningsHistory("NVDA");
    expect(a!.quarters).not.toEqual(b!.quarters);
  });
});

describe("FmpFundamentalsProvider.getEarningsHistory (mocked fetch — live verification deferred, no FMP_API_KEY in this session)", () => {
  it("parses a successful earning-calendar response into oldest-to-newest quarters with computed surprise%", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("/historical/earning_calendar/"))
        return jsonResponse([
          { date: "2025-10-20", fiscalDateEnding: "2025-09-30", eps: 2.2, epsEstimated: 2.0, revenue: 95000000000, revenueEstimated: 94000000000 },
          { date: "2025-07-20", fiscalDateEnding: "2025-06-30", eps: 1.8, epsEstimated: 1.9, revenue: 90000000000, revenueEstimated: 91000000000 },
        ]);
      throw new Error(`unexpected url ${url}`);
    });

    const provider = new FmpFundamentalsProvider("test-key");
    const history = await provider.getEarningsHistory("ACME");
    expect(history).not.toBeNull();
    expect(history!.dataSource).toBe("LIVE");
    // FMP returns most-recent-first; reversed to oldest -> newest.
    expect(history!.quarters.map((q) => q.fiscalQuarter)).toEqual(["Q2 2025", "Q3 2025"]);
    expect(history!.quarters[1].epsActual).toBe(2.2);
    expect(history!.quarters[1].epsSurprisePct).toBeCloseTo(10, 1); // (2.2-2.0)/2.0*100
    expect(history!.quarters[0].revenueSurprisePct).toBeCloseTo(((90e9 - 91e9) / 91e9) * 100, 1);
  });

  it("throws on a rate-limited/error FMP response, never silently returning empty or fabricated history", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse({ "Error Message": "Limit Reach" }));
    const provider = new FmpFundamentalsProvider("test-key");
    await expect(provider.getEarningsHistory("RATELMTD")).rejects.toThrow(/rate limit|error/i);
  });

  it("honestly returns null when the earnings-calendar endpoint comes back empty", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse([]));
    const provider = new FmpFundamentalsProvider("test-key");
    const history = await provider.getEarningsHistory("UNKNOWNXYZ");
    expect(history).toBeNull();
  });
});

describe("AlphaVantageFundamentalsProvider.getEarningsHistory (mocked fetch — live verification deferred, no ALPHA_VANTAGE_API_KEY in this session)", () => {
  it("parses a successful EARNINGS response into oldest-to-newest quarters, revenue fields honestly null (per the approved Sprint 25 decision)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("function=EARNINGS"))
        return jsonResponse({
          symbol: "ACME",
          quarterlyEarnings: [
            { fiscalDateEnding: "2025-09-30", reportedDate: "2025-10-20", reportedEPS: "2.28", estimatedEPS: "2.2", surprise: "0.08", surprisePercentage: "3.6364" },
            { fiscalDateEnding: "2025-06-30", reportedDate: "2025-07-20", reportedEPS: "1.8", estimatedEPS: "1.9", surprise: "-0.1", surprisePercentage: "-5.2632" },
          ],
        });
      throw new Error(`unexpected url ${url}`);
    });

    const provider = new AlphaVantageFundamentalsProvider("test-key");
    const history = await provider.getEarningsHistory("ACME");
    expect(history).not.toBeNull();
    expect(history!.dataSource).toBe("LIVE");
    expect(history!.quarters.map((q) => q.fiscalQuarter)).toEqual(["Q2 2025", "Q3 2025"]);
    // Prefers Alpha Vantage's own reported surprisePercentage over recomputing.
    expect(history!.quarters[1].epsSurprisePct).toBeCloseTo(3.6364, 3);
    for (const quarter of history!.quarters) {
      expect(quarter.revenueActual).toBeNull();
      expect(quarter.revenueEstimate).toBeNull();
      expect(quarter.revenueSurprisePct).toBeNull();
    }
  });

  it("throws on a rate-limited/Note Alpha Vantage response, never silently returning empty or fabricated history", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({ Note: "Thank you for using Alpha Vantage! Our standard API rate limit is..." }),
    );
    const provider = new AlphaVantageFundamentalsProvider("test-key");
    await expect(provider.getEarningsHistory("RATELMTD")).rejects.toThrow(/rate limit|error/i);
  });

  it("honestly returns null when quarterlyEarnings is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse({}));
    const provider = new AlphaVantageFundamentalsProvider("test-key");
    const history = await provider.getEarningsHistory("UNKNOWNXYZ");
    expect(history).toBeNull();
  });
});

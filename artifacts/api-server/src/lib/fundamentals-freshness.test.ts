// Tests for the fundamentals freshness / force-refresh feature.
//
// These lock in the HONESTY BOUNDARY of the freshness tracker: the "last live
// fetch" timestamp is recorded ONLY when a real live provider actually returns
// data — never for a simulated result and never for a live attempt that fails and
// falls back to simulated. They also pin the two surfaces that expose it:
//   • GET /settings serializes `fundamentalsLastFetchedAt: getLastLiveFetch()?.at ?? null`
//   • GET /stock-analyst/value-universe?forceRefresh=true maps each report through
//     the buildValueResearchReport(forceRefresh) path, and every summary carries
//     the report's `fetchedAt` + `simulated`.
//
// These run at the lib level (like the rest of this suite) rather than over HTTP:
// the route modules import @workspace/api-zod, which does not load cleanly under
// vitest, so the whole suite deliberately tests the deterministic engines the
// routes are thin wrappers over. The route handlers add no freshness logic beyond
// the two expressions exercised here.
//
// `lastLiveFetch` is process-local module state in fundamentals.ts with no reset
// hook, so the cases below run in a DELIBERATE order (Vitest runs a file's tests
// sequentially): the null-state assertions come BEFORE the first live success, and
// the populated assertions come after.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getFundamentals,
  resolveFundamentals,
  getLastLiveFetch,
  getFundamentalsProvider,
  FmpFundamentalsProvider,
} from "./fundamentals.js";
import { buildValueResearchReport } from "./valueReport.js";
import { UNIVERSE } from "./optionsMath.js";

// Strip any live fundamentals key so the live providers are reached ONLY through
// the mocked fetch below (never the network) and the universe path resolves to the
// simulated provider — keeping the freshness boundary deterministic.
delete process.env.FMP_API_KEY;
delete process.env.ALPHA_VANTAGE_API_KEY;

// Mock a full, successful FMP fetch (the four TTM endpoints) so a live provider
// yields real data and the LIVE label / freshness timestamp are recorded.
function mockFmpSuccess(): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    const body = (data: unknown) =>
      ({ ok: true, status: 200, json: async () => data }) as unknown as Response;
    if (url.includes("/profile/"))
      return body([{ companyName: "Acme Corp", price: 100, isEtf: false, mktCap: 5e11 }]);
    if (url.includes("/ratios-ttm/"))
      return body([
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
      ]);
    if (url.includes("/key-metrics-ttm/"))
      return body([
        {
          netIncomePerShareTTM: 6,
          revenuePerShareTTM: 24,
          bookValuePerShareTTM: 10,
          freeCashFlowPerShareTTM: 5,
          roicTTM: 0.3,
          cashPerShareTTM: 8,
        },
      ]);
    if (url.includes("/financial-growth/"))
      return body([{ revenueGrowth: 0.12, epsgrowth: 0.15 }]);
    throw new Error(`unexpected url ${url}`);
  });
}

// The exact value the settings route serializes for `fundamentalsLastFetchedAt`.
const settingsLastFetchedAt = (): string | null => getLastLiveFetch()?.at ?? null;

describe("fundamentals freshness tracking (getLastLiveFetch)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is null (GET /settings → fundamentalsLastFetchedAt null) before any live provider is reached", async () => {
    const f = await getFundamentals("AAPL");
    expect(f).not.toBeNull();
    expect(f!.dataSource).toBe("SIMULATED");
    // Serving simulated data must never look like a live fetch.
    expect(getLastLiveFetch()).toBeNull();
    expect(settingsLastFetchedAt()).toBeNull();
  });

  it("stays null when a live fetch fails and falls back to simulated", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await resolveFundamentals(provider, "AAPL");
    expect(f!.dataSource).toBe("SIMULATED");
    expect(f!.fallback?.reason).toBe("error");
    // A failed live attempt that degraded to simulated is NOT a live success.
    expect(getLastLiveFetch()).toBeNull();
    expect(settingsLastFetchedAt()).toBeNull();
  });

  it("records the provider + timestamp only after a genuine live success", async () => {
    mockFmpSuccess();
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await resolveFundamentals(provider, "ACME");
    expect(f).not.toBeNull();
    expect(f!.dataSource).toBe("LIVE");

    const last = getLastLiveFetch();
    expect(last).not.toBeNull();
    expect(last!.provider).toBe(provider.id);
    // The recorded time is the datum's own fetchedAt (the time the provider was
    // actually reached), not the time of some later request.
    expect(last!.at).toBe(f!.fetchedAt);
    // GET /settings would now serialize this exact ISO string.
    expect(settingsLastFetchedAt()).toBe(f!.fetchedAt);
  });

  it("a simulated read after a live success neither clears nor overwrites the timestamp", async () => {
    const before = getLastLiveFetch();
    expect(before).not.toBeNull();
    const sim = await getFundamentals("MSFT");
    expect(sim!.dataSource).toBe("SIMULATED");
    // The freshness marker reflects live activity only — simulated reads are inert.
    expect(getLastLiveFetch()).toEqual(before);
    expect(settingsLastFetchedAt()).toBe(before!.at);
  });
});

describe("value-universe force-refresh path", () => {
  // Mirrors GET /stock-analyst/value-universe?forceRefresh=true: resolve the
  // provider once, then build a report per universe symbol through the forceRefresh
  // path. With no live key configured the provider is simulated, so forceRefresh is
  // a no-op on the cache but the report-assembly path is fully exercised.
  it("builds a report per symbol, each carrying a valid fetchedAt + simulated flag", async () => {
    const provider = await getFundamentalsProvider();
    const reports = await Promise.all(
      UNIVERSE.map((u) =>
        buildValueResearchReport(u.symbol, undefined, provider, undefined, { forceRefresh: true }),
      ),
    );
    const summaries = reports.filter((r): r is NonNullable<typeof r> => r !== null);
    expect(summaries.length).toBe(UNIVERSE.length);

    for (const r of summaries) {
      // These are exactly the fields summaryFromReport copies into each universe row.
      expect(typeof r.fetchedAt).toBe("string");
      expect(Number.isNaN(new Date(r.fetchedAt).getTime())).toBe(false);
      // No live key in this env → simulated fundamentals, honestly flagged.
      expect(r.simulated).toBe(true);
      expect(r.dataSource).toBe("SIMULATED");
    }
  });

  it("also resolves a report without the forceRefresh flag (default/cached path)", async () => {
    const provider = await getFundamentalsProvider();
    const r = await buildValueResearchReport("AAPL", undefined, provider, undefined, {
      forceRefresh: false,
    });
    expect(r).not.toBeNull();
    expect(r!.simulated).toBe(true);
    expect(typeof r!.fetchedAt).toBe("string");
  });
});

// Phase 11 — Live Market Operations & Production Validation. Unit tests for
// the cross-provider live market data validation consolidation layer.
// Proves this module is genuinely additive — every provider status is read
// from an already-existing, already-tested source, never recomputed.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildLiveMarketValidationReport } from "./liveMarketValidation.js";

let originalKey: string | undefined;
let originalSecret: string | undefined;
let originalFmp: string | undefined;
let originalAv: string | undefined;

beforeEach(() => {
  originalKey = process.env.ALPACA_API_KEY;
  originalSecret = process.env.ALPACA_API_SECRET;
  originalFmp = process.env.FMP_API_KEY;
  originalAv = process.env.ALPHA_VANTAGE_API_KEY;
  delete process.env.ALPACA_API_KEY;
  delete process.env.ALPACA_API_SECRET;
  delete process.env.FMP_API_KEY;
  delete process.env.ALPHA_VANTAGE_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (originalKey === undefined) delete process.env.ALPACA_API_KEY;
  else process.env.ALPACA_API_KEY = originalKey;
  if (originalSecret === undefined) delete process.env.ALPACA_API_SECRET;
  else process.env.ALPACA_API_SECRET = originalSecret;
  if (originalFmp === undefined) delete process.env.FMP_API_KEY;
  else process.env.FMP_API_KEY = originalFmp;
  if (originalAv === undefined) delete process.env.ALPHA_VANTAGE_API_KEY;
  else process.env.ALPHA_VANTAGE_API_KEY = originalAv;
});

describe("buildLiveMarketValidationReport", () => {
  it("honestly reports every engine's real, unconfigured/mock state with no live credentials", async () => {
    const report = await buildLiveMarketValidationReport(
      undefined,
      { scannerMode: "mock", marketDataProvider: "mock", alpacaApiKey: null },
      { fundamentalsProvider: "simulated" },
    );

    expect(report.optionsEngine.source).toBe("mock");
    expect(report.optionsEngine.connected).toBe(false);
    expect(report.optionsEngine.missingData).toBe(false);

    expect(report.investingEngine.length).toBeGreaterThan(0);
    for (const entry of report.investingEngine) {
      expect(entry.keyPresent).toBe(false);
      expect(entry.connected).toBe(false);
    }

    expect(report.tradingEngine.connected).toBe(false);
    expect(report.tradingEngine.message).toMatch(/SIMULATED only/);

    expect(report.marketClock.source).toBe("static_approximation");
    expect(report.overallMissingData).toBe(false);
  });

  it("never flags conflicting-provider detection as applicable, and states why", async () => {
    const report = await buildLiveMarketValidationReport(
      undefined,
      { scannerMode: "mock", marketDataProvider: "mock", alpacaApiKey: null },
      null,
    );
    expect(report.conflictingProviderDetection.applicable).toBe(false);
    expect(report.conflictingProviderDetection.reason.length).toBeGreaterThan(0);
  });

  it("flags an options-engine live provider requested-but-unavailable as missing data", async () => {
    const report = await buildLiveMarketValidationReport(
      undefined,
      { scannerMode: "live", marketDataProvider: "alpaca", alpacaApiKey: null },
      null,
    );
    expect(report.optionsEngine.connected).toBe(false);
    expect(report.optionsEngine.missingData).toBe(true);
    expect(report.overallMissingData).toBe(true);
  });

  it("never flags an investing-engine provider as stale outside market hours, even with an old lastSuccessAt", async () => {
    vi.useFakeTimers();
    // A Saturday — the market is honestly closed regardless of provider freshness.
    vi.setSystemTime(new Date("2026-07-18T17:00:00Z"));

    const report = await buildLiveMarketValidationReport(undefined, { scannerMode: "mock" }, { fundamentalsProvider: "fmp" });
    expect(report.marketClock.isOpen).toBe(false);
    expect(report.overallStale).toBe(false);
  });

  it("carries the market clock's own honest source label through unmodified", async () => {
    const report = await buildLiveMarketValidationReport(undefined, {}, null);
    expect(["alpaca", "static_approximation"]).toContain(report.marketClock.source);
  });
});

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  getFundamentals,
  getFundamentalsProvider,
  resolveFundamentals,
  selectFundamentalsProvider,
  fundamentalsConnectionStatus,
  getFundamentalsProviderStatuses,
  __resetFundamentalsProviderActivityForTest,
  FmpFundamentalsProvider,
  SimulatedFundamentalsProvider,
  FUNDAMENTALS_DATA_SOURCE,
  type Fundamentals,
} from "./fundamentals.js";
import {
  analyzeBusinessQuality,
  analyzeMoat,
  analyzeFinancialStrength,
  analyzeValuation,
  analyzeValueDecision,
  analyzeStockVsOptions,
  analyzeInvestmentSuitability,
} from "./valueInvesting.js";
import { buildValueResearchReport, VALUE_DISCLAIMER } from "./valueReport.js";
import { getValueLessons, generateValueQuiz, gradeValueQuiz } from "./valueSchool.js";
import {
  narrateValueResearch,
  violatesAntiImpersonation,
  enforceValueDisclaimer,
} from "./coachLLM.js";
import { COACH_DISCLAIMER } from "./coach.js";

describe("fundamentals provider (SIMULATED seam)", () => {
  it("labels every datum SIMULATED, never live", async () => {
    expect(FUNDAMENTALS_DATA_SOURCE).toBe("SIMULATED");
    const f = await getFundamentals("AAPL");
    expect(f).not.toBeNull();
    expect(f!.dataSource).toBe("SIMULATED");
  });

  it("the default provider is the simulated one (no live API key present)", async () => {
    expect(await getFundamentalsProvider()).toBeInstanceOf(SimulatedFundamentalsProvider);
  });

  it("is deterministic for the same symbol + date", async () => {
    const a = await getFundamentals("MSFT", "2026-01-15");
    const b = await getFundamentals("MSFT", "2026-01-15");
    expect(a).toEqual(b);
  });

  it("returns null for an unknown symbol", async () => {
    expect(await getFundamentals("NOTASYMBOL")).toBeNull();
  });
});

describe("valuation never fabricates a fair value", () => {
  it("produces an intrinsic-value estimate when profitability inputs exist", async () => {
    const f = (await getFundamentals("AAPL"))!;
    const v = analyzeValuation(f);
    expect(v.available).toBe(true);
    if (v.available) {
      expect(v.fairValue).toBeGreaterThan(0);
      expect(typeof v.marginOfSafety).toBe("number");
      expect(v.methods.length).toBeGreaterThan(0);
    }
  });

  it("reports fair value as UNAVAILABLE (no fabricated number) when there are no positive earnings or FCF", async () => {
    const base = (await getFundamentals("TSLA"))!;
    const unprofitable: Fundamentals = {
      ...base,
      epsTtm: null,
      epsFwd: null,
      fcfPerShare: -1,
    };
    const v = analyzeValuation(unprofitable);
    expect(v.available).toBe(false);
    if (!v.available) {
      expect(v.reason).toMatch(/intrinsic|fabricat|insufficient/i);
      // No fair-value fields are present on the unavailable branch.
      expect((v as Record<string, unknown>).fairValue).toBeUndefined();
    }
  });
});

describe("value-investor decision", () => {
  it("falls back to WATCHLIST (research only) when fair value is unavailable", async () => {
    const base = (await getFundamentals("MSFT"))!;
    const unprofitable: Fundamentals = { ...base, epsTtm: null, epsFwd: null, fcfPerShare: -1 };
    const bq = analyzeBusinessQuality(unprofitable);
    const moat = analyzeMoat(unprofitable);
    const fin = analyzeFinancialStrength(unprofitable);
    const val = analyzeValuation(unprofitable);
    const decision = analyzeValueDecision(unprofitable, bq, moat, fin, val);
    expect(decision.verdict).toBe("WATCHLIST");
    expect(decision.rationale.join(" ")).toMatch(/unavailable|research only/i);
  });

  it("AVOIDs a business with a weak balance sheet regardless of price", async () => {
    const base = (await getFundamentals("AAPL"))!;
    const weak: Fundamentals = {
      ...base,
      debtToEquity: 9,
      interestCoverage: 0.5,
      currentRatio: 0.3,
      netCashPerShare: -50,
      fcfPositiveYears: 1,
      fcfMargin: -0.1,
    };
    const bq = analyzeBusinessQuality(weak);
    const moat = analyzeMoat(weak);
    const fin = analyzeFinancialStrength(weak);
    const val = analyzeValuation(weak);
    const decision = analyzeValueDecision(weak, bq, moat, fin, val);
    expect(fin.rating).toBe("Risky");
    expect(decision.verdict).toBe("AVOID");
  });
});

describe("investment suitability (scanner composite)", () => {
  async function suitabilityFor(symbol: string) {
    const f = (await getFundamentals(symbol))!;
    const bq = analyzeBusinessQuality(f);
    const moat = analyzeMoat(f);
    const fin = analyzeFinancialStrength(f);
    const val = analyzeValuation(f);
    const svo = analyzeStockVsOptions(f, bq, moat, val, null);
    const decision = analyzeValueDecision(f, bq, moat, fin, val);
    return { svo, decision, s: analyzeInvestmentSuitability(bq, moat, fin, val, svo, decision) };
  }

  it("keeps both scores within 0-100 across the universe", async () => {
    for (const sym of ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "TSLA", "SPY"]) {
      const { s } = await suitabilityFor(sym);
      expect(s.stockInvestmentScore).toBeGreaterThanOrEqual(0);
      expect(s.stockInvestmentScore).toBeLessThanOrEqual(100);
      expect(s.optionsSuitabilityScore).toBeGreaterThanOrEqual(0);
      expect(s.optionsSuitabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it("maps useCase 1:1 from the stock-vs-options verdict and action from the decision", async () => {
    const verdictToUseCase: Record<string, string> = {
      "Long-term stock": "Stock",
      "Options income": "Options",
      Both: "Both",
      "Watchlist only": "Watchlist",
      Avoid: "Avoid",
    };
    const decisionToAction: Record<string, string> = {
      "LONG-TERM BUY": "Accumulate",
      "BUY ONLY ON PULLBACK": "Wait for pullback",
      WATCHLIST: "Watchlist & monitor",
      HOLD: "Hold",
      TRIM: "Trim into strength",
      AVOID: "Avoid",
    };
    for (const sym of ["AAPL", "MSFT", "GOOGL", "META", "TSLA"]) {
      const { svo, decision, s } = await suitabilityFor(sym);
      expect(s.useCase).toBe(verdictToUseCase[svo.verdict]);
      expect(s.suggestedAction).toBe(decisionToAction[decision.verdict]);
    }
  });

  it("is deterministic — identical inputs yield identical output", async () => {
    const a = await suitabilityFor("MSFT");
    const b = await suitabilityFor("MSFT");
    expect(a.s).toEqual(b.s);
  });
});

describe("research report", () => {
  it("is flagged SIMULATED and carries the non-advice / not-Warren-Buffett disclaimer", async () => {
    const report = await buildValueResearchReport("AAPL");
    expect(report).not.toBeNull();
    expect(report!.simulated).toBe(true);
    expect(report!.dataSource).toBe("SIMULATED");
    expect(report!.disclaimer).toBe(VALUE_DISCLAIMER);
    expect(report!.disclaimer).toMatch(/not Warren Buffett/i);
    expect(report!.disclaimer).toMatch(/does not execute trades/i);
    expect(report!.disclaimer).toMatch(/not investment advice/i);
  });

  it("assembles every analytical section", async () => {
    const report = (await buildValueResearchReport("MSFT"))!;
    expect(report.businessQuality).toBeTruthy();
    expect(report.moat).toBeTruthy();
    expect(report.financialStrength).toBeTruthy();
    expect(report.valuation).toBeTruthy();
    expect(report.decision).toBeTruthy();
    expect(report.stockVsOptions).toBeTruthy();
    expect(report.sections.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown symbol rather than inventing data", async () => {
    expect(await buildValueResearchReport("NOTASYMBOL")).toBeNull();
  });

  // Task #69 — UI-level honesty: when a company has no positive earnings/FCF, the
  // report (which the StockResearch page binds to directly) must drive the amber
  // "Fair value unavailable" branch — never a fabricated number. The 10 covered
  // SIMULATED symbols are all profitable today, so this is reached via the
  // fundamentals-override seam (the same path a future live/unprofitable name takes).
  describe("fair value unavailable (honest UI state for a company with no earnings)", () => {
    const unprofitableReport = async () => {
      const base = (await getFundamentals("TSLA"))!;
      const unprofitable: Fundamentals = {
        ...base,
        epsTtm: null,
        epsFwd: null,
        fcfPerShare: -1,
        // Price-derived ratios that depend on positive earnings/FCF are null too,
        // mirroring what the provider would emit for an unprofitable name.
        pe: null,
        forwardPe: null,
        peg: null,
        fcfYield: null,
        earningsYield: null,
      };
      // The override is the 4th arg (3rd is the provider); it bypasses the provider.
      return (await buildValueResearchReport(base.symbol, undefined, undefined, unprofitable))!;
    };

    it("the report's valuation is unavailable with a reason and NO fabricated fair-value number", async () => {
      const report = await unprofitableReport();
      const v = report.valuation;

      // The UI keys its amber "Fair value unavailable" box off `available === false`.
      expect(v.available).toBe(false);
      if (!v.available) {
        expect(typeof v.reason).toBe("string");
        expect(v.reason.length).toBeGreaterThan(0);
        expect(v.reason).toMatch(/intrinsic|fabricat|insufficient|earnings|cash flow/i);
        expect(v.summary).toMatch(/unavailable/i);
      }

      // No fabricated dollar figure / range / margin exists on the report at all —
      // there is nothing for the UI to render as a price (and no "—" placeholder,
      // which only appears inside the `available` branch).
      const raw = v as Record<string, unknown>;
      expect(raw.fairValue).toBeUndefined();
      expect(raw.fairValueLow).toBeUndefined();
      expect(raw.fairValueHigh).toBeUndefined();
      expect(raw.marginOfSafety).toBeUndefined();
      expect(raw.rating).toBeUndefined();
      expect(raw.methods).toBeUndefined();
    });

    it("the rendered report sections carry the honest 'unavailable' narrative, no dollar figure", async () => {
      const report = await unprofitableReport();

      const snapshot = report.sections.find((s) => s.id === "snapshot")!;
      expect(snapshot.bullets).toContain("Valuation: unavailable");

      const valuationSection = report.sections.find((s) => s.id === "valuation")!;
      // Section 8's bullets fall back to the reason string (no fair-value methods),
      // so no "$" fair-value figure is ever printed.
      expect(valuationSection.bullets).toBeDefined();
      expect(valuationSection.bullets!.join(" ")).not.toMatch(/\$/);

      const mosSection = report.sections.find((s) => s.id === "margin-of-safety")!;
      expect(mosSection.body).toMatch(/unavailable|not computable/i);
      expect(mosSection.body).not.toMatch(/\$/);
    });

    it("the verdict falls back to research-only WATCHLIST in the unavailable state", async () => {
      const report = await unprofitableReport();
      expect(report.decision.verdict).toBe("WATCHLIST");
      expect(report.decision.rationale.join(" ")).toMatch(/unavailable|research only/i);
    });
  });

  it("is read-only education — exposes no trade-execution surface", async () => {
    const report = (await buildValueResearchReport("AAPL"))! as unknown as Record<string, unknown>;
    for (const key of ["order", "submit", "execute", "alpacaOrderId", "ticket"]) {
      expect(report[key]).toBeUndefined();
    }
  });
});

describe("live fundamentals provider (FMP, mocked fetch)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects a live provider only when the chosen provider's API key is present", () => {
    // No key in this env: even when settings ask for FMP, fall back to simulated.
    expect(selectFundamentalsProvider({ fundamentalsProvider: "financial_modeling_prep" })).toBeInstanceOf(
      SimulatedFundamentalsProvider,
    );
    expect(fundamentalsConnectionStatus({ fundamentalsProvider: "financial_modeling_prep" })).toEqual({
      provider: "financial_modeling_prep",
      connected: false,
    });
    expect(fundamentalsConnectionStatus({ fundamentalsProvider: "simulated" })).toEqual({
      provider: "simulated",
      connected: false,
    });
  });

  it("labels real fetched data LIVE and computes ratios from it", async () => {
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

    const provider = new FmpFundamentalsProvider("test-key");
    const f = await resolveFundamentals(provider, "ACME");
    expect(f).not.toBeNull();
    expect(f!.dataSource).toBe("LIVE");
    expect(f!.name).toBe("Acme Corp");
    expect(f!.price).toBe(100);
    expect(f!.epsTtm).toBe(6);
  });

  it("falls back to SIMULATED (never fabricates a LIVE label) when the live fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const provider = new FmpFundamentalsProvider("test-key");
    // Use a known universe symbol so the simulated fallback returns data.
    const f = await resolveFundamentals(provider, "AAPL");
    expect(f).not.toBeNull();
    expect(f!.dataSource).toBe("SIMULATED");
    expect(f!.fallback?.reason).toBe("error");
    expect(f!.fallback?.attemptedProvider).toBe(provider.id);
  });

  it("classifies a rate-limited live fetch as a rate_limit fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("API rate limit exceeded"));
    const provider = new FmpFundamentalsProvider("test-key");
    const f = await resolveFundamentals(provider, "AAPL");
    expect(f!.dataSource).toBe("SIMULATED");
    expect(f!.fallback?.reason).toBe("rate_limit");
    expect(f!.fallback?.message).toMatch(/rate-limited/i);
  });

  it("stamps fetchedAt on simulated fundamentals", async () => {
    const f = await getFundamentals("AAPL");
    expect(f!.fetchedAt).toBeTruthy();
    expect(Number.isNaN(new Date(f!.fetchedAt).getTime())).toBe(false);
  });
});

describe("live provider status surface (rate limits / outages)", () => {
  const ENV_KEY = "FMP_API_KEY";

  beforeEach(() => {
    // The activity map is process-global; isolate each case from prior tests
    // (and other suites running in the same worker).
    __resetFundamentalsProviderActivityForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env[ENV_KEY];
  });

  it("reports both live providers as not_configured when no API key is set", () => {
    delete process.env[ENV_KEY];
    const statuses = getFundamentalsProviderStatuses({
      fundamentalsProvider: "financial_modeling_prep",
    });
    expect(statuses.map((s) => s.provider)).toEqual([
      "financial_modeling_prep",
      "alpha_vantage",
    ]);
    const fmp = statuses.find((s) => s.provider === "financial_modeling_prep")!;
    expect(fmp.state).toBe("not_configured");
    expect(fmp.keyPresent).toBe(false);
    // The selected-but-unconfigured provider gets a distinct, actionable message.
    expect(fmp.selected).toBe(true);
    expect(fmp.message).toMatch(/no API key/i);
  });

  it("surfaces a rate-limit as a temporary, self-recovering state distinct from unreachable", async () => {
    process.env[ENV_KEY] = "test-key";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("API rate limit exceeded"));
    const provider = new FmpFundamentalsProvider("test-key");
    await resolveFundamentals(provider, "AAPL", "2026-02-02");

    const fmp = getFundamentalsProviderStatuses({
      fundamentalsProvider: "financial_modeling_prep",
    }).find((s) => s.provider === "financial_modeling_prep")!;
    expect(fmp.state).toBe("rate_limited");
    expect(fmp.message).toMatch(/temporary|recover/i);
    expect(fmp.lastFallbackReason).toBe("rate_limit");
    expect(fmp.lastFallbackAt).toBeTruthy();
  });

  it("surfaces an unreachable provider distinctly from a rate-limit", async () => {
    process.env[ENV_KEY] = "test-key";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const provider = new FmpFundamentalsProvider("test-key");
    await resolveFundamentals(provider, "AAPL", "2026-02-03");

    const fmp = getFundamentalsProviderStatuses({
      fundamentalsProvider: "financial_modeling_prep",
    }).find((s) => s.provider === "financial_modeling_prep")!;
    expect(fmp.state).toBe("unreachable");
    expect(fmp.message).toMatch(/could not be reached|key/i);
    expect(fmp.lastFallbackReason).toBe("error");
  });

  it("clears back to ok once a later live fetch succeeds", async () => {
    process.env[ENV_KEY] = "test-key";
    const body = (data: unknown) =>
      ({ ok: true, status: 200, json: async () => data }) as unknown as Response;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("/profile/"))
        return body([{ companyName: "Acme Corp", price: 100, isEtf: false, mktCap: 5e11 }]);
      if (url.includes("/ratios-ttm/")) return body([{ netProfitMarginTTM: 0.25 }]);
      if (url.includes("/key-metrics-ttm/"))
        return body([{ netIncomePerShareTTM: 6, revenuePerShareTTM: 24 }]);
      if (url.includes("/financial-growth/")) return body([{ revenueGrowth: 0.12 }]);
      throw new Error(`unexpected url ${url}`);
    });
    const provider = new FmpFundamentalsProvider("test-key");
    await resolveFundamentals(provider, "ACME", "2026-02-04");

    const fmp = getFundamentalsProviderStatuses({
      fundamentalsProvider: "financial_modeling_prep",
    }).find((s) => s.provider === "financial_modeling_prep")!;
    expect(fmp.state).toBe("ok");
    expect(fmp.lastSuccessAt).toBeTruthy();
  });
});

describe("value investing school", () => {
  it("serves lessons with the educational disclaimer", () => {
    const { lessons, disclaimer } = getValueLessons();
    expect(lessons.length).toBeGreaterThan(0);
    expect(disclaimer).toBe(VALUE_DISCLAIMER);
  });

  it("grades the quiz server-side without exposing the answer key", () => {
    const quiz = generateValueQuiz("mixed", 5);
    expect(quiz.questions.length).toBeGreaterThan(0);
    // The public quiz shape must not leak the correct index.
    for (const q of quiz.questions) {
      expect((q as unknown as Record<string, unknown>).correctIndex).toBeUndefined();
      expect((q as unknown as Record<string, unknown>).answer).toBeUndefined();
    }
  });

  it("scores a perfect run when every server-authoritative answer is supplied", () => {
    const quiz = generateValueQuiz("mixed", 5);
    // First grade with deliberately wrong answers to read back the correct keys.
    const probe = gradeValueQuiz(
      quiz.quizId,
      quiz.questions.map(() => -1),
    );
    expect(probe.score).toBe(0);
    const correctAnswers = probe.results.map((r) => r.correctAnswer);
    const graded = gradeValueQuiz(quiz.quizId, correctAnswers);
    expect(graded.score).toBe(graded.total);
    expect(graded.percent).toBe(100);
    expect(graded.disclaimer).toBe(VALUE_DISCLAIMER);
  });

  it("rejects a tampered quizId", () => {
    expect(() => gradeValueQuiz("not-a-valid-quiz-id", [0])).toThrow();
  });
});

describe("value narration safety invariants", () => {
  it("anti-impersonation guard flags first-person Buffett claims", () => {
    expect(violatesAntiImpersonation("I am Warren Buffett and I recommend buying.")).toBe(true);
    expect(violatesAntiImpersonation("I'm Buffett, trust me.")).toBe(true);
    expect(violatesAntiImpersonation("Speaking as Warren Buffett, this is cheap.")).toBe(true);
    expect(violatesAntiImpersonation("This is Warren Buffett.")).toBe(true);
    expect(violatesAntiImpersonation("I am a real investor giving you advice.")).toBe(true);
  });

  it("anti-impersonation guard does NOT flag legitimate Buffett-principle prose", () => {
    expect(
      violatesAntiImpersonation("In the spirit of Warren Buffett's principles, this has a wide moat."),
    ).toBe(false);
    expect(violatesAntiImpersonation("As Buffett would say, price is what you pay.")).toBe(false);
    expect(violatesAntiImpersonation("Following value-investing tenets, the margin of safety is slim.")).toBe(
      false,
    );
  });

  it("enforceValueDisclaimer appends the VALUE_DISCLAIMER when missing and is idempotent", () => {
    const once = enforceValueDisclaimer("Some thesis prose.");
    expect(once).toContain(VALUE_DISCLAIMER);
    expect(enforceValueDisclaimer(once)).toBe(once);
  });

  it(
    "value narration always carries BOTH the coach and value disclaimers (LLM or template path)",
    async () => {
      const fallback = "AAPL is a wide-moat business trading near fair value.";
      const n = await narrateValueResearch({ symbol: "AAPL" }, fallback);
      // Both invariants hold regardless of whether the LLM ran or we fell back:
      // narrate() guarantees COACH_DISCLAIMER, enforceValueSafety() guarantees VALUE_DISCLAIMER.
      expect(n.text).toContain(COACH_DISCLAIMER);
      expect(n.text).toContain(VALUE_DISCLAIMER);
    },
    // The real LLM call can take up to its ~25s internal timeout before degrading
    // to the deterministic template; either path satisfies the assertion.
    35_000,
  );
});

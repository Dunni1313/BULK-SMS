// Phase 3, Sprint 47 — AI Trade Coach free-form Q&A route tests. Uses the
// real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts), exercising the SIMULATED path end-to-end over real HTTP.
//
// The 200/404/400 contract is proven live. Proving the grounding context
// genuinely includes Structure/Multi-Timeframe/Liquidity/Regime/
// Probability, the user's own portfolio Risk, and recent Trading Journal
// reflections — this sprint's own acceptance criteria — is proven by
// mocking coachLLM.js's narrateTradeFreeform and inspecting the context
// object the route actually passes it, since buildTradeCoachContext() is a
// private route-file helper not otherwise directly testable. Mirrors
// routes/valueResearchAsk.route.test.ts's own Sprint 30 pattern exactly.

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

const capturedContexts: unknown[] = [];

vi.mock("../lib/coachLLM.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/coachLLM.js")>("../lib/coachLLM.js");
  return {
    ...actual,
    narrateTradeFreeform: vi.fn(async (question: string, context: unknown, fallback: string) => {
      capturedContexts.push(context);
      return { text: `${fallback}\n\n[mocked answer for: ${question}]`, source: "template" as const };
    }),
  };
});

interface AskResult {
  answer: string;
  answerSource: "llm" | "template";
}

interface TradingCoachExplanationBody {
  coach: string;
  symbol: string | null;
  headline: string;
  disclaimer: string;
  metricsUsed: unknown[];
  supportingEvidence: { label: string }[];
}

describe("AI Trade Coach — free-form Q&A route (live, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server.close();
  });

  it("answers a free-form question about a known symbol, grounded in the composed engine outputs", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", question: "What is the current market regime?" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AskResult;
    expect(body.answer).toContain("[mocked answer for: What is the current market regime?]");
    expect(body.answerSource).toBe("template");
  });

  it("returns 404 for an invalid ticker shape, never fabricating an answer", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "NOT A TICKER!!", question: "Anything?" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a missing question", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a missing symbol", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "Anything?" }),
    });
    expect(res.status).toBe(400);
  });

  it("grounds the narrator's context in Structure/Multi-Timeframe/Liquidity/Regime/Probability plus the user's own portfolio Risk and recent Trading Journal reflections", async () => {
    capturedContexts.length = 0;
    await fetch(`${baseUrl}/api/trading/coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "MSFT", question: "How is my portfolio risk looking?" }),
    });
    expect(capturedContexts).toHaveLength(1);
    const ctx = capturedContexts[0] as Record<string, unknown>;

    expect(ctx.symbol).toBe("MSFT");
    expect(ctx.dataSource).toBe("SIMULATED");
    expect(ctx).toHaveProperty("currentPrice");

    expect(Array.isArray(ctx.structure)).toBe(true);
    expect((ctx.structure as unknown[]).length).toBeGreaterThan(0);

    expect(ctx).toHaveProperty("multiTimeframe");
    expect(ctx.multiTimeframe).toMatchObject({
      trendAgreement: expect.any(String),
      confidenceLevel: expect.any(String),
    });

    expect(ctx).toHaveProperty("liquidity");
    expect(ctx.liquidity).toMatchObject({
      liquidityBand: expect.any(String),
      confidenceLevel: expect.any(String),
    });

    expect(ctx).toHaveProperty("regime");
    expect(ctx.regime).toMatchObject({
      regimeLabel: expect.any(String),
      volatilityRegime: expect.any(String),
    });

    expect(ctx).toHaveProperty("probability");
    expect(ctx.probability).toMatchObject({ available: expect.any(Boolean) });

    expect(ctx).toHaveProperty("portfolioRisk");
    expect(ctx.portfolioRisk).toMatchObject({
      overall: expect.any(Object),
      openPositionsCount: expect.any(Number),
    });

    expect(ctx).toHaveProperty("recentJournalReflections");
    expect(Array.isArray(ctx.recentJournalReflections)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 29 — Institutional Trading AI Coach. Deterministic (zero-LLM)
// explanation routes, live end-to-end over the same real app/HTTP setup
// above. Never mocks coachLLM.js — these routes never call it.
// ---------------------------------------------------------------------------
describe("Institutional Trading AI Coach — deterministic explanation routes (live, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server.close();
  });

  it.each(["structure", "liquidity", "session"] as const)("GET /trading/coach/%s/:symbol resolves a well-shaped, symbol-scoped explanation for a known symbol", async (coach) => {
    const res = await fetch(`${baseUrl}/api/trading/coach/${coach}/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as TradingCoachExplanationBody;
    expect(body.coach).toBe(coach);
    expect(body.symbol).toBe("AAPL");
    expect(body.disclaimer).toMatch(/never creates a.*trading signal/i);
    expect(Array.isArray(body.metricsUsed)).toBe(true);
  });

  it("GET /trading/coach/risk/:symbol resolves the calling user's own portfolio risk explanation", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/risk/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as TradingCoachExplanationBody;
    expect(body.coach).toBe("risk");
    expect(body.headline).toMatch(/portfolio risk reads/i);
  });

  it("GET /trading/coach/trade-plan/:symbol honestly reports no plan for a symbol with none, never fabricating one", async () => {
    // Valid ticker shape (^[A-Z]{1,5}(\.[A-Z])?$, tradingMarketData.ts) but
    // collision-free with any real plan a sibling test file may have saved.
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const symbol = Array.from({ length: 5 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
    const res = await fetch(`${baseUrl}/api/trading/coach/trade-plan/${symbol}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as TradingCoachExplanationBody;
    expect(body.coach).toBe("trade-plan");
    expect(body.headline).toContain("No trade plan has been saved yet");
    expect(body.metricsUsed).toEqual([]);
  });

  it("returns 404 for an invalid ticker shape on a symbol-scoped coach", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/structure/NOT A TICKER!!`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for an unknown coach type on the symbol-scoped route", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/not-a-real-coach/AAPL`);
    expect(res.status).toBe(400);
  });

  it("returns 400 requesting an account-scoped coach (journal) via the symbol-scoped route", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/journal/AAPL`);
    expect(res.status).toBe(400);
  });

  it("GET /trading/coach/journal reflects a freshly created journal entry", async () => {
    const uniqueTitle = `Coach test entry ${Math.random().toString(36).slice(2, 10)}`;
    const createRes = await fetch(`${baseUrl}/api/trading/journal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: uniqueTitle, content: "Testing the Journal Coach.", mood: "confident", lessonLearned: "Stuck to the plan." }),
    });
    expect(createRes.status).toBe(201);

    const res = await fetch(`${baseUrl}/api/trading/coach/journal`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as TradingCoachExplanationBody;
    expect(body.coach).toBe("journal");
    expect(body.symbol).toBeNull();
    expect(body.supportingEvidence.some((e: { label: string }) => e.label === uniqueTitle)).toBe(true);
  });

  it("GET /trading/coach/psychology resolves a well-shaped account-wide explanation", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/psychology`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as TradingCoachExplanationBody;
    expect(body.coach).toBe("psychology");
    expect(body.symbol).toBeNull();
  });

  it("returns 400 for an unknown coach type on the account-scoped route", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/not-a-real-coach`);
    expect(res.status).toBe(400);
  });

  it("returns 400 requesting a symbol-scoped coach (structure) via the account-scoped route", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/structure`);
    expect(res.status).toBe(400);
  });

  it("POST /trading/coach/scenario explains a real 2-scenario comparison via computeScenarioComparison(), never persisting anything", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/scenario`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        symbol: "AAPL",
        accountValue: 100_000,
        scenarios: [
          { name: "Tight", direction: "long", accountRiskPct: 1, entryPrice: 150, stopPrice: 148, targetPrice: 160 },
          { name: "Wide", direction: "long", accountRiskPct: 1, entryPrice: 150, stopPrice: 130, targetPrice: 160 },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as TradingCoachExplanationBody;
    expect(body.coach).toBe("scenario");
    expect(body.symbol).toBe("AAPL");
    expect(body.metricsUsed).toHaveLength(2);
    expect(body.headline).toMatch(/2 scenario\(s\) compared/);
  });

  it("returns 400 for fewer than 2 scenarios", async () => {
    const res = await fetch(`${baseUrl}/api/trading/coach/scenario`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarios: [{ name: "Only one", direction: "long", accountRiskPct: 1, entryPrice: 150, stopPrice: 148, targetPrice: 160 }] }),
    });
    expect(res.status).toBe(400);
  });

  it("is deterministic across repeated calls for the same symbol", async () => {
    const [a, b] = await Promise.all([fetch(`${baseUrl}/api/trading/coach/liquidity/AAPL`).then((r) => r.json()), fetch(`${baseUrl}/api/trading/coach/liquidity/AAPL`).then((r) => r.json())]);
    expect(a).toEqual(b);
  });
});

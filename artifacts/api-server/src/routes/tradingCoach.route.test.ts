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

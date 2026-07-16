// Phase 2, Sprint 30 — AI Investment Analyst free-form Q&A route tests.
// Uses the real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts), exercising the SIMULATED path end-to-end over real HTTP.
//
// The 200/404 contract is proven live. Proving the grounding context genuinely
// includes Tom Nash's pillar analysis and the Investment Committee's votes —
// the sprint's own acceptance criteria — is proven by mocking coachLLM.js's
// narrateValueFreeform and inspecting the context object the route actually
// passes it, since buildFreeformContext() is a private route-file helper not
// otherwise directly testable.

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

const capturedContexts: unknown[] = [];

vi.mock("../lib/coachLLM.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/coachLLM.js")>("../lib/coachLLM.js");
  return {
    ...actual,
    narrateValueFreeform: vi.fn(async (question: string, context: unknown, fallback: string) => {
      capturedContexts.push(context);
      return { text: `${fallback}\n\n[mocked answer for: ${question}]`, source: "template" as const };
    }),
  };
});

interface AskResult {
  answer: string;
  answerSource: "llm" | "template";
}

describe("AI Investment Analyst — free-form Q&A route (live, SIMULATED path)", () => {
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

  it("answers a free-form question about a known symbol, grounded in the assembled report", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/value-research/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", question: "What does the Investment Committee conclude?" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AskResult;
    expect(body.answer).toContain("[mocked answer for: What does the Investment Committee conclude?]");
    expect(body.answerSource).toBe("template");
  });

  it("returns 404 for an unknown symbol, never fabricating an answer", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/value-research/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "NOTASYMBOL", question: "Anything?" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a missing question", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/value-research/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL" }),
    });
    expect(res.status).toBe(400);
  });

  it("grounds the narrator's context in the full report, including Tom Nash's pillar analysis and the Investment Committee's votes/verdict", async () => {
    capturedContexts.length = 0;
    await fetch(`${baseUrl}/api/stock-analyst/value-research/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "MSFT", question: "How confident is Tom Nash?" }),
    });
    expect(capturedContexts).toHaveLength(1);
    const ctx = capturedContexts[0] as Record<string, unknown>;
    expect(ctx).toHaveProperty("tomNash");
    expect(ctx.tomNash).toMatchObject({
      convictionScore: expect.any(Number),
      verdict: expect.any(String),
      pillars: expect.any(Object),
    });
    expect(ctx).toHaveProperty("investmentCommittee");
    expect(ctx.investmentCommittee).toMatchObject({
      consolidatedVerdict: expect.any(String),
      agreement: expect.any(String),
    });
    expect(ctx).toHaveProperty("grahamValuation");
    expect(ctx).toHaveProperty("dcfValuation");
    expect(ctx).toHaveProperty("buffettValuation");
    expect(ctx).toHaveProperty("consolidatedMarginOfSafety");
    expect(ctx).toHaveProperty("investmentQuality");
    expect(ctx).toHaveProperty("competitiveAdvantage");
    // Never a fabricated answer for questions the context can't actually cover —
    // the grounding is deterministic report data only, no free-text symbol field
    // beyond what narrationContext() already carries.
    expect(ctx.symbol).toBe("MSFT");
  });
});

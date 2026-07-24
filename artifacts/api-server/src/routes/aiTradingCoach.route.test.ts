// v1.3.0, Sprint 1 — AI Trading Coach, Backend Foundation. Live
// end-to-end route tests against the real app + a real Postgres
// connection (no auth session needed — unauthenticated requests resolve
// to the legacy-owner stand-in per tenantScope.ts, mirroring every other
// unauthenticated route test in this codebase). Uses unique, random
// question/message text per test (collision-avoidance discipline,
// established since Sprint 56/58, since this route reads/writes the
// shared legacy-owner account's own rows that other concurrently-running
// test files may also be touching).
//
// coachLLM.js's narrateTradeFreeform/Stream are mocked to capture the
// unified context object the route actually builds and passes through,
// mirroring routes/tradingCoach.route.test.ts's own established pattern
// exactly — narrateTradeFreeform/Stream themselves are reused verbatim
// and already have their own disclaimer-invariant test coverage
// elsewhere; this file only proves THIS route wires the new, richer
// unified context into that same, unmodified function correctly.

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
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
    narrateTradeFreeformStream: vi.fn(async (question: string, context: unknown, fallback: string, onToken: (t: string) => void) => {
      capturedContexts.push(context);
      onToken("mocked ");
      onToken("streamed ");
      onToken("answer");
      return { text: `mocked streamed answer for: ${question}`, source: "template" as const };
    }),
  };
});

interface AskResult {
  answer: string;
  answerSource: "llm" | "template";
}

interface CoachMessage {
  id: number;
  role: "user" | "assistant";
  message: string;
  createdAt: string;
}

describe("AI Trading Coach — unified free-form Q&A route (live, SIMULATED path)", () => {
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

  it("answers a free-form question with no symbol in focus (portfolio/scanner/journal-grounded only)", async () => {
    const question = `What's my biggest risk right now? ${randomUUID()}`;
    const res = await fetch(`${baseUrl}/api/trading-coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AskResult;
    expect(body.answer).toContain(`[mocked answer for: ${question}]`);
    expect(body.answerSource).toBe("template");
  });

  it("answers a free-form question with a known symbol in focus", async () => {
    const question = `Explain AAPL's setup ${randomUUID()}`;
    const res = await fetch(`${baseUrl}/api/trading-coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", question }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AskResult;
    expect(body.answer).toContain(`[mocked answer for: ${question}]`);
  });

  it("never fabricates market structure for an invalid ticker shape — honestly degrades to marketStructure: null rather than 404ing, since the symbol here is optional enrichment, not the request's sole subject", async () => {
    capturedContexts.length = 0;
    const question = `What about this? ${randomUUID()}`;
    const res = await fetch(`${baseUrl}/api/trading-coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "NOT A TICKER!!", question }),
    });
    expect(res.status).toBe(200);
    const ctx = capturedContexts[0] as Record<string, unknown>;
    expect(ctx.marketStructure).toBeNull();
  });

  it("returns 400 for a missing question", async () => {
    const res = await fetch(`${baseUrl}/api/trading-coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL" }),
    });
    expect(res.status).toBe(400);
  });

  it("grounds the narrator's context in Market Structure (Engine 2), the user's own Trading Positions risk, the options-income Portfolio/Dashboard/Scanner/AI Opportunity Score (Engine 3), and recent Trading Journal reflections", async () => {
    capturedContexts.length = 0;
    const question = `How is my portfolio risk looking? ${randomUUID()}`;
    await fetch(`${baseUrl}/api/trading-coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "MSFT", question }),
    });
    expect(capturedContexts).toHaveLength(1);
    const ctx = capturedContexts[0] as Record<string, unknown>;

    expect(ctx.focusSymbol).toBe("MSFT");
    expect(ctx).toHaveProperty("marketStructure");
    expect(ctx.marketStructure).toMatchObject({
      dataSource: "SIMULATED",
      regimeLabel: expect.any(String),
      volatilityRegime: expect.any(String),
      liquidityBand: expect.any(String),
    });

    expect(ctx).toHaveProperty("tradingPositionsRisk");
    expect(ctx.tradingPositionsRisk).toMatchObject({
      overall: expect.any(Object),
      openPositionsCount: expect.any(Number),
    });

    expect(ctx).toHaveProperty("optionsPortfolio");
    const optionsPortfolio = ctx.optionsPortfolio as Record<string, unknown>;
    expect(optionsPortfolio).toHaveProperty("health");
    expect(optionsPortfolio).toHaveProperty("summary");
    expect(optionsPortfolio).toHaveProperty("marketRegime");
    expect(Array.isArray(optionsPortfolio.topOpportunities)).toBe(true);

    expect(ctx).toHaveProperty("recentJournalReflections");
    expect(Array.isArray(ctx.recentJournalReflections)).toBe(true);
  });

  it("the SSE stream variant streams meta/delta/done and never fabricates an answer", async () => {
    const question = `Stream this ${randomUUID()}`;
    const res = await fetch(`${baseUrl}/api/trading-coach/ask/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", question }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    const text = await res.text();
    expect(text).toContain("event: meta");
    expect(text).toContain("event: delta");
    expect(text).toContain("event: done");
    expect(text).toContain(`mocked streamed answer for: ${question}`);
  });

  it("returns 400 from the SSE route for a missing question, before any stream opens", async () => {
    const res = await fetch(`${baseUrl}/api/trading-coach/ask/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL" }),
    });
    expect(res.status).toBe(400);
  });

  it("persists both the user's question and the assistant's answer, retrievable via GET /trading-coach/messages in chronological order", async () => {
    const marker = randomUUID();
    const question = `Persist me ${marker}`;
    const askRes = await fetch(`${baseUrl}/api/trading-coach/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    });
    expect(askRes.status).toBe(200);
    const { answer } = (await askRes.json()) as AskResult;

    const listRes = await fetch(`${baseUrl}/api/trading-coach/messages`);
    expect(listRes.status).toBe(200);
    const messages = (await listRes.json()) as CoachMessage[];

    const userTurnIdx = messages.findIndex((m) => m.role === "user" && m.message === question);
    expect(userTurnIdx).toBeGreaterThanOrEqual(0);
    const assistantTurn = messages[userTurnIdx + 1];
    expect(assistantTurn).toBeDefined();
    expect(assistantTurn.role).toBe("assistant");
    expect(assistantTurn.message).toBe(answer);
  });
});

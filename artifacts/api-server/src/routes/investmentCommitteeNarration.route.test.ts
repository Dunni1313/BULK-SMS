// Phase 4, Sprint 61 — AI Investment Committee LLM-Narrated Synthesis route
// tests. Uses the real app + a real Postgres connection (no auth session
// needed — unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts), exercising the SIMULATED path end-to-end over real HTTP.
//
// The 200/404 contract is proven live. Proving the grounding context is
// exactly report.investmentCommittee's own fields (votes/agreement/
// consolidatedVerdict/confidenceScore) — the sprint's own acceptance
// criterion that the narration is grounded, never fabricated — is proven by
// mocking coachLLM.js's narrateInvestmentCommitteeSynthesis and inspecting
// the context object the route actually passes it, mirroring
// valueResearchAsk.route.test.ts's own established pattern exactly.

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

const capturedContexts: unknown[] = [];
const capturedFallbacks: string[] = [];

vi.mock("../lib/coachLLM.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/coachLLM.js")>("../lib/coachLLM.js");
  return {
    ...actual,
    narrateInvestmentCommitteeSynthesis: vi.fn(async (context: unknown, fallback: string) => {
      capturedContexts.push(context);
      capturedFallbacks.push(fallback);
      return { text: `[mocked narration]\n\n${fallback}`, source: "template" as const };
    }),
  };
});

interface NarrateResult {
  narrative: string;
  narrativeSource: "llm" | "template";
}

describe("AI Investment Committee LLM-Narrated Synthesis route (live, SIMULATED path)", () => {
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

  it("narrates the Committee's consolidated verdict for a known symbol", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/investment-committee/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as NarrateResult;
    expect(body.narrative).toContain("[mocked narration]");
    expect(body.narrativeSource).toBe("template");
  });

  it("returns 404 for an unknown symbol, never fabricating a narration", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/investment-committee/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "NOTASYMBOL" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a missing symbol", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/investment-committee/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("grounds the narrator's context in exactly report.investmentCommittee's own fields — never a fabricated vote", async () => {
    capturedContexts.length = 0;
    const res = await fetch(`${baseUrl}/api/stock-analyst/investment-committee/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "MSFT" }),
    });
    const body = (await res.json()) as NarrateResult;
    void body;

    expect(capturedContexts).toHaveLength(1);
    const ctx = capturedContexts[0] as Record<string, unknown>;
    expect(ctx.symbol).toBe("MSFT");
    expect(ctx).toHaveProperty("consolidatedVerdict");
    expect(ctx).toHaveProperty("confidenceScore");
    expect(ctx).toHaveProperty("agreement");
    expect(Array.isArray(ctx.votes)).toBe(true);
    // Deliberately narrow: only the Committee's own fields, not the whole
    // report (unlike buildFreeformContext()'s much broader grounding for the
    // open-ended Ask panel) — this narration answers one specific question
    // (why this verdict), not an arbitrary one.
    expect(ctx).not.toHaveProperty("tomNash");
    expect(ctx).not.toHaveProperty("grahamValuation");
  });

  it("the fallback passed to the narrator is exactly the Committee's own deterministic reasoning, never invented prose", async () => {
    capturedFallbacks.length = 0;
    const reportRes = await fetch(`${baseUrl}/api/stock-analyst/value/GOOGL`);
    const report = (await reportRes.json()) as {
      investmentCommittee: { reasoning: string[]; summary: string };
    };
    const expectedFallback = [...report.investmentCommittee.reasoning, report.investmentCommittee.summary].join(" ");

    await fetch(`${baseUrl}/api/stock-analyst/investment-committee/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "GOOGL" }),
    });
    expect(capturedFallbacks).toHaveLength(1);
    expect(capturedFallbacks[0]).toBe(expectedFallback);
  });

  it("never adds an investment-committee-narration-shaped field to the main value report — scope discipline", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/value/AAPL`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("narrative");
    expect(body).not.toHaveProperty("narrativeSource");
  });
});

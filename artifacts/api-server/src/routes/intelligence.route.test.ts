// Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
// Foundation). Live route integration test for GET /intelligence. Uses
// the real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts). This route is a thin pass-through to
// lib/intelligenceEngine.ts's already-unit-tested
// buildInstitutionalIntelligence() (see lib/intelligenceEngine.test.ts's
// own isolated-user coverage) — these tests prove the HTTP wiring, the
// honest-degradation contract, and (via a mocked broker check, mirroring
// routes/brokerHealth.route.test.ts's own established technique) the one
// scenario genuinely impractical to reach through isolated-user DB
// fixtures alone: Broker disconnected.
//
// Deliberately does not assert on exact portfolio-total figures here
// (unlike lib/intelligenceEngine.test.ts's own isolated-user coverage)
// — the legacy-owner's trades table is genuinely shared across many
// sibling route test files, matching the same disclosed discipline
// routes/portfolioDashboard.route.test.ts already established for
// exactly this situation.

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { Server } from "node:http";

interface IntelligenceResponse {
  paperTradingMode: true;
  deterministicAnalysis: true;
  executiveSummary: { headline: string; bullets: string[]; generatedAt: string };
  observations: { code: string; severity: string; category: string }[];
  highestPriority: { code: string }[];
  health: { overallHealthScore: number; overallRiskRating: { code: string; label: string } };
  timeline: { entries: unknown[]; comparedTo: string | null };
  learningLinks: { label: string; href: string | null; comingSoon: boolean }[];
  portfolioInsights: unknown[];
  incomeInsights: unknown[];
  riskInsights: unknown[];
  generatedAt: string;
}

function jsonResponse(status: number, data: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as unknown as Response;
}

describe("GET /intelligence (live, real Postgres, SIMULATED path)", () => {
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

  async function fetchIntelligence(): Promise<IntelligenceResponse> {
    const res = await fetch(`${baseUrl}/api/intelligence`);
    expect(res.status).toBe(200);
    return (await res.json()) as IntelligenceResponse;
  }

  it("generates a well-shaped, deterministic-analysis, Paper-Trading result", async () => {
    const body = await fetchIntelligence();
    expect(body.paperTradingMode).toBe(true);
    expect(body.deterministicAnalysis).toBe(true);
    expect(typeof body.generatedAt).toBe("string");
  });

  it("always includes the Executive Summary with a non-empty headline and bullet list", async () => {
    const body = await fetchIntelligence();
    expect(body.executiveSummary.headline.length).toBeGreaterThan(0);
    expect(body.executiveSummary.bullets.length).toBeGreaterThan(0);
  });

  it("always includes at least the structural Paper Trading Active observation", async () => {
    const body = await fetchIntelligence();
    expect(body.observations.some((o) => o.code === "paper_trading_active")).toBe(true);
  });

  it("exposes a Health Overview mirroring a real 0-100 score and a real rating code", async () => {
    const body = await fetchIntelligence();
    expect(body.health.overallHealthScore).toBeGreaterThanOrEqual(0);
    expect(body.health.overallHealthScore).toBeLessThanOrEqual(100);
    expect(["healthy", "moderate_risk", "elevated_risk", "high_risk"]).toContain(body.health.overallRiskRating.code);
  });

  it("exposes a Timeline with a real entries array (possibly empty comparedTo on first-ever call)", async () => {
    const body = await fetchIntelligence();
    expect(Array.isArray(body.timeline.entries)).toBe(true);
    expect(body.timeline.comparedTo === null || typeof body.timeline.comparedTo === "string").toBe(true);
  });

  it("always includes the AI Teacher & Learning Centre Learning Link, resolved to a real URL (Phase 8 Sprint 2)", async () => {
    const body = await fetchIntelligence();
    const aiTeacher = body.learningLinks.find((l) => l.label === "AI Teacher & Learning Centre");
    expect(aiTeacher).toBeDefined();
    expect(aiTeacher!.comingSoon).toBe(false);
    expect(aiTeacher!.href).toBe("/learn");
  });

  it("splits observations into portfolioInsights/incomeInsights/riskInsights, all real arrays", async () => {
    const body = await fetchIntelligence();
    expect(Array.isArray(body.portfolioInsights)).toBe(true);
    expect(Array.isArray(body.incomeInsights)).toBe(true);
    expect(Array.isArray(body.riskInsights)).toBe(true);
  });

  it("never carries a broker-write/order-creation surface — no such fields exist on this response shape", async () => {
    const body = await fetchIntelligence();
    expect(body).not.toHaveProperty("orderId");
    expect(body).not.toHaveProperty("tradeId");
    expect(body).not.toHaveProperty("journalId");
    expect(body).not.toHaveProperty("recommendation");
    expect(body).not.toHaveProperty("action");
  });

  it("is a GET with no request body", async () => {
    const res = await fetch(`${baseUrl}/api/intelligence`, { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("is deterministic for repeated same-day calls (never mutates state that would change the answer)", async () => {
    const a = await fetchIntelligence();
    const b = await fetchIntelligence();
    expect(a.health.overallHealthScore).toBe(b.health.overallHealthScore);
    expect(a.health.overallRiskRating).toEqual(b.health.overallRiskRating);
    expect(a.observations.map((o) => o.code)).toEqual(b.observations.map((o) => o.code));
  });

  describe("Broker disconnected (mocked network only, mirroring routes/brokerHealth.route.test.ts's own technique)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
      delete process.env.ALPACA_API_KEY;
      delete process.env.ALPACA_API_SECRET;
    });

    it("surfaces the Broker Disconnected observation once a broker check has genuinely failed", async () => {
      process.env.ALPACA_API_KEY = "test-key";
      process.env.ALPACA_API_SECRET = "test-secret";

      const realFetch = globalThis.fetch.bind(globalThis);
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith(baseUrl)) return realFetch(input, init);
        if (url.endsWith("/v2/account")) return jsonResponse(401, { message: "unauthorized" });
        throw new Error(`unexpected fetch url in test: ${url}`);
      });

      // Populate the global broker-check cache with a genuine failure —
      // the exact real check every dashboard/overlay already reuses via
      // getLastBrokerCheckConnected(), never a fabricated state.
      const healthRes = await fetch(`${baseUrl}/api/broker/health`);
      expect(healthRes.status).toBe(200);
      const healthBody = (await healthRes.json()) as { connected: boolean };
      expect(healthBody.connected).toBe(false);

      const body = await fetchIntelligence();
      const obs = body.observations.find((o) => o.code === "broker_disconnected");
      expect(obs).toBeDefined();
      expect(obs!.severity).toBe("watch");
      expect(obs!.category).toBe("broker_status");
      expect(body.riskInsights.some((o: { code: string }) => o.code === "broker_disconnected")).toBe(true);
    });
  });
});

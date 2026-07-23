// AI Trade Journal sprint — Phase 8, Sprint 4. Live route integration
// tests for GET /trade-journal and GET /trade-journal/:tradeId. Uses the
// real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts, the same established pattern
// routes/portfolioAnalyst.route.test.ts already uses). These routes are
// thin pass-throughs to lib/tradeJournal.ts's already-unit-tested
// buildTradeJournal()/buildSingleTradeReview() (see
// lib/tradeJournal.test.ts's own isolated-user coverage) — these tests
// prove the HTTP wiring, response shape, and the never-a-broker-write/
// order-creation contract.
//
// Deliberately does not assert on exact trade-count/discipline-score
// figures here (unlike lib/tradeJournal.test.ts's own isolated-user
// coverage) — the legacy-owner's trades table is genuinely shared across
// many sibling route test files, matching the same disclosed discipline
// routes/portfolioAnalyst.route.test.ts/routes/portfolioDashboard.route.test.ts
// already established for exactly this situation.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface AITradeJournalResponse {
  paperTradingMode: true;
  deterministicAnalysis: true;
  educationalOnly: true;
  totalClosedTrades: number;
  recentTrades: { tradeId: number; symbol: string; decisionQuality: { code: string; ruleReference: string }[] }[];
  behaviorPatterns: { code: string; severity: string; tradeCount: number }[];
  behaviorTrend: { direction: string } | null;
  disciplineScore: number;
  decisionQualitySummary: { sizingRespectedRatePct: number; ruleBasedExitRatePct: number; averageDisciplineScore: number };
  strengths: unknown[];
  areasToImprove: unknown[];
  learningRecommendations: unknown[];
  timeline: { type: string; timestamp: string }[];
  generatedAt: string;
}

describe("AI Trade Journal routes (live, real Postgres, SIMULATED path)", () => {
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

  async function fetchJournal(): Promise<AITradeJournalResponse> {
    const res = await fetch(`${baseUrl}/api/trade-journal`);
    expect(res.status).toBe(200);
    return (await res.json()) as AITradeJournalResponse;
  }

  describe("GET /trade-journal", () => {
    it("generates a well-shaped, deterministic-analysis, Paper-Trading, educational-only result", async () => {
      const body = await fetchJournal();
      expect(body.paperTradingMode).toBe(true);
      expect(body.deterministicAnalysis).toBe(true);
      expect(body.educationalOnly).toBe(true);
      expect(typeof body.generatedAt).toBe("string");
    });

    it("exposes a real totalClosedTrades count and a recentTrades array of the same shape", async () => {
      const body = await fetchJournal();
      expect(typeof body.totalClosedTrades).toBe("number");
      expect(Array.isArray(body.recentTrades)).toBe(true);
      expect(body.recentTrades.length).toBeLessThanOrEqual(body.totalClosedTrades);
    });

    it("every Trade Review's Decision Quality tags carry a real, non-empty ruleReference", async () => {
      const body = await fetchJournal();
      for (const review of body.recentTrades) {
        for (const tag of review.decisionQuality) {
          expect(tag.ruleReference.length).toBeGreaterThan(0);
        }
      }
    });

    it("exposes a real Discipline Score and decisionQualitySummary aggregate", async () => {
      const body = await fetchJournal();
      expect(body.disciplineScore).toBeGreaterThanOrEqual(0);
      expect(body.disciplineScore).toBeLessThanOrEqual(100);
      expect(typeof body.decisionQualitySummary.sizingRespectedRatePct).toBe("number");
      expect(typeof body.decisionQualitySummary.ruleBasedExitRatePct).toBe("number");
    });

    it("exposes real behaviorPatterns/strengths/areasToImprove/learningRecommendations arrays", async () => {
      const body = await fetchJournal();
      expect(Array.isArray(body.behaviorPatterns)).toBe(true);
      expect(Array.isArray(body.strengths)).toBe(true);
      expect(Array.isArray(body.areasToImprove)).toBe(true);
      expect(Array.isArray(body.learningRecommendations)).toBe(true);
    });

    it("exposes a real Journal Timeline sorted newest-first", async () => {
      const body = await fetchJournal();
      expect(Array.isArray(body.timeline)).toBe(true);
      const timestamps = body.timeline.map((e) => new Date(e.timestamp).getTime());
      const sorted = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sorted);
    });

    it("never carries a broker-write/order-creation/trade-recommendation surface — no such fields exist on this response shape", async () => {
      const body = await fetchJournal();
      expect(body).not.toHaveProperty("orderId");
      expect(body).not.toHaveProperty("tradeRecommendation");
      expect(body).not.toHaveProperty("recommendation");
      expect(body).not.toHaveProperty("action");
    });

    it("is a GET with no request body", async () => {
      const res = await fetch(`${baseUrl}/api/trade-journal`, { method: "GET" });
      expect(res.status).toBe(200);
    });

    it("is deterministic for repeated same-day calls (aside from generatedAt)", async () => {
      const a = await fetchJournal();
      const b = await fetchJournal();
      expect(a.totalClosedTrades).toBe(b.totalClosedTrades);
      expect(a.disciplineScore).toBe(b.disciplineScore);
      expect(a.recentTrades.map((r) => r.tradeId)).toEqual(b.recentTrades.map((r) => r.tradeId));
    });
  });

  describe("GET /trade-journal/:tradeId", () => {
    it("404s for a nonexistent trade id", async () => {
      const res = await fetch(`${baseUrl}/api/trade-journal/999999999`);
      expect(res.status).toBe(404);
    });

    it("400s for a non-numeric trade id", async () => {
      const res = await fetch(`${baseUrl}/api/trade-journal/not-a-number`);
      expect(res.status).toBe(400);
    });

    it("resolves a real trade review, matching the shape inside GET /trade-journal's own recentTrades array, when a closed trade exists", async () => {
      const journal = await fetchJournal();
      if (journal.recentTrades.length === 0) return; // honest skip — no closed trades exist in this shared environment
      const tradeId = journal.recentTrades[0].tradeId;
      const res = await fetch(`${baseUrl}/api/trade-journal/${tradeId}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { tradeId: number; symbol: string };
      expect(body.tradeId).toBe(tradeId);
      expect(body.symbol).toBe(journal.recentTrades[0].symbol);
    });
  });
});

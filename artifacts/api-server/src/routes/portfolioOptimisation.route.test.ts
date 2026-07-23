// Phase 18 — Institutional Portfolio Optimisation Engine. Live end-to-end
// route tests. Uses the real app + a real Postgres connection (unauthenticated
// requests resolve to the legacy-owner stand-in, matching
// portfolioConstruction.route.test.ts's own established precedent). Given
// SIMULATED reports are deterministically seeded per symbol/day (not
// controllable per test), these tests focus on shape/wiring proofs rather
// than exact classification outcomes — the classification logic itself is
// already fully covered by lib/portfolioOptimisation.test.ts's 18 unit tests
// against constructed fixtures.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface PortfolioSummary {
  id: number;
}

interface OptimisationResult {
  portfolioId: number;
  health: { qualityScore: number | null; overallRiskScore: number | null; summary: string };
  concentration: { score: number | null };
  diversification: { bySector: { label: string; weightPct: number }[] };
  positionQualityRanking: { symbol: string; action: string }[];
  upgradeCandidates: unknown[];
  trimCandidates: unknown[];
  exitCandidates: unknown[];
  capitalAllocationSuggestions: { action: string; detail: string }[];
  replacementOpportunities: unknown[];
  cashDeploymentSuggestions: unknown[];
  summary: string;
  disclaimer: string;
}

interface OptimisationReview {
  id: number;
  portfolioId: number;
  symbol: string | null;
  action: string;
  note: string;
  createdAt: string;
}

describe("Portfolio Optimisation routes (live, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;
  let portfolioId: number;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Optimisation Route Test Portfolio" }),
    });
    const portfolio = (await createRes.json()) as PortfolioSummary;
    portfolioId = portfolio.id;

    for (const symbol of ["AAPL", "MSFT", "AMZN"]) {
      await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/holdings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol, targetWeightPct: 33, shares: 10 }),
      });
    }
  });

  afterAll(async () => {
    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}`, { method: "DELETE" });
    server.close();
  });

  it("computes a well-shaped optimisation analysis for a real portfolio with real holdings", async () => {
    const res = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/optimisation`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as OptimisationResult;

    expect(body.portfolioId).toBe(portfolioId);
    expect(typeof body.health.summary).toBe("string");
    expect(body.positionQualityRanking).toHaveLength(3);
    expect(body.positionQualityRanking.map((p) => p.symbol).sort()).toEqual(["AAPL", "AMZN", "MSFT"]);
    expect(["exit", "trim", "upgrade", "core"]).toContain(body.positionQualityRanking[0].action);
    expect(Array.isArray(body.capitalAllocationSuggestions)).toBe(true);
    expect(body.capitalAllocationSuggestions.length).toBeGreaterThan(0);
    expect(body.disclaimer.toLowerCase()).toContain("never a price prediction");
  });

  it("is deterministic across repeated calls for the same portfolio/day", async () => {
    const first = (await (await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/optimisation`)).json()) as OptimisationResult;
    const second = (await (await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/optimisation`)).json()) as OptimisationResult;
    expect(first.positionQualityRanking).toEqual(second.positionQualityRanking);
    expect(first.summary).toEqual(second.summary);
  });

  it("404s for a nonexistent portfolio, never a fabricated analysis", async () => {
    const res = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/999999999/optimisation`);
    expect(res.status).toBe(404);
  });

  it("400s for a non-numeric portfolio id", async () => {
    const res = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/not-a-number/optimisation`);
    expect(res.status).toBe(400);
  });

  describe("Saved Reviews", () => {
    it("full save-then-list flow, newest first", async () => {
      const listBefore = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/optimisation/reviews`);
      expect(listBefore.status).toBe(200);
      expect(await listBefore.json()).toEqual([]);

      const first = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/optimisation/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: "AMZN", action: "trim", note: "Trimming per the concentration flag." }),
      });
      expect(first.status).toBe(200);
      const firstReview = (await first.json()) as OptimisationReview;
      expect(firstReview.symbol).toBe("AMZN");
      expect(firstReview.action).toBe("trim");

      const second = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/optimisation/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: "MSFT",
          action: "upgrade",
          note: "Considering a swap into a higher-ranked alternative.",
          evidence: { rankScore: 40 },
        }),
      });
      const secondReview = (await second.json()) as OptimisationReview;

      const listAfter = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/optimisation/reviews`);
      const reviews = (await listAfter.json()) as OptimisationReview[];
      expect(reviews).toHaveLength(2);
      expect(reviews[0].id).toBe(secondReview.id);
      expect(reviews[1].id).toBe(firstReview.id);
    });

    it("400 for a missing required field", async () => {
      const res = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolioId}/optimisation/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "trim" }),
      });
      expect(res.status).toBe(400);
    });

    it("404s reviews for a nonexistent portfolio", async () => {
      const list = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/999999999/optimisation/reviews`);
      expect(list.status).toBe(404);

      const post = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/999999999/optimisation/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "note", note: "x" }),
      });
      expect(post.status).toBe(404);
    });
  });
});

// Phase 2, Sprint 29 — live route integration test for the Portfolio Risk
// Analysis surface. Uses the real app + a real Postgres connection (no auth
// session needed — unauthenticated requests resolve to the legacy-owner
// stand-in per tenantScope.ts, and REQUIRE_AUTH is off by default),
// exercising the SIMULATED path end-to-end over real HTTP.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface PortfolioSummary {
  id: number;
}

interface RiskAnalysis {
  overall: { score: number | null; label: string; detail: string };
  concentration: { score: number | null; largestSymbol: string | null; largestSymbolWeightPct: number | null; capBreached: boolean };
  sectorExposure: { score: number | null; largestSector: string | null; largestSectorWeightPct: number | null; capBreached: boolean };
  betaEstimate: { score: number | null; portfolioBeta: number | null; coveragePct: number | null };
  totalMarketValue: number | null;
  unresolvedSymbols: string[];
}

interface RiskSnapshot {
  id: number;
  portfolioId: number;
  overallScore: number | null;
  analysis: RiskAnalysis;
  createdAt: string;
}

describe("Portfolio Risk Analysis routes (live, SIMULATED path)", () => {
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

  async function createPortfolioWithHoldings(name: string, holdings: { symbol: string; targetWeightPct: number; shares: number }[]) {
    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const portfolio = (await createRes.json()) as PortfolioSummary;
    for (const h of holdings) {
      await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(h),
      });
    }
    return portfolio;
  }

  it("computes a risk analysis for a concentrated portfolio, tripping the concentration cap", async () => {
    const portfolio = await createPortfolioWithHoldings("Concentrated Risk", [
      { symbol: "AAPL", targetWeightPct: 90, shares: 100 },
      { symbol: "MSFT", targetWeightPct: 10, shares: 1 },
    ]);
    const riskRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/risk`);
    expect(riskRes.status).toBe(200);
    const risk = (await riskRes.json()) as RiskAnalysis;
    expect(risk.overall.score).not.toBeNull();
    expect(risk.concentration.largestSymbol).toBe("AAPL");
    expect(risk.concentration.capBreached).toBe(true);
    expect(risk.betaEstimate.portfolioBeta).not.toBeNull();
    expect(risk.totalMarketValue).not.toBeNull();
  });

  it("returns 404 for a non-existent portfolio's risk and 400 for a malformed id", async () => {
    const notFound = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/999999999/risk`);
    expect(notFound.status).toBe(404);
    const malformed = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/not-a-number/risk`);
    expect(malformed.status).toBe(400);
  });

  it("does not persist a snapshot on a plain GET /risk — snapshots list stays empty until explicitly saved", async () => {
    const portfolio = await createPortfolioWithHoldings("No Auto Snapshot", [
      { symbol: "AAPL", targetWeightPct: 100, shares: 10 },
    ]);
    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/risk`);
    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/risk`);
    const snapshotsRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/risk/snapshots`);
    const snapshots = (await snapshotsRes.json()) as RiskSnapshot[];
    expect(snapshots).toEqual([]);
  });

  it("saves a snapshot via POST and lists it newest-first via GET", async () => {
    const portfolio = await createPortfolioWithHoldings("Snapshot Flow", [
      { symbol: "AAPL", targetWeightPct: 100, shares: 10 },
    ]);
    const saveRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/risk/snapshots`, {
      method: "POST",
    });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as RiskSnapshot;
    expect(saved.portfolioId).toBe(portfolio.id);
    expect(saved.overallScore).not.toBeNull();
    expect(saved.analysis.overall.score).toBe(saved.overallScore);

    const listRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/risk/snapshots`);
    const snapshots = (await listRes.json()) as RiskSnapshot[];
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].id).toBe(saved.id);
  });

  it("honestly reports insufficient data for a portfolio with no priceable holdings, never fabricating a score", async () => {
    const portfolio = await createPortfolioWithHoldings("Empty Portfolio", []);
    const riskRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/risk`);
    const risk = (await riskRes.json()) as RiskAnalysis;
    expect(risk.overall.score).toBeNull();
    expect(risk.overall.label).toBe("Insufficient data");
    expect(risk.totalMarketValue).toBeNull();
  });

  it("returns 404 when saving or listing snapshots for a non-existent portfolio", async () => {
    const saveRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/999999999/risk/snapshots`, {
      method: "POST",
    });
    expect(saveRes.status).toBe(404);
    const listRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios/999999999/risk/snapshots`);
    expect(listRes.status).toBe(404);
  });
});

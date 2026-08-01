// v1.5.0, Sprint 20 — Institutional Market Intelligence Engine. Live route
// integration test for GET /market-intelligence. Market-wide (not
// per-user), so no auth session is needed — mirrors routes/events.ts's own
// established test-free precedent, but this sprint adds real coverage. A
// thin pass-through to lib/marketIntelligence.ts's already-unit-tested
// buildMarketIntelligenceFeed() — these tests prove the HTTP wiring, not
// the composition math itself.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface MarketIntelligenceItemResponse {
  id: string;
  headline: string;
  category: string;
  source: string;
  dataSource: string;
  timestamp: string;
  impact: string;
  affectedAssets: string[];
  affectedSectors: string[];
  potentialRisks: string[];
  potentialOpportunities: string[];
  summary: string;
  learnMore: { pathKey: string; topicKey: string; label: string } | null;
}

interface MarketIntelligenceFeedResponse {
  items: MarketIntelligenceItemResponse[];
  categories: { category: string; label: string; description: string; dataAvailable: boolean; unavailableReason: string | null }[];
  generatedAt: string;
}

describe("Market Intelligence routes (live, real app, stateless)", () => {
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

  async function fetchFeed(query = ""): Promise<MarketIntelligenceFeedResponse> {
    const res = await fetch(`${baseUrl}/api/market-intelligence${query}`);
    expect(res.status).toBe(200);
    return (await res.json()) as MarketIntelligenceFeedResponse;
  }

  it("returns a well-shaped feed with all 13 categories, each honestly disclosing availability", async () => {
    const body = await fetchFeed();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.categories).toHaveLength(13);
    const reserved = body.categories.filter((c) => !c.dataAvailable);
    for (const c of reserved) expect(c.unavailableReason).toBeTruthy();
  });

  it("never produces an item in a reserved-but-empty category", async () => {
    const body = await fetchFeed();
    const reservedCategories = new Set(body.categories.filter((c) => !c.dataAvailable).map((c) => c.category));
    expect(body.items.some((i) => reservedCategories.has(i.category))).toBe(false);
  });

  it("every item carries a real, non-empty headline/source/summary and a valid dataSource", async () => {
    const body = await fetchFeed();
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.headline.length).toBeGreaterThan(0);
      expect(item.source.length).toBeGreaterThan(0);
      expect(item.summary.length).toBeGreaterThan(0);
      expect(["SIMULATED", "LIVE"]).toContain(item.dataSource);
      expect(["low", "medium", "high"]).toContain(item.impact);
    }
  });

  it("honors a caller-supplied horizonDays query param", async () => {
    const short = await fetchFeed("?horizonDays=1");
    const long = await fetchFeed("?horizonDays=90");
    expect(long.items.length).toBeGreaterThanOrEqual(short.items.length);
  });

  it("never carries a trading-signal or recommendation field — out of scope by design", async () => {
    const body = await fetchFeed();
    expect(body).not.toHaveProperty("signal");
    expect(body).not.toHaveProperty("recommendation");
    expect(body).not.toHaveProperty("buySignal");
    expect(body).not.toHaveProperty("priceTarget");
  });

  it("is deterministic across repeated calls within the same day", async () => {
    const a = await fetchFeed();
    const b = await fetchFeed();
    expect(a.items.map((i) => i.id).sort()).toEqual(b.items.map((i) => i.id).sort());
  });
});

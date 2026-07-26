// AI Teacher & Learning Centre sprint — live route integration tests for
// the whole /learning-centre surface. Uses the real app + a real
// Postgres connection (no auth session needed — unauthenticated requests
// resolve to the legacy-owner stand-in per tenantScope.ts, the same
// established pattern routes/intelligence.route.test.ts already uses).
//
// Deliberately does not assert on exact portfolio-total figures for the
// legacy-owner's own real trades (that account's data is genuinely
// shared across many sibling test files) — only on shape, honest
// error-handling, and the never-fabricate contract. random itemKeys are
// used for the Learning Progress mutation tests so repeated runs never
// collide with a prior run's own upserted row.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

describe("Learning Centre routes (live, real Postgres)", () => {
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

  async function get(path: string): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`);
  }
  async function post(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  describe("GET /learning-centre/glossary", () => {
    it("returns every glossary term, well-shaped", async () => {
      const res = await get("/learning-centre/glossary");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { key: string; term: string; category: string }[];
      expect(body.length).toBeGreaterThan(20);
      expect(body.some((t) => t.key === "delta")).toBe(true);
    });
  });

  describe("GET /learning-centre/glossary/:key", () => {
    it("resolves a known term", async () => {
      const res = await get("/learning-centre/glossary/delta");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { term: string };
      expect(body.term).toBe("Delta");
    });

    it("404s for an unknown key", async () => {
      const res = await get("/learning-centre/glossary/not-a-real-term");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /learning-centre/paths", () => {
    it("returns all 11 learning paths", async () => {
      const res = await get("/learning-centre/paths");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { key: string }[];
      // Phase 21 — Institutional AI Coach & Education Platform added a 9th path.
      // Phase 29 — Institutional Trading AI Coach added a 10th path.
      // Phase 30 — Institutional Strategy Framework added an 11th path.
      // v1.4.0, Sprint L1 — Learning Centre Foundation added a "platform-basics" path.
      expect(body).toHaveLength(11);
    });
  });

  describe("GET /learning-centre/paths/:pathKey", () => {
    it("resolves a known path with its own topics", async () => {
      const res = await get("/learning-centre/paths/greeks");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { title: string; topics: unknown[] };
      expect(body.title).toBe("Options Greeks");
      expect(body.topics.length).toBeGreaterThan(0);
    });

    it("404s for an unknown path", async () => {
      const res = await get("/learning-centre/paths/not-a-real-path");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /learning-centre/strategy-academy", () => {
    it("returns all 8 strategy academy entries", async () => {
      const res = await get("/learning-centre/strategy-academy");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { key: string }[];
      expect(body).toHaveLength(8);
    });
  });

  describe("GET /learning-centre/strategy-academy/:strategy", () => {
    it("resolves a built-by-this-engine strategy with a real, live paper example", async () => {
      const res = await get("/learning-centre/strategy-academy/iron_condor");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { builtByThisEngine: boolean; paperExample: { available: boolean; symbol: string | null } };
      expect(body.builtByThisEngine).toBe(true);
      expect(body.paperExample.available).toBe(true);
      expect(body.paperExample.symbol).toBe("SPY");
    });

    it("resolves a not-built-by-this-engine strategy with an honestly unavailable paper example", async () => {
      const res = await get("/learning-centre/strategy-academy/covered_call");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { builtByThisEngine: boolean; paperExample: { available: boolean } };
      expect(body.builtByThisEngine).toBe(false);
      expect(body.paperExample.available).toBe(false);
    });

    it("404s for an unknown strategy", async () => {
      const res = await get("/learning-centre/strategy-academy/not-a-real-strategy");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /learning-centre/explain/:metric", () => {
    it("resolves a portfolio-wide metric with no tradeId needed", async () => {
      const res = await get("/learning-centre/explain/portfolio_health");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { code: string; currentValue: string; plainEnglish: string };
      expect(body.code).toBe("portfolio_health");
      expect(body.plainEnglish.length).toBeGreaterThan(10);
    });

    it("400s for an unknown metric code", async () => {
      const res = await get("/learning-centre/explain/not_a_real_metric");
      expect(res.status).toBe(400);
    });

    it("400s for a trade-scoped metric with no ?tradeId= — never a fabricated portfolio-wide substitute", async () => {
      const res = await get("/learning-centre/explain/max_profit");
      expect(res.status).toBe(400);
    });

    it("400s for a non-integer ?tradeId=", async () => {
      const res = await get("/learning-centre/explain/max_profit?tradeId=abc");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /learning-centre/portfolio-lesson", () => {
    it("bundles the 6 requested portfolio metrics, each with a real explanation", async () => {
      const res = await get("/learning-centre/portfolio-lesson");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: { code: string }[]; generatedAt: string };
      expect(body.items.map((i) => i.code).sort()).toEqual(
        ["portfolio_health", "buying_power", "delta", "theta", "concentration", "event_risk"].sort(),
      );
      expect(typeof body.generatedAt).toBe("string");
    });
  });

  describe("GET /learning-centre/progress", () => {
    it("returns a well-shaped Learning Progress summary", async () => {
      const res = await get("/learning-centre/progress");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        lessonsViewed: number;
        pathCompletion: unknown[];
        greeksQuiz: { totalAttempts: number };
        valueQuiz: { totalAttempts: number };
      };
      expect(typeof body.lessonsViewed).toBe("number");
      // Phase 21 — Institutional AI Coach & Education Platform added a 9th path.
      // Phase 29 — Institutional Trading AI Coach added a 10th path.
      // Phase 30 — Institutional Strategy Framework added an 11th path.
      // v1.4.0, Sprint L1 — Learning Centre Foundation added a "platform-basics" path.
      expect(body.pathCompletion).toHaveLength(11);
      expect(typeof body.greeksQuiz.totalAttempts).toBe("number");
      expect(typeof body.valueQuiz.totalAttempts).toBe("number");
    });
  });

  describe("POST /learning-centre/progress/view and /complete", () => {
    it("records a view and then a completion for a fresh, unique item key", async () => {
      const itemKey = `test-topic-${randomUUID()}`;
      const viewRes = await post("/learning-centre/progress/view", { itemType: "lesson", itemKey });
      expect(viewRes.status).toBe(200);
      expect(((await viewRes.json()) as { success: boolean }).success).toBe(true);

      const completeRes = await post("/learning-centre/progress/complete", { itemType: "lesson", itemKey });
      expect(completeRes.status).toBe(200);
      expect(((await completeRes.json()) as { success: boolean }).success).toBe(true);

      const progressRes = await get("/learning-centre/progress");
      const progress = (await progressRes.json()) as { completedLessonKeys: string[] };
      expect(progress.completedLessonKeys).toContain(itemKey);
    });

    it("400s for a missing itemKey", async () => {
      const res = await post("/learning-centre/progress/view", { itemType: "lesson" });
      expect(res.status).toBe(400);
    });

    it("400s for an invalid itemType", async () => {
      const res = await post("/learning-centre/progress/view", { itemType: "not_a_real_type", itemKey: "x" });
      expect(res.status).toBe(400);
    });
  });

  // v1.4.0, Sprint L1 — Learning Centre Foundation.
  describe("POST /learning-centre/progress/bookmark", () => {
    it("sets and then clears a bookmark for a fresh, unique item key", async () => {
      const itemKey = `test-bookmark-${randomUUID()}`;

      const setRes = await post("/learning-centre/progress/bookmark", { itemType: "lesson", itemKey, bookmarked: true });
      expect(setRes.status).toBe(200);
      expect(((await setRes.json()) as { success: boolean }).success).toBe(true);

      const progressRes = await get("/learning-centre/progress");
      const progress = (await progressRes.json()) as { bookmarks: { itemType: string; itemKey: string }[] };
      expect(progress.bookmarks.some((b) => b.itemType === "lesson" && b.itemKey === itemKey)).toBe(true);

      const clearRes = await post("/learning-centre/progress/bookmark", { itemType: "lesson", itemKey, bookmarked: false });
      expect(clearRes.status).toBe(200);

      const progressRes2 = await get("/learning-centre/progress");
      const progress2 = (await progressRes2.json()) as { bookmarks: { itemType: string; itemKey: string }[] };
      expect(progress2.bookmarks.some((b) => b.itemKey === itemKey)).toBe(false);
    });

    it("400s for a missing bookmarked field", async () => {
      const res = await post("/learning-centre/progress/bookmark", { itemType: "lesson", itemKey: "x" });
      expect(res.status).toBe(400);
    });

    it("400s for an invalid itemType", async () => {
      const res = await post("/learning-centre/progress/bookmark", { itemType: "not_a_real_type", itemKey: "x", bookmarked: true });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /learning-centre/simulate", () => {
    it("runs a delta simulation, correctly labeled", async () => {
      const res = await post("/learning-centre/simulate", { type: "delta", strike: 100, iv: 0.3, dte: 30 });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { educationalSimulation: true; notMarketData: true; noTradeRecommendation: true; points: unknown[] };
      expect(body.educationalSimulation).toBe(true);
      expect(body.notMarketData).toBe(true);
      expect(body.noTradeRecommendation).toBe(true);
      expect(body.points.length).toBeGreaterThan(0);
    });

    it("runs a payoff simulation for iron_condor", async () => {
      const res = await post("/learning-centre/simulate", {
        type: "payoff",
        strategy: "iron_condor",
        putStrike: 95,
        longPutStrike: 90,
        callStrike: 105,
        longCallStrike: 110,
        netCredit: 1.5,
      });
      expect(res.status).toBe(200);
    });

    it("400s a payoff simulation with no strategy", async () => {
      const res = await post("/learning-centre/simulate", { type: "payoff" });
      expect(res.status).toBe(400);
    });

    it("runs a concentration simulation", async () => {
      const res = await post("/learning-centre/simulate", { type: "concentration", weights: [50, 30, 20] });
      expect(res.status).toBe(200);
    });

    it("400s for an unknown simulation type", async () => {
      const res = await post("/learning-centre/simulate", { type: "not_a_real_type" });
      expect(res.status).toBe(400);
    });
  });
});

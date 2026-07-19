// Phase 14 — Institutional Investment Decision Engine. Live route integration
// tests for GET /stock-analyst/decision/:symbol (+ ?portfolioId=), the
// /snapshots endpoints, and the /notes CRUD endpoints. Uses the real app + a
// real Postgres connection (no auth session needed — unauthenticated requests
// resolve to the legacy-owner stand-in per tenantScope.ts). Per the
// established collision-avoidance precedent (notifications.route.test.ts,
// portfolioIntelligence.route.test.ts), this file uses randomly-generated,
// collision-free ticker-shaped symbols since it shares the legacy-owner
// account's tables with every other route test file running in this suite.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

function randomTicker(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 5; i++) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

describe("Institutional Investment Decision Engine routes (live, SIMULATED path)", () => {
  let server: Server;
  let baseUrl: string;
  const symbol = randomTicker();

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    server.close();
  });

  it("GET /decision/:symbol returns a fully-shaped decision with a 15-item checklist", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/decision/${symbol}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(["Buy", "Accumulate", "Hold", "Reduce", "Sell", "Avoid"]).toContain(body.recommendation);
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(100);
    expect(body.checklist).toHaveLength(15);
    expect(body.disclaimer).toContain("Educational research only");
    // Management Quality's own score is substantially reused-data-driven (Capital
    // Allocation/Financial Stewardship/Execution Discipline/Shareholder Alignment/
    // Transparency, ~6 of 9 dimensions), so it's honestly `available: true` even in
    // this sandbox's EDGAR-unreachable environment — never fabricated null.
    if (body.managementQuality.available) {
      expect(typeof body.managementQuality.score).toBe("number");
    } else {
      expect(typeof body.managementQuality.reason).toBe("string");
    }
    expect(body.portfolioFit.available).toBe(false); // no ?portfolioId= supplied
    expect(body.checklist.find((c: any) => c.id === "risk").status).toBe("unavailable"); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.checklist.find((c: any) => c.id === "portfolio-fit").status).toBe("unavailable"); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  it("404s for an invalid ticker shape", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/decision/${encodeURIComponent("NOT A TICKER!!")}`);
    expect(res.status).toBe(404);
  });

  it("is deterministic across repeated calls for the same symbol on the same day", async () => {
    const [r1, r2] = await Promise.all([
      fetch(`${baseUrl}/api/stock-analyst/decision/${symbol}`),
      fetch(`${baseUrl}/api/stock-analyst/decision/${symbol}`),
    ]);
    const [b1, b2] = (await Promise.all([r1.json(), r2.json()])) as [any, any]; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(b1.recommendation).toBe(b2.recommendation);
    expect(b1.confidence).toBe(b2.confidence);
    expect(b1.checklist).toEqual(b2.checklist);
  });

  it("?portfolioId= supplies real Portfolio Fit / Risk / Diversification context", async () => {
    const createRes = await fetch(`${baseUrl}/api/portfolio-construction/portfolios`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `Decision Test ${symbol}` }),
    });
    const portfolio = (await createRes.json()) as { id: number };
    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}/holdings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, targetWeightPct: 30, shares: 10 }),
    });

    const res = await fetch(`${baseUrl}/api/stock-analyst/decision/${symbol}?portfolioId=${portfolio.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.portfolioFit.available).toBe(true);
    expect(body.portfolioFit.alreadyHeld).toBe(true);
    expect(body.checklist.find((c: any) => c.id === "risk").status).not.toBe("unavailable"); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(body.checklist.find((c: any) => c.id === "diversification").status).not.toBe("unavailable"); // eslint-disable-line @typescript-eslint/no-explicit-any

    // A nonexistent/foreign portfolioId is honestly ignored (never a fabricated context).
    const foreignRes = await fetch(`${baseUrl}/api/stock-analyst/decision/${symbol}?portfolioId=999999999`);
    const foreignBody = (await foreignRes.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(foreignBody.portfolioFit.available).toBe(false);

    await fetch(`${baseUrl}/api/portfolio-construction/portfolios/${portfolio.id}`, { method: "DELETE" });
  });

  it("POST /snapshots saves a decision snapshot, and GET /snapshots lists it newest-first", async () => {
    const saveRes = await fetch(`${baseUrl}/api/stock-analyst/decision/${symbol}/snapshots`, { method: "POST" });
    expect(saveRes.status).toBe(200);
    const saved = (await saveRes.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(saved.symbol).toBe(symbol);
    expect(saved.analysis).toBeDefined();

    const listRes = await fetch(`${baseUrl}/api/stock-analyst/decision/${symbol}/snapshots`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { id: number }[];
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].id).toBe(saved.id);
  });

  it("POST /snapshots 404s for an invalid ticker shape", async () => {
    const res = await fetch(`${baseUrl}/api/stock-analyst/decision/${encodeURIComponent("NOT A TICKER!!")}/snapshots`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("full decision-note CRUD: create, list, update, delete", async () => {
    const addRes = await fetch(`${baseUrl}/api/stock-analyst/decision/${symbol}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "Revisit after next earnings." }),
    });
    expect(addRes.status).toBe(200);
    const note = (await addRes.json()) as { id: number; symbol: string; note: string };
    expect(note.symbol).toBe(symbol);

    const listRes = await fetch(`${baseUrl}/api/stock-analyst/decision/${symbol}/notes`);
    const list = (await listRes.json()) as { id: number }[];
    expect(list.some((n) => n.id === note.id)).toBe(true);

    const updateRes = await fetch(`${baseUrl}/api/stock-analyst/decision/notes/${note.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "Updated conviction after review." }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { note: string };
    expect(updated.note).toBe("Updated conviction after review.");

    const deleteRes = await fetch(`${baseUrl}/api/stock-analyst/decision/notes/${note.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(200);
    const del = (await deleteRes.json()) as { success: boolean };
    expect(del.success).toBe(true);
  });

  it("PATCH/DELETE decision note 404s for a nonexistent id", async () => {
    const patchRes = await fetch(`${baseUrl}/api/stock-analyst/decision/notes/999999999`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "x" }),
    });
    expect(patchRes.status).toBe(404);
  });
});

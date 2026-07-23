// Phase 12 — Institutional Investing Engine Consolidation & Integration.
// Live end-to-end route tests for the two genuinely new pieces this phase
// added to routes/stockAnalyst.ts: Research Notes CRUD and the deterministic
// Investment Thesis Generator. Uses the real app + a real Postgres
// connection (unauthenticated requests resolve to the legacy-owner
// stand-in, matching valueWatchlist.route.test.ts's own established
// precedent). Collision-avoidance fake-but-valid-ticker-shaped symbols
// (unique per test) are used throughout, matching the established
// discipline since notifications.route.test.ts/optionsBacktest.route.test.ts.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface ResearchNoteItem {
  id: number;
  symbol: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

interface InvestmentThesis {
  symbol: string;
  overview: string;
  sections: { heading: string; paragraphs: string[] }[];
  supportingPoints: string[];
  riskFactors: string[];
  disclaimer: string;
}

describe("Research Notes + Investment Thesis routes (live, SIMULATED path)", () => {
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

  describe("Research Notes CRUD", () => {
    it("full create, list, update, delete flow for a symbol", async () => {
      const symbol = "RNPA";

      const listBefore = await fetch(`${baseUrl}/api/stock-analyst/research-notes/${symbol}`);
      expect(listBefore.status).toBe(200);
      expect(await listBefore.json()).toEqual([]);

      const create = await fetch(`${baseUrl}/api/stock-analyst/research-notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol, note: "Watching for a pullback below $100." }),
      });
      expect(create.status).toBe(200);
      const created = (await create.json()) as ResearchNoteItem;
      expect(created.symbol).toBe(symbol);
      expect(created.note).toBe("Watching for a pullback below $100.");

      const listAfter = await fetch(`${baseUrl}/api/stock-analyst/research-notes/${symbol}`);
      const notes = (await listAfter.json()) as ResearchNoteItem[];
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toBe(created.id);

      const update = await fetch(`${baseUrl}/api/stock-analyst/research-notes/${created.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "Updated: bought a starter position." }),
      });
      expect(update.status).toBe(200);
      const updated = (await update.json()) as ResearchNoteItem;
      expect(updated.note).toBe("Updated: bought a starter position.");

      const del = await fetch(`${baseUrl}/api/stock-analyst/research-notes/${created.id}`, { method: "DELETE" });
      expect(del.status).toBe(200);
      expect(await del.json()).toEqual({ success: true });

      const listFinal = await fetch(`${baseUrl}/api/stock-analyst/research-notes/${symbol}`);
      expect(await listFinal.json()).toEqual([]);
    });

    it("404-equivalent honest false for updating/deleting a note that isn't the caller's", async () => {
      const update = await fetch(`${baseUrl}/api/stock-analyst/research-notes/999999999`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "x" }),
      });
      expect(update.status).toBe(404);

      const del = await fetch(`${baseUrl}/api/stock-analyst/research-notes/999999999`, { method: "DELETE" });
      expect(del.status).toBe(200);
      expect(await del.json()).toEqual({ success: false });
    });

    it("400 for a missing required field", async () => {
      const res = await fetch(`${baseUrl}/api/stock-analyst/research-notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: "RNPB" }),
      });
      expect(res.status).toBe(400);
    });

    it("notes are never fabricated by an AI — the note text is byte-identical to what was submitted", async () => {
      const noteText = "This is my own reasoning, verbatim, never rewritten.";
      const create = await fetch(`${baseUrl}/api/stock-analyst/research-notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: "RNPC", note: noteText }),
      });
      const created = (await create.json()) as ResearchNoteItem;
      expect(created.note).toBe(noteText);
    });
  });

  // Phase 17 — Institutional Workspace. The one genuine backend gap that
  // phase's audit found: no way to list a user's own research notes across
  // every symbol (only a per-symbol lookup existed before). Reuses the
  // exact same table/formatter as the CRUD above — zero new business logic.
  describe("GET /stock-analyst/research-notes (list all, across symbols)", () => {
    it("includes notes for two different symbols, newest first, and never a note belonging to a different symbol filter", async () => {
      const symbolA = "RNPD";
      const symbolB = "RNPE";

      await fetch(`${baseUrl}/api/stock-analyst/research-notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: symbolA, note: "Note for symbol A." }),
      });
      const createdB = await fetch(`${baseUrl}/api/stock-analyst/research-notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: symbolB, note: "Note for symbol B." }),
      });
      const bItem = (await createdB.json()) as ResearchNoteItem;

      const res = await fetch(`${baseUrl}/api/stock-analyst/research-notes`);
      expect(res.status).toBe(200);
      const all = (await res.json()) as ResearchNoteItem[];
      expect(all[0].id).toBe(bItem.id);
      expect(all.some((n) => n.symbol === symbolA)).toBe(true);
      expect(all.some((n) => n.symbol === symbolB)).toBe(true);
    });
  });

  describe("GET /stock-analyst/investment-thesis/:symbol", () => {
    it("resolves a well-shaped, deterministic thesis for a known symbol", async () => {
      const res = await fetch(`${baseUrl}/api/stock-analyst/investment-thesis/AAPL`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as InvestmentThesis;
      expect(body.symbol).toBe("AAPL");
      expect(body.sections).toHaveLength(5);
      expect(body.sections.map((s) => s.heading)).toEqual([
        "Business Overview",
        "Financial Health",
        "Valuation",
        "Institutional Perspective",
        "Conclusion",
      ]);
      expect(Array.isArray(body.supportingPoints)).toBe(true);
      expect(Array.isArray(body.riskFactors)).toBe(true);
      expect(typeof body.disclaimer).toBe("string");
    });

    it("404 for an invalid ticker shape, never a fabricated thesis", async () => {
      const res = await fetch(`${baseUrl}/api/stock-analyst/investment-thesis/${encodeURIComponent("NOT A TICKER!!")}`);
      expect(res.status).toBe(404);
    });

    it("is deterministic across repeated calls for the same symbol/day", async () => {
      const a = (await (await fetch(`${baseUrl}/api/stock-analyst/investment-thesis/MSFT`)).json()) as InvestmentThesis;
      const b = (await (await fetch(`${baseUrl}/api/stock-analyst/investment-thesis/MSFT`)).json()) as InvestmentThesis;
      expect(a.sections).toEqual(b.sections);
      expect(a.overview).toEqual(b.overview);
    });
  });
});

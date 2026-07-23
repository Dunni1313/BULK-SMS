// Phase 30 — Institutional Strategy Framework. Live route integration
// tests for the Strategy Registry CRUD, Checklist Engine CRUD, the
// Strategy Coach, and the Strategy Framework Summary Report. Uses the
// real app + a real Postgres connection (no auth session needed —
// unauthenticated requests resolve to the legacy-owner stand-in per
// tenantScope.ts). Mirrors routes/tradingTradePlans.route.test.ts's own
// pattern. Every created row is deleted at the end of its own test to
// avoid polluting the shared legacy-owner account for sibling test files.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

interface StrategyResponse {
  id: number;
  name: string;
  description: string;
  category: string;
  timeframes: string[];
  markets: string[];
  requiredEvidence: string[];
  checklist: { id: string; label: string; required: boolean }[];
  educationalNotes: string;
  references: string[];
  version: string;
  validation: { valid: boolean; issues: { field: string; message: string }[] };
  createdAt: string;
  updatedAt: string;
}

interface ChecklistResponse {
  id: number;
  strategyId: number;
  symbol: string | null;
  status: string;
  items: { id: string; label: string; required: boolean; completed: boolean; notes: string; evidenceLinks: unknown[] }[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface CoachExplanationBody {
  coach: string;
  headline: string;
  disclaimer: string;
  metricsUsed: unknown[];
}

interface ReportBody {
  reportType: string;
  sections: { id: string; title: string; body: string; bullets?: string[] }[];
}

function validStrategyInput(name: string) {
  return {
    name,
    description: "A personally defined trade setup, registered for test purposes.",
    category: "trend",
    timeframes: ["1h", "1D"],
    markets: ["equities"],
    requiredEvidence: ["structure", "liquidity"],
    checklist: [
      { id: "reviewed-structure", label: "Reviewed market structure", required: true },
      { id: "optional-note", label: "Optional note", required: false },
    ],
    educationalNotes: "Notes for testing.",
    references: ["Test reference"],
    version: "1.0.0",
  };
}

describe("Institutional Strategy Framework routes (live, real Postgres)", () => {
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

  async function post(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  async function get(path: string): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`);
  }
  async function patch(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  async function del(path: string): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`, { method: "DELETE" });
  }

  describe("Strategy Registry CRUD", () => {
    it("supports the full create/list/get/update/delete flow", async () => {
      const name = `Test Strategy ${randomUUID()}`;
      const createRes = await post("/trading/strategies", validStrategyInput(name));
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as StrategyResponse;
      expect(created.name).toBe(name);
      expect(created.checklist).toHaveLength(2);

      const listRes = await get("/trading/strategies");
      const list = (await listRes.json()) as StrategyResponse[];
      expect(list.some((s) => s.id === created.id)).toBe(true);

      const getRes = await get(`/trading/strategies/${created.id}`);
      expect(getRes.status).toBe(200);
      expect(((await getRes.json()) as StrategyResponse).id).toBe(created.id);

      const patchRes = await patch(`/trading/strategies/${created.id}`, { description: "Updated description." });
      expect(patchRes.status).toBe(200);
      expect(((await patchRes.json()) as StrategyResponse).description).toBe("Updated description.");

      const deleteRes = await del(`/trading/strategies/${created.id}`);
      expect(deleteRes.status).toBe(204);

      const getAfterDeleteRes = await get(`/trading/strategies/${created.id}`);
      expect(getAfterDeleteRes.status).toBe(404);
    });

    it("400s for a category outside the fixed enum — 'ict' is rejected at the wire level, never persisted", async () => {
      const name = `Invalid Strategy ${randomUUID()}`;
      const res = await post("/trading/strategies", { ...validStrategyInput(name), category: "ict" });
      expect(res.status).toBe(400);
      const list = await get("/trading/strategies");
      const strategies = (await list.json()) as StrategyResponse[];
      expect(strategies.some((s) => s.name === name)).toBe(false);
    });

    it("400s for a duplicate checklist item id within the same strategy", async () => {
      const name = `Dup Checklist ${randomUUID()}`;
      const input = validStrategyInput(name);
      input.checklist = [
        { id: "same", label: "One", required: true },
        { id: "same", label: "Two", required: false },
      ];
      const res = await post("/trading/strategies", input);
      expect(res.status).toBe(400);
    });

    it("404s for GET/PATCH/DELETE on a nonexistent id", async () => {
      expect((await get("/trading/strategies/999999999")).status).toBe(404);
      expect((await patch("/trading/strategies/999999999", { name: "x" })).status).toBe(404);
      expect((await del("/trading/strategies/999999999")).status).toBe(404);
    });

    it("400s for a non-numeric id", async () => {
      expect((await get("/trading/strategies/not-a-number")).status).toBe(400);
    });

    it("Phase 31 — a freshly-created (and therefore already-valid) strategy honestly reports validation.valid = true with no issues", async () => {
      const name = `Validation Summary Test ${randomUUID()}`;
      const createRes = await post("/trading/strategies", validStrategyInput(name));
      const created = (await createRes.json()) as StrategyResponse;
      expect(created.validation).toEqual({ valid: true, issues: [] });

      const getRes = await get(`/trading/strategies/${created.id}`);
      const fetched = (await getRes.json()) as StrategyResponse;
      expect(fetched.validation).toEqual({ valid: true, issues: [] });

      await del(`/trading/strategies/${created.id}`);
    });
  });

  describe("Checklist Engine CRUD", () => {
    let strategyId: number;

    beforeAll(async () => {
      const name = `Checklist Engine Test Strategy ${randomUUID()}`;
      const res = await post("/trading/strategies", validStrategyInput(name));
      const created = (await res.json()) as StrategyResponse;
      strategyId = created.id;
    });

    afterAll(async () => {
      await del(`/trading/strategies/${strategyId}`);
    });

    it("instantiates a fresh checklist from the strategy's own template, tracks completion, and re-derives status", async () => {
      const createRes = await post(`/trading/strategies/${strategyId}/checklists`, { symbol: "AAPL" });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as ChecklistResponse;
      expect(created.strategyId).toBe(strategyId);
      expect(created.symbol).toBe("AAPL");
      expect(created.status).toBe("in_progress");
      expect(created.items).toHaveLength(2);
      expect(created.items.every((i) => i.completed === false)).toBe(true);

      const listRes = await get(`/trading/strategies/${strategyId}/checklists`);
      const list = (await listRes.json()) as ChecklistResponse[];
      expect(list.some((c) => c.id === created.id)).toBe(true);

      const getRes = await get(`/trading/strategy-checklists/${created.id}`);
      expect(getRes.status).toBe(200);

      // Mark the one required item complete -> status flips to "complete".
      const completedItems = created.items.map((i) => (i.required ? { ...i, completed: true, notes: "Reviewed." } : i));
      const patchRes = await patch(`/trading/strategy-checklists/${created.id}`, { items: completedItems });
      expect(patchRes.status).toBe(200);
      const patched = (await patchRes.json()) as ChecklistResponse;
      expect(patched.status).toBe("complete");
      expect(patched.items.find((i) => i.required)!.completed).toBe(true);

      const deleteRes = await del(`/trading/strategy-checklists/${created.id}`);
      expect(deleteRes.status).toBe(204);
      expect((await get(`/trading/strategy-checklists/${created.id}`)).status).toBe(404);
    });

    it("404s when instantiating a checklist for a nonexistent strategy", async () => {
      const res = await post("/trading/strategies/999999999/checklists", {});
      expect(res.status).toBe(404);
    });

    it("400s for a non-numeric strategy id on the checklists list route", async () => {
      expect((await get("/trading/strategies/not-a-number/checklists")).status).toBe(400);
    });
  });

  describe("Strategy Coach (deterministic)", () => {
    let strategyId: number;

    beforeAll(async () => {
      const name = `Coach Test Strategy ${randomUUID()}`;
      const res = await post("/trading/strategies", validStrategyInput(name));
      const created = (await res.json()) as StrategyResponse;
      strategyId = created.id;
    });

    afterAll(async () => {
      await del(`/trading/strategies/${strategyId}`);
    });

    it("explains the registered strategy's own metadata, honestly reporting no checklist instance yet", async () => {
      const res = await get(`/trading/coach/strategy/${strategyId}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as CoachExplanationBody;
      expect(body.coach).toBe("strategy");
      expect(body.headline).toContain("No checklist instance has been started");
      expect(body.metricsUsed.length).toBeGreaterThan(0);
      expect(body.disclaimer).toMatch(/never creates a.*trading signal/i);
    });

    it("grounds the explanation in a real checklist instance when ?checklistId= is supplied", async () => {
      const createRes = await post(`/trading/strategies/${strategyId}/checklists`, {});
      const checklist = (await createRes.json()) as ChecklistResponse;

      const res = await get(`/trading/coach/strategy/${strategyId}?checklistId=${checklist.id}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as CoachExplanationBody;
      expect(body.headline).toContain("required item(s) complete");

      await del(`/trading/strategy-checklists/${checklist.id}`);
    });

    it("404s for an unknown strategy id", async () => {
      const res = await get("/trading/coach/strategy/999999999");
      expect(res.status).toBe(404);
    });

    it("400s for an invalid ?checklistId=", async () => {
      const res = await get(`/trading/coach/strategy/${strategyId}?checklistId=not-a-number`);
      expect(res.status).toBe(400);
    });
  });

  describe("Strategy Framework Summary Report", () => {
    it("returns a well-shaped report reflecting the calling user's own strategies (shape-only, shared legacy-owner account)", async () => {
      const res = await get("/reporting/strategy-framework-summary");
      expect(res.status).toBe(200);
      const body = (await res.json()) as ReportBody;
      expect(body.reportType).toBe("strategy-framework-summary");
      expect(body.sections.some((s) => s.id === "executive-summary")).toBe(true);
      expect(body.sections.some((s) => s.id === "strategy-registry")).toBe(true);
      expect(body.sections.some((s) => s.id === "checklist-instances")).toBe(true);
      // Phase 31 — Institutional Strategy Workbench extensions.
      expect(body.sections.some((s) => s.id === "learning-coverage")).toBe(true);
      expect(body.sections.some((s) => s.id === "workspace-notes")).toBe(true);
    });

    it("reflects a newly created strategy in the registry section", async () => {
      const name = `Reporting Test Strategy ${randomUUID()}`;
      const createRes = await post("/trading/strategies", validStrategyInput(name));
      const created = (await createRes.json()) as StrategyResponse;

      const res = await get("/reporting/strategy-framework-summary");
      const body = (await res.json()) as ReportBody;
      const registrySection = body.sections.find((s) => s.id === "strategy-registry")!;
      expect(registrySection.bullets?.some((b) => b.includes(name))).toBe(true);

      await del(`/trading/strategies/${created.id}`);
    });

    it("Phase 31 — Learning Coverage honestly reports 'not yet viewed' until the Strategy Framework's own Mark-as-viewed action fires, then reflects it", async () => {
      const name = `Learning Coverage Test ${randomUUID()}`;
      const createRes = await post("/trading/strategies", validStrategyInput(name));
      const created = (await createRes.json()) as StrategyResponse;

      const before = (await (await get("/reporting/strategy-framework-summary")).json()) as ReportBody;
      const beforeCoverage = before.sections.find((s) => s.id === "learning-coverage")!;
      expect(beforeCoverage.bullets?.some((b) => b.includes(name) && b.includes("not yet viewed"))).toBe(true);

      await post("/learning-centre/progress/view", { itemType: "strategy", itemKey: `strategy-framework:${created.id}` });

      const after = (await (await get("/reporting/strategy-framework-summary")).json()) as ReportBody;
      const afterCoverage = after.sections.find((s) => s.id === "learning-coverage")!;
      expect(afterCoverage.bullets?.some((b) => b === `${name}: viewed`)).toBe(true);

      await del(`/trading/strategies/${created.id}`);
    });

    it("Phase 31 — Workspace Notes reuses trading_workspace_notes under the STRATEGY:<id> pseudo-symbol, never a new table", async () => {
      const name = `Workspace Note Test ${randomUUID()}`;
      const createRes = await post("/trading/strategies", validStrategyInput(name));
      const created = (await createRes.json()) as StrategyResponse;

      const noteText = `Reviewed this strategy's own checklist ${randomUUID()}.`;
      const noteRes = await post("/trading/workspace-notes", { symbol: `STRATEGY:${created.id}`, note: noteText });
      expect(noteRes.status).toBe(201);
      const note = (await noteRes.json()) as { id: number; symbol: string };
      expect(note.symbol).toBe(`STRATEGY:${created.id}`);

      const report = (await (await get("/reporting/strategy-framework-summary")).json()) as ReportBody;
      const notesSection = report.sections.find((s) => s.id === "workspace-notes")!;
      expect(notesSection.bullets?.some((b) => b.includes(name) && b.includes(noteText))).toBe(true);

      await del(`/trading/workspace-notes/${note.id}`);
      await del(`/trading/strategies/${created.id}`);
    });
  });
});

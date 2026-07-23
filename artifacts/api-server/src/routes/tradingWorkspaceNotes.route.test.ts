// Phase 25 — Institutional Trade Workspace. Live route integration test for
// the Workspace Notes CRUD surface. Mirrors
// routes/tradingTradePlans.route.test.ts's own pattern.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface WorkspaceNoteResponse {
  id: number;
  symbol: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

describe("Trading Workspace Notes routes (live, real Postgres, SIMULATED path)", () => {
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

  it("supports the full create/list/list-by-symbol/update/delete flow", async () => {
    const createRes = await fetch(`${baseUrl}/api/trading/workspace-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "nvda", note: "Watching for a pullback to the 21 EMA." }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as WorkspaceNoteResponse;
    expect(created.symbol).toBe("NVDA");
    expect(created.note).toBe("Watching for a pullback to the 21 EMA.");

    const listRes = await fetch(`${baseUrl}/api/trading/workspace-notes`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as WorkspaceNoteResponse[];
    expect(list.some((n) => n.id === created.id)).toBe(true);

    const bySymbolRes = await fetch(`${baseUrl}/api/trading/workspace-notes/NVDA`);
    expect(bySymbolRes.status).toBe(200);
    const bySymbol = (await bySymbolRes.json()) as WorkspaceNoteResponse[];
    expect(bySymbol.some((n) => n.id === created.id)).toBe(true);

    const updateRes = await fetch(`${baseUrl}/api/trading/workspace-notes/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Pullback happened — entered on reclaim of the EMA." }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as WorkspaceNoteResponse;
    expect(updated.note).toBe("Pullback happened — entered on reclaim of the EMA.");

    const deleteRes = await fetch(`${baseUrl}/api/trading/workspace-notes/${created.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);

    const afterDelete = await fetch(`${baseUrl}/api/trading/workspace-notes/NVDA`);
    const afterDeleteList = (await afterDelete.json()) as WorkspaceNoteResponse[];
    expect(afterDeleteList.some((n) => n.id === created.id)).toBe(false);
  });

  it("returns 400 for a missing required field", async () => {
    const res = await fetch(`${baseUrl}/api/trading/workspace-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for PATCH/DELETE on a nonexistent id", async () => {
    const patchRes = await fetch(`${baseUrl}/api/trading/workspace-notes/999999999`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "x" }),
    });
    expect(patchRes.status).toBe(404);

    const deleteRes = await fetch(`${baseUrl}/api/trading/workspace-notes/999999999`, { method: "DELETE" });
    expect(deleteRes.status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await fetch(`${baseUrl}/api/trading/workspace-notes/not-a-number`, { method: "DELETE" });
    expect(res.status).toBe(400);
  });
});

// Phase 3, Sprint 44 — live route integration test for the Trading
// Positions CRUD surface (approved Phase 3 plan §15, this sprint's own
// kickoff decision — added so the Risk Management panel has real position
// data to score against). Uses the real app + a real Postgres connection
// (no auth session needed — unauthenticated requests resolve to the
// legacy-owner stand-in per tenantScope.ts). Mirrors
// routes/tradingJournal.route.test.ts's own Sprint 39 pattern.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

interface PositionResponse {
  id: number;
  symbol: string;
  instrumentType: string;
  side: string;
  status: string;
  quantity: number;
  entryPrice: number;
  entryDate: string;
  exitPrice: number | null;
  exitDate: string | null;
  stopPrice: number | null;
  targetPrice: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

describe("Trading Positions routes (live, real Postgres, SIMULATED path)", () => {
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

  it("supports the full create/list/get/update/delete flow", async () => {
    const createRes = await fetch(`${baseUrl}/api/trading/positions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", side: "long", quantity: 10, entryPrice: 190, stopPrice: 180, targetPrice: 210 }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as PositionResponse;
    expect(created.symbol).toBe("AAPL");
    expect(created.instrumentType).toBe("stock");
    expect(created.status).toBe("open");
    expect(created.stopPrice).toBe(180);
    expect(created.targetPrice).toBe(210);

    const listRes = await fetch(`${baseUrl}/api/trading/positions`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as PositionResponse[];
    expect(list.some((p) => p.id === created.id)).toBe(true);

    const getRes = await fetch(`${baseUrl}/api/trading/positions/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as PositionResponse;
    expect(fetched.id).toBe(created.id);

    const updateRes = await fetch(`${baseUrl}/api/trading/positions/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed", exitPrice: 205 }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as PositionResponse;
    expect(updated.status).toBe("closed");
    expect(updated.exitPrice).toBe(205);

    const deleteRes = await fetch(`${baseUrl}/api/trading/positions/${created.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await fetch(`${baseUrl}/api/trading/positions/${created.id}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it("returns 400 for a missing required field", async () => {
    const res = await fetch(`${baseUrl}/api/trading/positions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: 10, entryPrice: 190 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid side enum value", async () => {
    const res = await fetch(`${baseUrl}/api/trading/positions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "AAPL", side: "sideways", quantity: 10, entryPrice: 190 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for GET/PATCH/DELETE on a nonexistent id", async () => {
    const getRes = await fetch(`${baseUrl}/api/trading/positions/999999999`);
    expect(getRes.status).toBe(404);

    const patchRes = await fetch(`${baseUrl}/api/trading/positions/999999999`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "x" }),
    });
    expect(patchRes.status).toBe(404);

    const deleteRes = await fetch(`${baseUrl}/api/trading/positions/999999999`, { method: "DELETE" });
    expect(deleteRes.status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await fetch(`${baseUrl}/api/trading/positions/not-a-number`);
    expect(res.status).toBe(400);
  });
});

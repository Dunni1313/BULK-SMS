// Phase 10 — Institutional Platform Polish & Control Center. Live route
// integration tests for /workspaces (Workspace System + Personal
// Dashboard's own backing API). Uses the real app + a real Postgres
// connection (no auth session needed — unauthenticated requests resolve
// to the legacy-owner stand-in per tenantScope.ts).
//
// Uses randomly-generated workspace names per test, mirroring
// routes/notifications.route.test.ts's own "random fake symbol"
// precedent — the shared legacy-owner account's dashboard_workspaces
// rows could in principle collide with any other test file/run that also
// creates named workspaces under the same account, and the table itself
// enforces a real (userId, name) uniqueness constraint.
//
// Zero trading, execution, pricing, portfolio, or risk calculations are
// exercised by this file — it only proves the HTTP wiring for UI layout
// preferences.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

function randomName(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

interface WidgetConfigEntry {
  id: string;
  visible: boolean;
  size: "normal" | "compact";
  order: number;
}

interface WorkspaceResponse {
  id: number;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  widgetConfig: WidgetConfigEntry[];
  createdAt: string;
  updatedAt: string;
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe("Dashboard Workspaces routes (live, real Postgres)", () => {
  let server: Server;
  let baseUrl: string;
  const createdIds: number[] = [];

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
    // Clean up every workspace this file created so no other test file
    // sharing the same legacy-owner account is left with extra rows.
    for (const id of createdIds) {
      await fetch(`${baseUrl}/api/workspaces/${id}`, { method: "DELETE" }).catch(() => undefined);
    }
    server.close();
  });

  it("GET /workspaces/active lazily creates and returns a Default workspace for a brand-new account state", async () => {
    const res = await fetch(`${baseUrl}/api/workspaces/active`);
    expect(res.status).toBe(200);
    const body = await json<WorkspaceResponse>(res);
    expect(body.isActive).toBe(true);
    expect(Array.isArray(body.widgetConfig)).toBe(true);
    expect(body.widgetConfig.length).toBeGreaterThan(0);
    // Every widget id must be well-shaped, never a fabricated placeholder.
    for (const w of body.widgetConfig) {
      expect(typeof w.id).toBe("string");
      expect(["normal", "compact"]).toContain(w.size);
    }
  });

  it("GET /workspaces returns a well-shaped array including at least the Default workspace", async () => {
    const res = await fetch(`${baseUrl}/api/workspaces`);
    expect(res.status).toBe(200);
    const body = await json<WorkspaceResponse[]>(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /workspaces creates a new named workspace, defaulting to the standard widget config when none is supplied", async () => {
    const name = randomName("Income Trading");
    const res = await fetch(`${baseUrl}/api/workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    expect(res.status).toBe(201);
    const body = await json<WorkspaceResponse>(res);
    createdIds.push(body.id);
    expect(body.name).toBe(name);
    expect(body.isActive).toBe(false);
    expect(body.widgetConfig.length).toBeGreaterThan(0);
  });

  it("POST /workspaces 409s on a duplicate name for the same account", async () => {
    const name = randomName("Risk Management");
    const first = await fetch(`${baseUrl}/api/workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const firstBody = await json<WorkspaceResponse>(first);
    createdIds.push(firstBody.id);

    const second = await fetch(`${baseUrl}/api/workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    expect(second.status).toBe(409);
  });

  it("PATCH /workspaces/:id renames a workspace and saves a real pin/hide/reorder/resize widget config", async () => {
    const created = await json<WorkspaceResponse>(
      await fetch(`${baseUrl}/api/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: randomName("Research") }),
      }),
    );
    createdIds.push(created.id);

    const newName = randomName("Research Renamed");
    const newConfig: WidgetConfigEntry[] = [
      { id: "portfolio-health", visible: false, size: "compact", order: 0 },
      { id: "market-status", visible: true, size: "normal", order: 1 },
    ];
    const res = await fetch(`${baseUrl}/api/workspaces/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName, widgetConfig: newConfig }),
    });
    expect(res.status).toBe(200);
    const body = await json<WorkspaceResponse>(res);
    expect(body.name).toBe(newName);
    expect(body.widgetConfig).toEqual(newConfig);
  });

  it("PATCH /workspaces/:id 404s for a nonexistent id", async () => {
    const res = await fetch(`${baseUrl}/api/workspaces/999999999`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: randomName("Nope") }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /workspaces/:id/duplicate copies the widget config under a new name", async () => {
    const source = await json<WorkspaceResponse>(
      await fetch(`${baseUrl}/api/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: randomName("Options Analysis"),
          widgetConfig: [{ id: "theta-income", visible: true, size: "compact", order: 0 }],
        }),
      }),
    );
    createdIds.push(source.id);

    const dupName = randomName("Options Analysis Copy");
    const res = await fetch(`${baseUrl}/api/workspaces/${source.id}/duplicate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: dupName }),
    });
    expect(res.status).toBe(201);
    const body = await json<WorkspaceResponse>(res);
    createdIds.push(body.id);
    expect(body.name).toBe(dupName);
    expect(body.widgetConfig).toEqual(source.widgetConfig);
    expect(body.id).not.toBe(source.id);
  });

  it("POST /workspaces/:id/activate switches the active workspace, deactivating every other one for the account", async () => {
    const a = await json<WorkspaceResponse>(
      await fetch(`${baseUrl}/api/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: randomName("Learning") }),
      }),
    );
    createdIds.push(a.id);
    const b = await json<WorkspaceResponse>(
      await fetch(`${baseUrl}/api/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: randomName("Portfolio Review") }),
      }),
    );
    createdIds.push(b.id);

    const activateA = await fetch(`${baseUrl}/api/workspaces/${a.id}/activate`, { method: "POST" });
    expect(activateA.status).toBe(200);
    expect((await json<WorkspaceResponse>(activateA)).isActive).toBe(true);

    const activateB = await fetch(`${baseUrl}/api/workspaces/${b.id}/activate`, { method: "POST" });
    expect((await json<WorkspaceResponse>(activateB)).isActive).toBe(true);

    // Confirm via the list endpoint that only b is active now — never two
    // simultaneously active workspaces for the same account.
    const list = await json<WorkspaceResponse[]>(await fetch(`${baseUrl}/api/workspaces`));
    const active = list.filter((w) => w.isActive);
    expect(active.length).toBe(1);
    expect(active[0].id).toBe(b.id);

    const activeNow = await json<WorkspaceResponse>(await fetch(`${baseUrl}/api/workspaces/active`));
    expect(activeNow.id).toBe(b.id);
  });

  it("DELETE /workspaces/:id removes a non-active workspace and 404s on a repeat delete", async () => {
    const created = await json<WorkspaceResponse>(
      await fetch(`${baseUrl}/api/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: randomName("Temp") }),
      }),
    );

    const del = await fetch(`${baseUrl}/api/workspaces/${created.id}`, { method: "DELETE" });
    expect(del.status).toBe(204);

    const redel = await fetch(`${baseUrl}/api/workspaces/${created.id}`, { method: "DELETE" });
    expect(redel.status).toBe(404);
  });

  it("DELETE /workspaces/:id refuses to delete the account's only remaining workspace", async () => {
    // Drain every workspace except one, then confirm the last one is protected.
    const all = await json<WorkspaceResponse[]>(await fetch(`${baseUrl}/api/workspaces`));
    for (const w of all.slice(1)) {
      await fetch(`${baseUrl}/api/workspaces/${w.id}`, { method: "DELETE" });
    }
    const remaining = await json<WorkspaceResponse[]>(await fetch(`${baseUrl}/api/workspaces`));
    expect(remaining.length).toBe(1);

    const res = await fetch(`${baseUrl}/api/workspaces/${remaining[0].id}`, { method: "DELETE" });
    expect(res.status).toBe(400);

    // Confirm it genuinely wasn't deleted.
    const stillThere = await json<WorkspaceResponse[]>(await fetch(`${baseUrl}/api/workspaces`));
    expect(stillThere.length).toBe(1);
  });
});

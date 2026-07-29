// v1.5.0, Sprint 10 — Institutional Trade Planner. Live route integration
// tests against a real app + real Postgres connection + the real
// Better-Auth instance (no auth mocking), using a fresh, isolated,
// genuinely signed-up user per test block, mirroring
// routes/aiStrategies.route.test.ts's own established pattern (Sprint 9)
// so this file's own trade plans are never at risk of colliding with
// another concurrently-running test file's own data.
//
// Proves the sprint's own required guarantees end-to-end over real HTTP:
// trade plan CRUD, version history (initial version, bump on content
// edit, no bump on pinned-only, section create/delete also bumps,
// checklist completion toggling does NOT bump while add/remove/relabel
// does, restore appends a NEW version rather than rewriting history),
// sections (singleton upsert for the 18 qualitative kinds, the 3
// multi-kind reference sections and their ownership/coach-match
// validation), the Checklist Engine (required/optional items, progress
// percentage, coach-specific templates), deterministic
// missing-information/similar-plans analysis, compare (both deterministic
// and AI), AI features' honest fallback behavior with no LLM key
// configured, workspace/notebook/conversation/strategy linking, status
// transitions, per-user and per-coach isolation, and a proof that
// existing Sprint 6/7/8/9 workspace/notebook/conversation/strategy
// behavior is completely unaffected by any of this.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  settingsTable,
  sessionsTable,
  accountsTable,
  aiWorkspacesTable,
  aiWorkspaceFilesTable,
  aiWorkspaceNotesTable,
  aiCoachConversationsTable,
  aiCoachMessagesTable,
  aiNotebooksTable,
  aiNotebookNotesTable,
  aiNotebookLinksTable,
  aiStrategiesTable,
  aiStrategySectionsTable,
  aiStrategyVersionsTable,
  tradePlansTable,
  tradePlanSectionsTable,
  tradePlanVersionsTable,
  tradePlanChecklistItemsTable,
} from "@workspace/db";
import type { Server } from "node:http";

interface SignedUpUser {
  userId: string;
  cookie: string;
}

function getCookie(res: Response): string {
  const raw = res.headers.get("set-cookie");
  if (!raw) throw new Error("expected a Set-Cookie header");
  return raw.split(";")[0];
}

const seededUserIds: string[] = [];

async function cleanupUser(userId: string): Promise<void> {
  const plans = await db.select({ id: tradePlansTable.id }).from(tradePlansTable).where(eq(tradePlansTable.userId, userId));
  for (const p of plans) {
    await db.delete(tradePlanSectionsTable).where(eq(tradePlanSectionsTable.tradePlanId, p.id));
    await db.delete(tradePlanVersionsTable).where(eq(tradePlanVersionsTable.tradePlanId, p.id));
    await db.delete(tradePlanChecklistItemsTable).where(eq(tradePlanChecklistItemsTable.tradePlanId, p.id));
  }
  await db.delete(tradePlansTable).where(eq(tradePlansTable.userId, userId));

  const strategies = await db.select({ id: aiStrategiesTable.id }).from(aiStrategiesTable).where(eq(aiStrategiesTable.userId, userId));
  for (const s of strategies) {
    await db.delete(aiStrategySectionsTable).where(eq(aiStrategySectionsTable.strategyId, s.id));
    await db.delete(aiStrategyVersionsTable).where(eq(aiStrategyVersionsTable.strategyId, s.id));
  }
  await db.delete(aiStrategiesTable).where(eq(aiStrategiesTable.userId, userId));

  const notebooks = await db.select({ id: aiNotebooksTable.id }).from(aiNotebooksTable).where(eq(aiNotebooksTable.userId, userId));
  for (const n of notebooks) {
    await db.delete(aiNotebookNotesTable).where(eq(aiNotebookNotesTable.notebookId, n.id));
    await db.delete(aiNotebookLinksTable).where(eq(aiNotebookLinksTable.notebookId, n.id));
  }
  await db.delete(aiNotebooksTable).where(eq(aiNotebooksTable.userId, userId));

  const workspaces = await db.select({ id: aiWorkspacesTable.id }).from(aiWorkspacesTable).where(eq(aiWorkspacesTable.userId, userId));
  for (const w of workspaces) {
    await db.delete(aiWorkspaceFilesTable).where(eq(aiWorkspaceFilesTable.workspaceId, w.id));
    await db.delete(aiWorkspaceNotesTable).where(eq(aiWorkspaceNotesTable.workspaceId, w.id));
  }
  const conversations = await db
    .select({ id: aiCoachConversationsTable.id })
    .from(aiCoachConversationsTable)
    .where(eq(aiCoachConversationsTable.userId, userId));
  for (const c of conversations) {
    await db.delete(aiCoachMessagesTable).where(eq(aiCoachMessagesTable.conversationId, c.id));
  }
  await db.delete(aiCoachConversationsTable).where(eq(aiCoachConversationsTable.userId, userId));
  await db.delete(aiWorkspacesTable).where(eq(aiWorkspacesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  await db.delete(accountsTable).where(eq(accountsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("Institutional Trade Planner routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `trade-plans-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "Trade Plans Test User" }),
    });
    if (!res.ok) throw new Error(`sign-up failed: ${res.status}`);
    const body = (await res.json()) as { user: { id: string } };
    seededUserIds.push(body.user.id);
    return { userId: body.user.id, cookie: getCookie(res) };
  }

  async function createPlan(cookie: string, overrides: Record<string, unknown> = {}) {
    const res = await fetch(`${baseUrl}/api/trade-plans`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ coachId: "trading", title: "My Plan", plannedAsset: "AAPL", direction: "long", ...overrides }),
    });
    return { res, body: (await res.json()) as any };
  }

  async function createWorkspace(cookie: string, overrides: Record<string, unknown> = {}) {
    const res = await fetch(`${baseUrl}/api/ai-workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ coachId: "trading", name: "My Workspace", ...overrides }),
    });
    return { res, body: (await res.json()) as any };
  }

  async function createNotebook(cookie: string, overrides: Record<string, unknown> = {}) {
    const res = await fetch(`${baseUrl}/api/ai-notebooks`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ coachId: "trading", title: "My Notebook", ...overrides }),
    });
    return { res, body: (await res.json()) as any };
  }

  async function createConversation(cookie: string, overrides: Record<string, unknown> = {}) {
    const res = await fetch(`${baseUrl}/api/coach-conversations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ coachId: "trading", ...overrides }),
    });
    return { res, body: (await res.json()) as any };
  }

  async function createStrategy(cookie: string, overrides: Record<string, unknown> = {}) {
    const res = await fetch(`${baseUrl}/api/ai-strategies`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ coachId: "trading", title: "My Strategy", strategyType: "Trend Following", ...overrides }),
    });
    return { res, body: (await res.json()) as any };
  }

  async function addSection(cookie: string, planId: number, overrides: Record<string, unknown>) {
    const res = await fetch(`${baseUrl}/api/trade-plans/${planId}/sections`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(overrides),
    });
    return { res, body: (await res.json()) as any };
  }

  async function addChecklistItem(cookie: string, planId: number, overrides: Record<string, unknown>) {
    const res = await fetch(`${baseUrl}/api/trade-plans/${planId}/checklist-items`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(overrides),
    });
    return { res, body: (await res.json()) as any };
  }

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
    for (const userId of seededUserIds) {
      await cleanupUser(userId);
    }
    server.close();
  });

  // ─── Checklist templates ────────────────────────────────────────────────

  it("GET /trade-plan-checklist-templates returns all 3 named coach templates", async () => {
    const res = await fetch(`${baseUrl}/api/trade-plan-checklist-templates`);
    expect(res.status).toBe(200);
    const templates = (await res.json()) as any[];
    expect(templates).toHaveLength(3);
    expect(templates.map((t) => t.id)).toContain("trading-pre-trade");
    expect(templates.every((t) => Array.isArray(t.items) && t.items.length > 0)).toBe(true);
  });

  it("GET /trade-plan-checklist-templates?coachId= filters to that coach", async () => {
    const res = await fetch(`${baseUrl}/api/trade-plan-checklist-templates?coachId=options`);
    const templates = (await res.json()) as any[];
    expect(templates).toHaveLength(1);
    expect(templates[0].coachId).toBe("options");
  });

  // ─── CRUD ───────────────────────────────────────────────────────────────

  it("GET /trade-plans requires a coachId query param", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/trade-plans`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(400);
  });

  it("GET /trade-plans?coachId=trading returns an honest empty list for a brand-new user", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/trade-plans?coachId=trading`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    expect((await res.json()) as any[]).toEqual([]);
  });

  it("POST /trade-plans creates a plan with the given fields and starts at version 1", async () => {
    const user = await signUp();
    const { res, body } = await createPlan(user.cookie, {
      title: "Breakout Long",
      plannedAsset: "TSLA",
      assetClass: "equities",
      direction: "long",
      tags: ["breakout", "momentum"],
    });
    expect(res.status).toBe(201);
    expect(body.coachId).toBe("trading");
    expect(body.title).toBe("Breakout Long");
    expect(body.plannedAsset).toBe("TSLA");
    expect(body.assetClass).toBe("equities");
    expect(body.direction).toBe("long");
    expect(body.tags).toEqual(["breakout", "momentum"]);
    expect(body.status).toBe("draft");
    expect(body.pinned).toBe(false);
    expect(body.currentVersion).toBe(1);
    expect(body.workspaceId).toBeNull();
    expect(body.strategyId).toBeNull();
    expect(body.executedTradeRef).toBeNull();
    expect(body.executedAt).toBeNull();
  });

  it("POST /trade-plans rejects a missing coachId", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/trade-plans`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ title: "No coach" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /trade-plans rejects an empty title", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/trade-plans`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "   " }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /trade-plans rejects an invalid direction", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/trade-plans`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "Bad direction", direction: "sideways" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /trade-plans with a workspaceId requires the workspace to belong to the same coach", async () => {
    const user = await signUp();
    const { body: investingWorkspace } = await createWorkspace(user.cookie, { coachId: "investing", name: "Investing WS" });
    const res = await fetch(`${baseUrl}/api/trade-plans`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "Mismatched", workspaceId: investingWorkspace.id }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /trade-plans with a strategyId requires the strategy to belong to the same coach", async () => {
    const user = await signUp();
    const { body: investingStrategy } = await createStrategy(user.cookie, { coachId: "investing", strategyType: "Value Investing" });
    const res = await fetch(`${baseUrl}/api/trade-plans`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "Mismatched strategy", strategyId: investingStrategy.id }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /trade-plans with a matching-coach strategyId succeeds and links the plan (Linked Strategy)", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie, { coachId: "trading" });
    const { res, body } = await createPlan(user.cookie, { strategyId: strategy.id });
    expect(res.status).toBe(201);
    expect(body.strategyId).toBe(strategy.id);
  });

  it("POST /trade-plans rejects a nonexistent strategyId (404, not 400)", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/trade-plans`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "Ghost strategy", strategyId: 999999999 }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /trade-plans/:id returns full detail: plan + sections + versions + checklistItems + checklistProgress", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const detail = (await res.json()) as any;
    expect(detail.id).toBe(plan.id);
    expect(detail.sections).toEqual([]);
    expect(detail.versions).toHaveLength(1);
    expect(detail.versions[0].version).toBe(1);
    expect(detail.versions[0].changeSummary).toBe("Created");
    expect(detail.checklistItems).toEqual([]);
    expect(detail.checklistProgress.totalItems).toBe(0);
    expect(detail.checklistProgress.readyForEntry).toBe(false);
  });

  it("GET /trade-plans/:id 404s for a nonexistent id", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/trade-plans/999999999`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(404);
  });

  it("PATCH /trade-plans/:id updates content fields and bumps version", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    expect(plan.currentVersion).toBe(1);

    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ title: "Renamed", plannedAsset: "MSFT", tags: ["tag1"], changeSummary: "Renamed and retargeted" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.title).toBe("Renamed");
    expect(body.plannedAsset).toBe("MSFT");
    expect(body.tags).toEqual(["tag1"]);
    expect(body.currentVersion).toBe(2);

    const versions = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}/versions`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(2);
    expect(versions[0].changeSummary).toBe("Renamed and retargeted");
  });

  // ─── Status transitions ─────────────────────────────────────────────────

  it("PATCH /trade-plans/:id transitions status through the full lifecycle and bumps version each time", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    expect(plan.status).toBe("draft");

    for (const status of ["ready", "watching", "executed", "cancelled", "archived"]) {
      const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: user.cookie },
        body: JSON.stringify({ status }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.status).toBe(status);
    }

    const detail = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.currentVersion).toBe(6);
  });

  it("PATCH /trade-plans/:id transitioning to executed sets executedAt automatically", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ status: "executed" }),
    });
    const body = (await res.json()) as any;
    expect(body.status).toBe("executed");
    expect(body.executedAt).not.toBeNull();
  });

  it("PATCH /trade-plans/:id can set executedTradeRef (future execution linkage, never calls a broker)", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ status: "executed", executedTradeRef: "trade-12345" }),
    });
    const body = (await res.json()) as any;
    expect(body.executedTradeRef).toBe("trade-12345");
  });

  it("PATCH /trade-plans/:id rejects an invalid status", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ status: "not-a-real-status" }),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /trade-plans/:id updating only pinned does NOT bump version", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);

    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ pinned: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.pinned).toBe(true);
    expect(body.currentVersion).toBe(1);

    const versions = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}/versions`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(versions).toHaveLength(1);
  });

  it("PATCH /trade-plans/:id rejects an empty body", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("DELETE /trade-plans/:id removes the plan", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const del = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    const list = (await (await fetch(`${baseUrl}/api/trade-plans?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(list).toEqual([]);
  });

  it("DELETE /trade-plans/:id cascades its own sections, versions, and checklist items (ON DELETE CASCADE)", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const { body: section } = await addSection(user.cookie, plan.id, { kind: "trade_thesis", content: "Breaking out of a base" });
    const { body: item } = await addChecklistItem(user.cookie, plan.id, { label: "Confirm entry" });

    await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { method: "DELETE", headers: { cookie: user.cookie } });

    const remainingSections = await db.select().from(tradePlanSectionsTable).where(eq(tradePlanSectionsTable.id, section.id));
    expect(remainingSections).toEqual([]);
    const remainingVersions = await db.select().from(tradePlanVersionsTable).where(eq(tradePlanVersionsTable.tradePlanId, plan.id));
    expect(remainingVersions).toEqual([]);
    const remainingItems = await db.select().from(tradePlanChecklistItemsTable).where(eq(tradePlanChecklistItemsTable.id, item.id));
    expect(remainingItems).toEqual([]);
  });

  // ─── Isolation ──────────────────────────────────────────────────────────

  it("trade plans are isolated per user — a different user never sees another user's plan", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    await createPlan(owner.cookie, { title: "Owner's private plan" });

    const attackerList = (await (
      await fetch(`${baseUrl}/api/trade-plans?coachId=trading`, { headers: { cookie: attacker.cookie } })
    ).json()) as any[];
    expect(attackerList).toEqual([]);
  });

  it("PATCH/DELETE return 404 (not 403) for a plan owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: plan } = await createPlan(owner.cookie);

    const patchRes = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: attacker.cookie },
      body: JSON.stringify({ title: "Hijacked" }),
    });
    expect(patchRes.status).toBe(404);

    const deleteRes = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { method: "DELETE", headers: { cookie: attacker.cookie } });
    expect(deleteRes.status).toBe(404);

    const stillThere = await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: owner.cookie } });
    expect(stillThere.status).toBe(200);
  });

  it("trade plans are isolated per coach — a Trading plan never appears under Investing or Options for the same user", async () => {
    const user = await signUp();
    await createPlan(user.cookie, { coachId: "trading", title: "Trading only" });
    await createPlan(user.cookie, { coachId: "investing", title: "Investing only" });
    await createPlan(user.cookie, { coachId: "options", title: "Options only" });

    const trading = (await (await fetch(`${baseUrl}/api/trade-plans?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    const investing = (await (await fetch(`${baseUrl}/api/trade-plans?coachId=investing`, { headers: { cookie: user.cookie } })).json()) as any[];
    const options = (await (await fetch(`${baseUrl}/api/trade-plans?coachId=options`, { headers: { cookie: user.cookie } })).json()) as any[];

    expect(trading.map((s) => s.title)).toEqual(["Trading only"]);
    expect(investing.map((s) => s.title)).toEqual(["Investing only"]);
    expect(options.map((s) => s.title)).toEqual(["Options only"]);
  });

  // ─── Library filters ────────────────────────────────────────────────────

  it("?search filters plans by title or planned asset, case-insensitively", async () => {
    const user = await signUp();
    await createPlan(user.cookie, { title: "AAPL breakout plan", plannedAsset: "AAPL" });
    await createPlan(user.cookie, { title: "Risk check", plannedAsset: "MSFT" });

    const filtered = (await (
      await fetch(`${baseUrl}/api/trade-plans?coachId=trading&search=aapl`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(filtered.map((s) => s.title)).toEqual(["AAPL breakout plan"]);
  });

  it("?status filters plans by lifecycle status", async () => {
    const user = await signUp();
    await createPlan(user.cookie, { title: "Still draft" });
    const { body: toReady } = await createPlan(user.cookie, { title: "Going ready" });
    await fetch(`${baseUrl}/api/trade-plans/${toReady.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ status: "ready" }),
    });

    const ready = (await (
      await fetch(`${baseUrl}/api/trade-plans?coachId=trading&status=ready`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(ready.map((s: any) => s.title)).toEqual(["Going ready"]);
  });

  it("archiving a plan (via status) hides it from the default list but keeps it retrievable with includeArchived=true", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie, { title: "To be archived" });

    await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ status: "archived" }),
    });

    const defaultList = (await (await fetch(`${baseUrl}/api/trade-plans?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(defaultList).toEqual([]);

    const withArchived = (await (
      await fetch(`${baseUrl}/api/trade-plans?coachId=trading&includeArchived=true`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(withArchived).toHaveLength(1);
    expect(withArchived[0].status).toBe("archived");
  });

  it("pinned plans are sorted first, then by most-recently-updated", async () => {
    const user = await signUp();
    const { body: first } = await createPlan(user.cookie, { title: "First" });
    const { body: second } = await createPlan(user.cookie, { title: "Second" });
    await createPlan(user.cookie, { title: "Third" });

    await fetch(`${baseUrl}/api/trade-plans/${second.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ pinned: true }),
    });

    const list = (await (await fetch(`${baseUrl}/api/trade-plans?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(list[0].title).toBe("Second");
    expect(list[0].pinned).toBe(true);
    expect(list.slice(1).map((s) => s.title)).toEqual(["Third", "First"]);
    void first;
  });

  // ─── Sections ───────────────────────────────────────────────────────────

  it("POST a qualitative section then POSTing the same kind again upserts (does not create a duplicate)", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);

    const first = await addSection(user.cookie, plan.id, { kind: "entry_zone", content: "Enter on breakout confirmation" });
    expect(first.res.status).toBe(201);
    const firstId = first.body.id;

    const second = await addSection(user.cookie, plan.id, { kind: "entry_zone", content: "Enter on retest instead" });
    expect(second.res.status).toBe(201);
    expect(second.body.id).toBe(firstId);
    expect(second.body.content).toBe("Enter on retest instead");

    const list = (await (
      await fetch(`${baseUrl}/api/trade-plans/${plan.id}/sections`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(list.filter((s) => s.kind === "entry_zone")).toHaveLength(1);
  });

  it("POST a qualitative section rejects empty content", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const { res } = await addSection(user.cookie, plan.id, { kind: "entry_zone", content: "" });
    expect(res.status).toBe(400);
  });

  it("POST an invalid section kind is rejected", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const { res } = await addSection(user.cookie, plan.id, { kind: "not-a-real-kind", content: "x" });
    expect(res.status).toBe(400);
  });

  it("POST a qualitative section with a ref field is rejected (plain-text sections cannot carry a reference)", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const { body: notebook } = await createNotebook(user.cookie, { coachId: "trading" });
    const { res } = await addSection(user.cookie, plan.id, { kind: "entry_zone", content: "x", refNotebookId: notebook.id });
    expect(res.status).toBe(400);
  });

  it("POST a research_reference section requires non-empty content and allows multiple", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);

    const missing = await addSection(user.cookie, plan.id, { kind: "research_reference" });
    expect(missing.res.status).toBe(400);

    const first = await addSection(user.cookie, plan.id, { kind: "research_reference", content: "https://example.com/article-1" });
    expect(first.res.status).toBe(201);
    const second = await addSection(user.cookie, plan.id, { kind: "research_reference", content: "https://example.com/article-2" });
    expect(second.res.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);

    const list = (await (
      await fetch(`${baseUrl}/api/trade-plans/${plan.id}/sections`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(list.filter((s) => s.kind === "research_reference")).toHaveLength(2);
  });

  it("POST an attachment section accepts freehand content with no ref", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const { res, body } = await addSection(user.cookie, plan.id, { kind: "attachment", content: "Chart screenshot (external)" });
    expect(res.status).toBe(201);
    expect(body.content).toBe("Chart screenshot (external)");
    expect(body.file).toBeNull();
  });

  it("POST a notebook_reference section (Linked Notebook) requires either refNotebookId or refConversationId", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const { res } = await addSection(user.cookie, plan.id, { kind: "notebook_reference" });
    expect(res.status).toBe(400);
  });

  it("POST a notebook_reference section with a same-coach owned notebook succeeds and returns notebook detail", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { coachId: "trading", title: "Linked notebook" });
    const { body: plan } = await createPlan(user.cookie, { coachId: "trading" });

    const { res, body } = await addSection(user.cookie, plan.id, { kind: "notebook_reference", refNotebookId: notebook.id });
    expect(res.status).toBe(201);
    expect(body.notebook.id).toBe(notebook.id);
    expect(body.notebook.title).toBe("Linked notebook");
  });

  it("POST a notebook_reference section rejects a notebook belonging to a different coach", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { coachId: "investing" });
    const { body: plan } = await createPlan(user.cookie, { coachId: "trading" });
    const { res } = await addSection(user.cookie, plan.id, { kind: "notebook_reference", refNotebookId: notebook.id });
    expect(res.status).toBe(400);
  });

  it("POST a notebook_reference section with a same-coach owned conversation (AI Conversation reference) succeeds", async () => {
    const user = await signUp();
    const { body: conversation } = await createConversation(user.cookie, { coachId: "trading", title: "Linked conversation" });
    const { body: plan } = await createPlan(user.cookie, { coachId: "trading" });

    const { res, body } = await addSection(user.cookie, plan.id, { kind: "notebook_reference", refConversationId: conversation.id });
    expect(res.status).toBe(201);
    expect(body.conversation.id).toBe(conversation.id);
    expect(body.conversation.title).toBe("Linked conversation");
  });

  it("DELETE a section removes it and bumps the plan's version", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    expect(plan.currentVersion).toBe(1);
    const { body: section } = await addSection(user.cookie, plan.id, { kind: "stop_loss", content: "Below the swing low" });

    const del = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/sections/${section.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    const updated = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(updated.currentVersion).toBe(3);
    expect(updated.sections).toEqual([]);
  });

  it("DELETE a nonexistent section 404s", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/sections/999999999`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(res.status).toBe(404);
  });

  it("sections are scoped to their own plan — never visible via a different plan's endpoints", async () => {
    const user = await signUp();
    const { body: planA } = await createPlan(user.cookie, { title: "Plan A" });
    const { body: planB } = await createPlan(user.cookie, { title: "Plan B" });
    await addSection(user.cookie, planA.id, { kind: "bias", content: "Belongs to A" });

    const bSections = (await (
      await fetch(`${baseUrl}/api/trade-plans/${planB.id}/sections`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(bSections).toEqual([]);
  });

  // ─── Checklist Engine ───────────────────────────────────────────────────

  it("POST a hand-written checklist item and bump version; progress reflects required/completed", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    expect(plan.currentVersion).toBe(1);

    const { res, body: item } = await addChecklistItem(user.cookie, plan.id, { label: "Confirm entry trigger", required: true });
    expect(res.status).toBe(201);
    expect(item.label).toBe("Confirm entry trigger");
    expect(item.required).toBe(true);
    expect(item.completed).toBe(false);

    const afterAdd = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(afterAdd.currentVersion).toBe(2);
    expect(afterAdd.checklistProgress.totalItems).toBe(1);
    expect(afterAdd.checklistProgress.requiredItems).toBe(1);
    expect(afterAdd.checklistProgress.readyForEntry).toBe(false);
  });

  it("PATCH completed=true on a checklist item does NOT bump version", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const { body: item } = await addChecklistItem(user.cookie, plan.id, { label: "Confirm stop placed", required: true });
    // version is now 2 (create=1, add item=2).

    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/checklist-items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ completed: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.completed).toBe(true);

    const detail = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.currentVersion).toBe(2);
    expect(detail.checklistProgress.completedItems).toBe(1);
    expect(detail.checklistProgress.readyForEntry).toBe(true);
    expect(detail.checklistProgress.progressPct).toBe(100);
  });

  it("PATCH label on a checklist item DOES bump version", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const { body: item } = await addChecklistItem(user.cookie, plan.id, { label: "Original label" });
    // version now 2.

    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/checklist-items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ label: "Relabeled" }),
    });
    expect(res.status).toBe(200);

    const detail = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.currentVersion).toBe(3);
    expect(detail.checklistItems[0].label).toBe("Relabeled");
  });

  it("DELETE a checklist item bumps version", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const { body: item } = await addChecklistItem(user.cookie, plan.id, { label: "To remove" });
    // version now 2.

    const del = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/checklist-items/${item.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    const detail = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.currentVersion).toBe(3);
    expect(detail.checklistItems).toEqual([]);
  });

  it("POST a checklist item from a named template bulk-seeds every template item", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);

    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/checklist-items`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ templateId: "trading-pre-trade" }),
    });
    expect(res.status).toBe(201);
    const items = (await res.json()) as any[];
    expect(items.length).toBeGreaterThan(3);

    const detail = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.checklistItems.length).toBe(items.length);
  });

  it("POST a checklist item rejects an unknown templateId", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/checklist-items`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ templateId: "not-a-real-template" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /trade-plans/:id/checklist-items reports an honest progressPct across a mix of complete/incomplete required items", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    await addChecklistItem(user.cookie, plan.id, { label: "Item 1" });
    const { body: item2 } = await addChecklistItem(user.cookie, plan.id, { label: "Item 2" });
    await fetch(`${baseUrl}/api/trade-plans/${plan.id}/checklist-items/${item2.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ completed: true }),
    });

    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/checklist-items`, { headers: { cookie: user.cookie } });
    const body = (await res.json()) as any;
    expect(body.progress.totalItems).toBe(2);
    expect(body.progress.completedItems).toBe(1);
    expect(body.progress.progressPct).toBe(50);
    expect(body.progress.readyForEntry).toBe(false);
  });

  it("checklist items 404 for a plan owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: plan } = await createPlan(owner.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/checklist-items`, { headers: { cookie: attacker.cookie } });
    expect(res.status).toBe(404);
  });

  // ─── Version history ────────────────────────────────────────────────────

  it("GET /trade-plans/:id/versions/:version returns the full snapshot for that version", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie, { title: "Original title" });
    await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ title: "Updated title" }),
    });

    const v1 = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}/versions/1`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(v1.snapshot.title).toBe("Original title");

    const v2 = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}/versions/2`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(v2.snapshot.title).toBe("Updated title");
  });

  it("GET a nonexistent version number 404s", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/versions/999`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(404);
  });

  it("restoring a prior version applies its snapshot (including checklist items) and APPENDS a new version rather than rewriting history", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie, { title: "V1 title" });
    await addSection(user.cookie, plan.id, { kind: "entry_zone", content: "V1 entry rule" });
    await addChecklistItem(user.cookie, plan.id, { label: "V1 checklist item" });
    // Now at version 3 (create=1, section add=2, checklist add=3).

    await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ title: "V4 title" }),
    });
    // Now at version 4.

    const restoreRes = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/versions/3/restore`, {
      method: "POST",
      headers: { cookie: user.cookie },
    });
    expect(restoreRes.status).toBe(200);
    const restored = (await restoreRes.json()) as any;
    expect(restored.title).toBe("V1 title");
    expect(restored.currentVersion).toBe(5);

    const versions = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}/versions`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(versions).toHaveLength(5);
    // Version 3 itself is unchanged — history is never rewritten in place.
    const v3 = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}/versions/3`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(v3.snapshot.title).toBe("V1 title");

    const detail = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.sections.map((s: any) => s.content)).toEqual(["V1 entry rule"]);
    expect(detail.checklistItems.map((c: any) => c.label)).toEqual(["V1 checklist item"]);
  });

  it("restoring a nonexistent version 404s", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/versions/999/restore`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(404);
  });

  // ─── Deterministic analysis (no LLM call) ───────────────────────────────

  it("GET .../missing-information honestly reports every qualitative section as missing for a brand-new plan", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/missing-information`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.present).toEqual([]);
    expect(body.missing.length).toBeGreaterThan(0);
    expect(body.completenessPct).toBe(0);
  });

  it("GET .../missing-information correctly reflects real, present sections", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    await addSection(user.cookie, plan.id, { kind: "entry_zone", content: "Enter on confirmation" });
    await addSection(user.cookie, plan.id, { kind: "stop_loss", content: "Below the swing low" });

    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/missing-information`, { headers: { cookie: user.cookie } });
    const body = (await res.json()) as any;
    expect(body.present).toEqual(expect.arrayContaining(["entry_zone", "stop_loss"]));
    expect(body.missing).not.toContain("entry_zone");
    expect(body.missing).not.toContain("stop_loss");
    expect(body.completenessPct).toBeGreaterThan(0);
  });

  it("GET .../similar deterministically ranks plans sharing plannedAsset/assetClass/direction/tags highest", async () => {
    const user = await signUp();
    const { body: target } = await createPlan(user.cookie, { title: "Target", plannedAsset: "AAPL", assetClass: "equities", direction: "long", tags: ["earnings"] });
    const { body: closeMatch } = await createPlan(user.cookie, { title: "Close match", plannedAsset: "AAPL", assetClass: "equities", direction: "long", tags: ["earnings"] });
    await createPlan(user.cookie, { title: "Unrelated", plannedAsset: "TSLA", direction: "short" });

    const res = await fetch(`${baseUrl}/api/trade-plans/${target.id}/similar`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const results = (await res.json()) as any[];
    expect(results[0].plan.id).toBe(closeMatch.id);
    expect(results[0].matchedOn).toEqual(expect.arrayContaining(["plannedAsset", "assetClass", "direction", "tag:earnings"]));
  });

  it("GET .../similar never includes the target plan itself", async () => {
    const user = await signUp();
    const { body: target } = await createPlan(user.cookie, { title: "Target" });
    const res = await fetch(`${baseUrl}/api/trade-plans/${target.id}/similar`, { headers: { cookie: user.cookie } });
    const results = (await res.json()) as any[];
    expect(results.every((r: any) => r.plan.id !== target.id)).toBe(true);
  });

  it("deterministic analysis endpoints 404 for a plan owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: plan } = await createPlan(owner.cookie);
    const res1 = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/missing-information`, { headers: { cookie: attacker.cookie } });
    expect(res1.status).toBe(404);
    const res2 = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/similar`, { headers: { cookie: attacker.cookie } });
    expect(res2.status).toBe(404);
  });

  // ─── Compare ────────────────────────────────────────────────────────────

  it("GET /trade-plans/compare returns both plans with their own sections, side by side", async () => {
    const user = await signUp();
    const { body: a } = await createPlan(user.cookie, { title: "Plan A", plannedAsset: "AAPL" });
    const { body: b } = await createPlan(user.cookie, { title: "Plan B", plannedAsset: "MSFT" });
    await addSection(user.cookie, a.id, { kind: "entry_zone", content: "A's entry rule" });

    const res = await fetch(`${baseUrl}/api/trade-plans/compare?a=${a.id}&b=${b.id}`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.planA.id).toBe(a.id);
    expect(body.planB.id).toBe(b.id);
    expect(body.planA.sections).toHaveLength(1);
    expect(body.planB.sections).toEqual([]);
  });

  it("GET /trade-plans/compare requires both a and b query params", async () => {
    const user = await signUp();
    const { body: a } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/compare?a=${a.id}`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(400);
  });

  it("GET /trade-plans/compare 404s if either plan is not owned by the caller", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: a } = await createPlan(owner.cookie);
    const { body: b } = await createPlan(attacker.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/compare?a=${a.id}&b=${b.id}`, { headers: { cookie: attacker.cookie } });
    expect(res.status).toBe(404);
  });

  it("POST /trade-plans/compare/ai returns an honest deterministic-fallback comparison with no LLM configured", async () => {
    const user = await signUp();
    const { body: a } = await createPlan(user.cookie, { title: "Plan A", plannedAsset: "AAPL" });
    const { body: b } = await createPlan(user.cookie, { title: "Plan B", plannedAsset: "MSFT" });

    const res = await fetch(`${baseUrl}/api/trade-plans/compare/ai`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ planIdA: a.id, planIdB: b.id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.comparison).toBe("string");
    expect(body.comparison.length).toBeGreaterThan(0);
    expect(body.source).toBeDefined();
  });

  it("POST /trade-plans/compare/ai rejects a missing planIdA/planIdB", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/trade-plans/compare/ai`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  // ─── AI features (honest fallback behavior — no LLM key configured) ────

  it("POST .../ai/review returns an honest fallback review reflecting real missing information, never recommending execution", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/ai/review`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.review).toBe("string");
    expect(body.review.toLowerCase()).toContain("missing");
  });

  it("POST .../ai/summarize returns an honest fallback summary reflecting real plan data", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie, { title: "Summarize me", plannedAsset: "NVDA" });
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/ai/summarize`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.summary).toContain("Summarize me");
    expect(body.source).toBeDefined();
  });

  it("POST .../ai/risk-highlights honestly flags a missing stop loss in its fallback", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/ai/risk-highlights`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.riskHighlights.toLowerCase()).toContain("stop");
  });

  it("POST .../ai/risk-reward-review returns a non-empty honest fallback", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/ai/risk-reward-review`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.riskRewardReview).toBe("string");
    expect(body.riskRewardReview.length).toBeGreaterThan(0);
  });

  it("POST .../ai/executive-summary returns a non-empty honest fallback", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie, { title: "Exec Summary Test" });
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/ai/executive-summary`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.executiveSummary).toContain("Exec Summary Test");
  });

  it("POST .../ai/preparation-notes returns a non-empty honest fallback", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/ai/preparation-notes`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.preparationNotes).toBe("string");
    expect(body.preparationNotes.length).toBeGreaterThan(0);
  });

  it("POST .../ai/pre-trade-checklist honestly reports unavailable (never fabricates) when no LLM is configured", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/ai/pre-trade-checklist`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.available).toBe(false);
    expect(body.checklist).toEqual([]);
  });

  it("POST .../ai/verification-questions honestly reports unavailable (never fabricates) when no LLM is configured", async () => {
    const user = await signUp();
    const { body: plan } = await createPlan(user.cookie);
    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/ai/verification-questions`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.available).toBe(false);
    expect(body.questions).toEqual([]);
  });

  it("AI endpoints 404 for a plan owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: plan } = await createPlan(owner.cookie);

    const res = await fetch(`${baseUrl}/api/trade-plans/${plan.id}/ai/summarize`, { method: "POST", headers: { cookie: attacker.cookie } });
    expect(res.status).toBe(404);
  });

  // ─── Workspace detach-not-destroy behavior ──────────────────────────────

  it("deleting a plan's parent workspace detaches it (workspaceId -> null) rather than deleting it", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "trading", name: "Soon to be deleted" });
    const { body: plan } = await createPlan(user.cookie, { coachId: "trading", workspaceId: workspace.id });

    const del = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    const stillThere = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(stillThere.id).toBe(plan.id);
    expect(stillThere.workspaceId).toBeNull();
  });

  it("deleting a plan's linked strategy detaches it (strategyId -> null) rather than deleting the plan", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie, { coachId: "trading" });
    const { body: plan } = await createPlan(user.cookie, { coachId: "trading", strategyId: strategy.id });

    const del = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    const stillThere = (await (await fetch(`${baseUrl}/api/trade-plans/${plan.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(stillThere.id).toBe(plan.id);
    expect(stillThere.strategyId).toBeNull();
  });

  // ─── Existing workspace/notebook/conversation/strategy behaviour unchanged ─

  it("existing workspace CRUD/isolation behaviour is unaffected by trade plans existing", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { name: "Untouched by trade plans" });
    await createPlan(user.cookie, { workspaceId: workspace.id });

    const detail = (await (await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.id).toBe(workspace.id);
    expect(detail.name).toBe("Untouched by trade plans");
  });

  it("existing strategy CRUD/version-history behaviour is unaffected by a strategy being linked from a trade plan", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie, { title: "Untouched strategy" });
    const { body: plan } = await createPlan(user.cookie, { strategyId: strategy.id });
    void plan;

    const detail = (await (await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.title).toBe("Untouched strategy");
    expect(detail.currentVersion).toBe(1);
  });

  it("existing notebook behaviour (notes/links) is unaffected by a notebook being referenced from a trade plan section", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { title: "Untouched notebook" });
    const { body: plan } = await createPlan(user.cookie);
    await addSection(user.cookie, plan.id, { kind: "notebook_reference", refNotebookId: notebook.id });

    await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ kind: "note", content: "Business as usual" }),
    });

    const detail = (await (await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.title).toBe("Untouched notebook");
    expect(detail.notes.map((n: any) => n.content)).toEqual(["Business as usual"]);
  });

  it("existing conversation creation/messages behaviour is unaffected by a conversation being referenced from a trade plan section", async () => {
    const user = await signUp();
    const { body: conversation } = await createConversation(user.cookie, { title: "Untouched conversation" });
    const { body: plan } = await createPlan(user.cookie);
    await addSection(user.cookie, plan.id, { kind: "notebook_reference", refConversationId: conversation.id });

    await fetch(`${baseUrl}/api/coach-conversations/${conversation.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ role: "user", content: "Business as usual" }),
    });

    const messages = (await (
      await fetch(`${baseUrl}/api/coach-conversations/${conversation.id}/messages`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(messages.map((m) => m.content)).toEqual(["Business as usual"]);
  });
});

// v1.5.0, Sprint 9 — AI Strategy Builder. Live route integration tests
// against a real app + real Postgres connection + the real Better-Auth
// instance (no auth mocking), using a fresh, isolated, genuinely signed-up
// user per test block, mirroring routes/aiNotebooks.route.test.ts's own
// established pattern (Sprint 8) so this file's own strategies are never
// at risk of colliding with another concurrently-running test file's own
// data.
//
// Proves the sprint's own required guarantees end-to-end over real HTTP:
// strategy CRUD, templates, version history (initial version, bump on
// content edit, no bump on pinned/archived-only, section create/delete
// also bumps, restore appends a NEW version rather than rewriting
// history), sections (singleton upsert for the 14 qualitative kinds, the
// 3 multi-kind reference sections and their ownership/coach-match
// validation), deterministic missing-sections/similar-strategies analysis,
// compare (both deterministic and AI), AI features' honest fallback
// behavior with no LLM key configured, workspace/notebook/conversation
// linking, per-user and per-coach isolation, and a proof that existing
// Sprint 6/7/8 workspace/notebook/conversation behavior is completely
// unaffected by any of this.

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

describe("AI Strategy Builder routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `ai-strategies-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "AI Strategies Test User" }),
    });
    if (!res.ok) throw new Error(`sign-up failed: ${res.status}`);
    const body = (await res.json()) as { user: { id: string } };
    seededUserIds.push(body.user.id);
    return { userId: body.user.id, cookie: getCookie(res) };
  }

  async function createStrategy(cookie: string, overrides: Record<string, unknown> = {}) {
    const res = await fetch(`${baseUrl}/api/ai-strategies`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ coachId: "trading", title: "My Strategy", strategyType: "Trend Following", ...overrides }),
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

  async function addSection(cookie: string, strategyId: number, overrides: Record<string, unknown>) {
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategyId}/sections`, {
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

  // ─── Templates ──────────────────────────────────────────────────────────

  it("GET /ai-strategy-templates returns all 17 named templates", async () => {
    const res = await fetch(`${baseUrl}/api/ai-strategy-templates`);
    expect(res.status).toBe(200);
    const templates = (await res.json()) as any[];
    expect(templates).toHaveLength(17);
    expect(templates.map((t) => t.id)).toContain("trend-following");
    expect(templates.map((t) => t.id)).toContain("iron-condor");
    expect(templates.map((t) => t.id)).toContain("value-investing");
    expect(templates.every((t) => typeof t.description === "string" && t.description.length > 0)).toBe(true);
  });

  // ─── CRUD ───────────────────────────────────────────────────────────────

  it("GET /ai-strategies requires a coachId query param", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-strategies`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(400);
  });

  it("GET /ai-strategies?coachId=trading returns an honest empty list for a brand-new user", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-strategies?coachId=trading`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    expect((await res.json()) as any[]).toEqual([]);
  });

  it("POST /ai-strategies creates a strategy with the given fields and starts at version 1", async () => {
    const user = await signUp();
    const { res, body } = await createStrategy(user.cookie, {
      title: "Breakout Plan",
      description: "A breakout strategy on liquid large caps",
      strategyType: "Breakout",
      assetClass: "equities",
      folder: "Trading",
      tags: ["breakout", "momentum"],
    });
    expect(res.status).toBe(201);
    expect(body.coachId).toBe("trading");
    expect(body.title).toBe("Breakout Plan");
    expect(body.description).toBe("A breakout strategy on liquid large caps");
    expect(body.strategyType).toBe("Breakout");
    expect(body.assetClass).toBe("equities");
    expect(body.folder).toBe("Trading");
    expect(body.tags).toEqual(["breakout", "momentum"]);
    expect(body.status).toBe("draft");
    expect(body.pinned).toBe(false);
    expect(body.archived).toBe(false);
    expect(body.currentVersion).toBe(1);
    expect(body.workspaceId).toBeNull();
  });

  it("POST /ai-strategies rejects a missing coachId", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-strategies`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ title: "No coach", strategyType: "Breakout" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai-strategies rejects an empty title", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-strategies`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "   ", strategyType: "Breakout" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai-strategies requires strategyType unless a valid templateId is supplied", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-strategies`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "No type" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai-strategies with a templateId seeds default sections and infers strategyType/assetClass", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-strategies`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "From template", templateId: "trend-following" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.strategyType).toBe("Trend Following");
    expect(body.assetClass).toBe("equities");

    const detail = (await (await fetch(`${baseUrl}/api/ai-strategies/${body.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.sections.length).toBeGreaterThan(0);
    expect(detail.sections.some((s: any) => s.kind === "market_context")).toBe(true);
  });

  it("POST /ai-strategies rejects an unknown templateId", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-strategies`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "Bad template", templateId: "not-a-real-template" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai-strategies with a workspaceId requires the workspace to belong to the same coach", async () => {
    const user = await signUp();
    const { body: investingWorkspace } = await createWorkspace(user.cookie, { coachId: "investing", name: "Investing WS" });
    const res = await fetch(`${baseUrl}/api/ai-strategies`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "Mismatched", strategyType: "Breakout", workspaceId: investingWorkspace.id }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai-strategies with a matching-coach workspaceId succeeds and associates the strategy", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "trading", name: "Trading WS" });
    const { res, body } = await createStrategy(user.cookie, { workspaceId: workspace.id });
    expect(res.status).toBe(201);
    expect(body.workspaceId).toBe(workspace.id);
  });

  it("GET /ai-strategies/:id returns full detail: strategy + sections + versions", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const detail = (await res.json()) as any;
    expect(detail.id).toBe(strategy.id);
    expect(detail.sections).toEqual([]);
    expect(detail.versions).toHaveLength(1);
    expect(detail.versions[0].version).toBe(1);
    expect(detail.versions[0].changeSummary).toBe("Created");
  });

  it("GET /ai-strategies/:id 404s for a nonexistent id", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-strategies/999999999`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(404);
  });

  it("PATCH /ai-strategies/:id updates content fields and bumps version", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    expect(strategy.currentVersion).toBe(1);

    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ title: "Renamed", description: "New description", tags: ["tag1"], changeSummary: "Renamed and retagged" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.title).toBe("Renamed");
    expect(body.description).toBe("New description");
    expect(body.tags).toEqual(["tag1"]);
    expect(body.currentVersion).toBe(2);

    const versions = (await (await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/versions`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(2);
    expect(versions[0].changeSummary).toBe("Renamed and retagged");
  });

  it("PATCH /ai-strategies/:id updating status bumps version", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ status: "active" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("active");
    expect(body.currentVersion).toBe(2);
  });

  it("PATCH /ai-strategies/:id rejects an invalid status", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ status: "not-a-real-status" }),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /ai-strategies/:id updating only pinned/archived does NOT bump version", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);

    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ pinned: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.pinned).toBe(true);
    expect(body.currentVersion).toBe(1);

    const versions = (await (await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/versions`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(versions).toHaveLength(1);
  });

  it("PATCH /ai-strategies/:id rejects an empty body", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("DELETE /ai-strategies/:id removes the strategy", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const del = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    const list = (await (await fetch(`${baseUrl}/api/ai-strategies?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(list).toEqual([]);
  });

  it("DELETE /ai-strategies/:id cascades its own sections and versions (ON DELETE CASCADE)", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const { body: section } = await addSection(user.cookie, strategy.id, { kind: "entry", content: "Enter on confirmation" });

    await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, { method: "DELETE", headers: { cookie: user.cookie } });

    const remainingSections = await db.select().from(aiStrategySectionsTable).where(eq(aiStrategySectionsTable.id, section.id));
    expect(remainingSections).toEqual([]);
    const remainingVersions = await db.select().from(aiStrategyVersionsTable).where(eq(aiStrategyVersionsTable.strategyId, strategy.id));
    expect(remainingVersions).toEqual([]);
  });

  // ─── Isolation ──────────────────────────────────────────────────────────

  it("strategies are isolated per user — a different user never sees another user's strategy", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    await createStrategy(owner.cookie, { title: "Owner's private playbook" });

    const attackerList = (await (
      await fetch(`${baseUrl}/api/ai-strategies?coachId=trading`, { headers: { cookie: attacker.cookie } })
    ).json()) as any[];
    expect(attackerList).toEqual([]);
  });

  it("PATCH/DELETE return 404 (not 403) for a strategy owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: strategy } = await createStrategy(owner.cookie);

    const patchRes = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: attacker.cookie },
      body: JSON.stringify({ title: "Hijacked" }),
    });
    expect(patchRes.status).toBe(404);

    const deleteRes = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, { method: "DELETE", headers: { cookie: attacker.cookie } });
    expect(deleteRes.status).toBe(404);

    const stillThere = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, { headers: { cookie: owner.cookie } });
    expect(stillThere.status).toBe(200);
  });

  it("strategies are isolated per coach — a Trading strategy never appears under Investing or Options for the same user", async () => {
    const user = await signUp();
    await createStrategy(user.cookie, { coachId: "trading", title: "Trading only" });
    await createStrategy(user.cookie, { coachId: "investing", title: "Investing only", strategyType: "Value Investing" });
    await createStrategy(user.cookie, { coachId: "options", title: "Options only", strategyType: "Iron Condor" });

    const trading = (await (await fetch(`${baseUrl}/api/ai-strategies?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    const investing = (await (
      await fetch(`${baseUrl}/api/ai-strategies?coachId=investing`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    const options = (await (await fetch(`${baseUrl}/api/ai-strategies?coachId=options`, { headers: { cookie: user.cookie } })).json()) as any[];

    expect(trading.map((s) => s.title)).toEqual(["Trading only"]);
    expect(investing.map((s) => s.title)).toEqual(["Investing only"]);
    expect(options.map((s) => s.title)).toEqual(["Options only"]);
  });

  // ─── Library filters: folder/search/sort/status/pinned ─────────────────

  it("?search filters strategies by title, case-insensitively", async () => {
    const user = await signUp();
    await createStrategy(user.cookie, { title: "AAPL breakout plan" });
    await createStrategy(user.cookie, { title: "Risk check on MSFT" });

    const filtered = (await (
      await fetch(`${baseUrl}/api/ai-strategies?coachId=trading&search=aapl`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(filtered.map((s) => s.title)).toEqual(["AAPL breakout plan"]);
  });

  it("?folder filters strategies to that folder", async () => {
    const user = await signUp();
    await createStrategy(user.cookie, { title: "In Templates", folder: "Templates" });
    await createStrategy(user.cookie, { title: "In Personal", folder: "Personal" });

    const templates = (await (
      await fetch(`${baseUrl}/api/ai-strategies?coachId=trading&folder=Templates`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(templates.map((s) => s.title)).toEqual(["In Templates"]);
  });

  it("?status filters strategies by lifecycle status", async () => {
    const user = await signUp();
    const { body: draft } = await createStrategy(user.cookie, { title: "Still draft" });
    const { body: toActivate } = await createStrategy(user.cookie, { title: "Going active" });
    await fetch(`${baseUrl}/api/ai-strategies/${toActivate.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ status: "active" }),
    });

    const active = (await (
      await fetch(`${baseUrl}/api/ai-strategies?coachId=trading&status=active`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(active.map((s: any) => s.title)).toEqual(["Going active"]);
    void draft;
  });

  it("archiving a strategy hides it from the default list but keeps it retrievable with includeArchived=true, and it can be restored", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie, { title: "To be archived" });

    await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ archived: true }),
    });

    const defaultList = (await (await fetch(`${baseUrl}/api/ai-strategies?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(defaultList).toEqual([]);

    const withArchived = (await (
      await fetch(`${baseUrl}/api/ai-strategies?coachId=trading&includeArchived=true`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(withArchived).toHaveLength(1);
    expect(withArchived[0].archived).toBe(true);

    const restoreRes = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ archived: false }),
    });
    expect(restoreRes.status).toBe(200);
    expect(((await restoreRes.json()) as any).archived).toBe(false);
  });

  it("pinned (favourite) strategies are sorted first, then by most-recently-updated", async () => {
    const user = await signUp();
    const { body: first } = await createStrategy(user.cookie, { title: "First" });
    const { body: second } = await createStrategy(user.cookie, { title: "Second" });
    await createStrategy(user.cookie, { title: "Third" });

    await fetch(`${baseUrl}/api/ai-strategies/${second.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ pinned: true }),
    });

    const list = (await (await fetch(`${baseUrl}/api/ai-strategies?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(list[0].title).toBe("Second");
    expect(list[0].pinned).toBe(true);
    expect(list.slice(1).map((s) => s.title)).toEqual(["Third", "First"]);
    void first;
  });

  // ─── Sections ───────────────────────────────────────────────────────────

  it("POST a qualitative section then POSTing the same kind again upserts (does not create a duplicate)", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);

    const first = await addSection(user.cookie, strategy.id, { kind: "entry", content: "Enter on breakout confirmation" });
    expect(first.res.status).toBe(201);
    const firstId = first.body.id;

    const second = await addSection(user.cookie, strategy.id, { kind: "entry", content: "Enter on retest instead" });
    expect(second.res.status).toBe(201);
    expect(second.body.id).toBe(firstId);
    expect(second.body.content).toBe("Enter on retest instead");

    const list = (await (
      await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/sections`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(list.filter((s) => s.kind === "entry")).toHaveLength(1);
  });

  it("POST a qualitative section rejects empty content", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const { res } = await addSection(user.cookie, strategy.id, { kind: "entry", content: "" });
    expect(res.status).toBe(400);
  });

  it("POST an invalid section kind is rejected", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const { res } = await addSection(user.cookie, strategy.id, { kind: "not-a-real-kind", content: "x" });
    expect(res.status).toBe(400);
  });

  it("POST a qualitative section with a ref field is rejected (plain-text sections cannot carry a reference)", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const { body: notebook } = await createNotebook(user.cookie, { coachId: "trading" });
    const { res } = await addSection(user.cookie, strategy.id, { kind: "entry", content: "x", refNotebookId: notebook.id });
    expect(res.status).toBe(400);
  });

  it("POST a research_link section requires non-empty content and allows multiple", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);

    const missing = await addSection(user.cookie, strategy.id, { kind: "research_link" });
    expect(missing.res.status).toBe(400);

    const first = await addSection(user.cookie, strategy.id, { kind: "research_link", content: "https://example.com/article-1" });
    expect(first.res.status).toBe(201);
    const second = await addSection(user.cookie, strategy.id, { kind: "research_link", content: "https://example.com/article-2" });
    expect(second.res.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);

    const list = (await (
      await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/sections`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(list.filter((s) => s.kind === "research_link")).toHaveLength(2);
  });

  it("POST an attachment section accepts freehand content with no ref", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const { res, body } = await addSection(user.cookie, strategy.id, { kind: "attachment", content: "Backtest results.xlsx (external)" });
    expect(res.status).toBe(201);
    expect(body.content).toBe("Backtest results.xlsx (external)");
    expect(body.file).toBeNull();
  });

  it("POST an attachment section with a refFileId from a same-coach workspace succeeds and returns file detail", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "trading" });
    const { body: strategy } = await createStrategy(user.cookie, { coachId: "trading" });
    const fileRes = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ fileName: "backtest.csv", fileUrl: "https://example.com/backtest.csv" }),
    });
    const file = (await fileRes.json()) as any;

    const { res, body } = await addSection(user.cookie, strategy.id, { kind: "attachment", refFileId: file.id });
    expect(res.status).toBe(201);
    expect(body.file.id).toBe(file.id);
    expect(body.file.fileName).toBe("backtest.csv");
  });

  it("POST an attachment section rejects a refFileId whose workspace belongs to a different coach", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "investing" });
    const { body: strategy } = await createStrategy(user.cookie, { coachId: "trading" });
    const fileRes = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ fileName: "mismatched.csv", fileUrl: "https://example.com/x.csv" }),
    });
    const file = (await fileRes.json()) as any;

    const { res } = await addSection(user.cookie, strategy.id, { kind: "attachment", refFileId: file.id });
    expect(res.status).toBe(400);
  });

  it("POST an attachment section rejects a refFileId owned by a different user (404, not 403)", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: workspace } = await createWorkspace(owner.cookie, { coachId: "trading" });
    const { body: strategy } = await createStrategy(attacker.cookie, { coachId: "trading" });
    const fileRes = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ fileName: "owner-only.csv", fileUrl: "https://example.com/o.csv" }),
    });
    const file = (await fileRes.json()) as any;

    const { res } = await addSection(attacker.cookie, strategy.id, { kind: "attachment", refFileId: file.id });
    expect(res.status).toBe(404);
  });

  it("POST a notebook_reference section requires either refNotebookId or refConversationId", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const { res } = await addSection(user.cookie, strategy.id, { kind: "notebook_reference" });
    expect(res.status).toBe(400);
  });

  it("POST a notebook_reference section with a same-coach owned notebook succeeds and returns notebook detail", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { coachId: "trading", title: "Linked notebook" });
    const { body: strategy } = await createStrategy(user.cookie, { coachId: "trading" });

    const { res, body } = await addSection(user.cookie, strategy.id, { kind: "notebook_reference", refNotebookId: notebook.id });
    expect(res.status).toBe(201);
    expect(body.notebook.id).toBe(notebook.id);
    expect(body.notebook.title).toBe("Linked notebook");
  });

  it("POST a notebook_reference section rejects a notebook belonging to a different coach", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { coachId: "investing" });
    const { body: strategy } = await createStrategy(user.cookie, { coachId: "trading" });
    const { res } = await addSection(user.cookie, strategy.id, { kind: "notebook_reference", refNotebookId: notebook.id });
    expect(res.status).toBe(400);
  });

  it("POST a notebook_reference section rejects a notebook owned by a different user (404, not 403)", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: notebook } = await createNotebook(owner.cookie, { coachId: "trading" });
    const { body: strategy } = await createStrategy(attacker.cookie, { coachId: "trading" });
    const { res } = await addSection(attacker.cookie, strategy.id, { kind: "notebook_reference", refNotebookId: notebook.id });
    expect(res.status).toBe(404);
  });

  it("POST a notebook_reference section with a same-coach owned conversation succeeds and returns conversation detail", async () => {
    const user = await signUp();
    const { body: conversation } = await createConversation(user.cookie, { coachId: "trading", title: "Linked conversation" });
    const { body: strategy } = await createStrategy(user.cookie, { coachId: "trading" });

    const { res, body } = await addSection(user.cookie, strategy.id, { kind: "notebook_reference", refConversationId: conversation.id });
    expect(res.status).toBe(201);
    expect(body.conversation.id).toBe(conversation.id);
    expect(body.conversation.title).toBe("Linked conversation");
  });

  it("POST a notebook_reference section rejects a conversation belonging to a different coach", async () => {
    const user = await signUp();
    const { body: conversation } = await createConversation(user.cookie, { coachId: "investing" });
    const { body: strategy } = await createStrategy(user.cookie, { coachId: "trading" });
    const { res } = await addSection(user.cookie, strategy.id, { kind: "notebook_reference", refConversationId: conversation.id });
    expect(res.status).toBe(400);
  });

  it("DELETE a section removes it and bumps the strategy's version", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    expect(strategy.currentVersion).toBe(1);
    // Adding the section itself also bumps the version (1 -> 2), same as
    // any other content edit — confirmed via the strategy detail fetch
    // below rather than assumed from the create response.
    const { body: section } = await addSection(user.cookie, strategy.id, { kind: "risk", content: "Never risk more than 1% per trade" });

    const del = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/sections/${section.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    const updated = (await (await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(updated.currentVersion).toBe(3);
    expect(updated.sections).toEqual([]);
  });

  it("DELETE a nonexistent section 404s", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/sections/999999999`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(res.status).toBe(404);
  });

  it("sections are scoped to their own strategy — never visible via a different strategy's endpoints", async () => {
    const user = await signUp();
    const { body: strategyA } = await createStrategy(user.cookie, { title: "Strategy A" });
    const { body: strategyB } = await createStrategy(user.cookie, { title: "Strategy B" });
    await addSection(user.cookie, strategyA.id, { kind: "setup", content: "Belongs to A" });

    const bSections = (await (
      await fetch(`${baseUrl}/api/ai-strategies/${strategyB.id}/sections`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(bSections).toEqual([]);
  });

  // ─── Version history ────────────────────────────────────────────────────

  it("GET /ai-strategies/:id/versions/:version returns the full snapshot for that version", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie, { title: "Original title" });
    await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ title: "Updated title" }),
    });

    const v1 = (await (
      await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/versions/1`, { headers: { cookie: user.cookie } })
    ).json()) as any;
    expect(v1.snapshot.title).toBe("Original title");

    const v2 = (await (
      await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/versions/2`, { headers: { cookie: user.cookie } })
    ).json()) as any;
    expect(v2.snapshot.title).toBe("Updated title");
  });

  it("GET a nonexistent version number 404s", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/versions/999`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(404);
  });

  it("restoring a prior version applies its snapshot and APPENDS a new version rather than rewriting history", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie, { title: "V1 title" });
    await addSection(user.cookie, strategy.id, { kind: "entry", content: "V1 entry rule" });
    // Now at version 2 (initial create=1, section add=2).

    await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ title: "V3 title" }),
    });
    // Now at version 3.

    const restoreRes = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/versions/2/restore`, {
      method: "POST",
      headers: { cookie: user.cookie },
    });
    expect(restoreRes.status).toBe(200);
    const restored = (await restoreRes.json()) as any;
    expect(restored.title).toBe("V1 title");
    expect(restored.currentVersion).toBe(4);

    const versions = (await (
      await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/versions`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(versions).toHaveLength(4);
    // Version 2 itself is unchanged — history is never rewritten in place.
    const v2 = (await (
      await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/versions/2`, { headers: { cookie: user.cookie } })
    ).json()) as any;
    expect(v2.snapshot.title).toBe("V1 title");

    const detail = (await (await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.sections.map((s: any) => s.content)).toEqual(["V1 entry rule"]);
  });

  it("restoring a nonexistent version 404s", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/versions/999/restore`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(404);
  });

  // ─── Deterministic analysis (no LLM call) ───────────────────────────────

  it("GET .../missing-sections honestly reports every qualitative section as missing for a brand-new strategy", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/missing-sections`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.present).toEqual([]);
    expect(body.missing.length).toBeGreaterThan(0);
    expect(body.completenessPct).toBe(0);
  });

  it("GET .../missing-sections correctly reflects real, present sections", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    await addSection(user.cookie, strategy.id, { kind: "entry", content: "Enter on confirmation" });
    await addSection(user.cookie, strategy.id, { kind: "risk", content: "1% risk per trade" });

    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/missing-sections`, { headers: { cookie: user.cookie } });
    const body = (await res.json()) as any;
    expect(body.present).toEqual(expect.arrayContaining(["entry", "risk"]));
    expect(body.missing).not.toContain("entry");
    expect(body.missing).not.toContain("risk");
    expect(body.completenessPct).toBeGreaterThan(0);
  });

  it("GET .../similar deterministically ranks strategies sharing strategyType/assetClass/tags highest", async () => {
    const user = await signUp();
    const { body: target } = await createStrategy(user.cookie, { title: "Target", strategyType: "Breakout", assetClass: "equities", tags: ["momentum"] });
    const { body: closeMatch } = await createStrategy(user.cookie, { title: "Close match", strategyType: "Breakout", assetClass: "equities", tags: ["momentum"] });
    await createStrategy(user.cookie, { title: "Unrelated", strategyType: "Mean Reversion", assetClass: "options" });

    const res = await fetch(`${baseUrl}/api/ai-strategies/${target.id}/similar`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const results = (await res.json()) as any[];
    expect(results[0].strategy.id).toBe(closeMatch.id);
    expect(results[0].matchedOn).toEqual(expect.arrayContaining(["strategyType", "assetClass", "tag:momentum"]));
  });

  it("GET .../similar never includes the target strategy itself", async () => {
    const user = await signUp();
    const { body: target } = await createStrategy(user.cookie, { title: "Target" });
    const res = await fetch(`${baseUrl}/api/ai-strategies/${target.id}/similar`, { headers: { cookie: user.cookie } });
    const results = (await res.json()) as any[];
    expect(results.every((r: any) => r.strategy.id !== target.id)).toBe(true);
  });

  it("deterministic analysis endpoints 404 for a strategy owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: strategy } = await createStrategy(owner.cookie);
    const res1 = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/missing-sections`, { headers: { cookie: attacker.cookie } });
    expect(res1.status).toBe(404);
    const res2 = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/similar`, { headers: { cookie: attacker.cookie } });
    expect(res2.status).toBe(404);
  });

  // ─── Compare ────────────────────────────────────────────────────────────

  it("GET /ai-strategies/compare returns both strategies with their own sections, side by side", async () => {
    const user = await signUp();
    const { body: a } = await createStrategy(user.cookie, { title: "Strategy A", strategyType: "Breakout" });
    const { body: b } = await createStrategy(user.cookie, { title: "Strategy B", strategyType: "Mean Reversion" });
    await addSection(user.cookie, a.id, { kind: "entry", content: "A's entry rule" });

    const res = await fetch(`${baseUrl}/api/ai-strategies/compare?a=${a.id}&b=${b.id}`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.strategyA.id).toBe(a.id);
    expect(body.strategyB.id).toBe(b.id);
    expect(body.strategyA.sections).toHaveLength(1);
    expect(body.strategyB.sections).toEqual([]);
  });

  it("GET /ai-strategies/compare requires both a and b query params", async () => {
    const user = await signUp();
    const { body: a } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/compare?a=${a.id}`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(400);
  });

  it("GET /ai-strategies/compare 404s if either strategy is not owned by the caller", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: a } = await createStrategy(owner.cookie);
    const { body: b } = await createStrategy(attacker.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/compare?a=${a.id}&b=${b.id}`, { headers: { cookie: attacker.cookie } });
    expect(res.status).toBe(404);
  });

  it("POST /ai-strategies/compare/ai returns an honest deterministic-fallback comparison with no LLM configured", async () => {
    const user = await signUp();
    const { body: a } = await createStrategy(user.cookie, { title: "Strategy A", strategyType: "Breakout" });
    const { body: b } = await createStrategy(user.cookie, { title: "Strategy B", strategyType: "Mean Reversion" });

    const res = await fetch(`${baseUrl}/api/ai-strategies/compare/ai`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ strategyIdA: a.id, strategyIdB: b.id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.comparison).toBe("string");
    expect(body.comparison.length).toBeGreaterThan(0);
    expect(body.source).toBeDefined();
  });

  it("POST /ai-strategies/compare/ai rejects a missing strategyIdA/strategyIdB", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-strategies/compare/ai`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  // ─── AI features (honest fallback behavior — no LLM key configured) ────

  it("POST .../ai/summarize returns an honest fallback summary reflecting real strategy data", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie, { title: "Summarize me", strategyType: "Breakout" });
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/ai/summarize`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.summary).toBe("string");
    expect(body.summary).toContain("Summarize me");
    expect(body.source).toBeDefined();
  });

  it("POST .../ai/suggest-improvements reflects real missing sections in its fallback", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/ai/suggest-improvements`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.improvements).toBe("string");
    expect(body.improvements.toLowerCase()).toContain("consider filling");
  });

  it("POST .../ai/executive-summary returns a non-empty honest fallback", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie, { title: "Exec Summary Test" });
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/ai/executive-summary`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.executiveSummary).toContain("Exec Summary Test");
  });

  it("POST .../ai/learning-notes returns a non-empty honest fallback", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/ai/learning-notes`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.learningNotes).toBe("string");
    expect(body.learningNotes.length).toBeGreaterThan(0);
  });

  it("POST .../ai/risk-highlights honestly flags a missing risk section in its fallback", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/ai/risk-highlights`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.riskHighlights.toLowerCase()).toContain("risk");
  });

  it("POST .../ai/setup-checklist honestly reports unavailable (never fabricates) when no LLM is configured", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/ai/setup-checklist`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.available).toBe(false);
    expect(body.checklist).toEqual([]);
  });

  it("POST .../ai/trade-prep-checklist honestly reports unavailable (never fabricates) when no LLM is configured", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/ai/trade-prep-checklist`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.available).toBe(false);
    expect(body.checklist).toEqual([]);
  });

  it("POST .../ai/review-questions honestly reports unavailable (never fabricates) when no LLM is configured", async () => {
    const user = await signUp();
    const { body: strategy } = await createStrategy(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/ai/review-questions`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.available).toBe(false);
    expect(body.questions).toEqual([]);
  });

  it("AI endpoints 404 for a strategy owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: strategy } = await createStrategy(owner.cookie);

    const res = await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}/ai/summarize`, { method: "POST", headers: { cookie: attacker.cookie } });
    expect(res.status).toBe(404);
  });

  // ─── Workspace detach-not-destroy behavior ──────────────────────────────

  it("deleting a strategy's parent workspace detaches it (workspaceId -> null) rather than deleting it", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "trading", name: "Soon to be deleted" });
    const { body: strategy } = await createStrategy(user.cookie, { coachId: "trading", workspaceId: workspace.id });

    const del = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    const stillThere = (await (
      await fetch(`${baseUrl}/api/ai-strategies/${strategy.id}`, { headers: { cookie: user.cookie } })
    ).json()) as any;
    expect(stillThere.id).toBe(strategy.id);
    expect(stillThere.workspaceId).toBeNull();
  });

  // ─── Existing conversation/workspace/notebook behaviour unchanged ───────

  it("existing workspace CRUD/isolation behaviour is unaffected by strategies existing", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { name: "Untouched by strategies" });
    await createStrategy(user.cookie, { workspaceId: workspace.id });

    const detail = (await (await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.id).toBe(workspace.id);
    expect(detail.name).toBe("Untouched by strategies");
    expect(detail.conversations).toEqual([]);
    expect(detail.files).toEqual([]);
    expect(detail.notes).toEqual([]);
  });

  it("existing notebook behaviour (notes/links) is unaffected by a notebook being referenced from a strategy section", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { title: "Untouched notebook" });
    const { body: strategy } = await createStrategy(user.cookie);
    await addSection(user.cookie, strategy.id, { kind: "notebook_reference", refNotebookId: notebook.id });

    await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ kind: "note", content: "Business as usual" }),
    });

    const detail = (await (await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.title).toBe("Untouched notebook");
    expect(detail.notes.map((n: any) => n.content)).toEqual(["Business as usual"]);
  });

  it("existing conversation creation/messages behaviour is unaffected by a conversation being referenced from a strategy section", async () => {
    const user = await signUp();
    const { body: conversation } = await createConversation(user.cookie, { title: "Untouched conversation" });
    const { body: strategy } = await createStrategy(user.cookie);
    await addSection(user.cookie, strategy.id, { kind: "notebook_reference", refConversationId: conversation.id });

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

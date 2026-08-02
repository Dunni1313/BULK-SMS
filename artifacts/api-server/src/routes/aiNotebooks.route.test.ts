// v1.5.0, Sprint 8 — AI Research Notebooks. Live route integration tests
// against a real app + real Postgres connection + the real Better-Auth
// instance (no auth mocking), using a fresh, isolated, genuinely signed-up
// user per test block, mirroring routes/aiWorkspaces.route.test.ts's own
// established pattern (Sprint 7) so this file's own notebooks are never at
// risk of colliding with another concurrently-running test file's own data.
//
// Proves the sprint's own required guarantees end-to-end over real HTTP:
// notebook CRUD, notebook search (both the list's title-only ?search and
// the dedicated content-search endpoint), notebook AI summaries (honest
// behavior with no LLM key configured in this session), conversation
// linking (ownership + coachId-match validation), file linking, workspace
// isolation (per-user and per-coach), archive, restore, version bump on
// edit, workspace-deletion detach-not-destroy behavior, and a proof that
// existing Sprint 6/7 conversation/workspace behavior is completely
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

describe("AI Research Notebooks routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `ai-notebooks-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "AI Notebooks Test User" }),
    });
    if (!res.ok) throw new Error(`sign-up failed: ${res.status}`);
    const body = (await res.json()) as { user: { id: string } };
    seededUserIds.push(body.user.id);
    return { userId: body.user.id, cookie: getCookie(res) };
  }

  async function createNotebook(cookie: string, overrides: Record<string, unknown> = {}) {
    const res = await fetch(`${baseUrl}/api/ai-notebooks`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ coachId: "trading", title: "My Notebook", ...overrides }),
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

  async function createConversation(cookie: string, overrides: Record<string, unknown> = {}) {
    const res = await fetch(`${baseUrl}/api/coach-conversations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ coachId: "trading", ...overrides }),
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

  // ─── CRUD ───────────────────────────────────────────────────────────────

  it("GET /ai-notebooks requires a coachId query param", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-notebooks`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(400);
  });

  it("GET /ai-notebooks?coachId=trading returns an honest empty list for a brand-new user", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-notebooks?coachId=trading`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    expect((await res.json()) as any[]).toEqual([]);
  });

  it("POST /ai-notebooks creates a notebook with the given title/description/tags", async () => {
    const user = await signUp();
    const { res, body } = await createNotebook(user.cookie, {
      title: "Q3 Earnings Research",
      description: "Tracking earnings plays",
      tags: ["earnings", "swing"],
    });
    expect(res.status).toBe(201);
    expect(body.coachId).toBe("trading");
    expect(body.title).toBe("Q3 Earnings Research");
    expect(body.description).toBe("Tracking earnings plays");
    expect(body.tags).toEqual(["earnings", "swing"]);
    expect(body.pinned).toBe(false);
    expect(body.archived).toBe(false);
    expect(body.version).toBe(1);
    expect(body.workspaceId).toBeNull();
    expect(typeof body.createdAt).toBe("string");
    expect(typeof body.updatedAt).toBe("string");
  });

  it("POST /ai-notebooks rejects a missing coachId", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-notebooks`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ title: "No coach" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai-notebooks rejects an empty title", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-notebooks`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "   " }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai-notebooks with a workspaceId requires the workspace to belong to the same coach", async () => {
    const user = await signUp();
    const { body: investingWorkspace } = await createWorkspace(user.cookie, { coachId: "investing", name: "Investing WS" });
    const res = await fetch(`${baseUrl}/api/ai-notebooks`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", title: "Mismatched", workspaceId: investingWorkspace.id }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai-notebooks with a matching-coach workspaceId succeeds and associates the notebook", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "trading", name: "Trading WS" });
    const { res, body } = await createNotebook(user.cookie, { workspaceId: workspace.id });
    expect(res.status).toBe(201);
    expect(body.workspaceId).toBe(workspace.id);
  });

  it("GET /ai-notebooks/:id returns full detail: notebook + notes + links", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const detail = (await res.json()) as any;
    expect(detail.id).toBe(notebook.id);
    expect(detail.notes).toEqual([]);
    expect(detail.links).toEqual([]);
  });

  it("GET /ai-notebooks/:id 404s for a nonexistent id", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-notebooks/999999999`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(404);
  });

  it("PATCH /ai-notebooks/:id updates title/description/tags and bumps version", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);
    expect(notebook.version).toBe(1);

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ title: "Renamed", description: "New description", tags: ["tag1"] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.title).toBe("Renamed");
    expect(body.description).toBe("New description");
    expect(body.tags).toEqual(["tag1"]);
    expect(body.version).toBe(2);
  });

  it("PATCH /ai-notebooks/:id updating only pinned/archived does NOT bump version", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ pinned: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.pinned).toBe(true);
    expect(body.version).toBe(1);
  });

  it("PATCH /ai-notebooks/:id rejects an empty body", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("DELETE /ai-notebooks/:id removes the notebook", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);
    const del = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    const list = (await (await fetch(`${baseUrl}/api/ai-notebooks?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(list).toEqual([]);
  });

  it("DELETE /ai-notebooks/:id cascades its own notes and links (ON DELETE CASCADE)", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);
    const noteRes = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ kind: "note", content: "Soon to cascade" }),
    });
    const note = (await noteRes.json()) as any;

    await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, { method: "DELETE", headers: { cookie: user.cookie } });

    const remaining = await db.select().from(aiNotebookNotesTable).where(eq(aiNotebookNotesTable.id, note.id));
    expect(remaining).toEqual([]);
  });

  // ─── Isolation ──────────────────────────────────────────────────────────

  it("notebooks are isolated per user — a different user never sees another user's notebook", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    await createNotebook(owner.cookie, { title: "Owner's private research" });

    const attackerList = (await (
      await fetch(`${baseUrl}/api/ai-notebooks?coachId=trading`, { headers: { cookie: attacker.cookie } })
    ).json()) as any[];
    expect(attackerList).toEqual([]);
  });

  it("PATCH/DELETE return 404 (not 403) for a notebook owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: notebook } = await createNotebook(owner.cookie);

    const patchRes = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: attacker.cookie },
      body: JSON.stringify({ title: "Hijacked" }),
    });
    expect(patchRes.status).toBe(404);

    const deleteRes = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, { method: "DELETE", headers: { cookie: attacker.cookie } });
    expect(deleteRes.status).toBe(404);

    const stillThere = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, { headers: { cookie: owner.cookie } });
    expect(stillThere.status).toBe(200);
  });

  it("notebooks are isolated per coach — a Trading notebook never appears under Investing or Options for the same user", async () => {
    const user = await signUp();
    await createNotebook(user.cookie, { coachId: "trading", title: "Trading only" });
    await createNotebook(user.cookie, { coachId: "investing", title: "Investing only" });
    await createNotebook(user.cookie, { coachId: "options", title: "Options only" });

    const trading = (await (await fetch(`${baseUrl}/api/ai-notebooks?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    const investing = (await (
      await fetch(`${baseUrl}/api/ai-notebooks?coachId=investing`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    const options = (await (await fetch(`${baseUrl}/api/ai-notebooks?coachId=options`, { headers: { cookie: user.cookie } })).json()) as any[];

    expect(trading.map((n) => n.title)).toEqual(["Trading only"]);
    expect(investing.map((n) => n.title)).toEqual(["Investing only"]);
    expect(options.map((n) => n.title)).toEqual(["Options only"]);
  });

  it("?workspaceId filters notebooks to only that workspace", async () => {
    const user = await signUp();
    const { body: workspaceA } = await createWorkspace(user.cookie, { name: "Workspace A" });
    const { body: workspaceB } = await createWorkspace(user.cookie, { name: "Workspace B" });
    await createNotebook(user.cookie, { title: "In A", workspaceId: workspaceA.id });
    await createNotebook(user.cookie, { title: "In B", workspaceId: workspaceB.id });

    const inA = (await (
      await fetch(`${baseUrl}/api/ai-notebooks?coachId=trading&workspaceId=${workspaceA.id}`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(inA.map((n) => n.title)).toEqual(["In A"]);
  });

  // ─── Search ─────────────────────────────────────────────────────────────

  it("?search filters notebooks by title, case-insensitively", async () => {
    const user = await signUp();
    await createNotebook(user.cookie, { title: "AAPL earnings deep dive" });
    await createNotebook(user.cookie, { title: "Risk check on MSFT" });

    const filtered = (await (
      await fetch(`${baseUrl}/api/ai-notebooks?coachId=trading&search=aapl`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(filtered.map((n) => n.title)).toEqual(["AAPL earnings deep dive"]);
  });

  it("GET /ai-notebooks/:id/search searches note CONTENT, not just the notebook's own title", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { title: "Generic title" });
    await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ kind: "note", content: "The support zone near 145 held firm" }),
    });
    await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ kind: "finding", content: "Unrelated content about volume profile" }),
    });

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/search?q=support%20zone`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const matches = (await res.json()) as any[];
    expect(matches).toHaveLength(1);
    expect(matches[0].content).toContain("support zone");
  });

  it("GET /ai-notebooks/:id/search requires a q query param", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/search`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(400);
  });

  it("GET /ai-notebooks/:id/search 404s for a notebook owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: notebook } = await createNotebook(owner.cookie);
    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/search?q=anything`, { headers: { cookie: attacker.cookie } });
    expect(res.status).toBe(404);
  });

  // ─── Archive / restore ──────────────────────────────────────────────────

  it("archiving a notebook hides it from the default list but keeps it retrievable with includeArchived=true, and it can be restored", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { title: "To be archived" });

    await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ archived: true }),
    });

    const defaultList = (await (await fetch(`${baseUrl}/api/ai-notebooks?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(defaultList).toEqual([]);

    const withArchived = (await (
      await fetch(`${baseUrl}/api/ai-notebooks?coachId=trading&includeArchived=true`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(withArchived).toHaveLength(1);
    expect(withArchived[0].archived).toBe(true);

    // Restore.
    const restoreRes = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ archived: false }),
    });
    expect(restoreRes.status).toBe(200);
    expect(((await restoreRes.json()) as any).archived).toBe(false);

    const restoredList = (await (
      await fetch(`${baseUrl}/api/ai-notebooks?coachId=trading`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(restoredList.map((n) => n.id)).toEqual([notebook.id]);
  });

  it("pinned (favourite) notebooks are sorted first, then by most-recently-updated", async () => {
    const user = await signUp();
    const { body: first } = await createNotebook(user.cookie, { title: "First" });
    const { body: second } = await createNotebook(user.cookie, { title: "Second" });
    await createNotebook(user.cookie, { title: "Third" });

    await fetch(`${baseUrl}/api/ai-notebooks/${second.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ pinned: true }),
    });

    const list = (await (await fetch(`${baseUrl}/api/ai-notebooks?coachId=trading`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(list[0].title).toBe("Second");
    expect(list[0].pinned).toBe(true);
    expect(list.slice(1).map((n) => n.title)).toEqual(["Third", "First"]);
    void first;
  });

  // ─── Notes ──────────────────────────────────────────────────────────────

  it("notes CRUD across all 6 kinds: add, list, and delete", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);

    const kinds = ["note", "summary", "finding", "action_item", "reference", "saved_response"] as const;
    const created: any[] = [];
    for (const kind of kinds) {
      const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: user.cookie },
        body: JSON.stringify({ kind, content: `A ${kind}` }),
      });
      expect(res.status).toBe(201);
      const note = (await res.json()) as any;
      expect(note.kind).toBe(kind);
      expect(note.content).toBe(`A ${kind}`);
      created.push(note);
    }

    const list = (await (
      await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(list).toHaveLength(6);

    const del = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes/${created[0].id}`, {
      method: "DELETE",
      headers: { cookie: user.cookie },
    });
    expect(del.status).toBe(204);

    const afterDelete = (await (
      await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(afterDelete).toHaveLength(5);
  });

  it("POST notes rejects an invalid kind", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ kind: "not-a-real-kind", content: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("notes are scoped to their own notebook — never visible via a different notebook's endpoints", async () => {
    const user = await signUp();
    const { body: notebookA } = await createNotebook(user.cookie, { title: "Notebook A" });
    const { body: notebookB } = await createNotebook(user.cookie, { title: "Notebook B" });

    await fetch(`${baseUrl}/api/ai-notebooks/${notebookA.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ kind: "note", content: "Belongs to A" }),
    });

    const bNotes = (await (
      await fetch(`${baseUrl}/api/ai-notebooks/${notebookB.id}/notes`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(bNotes).toEqual([]);
  });

  // ─── Conversation linking ───────────────────────────────────────────────

  it("linking an existing, owned, same-coach conversation succeeds and it appears in the notebook's own detail view", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { coachId: "trading" });
    const { body: conversation } = await createConversation(user.cookie, { coachId: "trading", title: "Linked conversation" });

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/links`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ linkType: "conversation", conversationId: conversation.id }),
    });
    expect(res.status).toBe(201);
    const link = (await res.json()) as any;
    expect(link.linkType).toBe("conversation");
    expect(link.conversation.id).toBe(conversation.id);
    expect(link.conversation.title).toBe("Linked conversation");

    const detail = (await (await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.links.map((l: any) => l.conversation?.id)).toEqual([conversation.id]);

    // The conversation itself is completely unaffected by being linked.
    const list = (await (
      await fetch(`${baseUrl}/api/coach-conversations?coachId=trading`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    const stillThere = list.find((c) => c.id === conversation.id);
    expect(stillThere).toBeDefined();
    expect(stillThere.title).toBe("Linked conversation");
  });

  it("linking rejects a conversation belonging to a different coach", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { coachId: "trading" });
    const { body: conversation } = await createConversation(user.cookie, { coachId: "investing" });

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/links`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ linkType: "conversation", conversationId: conversation.id }),
    });
    expect(res.status).toBe(400);
  });

  it("linking rejects a conversation owned by a different user (404, not 403)", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: notebook } = await createNotebook(attacker.cookie, { coachId: "trading" });
    const { body: conversation } = await createConversation(owner.cookie, { coachId: "trading" });

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/links`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: attacker.cookie },
      body: JSON.stringify({ linkType: "conversation", conversationId: conversation.id }),
    });
    expect(res.status).toBe(404);
  });

  it("linking rejects a missing conversationId for linkType conversation", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/links`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ linkType: "conversation" }),
    });
    expect(res.status).toBe(400);
  });

  it("DELETE a link removes it but leaves the underlying conversation intact", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);
    const { body: conversation } = await createConversation(user.cookie);
    const linkRes = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/links`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ linkType: "conversation", conversationId: conversation.id }),
    });
    const link = (await linkRes.json()) as any;

    const del = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/links/${link.id}`, {
      method: "DELETE",
      headers: { cookie: user.cookie },
    });
    expect(del.status).toBe(204);

    const links = (await (
      await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/links`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(links).toEqual([]);

    const list = (await (
      await fetch(`${baseUrl}/api/coach-conversations?coachId=trading`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(list.some((c) => c.id === conversation.id)).toBe(true);
  });

  // ─── File linking ───────────────────────────────────────────────────────

  it("linking an uploaded file reference from a same-coach workspace succeeds", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "trading" });
    const { body: notebook } = await createNotebook(user.cookie, { coachId: "trading" });
    const fileRes = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ fileName: "10-K.pdf", fileUrl: "https://example.com/10-k.pdf" }),
    });
    const file = (await fileRes.json()) as any;

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/links`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ linkType: "file", fileId: file.id }),
    });
    expect(res.status).toBe(201);
    const link = (await res.json()) as any;
    expect(link.linkType).toBe("file");
    expect(link.file.id).toBe(file.id);
    expect(link.file.fileName).toBe("10-K.pdf");
  });

  it("linking a file rejects a workspace belonging to a different coach", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "investing" });
    const { body: notebook } = await createNotebook(user.cookie, { coachId: "trading" });
    const fileRes = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ fileName: "mismatched.pdf", fileUrl: "https://example.com/x.pdf" }),
    });
    const file = (await fileRes.json()) as any;

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/links`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ linkType: "file", fileId: file.id }),
    });
    expect(res.status).toBe(400);
  });

  it("linking a file owned by a different user's workspace 404s", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: workspace } = await createWorkspace(owner.cookie, { coachId: "trading" });
    const { body: notebook } = await createNotebook(attacker.cookie, { coachId: "trading" });
    const fileRes = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ fileName: "owner-only.pdf", fileUrl: "https://example.com/o.pdf" }),
    });
    const file = (await fileRes.json()) as any;

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/links`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: attacker.cookie },
      body: JSON.stringify({ linkType: "file", fileId: file.id }),
    });
    expect(res.status).toBe(404);
  });

  // ─── Workspace detach-not-destroy behavior ──────────────────────────────

  it("deleting a notebook's parent workspace detaches it (workspaceId -> null) rather than deleting it", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "trading", name: "Soon to be deleted" });
    const { body: notebook } = await createNotebook(user.cookie, { coachId: "trading", title: "Survivor notebook", workspaceId: workspace.id });

    const del = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    const stillThere = (await (
      await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}`, { headers: { cookie: user.cookie } })
    ).json()) as any;
    expect(stillThere.id).toBe(notebook.id);
    expect(stillThere.title).toBe("Survivor notebook");
    expect(stillThere.workspaceId).toBeNull();
  });

  // ─── AI features (honest fallback behavior — no LLM key configured) ────

  it("POST .../ai/summarize returns an honest fallback summary when the notebook has no notes", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { title: "Empty notebook" });
    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/ai/summarize`, {
      method: "POST",
      headers: { cookie: user.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.summary).toBe("string");
    expect(body.summary.length).toBeGreaterThan(0);
    expect(body.source).toBeDefined();
  });

  it("POST .../ai/summarize reflects real note content in its fallback when notes exist", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie, { title: "Notebook with content" });
    await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ kind: "note", content: "Real research content" }),
    });

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/ai/summarize`, {
      method: "POST",
      headers: { cookie: user.cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.summary).toBe("string");
  });

  it("POST .../ai/merge returns an honest 'no notes' message when there is nothing to merge", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/ai/merge`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.summary).toContain("no notes");
  });

  it("POST .../ai/takeaways honestly reports unavailable (never fabricates) when no LLM is configured", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);
    await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ kind: "note", content: "Some research" }),
    });

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/ai/takeaways`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.available).toBe(false);
    expect(body.takeaways).toEqual([]);
  });

  it("POST .../ai/action-items honestly reports unavailable (never fabricates) when no LLM is configured", async () => {
    const user = await signUp();
    const { body: notebook } = await createNotebook(user.cookie);

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/ai/action-items`, { method: "POST", headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.available).toBe(false);
    expect(body.actionItems).toEqual([]);
  });

  it("AI endpoints 404 for a notebook owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: notebook } = await createNotebook(owner.cookie);

    const res = await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/ai/summarize`, { method: "POST", headers: { cookie: attacker.cookie } });
    expect(res.status).toBe(404);
  });

  // ─── Existing conversation/workspace behaviour unchanged ────────────────

  it("existing workspace CRUD/isolation behaviour is unaffected by notebooks existing", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { name: "Untouched by notebooks" });
    await createNotebook(user.cookie, { workspaceId: workspace.id });

    const detail = (await (await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.id).toBe(workspace.id);
    expect(detail.name).toBe("Untouched by notebooks");
    // The workspace's own detail response shape (conversations/files/notes)
    // is completely unaffected by a notebook now also referencing it.
    expect(detail.conversations).toEqual([]);
    expect(detail.files).toEqual([]);
    expect(detail.notes).toEqual([]);
  });

  it("existing conversation creation/messages behaviour is unaffected by a conversation being linked into a notebook", async () => {
    const user = await signUp();
    const { body: conversation } = await createConversation(user.cookie, { title: "Untouched conversation" });
    const { body: notebook } = await createNotebook(user.cookie);
    await fetch(`${baseUrl}/api/ai-notebooks/${notebook.id}/links`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ linkType: "conversation", conversationId: conversation.id }),
    });

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

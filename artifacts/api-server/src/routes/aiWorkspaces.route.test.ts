// v1.5.0, Sprint 7 — AI Workspaces. Live route integration tests against a
// real app + real Postgres connection + the real Better-Auth instance (no
// auth mocking), using a fresh, isolated, genuinely signed-up user per test
// block, mirroring routes/aiCoachConversations.route.test.ts's own
// sign-up/session-cookie pattern (Sprint 6) so this file's own workspaces
// are never at risk of colliding with another concurrently-running test
// file's own data.
//
// Proves the sprint's own required guarantees end-to-end over real HTTP:
// workspace CRUD, workspace isolation (per-user and per-coach), conversation
// assignment (both the dedicated "start a conversation in this workspace"
// route and PATCH-assigning an existing conversation), search, archive,
// favourite/pin, resume (conversations detach, not delete, on workspace
// deletion), and files/notes CRUD.

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

describe("AI Workspaces routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `ai-workspaces-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "AI Workspaces Test User" }),
    });
    if (!res.ok) throw new Error(`sign-up failed: ${res.status}`);
    const body = (await res.json()) as { user: { id: string } };
    seededUserIds.push(body.user.id);
    return { userId: body.user.id, cookie: getCookie(res) };
  }

  async function createWorkspace(cookie: string, overrides: Record<string, unknown> = {}) {
    const res = await fetch(`${baseUrl}/api/ai-workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ coachId: "trading", name: "My Workspace", ...overrides }),
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

  it("GET /ai-workspaces requires a coachId query param", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-workspaces`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(400);
  });

  it("GET /ai-workspaces?coachId=trading returns an honest empty list for a brand-new user", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-workspaces?coachId=trading`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    expect((await res.json()) as any[]).toEqual([]);
  });

  it("POST /ai-workspaces creates a workspace with the given name/description/tags", async () => {
    const user = await signUp();
    const { res, body } = await createWorkspace(user.cookie, {
      name: "Q3 Earnings Research",
      description: "Tracking earnings plays",
      tags: ["earnings", "swing"],
    });
    expect(res.status).toBe(201);
    expect(body.coachId).toBe("trading");
    expect(body.name).toBe("Q3 Earnings Research");
    expect(body.description).toBe("Tracking earnings plays");
    expect(body.tags).toEqual(["earnings", "swing"]);
    expect(body.pinned).toBe(false);
    expect(body.archived).toBe(false);
    expect(typeof body.createdAt).toBe("string");
    expect(typeof body.updatedAt).toBe("string");
  });

  it("POST /ai-workspaces rejects a missing coachId", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ name: "No coach" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai-workspaces rejects an empty name", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ coachId: "trading", name: "   " }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /ai-workspaces/:id returns full detail: workspace + conversations + files + notes", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie);

    const res = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const detail = (await res.json()) as any;
    expect(detail.id).toBe(workspace.id);
    expect(detail.conversations).toEqual([]);
    expect(detail.files).toEqual([]);
    expect(detail.notes).toEqual([]);
  });

  it("GET /ai-workspaces/:id 404s for a nonexistent id", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-workspaces/999999999`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(404);
  });

  it("PATCH /ai-workspaces/:id updates name/description/tags", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie);

    const res = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ name: "Renamed", description: "New description", tags: ["tag1"] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.name).toBe("Renamed");
    expect(body.description).toBe("New description");
    expect(body.tags).toEqual(["tag1"]);
  });

  it("PATCH /ai-workspaces/:id rejects an empty body", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("DELETE /ai-workspaces/:id removes the workspace", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie);

    const del = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    const list = (await (
      await fetch(`${baseUrl}/api/ai-workspaces?coachId=trading`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(list).toEqual([]);
  });

  // ─── Isolation ──────────────────────────────────────────────────────────

  it("workspaces are isolated per user — a different user never sees another user's workspace", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    await createWorkspace(owner.cookie, { name: "Owner's private research" });

    const attackerList = (await (
      await fetch(`${baseUrl}/api/ai-workspaces?coachId=trading`, { headers: { cookie: attacker.cookie } })
    ).json()) as any[];
    expect(attackerList).toEqual([]);
  });

  it("PATCH/DELETE return 404 (not 403) for a workspace owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: workspace } = await createWorkspace(owner.cookie);

    const patchRes = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: attacker.cookie },
      body: JSON.stringify({ name: "Hijacked" }),
    });
    expect(patchRes.status).toBe(404);

    const deleteRes = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { method: "DELETE", headers: { cookie: attacker.cookie } });
    expect(deleteRes.status).toBe(404);

    // Still exists for the real owner — proves this was an honest 404, not
    // an accidental mutation/delete.
    const stillThere = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { headers: { cookie: owner.cookie } });
    expect(stillThere.status).toBe(200);
  });

  it("workspaces are isolated per coach — a Trading workspace never appears under Investing or Options for the same user", async () => {
    const user = await signUp();
    await createWorkspace(user.cookie, { coachId: "trading", name: "Trading only" });
    await createWorkspace(user.cookie, { coachId: "investing", name: "Investing only" });
    await createWorkspace(user.cookie, { coachId: "options", name: "Options only" });

    const trading = (await (
      await fetch(`${baseUrl}/api/ai-workspaces?coachId=trading`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    const investing = (await (
      await fetch(`${baseUrl}/api/ai-workspaces?coachId=investing`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    const options = (await (
      await fetch(`${baseUrl}/api/ai-workspaces?coachId=options`, { headers: { cookie: user.cookie } })
    ).json()) as any[];

    expect(trading.map((w) => w.name)).toEqual(["Trading only"]);
    expect(investing.map((w) => w.name)).toEqual(["Investing only"]);
    expect(options.map((w) => w.name)).toEqual(["Options only"]);
  });

  // ─── Search ─────────────────────────────────────────────────────────────

  it("?search filters workspaces by name, case-insensitively", async () => {
    const user = await signUp();
    await createWorkspace(user.cookie, { name: "AAPL earnings deep dive" });
    await createWorkspace(user.cookie, { name: "Risk check on MSFT" });

    const filtered = (await (
      await fetch(`${baseUrl}/api/ai-workspaces?coachId=trading&search=aapl`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(filtered.map((w) => w.name)).toEqual(["AAPL earnings deep dive"]);
  });

  // ─── Archive ────────────────────────────────────────────────────────────

  it("archiving a workspace hides it from the default list but keeps it retrievable with includeArchived=true", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { name: "To be archived" });

    await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ archived: true }),
    });

    const defaultList = (await (
      await fetch(`${baseUrl}/api/ai-workspaces?coachId=trading`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(defaultList).toEqual([]);

    const withArchived = (await (
      await fetch(`${baseUrl}/api/ai-workspaces?coachId=trading&includeArchived=true`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(withArchived).toHaveLength(1);
    expect(withArchived[0].archived).toBe(true);
  });

  // ─── Favourite / pin ────────────────────────────────────────────────────

  it("pinned workspaces are sorted first, then by most-recently-updated", async () => {
    const user = await signUp();
    const { body: first } = await createWorkspace(user.cookie, { name: "First" });
    const { body: second } = await createWorkspace(user.cookie, { name: "Second" });
    await createWorkspace(user.cookie, { name: "Third" });

    // Pin "Second" (not the most recently created) — it should sort first.
    await fetch(`${baseUrl}/api/ai-workspaces/${second.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ pinned: true }),
    });

    const list = (await (
      await fetch(`${baseUrl}/api/ai-workspaces?coachId=trading`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(list[0].name).toBe("Second");
    expect(list[0].pinned).toBe(true);
    // The remaining two are most-recently-updated first.
    expect(list.slice(1).map((w) => w.name)).toEqual(["Third", "First"]);
  });

  // ─── Conversation assignment ────────────────────────────────────────────

  it("POST /ai-workspaces/:id/conversations starts a new conversation pre-assigned to the workspace, using its own coachId", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "investing", name: "Investing project" });

    const res = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/conversations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ title: "First conversation" }),
    });
    expect(res.status).toBe(201);
    const conversation = (await res.json()) as any;
    expect(conversation.title).toBe("First conversation");

    // Confirm it's genuinely assigned and shows up in coach-conversations
    // with the workspaceId filter.
    const list = (await (
      await fetch(`${baseUrl}/api/coach-conversations?coachId=investing&workspaceId=${workspace.id}`, {
        headers: { cookie: user.cookie },
      })
    ).json()) as any[];
    expect(list.map((c) => c.id)).toEqual([conversation.id]);
    expect(list[0].workspaceId).toBe(workspace.id);

    // And in the workspace's own detail view.
    const detail = (await (await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(detail.conversations.map((c: any) => c.id)).toEqual([conversation.id]);
  });

  it("POST /ai-workspaces/:id/conversations 404s for a nonexistent workspace", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-workspaces/999999999/conversations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /coach-conversations/:id assigns an existing conversation to a workspace of the same coach", async () => {
    const user = await signUp();
    const conversation = (await (
      await fetch(`${baseUrl}/api/coach-conversations`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: user.cookie },
        body: JSON.stringify({ coachId: "options" }),
      })
    ).json()) as any;
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "options", name: "Options project" });

    const res = await fetch(`${baseUrl}/api/coach-conversations/${conversation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ workspaceId: workspace.id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.workspaceId).toBe(workspace.id);
  });

  it("PATCH /coach-conversations/:id rejects assigning to a workspace belonging to a different coach", async () => {
    const user = await signUp();
    const conversation = (await (
      await fetch(`${baseUrl}/api/coach-conversations`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: user.cookie },
        body: JSON.stringify({ coachId: "trading" }),
      })
    ).json()) as any;
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "investing", name: "Wrong coach" });

    const res = await fetch(`${baseUrl}/api/coach-conversations/${conversation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ workspaceId: workspace.id }),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /coach-conversations/:id rejects assigning to a workspace owned by a different user", async () => {
    const owner = await signUp();
    const attacker = await signUp();
    const { body: workspace } = await createWorkspace(owner.cookie, { name: "Owner's workspace" });
    const conversation = (await (
      await fetch(`${baseUrl}/api/coach-conversations`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: attacker.cookie },
        body: JSON.stringify({ coachId: "trading" }),
      })
    ).json()) as any;

    const res = await fetch(`${baseUrl}/api/coach-conversations/${conversation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: attacker.cookie },
      body: JSON.stringify({ workspaceId: workspace.id }),
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /coach-conversations/:id with workspaceId:null unassigns a conversation without deleting it", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { name: "Temp assignment" });
    const created = (await (
      await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/conversations`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: user.cookie },
        body: JSON.stringify({}),
      })
    ).json()) as any;

    const res = await fetch(`${baseUrl}/api/coach-conversations/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ workspaceId: null }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.workspaceId).toBeNull();
  });

  // ─── Resume: deleting a workspace detaches, never destroys, its conversations ───

  it("deleting a workspace detaches its conversations (workspaceId -> null) rather than deleting them — they remain fully resumable", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie, { coachId: "trading", name: "Soon to be deleted" });
    const created = (await (
      await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/conversations`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: user.cookie },
        body: JSON.stringify({ title: "Survivor conversation" }),
      })
    ).json()) as any;
    await fetch(`${baseUrl}/api/coach-conversations/${created.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ role: "user", content: "Remember this after the workspace is gone" }),
    });

    const del = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(del.status).toBe(204);

    // The conversation itself, and its full message history, are still
    // intact and resumable from the top-level un-grouped list.
    const list = (await (
      await fetch(`${baseUrl}/api/coach-conversations?coachId=trading`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    const survivor = list.find((c) => c.id === created.id);
    expect(survivor).toBeDefined();
    expect(survivor.title).toBe("Survivor conversation");
    expect(survivor.workspaceId).toBeNull();

    const messages = (await (
      await fetch(`${baseUrl}/api/coach-conversations/${created.id}/messages`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(messages.map((m) => m.content)).toEqual(["Remember this after the workspace is gone"]);
  });

  // ─── Files (references only) ───────────────────────────────────────────

  it("files CRUD: add, list, and delete a file reference", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie);

    const createRes = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ fileName: "10-K.pdf", fileUrl: "https://example.com/10-k.pdf", note: "Latest annual report" }),
    });
    expect(createRes.status).toBe(201);
    const file = (await createRes.json()) as any;
    expect(file.fileName).toBe("10-K.pdf");
    expect(file.fileUrl).toBe("https://example.com/10-k.pdf");
    expect(file.note).toBe("Latest annual report");

    const listRes = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files`, { headers: { cookie: user.cookie } });
    const list = (await listRes.json()) as any[];
    expect(list.map((f) => f.id)).toEqual([file.id]);

    const delRes = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files/${file.id}`, {
      method: "DELETE",
      headers: { cookie: user.cookie },
    });
    expect(delRes.status).toBe(204);

    const afterDelete = (await (
      await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(afterDelete).toEqual([]);
  });

  it("POST files rejects a missing fileUrl", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ fileName: "no-url.pdf" }),
    });
    expect(res.status).toBe(400);
  });

  it("deleting a workspace cascades its files (ON DELETE CASCADE)", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie);
    const file = (await (
      await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/files`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: user.cookie },
        body: JSON.stringify({ fileName: "gone.pdf", fileUrl: "https://example.com/gone.pdf" }),
      })
    ).json()) as any;

    await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}`, { method: "DELETE", headers: { cookie: user.cookie } });

    const remaining = await db.select().from(aiWorkspaceFilesTable).where(eq(aiWorkspaceFilesTable.id, file.id));
    expect(remaining).toEqual([]);
  });

  // ─── Notes (quick notes / summaries / conclusions / action items) ──────

  it("notes CRUD across all 4 kinds: add, list, and delete", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie);

    const kinds = ["note", "summary", "conclusion", "action_item"] as const;
    const created: any[] = [];
    for (const kind of kinds) {
      const res = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/notes`, {
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
      await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/notes`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(list).toHaveLength(4);

    const del = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/notes/${created[0].id}`, {
      method: "DELETE",
      headers: { cookie: user.cookie },
    });
    expect(del.status).toBe(204);

    const afterDelete = (await (
      await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/notes`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(afterDelete).toHaveLength(3);
  });

  it("POST notes rejects an invalid kind", async () => {
    const user = await signUp();
    const { body: workspace } = await createWorkspace(user.cookie);
    const res = await fetch(`${baseUrl}/api/ai-workspaces/${workspace.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ kind: "not-a-real-kind", content: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("notes and files are scoped to their own workspace — never visible via a different workspace's endpoints", async () => {
    const user = await signUp();
    const { body: workspaceA } = await createWorkspace(user.cookie, { name: "Workspace A" });
    const { body: workspaceB } = await createWorkspace(user.cookie, { name: "Workspace B" });

    await fetch(`${baseUrl}/api/ai-workspaces/${workspaceA.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ kind: "note", content: "Belongs to A" }),
    });

    const bNotes = (await (
      await fetch(`${baseUrl}/api/ai-workspaces/${workspaceB.id}/notes`, { headers: { cookie: user.cookie } })
    ).json()) as any[];
    expect(bNotes).toEqual([]);
  });
});

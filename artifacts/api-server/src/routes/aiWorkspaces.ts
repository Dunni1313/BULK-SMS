// v1.5.0, Sprint 7 — AI Workspaces.
//
// Reusable research projects grouping conversations, saved research, file
// references, and AI context for the three existing conversational AI
// Coaches (Trading, Investing, Options), built on top of Sprint 6's
// conversation memory. Portfolio has no conversational coach (Sprint 3's
// own exhaustive finding) and has nothing registered here.
//
// Per the approved scope ("reuse Sprint 6 tables where possible, do not
// duplicate conversation storage"), conversations are never re-stored here
// — routes/aiCoachConversations.ts's own ai_coach_conversations table
// gained two small, additive columns instead (workspaceId, favourite; see
// its own header comment and manual migration 040_ai_workspaces.sql for the
// full rationale). This file owns exactly the three brand-new tables
// migration 040 introduced: ai_workspaces, ai_workspace_files (references
// only — no binary upload/storage infrastructure exists anywhere in this
// codebase, and building one is out of scope), and ai_workspace_notes (one
// kind-discriminated table for quick notes/AI summaries/conclusions/action
// items).
//
// Deliberately kept outside the OpenAPI/orval typed contract and validated
// via the same small, plain, hand-written checks as
// routes/aiCoachConversations.ts — introducing a zod dependency here would
// carry the exact same dependency-conflict risk that sprint's own
// validation already found and disclosed.
//
// Every list/read/write is scoped by (user_id, coach_id) together for
// workspaces, and transitively via workspace ownership for files/notes —
// the same isolation discipline Sprint 6 established. 404, never a
// separate 403, for both "doesn't exist" and "isn't yours."

import { Router, type IRouter } from "express";
import { db, aiWorkspacesTable, aiWorkspaceFilesTable, aiWorkspaceNotesTable, aiCoachConversationsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { getScopedUserId } from "../lib/tenantScope.js";
import { COACH_IDS, type CoachId, createConversationRow, loadOwnedWorkspace } from "./aiCoachConversations.js";

const router: IRouter = Router();

function isCoachId(value: unknown): value is CoachId {
  return typeof value === "string" && (COACH_IDS as readonly string[]).includes(value);
}

const NAME_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 2000;
const TAG_MAX_LENGTH = 40;
const MAX_TAGS = 20;

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function parseOptionalString(value: unknown, field: string, maxLength: number): ValidationResult<string | undefined> {
  if (value === undefined) return { success: true, data: undefined };
  if (typeof value !== "string") return { success: false, error: `${field} must be a string` };
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return { success: false, error: `${field} must be at most ${maxLength} characters` };
  return { success: true, data: trimmed };
}

function parseOptionalTags(value: unknown): ValidationResult<string[] | undefined> {
  if (value === undefined) return { success: true, data: undefined };
  if (!Array.isArray(value)) return { success: false, error: "tags must be an array of strings" };
  if (value.length > MAX_TAGS) return { success: false, error: `tags must contain at most ${MAX_TAGS} entries` };
  const tags: string[] = [];
  for (const t of value) {
    if (typeof t !== "string" || t.trim().length === 0) {
      return { success: false, error: "each tag must be a non-empty string" };
    }
    if (t.trim().length > TAG_MAX_LENGTH) {
      return { success: false, error: `each tag must be at most ${TAG_MAX_LENGTH} characters` };
    }
    tags.push(t.trim());
  }
  return { success: true, data: tags };
}

function parseCreateWorkspaceBody(
  body: unknown,
): ValidationResult<{ coachId: CoachId; name: string; description?: string; tags?: string[] }> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  if (!isCoachId(b.coachId)) {
    return { success: false, error: `coachId is required and must be one of: ${COACH_IDS.join(", ")}` };
  }
  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return { success: false, error: "name is required and must be a non-empty string" };
  }
  if (b.name.trim().length > NAME_MAX_LENGTH) {
    return { success: false, error: `name must be at most ${NAME_MAX_LENGTH} characters` };
  }
  const description = parseOptionalString(b.description, "description", DESCRIPTION_MAX_LENGTH);
  if (!description.success) return { success: false, error: description.error };
  const tags = parseOptionalTags(b.tags);
  if (!tags.success) return { success: false, error: tags.error };
  return { success: true, data: { coachId: b.coachId, name: b.name.trim(), description: description.data, tags: tags.data } };
}

interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  tags?: string[];
  pinned?: boolean;
  archived?: boolean;
}

function parseUpdateWorkspaceBody(body: unknown): ValidationResult<UpdateWorkspaceInput> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;

  let name: string | undefined;
  if (b.name !== undefined) {
    if (typeof b.name !== "string" || b.name.trim().length === 0) {
      return { success: false, error: "name must be a non-empty string" };
    }
    if (b.name.trim().length > NAME_MAX_LENGTH) {
      return { success: false, error: `name must be at most ${NAME_MAX_LENGTH} characters` };
    }
    name = b.name.trim();
  }

  const description = parseOptionalString(b.description, "description", DESCRIPTION_MAX_LENGTH);
  if (!description.success) return { success: false, error: description.error };

  const tags = parseOptionalTags(b.tags);
  if (!tags.success) return { success: false, error: tags.error };

  let pinned: boolean | undefined;
  if (b.pinned !== undefined) {
    if (typeof b.pinned !== "boolean") return { success: false, error: "pinned must be a boolean" };
    pinned = b.pinned;
  }

  let archived: boolean | undefined;
  if (b.archived !== undefined) {
    if (typeof b.archived !== "boolean") return { success: false, error: "archived must be a boolean" };
    archived = b.archived;
  }

  if (
    name === undefined &&
    description.data === undefined &&
    tags.data === undefined &&
    pinned === undefined &&
    archived === undefined
  ) {
    return { success: false, error: "At least one field must be provided." };
  }

  return { success: true, data: { name, description: description.data, tags: tags.data, pinned, archived } };
}

const NOTE_KINDS = ["note", "summary", "conclusion", "action_item"] as const;
type NoteKind = (typeof NOTE_KINDS)[number];

function parseCreateNoteBody(body: unknown): ValidationResult<{ kind: NoteKind; content: string }> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  if (typeof b.kind !== "string" || !(NOTE_KINDS as readonly string[]).includes(b.kind)) {
    return { success: false, error: `kind is required and must be one of: ${NOTE_KINDS.join(", ")}` };
  }
  if (typeof b.content !== "string" || b.content.trim().length === 0) {
    return { success: false, error: "content is required and must be a non-empty string" };
  }
  return { success: true, data: { kind: b.kind as NoteKind, content: b.content.trim() } };
}

function parseCreateFileBody(body: unknown): ValidationResult<{ fileName: string; fileUrl: string; note?: string }> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  if (typeof b.fileName !== "string" || b.fileName.trim().length === 0) {
    return { success: false, error: "fileName is required and must be a non-empty string" };
  }
  if (typeof b.fileUrl !== "string" || b.fileUrl.trim().length === 0) {
    return { success: false, error: "fileUrl is required and must be a non-empty string" };
  }
  const note = parseOptionalString(b.note, "note", DESCRIPTION_MAX_LENGTH);
  if (!note.success) return { success: false, error: note.error };
  return { success: true, data: { fileName: b.fileName.trim(), fileUrl: b.fileUrl.trim(), note: note.data } };
}

function formatWorkspace(row: typeof aiWorkspacesTable.$inferSelect) {
  return {
    id: row.id,
    coachId: row.coachId,
    name: row.name,
    description: row.description ?? null,
    pinned: row.pinned,
    archived: row.archived,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatFile(row: typeof aiWorkspaceFilesTable.$inferSelect) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    note: row.note ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function formatNote(row: typeof aiWorkspaceNotesTable.$inferSelect) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

function formatConversationSummary(row: typeof aiCoachConversationsTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    archived: row.archived,
    favourite: row.favourite,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseCoachIdQuery(raw: unknown): CoachId | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isCoachId(value) ? value : null;
}

function parseIdParam(raw: unknown): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(value as string, 10);
  return isNaN(id) ? null : id;
}

// GET /ai-workspaces?coachId=trading&search=&includeArchived=true
router.get("/ai-workspaces", async (req, res): Promise<void> => {
  const coachId = parseCoachIdQuery(req.query.coachId);
  if (!coachId) {
    res.status(400).json({ error: `coachId query param is required and must be one of: ${COACH_IDS.join(", ")}` });
    return;
  }

  const userId = await getScopedUserId(req);
  const includeArchived = req.query.includeArchived === "true";

  const rows = await db
    .select()
    .from(aiWorkspacesTable)
    .where(and(eq(aiWorkspacesTable.userId, userId), eq(aiWorkspacesTable.coachId, coachId)));

  const visible = includeArchived ? rows : rows.filter((r) => !r.archived);

  const searchRaw = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
  const search = typeof searchRaw === "string" ? searchRaw.trim().toLowerCase() : "";
  const filtered = search ? visible.filter((r) => r.name.toLowerCase().includes(search)) : visible;

  // Pinned workspaces first, then most-recently-updated.
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  res.json(sorted.map(formatWorkspace));
});

// POST /ai-workspaces {coachId, name, description?, tags?}
router.post("/ai-workspaces", async (req, res): Promise<void> => {
  const parsed = parseCreateWorkspaceBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .insert(aiWorkspacesTable)
    .values({
      userId,
      coachId: parsed.data.coachId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      tags: parsed.data.tags ?? [],
    })
    .returning();

  res.status(201).json(formatWorkspace(row));
});

// GET /ai-workspaces/:id — full detail: workspace + its own conversations
// (summaries) + files + notes.
router.get("/ai-workspaces/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const workspace = await loadOwnedWorkspace(id, userId);
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const [conversations, files, notes] = await Promise.all([
    db
      .select()
      .from(aiCoachConversationsTable)
      .where(and(eq(aiCoachConversationsTable.workspaceId, id), eq(aiCoachConversationsTable.userId, userId)))
      .orderBy(desc(aiCoachConversationsTable.updatedAt)),
    db.select().from(aiWorkspaceFilesTable).where(eq(aiWorkspaceFilesTable.workspaceId, id)).orderBy(desc(aiWorkspaceFilesTable.createdAt)),
    db.select().from(aiWorkspaceNotesTable).where(eq(aiWorkspaceNotesTable.workspaceId, id)).orderBy(desc(aiWorkspaceNotesTable.createdAt)),
  ]);

  res.json({
    ...formatWorkspace(workspace),
    conversations: conversations.map(formatConversationSummary),
    files: files.map(formatFile),
    notes: notes.map(formatNote),
  });
});

// PATCH /ai-workspaces/:id {name?, description?, tags?, pinned?, archived?}
router.patch("/ai-workspaces/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = parseUpdateWorkspaceBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .update(aiWorkspacesTable)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
      ...(parsed.data.pinned !== undefined ? { pinned: parsed.data.pinned } : {}),
      ...(parsed.data.archived !== undefined ? { archived: parsed.data.archived } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(aiWorkspacesTable.id, id), eq(aiWorkspacesTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  res.json(formatWorkspace(row));
});

// DELETE /ai-workspaces/:id — cascades its own files/notes (ON DELETE
// CASCADE, migration 040). Its own conversations are NOT deleted — they
// detach (workspace_id -> NULL, ON DELETE SET NULL) and remain fully
// intact, resumable from the top-level, un-grouped conversation list.
router.delete("/ai-workspaces/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(aiWorkspacesTable)
    .where(and(eq(aiWorkspacesTable.id, id), eq(aiWorkspacesTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  res.status(204).send();
});

// POST /ai-workspaces/:id/conversations {title?} — starts a new
// conversation already assigned to this workspace, using the workspace's
// own fixed coachId (the caller never has to specify or risk mismatching
// it) — reuses aiCoachConversations.ts's own createConversationRow(), the
// single insert point both this route and POST /coach-conversations share.
router.post("/ai-workspaces/:id/conversations", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const workspace = await loadOwnedWorkspace(id, userId);
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  let title: string | undefined;
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      res.status(400).json({ error: "title must be a non-empty string" });
      return;
    }
    title = body.title.trim();
  }

  const row = await createConversationRow(userId, workspace.coachId as CoachId, title, id);
  res.status(201).json(formatConversationSummary(row));
});

// --- Files (references only — no binary upload/storage infrastructure) ---

router.get("/ai-workspaces/:id/files", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const workspace = await loadOwnedWorkspace(id, userId);
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const files = await db
    .select()
    .from(aiWorkspaceFilesTable)
    .where(eq(aiWorkspaceFilesTable.workspaceId, id))
    .orderBy(desc(aiWorkspaceFilesTable.createdAt));

  res.json(files.map(formatFile));
});

router.post("/ai-workspaces/:id/files", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = parseCreateFileBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);
  const workspace = await loadOwnedWorkspace(id, userId);
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const [row] = await db
    .insert(aiWorkspaceFilesTable)
    .values({ workspaceId: id, fileName: parsed.data.fileName, fileUrl: parsed.data.fileUrl, note: parsed.data.note ?? null })
    .returning();

  res.status(201).json(formatFile(row));
});

router.delete("/ai-workspaces/:id/files/:fileId", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const fileId = parseIdParam(req.params.fileId);
  if (id === null || fileId === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const workspace = await loadOwnedWorkspace(id, userId);
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const [row] = await db
    .delete(aiWorkspaceFilesTable)
    .where(and(eq(aiWorkspaceFilesTable.id, fileId), eq(aiWorkspaceFilesTable.workspaceId, id)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "File reference not found" });
    return;
  }

  res.status(204).send();
});

// --- Notes (quick notes / saved AI summaries / conclusions / action items) ---

router.get("/ai-workspaces/:id/notes", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const workspace = await loadOwnedWorkspace(id, userId);
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const notes = await db
    .select()
    .from(aiWorkspaceNotesTable)
    .where(eq(aiWorkspaceNotesTable.workspaceId, id))
    .orderBy(desc(aiWorkspaceNotesTable.createdAt));

  res.json(notes.map(formatNote));
});

router.post("/ai-workspaces/:id/notes", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = parseCreateNoteBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);
  const workspace = await loadOwnedWorkspace(id, userId);
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const [row] = await db
    .insert(aiWorkspaceNotesTable)
    .values({ workspaceId: id, kind: parsed.data.kind, content: parsed.data.content })
    .returning();

  res.status(201).json(formatNote(row));
});

router.delete("/ai-workspaces/:id/notes/:noteId", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const noteId = parseIdParam(req.params.noteId);
  if (id === null || noteId === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const workspace = await loadOwnedWorkspace(id, userId);
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  const [row] = await db
    .delete(aiWorkspaceNotesTable)
    .where(and(eq(aiWorkspaceNotesTable.id, noteId), eq(aiWorkspaceNotesTable.workspaceId, id)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.status(204).send();
});

export default router;

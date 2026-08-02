// v1.5.0, Sprint 8 — AI Research Notebooks.
//
// A structured knowledge space, built on top of Sprint 7's AI Workspaces
// and Sprint 6's conversation memory, for the same three conversational AI
// Coaches (Trading, Investing, Options). Portfolio has no conversational
// coach (Sprint 3's own exhaustive finding) and has nothing registered
// here.
//
// Per the approved scope ("reuse Workspace storage where possible, do not
// duplicate conversation storage"), conversations and workspace file
// references are never re-stored here — ai_notebook_links only LINKS to
// already-existing ai_coach_conversations/ai_workspace_files rows. This
// file owns the three brand-new tables migration 041 introduced:
// ai_notebooks, ai_notebook_notes (one kind-discriminated table for
// notes/summaries/findings/action-items/references/saved-AI-responses),
// and ai_notebook_links (one table for both conversation and file links,
// discriminated by linkType).
//
// AI features (summarize, merge notes, key takeaways, action items) are
// all explicit, user-triggered POST calls — never run proactively or on a
// schedule, per the approved scope's own "the AI remains an assistant,
// not an autonomous decision-maker" instruction. Each reads the
// notebook's own already-saved content and narrates/extracts from it via
// coachLLM.ts's new narrateNotebookSummary/narrateNotebookMergedSummary/
// generateNotebookKeyTakeaways/generateNotebookActionItems — it never
// auto-saves its own output; saving an AI response is always a separate,
// explicit POST to the ordinary notes endpoint.
//
// Deliberately kept outside the OpenAPI/orval typed contract and
// validated via the same small, plain, hand-written checks
// routes/aiWorkspaces.ts already established (Sprint 7) — introducing a
// zod dependency here would carry the exact same dependency-conflict risk
// Sprint 6's own validation already found and disclosed.
//
// Every list/read/write is scoped by (user_id, coach_id) together for
// notebooks, and transitively via notebook ownership for notes/links —
// the same isolation discipline Sprint 6/7 established. 404, never a
// separate 403, for both "doesn't exist" and "isn't yours."

import { Router, type IRouter } from "express";
import {
  db,
  aiNotebooksTable,
  aiNotebookNotesTable,
  aiNotebookLinksTable,
  aiWorkspacesTable,
  aiWorkspaceFilesTable,
  aiCoachConversationsTable,
} from "@workspace/db";
import { and, eq, desc, inArray } from "drizzle-orm";
import { getScopedUserId } from "../lib/tenantScope.js";
import { COACH_IDS, type CoachId, loadOwnedWorkspace, loadOwnedConversation } from "./aiCoachConversations.js";
import {
  narrateNotebookSummary,
  narrateNotebookMergedSummary,
  generateNotebookKeyTakeaways,
  generateNotebookActionItems,
} from "../lib/coachLLM.js";

const router: IRouter = Router();

function isCoachId(value: unknown): value is CoachId {
  return typeof value === "string" && (COACH_IDS as readonly string[]).includes(value);
}

const TITLE_MAX_LENGTH = 200;
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

function parseOptionalWorkspaceId(value: unknown): ValidationResult<number | null | undefined> {
  if (value === undefined) return { success: true, data: undefined };
  if (value === null) return { success: true, data: null };
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { success: false, error: "workspaceId must be an integer or null" };
  }
  return { success: true, data: value };
}

function parseCreateNotebookBody(
  body: unknown,
): ValidationResult<{ coachId: CoachId; title: string; description?: string; tags?: string[]; workspaceId?: number | null }> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  if (!isCoachId(b.coachId)) {
    return { success: false, error: `coachId is required and must be one of: ${COACH_IDS.join(", ")}` };
  }
  if (typeof b.title !== "string" || b.title.trim().length === 0) {
    return { success: false, error: "title is required and must be a non-empty string" };
  }
  if (b.title.trim().length > TITLE_MAX_LENGTH) {
    return { success: false, error: `title must be at most ${TITLE_MAX_LENGTH} characters` };
  }
  const description = parseOptionalString(b.description, "description", DESCRIPTION_MAX_LENGTH);
  if (!description.success) return { success: false, error: description.error };
  const tags = parseOptionalTags(b.tags);
  if (!tags.success) return { success: false, error: tags.error };
  const workspaceId = parseOptionalWorkspaceId(b.workspaceId);
  if (!workspaceId.success) return { success: false, error: workspaceId.error };
  return {
    success: true,
    data: { coachId: b.coachId, title: b.title.trim(), description: description.data, tags: tags.data, workspaceId: workspaceId.data },
  };
}

interface UpdateNotebookInput {
  title?: string;
  description?: string;
  tags?: string[];
  pinned?: boolean;
  archived?: boolean;
  workspaceId?: number | null;
}

function parseUpdateNotebookBody(body: unknown): ValidationResult<UpdateNotebookInput> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;

  let title: string | undefined;
  if (b.title !== undefined) {
    if (typeof b.title !== "string" || b.title.trim().length === 0) {
      return { success: false, error: "title must be a non-empty string" };
    }
    if (b.title.trim().length > TITLE_MAX_LENGTH) {
      return { success: false, error: `title must be at most ${TITLE_MAX_LENGTH} characters` };
    }
    title = b.title.trim();
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

  const workspaceId = parseOptionalWorkspaceId(b.workspaceId);
  if (!workspaceId.success) return { success: false, error: workspaceId.error };

  if (
    title === undefined &&
    description.data === undefined &&
    tags.data === undefined &&
    pinned === undefined &&
    archived === undefined &&
    workspaceId.data === undefined
  ) {
    return { success: false, error: "At least one field must be provided." };
  }

  return { success: true, data: { title, description: description.data, tags: tags.data, pinned, archived, workspaceId: workspaceId.data } };
}

const NOTE_KINDS = ["note", "summary", "finding", "action_item", "reference", "saved_response"] as const;
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

const LINK_TYPES = ["conversation", "file"] as const;
type LinkType = (typeof LINK_TYPES)[number];

function parseCreateLinkBody(body: unknown): ValidationResult<{ linkType: LinkType; conversationId?: number; fileId?: number }> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  if (typeof b.linkType !== "string" || !(LINK_TYPES as readonly string[]).includes(b.linkType)) {
    return { success: false, error: `linkType is required and must be one of: ${LINK_TYPES.join(", ")}` };
  }
  if (b.linkType === "conversation") {
    if (typeof b.conversationId !== "number" || !Number.isInteger(b.conversationId)) {
      return { success: false, error: "conversationId is required and must be an integer when linkType is 'conversation'" };
    }
    return { success: true, data: { linkType: "conversation", conversationId: b.conversationId } };
  }
  if (typeof b.fileId !== "number" || !Number.isInteger(b.fileId)) {
    return { success: false, error: "fileId is required and must be an integer when linkType is 'file'" };
  }
  return { success: true, data: { linkType: "file", fileId: b.fileId } };
}

function formatNotebook(row: typeof aiNotebooksTable.$inferSelect) {
  return {
    id: row.id,
    coachId: row.coachId,
    workspaceId: row.workspaceId ?? null,
    title: row.title,
    description: row.description ?? null,
    pinned: row.pinned,
    archived: row.archived,
    tags: row.tags,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatNote(row: typeof aiNotebookNotesTable.$inferSelect) {
  return {
    id: row.id,
    notebookId: row.notebookId,
    kind: row.kind,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

function formatLink(
  row: typeof aiNotebookLinksTable.$inferSelect,
  conversation?: typeof aiCoachConversationsTable.$inferSelect | null,
  file?: typeof aiWorkspaceFilesTable.$inferSelect | null,
) {
  return {
    id: row.id,
    notebookId: row.notebookId,
    linkType: row.linkType,
    conversation: conversation ? { id: conversation.id, title: conversation.title } : null,
    file: file ? { id: file.id, fileName: file.fileName, fileUrl: file.fileUrl } : null,
    createdAt: row.createdAt.toISOString(),
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

export async function loadOwnedNotebook(id: number, userId: string) {
  const [row] = await db
    .select()
    .from(aiNotebooksTable)
    .where(and(eq(aiNotebooksTable.id, id), eq(aiNotebooksTable.userId, userId)));
  return row ?? null;
}

/** Gathers a notebook's own already-saved content into a single, honest
 * context object for the AI narration/extraction functions — never
 * fabricates content the notebook doesn't actually have. */
async function buildNotebookContext(notebook: typeof aiNotebooksTable.$inferSelect) {
  const [notes, links] = await Promise.all([
    db
      .select()
      .from(aiNotebookNotesTable)
      .where(eq(aiNotebookNotesTable.notebookId, notebook.id))
      .orderBy(desc(aiNotebookNotesTable.createdAt)),
    db.select().from(aiNotebookLinksTable).where(eq(aiNotebookLinksTable.notebookId, notebook.id)),
  ]);

  const conversationIds = links.filter((l) => l.linkType === "conversation" && l.conversationId != null).map((l) => l.conversationId!);
  // v1.5.0, Sprint 22 (Release Candidate consolidation) — batched via a
  // single inArray() lookup instead of one query per linked conversation
  // (an N+1 pattern flagged by the sprint's own audit). Behavior-preserving:
  // still only includes titles for conversations that actually resolved.
  const conversationTitles =
    conversationIds.length === 0
      ? []
      : (await db.select().from(aiCoachConversationsTable).where(inArray(aiCoachConversationsTable.id, conversationIds))).map((row) => row.title);

  return {
    title: notebook.title,
    description: notebook.description ?? null,
    tags: notebook.tags,
    notes: notes.map((n) => ({ kind: n.kind, content: n.content })),
    linkedConversationTitles: conversationTitles,
  };
}

// ─── Notebooks ──────────────────────────────────────────────────────────

// GET /ai-notebooks?coachId=trading&workspaceId=5&search=&includeArchived=true
router.get("/ai-notebooks", async (req, res): Promise<void> => {
  const coachId = parseCoachIdQuery(req.query.coachId);
  if (!coachId) {
    res.status(400).json({ error: `coachId query param is required and must be one of: ${COACH_IDS.join(", ")}` });
    return;
  }

  const userId = await getScopedUserId(req);
  const includeArchived = req.query.includeArchived === "true";

  const workspaceIdRaw = Array.isArray(req.query.workspaceId) ? req.query.workspaceId[0] : req.query.workspaceId;
  let workspaceIdFilter: number | undefined;
  if (typeof workspaceIdRaw === "string" && workspaceIdRaw.length > 0) {
    const parsed = parseInt(workspaceIdRaw, 10);
    if (isNaN(parsed)) {
      res.status(400).json({ error: "workspaceId query param must be an integer" });
      return;
    }
    workspaceIdFilter = parsed;
  }

  const rows = await db
    .select()
    .from(aiNotebooksTable)
    .where(
      and(
        eq(aiNotebooksTable.userId, userId),
        eq(aiNotebooksTable.coachId, coachId),
        ...(workspaceIdFilter !== undefined ? [eq(aiNotebooksTable.workspaceId, workspaceIdFilter)] : []),
      ),
    );

  const visible = includeArchived ? rows : rows.filter((r) => !r.archived);

  const searchRaw = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
  const search = typeof searchRaw === "string" ? searchRaw.trim().toLowerCase() : "";
  const filtered = search ? visible.filter((r) => r.title.toLowerCase().includes(search)) : visible;

  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  res.json(sorted.map(formatNotebook));
});

// POST /ai-notebooks {coachId, title, description?, tags?, workspaceId?}
router.post("/ai-notebooks", async (req, res): Promise<void> => {
  const parsed = parseCreateNotebookBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);

  if (parsed.data.workspaceId != null) {
    const workspace = await loadOwnedWorkspace(parsed.data.workspaceId, userId);
    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    if (workspace.coachId !== parsed.data.coachId) {
      res.status(400).json({ error: "Workspace belongs to a different coach" });
      return;
    }
  }

  const [row] = await db
    .insert(aiNotebooksTable)
    .values({
      userId,
      coachId: parsed.data.coachId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      tags: parsed.data.tags ?? [],
      workspaceId: parsed.data.workspaceId ?? null,
    })
    .returning();

  res.status(201).json(formatNotebook(row));
});

// GET /ai-notebooks/:id — full detail: notebook + notes + resolved links.
router.get("/ai-notebooks/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const [notes, links] = await Promise.all([
    db.select().from(aiNotebookNotesTable).where(eq(aiNotebookNotesTable.notebookId, id)).orderBy(desc(aiNotebookNotesTable.createdAt)),
    db.select().from(aiNotebookLinksTable).where(eq(aiNotebookLinksTable.notebookId, id)),
  ]);

  const resolvedLinks = await Promise.all(
    links.map(async (link) => {
      if (link.linkType === "conversation" && link.conversationId != null) {
        const [conversation] = await db.select().from(aiCoachConversationsTable).where(eq(aiCoachConversationsTable.id, link.conversationId));
        return formatLink(link, conversation ?? null, null);
      }
      if (link.linkType === "file" && link.fileId != null) {
        const [file] = await db.select().from(aiWorkspaceFilesTable).where(eq(aiWorkspaceFilesTable.id, link.fileId));
        return formatLink(link, null, file ?? null);
      }
      return formatLink(link, null, null);
    }),
  );

  res.json({
    ...formatNotebook(notebook),
    notes: notes.map(formatNote),
    links: resolvedLinks,
  });
});

// PATCH /ai-notebooks/:id {title?, description?, tags?, pinned?, archived?, workspaceId?}
router.patch("/ai-notebooks/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = parseUpdateNotebookBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);
  const existing = await loadOwnedNotebook(id, userId);
  if (!existing) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  if (parsed.data.workspaceId != null) {
    const workspace = await loadOwnedWorkspace(parsed.data.workspaceId, userId);
    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    if (workspace.coachId !== existing.coachId) {
      res.status(400).json({ error: "Workspace belongs to a different coach" });
      return;
    }
  }

  // "Version history (basic)" — bump the version counter whenever the
  // notebook's own substantive content (title/description) changes.
  const contentChanged = parsed.data.title !== undefined || parsed.data.description !== undefined;

  const [row] = await db
    .update(aiNotebooksTable)
    .set({
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
      ...(parsed.data.pinned !== undefined ? { pinned: parsed.data.pinned } : {}),
      ...(parsed.data.archived !== undefined ? { archived: parsed.data.archived } : {}),
      ...(parsed.data.workspaceId !== undefined ? { workspaceId: parsed.data.workspaceId } : {}),
      ...(contentChanged ? { version: existing.version + 1 } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(aiNotebooksTable.id, id), eq(aiNotebooksTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  res.json(formatNotebook(row));
});

// DELETE /ai-notebooks/:id — cascades its own notes/links (ON DELETE
// CASCADE, migration 041). Its linked conversations/files are NOT
// deleted — only the link rows referencing them.
router.delete("/ai-notebooks/:id", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(aiNotebooksTable)
    .where(and(eq(aiNotebooksTable.id, id), eq(aiNotebooksTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  res.status(204).send();
});

// GET /ai-notebooks/:id/search?q= — searches this notebook's own note
// content (never just the title), the "Search notebook contents" feature.
router.get("/ai-notebooks/:id/search", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const qRaw = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  if (typeof qRaw !== "string" || qRaw.trim().length === 0) {
    res.status(400).json({ error: "q query param is required" });
    return;
  }

  const userId = await getScopedUserId(req);
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const q = qRaw.trim().toLowerCase();
  const notes = await db.select().from(aiNotebookNotesTable).where(eq(aiNotebookNotesTable.notebookId, id));
  const matches = notes.filter((n) => n.content.toLowerCase().includes(q));

  res.json(matches.map(formatNote));
});

// ─── Notes (rich-text notes / AI summaries / findings / action items / references / saved AI responses) ───

router.get("/ai-notebooks/:id/notes", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const notes = await db.select().from(aiNotebookNotesTable).where(eq(aiNotebookNotesTable.notebookId, id)).orderBy(desc(aiNotebookNotesTable.createdAt));
  res.json(notes.map(formatNote));
});

router.post("/ai-notebooks/:id/notes", async (req, res): Promise<void> => {
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
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const [row] = await db
    .insert(aiNotebookNotesTable)
    .values({ notebookId: id, kind: parsed.data.kind, content: parsed.data.content })
    .returning();

  await db.update(aiNotebooksTable).set({ updatedAt: new Date() }).where(eq(aiNotebooksTable.id, id));

  res.status(201).json(formatNote(row));
});

router.delete("/ai-notebooks/:id/notes/:noteId", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const noteId = parseIdParam(req.params.noteId);
  if (id === null || noteId === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const [row] = await db
    .delete(aiNotebookNotesTable)
    .where(and(eq(aiNotebookNotesTable.id, noteId), eq(aiNotebookNotesTable.notebookId, id)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.status(204).send();
});

// ─── Links (conversations / uploaded file references) ──────────────────

router.get("/ai-notebooks/:id/links", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const links = await db.select().from(aiNotebookLinksTable).where(eq(aiNotebookLinksTable.notebookId, id));
  const resolved = await Promise.all(
    links.map(async (link) => {
      if (link.linkType === "conversation" && link.conversationId != null) {
        const [conversation] = await db.select().from(aiCoachConversationsTable).where(eq(aiCoachConversationsTable.id, link.conversationId));
        return formatLink(link, conversation ?? null, null);
      }
      if (link.linkType === "file" && link.fileId != null) {
        const [file] = await db.select().from(aiWorkspaceFilesTable).where(eq(aiWorkspaceFilesTable.id, link.fileId));
        return formatLink(link, null, file ?? null);
      }
      return formatLink(link, null, null);
    }),
  );

  res.json(resolved);
});

// POST /ai-notebooks/:id/links {linkType, conversationId?, fileId?}
router.post("/ai-notebooks/:id/links", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = parseCreateLinkBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  if (parsed.data.linkType === "conversation") {
    const conversation = await loadOwnedConversation(parsed.data.conversationId!, userId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    if (conversation.coachId !== notebook.coachId) {
      res.status(400).json({ error: "Conversation belongs to a different coach" });
      return;
    }
    const [row] = await db
      .insert(aiNotebookLinksTable)
      .values({ notebookId: id, linkType: "conversation", conversationId: conversation.id })
      .returning();
    res.status(201).json(formatLink(row, conversation, null));
    return;
  }

  // linkType === "file" — ownership of a workspace file is transitive via
  // its own parent workspace's userId; its coach must also match this
  // notebook's own coachId, the same per-coach isolation discipline every
  // other link/assignment in this codebase already enforces.
  const [file] = await db.select().from(aiWorkspaceFilesTable).where(eq(aiWorkspaceFilesTable.id, parsed.data.fileId!));
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const fileWorkspace = await loadOwnedWorkspace(file.workspaceId, userId);
  if (!fileWorkspace) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  if (fileWorkspace.coachId !== notebook.coachId) {
    res.status(400).json({ error: "File belongs to a different coach's workspace" });
    return;
  }
  const [row] = await db.insert(aiNotebookLinksTable).values({ notebookId: id, linkType: "file", fileId: file.id }).returning();
  res.status(201).json(formatLink(row, null, file));
});

router.delete("/ai-notebooks/:id/links/:linkId", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  const linkId = parseIdParam(req.params.linkId);
  if (id === null || linkId === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const [row] = await db
    .delete(aiNotebookLinksTable)
    .where(and(eq(aiNotebookLinksTable.id, linkId), eq(aiNotebookLinksTable.notebookId, id)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  res.status(204).send();
});

// ─── AI features — every one an explicit, user-triggered POST; none run
// proactively, and none saves its own output automatically. Saving an AI
// response into the notebook is always a separate, explicit
// POST .../notes call the caller makes afterward. ──────────────────────

router.post("/ai-notebooks/:id/ai/summarize", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const context = await buildNotebookContext(notebook);
  const fallback =
    context.notes.length === 0
      ? "This notebook has no notes yet — add some research to generate a summary."
      : `"${notebook.title}" contains ${context.notes.length} saved item${context.notes.length === 1 ? "" : "s"}.`;
  const narration = await narrateNotebookSummary(context, fallback);
  res.json({ summary: narration.text, source: narration.source });
});

router.post("/ai-notebooks/:id/ai/merge", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const allNotes = await db.select().from(aiNotebookNotesTable).where(eq(aiNotebookNotesTable.notebookId, id)).orderBy(desc(aiNotebookNotesTable.createdAt));
  const rawNotes = allNotes.filter((n) => n.kind === "note" || n.kind === "saved_response").map((n) => n.content);
  const fallback = rawNotes.length === 0 ? "There are no notes to merge yet." : rawNotes.join(" ");
  const narration = await narrateNotebookMergedSummary({ notes: rawNotes }, fallback);
  res.json({ summary: narration.text, source: narration.source });
});

router.post("/ai-notebooks/:id/ai/takeaways", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const context = await buildNotebookContext(notebook);
  const takeaways = await generateNotebookKeyTakeaways(context);
  res.json({ available: takeaways !== null, takeaways: takeaways ?? [] });
});

router.post("/ai-notebooks/:id/ai/action-items", async (req, res): Promise<void> => {
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const notebook = await loadOwnedNotebook(id, userId);
  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const context = await buildNotebookContext(notebook);
  const actionItems = await generateNotebookActionItems(context);
  res.json({ available: actionItems !== null, actionItems: actionItems ?? [] });
});

export default router;

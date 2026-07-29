// v1.5.0, Sprint 6 — AI Coach Memory.
//
// Persistent conversation memory for the three existing conversational AI
// Coaches (Trading, Investing, Options) built on top of the AI Coach
// Framework consolidated in Sprints 1-5. Portfolio has no conversational
// coach (Sprint 3's own exhaustive finding) and has nothing registered here.
//
// This is a deliberately self-contained, additive REST surface — it never
// touches routes/tradingCoach.ts, routes/stockAnalyst.ts, or routes/ai.ts
// (the three existing ask/ask-stream routes, their prompts, or their
// narration logic are all completely unmodified this sprint). Persistence
// is driven entirely from the frontend: once a specialist coach's
// useSpecialistCoach(...) `onAnswered` callback fires with a completed
// turn (the exact, pre-existing extension point every specialist coach
// page already accepts, per useCoachConversation.ts's own doc comment on
// pages "whose history is server-persisted"), the page persists the
// user's question and the assistant's final answer here as two ordinary
// messages. This keeps the actual ask/stream request/response contracts,
// system prompts, and tool/capability permissions of all three coaches
// byte-for-byte unchanged.
//
// Deliberately kept outside the OpenAPI/orval typed contract, mirroring
// coach-stream.ts's and explain-fetch.ts's own established precedent for
// additive, self-contained routes — this avoids a large, higher-risk
// codegen regeneration for a single sprint. Request bodies are still
// fully validated below via small, plain, hand-written checks (no schema
// library) — api-server has no existing runtime dependency on zod itself
// (only on already-generated @workspace/api-zod schemas), and introducing
// one here was found, during this sprint's own validation, to shift the
// zod version pnpm resolves as openai's/@anthropic-ai/sdk's own optional
// peer dependency inside this package — which broke several completely
// unrelated, pre-existing coach-LLM-mocking tests (coach-level.test.ts,
// coach-slowload.test.ts, coachLLM.envMigration.test.ts,
// coachLLM.freeformPromptLoader.test.ts, managementAnalysis.llmDimensions.
// test.ts), confirmed via a real pnpm install A/B comparison. Plain
// manual validation avoids that risk entirely while still rejecting every
// malformed request the same way.
//
// Every list/read/write is scoped by (user_id, coach_id) together — this
// is what guarantees "Trading conversations must never appear in
// Investing. Investing conversations must never appear in Options," and
// generalizes to full pairwise isolation across all three coaches, per
// the approved Sprint 6 scope. 404, never a separate 403, for both
// "doesn't exist" and "isn't yours" / "belongs to a different coach" —
// matching every route in this codebase since Sprint 7.
//
// Never stores an internal system prompt, a tool/grounding-context
// payload, or a secret — only the final, already-narrated question/answer
// text a user actually sees.

import { Router, type IRouter } from "express";
import { db, aiCoachConversationsTable, aiCoachMessagesTable, aiWorkspacesTable } from "@workspace/db";
import { and, eq, desc, asc } from "drizzle-orm";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

export const COACH_IDS = ["trading", "investing", "options"] as const;
export type CoachId = (typeof COACH_IDS)[number];

const DEFAULT_TITLE = "New conversation";
/** Truncation length for an auto-generated title derived from the first
 * user message — long enough to be recognizable in a sidebar list, short
 * enough to never wrap awkwardly. */
const AUTO_TITLE_MAX_LENGTH = 60;

function isCoachId(value: unknown): value is CoachId {
  return typeof value === "string" && (COACH_IDS as readonly string[]).includes(value);
}

/** Derives a short, single-line title from a user's first message —
 * collapses whitespace/newlines, then truncates with an ellipsis. Never
 * fabricates content beyond what the user actually typed. */
export function deriveTitleFromMessage(content: string): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return DEFAULT_TITLE;
  if (collapsed.length <= AUTO_TITLE_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, AUTO_TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

function formatConversation(row: typeof aiCoachConversationsTable.$inferSelect) {
  return {
    id: row.id,
    coachId: row.coachId,
    title: row.title,
    archived: row.archived,
    // v1.5.0 Sprint 7 — AI Workspaces: additive fields, never present
    // before this sprint. workspaceId is honestly null (never fabricated)
    // for every conversation that isn't a member of a workspace.
    workspaceId: row.workspaceId ?? null,
    favourite: row.favourite,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// v1.5.0 Sprint 7 — AI Workspaces. The one place a new ai_coach_conversations
// row is ever inserted — reused by both POST /coach-conversations (below)
// and routes/aiWorkspaces.ts's own "start a new conversation in this
// workspace" endpoint, so the two call sites can never drift apart.
export async function createConversationRow(
  userId: string,
  coachId: CoachId,
  title?: string,
  workspaceId?: number | null,
) {
  const [row] = await db
    .insert(aiCoachConversationsTable)
    .values({
      userId,
      coachId,
      title: title ?? DEFAULT_TITLE,
      workspaceId: workspaceId ?? null,
    })
    .returning();
  return row;
}

function formatMessage(row: typeof aiCoachMessagesTable.$inferSelect) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

const TITLE_MAX_LENGTH = 200;

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Trims a string and enforces a non-empty, bounded-length title — the one
 * shape both the create and update bodies need for `title`. */
function parseOptionalTitle(value: unknown): ValidationResult<string | undefined> {
  if (value === undefined) return { success: true, data: undefined };
  if (typeof value !== "string") return { success: false, error: "title must be a string" };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { success: false, error: "title must not be empty" };
  if (trimmed.length > TITLE_MAX_LENGTH) {
    return { success: false, error: `title must be at most ${TITLE_MAX_LENGTH} characters` };
  }
  return { success: true, data: trimmed };
}

/** Accepts either a real integer or the literal `null` (meaning "no
 * workspace" / "unassign") — undefined means "field omitted entirely",
 * genuinely distinct from an explicit null in the update body. */
function parseOptionalWorkspaceId(value: unknown): ValidationResult<number | null | undefined> {
  if (value === undefined) return { success: true, data: undefined };
  if (value === null) return { success: true, data: null };
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { success: false, error: "workspaceId must be an integer or null" };
  }
  return { success: true, data: value };
}

function parseCreateConversationBody(
  body: unknown,
): ValidationResult<{ coachId: CoachId; title?: string; workspaceId?: number | null }> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  if (!isCoachId(b.coachId)) {
    return { success: false, error: `coachId is required and must be one of: ${COACH_IDS.join(", ")}` };
  }
  const title = parseOptionalTitle(b.title);
  if (!title.success) return { success: false, error: title.error };
  const workspaceId = parseOptionalWorkspaceId(b.workspaceId);
  if (!workspaceId.success) return { success: false, error: workspaceId.error };
  return { success: true, data: { coachId: b.coachId, title: title.data, workspaceId: workspaceId.data } };
}

function parseUpdateConversationBody(
  body: unknown,
): ValidationResult<{ title?: string; archived?: boolean; favourite?: boolean; workspaceId?: number | null }> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  const title = parseOptionalTitle(b.title);
  if (!title.success) return { success: false, error: title.error };
  let archived: boolean | undefined;
  if (b.archived !== undefined) {
    if (typeof b.archived !== "boolean") return { success: false, error: "archived must be a boolean" };
    archived = b.archived;
  }
  let favourite: boolean | undefined;
  if (b.favourite !== undefined) {
    if (typeof b.favourite !== "boolean") return { success: false, error: "favourite must be a boolean" };
    favourite = b.favourite;
  }
  const workspaceId = parseOptionalWorkspaceId(b.workspaceId);
  if (!workspaceId.success) return { success: false, error: workspaceId.error };
  if (title.data === undefined && archived === undefined && favourite === undefined && workspaceId.data === undefined) {
    return { success: false, error: "At least one of title, archived, favourite, or workspaceId must be provided." };
  }
  return { success: true, data: { title: title.data, archived, favourite, workspaceId: workspaceId.data } };
}

const MESSAGE_ROLES = ["user", "assistant"] as const;
type MessageRole = (typeof MESSAGE_ROLES)[number];

function parseCreateMessageBody(body: unknown): ValidationResult<{ role: MessageRole; content: string }> {
  if (typeof body !== "object" || body === null) return { success: false, error: "request body is required" };
  const b = body as Record<string, unknown>;
  if (typeof b.role !== "string" || !(MESSAGE_ROLES as readonly string[]).includes(b.role)) {
    return { success: false, error: `role is required and must be one of: ${MESSAGE_ROLES.join(", ")}` };
  }
  if (typeof b.content !== "string" || b.content.trim().length === 0) {
    return { success: false, error: "content is required and must be a non-empty string" };
  }
  return { success: true, data: { role: b.role as MessageRole, content: b.content.trim() } };
}

function parseCoachIdQuery(raw: unknown): CoachId | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isCoachId(value) ? value : null;
}

// v1.5.0 Sprint 8 — AI Research Notebooks. Exported (previously private)
// so routes/aiNotebooks.ts can validate a conversation belongs to the
// requesting user before linking it — the exact same ownership check this
// file's own routes already used, not duplicated.
export async function loadOwnedConversation(id: number, userId: string) {
  const [row] = await db
    .select()
    .from(aiCoachConversationsTable)
    .where(and(eq(aiCoachConversationsTable.id, id), eq(aiCoachConversationsTable.userId, userId)));
  return row ?? null;
}

// v1.5.0 Sprint 7 — AI Workspaces. Shared by both this file's own
// POST/PATCH /coach-conversations handlers and routes/aiWorkspaces.ts.
export async function loadOwnedWorkspace(id: number, userId: string) {
  const [row] = await db
    .select()
    .from(aiWorkspacesTable)
    .where(and(eq(aiWorkspacesTable.id, id), eq(aiWorkspacesTable.userId, userId)));
  return row ?? null;
}

// GET /coach-conversations?coachId=trading&search=&includeArchived=true&workspaceId=5
router.get("/coach-conversations", async (req, res): Promise<void> => {
  const coachId = parseCoachIdQuery(req.query.coachId);
  if (!coachId) {
    res.status(400).json({ error: `coachId query param is required and must be one of: ${COACH_IDS.join(", ")}` });
    return;
  }

  const userId = await getScopedUserId(req);
  const includeArchived = req.query.includeArchived === "true";

  // v1.5.0 Sprint 7 — AI Workspaces: an optional, additive scoping filter.
  // Omitting it preserves Sprint 6's own original behavior byte-for-byte
  // (every one of the coach's conversations, workspace member or not).
  const workspaceIdRaw = Array.isArray(req.query.workspaceId) ? req.query.workspaceId[0] : req.query.workspaceId;
  let workspaceIdFilter: number | undefined;
  if (typeof workspaceIdRaw === "string" && workspaceIdRaw.length > 0) {
    const parsedWorkspaceId = parseInt(workspaceIdRaw, 10);
    if (isNaN(parsedWorkspaceId)) {
      res.status(400).json({ error: "workspaceId query param must be an integer" });
      return;
    }
    workspaceIdFilter = parsedWorkspaceId;
  }

  const rows = await db
    .select()
    .from(aiCoachConversationsTable)
    .where(
      and(
        eq(aiCoachConversationsTable.userId, userId),
        eq(aiCoachConversationsTable.coachId, coachId),
        ...(workspaceIdFilter !== undefined ? [eq(aiCoachConversationsTable.workspaceId, workspaceIdFilter)] : []),
      ),
    )
    .orderBy(desc(aiCoachConversationsTable.updatedAt));

  const visible = includeArchived ? rows : rows.filter((r) => !r.archived);

  const searchRaw = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
  const search = typeof searchRaw === "string" ? searchRaw.trim().toLowerCase() : "";
  const filtered = search ? visible.filter((r) => r.title.toLowerCase().includes(search)) : visible;

  res.json(filtered.map(formatConversation));
});

// POST /coach-conversations {coachId, title?, workspaceId?}
router.post("/coach-conversations", async (req, res): Promise<void> => {
  const parsed = parseCreateConversationBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);

  // v1.5.0 Sprint 7 — AI Workspaces: if a workspaceId was supplied, it
  // must be owned by this user and belong to the same coach — a Trading
  // conversation can never be filed under an Investing workspace.
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

  const row = await createConversationRow(userId, parsed.data.coachId, parsed.data.title, parsed.data.workspaceId);

  res.status(201).json(formatConversation(row));
});

// GET /coach-conversations/:id/messages — ordered oldest to newest, the
// correct order to resume and render a conversation.
router.get("/coach-conversations/:id/messages", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const conversation = await loadOwnedConversation(id, userId);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db
    .select()
    .from(aiCoachMessagesTable)
    .where(eq(aiCoachMessagesTable.conversationId, id))
    .orderBy(asc(aiCoachMessagesTable.createdAt));

  res.json(messages.map(formatMessage));
});

// POST /coach-conversations/:id/messages {role, content}
//
// Appends a single turn's message and bumps the conversation's
// updated_at (so "last updated" sorting/display reflects real activity).
// If this is the conversation's very first message and the title is
// still the default sentinel, auto-derives the title from it —
// "Automatic title generation from first prompt," in one place.
router.post("/coach-conversations/:id/messages", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = parseCreateMessageBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);
  const conversation = await loadOwnedConversation(id, userId);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const existingCount = await db
    .select({ id: aiCoachMessagesTable.id })
    .from(aiCoachMessagesTable)
    .where(eq(aiCoachMessagesTable.conversationId, id));

  const [message] = await db
    .insert(aiCoachMessagesTable)
    .values({ conversationId: id, role: parsed.data.role, content: parsed.data.content })
    .returning();

  const isFirstMessage = existingCount.length === 0;
  const shouldAutoTitle = isFirstMessage && parsed.data.role === "user" && conversation.title === DEFAULT_TITLE;

  await db
    .update(aiCoachConversationsTable)
    .set({
      updatedAt: new Date(),
      ...(shouldAutoTitle ? { title: deriveTitleFromMessage(parsed.data.content) } : {}),
    })
    .where(eq(aiCoachConversationsTable.id, id));

  res.status(201).json(formatMessage(message));
});

// PATCH /coach-conversations/:id {title?, archived?, favourite?, workspaceId?}
// — rename, archive, favourite/unfavourite, and/or assign/unassign a
// workspace (workspaceId: null unassigns).
router.patch("/coach-conversations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = parseUpdateConversationBody(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const userId = await getScopedUserId(req);

  // v1.5.0 Sprint 7 — AI Workspaces: assigning (not unassigning) requires
  // the conversation to already exist and the target workspace to belong
  // to this user and this same coach.
  if (parsed.data.workspaceId !== undefined && parsed.data.workspaceId !== null) {
    const conversation = await loadOwnedConversation(id, userId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const workspace = await loadOwnedWorkspace(parsed.data.workspaceId, userId);
    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    if (workspace.coachId !== conversation.coachId) {
      res.status(400).json({ error: "Workspace belongs to a different coach" });
      return;
    }
  }

  const [row] = await db
    .update(aiCoachConversationsTable)
    .set({
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.archived !== undefined ? { archived: parsed.data.archived } : {}),
      ...(parsed.data.favourite !== undefined ? { favourite: parsed.data.favourite } : {}),
      ...(parsed.data.workspaceId !== undefined ? { workspaceId: parsed.data.workspaceId } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(aiCoachConversationsTable.id, id), eq(aiCoachConversationsTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.json(formatConversation(row));
});

// DELETE /coach-conversations/:id — cascades its own messages (ON DELETE
// CASCADE, migration 039).
router.delete("/coach-conversations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(aiCoachConversationsTable)
    .where(and(eq(aiCoachConversationsTable.id, id), eq(aiCoachConversationsTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.status(204).send();
});

export default router;

// v1.5.0 Sprint 8 — AI Research Notebooks. Plain-fetch client for the new
// GET/POST/PATCH/DELETE /ai-notebooks[...] routes
// (artifacts/api-server/src/routes/aiNotebooks.ts), mirroring
// workspacesApi.ts's own established plain-fetch pattern (Sprint 7) for the
// same reason: a small, additive, self-contained CRUD surface, not worth a
// full OpenAPI/orval regeneration.

import type { CoachId } from "./capabilityRegistry";

const API_PREFIX = "/api";

export type NotebookNoteKind = "note" | "summary" | "finding" | "action_item" | "reference" | "saved_response";
export type NotebookLinkType = "conversation" | "file";

export interface AiNotebook {
  id: number;
  coachId: CoachId;
  workspaceId: number | null;
  title: string;
  description: string | null;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiNotebookNote {
  id: number;
  notebookId: number;
  kind: NotebookNoteKind;
  content: string;
  createdAt: string;
}

export interface AiNotebookLink {
  id: number;
  notebookId: number;
  linkType: NotebookLinkType;
  conversation: { id: number; title: string } | null;
  file: { id: number; fileName: string; fileUrl: string } | null;
  createdAt: string;
}

export interface AiNotebookDetail extends AiNotebook {
  notes: AiNotebookNote[];
  links: AiNotebookLink[];
}

export interface NotebookNarration {
  summary: string;
  source: string;
}

export interface NotebookExtractionResult {
  available: boolean;
  takeaways?: string[];
  actionItems?: string[];
}

export class AiNotebooksApiError extends Error {}

async function parseOrThrow<T>(res: Response, fallbackMessage: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiNotebooksApiError(body.error ?? fallbackMessage);
  }
  return res.json();
}

export async function listNotebooks(
  coachId: CoachId,
  options?: { workspaceId?: number; search?: string; includeArchived?: boolean },
): Promise<AiNotebook[]> {
  const params = new URLSearchParams({ coachId });
  if (options?.workspaceId != null) params.set("workspaceId", String(options.workspaceId));
  if (options?.search) params.set("search", options.search);
  if (options?.includeArchived) params.set("includeArchived", "true");
  const res = await fetch(`${API_PREFIX}/ai-notebooks?${params.toString()}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load notebooks");
}

export async function createNotebook(
  coachId: CoachId,
  input: { title: string; description?: string; tags?: string[]; workspaceId?: number | null },
): Promise<AiNotebook> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ coachId, ...input }),
  });
  return parseOrThrow(res, "Failed to create notebook");
}

export async function getNotebook(id: number): Promise<AiNotebookDetail> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${id}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load notebook");
}

export interface NotebookUpdateInput {
  title?: string;
  description?: string;
  tags?: string[];
  pinned?: boolean;
  archived?: boolean;
  workspaceId?: number | null;
}

export async function updateNotebook(id: number, input: NotebookUpdateInput): Promise<AiNotebook> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res, "Failed to update notebook");
}

export async function deleteNotebook(id: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiNotebooksApiError(body.error ?? "Failed to delete notebook");
  }
}

export async function searchNotebookContents(notebookId: number, q: string): Promise<AiNotebookNote[]> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/search?q=${encodeURIComponent(q)}`, {
    headers: { accept: "application/json" },
  });
  return parseOrThrow(res, "Failed to search notebook contents");
}

export async function listNotebookNotes(notebookId: number): Promise<AiNotebookNote[]> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/notes`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load notes");
}

export async function addNotebookNote(notebookId: number, kind: NotebookNoteKind, content: string): Promise<AiNotebookNote> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, content }),
  });
  return parseOrThrow(res, "Failed to save note");
}

export async function deleteNotebookNote(notebookId: number, noteId: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/notes/${noteId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiNotebooksApiError(body.error ?? "Failed to delete note");
  }
}

export async function listNotebookLinks(notebookId: number): Promise<AiNotebookLink[]> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/links`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load links");
}

export async function addNotebookConversationLink(notebookId: number, conversationId: number): Promise<AiNotebookLink> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/links`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ linkType: "conversation", conversationId }),
  });
  return parseOrThrow(res, "Failed to link conversation");
}

export async function addNotebookFileLink(notebookId: number, fileId: number): Promise<AiNotebookLink> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/links`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ linkType: "file", fileId }),
  });
  return parseOrThrow(res, "Failed to link file");
}

export async function deleteNotebookLink(notebookId: number, linkId: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/links/${linkId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiNotebooksApiError(body.error ?? "Failed to delete link");
  }
}

// ─── AI features — every call is explicit and user-triggered; none of
// these auto-save their own output into the notebook. ────────────────────

export async function summarizeNotebook(notebookId: number): Promise<NotebookNarration> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/ai/summarize`, { method: "POST" });
  return parseOrThrow(res, "Failed to summarise notebook");
}

export async function mergeNotebookNotes(notebookId: number): Promise<NotebookNarration> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/ai/merge`, { method: "POST" });
  return parseOrThrow(res, "Failed to merge notes");
}

export async function generateNotebookTakeaways(notebookId: number): Promise<NotebookExtractionResult> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/ai/takeaways`, { method: "POST" });
  return parseOrThrow(res, "Failed to generate takeaways");
}

export async function generateNotebookActionItems(notebookId: number): Promise<NotebookExtractionResult> {
  const res = await fetch(`${API_PREFIX}/ai-notebooks/${notebookId}/ai/action-items`, { method: "POST" });
  return parseOrThrow(res, "Failed to generate action items");
}

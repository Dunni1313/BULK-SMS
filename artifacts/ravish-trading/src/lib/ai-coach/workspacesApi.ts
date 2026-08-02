// v1.5.0 Sprint 7 — AI Workspaces. Plain-fetch client for the new
// GET/POST/PATCH/DELETE /ai-workspaces[...] routes
// (artifacts/api-server/src/routes/aiWorkspaces.ts), mirroring
// coachConversationsApi.ts's own established plain-fetch pattern (Sprint 6)
// for the same reason: this is a small, additive, self-contained CRUD
// surface, not worth a full OpenAPI/orval regeneration.

import type { CoachId } from "./capabilityRegistry";

const API_PREFIX = "/api";

export type WorkspaceNoteKind = "note" | "summary" | "conclusion" | "action_item";

export interface AiWorkspace {
  id: number;
  coachId: CoachId;
  name: string;
  description: string | null;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AiWorkspaceConversationSummary {
  id: number;
  title: string;
  archived: boolean;
  favourite: boolean;
  updatedAt: string;
}

export interface AiWorkspaceFile {
  id: number;
  workspaceId: number;
  fileName: string;
  fileUrl: string;
  note: string | null;
  createdAt: string;
}

export interface AiWorkspaceNote {
  id: number;
  workspaceId: number;
  kind: WorkspaceNoteKind;
  content: string;
  createdAt: string;
}

export interface AiWorkspaceDetail extends AiWorkspace {
  conversations: AiWorkspaceConversationSummary[];
  files: AiWorkspaceFile[];
  notes: AiWorkspaceNote[];
}

export class AiWorkspacesApiError extends Error {}

async function parseOrThrow<T>(res: Response, fallbackMessage: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiWorkspacesApiError(body.error ?? fallbackMessage);
  }
  return res.json();
}

export async function listWorkspaces(
  coachId: CoachId,
  options?: { search?: string; includeArchived?: boolean },
): Promise<AiWorkspace[]> {
  const params = new URLSearchParams({ coachId });
  if (options?.search) params.set("search", options.search);
  if (options?.includeArchived) params.set("includeArchived", "true");
  const res = await fetch(`${API_PREFIX}/ai-workspaces?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  return parseOrThrow(res, "Failed to load workspaces");
}

export async function createWorkspace(
  coachId: CoachId,
  input: { name: string; description?: string; tags?: string[] },
): Promise<AiWorkspace> {
  const res = await fetch(`${API_PREFIX}/ai-workspaces`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ coachId, ...input }),
  });
  return parseOrThrow(res, "Failed to create workspace");
}

export async function getWorkspace(id: number): Promise<AiWorkspaceDetail> {
  const res = await fetch(`${API_PREFIX}/ai-workspaces/${id}`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load workspace");
}

export interface WorkspaceUpdateInput {
  name?: string;
  description?: string;
  tags?: string[];
  pinned?: boolean;
  archived?: boolean;
}

export async function updateWorkspace(id: number, input: WorkspaceUpdateInput): Promise<AiWorkspace> {
  const res = await fetch(`${API_PREFIX}/ai-workspaces/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res, "Failed to update workspace");
}

export async function deleteWorkspace(id: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/ai-workspaces/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiWorkspacesApiError(body.error ?? "Failed to delete workspace");
  }
}

export async function startWorkspaceConversation(
  workspaceId: number,
  title?: string,
): Promise<AiWorkspaceConversationSummary> {
  const res = await fetch(`${API_PREFIX}/ai-workspaces/${workspaceId}/conversations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(title ? { title } : {}),
  });
  return parseOrThrow(res, "Failed to start a conversation in this workspace");
}

export async function listWorkspaceFiles(workspaceId: number): Promise<AiWorkspaceFile[]> {
  const res = await fetch(`${API_PREFIX}/ai-workspaces/${workspaceId}/files`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load file references");
}

export async function addWorkspaceFile(
  workspaceId: number,
  input: { fileName: string; fileUrl: string; note?: string },
): Promise<AiWorkspaceFile> {
  const res = await fetch(`${API_PREFIX}/ai-workspaces/${workspaceId}/files`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res, "Failed to add file reference");
}

export async function deleteWorkspaceFile(workspaceId: number, fileId: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/ai-workspaces/${workspaceId}/files/${fileId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiWorkspacesApiError(body.error ?? "Failed to delete file reference");
  }
}

export async function listWorkspaceNotes(workspaceId: number): Promise<AiWorkspaceNote[]> {
  const res = await fetch(`${API_PREFIX}/ai-workspaces/${workspaceId}/notes`, { headers: { accept: "application/json" } });
  return parseOrThrow(res, "Failed to load notes");
}

export async function addWorkspaceNote(
  workspaceId: number,
  kind: WorkspaceNoteKind,
  content: string,
): Promise<AiWorkspaceNote> {
  const res = await fetch(`${API_PREFIX}/ai-workspaces/${workspaceId}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, content }),
  });
  return parseOrThrow(res, "Failed to save note");
}

export async function deleteWorkspaceNote(workspaceId: number, noteId: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/ai-workspaces/${workspaceId}/notes/${noteId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AiWorkspacesApiError(body.error ?? "Failed to delete note");
  }
}

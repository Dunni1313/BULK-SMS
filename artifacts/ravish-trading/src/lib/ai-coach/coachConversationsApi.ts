// v1.5.0 Sprint 6 — AI Coach Memory. Plain-fetch client for the new
// GET/POST/PATCH/DELETE /coach-conversations[...] routes
// (artifacts/api-server/src/routes/aiCoachConversations.ts). Deliberately
// kept outside the OpenAPI/orval typed contract, mirroring
// coach-stream.ts's and explain-fetch.ts's own established plain-fetch
// pattern for additive, self-contained routes — this file is the API_PREFIX
// convention those two already use, applied to a small ordinary CRUD
// surface rather than SSE.
//
// v1.5.0 Sprint 7 — AI Workspaces: additive fields/params only (workspaceId
// on the conversation shape and as an optional list filter/create param,
// favourite as a togglable flag) — every pre-existing export's signature
// and default behavior (omit the new params entirely) is unchanged.

import type { CoachId } from "./capabilityRegistry";

const API_PREFIX = "/api";

export interface CoachConversation {
  id: number;
  coachId: CoachId;
  title: string;
  archived: boolean;
  /** v1.5.0 Sprint 7 — AI Workspaces: null when not a member of any workspace. */
  workspaceId: number | null;
  /** v1.5.0 Sprint 7 — AI Workspaces. */
  favourite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoachConversationMessage {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export class CoachConversationsApiError extends Error {}

async function parseOrThrow<T>(res: Response, fallbackMessage: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new CoachConversationsApiError(body.error ?? fallbackMessage);
  }
  return res.json();
}

export async function listConversations(
  coachId: CoachId,
  options?: { search?: string; includeArchived?: boolean; workspaceId?: number },
): Promise<CoachConversation[]> {
  const params = new URLSearchParams({ coachId });
  if (options?.search) params.set("search", options.search);
  if (options?.includeArchived) params.set("includeArchived", "true");
  if (options?.workspaceId != null) params.set("workspaceId", String(options.workspaceId));
  const res = await fetch(`${API_PREFIX}/coach-conversations?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  return parseOrThrow(res, "Failed to load conversations");
}

export async function createConversation(coachId: CoachId, title?: string, workspaceId?: number): Promise<CoachConversation> {
  const res = await fetch(`${API_PREFIX}/coach-conversations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ coachId, ...(title ? { title } : {}), ...(workspaceId != null ? { workspaceId } : {}) }),
  });
  return parseOrThrow(res, "Failed to create conversation");
}

export async function renameConversation(id: number, title: string): Promise<CoachConversation> {
  const res = await fetch(`${API_PREFIX}/coach-conversations/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return parseOrThrow(res, "Failed to rename conversation");
}

/** v1.5.0 Sprint 7 — AI Workspaces. */
export async function setConversationFavourite(id: number, favourite: boolean): Promise<CoachConversation> {
  const res = await fetch(`${API_PREFIX}/coach-conversations/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ favourite }),
  });
  return parseOrThrow(res, "Failed to update favourite");
}

/** v1.5.0 Sprint 7 — AI Workspaces. Pass null to unassign (detach) a
 * conversation from its workspace without deleting it. */
export async function assignConversationToWorkspace(id: number, workspaceId: number | null): Promise<CoachConversation> {
  const res = await fetch(`${API_PREFIX}/coach-conversations/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId }),
  });
  return parseOrThrow(res, "Failed to move conversation");
}

export async function deleteConversation(id: number): Promise<void> {
  const res = await fetch(`${API_PREFIX}/coach-conversations/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new CoachConversationsApiError(body.error ?? "Failed to delete conversation");
  }
}

export async function listMessages(conversationId: number): Promise<CoachConversationMessage[]> {
  const res = await fetch(`${API_PREFIX}/coach-conversations/${conversationId}/messages`, {
    headers: { accept: "application/json" },
  });
  return parseOrThrow(res, "Failed to load conversation history");
}

export async function addMessage(
  conversationId: number,
  role: "user" | "assistant",
  content: string,
): Promise<CoachConversationMessage> {
  const res = await fetch(`${API_PREFIX}/coach-conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role, content }),
  });
  return parseOrThrow(res, "Failed to save message");
}

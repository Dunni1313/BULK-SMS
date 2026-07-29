// v1.5.0 Sprint 6 — AI Coach Memory. The shared conversation-MEMORY layer
// every specialist coach page composes alongside useSpecialistCoach() (the
// Sprint 2/3 conversation-STREAMING engine, completely unmodified). This
// hook owns: the conversation list for one coachId, the active
// conversation's persisted message history, and CRUD actions — while
// useSpecialistCoach()'s own `onAnswered` extension point (already
// supported since Sprint 3, never modified) is the single place a page
// wires the two together, exactly matching useCoachConversation.ts's own
// documented pattern for "a page whose history is server-persisted."
//
// "New Chat" deliberately does NOT eagerly insert a database row — it only
// clears the active selection. A conversation row is created lazily, the
// first time persistTurn() actually has a completed turn to save. This
// keeps a user idly clicking "New Chat" from cluttering their own
// conversation list with empty, never-used rows.
//
// v1.5.0 Sprint 7 — AI Workspaces: this hook gained one new, optional
// `workspaceId` parameter. Omitting it (every pre-Sprint-7 call site)
// preserves the exact original behavior byte-for-byte — every conversation
// for the coach, workspace member or not. When provided, the conversation
// list is scoped to that workspace only (via the /coach-conversations
// route's own new, additive `?workspaceId=` filter — see
// aiCoachConversations.ts), and any conversation created through this hook
// while a workspaceId is active is pre-assigned to it.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CoachTurn } from "./types";
import type { CoachId } from "./capabilityRegistry";
import {
  type CoachConversation,
  type CoachConversationMessage,
  listConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  listMessages,
  addMessage,
  setConversationFavourite,
  assignConversationToWorkspace,
} from "./coachConversationsApi";

export interface UseCoachConversationsResult {
  conversations: CoachConversation[];
  isLoadingConversations: boolean;
  /** null means "no conversation selected" — a fresh/new chat state. */
  activeConversationId: number | null;
  activeMessages: CoachConversationMessage[];
  isLoadingMessages: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  /** Clears the active selection — does not create a row until the first
   * turn is actually persisted. */
  startNewConversation: () => void;
  selectConversation: (id: number) => void;
  renameConversationById: (id: number, title: string) => Promise<void>;
  deleteConversationById: (id: number) => Promise<void>;
  /** v1.5.0 Sprint 7 — AI Workspaces. */
  toggleFavouriteById: (id: number, favourite: boolean) => Promise<void>;
  /** v1.5.0 Sprint 7 — AI Workspaces. Pass null to unassign. */
  assignConversationToWorkspaceById: (id: number, workspaceId: number | null) => Promise<void>;
  /** Wire this into useSpecialistCoach(config, params, { onAnswered }). */
  persistTurn: (turn: CoachTurn) => Promise<void>;
  error: string | null;
}

export function useCoachConversations(coachId: CoachId, workspaceId?: number): UseCoachConversationsResult {
  const [conversations, setConversations] = useState<CoachConversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [activeMessages, setActiveMessages] = useState<CoachConversationMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // A ref mirror so persistTurn() (invoked asynchronously from
  // onAnswered, well after any render that set state) always reads the
  // truly-current selection rather than a value captured at hook-call time.
  const activeConversationIdRef = useRef<number | null>(null);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const refreshList = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      // Preserve the exact pre-Sprint-7 call shape (a bare `undefined`
      // second argument) whenever neither a search term nor a workspace
      // filter is active — a behavior-preserving detail, not just cosmetic.
      const hasFilter = !!searchTerm || workspaceId != null;
      const options = hasFilter
        ? { ...(searchTerm ? { search: searchTerm } : {}), ...(workspaceId != null ? { workspaceId } : {}) }
        : undefined;
      const list = await listConversations(coachId, options);
      setConversations(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setIsLoadingConversations(false);
    }
  }, [coachId, searchTerm, workspaceId]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const refreshMessages = useCallback(async (id: number) => {
    setIsLoadingMessages(true);
    try {
      const messages = await listMessages(id);
      setActiveMessages(messages);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation history");
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const selectConversation = useCallback(
    (id: number) => {
      setActiveConversationId(id);
      refreshMessages(id);
    },
    [refreshMessages],
  );

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setActiveMessages([]);
  }, []);

  const renameConversationById = useCallback(
    async (id: number, title: string) => {
      await renameConversation(id, title);
      await refreshList();
    },
    [refreshList],
  );

  const deleteConversationById = useCallback(
    async (id: number) => {
      await deleteConversation(id);
      if (activeConversationIdRef.current === id) {
        setActiveConversationId(null);
        setActiveMessages([]);
      }
      await refreshList();
    },
    [refreshList],
  );

  /** v1.5.0 Sprint 7 — AI Workspaces. */
  const toggleFavouriteById = useCallback(
    async (id: number, favourite: boolean) => {
      await setConversationFavourite(id, favourite);
      await refreshList();
    },
    [refreshList],
  );

  /** v1.5.0 Sprint 7 — AI Workspaces. Assigning/unassigning a workspace may
   * move a conversation out of the current filtered view (e.g. this hook
   * is scoped to a specific workspace and the conversation is reassigned
   * elsewhere) — refreshList() naturally drops it from the list in that
   * case, which is the correct behavior. */
  const assignConversationToWorkspaceById = useCallback(
    async (id: number, targetWorkspaceId: number | null) => {
      await assignConversationToWorkspace(id, targetWorkspaceId);
      await refreshList();
    },
    [refreshList],
  );

  const persistTurn = useCallback(
    async (turn: CoachTurn) => {
      try {
        let id = activeConversationIdRef.current;
        if (id == null) {
          // v1.5.0 Sprint 7 — AI Workspaces: a conversation lazily created
          // while a workspace is active is pre-assigned to it, so it shows
          // up in that workspace's own conversation list immediately.
          // Preserves the exact pre-Sprint-7 single-argument call shape
          // when no workspace is active.
          const created = workspaceId != null ? await createConversation(coachId, undefined, workspaceId) : await createConversation(coachId);
          id = created.id;
          setActiveConversationId(id);
        }
        await addMessage(id, "user", turn.question);
        await addMessage(id, "assistant", turn.answer);
        await Promise.all([refreshList(), refreshMessages(id)]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save this conversation turn");
      }
    },
    [coachId, refreshList, refreshMessages, workspaceId],
  );

  return {
    conversations,
    isLoadingConversations,
    activeConversationId,
    activeMessages,
    isLoadingMessages,
    searchTerm,
    setSearchTerm,
    startNewConversation,
    selectConversation,
    renameConversationById,
    deleteConversationById,
    toggleFavouriteById,
    assignConversationToWorkspaceById,
    persistTurn,
    error,
  };
}

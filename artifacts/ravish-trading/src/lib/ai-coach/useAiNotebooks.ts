// v1.5.0 Sprint 8 — AI Research Notebooks. The notebook-MEMORY layer for
// one coachId (optionally scoped to a single workspace), mirroring
// useAiWorkspaces.ts's own established shape (Sprint 7) so the two hooks
// feel like the same family: notebook list, active notebook selection +
// its own fetched detail (notes/links), search, archive/restore, and the
// explicit, user-triggered AI actions (summarize/merge/takeaways/action
// items) — none of which is called automatically.

import { useCallback, useEffect, useState } from "react";
import type { CoachId } from "./capabilityRegistry";
import {
  type AiNotebook,
  type AiNotebookDetail,
  type NotebookNoteKind,
  type NotebookNarration,
  type NotebookExtractionResult,
  listNotebooks,
  createNotebook,
  getNotebook,
  updateNotebook,
  deleteNotebook,
  searchNotebookContents,
  addNotebookNote,
  deleteNotebookNote,
  addNotebookConversationLink,
  addNotebookFileLink,
  deleteNotebookLink,
  summarizeNotebook,
  mergeNotebookNotes,
  generateNotebookTakeaways,
  generateNotebookActionItems,
} from "./notebooksApi";

export interface UseAiNotebooksResult {
  notebooks: AiNotebook[];
  isLoadingNotebooks: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  includeArchived: boolean;
  setIncludeArchived: (value: boolean) => void;
  activeNotebookId: number | null;
  activeNotebookDetail: AiNotebookDetail | null;
  isLoadingActiveNotebook: boolean;
  selectNotebook: (id: number) => void;
  clearSelection: () => void;
  createNotebookAnd: (input: { title: string; description?: string; tags?: string[]; workspaceId?: number | null }) => Promise<AiNotebook>;
  updateNotebookById: (id: number, input: { title?: string; description?: string; tags?: string[] }) => Promise<void>;
  togglePinById: (id: number, pinned: boolean) => Promise<void>;
  toggleArchiveById: (id: number, archived: boolean) => Promise<void>;
  deleteNotebookById: (id: number) => Promise<void>;
  searchContents: (q: string) => Promise<Awaited<ReturnType<typeof searchNotebookContents>>>;
  addNote: (kind: NotebookNoteKind, content: string) => Promise<void>;
  deleteNote: (noteId: number) => Promise<void>;
  linkConversation: (conversationId: number) => Promise<void>;
  linkFile: (fileId: number) => Promise<void>;
  removeLink: (linkId: number) => Promise<void>;
  summarize: () => Promise<NotebookNarration | null>;
  mergeNotes: () => Promise<NotebookNarration | null>;
  generateTakeaways: () => Promise<NotebookExtractionResult | null>;
  generateActionItems: () => Promise<NotebookExtractionResult | null>;
  error: string | null;
}

export function useAiNotebooks(coachId: CoachId, workspaceId?: number): UseAiNotebooksResult {
  const [notebooks, setNotebooks] = useState<AiNotebook[]>([]);
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [activeNotebookId, setActiveNotebookId] = useState<number | null>(null);
  const [activeNotebookDetail, setActiveNotebookDetail] = useState<AiNotebookDetail | null>(null);
  const [isLoadingActiveNotebook, setIsLoadingActiveNotebook] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setIsLoadingNotebooks(true);
    try {
      const list = await listNotebooks(coachId, {
        ...(workspaceId != null ? { workspaceId } : {}),
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(includeArchived ? { includeArchived: true } : {}),
      });
      setNotebooks(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notebooks");
    } finally {
      setIsLoadingNotebooks(false);
    }
  }, [coachId, workspaceId, searchTerm, includeArchived]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const refreshActiveNotebook = useCallback(async (id: number) => {
    setIsLoadingActiveNotebook(true);
    try {
      const detail = await getNotebook(id);
      setActiveNotebookDetail(detail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notebook");
    } finally {
      setIsLoadingActiveNotebook(false);
    }
  }, []);

  const selectNotebook = useCallback(
    (id: number) => {
      setActiveNotebookId(id);
      refreshActiveNotebook(id);
    },
    [refreshActiveNotebook],
  );

  const clearSelection = useCallback(() => {
    setActiveNotebookId(null);
    setActiveNotebookDetail(null);
  }, []);

  const createNotebookAnd = useCallback(
    async (input: { title: string; description?: string; tags?: string[]; workspaceId?: number | null }) => {
      const created = await createNotebook(coachId, input);
      await refreshList();
      return created;
    },
    [coachId, refreshList],
  );

  const updateNotebookById = useCallback(
    async (id: number, input: { title?: string; description?: string; tags?: string[] }) => {
      await updateNotebook(id, input);
      await refreshList();
      if (activeNotebookId === id) await refreshActiveNotebook(id);
    },
    [refreshList, refreshActiveNotebook, activeNotebookId],
  );

  const togglePinById = useCallback(
    async (id: number, pinned: boolean) => {
      await updateNotebook(id, { pinned });
      await refreshList();
      if (activeNotebookId === id) await refreshActiveNotebook(id);
    },
    [refreshList, refreshActiveNotebook, activeNotebookId],
  );

  const toggleArchiveById = useCallback(
    async (id: number, archived: boolean) => {
      await updateNotebook(id, { archived });
      await refreshList();
      if (activeNotebookId === id) await refreshActiveNotebook(id);
    },
    [refreshList, refreshActiveNotebook, activeNotebookId],
  );

  const deleteNotebookById = useCallback(
    async (id: number) => {
      await deleteNotebook(id);
      if (activeNotebookId === id) {
        setActiveNotebookId(null);
        setActiveNotebookDetail(null);
      }
      await refreshList();
    },
    [refreshList, activeNotebookId],
  );

  const searchContents = useCallback(
    async (q: string) => {
      if (activeNotebookId == null) return [];
      return searchNotebookContents(activeNotebookId, q);
    },
    [activeNotebookId],
  );

  const addNote = useCallback(
    async (kind: NotebookNoteKind, content: string) => {
      if (activeNotebookId == null) return;
      await addNotebookNote(activeNotebookId, kind, content);
      await refreshActiveNotebook(activeNotebookId);
      await refreshList();
    },
    [activeNotebookId, refreshActiveNotebook, refreshList],
  );

  const deleteNote = useCallback(
    async (noteId: number) => {
      if (activeNotebookId == null) return;
      await deleteNotebookNote(activeNotebookId, noteId);
      await refreshActiveNotebook(activeNotebookId);
    },
    [activeNotebookId, refreshActiveNotebook],
  );

  const linkConversation = useCallback(
    async (conversationId: number) => {
      if (activeNotebookId == null) return;
      await addNotebookConversationLink(activeNotebookId, conversationId);
      await refreshActiveNotebook(activeNotebookId);
    },
    [activeNotebookId, refreshActiveNotebook],
  );

  const linkFile = useCallback(
    async (fileId: number) => {
      if (activeNotebookId == null) return;
      await addNotebookFileLink(activeNotebookId, fileId);
      await refreshActiveNotebook(activeNotebookId);
    },
    [activeNotebookId, refreshActiveNotebook],
  );

  const removeLink = useCallback(
    async (linkId: number) => {
      if (activeNotebookId == null) return;
      await deleteNotebookLink(activeNotebookId, linkId);
      await refreshActiveNotebook(activeNotebookId);
    },
    [activeNotebookId, refreshActiveNotebook],
  );

  const summarize = useCallback(async () => {
    if (activeNotebookId == null) return null;
    return summarizeNotebook(activeNotebookId);
  }, [activeNotebookId]);

  const mergeNotes = useCallback(async () => {
    if (activeNotebookId == null) return null;
    return mergeNotebookNotes(activeNotebookId);
  }, [activeNotebookId]);

  const generateTakeaways = useCallback(async () => {
    if (activeNotebookId == null) return null;
    return generateNotebookTakeaways(activeNotebookId);
  }, [activeNotebookId]);

  const generateActionItems = useCallback(async () => {
    if (activeNotebookId == null) return null;
    return generateNotebookActionItems(activeNotebookId);
  }, [activeNotebookId]);

  return {
    notebooks,
    isLoadingNotebooks,
    searchTerm,
    setSearchTerm,
    includeArchived,
    setIncludeArchived,
    activeNotebookId,
    activeNotebookDetail,
    isLoadingActiveNotebook,
    selectNotebook,
    clearSelection,
    createNotebookAnd,
    updateNotebookById,
    togglePinById,
    toggleArchiveById,
    deleteNotebookById,
    searchContents,
    addNote,
    deleteNote,
    linkConversation,
    linkFile,
    removeLink,
    summarize,
    mergeNotes,
    generateTakeaways,
    generateActionItems,
    error,
  };
}

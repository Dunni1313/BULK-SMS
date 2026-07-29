// v1.5.0 Sprint 7 — AI Workspaces. The workspace-MEMORY layer for one
// coachId, mirroring useCoachConversations.ts's own established shape
// (Sprint 6) so the two hooks feel like the same family: workspace list,
// active workspace selection + its own fetched detail (conversations
// summary/files/notes), search, and CRUD actions.

import { useCallback, useEffect, useState } from "react";
import type { CoachId } from "./capabilityRegistry";
import {
  type AiWorkspace,
  type AiWorkspaceDetail,
  type WorkspaceNoteKind,
  listWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addWorkspaceNote,
  deleteWorkspaceNote,
  addWorkspaceFile,
  deleteWorkspaceFile,
} from "./workspacesApi";

export interface UseAiWorkspacesResult {
  workspaces: AiWorkspace[];
  isLoadingWorkspaces: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  includeArchived: boolean;
  setIncludeArchived: (value: boolean) => void;
  /** null means "no workspace selected" — the top-level, un-grouped view. */
  activeWorkspaceId: number | null;
  activeWorkspaceDetail: AiWorkspaceDetail | null;
  isLoadingActiveWorkspace: boolean;
  selectWorkspace: (id: number) => void;
  clearSelection: () => void;
  createWorkspaceAnd: (input: { name: string; description?: string; tags?: string[] }) => Promise<AiWorkspace>;
  updateWorkspaceById: (id: number, input: { name?: string; description?: string; tags?: string[] }) => Promise<void>;
  togglePinById: (id: number, pinned: boolean) => Promise<void>;
  toggleArchiveById: (id: number, archived: boolean) => Promise<void>;
  deleteWorkspaceById: (id: number) => Promise<void>;
  addNote: (kind: WorkspaceNoteKind, content: string) => Promise<void>;
  deleteNote: (noteId: number) => Promise<void>;
  addFile: (input: { fileName: string; fileUrl: string; note?: string }) => Promise<void>;
  deleteFile: (fileId: number) => Promise<void>;
  error: string | null;
}

export function useAiWorkspaces(coachId: CoachId): UseAiWorkspacesResult {
  const [workspaces, setWorkspaces] = useState<AiWorkspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(null);
  const [activeWorkspaceDetail, setActiveWorkspaceDetail] = useState<AiWorkspaceDetail | null>(null);
  const [isLoadingActiveWorkspace, setIsLoadingActiveWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setIsLoadingWorkspaces(true);
    try {
      const list = await listWorkspaces(coachId, {
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(includeArchived ? { includeArchived: true } : {}),
      });
      setWorkspaces(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces");
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, [coachId, searchTerm, includeArchived]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const refreshActiveWorkspace = useCallback(async (id: number) => {
    setIsLoadingActiveWorkspace(true);
    try {
      const detail = await getWorkspace(id);
      setActiveWorkspaceDetail(detail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace");
    } finally {
      setIsLoadingActiveWorkspace(false);
    }
  }, []);

  const selectWorkspace = useCallback(
    (id: number) => {
      setActiveWorkspaceId(id);
      refreshActiveWorkspace(id);
    },
    [refreshActiveWorkspace],
  );

  const clearSelection = useCallback(() => {
    setActiveWorkspaceId(null);
    setActiveWorkspaceDetail(null);
  }, []);

  const createWorkspaceAnd = useCallback(
    async (input: { name: string; description?: string; tags?: string[] }) => {
      const created = await createWorkspace(coachId, input);
      await refreshList();
      return created;
    },
    [coachId, refreshList],
  );

  const updateWorkspaceById = useCallback(
    async (id: number, input: { name?: string; description?: string; tags?: string[] }) => {
      await updateWorkspace(id, input);
      await refreshList();
      if (activeWorkspaceId === id) await refreshActiveWorkspace(id);
    },
    [refreshList, refreshActiveWorkspace, activeWorkspaceId],
  );

  const togglePinById = useCallback(
    async (id: number, pinned: boolean) => {
      await updateWorkspace(id, { pinned });
      await refreshList();
    },
    [refreshList],
  );

  const toggleArchiveById = useCallback(
    async (id: number, archived: boolean) => {
      await updateWorkspace(id, { archived });
      await refreshList();
    },
    [refreshList],
  );

  const deleteWorkspaceById = useCallback(
    async (id: number) => {
      await deleteWorkspace(id);
      if (activeWorkspaceId === id) {
        setActiveWorkspaceId(null);
        setActiveWorkspaceDetail(null);
      }
      await refreshList();
    },
    [refreshList, activeWorkspaceId],
  );

  const addNote = useCallback(
    async (kind: WorkspaceNoteKind, content: string) => {
      if (activeWorkspaceId == null) return;
      await addWorkspaceNote(activeWorkspaceId, kind, content);
      await refreshActiveWorkspace(activeWorkspaceId);
    },
    [activeWorkspaceId, refreshActiveWorkspace],
  );

  const deleteNote = useCallback(
    async (noteId: number) => {
      if (activeWorkspaceId == null) return;
      await deleteWorkspaceNote(activeWorkspaceId, noteId);
      await refreshActiveWorkspace(activeWorkspaceId);
    },
    [activeWorkspaceId, refreshActiveWorkspace],
  );

  const addFile = useCallback(
    async (input: { fileName: string; fileUrl: string; note?: string }) => {
      if (activeWorkspaceId == null) return;
      await addWorkspaceFile(activeWorkspaceId, input);
      await refreshActiveWorkspace(activeWorkspaceId);
    },
    [activeWorkspaceId, refreshActiveWorkspace],
  );

  const deleteFile = useCallback(
    async (fileId: number) => {
      if (activeWorkspaceId == null) return;
      await deleteWorkspaceFile(activeWorkspaceId, fileId);
      await refreshActiveWorkspace(activeWorkspaceId);
    },
    [activeWorkspaceId, refreshActiveWorkspace],
  );

  return {
    workspaces,
    isLoadingWorkspaces,
    searchTerm,
    setSearchTerm,
    includeArchived,
    setIncludeArchived,
    activeWorkspaceId,
    activeWorkspaceDetail,
    isLoadingActiveWorkspace,
    selectWorkspace,
    clearSelection,
    createWorkspaceAnd,
    updateWorkspaceById,
    togglePinById,
    toggleArchiveById,
    deleteWorkspaceById,
    addNote,
    deleteNote,
    addFile,
    deleteFile,
    error,
  };
}

// v1.5.0 Sprint 9 — AI Strategy Builder. The strategy-MEMORY layer for one
// coachId (optionally scoped to a single workspace), mirroring
// useAiNotebooks.ts's own established shape (Sprint 8) so the three
// AI-object hooks (workspaces/notebooks/strategies) feel like the same
// family: strategy list (with library filters), active strategy selection
// + its own fetched detail (sections/versions), section upsert/delete,
// version history + restore, and the explicit, user-triggered AI actions
// — none of which is called automatically.

import { useCallback, useEffect, useState } from "react";
import type { CoachId } from "./capabilityRegistry";
import {
  type AiStrategy,
  type AiStrategyDetail,
  type AiStrategyVersionDetail,
  type StrategySectionKind,
  type StrategyStatus,
  type StrategyNarration,
  type StrategyChecklistResult,
  type MissingSectionsResult,
  type SimilarStrategyResult,
  type ListStrategiesOptions,
  type CreateStrategyInput,
  type UpdateStrategyInput,
  type UpsertSectionInput,
  listStrategies,
  createStrategy,
  getStrategy,
  updateStrategy,
  deleteStrategy,
  upsertStrategySection,
  deleteStrategySection,
  listStrategyVersions,
  getStrategyVersion,
  restoreStrategyVersion,
  getMissingSections,
  getSimilarStrategies,
  summarizeStrategy,
  suggestStrategyImprovements,
  generateStrategyExecutiveSummary,
  generateStrategyLearningNotes,
  generateStrategyRiskHighlights,
  generateStrategySetupChecklist,
  generateStrategyTradePrepChecklist,
  generateStrategyReviewQuestions,
} from "./strategiesApi";

export interface UseAiStrategiesResult {
  strategies: AiStrategy[];
  isLoadingStrategies: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  folder: string | null;
  setFolder: (value: string | null) => void;
  statusFilter: StrategyStatus | null;
  setStatusFilter: (value: StrategyStatus | null) => void;
  includeArchived: boolean;
  setIncludeArchived: (value: boolean) => void;
  activeStrategyId: number | null;
  activeStrategyDetail: AiStrategyDetail | null;
  isLoadingActiveStrategy: boolean;
  selectStrategy: (id: number) => void;
  clearSelection: () => void;
  createStrategyAnd: (input: CreateStrategyInput) => Promise<AiStrategy>;
  updateStrategyById: (id: number, input: UpdateStrategyInput) => Promise<void>;
  togglePinById: (id: number, pinned: boolean) => Promise<void>;
  toggleArchiveById: (id: number, archived: boolean) => Promise<void>;
  deleteStrategyById: (id: number) => Promise<void>;
  upsertSection: (input: UpsertSectionInput) => Promise<void>;
  removeSection: (sectionId: number) => Promise<void>;
  loadVersionDetail: (version: number) => Promise<AiStrategyVersionDetail | null>;
  restoreVersion: (version: number) => Promise<void>;
  loadMissingSections: () => Promise<MissingSectionsResult | null>;
  loadSimilarStrategies: () => Promise<SimilarStrategyResult[]>;
  summarize: () => Promise<StrategyNarration | null>;
  suggestImprovements: () => Promise<StrategyNarration | null>;
  generateExecutiveSummary: () => Promise<StrategyNarration | null>;
  generateLearningNotes: () => Promise<StrategyNarration | null>;
  generateRiskHighlights: () => Promise<StrategyNarration | null>;
  generateSetupChecklist: () => Promise<StrategyChecklistResult | null>;
  generateTradePrepChecklist: () => Promise<StrategyChecklistResult | null>;
  generateReviewQuestions: () => Promise<StrategyChecklistResult | null>;
  error: string | null;
}

export function useAiStrategies(coachId: CoachId, workspaceId?: number): UseAiStrategiesResult {
  const [strategies, setStrategies] = useState<AiStrategy[]>([]);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StrategyStatus | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [activeStrategyId, setActiveStrategyId] = useState<number | null>(null);
  const [activeStrategyDetail, setActiveStrategyDetail] = useState<AiStrategyDetail | null>(null);
  const [isLoadingActiveStrategy, setIsLoadingActiveStrategy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setIsLoadingStrategies(true);
    try {
      const options: ListStrategiesOptions = {
        ...(workspaceId != null ? { workspaceId } : {}),
        ...(folder ? { folder } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(includeArchived ? { includeArchived: true } : {}),
      };
      const list = await listStrategies(coachId, options);
      setStrategies(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategies");
    } finally {
      setIsLoadingStrategies(false);
    }
  }, [coachId, workspaceId, folder, statusFilter, searchTerm, includeArchived]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const refreshActiveStrategy = useCallback(async (id: number) => {
    setIsLoadingActiveStrategy(true);
    try {
      const detail = await getStrategy(id);
      setActiveStrategyDetail(detail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategy");
    } finally {
      setIsLoadingActiveStrategy(false);
    }
  }, []);

  const selectStrategy = useCallback(
    (id: number) => {
      setActiveStrategyId(id);
      refreshActiveStrategy(id);
    },
    [refreshActiveStrategy],
  );

  const clearSelection = useCallback(() => {
    setActiveStrategyId(null);
    setActiveStrategyDetail(null);
  }, []);

  const createStrategyAnd = useCallback(
    async (input: CreateStrategyInput) => {
      const created = await createStrategy(coachId, input);
      await refreshList();
      return created;
    },
    [coachId, refreshList],
  );

  const updateStrategyById = useCallback(
    async (id: number, input: UpdateStrategyInput) => {
      await updateStrategy(id, input);
      await refreshList();
      if (activeStrategyId === id) await refreshActiveStrategy(id);
    },
    [refreshList, refreshActiveStrategy, activeStrategyId],
  );

  const togglePinById = useCallback(
    async (id: number, pinned: boolean) => {
      await updateStrategy(id, { pinned });
      await refreshList();
      if (activeStrategyId === id) await refreshActiveStrategy(id);
    },
    [refreshList, refreshActiveStrategy, activeStrategyId],
  );

  const toggleArchiveById = useCallback(
    async (id: number, archived: boolean) => {
      await updateStrategy(id, { archived });
      await refreshList();
      if (activeStrategyId === id) await refreshActiveStrategy(id);
    },
    [refreshList, refreshActiveStrategy, activeStrategyId],
  );

  const deleteStrategyById = useCallback(
    async (id: number) => {
      await deleteStrategy(id);
      if (activeStrategyId === id) {
        setActiveStrategyId(null);
        setActiveStrategyDetail(null);
      }
      await refreshList();
    },
    [refreshList, activeStrategyId],
  );

  const upsertSection = useCallback(
    async (input: UpsertSectionInput) => {
      if (activeStrategyId == null) return;
      await upsertStrategySection(activeStrategyId, input);
      await refreshActiveStrategy(activeStrategyId);
      await refreshList();
    },
    [activeStrategyId, refreshActiveStrategy, refreshList],
  );

  const removeSection = useCallback(
    async (sectionId: number) => {
      if (activeStrategyId == null) return;
      await deleteStrategySection(activeStrategyId, sectionId);
      await refreshActiveStrategy(activeStrategyId);
      await refreshList();
    },
    [activeStrategyId, refreshActiveStrategy, refreshList],
  );

  const loadVersionDetail = useCallback(
    async (version: number) => {
      if (activeStrategyId == null) return null;
      return getStrategyVersion(activeStrategyId, version);
    },
    [activeStrategyId],
  );

  const restoreVersion = useCallback(
    async (version: number) => {
      if (activeStrategyId == null) return;
      await restoreStrategyVersion(activeStrategyId, version);
      await refreshActiveStrategy(activeStrategyId);
      await refreshList();
    },
    [activeStrategyId, refreshActiveStrategy, refreshList],
  );

  const loadMissingSections = useCallback(async () => {
    if (activeStrategyId == null) return null;
    return getMissingSections(activeStrategyId);
  }, [activeStrategyId]);

  const loadSimilarStrategies = useCallback(async () => {
    if (activeStrategyId == null) return [];
    return getSimilarStrategies(activeStrategyId);
  }, [activeStrategyId]);

  const summarize = useCallback(async () => {
    if (activeStrategyId == null) return null;
    return summarizeStrategy(activeStrategyId);
  }, [activeStrategyId]);

  const suggestImprovements = useCallback(async () => {
    if (activeStrategyId == null) return null;
    return suggestStrategyImprovements(activeStrategyId);
  }, [activeStrategyId]);

  const generateExecutiveSummary = useCallback(async () => {
    if (activeStrategyId == null) return null;
    return generateStrategyExecutiveSummary(activeStrategyId);
  }, [activeStrategyId]);

  const generateLearningNotes = useCallback(async () => {
    if (activeStrategyId == null) return null;
    return generateStrategyLearningNotes(activeStrategyId);
  }, [activeStrategyId]);

  const generateRiskHighlights = useCallback(async () => {
    if (activeStrategyId == null) return null;
    return generateStrategyRiskHighlights(activeStrategyId);
  }, [activeStrategyId]);

  const generateSetupChecklist = useCallback(async () => {
    if (activeStrategyId == null) return null;
    return generateStrategySetupChecklist(activeStrategyId);
  }, [activeStrategyId]);

  const generateTradePrepChecklist = useCallback(async () => {
    if (activeStrategyId == null) return null;
    return generateStrategyTradePrepChecklist(activeStrategyId);
  }, [activeStrategyId]);

  const generateReviewQuestions = useCallback(async () => {
    if (activeStrategyId == null) return null;
    return generateStrategyReviewQuestions(activeStrategyId);
  }, [activeStrategyId]);

  return {
    strategies,
    isLoadingStrategies,
    searchTerm,
    setSearchTerm,
    folder,
    setFolder,
    statusFilter,
    setStatusFilter,
    includeArchived,
    setIncludeArchived,
    activeStrategyId,
    activeStrategyDetail,
    isLoadingActiveStrategy,
    selectStrategy,
    clearSelection,
    createStrategyAnd,
    updateStrategyById,
    togglePinById,
    toggleArchiveById,
    deleteStrategyById,
    upsertSection,
    removeSection,
    loadVersionDetail,
    restoreVersion,
    loadMissingSections,
    loadSimilarStrategies,
    summarize,
    suggestImprovements,
    generateExecutiveSummary,
    generateLearningNotes,
    generateRiskHighlights,
    generateSetupChecklist,
    generateTradePrepChecklist,
    generateReviewQuestions,
    error,
  };
}

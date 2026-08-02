// v1.5.0 Sprint 10 — Institutional Trade Planner. The trade-plan-MEMORY
// layer for one coachId (optionally scoped to a single workspace),
// mirroring useAiStrategies.ts's own established shape (Sprint 9) so the
// four AI-object hooks (workspaces/notebooks/strategies/trade plans) feel
// like the same family: plan list (with library filters), active plan
// selection + its own fetched detail (sections/versions/checklist items),
// section upsert/delete, checklist item add/update/delete/apply-template,
// version history + restore, and the explicit, user-triggered AI actions
// — none of which is called automatically, and none of which recommends
// executing the trade.

import { useCallback, useEffect, useState } from "react";
import type { CoachId } from "./capabilityRegistry";
import {
  type TradePlan,
  type TradePlanDetail,
  type TradePlanVersionDetail,
  type TradePlanStatus,
  type TradePlanNarration,
  type TradePlanChecklistResult,
  type MissingTradePlanInfoResult,
  type SimilarTradePlanResult,
  type ListTradePlansOptions,
  type CreateTradePlanInput,
  type UpdateTradePlanInput,
  type UpsertTradePlanSectionInput,
  type TradePlanChecklistItem,
  listTradePlans,
  createTradePlan,
  getTradePlan,
  updateTradePlan,
  deleteTradePlan,
  upsertTradePlanSection,
  deleteTradePlanSection,
  addTradePlanChecklistItem,
  applyTradePlanChecklistTemplate,
  updateTradePlanChecklistItem,
  deleteTradePlanChecklistItem,
  listTradePlanVersions,
  getTradePlanVersion,
  restoreTradePlanVersion,
  getMissingTradePlanInformation,
  getSimilarTradePlans,
  reviewTradePlan,
  summarizeTradePlan,
  generateTradePlanRiskHighlights,
  reviewTradePlanRiskReward,
  generateTradePlanExecutiveSummary,
  generateTradePlanPreparationNotes,
  generateTradePlanPreTradeChecklist,
  generateTradePlanVerificationQuestions,
} from "./tradePlansApi";

export interface UseTradePlansResult {
  plans: TradePlan[];
  isLoadingPlans: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: TradePlanStatus | null;
  setStatusFilter: (value: TradePlanStatus | null) => void;
  includeArchived: boolean;
  setIncludeArchived: (value: boolean) => void;
  activePlanId: number | null;
  activePlanDetail: TradePlanDetail | null;
  isLoadingActivePlan: boolean;
  selectPlan: (id: number) => void;
  clearSelection: () => void;
  createPlanAnd: (input: CreateTradePlanInput) => Promise<TradePlan>;
  updatePlanById: (id: number, input: UpdateTradePlanInput) => Promise<void>;
  togglePinById: (id: number, pinned: boolean) => Promise<void>;
  setStatusById: (id: number, status: TradePlanStatus) => Promise<void>;
  deletePlanById: (id: number) => Promise<void>;
  upsertSection: (input: UpsertTradePlanSectionInput) => Promise<void>;
  removeSection: (sectionId: number) => Promise<void>;
  addChecklistItem: (input: { label: string; required?: boolean }) => Promise<void>;
  applyChecklistTemplate: (templateId: string) => Promise<void>;
  updateChecklistItem: (itemId: number, input: { label?: string; required?: boolean; completed?: boolean; sortOrder?: number }) => Promise<void>;
  removeChecklistItem: (itemId: number) => Promise<void>;
  loadVersionDetail: (version: number) => Promise<TradePlanVersionDetail | null>;
  restoreVersion: (version: number) => Promise<void>;
  loadMissingInformation: () => Promise<MissingTradePlanInfoResult | null>;
  loadSimilarPlans: () => Promise<SimilarTradePlanResult[]>;
  review: () => Promise<TradePlanNarration | null>;
  summarize: () => Promise<TradePlanNarration | null>;
  generateRiskHighlights: () => Promise<TradePlanNarration | null>;
  reviewRiskReward: () => Promise<TradePlanNarration | null>;
  generateExecutiveSummary: () => Promise<TradePlanNarration | null>;
  generatePreparationNotes: () => Promise<TradePlanNarration | null>;
  generatePreTradeChecklist: () => Promise<TradePlanChecklistResult | null>;
  generateVerificationQuestions: () => Promise<TradePlanChecklistResult | null>;
  error: string | null;
}

export function useTradePlans(coachId: CoachId, workspaceId?: number): UseTradePlansResult {
  const [plans, setPlans] = useState<TradePlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TradePlanStatus | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [activePlanDetail, setActivePlanDetail] = useState<TradePlanDetail | null>(null);
  const [isLoadingActivePlan, setIsLoadingActivePlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setIsLoadingPlans(true);
    try {
      const options: ListTradePlansOptions = {
        ...(workspaceId != null ? { workspaceId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(includeArchived ? { includeArchived: true } : {}),
      };
      const list = await listTradePlans(coachId, options);
      setPlans(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trade plans");
    } finally {
      setIsLoadingPlans(false);
    }
  }, [coachId, workspaceId, statusFilter, searchTerm, includeArchived]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const refreshActivePlan = useCallback(async (id: number) => {
    setIsLoadingActivePlan(true);
    try {
      const detail = await getTradePlan(id);
      setActivePlanDetail(detail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trade plan");
    } finally {
      setIsLoadingActivePlan(false);
    }
  }, []);

  const selectPlan = useCallback(
    (id: number) => {
      setActivePlanId(id);
      refreshActivePlan(id);
    },
    [refreshActivePlan],
  );

  const clearSelection = useCallback(() => {
    setActivePlanId(null);
    setActivePlanDetail(null);
  }, []);

  const createPlanAnd = useCallback(
    async (input: CreateTradePlanInput) => {
      const created = await createTradePlan(coachId, input);
      await refreshList();
      return created;
    },
    [coachId, refreshList],
  );

  const updatePlanById = useCallback(
    async (id: number, input: UpdateTradePlanInput) => {
      await updateTradePlan(id, input);
      await refreshList();
      if (activePlanId === id) await refreshActivePlan(id);
    },
    [refreshList, refreshActivePlan, activePlanId],
  );

  const togglePinById = useCallback(
    async (id: number, pinned: boolean) => {
      await updateTradePlan(id, { pinned });
      await refreshList();
      if (activePlanId === id) await refreshActivePlan(id);
    },
    [refreshList, refreshActivePlan, activePlanId],
  );

  const setStatusById = useCallback(
    async (id: number, status: TradePlanStatus) => {
      await updateTradePlan(id, { status });
      await refreshList();
      if (activePlanId === id) await refreshActivePlan(id);
    },
    [refreshList, refreshActivePlan, activePlanId],
  );

  const deletePlanById = useCallback(
    async (id: number) => {
      await deleteTradePlan(id);
      if (activePlanId === id) {
        setActivePlanId(null);
        setActivePlanDetail(null);
      }
      await refreshList();
    },
    [refreshList, activePlanId],
  );

  const upsertSection = useCallback(
    async (input: UpsertTradePlanSectionInput) => {
      if (activePlanId == null) return;
      await upsertTradePlanSection(activePlanId, input);
      await refreshActivePlan(activePlanId);
      await refreshList();
    },
    [activePlanId, refreshActivePlan, refreshList],
  );

  const removeSection = useCallback(
    async (sectionId: number) => {
      if (activePlanId == null) return;
      await deleteTradePlanSection(activePlanId, sectionId);
      await refreshActivePlan(activePlanId);
      await refreshList();
    },
    [activePlanId, refreshActivePlan, refreshList],
  );

  const addChecklistItem = useCallback(
    async (input: { label: string; required?: boolean }) => {
      if (activePlanId == null) return;
      await addTradePlanChecklistItem(activePlanId, input);
      await refreshActivePlan(activePlanId);
    },
    [activePlanId, refreshActivePlan],
  );

  const applyChecklistTemplate = useCallback(
    async (templateId: string) => {
      if (activePlanId == null) return;
      await applyTradePlanChecklistTemplate(activePlanId, templateId);
      await refreshActivePlan(activePlanId);
    },
    [activePlanId, refreshActivePlan],
  );

  const updateChecklistItem = useCallback(
    async (itemId: number, input: { label?: string; required?: boolean; completed?: boolean; sortOrder?: number }) => {
      if (activePlanId == null) return;
      await updateTradePlanChecklistItem(activePlanId, itemId, input);
      await refreshActivePlan(activePlanId);
    },
    [activePlanId, refreshActivePlan],
  );

  const removeChecklistItem = useCallback(
    async (itemId: number) => {
      if (activePlanId == null) return;
      await deleteTradePlanChecklistItem(activePlanId, itemId);
      await refreshActivePlan(activePlanId);
    },
    [activePlanId, refreshActivePlan],
  );

  const loadVersionDetail = useCallback(
    async (version: number) => {
      if (activePlanId == null) return null;
      return getTradePlanVersion(activePlanId, version);
    },
    [activePlanId],
  );

  const restoreVersion = useCallback(
    async (version: number) => {
      if (activePlanId == null) return;
      await restoreTradePlanVersion(activePlanId, version);
      await refreshActivePlan(activePlanId);
      await refreshList();
    },
    [activePlanId, refreshActivePlan, refreshList],
  );

  const loadMissingInformation = useCallback(async () => {
    if (activePlanId == null) return null;
    return getMissingTradePlanInformation(activePlanId);
  }, [activePlanId]);

  const loadSimilarPlans = useCallback(async () => {
    if (activePlanId == null) return [];
    return getSimilarTradePlans(activePlanId);
  }, [activePlanId]);

  const review = useCallback(async () => {
    if (activePlanId == null) return null;
    return reviewTradePlan(activePlanId);
  }, [activePlanId]);

  const summarize = useCallback(async () => {
    if (activePlanId == null) return null;
    return summarizeTradePlan(activePlanId);
  }, [activePlanId]);

  const generateRiskHighlights = useCallback(async () => {
    if (activePlanId == null) return null;
    return generateTradePlanRiskHighlights(activePlanId);
  }, [activePlanId]);

  const reviewRiskReward = useCallback(async () => {
    if (activePlanId == null) return null;
    return reviewTradePlanRiskReward(activePlanId);
  }, [activePlanId]);

  const generateExecutiveSummary = useCallback(async () => {
    if (activePlanId == null) return null;
    return generateTradePlanExecutiveSummary(activePlanId);
  }, [activePlanId]);

  const generatePreparationNotes = useCallback(async () => {
    if (activePlanId == null) return null;
    return generateTradePlanPreparationNotes(activePlanId);
  }, [activePlanId]);

  const generatePreTradeChecklist = useCallback(async () => {
    if (activePlanId == null) return null;
    return generateTradePlanPreTradeChecklist(activePlanId);
  }, [activePlanId]);

  const generateVerificationQuestions = useCallback(async () => {
    if (activePlanId == null) return null;
    return generateTradePlanVerificationQuestions(activePlanId);
  }, [activePlanId]);

  return {
    plans,
    isLoadingPlans,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    includeArchived,
    setIncludeArchived,
    activePlanId,
    activePlanDetail,
    isLoadingActivePlan,
    selectPlan,
    clearSelection,
    createPlanAnd,
    updatePlanById,
    togglePinById,
    setStatusById,
    deletePlanById,
    upsertSection,
    removeSection,
    addChecklistItem,
    applyChecklistTemplate,
    updateChecklistItem,
    removeChecklistItem,
    loadVersionDetail,
    restoreVersion,
    loadMissingInformation,
    loadSimilarPlans,
    review,
    summarize,
    generateRiskHighlights,
    reviewRiskReward,
    generateExecutiveSummary,
    generatePreparationNotes,
    generatePreTradeChecklist,
    generateVerificationQuestions,
    error,
  };
}

export type { TradePlanChecklistItem };

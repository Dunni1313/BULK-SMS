// v1.5.0 Sprint 10 — Institutional Trade Planner. Isolated unit tests for
// the trade-plan memory hook, mocking ./tradePlansApi exactly as
// useAiStrategies.test.ts mocks ./strategiesApi (Sprint 9) — proving the
// hook's own list/select/create/update/pin/status/delete/filter/
// sections/checklist-items/versions/deterministic-analysis/AI-action
// wiring independent of any one consuming page.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTradePlans } from "./useTradePlans";
import type { TradePlan, TradePlanDetail } from "./tradePlansApi";

const listTradePlansMock = vi.hoisted(() => vi.fn());
const createTradePlanMock = vi.hoisted(() => vi.fn());
const getTradePlanMock = vi.hoisted(() => vi.fn());
const updateTradePlanMock = vi.hoisted(() => vi.fn());
const deleteTradePlanMock = vi.hoisted(() => vi.fn());
const upsertTradePlanSectionMock = vi.hoisted(() => vi.fn());
const deleteTradePlanSectionMock = vi.hoisted(() => vi.fn());
const addTradePlanChecklistItemMock = vi.hoisted(() => vi.fn());
const applyTradePlanChecklistTemplateMock = vi.hoisted(() => vi.fn());
const updateTradePlanChecklistItemMock = vi.hoisted(() => vi.fn());
const deleteTradePlanChecklistItemMock = vi.hoisted(() => vi.fn());
const getTradePlanVersionMock = vi.hoisted(() => vi.fn());
const restoreTradePlanVersionMock = vi.hoisted(() => vi.fn());
const getMissingTradePlanInformationMock = vi.hoisted(() => vi.fn());
const getSimilarTradePlansMock = vi.hoisted(() => vi.fn());
const summarizeTradePlanMock = vi.hoisted(() => vi.fn());
const generateTradePlanPreTradeChecklistMock = vi.hoisted(() => vi.fn());

vi.mock("./tradePlansApi", () => ({
  listTradePlans: listTradePlansMock,
  createTradePlan: createTradePlanMock,
  getTradePlan: getTradePlanMock,
  updateTradePlan: updateTradePlanMock,
  deleteTradePlan: deleteTradePlanMock,
  upsertTradePlanSection: upsertTradePlanSectionMock,
  deleteTradePlanSection: deleteTradePlanSectionMock,
  addTradePlanChecklistItem: addTradePlanChecklistItemMock,
  applyTradePlanChecklistTemplate: applyTradePlanChecklistTemplateMock,
  updateTradePlanChecklistItem: updateTradePlanChecklistItemMock,
  deleteTradePlanChecklistItem: deleteTradePlanChecklistItemMock,
  listTradePlanVersions: vi.fn(),
  getTradePlanVersion: getTradePlanVersionMock,
  restoreTradePlanVersion: restoreTradePlanVersionMock,
  getMissingTradePlanInformation: getMissingTradePlanInformationMock,
  getSimilarTradePlans: getSimilarTradePlansMock,
  reviewTradePlan: vi.fn(),
  summarizeTradePlan: summarizeTradePlanMock,
  generateTradePlanRiskHighlights: vi.fn(),
  reviewTradePlanRiskReward: vi.fn(),
  generateTradePlanExecutiveSummary: vi.fn(),
  generateTradePlanPreparationNotes: vi.fn(),
  generateTradePlanPreTradeChecklist: generateTradePlanPreTradeChecklistMock,
  generateTradePlanVerificationQuestions: vi.fn(),
}));

function plan(overrides: Partial<TradePlan> = {}): TradePlan {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    strategyId: null,
    title: "Breakout Long",
    plannedAsset: "AAPL",
    assetClass: null,
    direction: "long",
    status: "draft",
    pinned: false,
    tags: [],
    currentVersion: 1,
    executedTradeRef: null,
    executedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function detail(overrides: Partial<TradePlanDetail> = {}): TradePlanDetail {
  return {
    ...plan(),
    sections: [],
    versions: [],
    checklistItems: [],
    checklistProgress: { totalItems: 0, completedItems: 0, requiredItems: 0, completedRequiredItems: 0, progressPct: 0, readyForEntry: false },
    ...overrides,
  };
}

beforeEach(() => {
  listTradePlansMock.mockReset().mockResolvedValue([]);
  createTradePlanMock.mockReset();
  getTradePlanMock.mockReset().mockResolvedValue(detail());
  updateTradePlanMock.mockReset().mockResolvedValue(plan());
  deleteTradePlanMock.mockReset().mockResolvedValue(undefined);
  upsertTradePlanSectionMock.mockReset();
  deleteTradePlanSectionMock.mockReset();
  addTradePlanChecklistItemMock.mockReset();
  applyTradePlanChecklistTemplateMock.mockReset();
  updateTradePlanChecklistItemMock.mockReset();
  deleteTradePlanChecklistItemMock.mockReset();
  getTradePlanVersionMock.mockReset();
  restoreTradePlanVersionMock.mockReset();
  getMissingTradePlanInformationMock.mockReset();
  getSimilarTradePlansMock.mockReset();
  summarizeTradePlanMock.mockReset();
  generateTradePlanPreTradeChecklistMock.mockReset();
});

describe("useTradePlans — loading the list", () => {
  it("loads the plan list for the given coachId on mount", async () => {
    listTradePlansMock.mockResolvedValue([plan({ id: 1, title: "Alpha" })]);
    const { result } = renderHook(() => useTradePlans("trading"));

    await waitFor(() => expect(result.current.isLoadingPlans).toBe(false));

    expect(listTradePlansMock).toHaveBeenCalledWith("trading", {});
    expect(result.current.plans).toEqual([plan({ id: 1, title: "Alpha" })]);
  });

  it("scopes the list to a workspaceId when supplied", async () => {
    renderHook(() => useTradePlans("trading", 42));
    await waitFor(() => expect(listTradePlansMock).toHaveBeenCalledWith("trading", { workspaceId: 42 }));
  });

  it("starts with no active plan selected", () => {
    const { result } = renderHook(() => useTradePlans("investing"));
    expect(result.current.activePlanId).toBeNull();
    expect(result.current.activePlanDetail).toBeNull();
  });

  it("re-fetches the list with a status filter when setStatusFilter is called", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    await waitFor(() => expect(result.current.isLoadingPlans).toBe(false));

    act(() => result.current.setStatusFilter("ready"));
    await waitFor(() => expect(listTradePlansMock).toHaveBeenCalledWith("trading", { status: "ready" }));
  });

  it("re-fetches the list with includeArchived when toggled on", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    await waitFor(() => expect(result.current.isLoadingPlans).toBe(false));

    act(() => result.current.setIncludeArchived(true));
    await waitFor(() => expect(listTradePlansMock).toHaveBeenCalledWith("trading", { includeArchived: true }));
  });
});

describe("useTradePlans — selecting a plan", () => {
  it("selectPlan sets the active id and fetches its full detail", async () => {
    getTradePlanMock.mockResolvedValue(detail({ id: 7, title: "Selected one" }));
    const { result } = renderHook(() => useTradePlans("trading"));

    act(() => result.current.selectPlan(7));

    await waitFor(() => expect(result.current.isLoadingActivePlan).toBe(false));
    expect(result.current.activePlanId).toBe(7);
    expect(getTradePlanMock).toHaveBeenCalledWith(7);
    expect(result.current.activePlanDetail?.title).toBe("Selected one");
  });

  it("clearSelection returns to the top-level, unselected view", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(7));
    await waitFor(() => expect(result.current.activePlanId).toBe(7));

    act(() => result.current.clearSelection());

    expect(result.current.activePlanId).toBeNull();
    expect(result.current.activePlanDetail).toBeNull();
  });
});

describe("useTradePlans — create / update / pin / status / delete", () => {
  it("createPlanAnd creates then refreshes the list", async () => {
    createTradePlanMock.mockResolvedValue(plan({ id: 99, title: "New one" }));
    const { result } = renderHook(() => useTradePlans("trading"));
    await waitFor(() => expect(result.current.isLoadingPlans).toBe(false));
    listTradePlansMock.mockClear();

    let created: TradePlan | undefined;
    await act(async () => {
      created = await result.current.createPlanAnd({ title: "New one", plannedAsset: "AAPL" });
    });

    expect(createTradePlanMock).toHaveBeenCalledWith("trading", { title: "New one", plannedAsset: "AAPL" });
    expect(created?.id).toBe(99);
    expect(listTradePlansMock).toHaveBeenCalled();
  });

  it("togglePinById pins then refreshes the list", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    await waitFor(() => expect(result.current.isLoadingPlans).toBe(false));
    listTradePlansMock.mockClear();

    await act(async () => {
      await result.current.togglePinById(3, true);
    });

    expect(updateTradePlanMock).toHaveBeenCalledWith(3, { pinned: true });
    expect(listTradePlansMock).toHaveBeenCalled();
  });

  it("setStatusById transitions status then refreshes the list", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    await waitFor(() => expect(result.current.isLoadingPlans).toBe(false));

    await act(async () => {
      await result.current.setStatusById(3, "ready");
    });

    expect(updateTradePlanMock).toHaveBeenCalledWith(3, { status: "ready" });
  });

  it("deletePlanById deletes then refreshes the list", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    await waitFor(() => expect(result.current.isLoadingPlans).toBe(false));

    await act(async () => {
      await result.current.deletePlanById(3);
    });

    expect(deleteTradePlanMock).toHaveBeenCalledWith(3);
  });

  it("deleting the currently-active plan clears the active selection", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(3));
    await waitFor(() => expect(result.current.activePlanId).toBe(3));

    await act(async () => {
      await result.current.deletePlanById(3);
    });

    expect(result.current.activePlanId).toBeNull();
    expect(result.current.activePlanDetail).toBeNull();
  });
});

describe("useTradePlans — sections", () => {
  it("upsertSection is a no-op when no plan is active", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    await act(async () => {
      await result.current.upsertSection({ kind: "entry_zone", content: "hello" });
    });
    expect(upsertTradePlanSectionMock).not.toHaveBeenCalled();
  });

  it("upsertSection saves a section against the active plan then refreshes its detail and the list", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(5));
    await waitFor(() => expect(result.current.activePlanId).toBe(5));
    getTradePlanMock.mockClear();
    listTradePlansMock.mockClear();

    await act(async () => {
      await result.current.upsertSection({ kind: "stop_loss", content: "Below the swing low" });
    });

    expect(upsertTradePlanSectionMock).toHaveBeenCalledWith(5, { kind: "stop_loss", content: "Below the swing low" });
    expect(getTradePlanMock).toHaveBeenCalledWith(5);
    expect(listTradePlansMock).toHaveBeenCalled();
  });

  it("removeSection removes a section from the active plan then refreshes its detail", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(5));
    await waitFor(() => expect(result.current.activePlanId).toBe(5));

    await act(async () => {
      await result.current.removeSection(12);
    });

    expect(deleteTradePlanSectionMock).toHaveBeenCalledWith(5, 12);
  });
});

describe("useTradePlans — checklist engine", () => {
  it("addChecklistItem is a no-op when no plan is active", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    await act(async () => {
      await result.current.addChecklistItem({ label: "Confirm entry" });
    });
    expect(addTradePlanChecklistItemMock).not.toHaveBeenCalled();
  });

  it("addChecklistItem adds an item against the active plan then refreshes its detail", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(5));
    await waitFor(() => expect(result.current.activePlanId).toBe(5));
    getTradePlanMock.mockClear();

    await act(async () => {
      await result.current.addChecklistItem({ label: "Confirm entry", required: true });
    });

    expect(addTradePlanChecklistItemMock).toHaveBeenCalledWith(5, { label: "Confirm entry", required: true });
    expect(getTradePlanMock).toHaveBeenCalledWith(5);
  });

  it("applyChecklistTemplate applies a named template against the active plan then refreshes its detail", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(5));
    await waitFor(() => expect(result.current.activePlanId).toBe(5));

    await act(async () => {
      await result.current.applyChecklistTemplate("trading-pre-trade");
    });

    expect(applyTradePlanChecklistTemplateMock).toHaveBeenCalledWith(5, "trading-pre-trade");
  });

  it("updateChecklistItem toggles completion against the active plan then refreshes its detail", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(5));
    await waitFor(() => expect(result.current.activePlanId).toBe(5));

    await act(async () => {
      await result.current.updateChecklistItem(9, { completed: true });
    });

    expect(updateTradePlanChecklistItemMock).toHaveBeenCalledWith(5, 9, { completed: true });
  });

  it("removeChecklistItem removes an item from the active plan then refreshes its detail", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(5));
    await waitFor(() => expect(result.current.activePlanId).toBe(5));

    await act(async () => {
      await result.current.removeChecklistItem(9);
    });

    expect(deleteTradePlanChecklistItemMock).toHaveBeenCalledWith(5, 9);
  });
});

describe("useTradePlans — versions", () => {
  it("loadVersionDetail is a no-op returning null when no plan is active", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    const outcome = await result.current.loadVersionDetail(2);
    expect(outcome).toBeNull();
    expect(getTradePlanVersionMock).not.toHaveBeenCalled();
  });

  it("restoreVersion restores then refreshes the active detail and the list", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(5));
    await waitFor(() => expect(result.current.activePlanId).toBe(5));
    getTradePlanMock.mockClear();
    listTradePlansMock.mockClear();

    await act(async () => {
      await result.current.restoreVersion(2);
    });

    expect(restoreTradePlanVersionMock).toHaveBeenCalledWith(5, 2);
    expect(getTradePlanMock).toHaveBeenCalledWith(5);
    expect(listTradePlansMock).toHaveBeenCalled();
  });
});

describe("useTradePlans — deterministic analysis (no LLM call)", () => {
  it("loadMissingInformation is a no-op returning null when no plan is active", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    const outcome = await result.current.loadMissingInformation();
    expect(outcome).toBeNull();
    expect(getMissingTradePlanInformationMock).not.toHaveBeenCalled();
  });

  it("loadSimilarPlans is a no-op returning [] when no plan is active", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    const outcome = await result.current.loadSimilarPlans();
    expect(outcome).toEqual([]);
    expect(getSimilarTradePlansMock).not.toHaveBeenCalled();
  });

  it("loadMissingInformation calls the API only for the active plan", async () => {
    getMissingTradePlanInformationMock.mockResolvedValue({ missing: ["stop_loss"], present: [], completenessPct: 50 });
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(5));
    await waitFor(() => expect(result.current.activePlanId).toBe(5));

    let outcome;
    await act(async () => {
      outcome = await result.current.loadMissingInformation();
    });

    expect(getMissingTradePlanInformationMock).toHaveBeenCalledWith(5);
    expect(outcome).toEqual({ missing: ["stop_loss"], present: [], completenessPct: 50 });
  });
});

describe("useTradePlans — AI actions (explicit, never automatic)", () => {
  it("summarize is a no-op returning null when no plan is active", async () => {
    const { result } = renderHook(() => useTradePlans("trading"));
    const outcome = await result.current.summarize();
    expect(outcome).toBeNull();
    expect(summarizeTradePlanMock).not.toHaveBeenCalled();
  });

  it("summarize calls the API only for the active plan", async () => {
    summarizeTradePlanMock.mockResolvedValue({ text: "A concise summary.", source: "template" });
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(5));
    await waitFor(() => expect(result.current.activePlanId).toBe(5));

    let outcome;
    await act(async () => {
      outcome = await result.current.summarize();
    });

    expect(summarizeTradePlanMock).toHaveBeenCalledWith(5);
    expect(outcome).toEqual({ text: "A concise summary.", source: "template" });
  });

  it("generatePreTradeChecklist honestly returns unavailable when the API reports so", async () => {
    generateTradePlanPreTradeChecklistMock.mockResolvedValue({ available: false, items: [] });
    const { result } = renderHook(() => useTradePlans("trading"));
    act(() => result.current.selectPlan(5));
    await waitFor(() => expect(result.current.activePlanId).toBe(5));

    let outcome;
    await act(async () => {
      outcome = await result.current.generatePreTradeChecklist();
    });

    expect(generateTradePlanPreTradeChecklistMock).toHaveBeenCalledWith(5);
    expect(outcome).toEqual({ available: false, items: [] });
  });
});

describe("useTradePlans — error handling", () => {
  it("surfaces a list-load failure via the error field rather than throwing", async () => {
    listTradePlansMock.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useTradePlans("trading"));

    await waitFor(() => expect(result.current.error).toMatch(/network down/i));
  });
});

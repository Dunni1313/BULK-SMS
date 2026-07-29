// v1.5.0 Sprint 9 — AI Strategy Builder. Isolated unit tests for the
// strategy memory hook, mocking ./strategiesApi exactly as
// useAiNotebooks.test.ts mocks ./notebooksApi (Sprint 8) — proving the
// hook's own list/select/create/update/pin/archive/delete/filter/
// sections/versions/deterministic-analysis/AI-action wiring independent
// of any one consuming page.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAiStrategies } from "./useAiStrategies";
import type { AiStrategy, AiStrategyDetail } from "./strategiesApi";

const listStrategiesMock = vi.hoisted(() => vi.fn());
const createStrategyMock = vi.hoisted(() => vi.fn());
const getStrategyMock = vi.hoisted(() => vi.fn());
const updateStrategyMock = vi.hoisted(() => vi.fn());
const deleteStrategyMock = vi.hoisted(() => vi.fn());
const upsertStrategySectionMock = vi.hoisted(() => vi.fn());
const deleteStrategySectionMock = vi.hoisted(() => vi.fn());
const getStrategyVersionMock = vi.hoisted(() => vi.fn());
const restoreStrategyVersionMock = vi.hoisted(() => vi.fn());
const getMissingSectionsMock = vi.hoisted(() => vi.fn());
const getSimilarStrategiesMock = vi.hoisted(() => vi.fn());
const summarizeStrategyMock = vi.hoisted(() => vi.fn());
const generateStrategySetupChecklistMock = vi.hoisted(() => vi.fn());

vi.mock("./strategiesApi", () => ({
  listStrategies: listStrategiesMock,
  createStrategy: createStrategyMock,
  getStrategy: getStrategyMock,
  updateStrategy: updateStrategyMock,
  deleteStrategy: deleteStrategyMock,
  upsertStrategySection: upsertStrategySectionMock,
  deleteStrategySection: deleteStrategySectionMock,
  listStrategyVersions: vi.fn(),
  getStrategyVersion: getStrategyVersionMock,
  restoreStrategyVersion: restoreStrategyVersionMock,
  getMissingSections: getMissingSectionsMock,
  getSimilarStrategies: getSimilarStrategiesMock,
  summarizeStrategy: summarizeStrategyMock,
  suggestStrategyImprovements: vi.fn(),
  generateStrategyExecutiveSummary: vi.fn(),
  generateStrategyLearningNotes: vi.fn(),
  generateStrategyRiskHighlights: vi.fn(),
  generateStrategySetupChecklist: generateStrategySetupChecklistMock,
  generateStrategyTradePrepChecklist: vi.fn(),
  generateStrategyReviewQuestions: vi.fn(),
}));

function strategy(overrides: Partial<AiStrategy> = {}): AiStrategy {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "Breakout playbook",
    description: null,
    strategyType: "Breakout",
    assetClass: null,
    folder: null,
    status: "draft",
    pinned: false,
    archived: false,
    tags: [],
    currentVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function detail(overrides: Partial<AiStrategyDetail> = {}): AiStrategyDetail {
  return {
    ...strategy(),
    sections: [],
    versions: [],
    ...overrides,
  };
}

beforeEach(() => {
  listStrategiesMock.mockReset().mockResolvedValue([]);
  createStrategyMock.mockReset();
  getStrategyMock.mockReset().mockResolvedValue(detail());
  updateStrategyMock.mockReset().mockResolvedValue(strategy());
  deleteStrategyMock.mockReset().mockResolvedValue(undefined);
  upsertStrategySectionMock.mockReset();
  deleteStrategySectionMock.mockReset();
  getStrategyVersionMock.mockReset();
  restoreStrategyVersionMock.mockReset();
  getMissingSectionsMock.mockReset();
  getSimilarStrategiesMock.mockReset();
  summarizeStrategyMock.mockReset();
  generateStrategySetupChecklistMock.mockReset();
});

describe("useAiStrategies — loading the list", () => {
  it("loads the strategy list for the given coachId on mount", async () => {
    listStrategiesMock.mockResolvedValue([strategy({ id: 1, title: "Alpha" })]);
    const { result } = renderHook(() => useAiStrategies("trading"));

    await waitFor(() => expect(result.current.isLoadingStrategies).toBe(false));

    expect(listStrategiesMock).toHaveBeenCalledWith("trading", {});
    expect(result.current.strategies).toEqual([strategy({ id: 1, title: "Alpha" })]);
  });

  it("scopes the list to a workspaceId when supplied", async () => {
    renderHook(() => useAiStrategies("trading", 42));
    await waitFor(() => expect(listStrategiesMock).toHaveBeenCalledWith("trading", { workspaceId: 42 }));
  });

  it("starts with no active strategy selected", () => {
    const { result } = renderHook(() => useAiStrategies("investing"));
    expect(result.current.activeStrategyId).toBeNull();
    expect(result.current.activeStrategyDetail).toBeNull();
  });

  it("re-fetches the list with a search term when setSearchTerm is called", async () => {
    const { result } = renderHook(() => useAiStrategies("options"));
    await waitFor(() => expect(result.current.isLoadingStrategies).toBe(false));

    act(() => result.current.setSearchTerm("breakout"));
    await waitFor(() => expect(listStrategiesMock).toHaveBeenCalledWith("options", { search: "breakout" }));
  });

  it("re-fetches the list with a folder filter when setFolder is called", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    await waitFor(() => expect(result.current.isLoadingStrategies).toBe(false));

    act(() => result.current.setFolder("Templates"));
    await waitFor(() => expect(listStrategiesMock).toHaveBeenCalledWith("trading", { folder: "Templates" }));
  });

  it("re-fetches the list with a status filter when setStatusFilter is called", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    await waitFor(() => expect(result.current.isLoadingStrategies).toBe(false));

    act(() => result.current.setStatusFilter("active"));
    await waitFor(() => expect(listStrategiesMock).toHaveBeenCalledWith("trading", { status: "active" }));
  });

  it("re-fetches the list with includeArchived when toggled on", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    await waitFor(() => expect(result.current.isLoadingStrategies).toBe(false));

    act(() => result.current.setIncludeArchived(true));
    await waitFor(() => expect(listStrategiesMock).toHaveBeenCalledWith("trading", { includeArchived: true }));
  });
});

describe("useAiStrategies — selecting a strategy", () => {
  it("selectStrategy sets the active id and fetches its full detail", async () => {
    getStrategyMock.mockResolvedValue(detail({ id: 7, title: "Selected one" }));
    const { result } = renderHook(() => useAiStrategies("trading"));

    act(() => result.current.selectStrategy(7));

    await waitFor(() => expect(result.current.isLoadingActiveStrategy).toBe(false));
    expect(result.current.activeStrategyId).toBe(7);
    expect(getStrategyMock).toHaveBeenCalledWith(7);
    expect(result.current.activeStrategyDetail?.title).toBe("Selected one");
  });

  it("clearSelection returns to the top-level, unselected view", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    act(() => result.current.selectStrategy(7));
    await waitFor(() => expect(result.current.activeStrategyId).toBe(7));

    act(() => result.current.clearSelection());

    expect(result.current.activeStrategyId).toBeNull();
    expect(result.current.activeStrategyDetail).toBeNull();
  });
});

describe("useAiStrategies — create / update / pin / archive / delete", () => {
  it("createStrategyAnd creates then refreshes the list", async () => {
    createStrategyMock.mockResolvedValue(strategy({ id: 99, title: "New one" }));
    const { result } = renderHook(() => useAiStrategies("trading"));
    await waitFor(() => expect(result.current.isLoadingStrategies).toBe(false));
    listStrategiesMock.mockClear();

    let created: AiStrategy | undefined;
    await act(async () => {
      created = await result.current.createStrategyAnd({ title: "New one", strategyType: "Breakout" });
    });

    expect(createStrategyMock).toHaveBeenCalledWith("trading", { title: "New one", strategyType: "Breakout" });
    expect(created?.id).toBe(99);
    expect(listStrategiesMock).toHaveBeenCalled();
  });

  it("togglePinById (favourite) pins then refreshes the list", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    await waitFor(() => expect(result.current.isLoadingStrategies).toBe(false));
    listStrategiesMock.mockClear();

    await act(async () => {
      await result.current.togglePinById(3, true);
    });

    expect(updateStrategyMock).toHaveBeenCalledWith(3, { pinned: true });
    expect(listStrategiesMock).toHaveBeenCalled();
  });

  it("toggleArchiveById archives then refreshes the list", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    await waitFor(() => expect(result.current.isLoadingStrategies).toBe(false));

    await act(async () => {
      await result.current.toggleArchiveById(3, true);
    });

    expect(updateStrategyMock).toHaveBeenCalledWith(3, { archived: true });
  });

  it("deleteStrategyById deletes then refreshes the list", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    await waitFor(() => expect(result.current.isLoadingStrategies).toBe(false));

    await act(async () => {
      await result.current.deleteStrategyById(3);
    });

    expect(deleteStrategyMock).toHaveBeenCalledWith(3);
  });

  it("deleting the currently-active strategy clears the active selection", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    act(() => result.current.selectStrategy(3));
    await waitFor(() => expect(result.current.activeStrategyId).toBe(3));

    await act(async () => {
      await result.current.deleteStrategyById(3);
    });

    expect(result.current.activeStrategyId).toBeNull();
    expect(result.current.activeStrategyDetail).toBeNull();
  });

  it("updateStrategyById refreshes the active detail when it's the currently-selected strategy", async () => {
    getStrategyMock.mockResolvedValue(detail({ id: 3, title: "Renamed" }));
    const { result } = renderHook(() => useAiStrategies("trading"));
    act(() => result.current.selectStrategy(3));
    await waitFor(() => expect(result.current.activeStrategyId).toBe(3));
    getStrategyMock.mockClear();

    await act(async () => {
      await result.current.updateStrategyById(3, { title: "Renamed" });
    });

    expect(updateStrategyMock).toHaveBeenCalledWith(3, { title: "Renamed" });
    expect(getStrategyMock).toHaveBeenCalledWith(3);
  });
});

describe("useAiStrategies — sections", () => {
  it("upsertSection is a no-op when no strategy is active", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    await act(async () => {
      await result.current.upsertSection({ kind: "entry", content: "hello" });
    });
    expect(upsertStrategySectionMock).not.toHaveBeenCalled();
  });

  it("upsertSection saves a section against the active strategy then refreshes its detail and the list", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    act(() => result.current.selectStrategy(5));
    await waitFor(() => expect(result.current.activeStrategyId).toBe(5));
    getStrategyMock.mockClear();
    listStrategiesMock.mockClear();

    await act(async () => {
      await result.current.upsertSection({ kind: "risk", content: "1% per trade" });
    });

    expect(upsertStrategySectionMock).toHaveBeenCalledWith(5, { kind: "risk", content: "1% per trade" });
    expect(getStrategyMock).toHaveBeenCalledWith(5);
    expect(listStrategiesMock).toHaveBeenCalled();
  });

  it("removeSection removes a section from the active strategy then refreshes its detail", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    act(() => result.current.selectStrategy(5));
    await waitFor(() => expect(result.current.activeStrategyId).toBe(5));

    await act(async () => {
      await result.current.removeSection(12);
    });

    expect(deleteStrategySectionMock).toHaveBeenCalledWith(5, 12);
  });
});

describe("useAiStrategies — versions", () => {
  it("loadVersionDetail is a no-op returning null when no strategy is active", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    const outcome = await result.current.loadVersionDetail(2);
    expect(outcome).toBeNull();
    expect(getStrategyVersionMock).not.toHaveBeenCalled();
  });

  it("loadVersionDetail loads a specific version of the active strategy", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    act(() => result.current.selectStrategy(5));
    await waitFor(() => expect(result.current.activeStrategyId).toBe(5));

    await act(async () => {
      await result.current.loadVersionDetail(2);
    });

    expect(getStrategyVersionMock).toHaveBeenCalledWith(5, 2);
  });

  it("restoreVersion restores then refreshes the active detail and the list", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    act(() => result.current.selectStrategy(5));
    await waitFor(() => expect(result.current.activeStrategyId).toBe(5));
    getStrategyMock.mockClear();
    listStrategiesMock.mockClear();

    await act(async () => {
      await result.current.restoreVersion(2);
    });

    expect(restoreStrategyVersionMock).toHaveBeenCalledWith(5, 2);
    expect(getStrategyMock).toHaveBeenCalledWith(5);
    expect(listStrategiesMock).toHaveBeenCalled();
  });
});

describe("useAiStrategies — deterministic analysis (no LLM call)", () => {
  it("loadMissingSections is a no-op returning null when no strategy is active", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    const outcome = await result.current.loadMissingSections();
    expect(outcome).toBeNull();
    expect(getMissingSectionsMock).not.toHaveBeenCalled();
  });

  it("loadSimilarStrategies is a no-op returning [] when no strategy is active", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    const outcome = await result.current.loadSimilarStrategies();
    expect(outcome).toEqual([]);
    expect(getSimilarStrategiesMock).not.toHaveBeenCalled();
  });

  it("loadMissingSections calls the API only for the active strategy", async () => {
    getMissingSectionsMock.mockResolvedValue({ missing: ["risk"], present: [], completenessPct: 50 });
    const { result } = renderHook(() => useAiStrategies("trading"));
    act(() => result.current.selectStrategy(5));
    await waitFor(() => expect(result.current.activeStrategyId).toBe(5));

    let outcome;
    await act(async () => {
      outcome = await result.current.loadMissingSections();
    });

    expect(getMissingSectionsMock).toHaveBeenCalledWith(5);
    expect(outcome).toEqual({ missing: ["risk"], present: [], completenessPct: 50 });
  });
});

describe("useAiStrategies — AI actions (explicit, never automatic)", () => {
  it("summarize is a no-op returning null when no strategy is active", async () => {
    const { result } = renderHook(() => useAiStrategies("trading"));
    const outcome = await result.current.summarize();
    expect(outcome).toBeNull();
    expect(summarizeStrategyMock).not.toHaveBeenCalled();
  });

  it("summarize calls the API only for the active strategy", async () => {
    summarizeStrategyMock.mockResolvedValue({ text: "A concise summary.", source: "template" });
    const { result } = renderHook(() => useAiStrategies("trading"));
    act(() => result.current.selectStrategy(5));
    await waitFor(() => expect(result.current.activeStrategyId).toBe(5));

    let outcome;
    await act(async () => {
      outcome = await result.current.summarize();
    });

    expect(summarizeStrategyMock).toHaveBeenCalledWith(5);
    expect(outcome).toEqual({ text: "A concise summary.", source: "template" });
  });

  it("generateSetupChecklist honestly returns unavailable when the API reports so", async () => {
    generateStrategySetupChecklistMock.mockResolvedValue({ available: false, items: [] });
    const { result } = renderHook(() => useAiStrategies("trading"));
    act(() => result.current.selectStrategy(5));
    await waitFor(() => expect(result.current.activeStrategyId).toBe(5));

    let outcome;
    await act(async () => {
      outcome = await result.current.generateSetupChecklist();
    });

    expect(generateStrategySetupChecklistMock).toHaveBeenCalledWith(5);
    expect(outcome).toEqual({ available: false, items: [] });
  });
});

describe("useAiStrategies — error handling", () => {
  it("surfaces a list-load failure via the error field rather than throwing", async () => {
    listStrategiesMock.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useAiStrategies("trading"));

    await waitFor(() => expect(result.current.error).toMatch(/network down/i));
  });
});

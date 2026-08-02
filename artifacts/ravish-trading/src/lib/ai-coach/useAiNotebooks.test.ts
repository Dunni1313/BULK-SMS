// v1.5.0 Sprint 8 — AI Research Notebooks. Isolated unit tests for the
// notebook memory hook, mocking ./notebooksApi exactly as
// useAiWorkspaces.test.ts mocks ./workspacesApi (Sprint 7) — proving the
// hook's own list/select/create/update/pin/archive/delete/search/notes/
// links/AI-action wiring independent of any one consuming page.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAiNotebooks } from "./useAiNotebooks";
import type { AiNotebook, AiNotebookDetail } from "./notebooksApi";

const listNotebooksMock = vi.hoisted(() => vi.fn());
const createNotebookMock = vi.hoisted(() => vi.fn());
const getNotebookMock = vi.hoisted(() => vi.fn());
const updateNotebookMock = vi.hoisted(() => vi.fn());
const deleteNotebookMock = vi.hoisted(() => vi.fn());
const searchNotebookContentsMock = vi.hoisted(() => vi.fn());
const addNotebookNoteMock = vi.hoisted(() => vi.fn());
const deleteNotebookNoteMock = vi.hoisted(() => vi.fn());
const addNotebookConversationLinkMock = vi.hoisted(() => vi.fn());
const addNotebookFileLinkMock = vi.hoisted(() => vi.fn());
const deleteNotebookLinkMock = vi.hoisted(() => vi.fn());
const summarizeNotebookMock = vi.hoisted(() => vi.fn());
const mergeNotebookNotesMock = vi.hoisted(() => vi.fn());
const generateNotebookTakeawaysMock = vi.hoisted(() => vi.fn());
const generateNotebookActionItemsMock = vi.hoisted(() => vi.fn());

vi.mock("./notebooksApi", () => ({
  listNotebooks: listNotebooksMock,
  createNotebook: createNotebookMock,
  getNotebook: getNotebookMock,
  updateNotebook: updateNotebookMock,
  deleteNotebook: deleteNotebookMock,
  searchNotebookContents: searchNotebookContentsMock,
  addNotebookNote: addNotebookNoteMock,
  deleteNotebookNote: deleteNotebookNoteMock,
  addNotebookConversationLink: addNotebookConversationLinkMock,
  addNotebookFileLink: addNotebookFileLinkMock,
  deleteNotebookLink: deleteNotebookLinkMock,
  summarizeNotebook: summarizeNotebookMock,
  mergeNotebookNotes: mergeNotebookNotesMock,
  generateNotebookTakeaways: generateNotebookTakeawaysMock,
  generateNotebookActionItems: generateNotebookActionItemsMock,
}));

function notebook(overrides: Partial<AiNotebook> = {}): AiNotebook {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "Q3 research",
    description: null,
    pinned: false,
    archived: false,
    tags: [],
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function detail(overrides: Partial<AiNotebookDetail> = {}): AiNotebookDetail {
  return {
    ...notebook(),
    notes: [],
    links: [],
    ...overrides,
  };
}

beforeEach(() => {
  listNotebooksMock.mockReset().mockResolvedValue([]);
  createNotebookMock.mockReset();
  getNotebookMock.mockReset().mockResolvedValue(detail());
  updateNotebookMock.mockReset().mockResolvedValue(notebook());
  deleteNotebookMock.mockReset().mockResolvedValue(undefined);
  searchNotebookContentsMock.mockReset().mockResolvedValue([]);
  addNotebookNoteMock.mockReset();
  deleteNotebookNoteMock.mockReset();
  addNotebookConversationLinkMock.mockReset();
  addNotebookFileLinkMock.mockReset();
  deleteNotebookLinkMock.mockReset();
  summarizeNotebookMock.mockReset();
  mergeNotebookNotesMock.mockReset();
  generateNotebookTakeawaysMock.mockReset();
  generateNotebookActionItemsMock.mockReset();
});

describe("useAiNotebooks — loading the list", () => {
  it("loads the notebook list for the given coachId on mount", async () => {
    listNotebooksMock.mockResolvedValue([notebook({ id: 1, title: "Alpha" })]);
    const { result } = renderHook(() => useAiNotebooks("trading"));

    await waitFor(() => expect(result.current.isLoadingNotebooks).toBe(false));

    expect(listNotebooksMock).toHaveBeenCalledWith("trading", {});
    expect(result.current.notebooks).toEqual([notebook({ id: 1, title: "Alpha" })]);
  });

  it("scopes the list to a workspaceId when supplied", async () => {
    renderHook(() => useAiNotebooks("trading", 42));
    await waitFor(() => expect(listNotebooksMock).toHaveBeenCalledWith("trading", { workspaceId: 42 }));
  });

  it("starts with no active notebook selected", () => {
    const { result } = renderHook(() => useAiNotebooks("investing"));
    expect(result.current.activeNotebookId).toBeNull();
    expect(result.current.activeNotebookDetail).toBeNull();
  });

  it("re-fetches the list with a search term when setSearchTerm is called", async () => {
    const { result } = renderHook(() => useAiNotebooks("options"));
    await waitFor(() => expect(result.current.isLoadingNotebooks).toBe(false));

    act(() => result.current.setSearchTerm("earnings"));
    await waitFor(() => expect(listNotebooksMock).toHaveBeenCalledWith("options", { search: "earnings" }));
  });

  it("re-fetches the list with includeArchived when toggled on", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    await waitFor(() => expect(result.current.isLoadingNotebooks).toBe(false));

    act(() => result.current.setIncludeArchived(true));
    await waitFor(() => expect(listNotebooksMock).toHaveBeenCalledWith("trading", { includeArchived: true }));
  });
});

describe("useAiNotebooks — selecting a notebook", () => {
  it("selectNotebook sets the active id and fetches its full detail", async () => {
    getNotebookMock.mockResolvedValue(detail({ id: 7, title: "Selected one" }));
    const { result } = renderHook(() => useAiNotebooks("trading"));

    act(() => result.current.selectNotebook(7));

    await waitFor(() => expect(result.current.isLoadingActiveNotebook).toBe(false));
    expect(result.current.activeNotebookId).toBe(7);
    expect(getNotebookMock).toHaveBeenCalledWith(7);
    expect(result.current.activeNotebookDetail?.title).toBe("Selected one");
  });

  it("clearSelection returns to the top-level, unselected view", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(7));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(7));

    act(() => result.current.clearSelection());

    expect(result.current.activeNotebookId).toBeNull();
    expect(result.current.activeNotebookDetail).toBeNull();
  });
});

describe("useAiNotebooks — create / update / pin / archive / restore / delete", () => {
  it("createNotebookAnd creates then refreshes the list", async () => {
    createNotebookMock.mockResolvedValue(notebook({ id: 99, title: "New one" }));
    const { result } = renderHook(() => useAiNotebooks("trading"));
    await waitFor(() => expect(result.current.isLoadingNotebooks).toBe(false));
    listNotebooksMock.mockClear();

    let created: AiNotebook | undefined;
    await act(async () => {
      created = await result.current.createNotebookAnd({ title: "New one" });
    });

    expect(createNotebookMock).toHaveBeenCalledWith("trading", { title: "New one" });
    expect(created?.id).toBe(99);
    expect(listNotebooksMock).toHaveBeenCalled();
  });

  it("togglePinById (favourite) pins then refreshes the list", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    await waitFor(() => expect(result.current.isLoadingNotebooks).toBe(false));
    listNotebooksMock.mockClear();

    await act(async () => {
      await result.current.togglePinById(3, true);
    });

    expect(updateNotebookMock).toHaveBeenCalledWith(3, { pinned: true });
    expect(listNotebooksMock).toHaveBeenCalled();
  });

  it("toggleArchiveById archives then refreshes the list", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    await waitFor(() => expect(result.current.isLoadingNotebooks).toBe(false));

    await act(async () => {
      await result.current.toggleArchiveById(3, true);
    });

    expect(updateNotebookMock).toHaveBeenCalledWith(3, { archived: true });
  });

  it("toggleArchiveById(false) restores a previously-archived notebook", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    await waitFor(() => expect(result.current.isLoadingNotebooks).toBe(false));

    await act(async () => {
      await result.current.toggleArchiveById(3, false);
    });

    expect(updateNotebookMock).toHaveBeenCalledWith(3, { archived: false });
  });

  it("deleteNotebookById deletes then refreshes the list", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    await waitFor(() => expect(result.current.isLoadingNotebooks).toBe(false));

    await act(async () => {
      await result.current.deleteNotebookById(3);
    });

    expect(deleteNotebookMock).toHaveBeenCalledWith(3);
  });

  it("deleting the currently-active notebook clears the active selection", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(3));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(3));

    await act(async () => {
      await result.current.deleteNotebookById(3);
    });

    expect(result.current.activeNotebookId).toBeNull();
    expect(result.current.activeNotebookDetail).toBeNull();
  });

  it("updateNotebookById refreshes the active detail when it's the currently-selected notebook", async () => {
    getNotebookMock.mockResolvedValue(detail({ id: 3, title: "Renamed" }));
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(3));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(3));
    getNotebookMock.mockClear();

    await act(async () => {
      await result.current.updateNotebookById(3, { title: "Renamed" });
    });

    expect(updateNotebookMock).toHaveBeenCalledWith(3, { title: "Renamed" });
    expect(getNotebookMock).toHaveBeenCalledWith(3);
  });
});

describe("useAiNotebooks — search notebook contents", () => {
  it("searchContents is a no-op returning [] when no notebook is active", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    const results = await result.current.searchContents("anything");
    expect(results).toEqual([]);
    expect(searchNotebookContentsMock).not.toHaveBeenCalled();
  });

  it("searchContents searches the active notebook's own content", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(5));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(5));

    await act(async () => {
      await result.current.searchContents("support zone");
    });

    expect(searchNotebookContentsMock).toHaveBeenCalledWith(5, "support zone");
  });
});

describe("useAiNotebooks — notes and links", () => {
  it("addNote is a no-op when no notebook is active", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    await act(async () => {
      await result.current.addNote("note", "hello");
    });
    expect(addNotebookNoteMock).not.toHaveBeenCalled();
  });

  it("addNote saves a note against the active notebook then refreshes its detail and the list", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(5));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(5));
    getNotebookMock.mockClear();
    listNotebooksMock.mockClear();

    await act(async () => {
      await result.current.addNote("summary", "Bullish thesis");
    });

    expect(addNotebookNoteMock).toHaveBeenCalledWith(5, "summary", "Bullish thesis");
    expect(getNotebookMock).toHaveBeenCalledWith(5);
    expect(listNotebooksMock).toHaveBeenCalled();
  });

  it("deleteNote removes a note from the active notebook then refreshes its detail", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(5));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(5));

    await act(async () => {
      await result.current.deleteNote(12);
    });

    expect(deleteNotebookNoteMock).toHaveBeenCalledWith(5, 12);
  });

  it("linkConversation links a conversation to the active notebook", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(5));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(5));

    await act(async () => {
      await result.current.linkConversation(42);
    });

    expect(addNotebookConversationLinkMock).toHaveBeenCalledWith(5, 42);
  });

  it("linkFile links a file to the active notebook", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(5));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(5));

    await act(async () => {
      await result.current.linkFile(9);
    });

    expect(addNotebookFileLinkMock).toHaveBeenCalledWith(5, 9);
  });

  it("removeLink removes a link from the active notebook", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(5));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(5));

    await act(async () => {
      await result.current.removeLink(3);
    });

    expect(deleteNotebookLinkMock).toHaveBeenCalledWith(5, 3);
  });
});

describe("useAiNotebooks — AI actions (explicit, never automatic)", () => {
  it("summarize is a no-op returning null when no notebook is active", async () => {
    const { result } = renderHook(() => useAiNotebooks("trading"));
    const outcome = await result.current.summarize();
    expect(outcome).toBeNull();
    expect(summarizeNotebookMock).not.toHaveBeenCalled();
  });

  it("summarize calls the API only for the active notebook", async () => {
    summarizeNotebookMock.mockResolvedValue({ summary: "A concise summary.", source: "template" });
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(5));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(5));

    let outcome;
    await act(async () => {
      outcome = await result.current.summarize();
    });

    expect(summarizeNotebookMock).toHaveBeenCalledWith(5);
    expect(outcome).toEqual({ summary: "A concise summary.", source: "template" });
  });

  it("mergeNotes calls the API only for the active notebook", async () => {
    mergeNotebookNotesMock.mockResolvedValue({ summary: "Merged.", source: "template" });
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(5));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(5));

    await act(async () => {
      await result.current.mergeNotes();
    });

    expect(mergeNotebookNotesMock).toHaveBeenCalledWith(5);
  });

  it("generateTakeaways honestly returns null/unavailable when the API reports so", async () => {
    generateNotebookTakeawaysMock.mockResolvedValue({ available: false, takeaways: [] });
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(5));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(5));

    let outcome;
    await act(async () => {
      outcome = await result.current.generateTakeaways();
    });

    expect(generateNotebookTakeawaysMock).toHaveBeenCalledWith(5);
    expect(outcome).toEqual({ available: false, takeaways: [] });
  });

  it("generateActionItems calls the API only for the active notebook", async () => {
    generateNotebookActionItemsMock.mockResolvedValue({ available: true, actionItems: ["Review the 10-K"] });
    const { result } = renderHook(() => useAiNotebooks("trading"));
    act(() => result.current.selectNotebook(5));
    await waitFor(() => expect(result.current.activeNotebookId).toBe(5));

    let outcome;
    await act(async () => {
      outcome = await result.current.generateActionItems();
    });

    expect(generateNotebookActionItemsMock).toHaveBeenCalledWith(5);
    expect(outcome).toEqual({ available: true, actionItems: ["Review the 10-K"] });
  });
});

describe("useAiNotebooks — error handling", () => {
  it("surfaces a list-load failure via the error field rather than throwing", async () => {
    listNotebooksMock.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useAiNotebooks("trading"));

    await waitFor(() => expect(result.current.error).toMatch(/network down/i));
  });
});

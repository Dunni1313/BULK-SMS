// v1.5.0 Sprint 7 — AI Workspaces. Isolated unit tests for the workspace
// memory hook, mocking ./workspacesApi exactly as useCoachConversations.
// test.ts mocks ./coachConversationsApi (Sprint 6) — proving the hook's own
// list/select/create/update/pin/archive/delete/notes/files wiring
// independent of any one consuming page.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAiWorkspaces } from "./useAiWorkspaces";
import type { AiWorkspace, AiWorkspaceDetail } from "./workspacesApi";

const listWorkspacesMock = vi.hoisted(() => vi.fn());
const createWorkspaceMock = vi.hoisted(() => vi.fn());
const getWorkspaceMock = vi.hoisted(() => vi.fn());
const updateWorkspaceMock = vi.hoisted(() => vi.fn());
const deleteWorkspaceMock = vi.hoisted(() => vi.fn());
const addWorkspaceNoteMock = vi.hoisted(() => vi.fn());
const deleteWorkspaceNoteMock = vi.hoisted(() => vi.fn());
const addWorkspaceFileMock = vi.hoisted(() => vi.fn());
const deleteWorkspaceFileMock = vi.hoisted(() => vi.fn());

vi.mock("./workspacesApi", () => ({
  listWorkspaces: listWorkspacesMock,
  createWorkspace: createWorkspaceMock,
  getWorkspace: getWorkspaceMock,
  updateWorkspace: updateWorkspaceMock,
  deleteWorkspace: deleteWorkspaceMock,
  addWorkspaceNote: addWorkspaceNoteMock,
  deleteWorkspaceNote: deleteWorkspaceNoteMock,
  addWorkspaceFile: addWorkspaceFileMock,
  deleteWorkspaceFile: deleteWorkspaceFileMock,
}));

function workspace(overrides: Partial<AiWorkspace> = {}): AiWorkspace {
  return {
    id: 1,
    coachId: "trading",
    name: "Q3 research",
    description: null,
    pinned: false,
    archived: false,
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function detail(overrides: Partial<AiWorkspaceDetail> = {}): AiWorkspaceDetail {
  return {
    ...workspace(),
    conversations: [],
    files: [],
    notes: [],
    ...overrides,
  };
}

beforeEach(() => {
  listWorkspacesMock.mockReset().mockResolvedValue([]);
  createWorkspaceMock.mockReset();
  getWorkspaceMock.mockReset().mockResolvedValue(detail());
  updateWorkspaceMock.mockReset().mockResolvedValue(workspace());
  deleteWorkspaceMock.mockReset().mockResolvedValue(undefined);
  addWorkspaceNoteMock.mockReset();
  deleteWorkspaceNoteMock.mockReset();
  addWorkspaceFileMock.mockReset();
  deleteWorkspaceFileMock.mockReset();
});

describe("useAiWorkspaces — loading the list", () => {
  it("loads the workspace list for the given coachId on mount", async () => {
    listWorkspacesMock.mockResolvedValue([workspace({ id: 1, name: "Alpha" })]);
    const { result } = renderHook(() => useAiWorkspaces("trading"));

    await waitFor(() => expect(result.current.isLoadingWorkspaces).toBe(false));

    expect(listWorkspacesMock).toHaveBeenCalledWith("trading", {});
    expect(result.current.workspaces).toEqual([workspace({ id: 1, name: "Alpha" })]);
  });

  it("starts with no active workspace selected", () => {
    const { result } = renderHook(() => useAiWorkspaces("investing"));
    expect(result.current.activeWorkspaceId).toBeNull();
    expect(result.current.activeWorkspaceDetail).toBeNull();
  });

  it("re-fetches the list with a search term when setSearchTerm is called", async () => {
    const { result } = renderHook(() => useAiWorkspaces("options"));
    await waitFor(() => expect(result.current.isLoadingWorkspaces).toBe(false));

    act(() => result.current.setSearchTerm("earnings"));
    await waitFor(() => expect(listWorkspacesMock).toHaveBeenCalledWith("options", { search: "earnings" }));
  });

  it("re-fetches the list with includeArchived when toggled on", async () => {
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    await waitFor(() => expect(result.current.isLoadingWorkspaces).toBe(false));

    act(() => result.current.setIncludeArchived(true));
    await waitFor(() => expect(listWorkspacesMock).toHaveBeenCalledWith("trading", { includeArchived: true }));
  });
});

describe("useAiWorkspaces — selecting a workspace", () => {
  it("selectWorkspace sets the active id and fetches its full detail", async () => {
    getWorkspaceMock.mockResolvedValue(detail({ id: 7, name: "Selected one" }));
    const { result } = renderHook(() => useAiWorkspaces("trading"));

    act(() => result.current.selectWorkspace(7));

    await waitFor(() => expect(result.current.isLoadingActiveWorkspace).toBe(false));
    expect(result.current.activeWorkspaceId).toBe(7);
    expect(getWorkspaceMock).toHaveBeenCalledWith(7);
    expect(result.current.activeWorkspaceDetail?.name).toBe("Selected one");
  });

  it("clearSelection returns to the top-level, un-grouped view", async () => {
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    act(() => result.current.selectWorkspace(7));
    await waitFor(() => expect(result.current.activeWorkspaceId).toBe(7));

    act(() => result.current.clearSelection());

    expect(result.current.activeWorkspaceId).toBeNull();
    expect(result.current.activeWorkspaceDetail).toBeNull();
  });
});

describe("useAiWorkspaces — create / update / pin / archive / delete", () => {
  it("createWorkspaceAnd creates then refreshes the list", async () => {
    createWorkspaceMock.mockResolvedValue(workspace({ id: 99, name: "New one" }));
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    await waitFor(() => expect(result.current.isLoadingWorkspaces).toBe(false));
    listWorkspacesMock.mockClear();

    let created: AiWorkspace | undefined;
    await act(async () => {
      created = await result.current.createWorkspaceAnd({ name: "New one" });
    });

    expect(createWorkspaceMock).toHaveBeenCalledWith("trading", { name: "New one" });
    expect(created?.id).toBe(99);
    expect(listWorkspacesMock).toHaveBeenCalled();
  });

  it("togglePinById pins then refreshes the list", async () => {
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    await waitFor(() => expect(result.current.isLoadingWorkspaces).toBe(false));
    listWorkspacesMock.mockClear();

    await act(async () => {
      await result.current.togglePinById(3, true);
    });

    expect(updateWorkspaceMock).toHaveBeenCalledWith(3, { pinned: true });
    expect(listWorkspacesMock).toHaveBeenCalled();
  });

  it("toggleArchiveById archives then refreshes the list", async () => {
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    await waitFor(() => expect(result.current.isLoadingWorkspaces).toBe(false));

    await act(async () => {
      await result.current.toggleArchiveById(3, true);
    });

    expect(updateWorkspaceMock).toHaveBeenCalledWith(3, { archived: true });
  });

  it("deleteWorkspaceById deletes then refreshes the list", async () => {
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    await waitFor(() => expect(result.current.isLoadingWorkspaces).toBe(false));

    await act(async () => {
      await result.current.deleteWorkspaceById(3);
    });

    expect(deleteWorkspaceMock).toHaveBeenCalledWith(3);
  });

  it("deleting the currently-active workspace clears the active selection", async () => {
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    act(() => result.current.selectWorkspace(3));
    await waitFor(() => expect(result.current.activeWorkspaceId).toBe(3));

    await act(async () => {
      await result.current.deleteWorkspaceById(3);
    });

    expect(result.current.activeWorkspaceId).toBeNull();
    expect(result.current.activeWorkspaceDetail).toBeNull();
  });

  it("updateWorkspaceById refreshes the active detail when it's the currently-selected workspace", async () => {
    getWorkspaceMock.mockResolvedValue(detail({ id: 3, name: "Renamed" }));
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    act(() => result.current.selectWorkspace(3));
    await waitFor(() => expect(result.current.activeWorkspaceId).toBe(3));
    getWorkspaceMock.mockClear();

    await act(async () => {
      await result.current.updateWorkspaceById(3, { name: "Renamed" });
    });

    expect(updateWorkspaceMock).toHaveBeenCalledWith(3, { name: "Renamed" });
    expect(getWorkspaceMock).toHaveBeenCalledWith(3);
  });
});

describe("useAiWorkspaces — notes and files", () => {
  it("addNote is a no-op when no workspace is active", async () => {
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    await act(async () => {
      await result.current.addNote("note", "hello");
    });
    expect(addWorkspaceNoteMock).not.toHaveBeenCalled();
  });

  it("addNote saves a note against the active workspace then refreshes its detail", async () => {
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    act(() => result.current.selectWorkspace(5));
    await waitFor(() => expect(result.current.activeWorkspaceId).toBe(5));
    getWorkspaceMock.mockClear();

    await act(async () => {
      await result.current.addNote("summary", "Bullish thesis");
    });

    expect(addWorkspaceNoteMock).toHaveBeenCalledWith(5, "summary", "Bullish thesis");
    expect(getWorkspaceMock).toHaveBeenCalledWith(5);
  });

  it("deleteNote removes a note from the active workspace then refreshes its detail", async () => {
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    act(() => result.current.selectWorkspace(5));
    await waitFor(() => expect(result.current.activeWorkspaceId).toBe(5));

    await act(async () => {
      await result.current.deleteNote(12);
    });

    expect(deleteWorkspaceNoteMock).toHaveBeenCalledWith(5, 12);
  });

  it("addFile saves a file reference against the active workspace", async () => {
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    act(() => result.current.selectWorkspace(5));
    await waitFor(() => expect(result.current.activeWorkspaceId).toBe(5));

    await act(async () => {
      await result.current.addFile({ fileName: "10-K.pdf", fileUrl: "https://example.com/10-k.pdf" });
    });

    expect(addWorkspaceFileMock).toHaveBeenCalledWith(5, { fileName: "10-K.pdf", fileUrl: "https://example.com/10-k.pdf" });
  });

  it("deleteFile removes a file reference from the active workspace", async () => {
    const { result } = renderHook(() => useAiWorkspaces("trading"));
    act(() => result.current.selectWorkspace(5));
    await waitFor(() => expect(result.current.activeWorkspaceId).toBe(5));

    await act(async () => {
      await result.current.deleteFile(8);
    });

    expect(deleteWorkspaceFileMock).toHaveBeenCalledWith(5, 8);
  });
});

describe("useAiWorkspaces — error handling", () => {
  it("surfaces a list-load failure via the error field rather than throwing", async () => {
    listWorkspacesMock.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useAiWorkspaces("trading"));

    await waitFor(() => expect(result.current.error).toMatch(/network down/i));
  });
});

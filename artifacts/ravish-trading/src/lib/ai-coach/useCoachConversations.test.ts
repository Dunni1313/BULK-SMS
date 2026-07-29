// v1.5.0 Sprint 6 — AI Coach Memory. Isolated unit tests for the shared
// conversation-memory hook, mocking ./coachConversationsApi exactly as
// useCoachConversation.test.ts mocks @/lib/coach-stream — proving the
// hook's own list/select/rename/delete/persist wiring independent of any
// one consuming page.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useCoachConversations } from "./useCoachConversations";
import type { CoachConversation, CoachConversationMessage } from "./coachConversationsApi";

const listConversationsMock = vi.hoisted(() => vi.fn());
const createConversationMock = vi.hoisted(() => vi.fn());
const renameConversationMock = vi.hoisted(() => vi.fn());
const deleteConversationMock = vi.hoisted(() => vi.fn());
const listMessagesMock = vi.hoisted(() => vi.fn());
const addMessageMock = vi.hoisted(() => vi.fn());

vi.mock("./coachConversationsApi", () => ({
  listConversations: listConversationsMock,
  createConversation: createConversationMock,
  renameConversation: renameConversationMock,
  deleteConversation: deleteConversationMock,
  listMessages: listMessagesMock,
  addMessage: addMessageMock,
}));

function conversation(overrides: Partial<CoachConversation> = {}): CoachConversation {
  return {
    id: 1,
    coachId: "trading",
    title: "New conversation",
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function message(overrides: Partial<CoachConversationMessage> = {}): CoachConversationMessage {
  return {
    id: 1,
    conversationId: 1,
    role: "user",
    content: "hello",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  listConversationsMock.mockReset().mockResolvedValue([]);
  createConversationMock.mockReset();
  renameConversationMock.mockReset().mockResolvedValue(conversation());
  deleteConversationMock.mockReset().mockResolvedValue(undefined);
  listMessagesMock.mockReset().mockResolvedValue([]);
  addMessageMock.mockReset();
});

describe("useCoachConversations — loading the list", () => {
  it("loads the conversation list for the given coachId on mount", async () => {
    listConversationsMock.mockResolvedValue([conversation({ id: 1, title: "Alpha" })]);
    const { result } = renderHook(() => useCoachConversations("trading"));

    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    expect(listConversationsMock).toHaveBeenCalledWith("trading", undefined);
    expect(result.current.conversations).toEqual([conversation({ id: 1, title: "Alpha" })]);
  });

  it("starts with no active conversation and an empty message list", () => {
    const { result } = renderHook(() => useCoachConversations("investing"));
    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.activeMessages).toEqual([]);
  });

  it("re-fetches the list with a search term when setSearchTerm is called", async () => {
    const { result } = renderHook(() => useCoachConversations("options"));
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    act(() => result.current.setSearchTerm("earnings"));
    await waitFor(() => expect(listConversationsMock).toHaveBeenCalledWith("options", { search: "earnings" }));
  });
});

describe("useCoachConversations — selecting / resuming", () => {
  it("selectConversation sets the active id and fetches its messages", async () => {
    listMessagesMock.mockResolvedValue([message({ content: "First question" }), message({ id: 2, role: "assistant", content: "First answer" })]);
    const { result } = renderHook(() => useCoachConversations("trading"));

    act(() => result.current.selectConversation(7));

    await waitFor(() => expect(result.current.isLoadingMessages).toBe(false));
    expect(result.current.activeConversationId).toBe(7);
    expect(listMessagesMock).toHaveBeenCalledWith(7);
    expect(result.current.activeMessages.map((m) => m.content)).toEqual(["First question", "First answer"]);
  });

  it("startNewConversation clears the active selection without any API call", async () => {
    listMessagesMock.mockResolvedValue([message()]);
    const { result } = renderHook(() => useCoachConversations("trading"));

    act(() => result.current.selectConversation(7));
    await waitFor(() => expect(result.current.activeMessages.length).toBeGreaterThan(0));

    act(() => result.current.startNewConversation());

    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.activeMessages).toEqual([]);
    // No conversation was ever created just from clicking New Chat.
    expect(createConversationMock).not.toHaveBeenCalled();
  });
});

describe("useCoachConversations — rename / delete", () => {
  it("renameConversationById renames then refreshes the list", async () => {
    const { result } = renderHook(() => useCoachConversations("trading"));
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));
    listConversationsMock.mockClear();

    await act(async () => {
      await result.current.renameConversationById(3, "New title");
    });

    expect(renameConversationMock).toHaveBeenCalledWith(3, "New title");
    expect(listConversationsMock).toHaveBeenCalled();
  });

  it("deleteConversationById deletes then refreshes the list", async () => {
    const { result } = renderHook(() => useCoachConversations("trading"));
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    await act(async () => {
      await result.current.deleteConversationById(3);
    });

    expect(deleteConversationMock).toHaveBeenCalledWith(3);
  });

  it("deleting the currently-active conversation clears the active selection", async () => {
    listMessagesMock.mockResolvedValue([message()]);
    const { result } = renderHook(() => useCoachConversations("trading"));
    act(() => result.current.selectConversation(3));
    await waitFor(() => expect(result.current.activeConversationId).toBe(3));

    await act(async () => {
      await result.current.deleteConversationById(3);
    });

    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.activeMessages).toEqual([]);
  });

  it("deleting a DIFFERENT conversation than the active one leaves the active selection untouched", async () => {
    listMessagesMock.mockResolvedValue([message()]);
    const { result } = renderHook(() => useCoachConversations("trading"));
    act(() => result.current.selectConversation(3));
    await waitFor(() => expect(result.current.activeConversationId).toBe(3));

    await act(async () => {
      await result.current.deleteConversationById(99);
    });

    expect(result.current.activeConversationId).toBe(3);
  });
});

describe("useCoachConversations — persistTurn (the onAnswered wiring point)", () => {
  it("auto-creates a conversation on the first persisted turn when none is active", async () => {
    createConversationMock.mockResolvedValue(conversation({ id: 42 }));
    addMessageMock.mockResolvedValue(message());
    const { result } = renderHook(() => useCoachConversations("trading"));
    await waitFor(() => expect(result.current.isLoadingConversations).toBe(false));

    await act(async () => {
      await result.current.persistTurn({ question: "Is AAPL a good entry?", answer: "Here's the analysis..." });
    });

    expect(createConversationMock).toHaveBeenCalledWith("trading");
    expect(addMessageMock).toHaveBeenNthCalledWith(1, 42, "user", "Is AAPL a good entry?");
    expect(addMessageMock).toHaveBeenNthCalledWith(2, 42, "assistant", "Here's the analysis...");
    expect(result.current.activeConversationId).toBe(42);
  });

  it("reuses the already-active conversation on subsequent turns — never creates a second one", async () => {
    addMessageMock.mockResolvedValue(message());
    const { result } = renderHook(() => useCoachConversations("trading"));
    act(() => result.current.selectConversation(5));
    await waitFor(() => expect(result.current.activeConversationId).toBe(5));

    await act(async () => {
      await result.current.persistTurn({ question: "q1", answer: "a1" });
    });
    await act(async () => {
      await result.current.persistTurn({ question: "q2", answer: "a2" });
    });

    expect(createConversationMock).not.toHaveBeenCalled();
    expect(addMessageMock).toHaveBeenCalledWith(5, "user", "q1");
    expect(addMessageMock).toHaveBeenCalledWith(5, "user", "q2");
  });

  it("surfaces a persistence failure via the error field rather than throwing", async () => {
    createConversationMock.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useCoachConversations("trading"));

    await act(async () => {
      await result.current.persistTurn({ question: "q", answer: "a" });
    });

    expect(result.current.error).toMatch(/network down/i);
  });
});

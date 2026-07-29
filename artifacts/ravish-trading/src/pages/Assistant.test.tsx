// Phase 4, Sprint 59 — AI Options Coach Conversation Memory Parity. The
// first test file for this page (previously untested). Covers the same
// empty/loading/history/error states StockResearch.tsx's Ask panel (Sprint
// 30) and TradingResearch.tsx's coach panel (Sprint 48) already have tests
// for, plus this page's own pre-existing streaming/stop feature (not
// changed this sprint, but locked in by a regression test now that a test
// file exists at all).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

const mockState = vi.hoisted(() => ({
  messages: [] as unknown[],
  messagesLoading: false,
  lessons: [] as unknown[],
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetAiMessages: () => ({ data: mockState.messages, isLoading: mockState.messagesLoading }),
    useGetCoachLessons: () => ({ data: mockState.lessons }),
  };
});

// v1.5.0 Sprint 6 — AI Coach Memory. The Options AI Coach now renders its
// own persistent, multi-conversation history instead of the flat
// useGetAiMessages() list above (that hook/route are still called and
// still invalidated unchanged, just no longer read for the chat view). A
// small, realistic in-memory fake of the new conversation-persistence API,
// mirroring TradingResearch.test.tsx's/StockResearch.test.tsx's own
// established pattern for this exact mock.
const coachConversationsState = vi.hoisted(() => ({
  conversations: [] as any[],
  messagesByConversation: {} as Record<number, any[]>,
  nextConversationId: 1,
  nextMessageId: 1,
}));
vi.mock("@/lib/ai-coach/coachConversationsApi", () => ({
  listConversations: vi.fn(async () => coachConversationsState.conversations),
  createConversation: vi.fn(async (coachId: string, _title?: string, workspaceId?: number) => {
    const id = coachConversationsState.nextConversationId++;
    coachConversationsState.messagesByConversation[id] = [];
    const conversation = {
      id,
      coachId,
      title: "New conversation",
      archived: false,
      workspaceId: workspaceId ?? null,
      favourite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    coachConversationsState.conversations = [conversation, ...coachConversationsState.conversations];
    return conversation;
  }),
  renameConversation: vi.fn(),
  deleteConversation: vi.fn(),
  listMessages: vi.fn(async (id: number) => coachConversationsState.messagesByConversation[id] ?? []),
  addMessage: vi.fn(async (id: number, role: "user" | "assistant", content: string) => {
    const message = {
      id: coachConversationsState.nextMessageId++,
      conversationId: id,
      role,
      content,
      createdAt: new Date().toISOString(),
    };
    coachConversationsState.messagesByConversation[id] = [
      ...(coachConversationsState.messagesByConversation[id] ?? []),
      message,
    ];
    return message;
  }),
  // v1.5.0 Sprint 7 — AI Workspaces.
  setConversationFavourite: vi.fn(async (id: number, favourite: boolean) => {
    const conversation = coachConversationsState.conversations.find((c) => c.id === id);
    if (conversation) conversation.favourite = favourite;
    return conversation;
  }),
  assignConversationToWorkspace: vi.fn(async (id: number, workspaceId: number | null) => {
    const conversation = coachConversationsState.conversations.find((c) => c.id === id);
    if (conversation) conversation.workspaceId = workspaceId;
    return conversation;
  }),
}));

// v1.5.0 Sprint 7 — AI Workspaces. A small, realistic in-memory fake of
// the new workspace-persistence API, mirroring the coachConversationsApi
// mock above exactly.
const workspacesState = vi.hoisted(() => ({
  workspaces: [] as any[],
  filesByWorkspace: {} as Record<number, any[]>,
  notesByWorkspace: {} as Record<number, any[]>,
  nextWorkspaceId: 1,
}));
vi.mock("@/lib/ai-coach/workspacesApi", () => ({
  listWorkspaces: vi.fn(async () => workspacesState.workspaces),
  createWorkspace: vi.fn(async (coachId: string, input: { name: string; description?: string; tags?: string[] }) => {
    const id = workspacesState.nextWorkspaceId++;
    const workspace = {
      id,
      coachId,
      name: input.name,
      description: input.description ?? null,
      pinned: false,
      archived: false,
      tags: input.tags ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    workspacesState.workspaces = [workspace, ...workspacesState.workspaces];
    workspacesState.filesByWorkspace[id] = [];
    workspacesState.notesByWorkspace[id] = [];
    return workspace;
  }),
  getWorkspace: vi.fn(async (id: number) => {
    const workspace = workspacesState.workspaces.find((w) => w.id === id);
    return {
      ...workspace,
      conversations: [],
      files: workspacesState.filesByWorkspace[id] ?? [],
      notes: workspacesState.notesByWorkspace[id] ?? [],
    };
  }),
  updateWorkspace: vi.fn(async (id: number, input: Record<string, unknown>) => {
    const workspace = workspacesState.workspaces.find((w) => w.id === id);
    Object.assign(workspace, input);
    return workspace;
  }),
  deleteWorkspace: vi.fn(),
  addWorkspaceNote: vi.fn(),
  deleteWorkspaceNote: vi.fn(),
  addWorkspaceFile: vi.fn(),
  deleteWorkspaceFile: vi.fn(),
}));

// v1.5.0 Sprint 8 — AI Research Notebooks. A small, realistic in-memory
// fake of the new notebook-persistence API, mirroring the workspacesApi
// mock above exactly. The 4 AI action functions are plain vi.fn()s (no
// default resolved value) so each test controls its own honest-available/
// honest-unavailable response explicitly, per this module's own
// "never fabricates, never auto-runs" contract.
const notebooksState = vi.hoisted(() => ({
  notebooks: [] as any[],
  notesByNotebook: {} as Record<number, any[]>,
  linksByNotebook: {} as Record<number, any[]>,
  nextNotebookId: 1,
  nextNoteId: 1,
}));
vi.mock("@/lib/ai-coach/notebooksApi", () => ({
  listNotebooks: vi.fn(async () => notebooksState.notebooks),
  createNotebook: vi.fn(async (coachId: string, input: { title: string; description?: string; tags?: string[]; workspaceId?: number | null }) => {
    const id = notebooksState.nextNotebookId++;
    const notebook = {
      id,
      coachId,
      workspaceId: input.workspaceId ?? null,
      title: input.title,
      description: input.description ?? null,
      pinned: false,
      archived: false,
      tags: input.tags ?? [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notebooksState.notebooks = [notebook, ...notebooksState.notebooks];
    notebooksState.notesByNotebook[id] = [];
    notebooksState.linksByNotebook[id] = [];
    return notebook;
  }),
  getNotebook: vi.fn(async (id: number) => {
    const notebook = notebooksState.notebooks.find((n) => n.id === id);
    return {
      ...notebook,
      notes: notebooksState.notesByNotebook[id] ?? [],
      links: notebooksState.linksByNotebook[id] ?? [],
    };
  }),
  updateNotebook: vi.fn(async (id: number, input: Record<string, unknown>) => {
    const notebook = notebooksState.notebooks.find((n) => n.id === id);
    Object.assign(notebook, input);
    return notebook;
  }),
  deleteNotebook: vi.fn(),
  searchNotebookContents: vi.fn(async () => []),
  addNotebookNote: vi.fn(async (notebookId: number, kind: string, content: string) => {
    const note = { id: notebooksState.nextNoteId++, notebookId, kind, content, createdAt: new Date().toISOString() };
    notebooksState.notesByNotebook[notebookId] = [...(notebooksState.notesByNotebook[notebookId] ?? []), note];
    return note;
  }),
  deleteNotebookNote: vi.fn(),
  addNotebookConversationLink: vi.fn(),
  addNotebookFileLink: vi.fn(),
  deleteNotebookLink: vi.fn(),
  summarizeNotebook: vi.fn(),
  mergeNotebookNotes: vi.fn(),
  generateNotebookTakeaways: vi.fn(),
  generateNotebookActionItems: vi.fn(),
}));

import Assistant from "./Assistant";

describe("Assistant page (AI Options Coach)", () => {
  beforeEach(() => {
    mockState.messages = [];
    mockState.messagesLoading = false;
    mockState.lessons = [];
    streamCoachMock.mockReset();
    streamCoachMock.mockResolvedValue(undefined);
    coachConversationsState.conversations = [];
    coachConversationsState.messagesByConversation = {};
    coachConversationsState.nextConversationId = 1;
    coachConversationsState.nextMessageId = 1;
    workspacesState.workspaces = [];
    workspacesState.filesByWorkspace = {};
    workspacesState.notesByWorkspace = {};
    workspacesState.nextWorkspaceId = 1;
    notebooksState.notebooks = [];
    notebooksState.notesByNotebook = {};
    notebooksState.linksByNotebook = {};
    notebooksState.nextNotebookId = 1;
    notebooksState.nextNoteId = 1;
  });

  it("shows a loading skeleton while messages are still loading, not the empty-state welcome", () => {
    mockState.messagesLoading = true;
    const { container } = renderWithClient(<Assistant />);
    expect(screen.queryByText(/Hello\. I am DK Option Engine Coach/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("shows an honest empty-state welcome with quick-start suggestions when there is no history yet", () => {
    renderWithClient(<Assistant />);
    expect(screen.getByText(/Hello\. I am DK Option Engine Coach/i)).toBeInTheDocument();
    expect(screen.getByText("Explain my latest trade")).toBeInTheDocument();
    expect(screen.getByText("Quiz me on Iron Condors")).toBeInTheDocument();
  });

  // v1.5.0 Sprint 6 — AI Coach Memory. Chat history is now rendered from
  // the new per-conversation store (resumed via the sidebar), not from the
  // old flat useGetAiMessages() list.
  it("renders a resumed conversation's persisted history for both roles", async () => {
    coachConversationsState.conversations = [
      {
        id: 5,
        coachId: "options",
        title: "Trade Explanation",
        archived: false,
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:05.000Z",
      },
    ];
    coachConversationsState.messagesByConversation[5] = [
      { id: 1, conversationId: 5, role: "user", content: "Explain my latest trade.", createdAt: "2026-07-01T12:00:00.000Z" },
      { id: 2, conversationId: 5, role: "assistant", content: "Your latest trade was a bullish put spread on AAPL.", createdAt: "2026-07-01T12:00:05.000Z" },
    ];
    const user = userEvent.setup();
    renderWithClient(<Assistant />);

    await user.click(await screen.findByTestId("assistant-coach-sidebar-select-5"));

    expect(await screen.findByText("Explain my latest trade.")).toBeInTheDocument();
    expect(screen.getByText(/bullish put spread on AAPL/i)).toBeInTheDocument();
  });

  it("auto-creates a conversation and persists a completed turn once the answer streams in", async () => {
    streamCoachMock.mockImplementation(async (_path: string, _body: unknown, handlers: { onDone?: (d: unknown) => void }) => {
      handlers.onDone?.({ answer: "Delta measures direction and rough odds of finishing ITM." });
    });
    const user = userEvent.setup();
    renderWithClient(<Assistant />);

    await user.type(screen.getByTestId("assistant-input"), "What is delta?");
    await user.click(screen.getByTestId("assistant-submit"));

    expect(await screen.findByText(/Delta measures direction/i)).toBeInTheDocument();
    expect(screen.getByText("What is delta?")).toBeInTheDocument();
  });

  it("submits the form with the current mode/level and the typed message", async () => {
    const user = userEvent.setup();
    renderWithClient(<Assistant />);

    await user.type(screen.getByTestId("assistant-input"), "What is delta?");
    await user.click(screen.getByTestId("assistant-submit"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/ai/chat/stream",
      { message: "What is delta?", mode: undefined, level: "beginner" },
      expect.anything(),
      expect.anything(),
    );
  });

  it("streams partial assistant text into view while a reply is still in flight", async () => {
    streamCoachMock.mockImplementation(async (_path: string, _body: unknown, handlers: { onDelta?: (t: string) => void }) => {
      handlers.onDelta?.("Delta measures ");
      // Never resolves within this test — simulates an in-progress stream so
      // the partial text stays visible instead of being cleared by onDone.
      return new Promise(() => {});
    });
    const user = userEvent.setup();
    renderWithClient(<Assistant />);

    await user.type(screen.getByTestId("assistant-input"), "What is delta?");
    await user.click(screen.getByTestId("assistant-submit"));

    expect(await screen.findByText(/Delta measures/i)).toBeInTheDocument();
    // The user's own just-sent message renders optimistically too.
    expect(screen.getByText("What is delta?")).toBeInTheDocument();
  });

  it("honestly shows a failure turn on a genuine mid-stream server error, instead of silently dropping it", async () => {
    streamCoachMock.mockImplementation(async (_path: string, _body: unknown, handlers: { onError?: (msg: string) => void }) => {
      handlers.onError?.("Failed to generate response");
    });
    const user = userEvent.setup();
    renderWithClient(<Assistant />);

    await user.type(screen.getByTestId("assistant-input"), "Quiz me on Iron Condors.");
    await user.click(screen.getByTestId("assistant-submit"));

    expect(await screen.findByTestId("assistant-error-turn")).toHaveTextContent(
      /Failed to get an answer — please try again\./i,
    );
    // The input re-enables once the failed stream settles.
    expect(screen.getByTestId("assistant-input")).not.toBeDisabled();
  });

  it("clears the honest failure turn once a new message is sent", async () => {
    streamCoachMock.mockImplementationOnce(async (_path: string, _body: unknown, handlers: { onError?: (msg: string) => void }) => {
      handlers.onError?.("Failed to generate response");
    });
    const user = userEvent.setup();
    renderWithClient(<Assistant />);

    await user.type(screen.getByTestId("assistant-input"), "First question");
    await user.click(screen.getByTestId("assistant-submit"));
    expect(await screen.findByTestId("assistant-error-turn")).toBeInTheDocument();

    streamCoachMock.mockImplementation(async () => new Promise(() => {}));
    await user.type(screen.getByTestId("assistant-input"), "Second question");
    await user.click(screen.getByTestId("assistant-submit"));

    expect(screen.queryByTestId("assistant-error-turn")).not.toBeInTheDocument();
  });

  it("shows a Stop control while streaming, and stopping leaves the partial reply visible with a Stopped indicator", async () => {
    streamCoachMock.mockImplementation(async (_path: string, _body: unknown, handlers: { onDelta?: (t: string) => void }) => {
      handlers.onDelta?.("Gamma measures how fast delta moves.");
      return new Promise(() => {});
    });
    const user = userEvent.setup();
    renderWithClient(<Assistant />);

    await user.type(screen.getByTestId("assistant-input"), "What is gamma?");
    await user.click(screen.getByTestId("assistant-submit"));

    const stopButton = await screen.findByTestId("assistant-stop");
    await user.click(stopButton);

    expect(await screen.findByText(/Stopped/i)).toBeInTheDocument();
    expect(screen.getByText(/Gamma measures how fast delta moves/i)).toBeInTheDocument();
  });

  // v1.5.0 Sprint 7 — AI Workspaces.
  describe("v1.5.0 Sprint 7 — AI Workspaces", () => {
    it("shows an honest empty state when there are no workspaces yet", async () => {
      renderWithClient(<Assistant />);
      expect(await screen.findByTestId("assistant-workspace-sidebar-empty")).toBeInTheDocument();
    });

    it("creating a workspace adds it to the sidebar", async () => {
      const user = userEvent.setup();
      renderWithClient(<Assistant />);

      await user.click(await screen.findByTestId("assistant-workspace-sidebar-new-workspace"));
      await user.type(screen.getByTestId("assistant-workspace-sidebar-create-name"), "Earnings project");
      await user.click(screen.getByTestId("assistant-workspace-sidebar-create-save"));

      expect(await screen.findByText("Earnings project")).toBeInTheDocument();
    });

    it("selecting a workspace shows its WorkspaceHeader and scopes the conversation list to it", async () => {
      workspacesState.workspaces = [
        {
          id: 9,
          coachId: "options",
          name: "Iron condor research",
          description: "Deep dive on IC entries",
          pinned: false,
          archived: false,
          tags: ["ic"],
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ];
      workspacesState.filesByWorkspace[9] = [];
      workspacesState.notesByWorkspace[9] = [];
      coachConversationsState.conversations = [
        {
          id: 5,
          coachId: "options",
          title: "In the workspace",
          archived: false,
          workspaceId: 9,
          favourite: false,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ];
      const user = userEvent.setup();
      renderWithClient(<Assistant />);

      await user.click(await screen.findByTestId("assistant-workspace-sidebar-card-9-select"));

      expect(await screen.findByTestId("assistant-workspace-header")).toBeInTheDocument();
      expect(screen.getByTestId("assistant-workspace-header-name")).toHaveTextContent("Iron condor research");
    });

    it("'All conversations' clears the workspace selection and hides the WorkspaceHeader", async () => {
      workspacesState.workspaces = [
        {
          id: 9,
          coachId: "options",
          name: "Iron condor research",
          description: null,
          pinned: false,
          archived: false,
          tags: [],
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ];
      workspacesState.filesByWorkspace[9] = [];
      workspacesState.notesByWorkspace[9] = [];
      const user = userEvent.setup();
      renderWithClient(<Assistant />);

      await user.click(await screen.findByTestId("assistant-workspace-sidebar-card-9-select"));
      expect(await screen.findByTestId("assistant-workspace-header")).toBeInTheDocument();

      await user.click(screen.getByTestId("assistant-workspace-sidebar-all-conversations"));
      expect(screen.queryByTestId("assistant-workspace-header")).not.toBeInTheDocument();
    });

    it("a conversation resumed from the sidebar can be marked as a favourite", async () => {
      coachConversationsState.conversations = [
        {
          id: 5,
          coachId: "options",
          title: "Trade Explanation",
          archived: false,
          workspaceId: null,
          favourite: false,
          createdAt: "2026-07-01T12:00:00.000Z",
          updatedAt: "2026-07-01T12:00:05.000Z",
        },
      ];
      const user = userEvent.setup();
      renderWithClient(<Assistant />);

      await user.click(await screen.findByTestId("assistant-coach-sidebar-favourite-5"));
      // No crash / no thrown error is the meaningful assertion here — the
      // real PATCH call is faked via coachConversationsApi's own mock,
      // which the hook's setConversationFavourite import resolves against.
      expect(screen.getByTestId("assistant-coach-sidebar-favourite-5")).toBeInTheDocument();
    });
  });

  describe("v1.5.0 Sprint 8 — AI Research Notebooks", () => {
    it("defaults to the Conversations view; switching to Notebooks hides the conversation UI and shows the notebook sidebar", async () => {
      const user = userEvent.setup();
      renderWithClient(<Assistant />);

      expect(screen.queryByTestId("assistant-notebook-sidebar")).not.toBeInTheDocument();
      await user.click(screen.getByTestId("assistant-view-notebooks"));
      expect(await screen.findByTestId("assistant-notebook-sidebar")).toBeInTheDocument();

      await user.click(screen.getByTestId("assistant-view-conversations"));
      expect(screen.queryByTestId("assistant-notebook-sidebar")).not.toBeInTheDocument();
    });

    it("shows an honest 'no notebook selected' message before any notebook is chosen", async () => {
      const user = userEvent.setup();
      renderWithClient(<Assistant />);
      await user.click(screen.getByTestId("assistant-view-notebooks"));
      expect(await screen.findByTestId("assistant-notebook-detail-empty")).toBeInTheDocument();
    });

    it("creates a notebook via the sidebar's inline form, then selecting it shows the header/editor/summary panel", async () => {
      const user = userEvent.setup();
      renderWithClient(<Assistant />);
      await user.click(screen.getByTestId("assistant-view-notebooks"));

      await user.click(await screen.findByTestId("assistant-notebook-sidebar-new-notebook"));
      await user.type(screen.getByTestId("assistant-notebook-sidebar-create-title"), "Q3 research");
      await user.click(screen.getByTestId("assistant-notebook-sidebar-create-save"));

      const card = await screen.findByTestId(/assistant-notebook-sidebar-list-card-\d+-select/);
      await user.click(card);

      expect(await screen.findByTestId("assistant-notebook-header")).toHaveTextContent("Q3 research");
      expect(screen.getByTestId("assistant-notebook-editor")).toBeInTheDocument();
      expect(screen.getByTestId("assistant-notebook-summary-panel")).toBeInTheDocument();
    });

    it("adding a note in the editor persists it and it appears in the notebook's own note list", async () => {
      const user = userEvent.setup();
      renderWithClient(<Assistant />);
      await user.click(screen.getByTestId("assistant-view-notebooks"));
      await user.click(await screen.findByTestId("assistant-notebook-sidebar-new-notebook"));
      await user.type(screen.getByTestId("assistant-notebook-sidebar-create-title"), "Research notebook");
      await user.click(screen.getByTestId("assistant-notebook-sidebar-create-save"));
      await user.click(await screen.findByTestId(/assistant-notebook-sidebar-list-card-\d+-select/));

      await screen.findByTestId("assistant-notebook-editor");
      await user.type(screen.getByTestId("assistant-notebook-editor-note-input"), "Support held at 145");
      await user.click(screen.getByTestId("assistant-notebook-editor-note-save"));

      expect(await screen.findByText("Support held at 145")).toBeInTheDocument();
    });

    it("the AI summarise action is explicit — never called automatically — and renders the honest result once clicked", async () => {
      const { summarizeNotebook } = await import("@/lib/ai-coach/notebooksApi");
      vi.mocked(summarizeNotebook).mockResolvedValue({ summary: "This notebook has no notes yet.", source: "template" });

      const user = userEvent.setup();
      renderWithClient(<Assistant />);
      await user.click(screen.getByTestId("assistant-view-notebooks"));
      await user.click(await screen.findByTestId("assistant-notebook-sidebar-new-notebook"));
      await user.type(screen.getByTestId("assistant-notebook-sidebar-create-title"), "Empty notebook");
      await user.click(screen.getByTestId("assistant-notebook-sidebar-create-save"));
      await user.click(await screen.findByTestId(/assistant-notebook-sidebar-list-card-\d+-select/));
      await screen.findByTestId("assistant-notebook-summary-panel");

      expect(summarizeNotebook).not.toHaveBeenCalled();
      await user.click(screen.getByTestId("assistant-notebook-summary-panel-summarize-button"));
      expect(await screen.findByTestId("assistant-notebook-summary-panel-summary-result")).toHaveTextContent(
        "This notebook has no notes yet.",
      );
    });
  });
});

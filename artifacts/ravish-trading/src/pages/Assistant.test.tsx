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
  createConversation: vi.fn(async (coachId: string) => {
    const id = coachConversationsState.nextConversationId++;
    coachConversationsState.messagesByConversation[id] = [];
    const conversation = {
      id,
      coachId,
      title: "New conversation",
      archived: false,
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
});

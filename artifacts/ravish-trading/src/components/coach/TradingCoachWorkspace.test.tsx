// v1.3.1 — AI Trading Coach, Frontend UI. The main integration test for
// the Coach's orchestrator component — mirrors pages/Assistant.test.tsx's
// own established streamCoach-mocking pattern (Sprint 59) closely, since
// TradingCoachWorkspace's send/stream/error/stop logic is deliberately
// modeled on that exact precedent. Covers: rendering, empty state,
// suggested-prompt selection, message submission (including the optional
// symbol/scannerCandidateId/tradingPositionId focus fields), streaming
// response rendering, loading state, error/retry, context display, context
// removal, conversation history, and the clear-conversation confirmation
// flow. Uses mocked streamCoach()/GET messages — never a live AI provider.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect } from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";
import { useTradingCoach, type TradingCoachFocus } from "@/hooks/use-trading-coach";

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

const mockState = vi.hoisted(() => ({
  messages: [] as { id: number; role: "user" | "assistant"; message: string; createdAt: string }[],
  messagesLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetUnifiedTradingCoachMessages: () => ({ data: mockState.messages, isLoading: mockState.messagesLoading }),
  };
});

import { TradingCoachWorkspace } from "./TradingCoachWorkspace";

function Harness({ initialFocus }: { initialFocus?: TradingCoachFocus }) {
  const { setFocus } = useTradingCoach();
  useEffect(() => {
    if (initialFocus) setFocus(initialFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <TradingCoachWorkspace />;
}

function renderWorkspace(initialFocus?: TradingCoachFocus) {
  return renderWithClient(<Harness initialFocus={initialFocus} />);
}

beforeEach(() => {
  mockState.messages = [];
  mockState.messagesLoading = false;
  streamCoachMock.mockReset();
  streamCoachMock.mockResolvedValue(undefined);
  window.history.pushState(null, "", "/trading-research");
});

describe("TradingCoachWorkspace — rendering, loading, and empty state", () => {
  it("shows a loading skeleton while persisted history is still loading", () => {
    mockState.messagesLoading = true;
    renderWorkspace();
    expect(screen.getByTestId("trading-coach-loading-history")).toBeInTheDocument();
    expect(screen.queryByTestId("trading-coach-empty")).not.toBeInTheDocument();
  });

  it("shows the honest empty state when there is no history yet", () => {
    renderWorkspace();
    expect(screen.getByTestId("trading-coach-empty")).toBeInTheDocument();
  });

  it("renders the header, context panel, disclaimer, and composer together", () => {
    renderWorkspace();
    expect(screen.getByTestId("trading-coach-header")).toBeInTheDocument();
    expect(screen.getByTestId("trading-coach-context-panel")).toBeInTheDocument();
    expect(screen.getByTestId("text-trading-coach-disclaimer")).toBeInTheDocument();
    expect(screen.getByTestId("input-trading-coach-composer")).toBeInTheDocument();
  });
});

describe("TradingCoachWorkspace — context display and removal", () => {
  it("shows only the always-shared context chips with no focus set", () => {
    renderWorkspace();
    expect(screen.getByTestId("trading-coach-context-chip-risk")).toBeInTheDocument();
    expect(screen.queryByTestId("trading-coach-context-chip-symbol")).not.toBeInTheDocument();
  });

  it("shows the symbol chip once a focus symbol is set", () => {
    renderWorkspace({ symbol: "AAPL" });
    expect(screen.getByTestId("trading-coach-context-chip-symbol")).toHaveTextContent("AAPL");
  });

  it("clicking Clear in the context panel removes the optional focus (and its chip)", () => {
    renderWorkspace({ symbol: "AAPL" });
    expect(screen.getByTestId("trading-coach-context-chip-symbol")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-trading-coach-clear-context"));
    expect(screen.queryByTestId("trading-coach-context-chip-symbol")).not.toBeInTheDocument();
  });
});

describe("TradingCoachWorkspace — conversation history", () => {
  it("renders persisted history for both roles", () => {
    mockState.messages = [
      { id: 1, role: "user", message: "What is my biggest risk right now?", createdAt: "2026-07-01T12:00:00.000Z" },
      { id: 2, role: "assistant", message: "Your portfolio risk reads Elevated.", createdAt: "2026-07-01T12:00:05.000Z" },
    ];
    renderWorkspace();
    expect(screen.getByText("What is my biggest risk right now?")).toBeInTheDocument();
    expect(screen.getByText(/portfolio risk reads Elevated/i)).toBeInTheDocument();
  });
});

describe("TradingCoachWorkspace — message submission", () => {
  it("submits with the optional symbol/scannerCandidateId/tradingPositionId focus fields", async () => {
    const user = userEvent.setup();
    renderWorkspace({ symbol: "AAPL", scannerCandidateId: 9, tradingPositionId: 3 });

    await user.type(screen.getByTestId("input-trading-coach-composer"), "Explain this opportunity");
    await user.click(screen.getByTestId("button-trading-coach-send"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/trading-coach/ask/stream",
      { question: "Explain this opportunity", symbol: "AAPL", scannerCandidateId: 9, tradingPositionId: 3 },
      expect.anything(),
      expect.anything(),
    );
  });

  it("selecting a suggested prompt sends it as the question", async () => {
    renderWorkspace({ symbol: "AAPL" });
    fireEvent.click(screen.getByText("Explain the Greeks"));

    await waitFor(() =>
      expect(streamCoachMock).toHaveBeenCalledWith(
        "/trading-coach/ask/stream",
        expect.objectContaining({ question: "Explain the Greeks" }),
        expect.anything(),
        expect.anything(),
      ),
    );
  });
});

describe("TradingCoachWorkspace — streaming, loading, error/retry, and stop", () => {
  it("streams partial assistant text into view while a reply is in flight", async () => {
    streamCoachMock.mockImplementation(async (_p: string, _b: unknown, handlers: { onDelta?: (t: string) => void }) => {
      handlers.onDelta?.("Your position sizing looks reasonable.");
      return new Promise(() => {});
    });
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByTestId("input-trading-coach-composer"), "Review my portfolio");
    await user.click(screen.getByTestId("button-trading-coach-send"));

    expect(await screen.findByText(/position sizing looks reasonable/i)).toBeInTheDocument();
    expect(screen.getByText("Review my portfolio")).toBeInTheDocument();
  });

  it("shows a thinking indicator before the first delta arrives", async () => {
    streamCoachMock.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByTestId("input-trading-coach-composer"), "Review my portfolio");
    await user.click(screen.getByTestId("button-trading-coach-send"));

    expect(await screen.findByTestId("trading-coach-thinking")).toBeInTheDocument();
  });

  it("shows an honest error state with a Retry button on a genuine mid-stream failure", async () => {
    streamCoachMock.mockImplementation(async (_p: string, _b: unknown, handlers: { onError?: (msg: string) => void }) => {
      handlers.onError?.("Failed to answer question");
    });
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByTestId("input-trading-coach-composer"), "What are the key risks?");
    await user.click(screen.getByTestId("button-trading-coach-send"));

    expect(await screen.findByTestId("trading-coach-error")).toHaveTextContent(/failed to get an answer/i);
    expect(screen.getByTestId("input-trading-coach-composer")).not.toBeDisabled();
  });

  it("Retry re-sends the exact same last question", async () => {
    streamCoachMock.mockImplementationOnce(async (_p: string, _b: unknown, handlers: { onError?: (msg: string) => void }) => {
      handlers.onError?.("Failed to answer question");
    });
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByTestId("input-trading-coach-composer"), "What are the key risks?");
    await user.click(screen.getByTestId("button-trading-coach-send"));
    expect(await screen.findByTestId("trading-coach-error")).toBeInTheDocument();

    streamCoachMock.mockImplementation(() => new Promise(() => {}));
    await user.click(screen.getByTestId("button-trading-coach-retry"));

    await waitFor(() =>
      expect(streamCoachMock).toHaveBeenLastCalledWith(
        "/trading-coach/ask/stream",
        expect.objectContaining({ question: "What are the key risks?" }),
        expect.anything(),
        expect.anything(),
      ),
    );
  });

  it("shows a Stop control while streaming; stopping leaves the partial reply visible", async () => {
    streamCoachMock.mockImplementation(async (_p: string, _b: unknown, handlers: { onDelta?: (t: string) => void }) => {
      handlers.onDelta?.("Delta measures direction.");
      return new Promise(() => {});
    });
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByTestId("input-trading-coach-composer"), "Explain the Greeks");
    await user.click(screen.getByTestId("button-trading-coach-send"));

    const stopButton = await screen.findByTestId("button-trading-coach-stop");
    await user.click(stopButton);

    expect(await screen.findByText(/Stopped/i)).toBeInTheDocument();
    expect(screen.getByText(/Delta measures direction/i)).toBeInTheDocument();
  });
});

describe("TradingCoachWorkspace — clear conversation confirmation", () => {
  it("does not offer Clear conversation with no history", () => {
    renderWorkspace();
    expect(screen.queryByTestId("button-trading-coach-clear-conversation")).not.toBeInTheDocument();
  });

  it("clearing the conversation (after confirming) hides the previously-visible history", async () => {
    mockState.messages = [
      { id: 1, role: "user", message: "Explain this opportunity", createdAt: "2026-07-01T12:00:00.000Z" },
      { id: 2, role: "assistant", message: "This is a bullish setup.", createdAt: "2026-07-01T12:00:05.000Z" },
    ];
    const user = userEvent.setup();
    renderWorkspace();

    expect(screen.getByText("Explain this opportunity")).toBeInTheDocument();
    await user.click(screen.getByTestId("button-trading-coach-clear-conversation"));
    await user.click(screen.getByTestId("button-trading-coach-clear-confirm"));

    expect(screen.queryByText("Explain this opportunity")).not.toBeInTheDocument();
    expect(screen.getByTestId("trading-coach-empty")).toBeInTheDocument();
  });

  it("cancelling the clear-conversation dialog leaves history visible", async () => {
    mockState.messages = [
      { id: 1, role: "user", message: "Explain this opportunity", createdAt: "2026-07-01T12:00:00.000Z" },
    ];
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByTestId("button-trading-coach-clear-conversation"));
    await user.click(screen.getByTestId("button-trading-coach-clear-cancel"));

    expect(screen.getByText("Explain this opportunity")).toBeInTheDocument();
  });
});

describe("TradingCoachWorkspace — suggested actions never trigger execution", () => {
  it("shows suggested actions only once there is history, as plain navigation links", () => {
    mockState.messages = [
      { id: 1, role: "user", message: "Hi", createdAt: "2026-07-01T12:00:00.000Z" },
      { id: 2, role: "assistant", message: "Hello.", createdAt: "2026-07-01T12:00:05.000Z" },
    ];
    renderWorkspace();
    const actions = screen.getByTestId("trading-coach-suggested-actions");
    expect(actions.querySelector("a")).not.toBeNull();
    // Never a form or button-that-submits inside the suggested actions block.
    expect(actions.querySelector("form")).toBeNull();
  });
});

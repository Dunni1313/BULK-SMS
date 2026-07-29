// v1.5.0 Sprint 2 — AI Coach Architecture Consolidation, Framework
// (Frontend). Isolated unit tests for the shared conversation engine,
// mocking @/lib/coach-stream exactly as every existing coach-panel test
// file already does (vi.hoisted + vi.mock), proving the hook's own
// request/response/error/abort/retry wiring independent of any one
// consuming page.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useCoachConversation } from "./useCoachConversation";

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

beforeEach(() => {
  streamCoachMock.mockReset();
  streamCoachMock.mockResolvedValue(undefined);
});

describe("useCoachConversation — sending", () => {
  it("does nothing for an empty or whitespace-only question", () => {
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }) }),
    );

    act(() => result.current.send("   "));

    expect(streamCoachMock).not.toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
  });

  it("does nothing while already streaming", () => {
    streamCoachMock.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }) }),
    );

    act(() => result.current.send("first"));
    act(() => result.current.send("second"));

    expect(streamCoachMock).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled", () => {
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }), disabled: true }),
    );

    act(() => result.current.send("hello"));

    expect(streamCoachMock).not.toHaveBeenCalled();
  });

  it("calls streamCoach with the endpoint and the caller's own request body shape", () => {
    const { result } = renderHook(() =>
      useCoachConversation({
        endpoint: "/trading-coach/ask/stream",
        buildRequestBody: (q) => ({ question: q, symbol: "AAPL" }),
      }),
    );

    act(() => result.current.send("What is the trend?"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/trading-coach/ask/stream",
      { question: "What is the trend?", symbol: "AAPL" },
      expect.anything(),
      expect.anything(),
    );
  });

  it("re-evaluates buildRequestBody fresh on every call — never a stale closure", async () => {
    let currentSymbol = "AAPL";
    streamCoachMock.mockImplementation(
      async (_p: string, _b: unknown, handlers: { onDone?: (d: unknown) => void }) => {
        handlers.onDone?.({ answer: "ok" });
      },
    );
    const { result } = renderHook(() =>
      useCoachConversation({
        endpoint: "/x/ask/stream",
        buildRequestBody: (q) => ({ question: q, symbol: currentSymbol }),
      }),
    );

    act(() => result.current.send("first"));
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(streamCoachMock).toHaveBeenLastCalledWith(
      "/x/ask/stream",
      { question: "first", symbol: "AAPL" },
      expect.anything(),
      expect.anything(),
    );

    currentSymbol = "MSFT";
    act(() => result.current.send("second"));
    expect(streamCoachMock).toHaveBeenLastCalledWith(
      "/x/ask/stream",
      { question: "second", symbol: "MSFT" },
      expect.anything(),
      expect.anything(),
    );
  });

  it("clears the question field and sets pendingQuestion immediately on send", () => {
    streamCoachMock.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }) }),
    );

    act(() => result.current.setQuestion("Explain this"));
    act(() => result.current.send());

    expect(result.current.question).toBe("");
    expect(result.current.pendingQuestion).toBe("Explain this");
    expect(result.current.isStreaming).toBe(true);
  });
});

describe("useCoachConversation — streaming, done, and history", () => {
  it("accumulates onDelta chunks into streamingAnswer", () => {
    streamCoachMock.mockImplementation(async (_p: string, _b: unknown, handlers: { onDelta?: (t: string) => void }) => {
      handlers.onDelta?.("The trend ");
      handlers.onDelta?.("is up.");
      return new Promise(() => {});
    });
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }) }),
    );

    act(() => result.current.send("Explain"));

    expect(result.current.streamingAnswer).toBe("The trend is up.");
  });

  it("appends a completed turn to history and calls onAnswered, reading the done payload's answer field by default", async () => {
    streamCoachMock.mockImplementation(
      async (_p: string, _b: unknown, handlers: { onDone?: (d: unknown) => void }) => {
        handlers.onDone?.({ answer: "It is trending up.", answerSource: "llm" });
      },
    );
    const onAnswered = vi.fn();
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }), onAnswered }),
    );

    act(() => result.current.send("Explain"));

    await waitFor(() => expect(result.current.history).toHaveLength(1));
    expect(result.current.history[0]).toEqual({ question: "Explain", answer: "It is trending up." });
    expect(result.current.pendingQuestion).toBeNull();
    expect(result.current.streamingAnswer).toBe("");
    expect(result.current.isStreaming).toBe(false);
    expect(onAnswered).toHaveBeenCalledWith({ question: "Explain", answer: "It is trending up." });
  });

  it("falls back to the accumulated streamed text when the done payload has no answer field", async () => {
    streamCoachMock.mockImplementation(
      async (_p: string, _b: unknown, handlers: { onDelta?: (t: string) => void; onDone?: (d: unknown) => void }) => {
        handlers.onDelta?.("streamed text");
        handlers.onDone?.({ somethingElse: true });
      },
    );
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }) }),
    );

    act(() => result.current.send("Explain"));

    await waitFor(() => expect(result.current.history).toHaveLength(1));
    expect(result.current.history[0].answer).toBe("streamed text");
  });

  it("uses a caller-supplied extractAnswer instead of the default .answer read", async () => {
    streamCoachMock.mockImplementation(
      async (_p: string, _b: unknown, handlers: { onDone?: (d: unknown) => void }) => {
        handlers.onDone?.({ message: "custom shape" });
      },
    );
    const { result } = renderHook(() =>
      useCoachConversation({
        endpoint: "/x/ask/stream",
        buildRequestBody: (q) => ({ q }),
        extractAnswer: (d) => (d as { message?: string }).message,
      }),
    );

    act(() => result.current.send("Explain"));

    await waitFor(() => expect(result.current.history).toHaveLength(1));
    expect(result.current.history[0].answer).toBe("custom shape");
  });

  it("never calls onAnswered on an error turn", async () => {
    streamCoachMock.mockImplementation(
      async (_p: string, _b: unknown, handlers: { onError?: (msg: string) => void }) => {
        handlers.onError?.("boom");
      },
    );
    const onAnswered = vi.fn();
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }), onAnswered }),
    );

    act(() => result.current.send("Explain"));

    await waitFor(() => expect(result.current.erroredReply).toBe(true));
    expect(onAnswered).not.toHaveBeenCalled();
  });
});

describe("useCoachConversation — error handling", () => {
  it("appends an honest failure turn to history AND sets erroredReply — both representations stay in sync", async () => {
    streamCoachMock.mockImplementation(
      async (_p: string, _b: unknown, handlers: { onError?: (msg: string) => void }) => {
        handlers.onError?.("Failed to answer question");
      },
    );
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }) }),
    );

    act(() => result.current.send("Explain"));

    await waitFor(() => expect(result.current.erroredReply).toBe(true));
    expect(result.current.history).toEqual([
      { question: "Explain", answer: "Failed to get an answer — please try again." },
    ]);
    expect(result.current.isStreaming).toBe(false);
  });

  it("honors a custom errorMessage override", async () => {
    streamCoachMock.mockImplementation(
      async (_p: string, _b: unknown, handlers: { onError?: (msg: string) => void }) => {
        handlers.onError?.("boom");
      },
    );
    const { result } = renderHook(() =>
      useCoachConversation({
        endpoint: "/x/ask/stream",
        buildRequestBody: (q) => ({ q }),
        errorMessage: "Custom failure text.",
      }),
    );

    act(() => result.current.send("Explain"));

    await waitFor(() => expect(result.current.history).toHaveLength(1));
    expect(result.current.history[0].answer).toBe("Custom failure text.");
  });

  it("clears isStreaming (never crashes) when the streamCoach() promise itself rejects (a raw abort)", async () => {
    streamCoachMock.mockImplementation(() => Promise.reject(new Error("aborted")));
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }) }),
    );

    act(() => result.current.send("Explain"));

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
  });
});

describe("useCoachConversation — submit / stop / retry", () => {
  it("submit() prevents the default form event and sends the current question field", () => {
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }) }),
    );
    act(() => result.current.setQuestion("Explain this"));

    const preventDefault = vi.fn();
    act(() => result.current.submit({ preventDefault } as unknown as React.FormEvent));

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(streamCoachMock).toHaveBeenCalledWith(
      "/x/ask/stream",
      { q: "Explain this" },
      expect.anything(),
      expect.anything(),
    );
  });

  it("stop() aborts the in-flight request and sets stopped, keeping the partial answer visible", () => {
    let capturedSignal: AbortSignal | undefined;
    streamCoachMock.mockImplementation(
      (_p: string, _b: unknown, handlers: { onDelta?: (t: string) => void }, signal?: AbortSignal) => {
        capturedSignal = signal;
        handlers.onDelta?.("partial answer");
        return new Promise(() => {});
      },
    );
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }) }),
    );

    act(() => result.current.send("Explain"));
    expect(result.current.streamingAnswer).toBe("partial answer");

    act(() => result.current.stop());

    expect(result.current.stopped).toBe(true);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamingAnswer).toBe("partial answer");
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("retry() re-sends the most recently sent question", async () => {
    streamCoachMock.mockImplementation(
      async (_p: string, _b: unknown, handlers: { onError?: (msg: string) => void }) => {
        handlers.onError?.("boom");
      },
    );
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }) }),
    );

    act(() => result.current.send("What are the risks?"));
    await waitFor(() => expect(result.current.erroredReply).toBe(true));

    streamCoachMock.mockImplementation(() => new Promise(() => {}));
    act(() => result.current.retry());

    expect(streamCoachMock).toHaveBeenLastCalledWith(
      "/x/ask/stream",
      { q: "What are the risks?" },
      expect.anything(),
      expect.anything(),
    );
  });

  it("retry() is a no-op when no question has ever been sent", () => {
    const { result } = renderHook(() =>
      useCoachConversation({ endpoint: "/x/ask/stream", buildRequestBody: (q) => ({ q }) }),
    );

    act(() => result.current.retry());

    expect(streamCoachMock).not.toHaveBeenCalled();
  });
});

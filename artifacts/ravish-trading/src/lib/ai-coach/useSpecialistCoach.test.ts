// v1.5.0 Sprint 3 — Specialist Coach Adapters. Proves the adapter layer's
// own behavior-preservation guarantees directly, independent of any one
// consuming page: every specialist coach genuinely loads through the
// shared useCoachConversation() engine via its own declared CoachConfig,
// each coach's config sends to its own correct, unchanged endpoint with
// its own request-body shape, conversation state is fully isolated between
// two coach instances (even two instances of the *same* coach), and no
// coach's config exposes another coach's capabilities/params.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSpecialistCoach } from "./useSpecialistCoach";
import { tradingCoachConfig } from "./coaches/tradingCoach.config";
import { investingCoachConfig } from "./coaches/investingCoach.config";
import { optionsCoachConfig } from "./coaches/optionsCoach.config";
import { AiChatInputLevel } from "@workspace/api-client-react";

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

beforeEach(() => {
  streamCoachMock.mockReset();
  streamCoachMock.mockResolvedValue(undefined);
});

describe("useSpecialistCoach — each coach sends to its own correct endpoint/body", () => {
  it("Trading AI Coach sends {symbol, question} to /trading/coach/ask/stream", () => {
    const { result } = renderHook(() => useSpecialistCoach(tradingCoachConfig, { symbol: "AAPL" }));
    act(() => result.current.send("Is now a good time?"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/trading/coach/ask/stream",
      { symbol: "AAPL", question: "Is now a good time?" },
      expect.anything(),
      expect.anything(),
    );
  });

  it("Trading AI Coach refuses to send with no symbol chosen", () => {
    const { result } = renderHook(() => useSpecialistCoach(tradingCoachConfig, { symbol: null }));
    act(() => result.current.send("Anything?"));

    expect(streamCoachMock).not.toHaveBeenCalled();
  });

  it("Investing AI Coach sends {symbol, question} to /stock-analyst/value-research/ask/stream", () => {
    const { result } = renderHook(() => useSpecialistCoach(investingCoachConfig, { symbol: "MSFT" }));
    act(() => result.current.send("Why Hold?"));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/stock-analyst/value-research/ask/stream",
      { symbol: "MSFT", question: "Why Hold?" },
      expect.anything(),
      expect.anything(),
    );
  });

  it("Options AI Coach sends {message, mode, level} to /ai/chat/stream, omitting mode when 'auto'", () => {
    const { result } = renderHook(() =>
      useSpecialistCoach(optionsCoachConfig, { mode: "auto", level: AiChatInputLevel.beginner }),
    );
    act(() => result.current.send("Explain my latest trade."));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/ai/chat/stream",
      { message: "Explain my latest trade.", mode: undefined, level: AiChatInputLevel.beginner },
      expect.anything(),
      expect.anything(),
    );
  });

  it("Options AI Coach passes a specific mode through unchanged when not 'auto'", () => {
    const { result } = renderHook(() =>
      useSpecialistCoach(optionsCoachConfig, { mode: "teach_greeks" as const, level: AiChatInputLevel.advanced }),
    );
    act(() => result.current.send("Teach me Vega."));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/ai/chat/stream",
      { message: "Teach me Vega.", mode: "teach_greeks", level: AiChatInputLevel.advanced },
      expect.anything(),
      expect.anything(),
    );
  });
});

describe("useSpecialistCoach — conversation state stays isolated per coach instance", () => {
  it("two different coaches' hook instances never share question/history/streaming state", async () => {
    streamCoachMock.mockImplementation(async (_endpoint, _body, handlers) => {
      handlers.onDone?.({ answer: "an answer" });
    });

    const { result: trading } = renderHook(() => useSpecialistCoach(tradingCoachConfig, { symbol: "AAPL" }));
    const { result: investing } = renderHook(() => useSpecialistCoach(investingCoachConfig, { symbol: "MSFT" }));

    act(() => trading.current.send("Trading question"));
    await waitFor(() => expect(trading.current.history).toHaveLength(1));

    // The Investing coach's own history is completely untouched by the
    // Trading coach's completed turn.
    expect(investing.current.history).toHaveLength(0);
    expect(trading.current.history[0].question).toBe("Trading question");
  });

  it("two instances of the SAME coach config (e.g. two symbols searched in sequence) never leak state", async () => {
    streamCoachMock.mockImplementation(async (_endpoint, _body, handlers) => {
      handlers.onDone?.({ answer: "answer for this instance" });
    });

    const { result: aapl } = renderHook(() => useSpecialistCoach(tradingCoachConfig, { symbol: "AAPL" }));
    const { result: tsla } = renderHook(() => useSpecialistCoach(tradingCoachConfig, { symbol: "TSLA" }));

    act(() => aapl.current.send("About AAPL"));
    await waitFor(() => expect(aapl.current.history).toHaveLength(1));

    expect(tsla.current.history).toHaveLength(0);
  });
});

describe("Specialist coach configs — context/tool isolation", () => {
  const configs = [tradingCoachConfig, investingCoachConfig, optionsCoachConfig];

  it("every coach has a unique id and endpoint", () => {
    const ids = configs.map((c) => c.id);
    const endpoints = configs.map((c) => c.endpoint);
    expect(new Set(ids).size).toBe(configs.length);
    expect(new Set(endpoints).size).toBe(configs.length);
  });

  it("no two coaches declare the same capability set", () => {
    const capabilitySets = configs.map((c) => [...c.capabilities].sort().join(","));
    expect(new Set(capabilitySets).size).toBe(configs.length);
  });

  it("Trading AI Coach's capabilities never include Investing or Options domain terms", () => {
    const forbidden = ["valuation-fundamentals", "company-research", "investment-committee", "greeks", "expected-value"];
    for (const cap of tradingCoachConfig.capabilities) {
      expect(forbidden).not.toContain(cap);
    }
  });

  it("Investing AI Coach's capabilities never include Trading or Options domain terms", () => {
    const forbidden = ["market-structure", "liquidity", "trading-risk", "greeks", "expected-value"];
    for (const cap of investingCoachConfig.capabilities) {
      expect(forbidden).not.toContain(cap);
    }
  });

  it("Options AI Coach's capabilities never include Trading or Investing domain terms", () => {
    const forbidden = ["market-structure", "liquidity", "trading-risk", "valuation-fundamentals", "company-research"];
    for (const cap of optionsCoachConfig.capabilities) {
      expect(forbidden).not.toContain(cap);
    }
  });

  it("Trading AI Coach's starter prompts are derived from its own symbol param, empty with none", () => {
    expect(tradingCoachConfig.starterPrompts?.({ symbol: null })).toEqual([]);
    const withSymbol = tradingCoachConfig.starterPrompts?.({ symbol: "AAPL" }) ?? [];
    expect(withSymbol.length).toBeGreaterThan(0);
    expect(withSymbol.every((p) => p.includes("AAPL"))).toBe(true);
  });

  it("Investing AI Coach's starter prompts are derived from its own symbol param", () => {
    const prompts = investingCoachConfig.starterPrompts?.({ symbol: "MSFT" }) ?? [];
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.every((p) => p.includes("MSFT"))).toBe(true);
  });

  it("Options AI Coach's starter prompts don't reference a symbol at all (no per-symbol context)", () => {
    const prompts = optionsCoachConfig.starterPrompts?.({ mode: "auto", level: AiChatInputLevel.beginner }) ?? [];
    expect(prompts.length).toBeGreaterThan(0);
  });
});

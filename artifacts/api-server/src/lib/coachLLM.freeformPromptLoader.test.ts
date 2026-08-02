// v1.5.0 Sprint 4 — AI Context & Tools Consolidation, "Prompt Loader" tests.
//
// Proves createFreeformNarrator() (coachLLM.ts) — the shared factory
// narrateValueFreeform/Stream and narrateTradeFreeform/Stream are now both
// built from — genuinely selects the CORRECT, coach-specific prompt prefix
// for each coach, and never mixes the two. Mocks the LLM SDK the same way
// coach-level.test.ts already established (echo the user prompt back as
// the completion), so the actual final prompt text sent to the model is
// directly inspectable, not just inferred from a disclaimer being present.

import { describe, it, expect, beforeEach, vi } from "vitest";

const llmMock = vi.hoisted(() => {
  process.env.OPENAI_API_KEY = "sk-test-openai-key";
  const state = {
    userContents: [] as string[],
    reset(): void {
      state.userContents = [];
    },
  };
  return state;
});

vi.mock("openai", () => ({
  default: class FakeOpenAI {
    chat = {
      completions: {
        create: (params: { messages: { role: string; content: string }[] }) => {
          const user = params.messages.find((m) => m.role === "user")?.content ?? "";
          llmMock.userContents.push(user);
          return Promise.resolve({ choices: [{ message: { content: user } }] });
        },
      },
    };
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = {
      create: () => Promise.reject(new Error("anthropic path not used in these tests")),
      stream: () => {
        throw new Error("anthropic path not used in these tests");
      },
    };
  },
}));

import { narrateValueFreeform, narrateTradeFreeform } from "./coachLLM.js";

beforeEach(() => {
  llmMock.reset();
});

describe("Prompt Loader (createFreeformNarrator) — selects the correct prompt per coach", () => {
  it("Investing coach's prompt is prefixed with its own value-investing prompt text, never the Trading coach's", async () => {
    const n = await narrateValueFreeform(
      "Why does the Investment Committee say Hold?",
      { symbol: "AAPL" },
      "fallback text",
    );
    const sentPrompt = llmMock.userContents[0];

    expect(sentPrompt).toContain("You are a patient value-investing tutor");
    expect(sentPrompt).toContain("Warren Buffett");
    expect(sentPrompt).toContain("QUESTION: Why does the Investment Committee say Hold?");
    // Never leaks the Trading coach's own prompt framing.
    expect(sentPrompt).not.toContain("Ravish Trading Coach");
    expect(n.text.length).toBeGreaterThan(0);
  });

  it("Trading coach's prompt is prefixed with its own market-structure prompt text, never the Investing coach's", async () => {
    const n = await narrateTradeFreeform(
      "Is now a good time to look at AAPL given my risk profile?",
      { symbol: "AAPL" },
      "fallback text",
    );
    const sentPrompt = llmMock.userContents[0];

    expect(sentPrompt).toContain("You are the Ravish Trading Coach");
    expect(sentPrompt).toContain("market structure, liquidity, multi-timeframe trend, regime, and probability cone");
    expect(sentPrompt).toContain("QUESTION: Is now a good time to look at AAPL given my risk profile?");
    // Never leaks the Investing coach's own persona framing.
    expect(sentPrompt).not.toContain("value-investing tutor");
    expect(sentPrompt).not.toContain("Warren Buffett");
    expect(n.text.length).toBeGreaterThan(0);
  });

  it("the same question sent through two different coaches produces two genuinely different final prompts", async () => {
    const question = "What should I know right now?";
    await narrateValueFreeform(question, { symbol: "MSFT" }, "fallback");
    await narrateTradeFreeform(question, { symbol: "MSFT" }, "fallback");

    const [valuePrompt, tradePrompt] = llmMock.userContents;
    expect(valuePrompt).not.toBe(tradePrompt);
    expect(valuePrompt).toContain("value-investing tutor");
    expect(tradePrompt).toContain("Ravish Trading Coach");
    // Both correctly carry the SAME question text, despite the different prompt prefix.
    expect(valuePrompt).toContain(`QUESTION: ${question}`);
    expect(tradePrompt).toContain(`QUESTION: ${question}`);
  });

  it("prompt selection is stable across repeated calls to the same coach (never drifts between calls)", async () => {
    await narrateValueFreeform("First question", { symbol: "AAPL" }, "fallback");
    await narrateValueFreeform("Second question, entirely different", { symbol: "TSLA" }, "fallback");

    const [first, second] = llmMock.userContents;
    const firstPrefix = first.split("\n\nQUESTION:")[0];
    const secondPrefix = second.split("\n\nQUESTION:")[0];
    expect(firstPrefix).toBe(secondPrefix);
  });
});

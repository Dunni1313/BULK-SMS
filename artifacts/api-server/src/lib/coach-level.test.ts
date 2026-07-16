// Coach explanation-depth (beginner vs advanced) separation tests.
//
// The coach accepts an optional `level` ("beginner" | "advanced") that is folded
// into BOTH the LLM prompt (levelInstruction) and the response cache key
// (levelKey). Two invariants must hold or a user could ask for a beginner
// explanation and be served a cached advanced one (or vice versa):
//   1. levelInstruction is applied to the prompt on every narration path, so the
//      model is actually told which depth to write at.
//   2. levelKey makes beginner and advanced distinct cache entries for the SAME
//      trade/lesson, so the two depths never collide in the shared cache.
//
// The cache is only populated on the LLM path, so we mock the provider SDK (and
// stub the key via vi.hoisted, which runs before coachLLM.ts reads it at import
// time) to select the OpenAI path. The mock echoes the user prompt back as the
// completion so each result reveals which level instruction was used, and it
// counts calls so a cache hit (no new call) vs miss (new call) is observable.

import { describe, it, expect, beforeEach, vi } from "vitest";

const llmMock = vi.hoisted(() => {
  process.env.OPENAI_API_KEY = "sk-test-openai-key";
  const state = {
    openaiCallCount: 0,
    lastUserContent: "",
    userContents: [] as string[],
    reset(): void {
      state.openaiCallCount = 0;
      state.lastUserContent = "";
      state.userContents = [];
    },
  };
  return state;
});

// Echo the user message back as the completion so the result text reveals which
// levelInstruction the prompt carried, and record every user content for direct
// inspection of the prompt that was sent.
vi.mock("openai", () => ({
  default: class FakeOpenAI {
    chat = {
      completions: {
        create: (params: { messages: { role: string; content: string }[] }) => {
          llmMock.openaiCallCount += 1;
          const user = params.messages.find((m) => m.role === "user")?.content ?? "";
          llmMock.lastUserContent = user;
          llmMock.userContents.push(user);
          return Promise.resolve({ choices: [{ message: { content: user } }] });
        },
      },
    };
  },
}));

// The Anthropic SDK is imported at top level even though our key selects the
// OpenAI path — mock it so no real client is ever constructed.
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

import { COACH_DISCLAIMER, teachGreek, explainSymbolStrategy } from "./coach.js";
import { narrateGreekLesson, narrateTradeExplanation } from "./coachLLM.js";

beforeEach(() => {
  llmMock.reset();
});

describe("level separation: beginner and advanced are distinct cache entries", () => {
  it("trade explanation: same trade at beginner vs advanced does NOT collide in cache", async () => {
    // A unique symbol so this test owns its cache keys (the cache is shared
    // module-wide across tests in the run).
    const e = explainSymbolStrategy("NVDA", "iron_condor");

    const beginner = await narrateTradeExplanation(e, "beginner");
    expect(llmMock.openaiCallCount).toBe(1);
    expect(beginner.source).toBe("llm");

    // Same trade, same level → served from cache, no new LLM call.
    const beginnerAgain = await narrateTradeExplanation(e, "beginner");
    expect(llmMock.openaiCallCount).toBe(1);
    expect(beginnerAgain.text).toBe(beginner.text);

    // Same trade, DIFFERENT level → cache MISS (distinct key), new LLM call.
    const advanced = await narrateTradeExplanation(e, "advanced");
    expect(llmMock.openaiCallCount).toBe(2);
    expect(advanced.source).toBe("llm");

    // Advanced is now also cached independently of beginner.
    const advancedAgain = await narrateTradeExplanation(e, "advanced");
    expect(llmMock.openaiCallCount).toBe(2);
    expect(advancedAgain.text).toBe(advanced.text);

    // The two depths produced genuinely different narrations — beginner did not
    // leak into advanced (or vice versa).
    expect(beginner.text).not.toBe(advanced.text);
  });

  it("greek lesson: same lesson at beginner vs advanced does NOT collide in cache", async () => {
    const lesson = teachGreek("delta", "META");

    const beginner = await narrateGreekLesson(lesson, "beginner");
    expect(llmMock.openaiCallCount).toBe(1);

    const beginnerAgain = await narrateGreekLesson(lesson, "beginner");
    expect(llmMock.openaiCallCount).toBe(1);
    expect(beginnerAgain.text).toBe(beginner.text);

    const advanced = await narrateGreekLesson(lesson, "advanced");
    expect(llmMock.openaiCallCount).toBe(2);

    expect(beginner.text).not.toBe(advanced.text);
  });

  it("an unleveled ask is its own cache entry, distinct from beginner and advanced", async () => {
    const lesson = teachGreek("theta", "AAPL");

    await narrateGreekLesson(lesson); // no level
    expect(llmMock.openaiCallCount).toBe(1);
    await narrateGreekLesson(lesson, "beginner");
    expect(llmMock.openaiCallCount).toBe(2);
    await narrateGreekLesson(lesson, "advanced");
    expect(llmMock.openaiCallCount).toBe(3);
    // Re-asking the unleveled variant is still a cache hit (no 4th call).
    await narrateGreekLesson(lesson);
    expect(llmMock.openaiCallCount).toBe(3);
  });
});

describe("level separation: levelInstruction is applied to the prompt", () => {
  it("trade-explanation path threads the BEGINNER / ADVANCED instruction into the prompt", async () => {
    await narrateTradeExplanation(explainSymbolStrategy("AMZN", "iron_condor"), "beginner");
    expect(llmMock.lastUserContent).toContain("BEGINNER depth");
    expect(llmMock.lastUserContent).not.toContain("ADVANCED depth");

    await narrateTradeExplanation(explainSymbolStrategy("MSFT", "iron_condor"), "advanced");
    expect(llmMock.lastUserContent).toContain("ADVANCED depth");
    expect(llmMock.lastUserContent).not.toContain("BEGINNER depth");
  });

  it("greek-lesson path threads the BEGINNER / ADVANCED instruction into the prompt", async () => {
    await narrateGreekLesson(teachGreek("vega", "GOOGL"), "beginner");
    expect(llmMock.lastUserContent).toContain("BEGINNER depth");
    expect(llmMock.lastUserContent).not.toContain("ADVANCED depth");

    await narrateGreekLesson(teachGreek("gamma", "TSLA"), "advanced");
    expect(llmMock.lastUserContent).toContain("ADVANCED depth");
    expect(llmMock.lastUserContent).not.toContain("BEGINNER depth");
  });

  it("an unleveled ask carries no depth instruction at all", async () => {
    await narrateTradeExplanation(explainSymbolStrategy("IWM", "iron_condor"));
    expect(llmMock.lastUserContent).not.toContain("BEGINNER depth");
    expect(llmMock.lastUserContent).not.toContain("ADVANCED depth");
  });

  it("every leveled narration still carries the COACH_DISCLAIMER", async () => {
    const n = await narrateTradeExplanation(explainSymbolStrategy("SPY", "iron_condor"), "beginner");
    expect(n.text).toContain(COACH_DISCLAIMER);
  });
});

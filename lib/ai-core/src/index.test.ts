// Phase 1, Sprint 9 — lib/ai-core unit tests, in isolation from any engine's
// domain content (no options/trades/Greeks fixtures). Proves the extraction's
// own acceptance criteria: provider detection, the timeout/cache/single-flight
// guards, and the disclaimer-enforcement guarantee all work with a generic
// systemPrompt/disclaimer/data supplied by an arbitrary caller.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const GENERIC_SYSTEM_PROMPT = "You are a generic test assistant. Answer using only the provided DATA.";
const GENERIC_DISCLAIMER = "This is a generic test disclaimer.";

describe("provider detection", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.doUnmock("openai");
    vi.doUnmock("@anthropic-ai/sdk");
  });

  it("selects Anthropic when ANTHROPIC_API_KEY is set", async () => {
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class FakeAnthropic {
        messages = { create: () => Promise.resolve({ content: [] }) };
      },
    }));
    vi.doMock("openai", () => ({
      default: class FakeOpenAI {
        chat = { completions: { create: () => Promise.reject(new Error("not used")) } };
      },
    }));
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    const { llmAvailable } = await import("./index.js");
    expect(llmAvailable()).toBe(true);
  });

  it("selects OpenAI when OPENAI_API_KEY holds a correctly-named OpenAI key", async () => {
    vi.doMock("openai", () => ({
      default: class FakeOpenAI {
        chat = { completions: { create: () => Promise.reject(new Error("not used")) } };
      },
    }));
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class FakeAnthropic {
        messages = { create: () => Promise.reject(new Error("not used")) };
      },
    }));
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test-openai-key";
    const { llmAvailable } = await import("./index.js");
    expect(llmAvailable()).toBe(true);
  });

  it("legacy path: OPENAI_API_KEY holding an sk-ant- key selects Anthropic and fires onWarn", async () => {
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class FakeAnthropic {
        messages = { create: () => Promise.reject(new Error("not used")) };
      },
    }));
    vi.doMock("openai", () => ({
      default: class FakeOpenAI {
        chat = { completions: { create: () => Promise.reject(new Error("not used")) } };
      },
    }));
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "sk-ant-legacy-test-key";
    const { llmAvailable } = await import("./index.js");
    const warnings: Array<{ meta: unknown; message: string }> = [];
    expect(llmAvailable((meta, message) => warnings.push({ meta, message }))).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/deprecated/i);
    expect(warnings[0].meta).toBeUndefined();
  });

  it("no key set at all: unavailable", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { llmAvailable } = await import("./index.js");
    expect(llmAvailable()).toBe(false);
  });
});

describe("narrate/narrateStream mechanics (OpenAI path, generic prompt+disclaimer)", () => {
  const llmMock = {
    callCount: 0,
    mode: "resolve" as "resolve" | "hang" | "stream_error",
    responseText: "GENERIC MOCK RESPONSE",
    delayMs: 0,
    reset(): void {
      llmMock.callCount = 0;
      llmMock.mode = "resolve";
      llmMock.responseText = "GENERIC MOCK RESPONSE";
      llmMock.delayMs = 0;
    },
  };

  beforeEach(async () => {
    llmMock.reset();
    vi.resetModules();
    process.env.OPENAI_API_KEY = "sk-test-openai-key";
    delete process.env.ANTHROPIC_API_KEY;
    // Short per-call timeout so the "hang" tests resolve quickly instead of
    // waiting for the real 25s default.
    process.env.COACH_LLM_TIMEOUT_MS = "150";

    vi.doMock("openai", () => ({
      default: class FakeOpenAI {
        chat = {
          completions: {
            create: (params: { stream?: boolean } | undefined, opts?: { signal?: AbortSignal }) => {
              llmMock.callCount += 1;
              const signal = opts?.signal;
              if (params?.stream) {
                if (llmMock.mode === "hang") {
                  return new Promise((_resolve, reject) => {
                    if (signal?.aborted) return reject(new Error("aborted"));
                    signal?.addEventListener("abort", () => reject(new Error("aborted")));
                  });
                }
                const mode = llmMock.mode;
                const text = llmMock.responseText;
                async function* gen() {
                  if (mode === "stream_error") {
                    yield { choices: [{ delta: { content: "PARTIAL" } }] };
                    throw new Error("mid-stream boom");
                  }
                  for (const piece of text.split(" ")) {
                    yield { choices: [{ delta: { content: `${piece} ` } }] };
                  }
                }
                return Promise.resolve(gen());
              }
              if (llmMock.mode === "hang") {
                return new Promise((_resolve, reject) => {
                  if (signal?.aborted) return reject(new Error("aborted"));
                  signal?.addEventListener("abort", () => reject(new Error("aborted")));
                });
              }
              if (llmMock.delayMs > 0) {
                return new Promise((resolve) =>
                  setTimeout(
                    () => resolve({ choices: [{ message: { content: llmMock.responseText } }] }),
                    llmMock.delayMs,
                  ),
                );
              }
              return Promise.resolve({ choices: [{ message: { content: llmMock.responseText } }] });
            },
          },
        };
      },
    }));
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class FakeAnthropic {
        messages = {
          create: () => Promise.reject(new Error("anthropic path not used")),
          stream: () => {
            throw new Error("anthropic path not used");
          },
        };
      },
    }));
  });

  afterEach(() => {
    delete process.env.COACH_LLM_TIMEOUT_MS;
    vi.doUnmock("openai");
    vi.doUnmock("@anthropic-ai/sdk");
  });

  it("template fallback when the LLM is unavailable (no key)", async () => {
    delete process.env.OPENAI_API_KEY;
    const { narrate } = await import("./index.js");
    const n = await narrate("prompt", { a: 1 }, "fallback text", {
      systemPrompt: GENERIC_SYSTEM_PROMPT,
      disclaimer: GENERIC_DISCLAIMER,
    });
    expect(n.source).toBe("template");
    expect(n.text).toContain("fallback text");
    expect(n.text).toContain(GENERIC_DISCLAIMER);
  });

  it("a cache hit serves without a second LLM call", async () => {
    const { narrate } = await import("./index.js");
    const opts = { systemPrompt: GENERIC_SYSTEM_PROMPT, disclaimer: GENERIC_DISCLAIMER, cacheKey: "k1" };
    const first = await narrate("prompt", { a: 1 }, "fallback", opts);
    expect(llmMock.callCount).toBe(1);
    expect(first.source).toBe("llm");
    expect(first.text).toContain(GENERIC_DISCLAIMER);

    const second = await narrate("prompt", { a: 1 }, "fallback", opts);
    expect(llmMock.callCount).toBe(1);
    expect(second.text).toBe(first.text);
  });

  it("single-flight: N concurrent identical asks share ONE LLM call", async () => {
    llmMock.delayMs = 30;
    const { narrate } = await import("./index.js");
    const opts = { systemPrompt: GENERIC_SYSTEM_PROMPT, disclaimer: GENERIC_DISCLAIMER, cacheKey: "k2" };
    const results = await Promise.all(Array.from({ length: 5 }, () => narrate("p", {}, "fb", opts)));
    expect(llmMock.callCount).toBe(1);
    const unique = new Set(results.map((r) => r.text));
    expect(unique.size).toBe(1);
  });

  it("a hung call degrades to the template via the per-call timeout", async () => {
    llmMock.mode = "hang";
    const { narrate } = await import("./index.js");
    const n = await narrate("p", {}, "fallback text", {
      systemPrompt: GENERIC_SYSTEM_PROMPT,
      disclaimer: GENERIC_DISCLAIMER,
      cacheKey: "k3",
    });
    expect(n.source).toBe("template");
    expect(n.text).toContain("fallback text");
    expect(n.text).toContain(GENERIC_DISCLAIMER);
    expect(llmMock.callCount).toBe(1);
  });

  it("streaming: emits tokens live and enforces the disclaimer on the final text", async () => {
    const { narrateStream } = await import("./index.js");
    const chunks: string[] = [];
    const n = await narrateStream("p", {}, "fb", (c) => chunks.push(c), {
      systemPrompt: GENERIC_SYSTEM_PROMPT,
      disclaimer: GENERIC_DISCLAIMER,
      cacheKey: "k4",
    });
    expect(n.source).toBe("llm");
    expect(chunks.length).toBeGreaterThan(1);
    expect(n.text).toContain(GENERIC_DISCLAIMER);
  });

  it("streaming single-flight: followers get the finished text in one chunk", async () => {
    llmMock.delayMs = 30;
    const { narrateStream } = await import("./index.js");
    const opts = { systemPrompt: GENERIC_SYSTEM_PROMPT, disclaimer: GENERIC_DISCLAIMER, cacheKey: "k5" };
    const sinks = Array.from({ length: 4 }, () => ({ chunks: [] as string[] }));
    const results = await Promise.all(
      sinks.map((s) => narrateStream("p", {}, "fb", (c) => s.chunks.push(c), opts)),
    );
    expect(llmMock.callCount).toBe(1);
    const leaders = sinks.filter((s) => s.chunks.length > 1);
    const followers = sinks.filter((s) => s.chunks.length === 1);
    expect(leaders).toHaveLength(1);
    expect(followers).toHaveLength(3);
    const unique = new Set(results.map((r) => r.text));
    expect(unique.size).toBe(1);
  });

  it("streaming mid-stream error: finalizes the partial output without re-emitting it", async () => {
    llmMock.mode = "stream_error";
    const { narrateStream } = await import("./index.js");
    const chunks: string[] = [];
    const n = await narrateStream("p", {}, "fb", (c) => chunks.push(c), {
      systemPrompt: GENERIC_SYSTEM_PROMPT,
      disclaimer: GENERIC_DISCLAIMER,
      cacheKey: "k6",
    });
    expect(n.source).toBe("llm");
    expect(n.text).toContain("PARTIAL");
    expect(n.text).toContain(GENERIC_DISCLAIMER);
    expect(chunks).toHaveLength(1);
  });

  it("streaming timeout: a hung stream degrades to the template in one chunk", async () => {
    llmMock.mode = "hang";
    const { narrateStream } = await import("./index.js");
    const chunks: string[] = [];
    const n = await narrateStream("p", {}, "fallback text", (c) => chunks.push(c), {
      systemPrompt: GENERIC_SYSTEM_PROMPT,
      disclaimer: GENERIC_DISCLAIMER,
      cacheKey: "k7",
    });
    expect(n.source).toBe("template");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("fallback text");
  });
});

describe("complete() — direct single-shot call", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = "sk-test-openai-key";
    delete process.env.ANTHROPIC_API_KEY;
    vi.doMock("openai", () => ({
      default: class FakeOpenAI {
        chat = {
          completions: {
            create: () => Promise.resolve({ choices: [{ message: { content: "RAW COMPLETION" } }] }),
          },
        };
      },
    }));
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class FakeAnthropic {
        messages = { create: () => Promise.reject(new Error("not used")) };
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock("openai");
    vi.doUnmock("@anthropic-ai/sdk");
  });

  it("returns the raw completion text with no disclaimer applied (that's narrate()'s job, not complete()'s)", async () => {
    const { complete } = await import("./index.js");
    const text = await complete(GENERIC_SYSTEM_PROMPT, "hello", 100);
    expect(text).toBe("RAW COMPLETION");
  });
});

describe("extractJsonObject", () => {
  it("extracts a balanced JSON object from surrounding prose/fences", async () => {
    const { extractJsonObject } = await import("./index.js");
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject('prefix {"nested":{"b":2}} suffix')).toBe('{"nested":{"b":2}}');
  });
});

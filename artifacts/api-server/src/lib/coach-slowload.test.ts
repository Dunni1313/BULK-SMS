// Coach slow-load protections (concurrency hardening) tests.
//
// The coach LLM layer was hardened against timing out under concurrent load:
//   1. a per-call timeout that aborts a hung request so it degrades to the
//      deterministic template instead of hanging forever,
//   2. a short-lived shared cache so repeat asks are instant (no LLM call),
//   3. single-flight dedup so N concurrent identical asks share ONE LLM call,
//   4. an SSE heartbeat that keeps the proxy from idle-timing-out the stream.
//
// These guards have no contract surface, so without tests a refactor could
// silently reintroduce the 502 / blank-card failure. The provider SDKs are
// mocked so nothing hits a real API; env is stubbed (via vi.hoisted, which runs
// before the module-under-test is imported) so the OpenAI path is selected and
// the per-call timeout is short enough to assert against.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Response } from "express";

// Hoisted: runs before the imports below are evaluated, so the env is in place
// when coachLLM.ts reads OPENAI_API_KEY (provider selection) and
// COACH_LLM_TIMEOUT_MS (the LLM_TIMEOUT_MS module const) at import time.
const llmMock = vi.hoisted(() => {
  process.env.OPENAI_API_KEY = "sk-test-openai-key";
  process.env.COACH_LLM_TIMEOUT_MS = "150";
  const state = {
    openaiCallCount: 0,
    mode: "resolve" as "resolve" | "hang" | "stream_error",
    responseText: "MOCK LLM NARRATION",
    delayMs: 0,
    reset(): void {
      state.openaiCallCount = 0;
      state.mode = "resolve";
      state.responseText = "MOCK LLM NARRATION";
      state.delayMs = 0;
    },
    // Build a provider response honoring the configured mode. In "hang" mode the
    // promise never resolves on its own — it only rejects when the abort signal
    // fires, mimicking a stuck SDK call that the per-call timeout has to kill.
    respond<T>(signal: AbortSignal | undefined, build: () => T): Promise<T> {
      if (state.mode === "hang") {
        return new Promise<T>((_resolve, reject) => {
          if (signal?.aborted) {
            reject(new Error("aborted"));
            return;
          }
          signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      }
      if (state.delayMs > 0) {
        return new Promise<T>((resolve) => setTimeout(() => resolve(build()), state.delayMs));
      }
      return Promise.resolve(build());
    },
    // Streaming counterpart: the SDK's create({stream:true}) resolves to an async
    // iterable of delta chunks. In "hang" mode the create() promise itself never
    // resolves (only rejects on abort), exercising the per-call timeout before a
    // single token is produced. In "stream_error" mode it yields one chunk and
    // then throws, exercising the mid-stream-error path.
    respondStream(
      signal: AbortSignal | undefined,
    ): Promise<AsyncIterable<{ choices: Array<{ delta: { content: string } }> }>> {
      if (state.mode === "hang") {
        return new Promise((_resolve, reject) => {
          if (signal?.aborted) {
            reject(new Error("aborted"));
            return;
          }
          signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      }
      const mode = state.mode;
      const text = state.responseText;
      const delayMs = state.delayMs;
      async function* gen() {
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        if (mode === "stream_error") {
          yield { choices: [{ delta: { content: "PARTIAL OUTPUT" } }] };
          throw new Error("mid-stream boom");
        }
        const pieces = text.split(" ");
        for (let i = 0; i < pieces.length; i++) {
          const piece = i === 0 ? pieces[i] : ` ${pieces[i]}`;
          yield { choices: [{ delta: { content: piece } }] };
        }
      }
      return Promise.resolve(gen());
    },
  };
  return state;
});

vi.mock("openai", () => ({
  default: class FakeOpenAI {
    chat = {
      completions: {
        create: (params: { stream?: boolean } | undefined, opts?: { signal?: AbortSignal }) => {
          llmMock.openaiCallCount += 1;
          if (params?.stream) {
            return llmMock.respondStream(opts?.signal);
          }
          return llmMock.respond(opts?.signal, () => ({
            choices: [{ message: { content: llmMock.responseText } }],
          }));
        },
      },
    };
  },
}));

// The module imports the Anthropic SDK at top level even though our test key
// selects the OpenAI path. Mock it too so no real client is ever constructed.
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
import {
  narrateGreekLesson,
  narrateTradeExplanation,
  narrateGreekLessonStream,
  narrateTradeExplanationStream,
} from "./coachLLM.js";
import { openSse } from "./sse.js";

// A token sink that records every chunk the streaming narration emits, so a test
// can distinguish the leader (which receives many live token chunks) from a
// single-flight follower or a cache hit (which receive the finished text in ONE
// chunk).
function makeSink() {
  const chunks: string[] = [];
  return { chunks, fn: (c: string) => chunks.push(c) };
}

beforeEach(() => {
  llmMock.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("single-flight: concurrent identical asks share ONE LLM call", () => {
  it("fires N concurrent identical narrations but calls the LLM once, and all callers get the answer", async () => {
    // A real (mocked) delay so all concurrent callers reach the in-flight check
    // before the first call resolves and populates the cache.
    llmMock.delayMs = 40;
    // teachGreek's symbol is part of the cache key — use a unique one so this
    // test never collides with the cache from another test in the file.
    const lesson = teachGreek("delta", "NVDA");

    const results = await Promise.all(
      Array.from({ length: 6 }, () => narrateGreekLesson(lesson)),
    );

    expect(llmMock.openaiCallCount).toBe(1);
    expect(results).toHaveLength(6);
    for (const r of results) {
      expect(r.source).toBe("llm");
      expect(r.text).toContain("MOCK LLM NARRATION");
      // Disclaimer invariant survives the shared single-flight result.
      expect(r.text).toContain(COACH_DISCLAIMER);
    }
    // Every caller received the identical shared text.
    const unique = new Set(results.map((r) => r.text));
    expect(unique.size).toBe(1);
  });
});

describe("cache: a warm cache key returns without an LLM call", () => {
  it("second identical ask is served from cache (no additional LLM call)", async () => {
    const lesson = teachGreek("theta", "QQQ");

    const first = await narrateGreekLesson(lesson);
    expect(llmMock.openaiCallCount).toBe(1);
    expect(first.source).toBe("llm");

    const second = await narrateGreekLesson(lesson);
    // No second LLM call — served from the shared cache.
    expect(llmMock.openaiCallCount).toBe(1);
    expect(second.source).toBe("llm");
    expect(second.text).toBe(first.text);
    expect(second.text).toContain(COACH_DISCLAIMER);
  });
});

describe("timeout: a hung LLM degrades to the deterministic template", () => {
  it("falls back to the template (with max loss / Greeks / disclaimer) instead of erroring", async () => {
    llmMock.mode = "hang"; // the SDK call never resolves on its own

    const explanation = explainSymbolStrategy("IWM", "iron_condor");
    // Should resolve to the template via the timeout/abort path, NOT throw.
    const result = await narrateTradeExplanation(explanation);

    expect(result.source).toBe("template");
    // The deterministic template carries the hard risk numbers + Greeks + the
    // disclaimer — the safety-critical fields the LLM is never the sole carrier of.
    expect(result.text).toContain("Max loss is capped");
    expect(result.text).toContain("Volatility & assignment:");
    expect(result.text).toContain(COACH_DISCLAIMER);
    // It must NOT contain the (hung) LLM's would-be output.
    expect(result.text).not.toContain("MOCK LLM NARRATION");
    // The LLM was attempted (and aborted), proving we exercised the timeout path.
    expect(llmMock.openaiCallCount).toBe(1);
  });
});

describe("SSE heartbeat: keeps the stream alive during the LLM wait", () => {
  function fakeRes() {
    const writes: string[] = [];
    const handlers: Record<string, () => void> = {};
    const res = {
      writes,
      handlers,
      status: vi.fn(() => res),
      setHeader: vi.fn(() => res),
      flushHeaders: vi.fn(),
      write: vi.fn((chunk: string) => {
        writes.push(chunk);
        return true;
      }),
      on: vi.fn((event: string, cb: () => void) => {
        handlers[event] = cb;
        return res;
      }),
      end: vi.fn(),
    };
    return res;
  }

  const heartbeats = (writes: string[]) => writes.filter((w) => w.includes("keep-alive")).length;

  it("emits periodic keep-alive comments until the channel is closed", () => {
    vi.useFakeTimers();
    const res = fakeRes();
    const channel = openSse(res as unknown as Response);

    // No heartbeat before the first interval elapses.
    expect(heartbeats(res.writes)).toBe(0);

    vi.advanceTimersByTime(15_000);
    expect(heartbeats(res.writes)).toBe(1);

    vi.advanceTimersByTime(15_000);
    expect(heartbeats(res.writes)).toBe(2);

    // After close() the interval is cleared — no further heartbeats.
    channel.close();
    expect(res.end).toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(heartbeats(res.writes)).toBe(2);
  });

  it("stops heartbeating if the client hangs up (close event)", () => {
    vi.useFakeTimers();
    const res = fakeRes();
    openSse(res as unknown as Response);

    vi.advanceTimersByTime(15_000);
    expect(heartbeats(res.writes)).toBe(1);

    // Simulate the client disconnecting.
    res.handlers.close?.();
    vi.advanceTimersByTime(60_000);
    expect(heartbeats(res.writes)).toBe(1);
  });
});

// ─── Streaming path (narrateStream) ──────────────────────────────────────────
// The live word-by-word SSE endpoints go through narrateStream(), which has its
// OWN copies of the slow-load guards (single-flight dedup, the shared cache, the
// per-call timeout fallback). These tests prove the streaming path keeps the
// same protections the non-streaming path above is verified to have.

describe("streaming single-flight: concurrent identical streams share ONE LLM stream", () => {
  it("opens only one underlying LLM stream; the leader streams tokens, followers get the final text in one chunk", async () => {
    // A real (mocked) delay so all concurrent callers reach the in-flight check
    // before the leader resolves and populates the cache.
    llmMock.delayMs = 40;
    // Unique greek/symbol so the cache key never collides with another test.
    const lesson = teachGreek("vega", "TSLA");

    const sinks = Array.from({ length: 6 }, () => makeSink());
    const results = await Promise.all(
      sinks.map((s) => narrateGreekLessonStream(lesson, s.fn)),
    );

    // Only ONE underlying LLM stream was opened despite 6 concurrent asks.
    expect(llmMock.openaiCallCount).toBe(1);
    expect(results).toHaveLength(6);
    for (const r of results) {
      expect(r.source).toBe("llm");
      expect(r.text).toContain("MOCK LLM NARRATION");
      // Disclaimer invariant survives the shared single-flight result.
      expect(r.text).toContain(COACH_DISCLAIMER);
    }
    // Every caller received the identical shared text.
    const unique = new Set(results.map((r) => r.text));
    expect(unique.size).toBe(1);

    // Exactly one sink (the leader) received multiple live token chunks; the
    // five followers each received the finished text in a SINGLE chunk.
    const leaders = sinks.filter((s) => s.chunks.length > 1);
    const followers = sinks.filter((s) => s.chunks.length === 1);
    expect(leaders).toHaveLength(1);
    expect(followers).toHaveLength(5);
    for (const f of followers) {
      // The single follower chunk is the complete, disclaimer-enforced text.
      expect(f.chunks[0]).toContain("MOCK LLM NARRATION");
      expect(f.chunks[0]).toContain(COACH_DISCLAIMER);
    }
  });
});

describe("streaming cache: a warm cache key streams the finished text in one chunk", () => {
  it("second identical stream is served from cache (no new LLM stream) in a single chunk", async () => {
    const lesson = teachGreek("gamma", "AAPL");

    const first = makeSink();
    const firstResult = await narrateGreekLessonStream(lesson, first.fn);
    expect(llmMock.openaiCallCount).toBe(1);
    expect(firstResult.source).toBe("llm");
    // The leader streamed token-by-token (more than one chunk).
    expect(first.chunks.length).toBeGreaterThan(1);

    const second = makeSink();
    const secondResult = await narrateGreekLessonStream(lesson, second.fn);
    // No new LLM stream — served from the shared cache.
    expect(llmMock.openaiCallCount).toBe(1);
    expect(secondResult.source).toBe("llm");
    expect(secondResult.text).toBe(firstResult.text);
    // The cached narration is emitted as ONE chunk (no re-streaming).
    expect(second.chunks).toHaveLength(1);
    expect(second.chunks[0]).toBe(firstResult.text);
    expect(second.chunks[0]).toContain(COACH_DISCLAIMER);
  });
});

describe("streaming timeout: a hung LLM stream degrades to the deterministic template", () => {
  it("falls back to the template (with max loss / Greeks / disclaimer) instead of erroring", async () => {
    llmMock.mode = "hang"; // create({stream:true}) never resolves on its own

    const explanation = explainSymbolStrategy("AMZN", "iron_condor");
    const sink = makeSink();
    // Should resolve to the template via the timeout/abort path, NOT throw.
    const result = await narrateTradeExplanationStream(explanation, sink.fn);

    expect(result.source).toBe("template");
    // The deterministic template carries the hard risk numbers + Greeks + the
    // disclaimer — the safety-critical fields the LLM is never the sole carrier of.
    expect(result.text).toContain("Max loss is capped");
    expect(result.text).toContain("Volatility & assignment:");
    expect(result.text).toContain(COACH_DISCLAIMER);
    // It must NOT contain the (hung) stream's would-be output.
    expect(result.text).not.toContain("MOCK LLM NARRATION");
    // Because no token was ever emitted, the template is sent as ONE chunk.
    expect(sink.chunks).toHaveLength(1);
    expect(sink.chunks[0]).toBe(result.text);
    // The LLM stream was attempted (and aborted), proving the timeout path ran.
    expect(llmMock.openaiCallCount).toBe(1);
  });
});

describe("streaming mid-stream error: finalizes whatever was already emitted (no double-render)", () => {
  it("a stream that errors after emitting tokens returns the partial as llm without re-emitting it", async () => {
    llmMock.mode = "stream_error"; // yields one chunk, then throws

    const lesson = teachGreek("vega", "GOOGL");
    const sink = makeSink();
    const result = await narrateGreekLessonStream(lesson, sink.fn);

    // The partial text that was already streamed is finalized as an LLM result.
    expect(result.source).toBe("llm");
    expect(result.text).toContain("PARTIAL OUTPUT");
    // The disclaimer is still enforced on the salvaged partial.
    expect(result.text).toContain(COACH_DISCLAIMER);
    // No double-render: the live token was emitted exactly once; the final text
    // is NOT pushed again as another chunk (the frontend already has it).
    expect(sink.chunks).toHaveLength(1);
    expect(sink.chunks[0]).toBe("PARTIAL OUTPUT");
    expect(llmMock.openaiCallCount).toBe(1);
  });
});

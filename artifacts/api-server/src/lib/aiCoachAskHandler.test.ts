// v1.5.0 Sprint 2 — AI Coach Architecture Consolidation, Framework (backend).
// Unit tests for createCoachAskHandlers() against a hand-rolled fake
// Express req/res (no real HTTP server, no real Postgres) — this factory
// has no I/O of its own beyond what its config callbacks perform, so a
// fake req/res proves the request/response wiring itself: validation,
// 404-on-null-context, the JSON contract, and the exact SSE
// meta -> delta... -> done -> error sequence every existing ask/stream
// route already implements.

import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { createCoachAskHandlers, type CoachAskHandlerConfig } from "./aiCoachAskHandler.js";

vi.mock("./coachLLM.js", () => ({
  llmAvailable: vi.fn(() => false),
}));

interface FakeBody {
  question: string;
  symbol?: string;
}

function fakeReq(body: unknown): Request {
  return {
    body,
    log: { error: vi.fn() },
  } as unknown as Request;
}

function fakeRes() {
  const chunks: string[] = [];
  const state: {
    statusCode?: number;
    jsonBody?: unknown;
    headers: Record<string, string>;
    ended: boolean;
  } = { headers: {}, ended: false };

  const res = {
    status: vi.fn((code: number) => {
      state.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      state.jsonBody = body;
      return res;
    }),
    setHeader: vi.fn((name: string, value: string) => {
      state.headers[name] = value;
    }),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      chunks.push(chunk);
      return true;
    }),
    end: vi.fn(() => {
      state.ended = true;
    }),
    on: vi.fn(),
  };

  return { res: res as unknown as Response, state, chunks };
}

function baseConfig(overrides: Partial<CoachAskHandlerConfig<FakeBody, { symbol: string }>> = {}) {
  const config: CoachAskHandlerConfig<FakeBody, { symbol: string }> = {
    bodySchema: {
      safeParse: (value: unknown) => {
        const v = value as Partial<FakeBody>;
        if (!v || typeof v.question !== "string" || !v.question.trim()) {
          return { success: false, error: { message: "question is required" } };
        }
        return { success: true, data: v as FakeBody };
      },
    },
    resolveUserId: vi.fn(async () => "user-1"),
    resolveContext: vi.fn(async (_userId: string, body: FakeBody) => {
      if (body.symbol === "UNKNOWN") return null;
      return { context: { symbol: body.symbol ?? "AAPL" }, fallback: "fallback text" };
    }),
    notFoundMessage: (body: FakeBody) => `Unknown symbol: ${body.symbol}`,
    narrate: vi.fn(async () => ({ text: "the answer", source: "llm" })),
    narrateStream: vi.fn(async (_q, _ctx, _fb, onDelta) => {
      onDelta("chunk-1 ");
      onDelta("chunk-2");
      return { text: "chunk-1 chunk-2", source: "llm" };
    }),
    responseSchema: { parse: (v: unknown) => v },
    streamErrorLogMessage: "test coach ask stream failed",
    ...overrides,
  };
  return config;
}

describe("createCoachAskHandlers — ask (JSON)", () => {
  it("400s on an invalid body without calling resolveContext or narrate", async () => {
    const config = baseConfig();
    const handlers = createCoachAskHandlers(config);
    const { res, state } = fakeRes();

    await handlers.ask(fakeReq({ question: "" }), res);

    expect(state.statusCode).toBe(400);
    expect(state.jsonBody).toEqual({ error: "question is required" });
    expect(config.resolveContext).not.toHaveBeenCalled();
    expect(config.narrate).not.toHaveBeenCalled();
  });

  it("404s with the configured message when resolveContext returns null", async () => {
    const config = baseConfig();
    const handlers = createCoachAskHandlers(config);
    const { res, state } = fakeRes();

    await handlers.ask(fakeReq({ question: "What is happening?", symbol: "UNKNOWN" }), res);

    expect(state.statusCode).toBe(404);
    expect(state.jsonBody).toEqual({ error: "Unknown symbol: UNKNOWN" });
    expect(config.narrate).not.toHaveBeenCalled();
  });

  it("resolves context, narrates, and returns the parsed response schema", async () => {
    const config = baseConfig();
    const handlers = createCoachAskHandlers(config);
    const { res, state } = fakeRes();

    await handlers.ask(fakeReq({ question: "Explain this", symbol: "AAPL" }), res);

    expect(config.resolveContext).toHaveBeenCalledWith("user-1", { question: "Explain this", symbol: "AAPL" });
    expect(config.narrate).toHaveBeenCalledWith("Explain this", { symbol: "AAPL" }, "fallback text");
    expect(state.jsonBody).toEqual({ answer: "the answer", answerSource: "llm" });
  });

  it("calls onBeforeAnswer/onAfterAnswer around narrate, in order, when supplied", async () => {
    const calls: string[] = [];
    const config = baseConfig({
      onBeforeAnswer: vi.fn(async (_userId, question) => {
        calls.push(`before:${question}`);
      }),
      onAfterAnswer: vi.fn(async (_userId, answer) => {
        calls.push(`after:${answer}`);
      }),
    });
    const handlers = createCoachAskHandlers(config);
    const { res } = fakeRes();

    await handlers.ask(fakeReq({ question: "Hi", symbol: "AAPL" }), res);

    expect(calls).toEqual(["before:Hi", "after:the answer"]);
  });

  it("never calls onBeforeAnswer/onAfterAnswer when not supplied — no crash", async () => {
    const config = baseConfig();
    const handlers = createCoachAskHandlers(config);
    const { res, state } = fakeRes();

    await handlers.ask(fakeReq({ question: "Hi", symbol: "AAPL" }), res);

    expect(state.jsonBody).toEqual({ answer: "the answer", answerSource: "llm" });
  });
});

describe("createCoachAskHandlers — askStream (SSE)", () => {
  function parseEvents(chunks: string[]): { event: string; data: unknown }[] {
    return chunks
      .filter((c) => c.startsWith("event:"))
      .map((c) => {
        const [, eventLine, dataLine] = c.match(/event: (.+)\ndata: (.+)\n\n/) ?? [];
        return { event: eventLine, data: dataLine ? JSON.parse(dataLine) : undefined };
      });
  }

  it("400s on an invalid body — never opens the SSE channel", async () => {
    const config = baseConfig();
    const handlers = createCoachAskHandlers(config);
    const { res, state } = fakeRes();

    await handlers.askStream(fakeReq({ question: "" }), res);

    expect(state.statusCode).toBe(400);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("404s on an unresolvable context — never opens the SSE channel", async () => {
    const config = baseConfig();
    const handlers = createCoachAskHandlers(config);
    const { res, state } = fakeRes();

    await handlers.askStream(fakeReq({ question: "Hi", symbol: "UNKNOWN" }), res);

    expect(state.statusCode).toBe(404);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("emits meta -> delta... -> done in order for a successful stream", async () => {
    const config = baseConfig();
    const handlers = createCoachAskHandlers(config);
    const { res, chunks } = fakeRes();

    await handlers.askStream(fakeReq({ question: "Hi", symbol: "AAPL" }), res);

    const events = parseEvents(chunks);
    expect(events.map((e) => e.event)).toEqual(["meta", "delta", "delta", "done"]);
    expect(events[0].data).toEqual({ source: "template", llmAvailable: false });
    expect(events[1].data).toEqual({ text: "chunk-1 " });
    expect(events[2].data).toEqual({ text: "chunk-2" });
    expect(events[3].data).toEqual({ answer: "chunk-1 chunk-2", answerSource: "llm" });
    expect(res.end).toHaveBeenCalled();
  });

  it("emits an honest error event, logs it, and still closes the channel when narrateStream throws", async () => {
    const config = baseConfig({
      narrateStream: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const handlers = createCoachAskHandlers(config);
    const { res, chunks } = fakeRes();
    const req = fakeReq({ question: "Hi", symbol: "AAPL" });

    await handlers.askStream(req, res);

    const events = parseEvents(chunks);
    expect(events.map((e) => e.event)).toEqual(["meta", "error"]);
    expect(events[1].data).toEqual({ error: "Failed to answer question" });
    expect(req.log.error).toHaveBeenCalledWith({ err: expect.any(Error) }, "test coach ask stream failed");
    expect(res.end).toHaveBeenCalled();
  });

  it("calls onBeforeAnswer/onAfterAnswer around the stream, in order, when supplied", async () => {
    const calls: string[] = [];
    const config = baseConfig({
      onBeforeAnswer: vi.fn(async (_userId, question) => {
        calls.push(`before:${question}`);
      }),
      onAfterAnswer: vi.fn(async (_userId, answer) => {
        calls.push(`after:${answer}`);
      }),
    });
    const handlers = createCoachAskHandlers(config);
    const { res } = fakeRes();

    await handlers.askStream(fakeReq({ question: "Hi", symbol: "AAPL" }), res);

    expect(calls).toEqual(["before:Hi", "after:chunk-1 chunk-2"]);
  });

  it("never calls onAfterAnswer when the stream throws before completion", async () => {
    const onAfterAnswer = vi.fn();
    const config = baseConfig({
      onAfterAnswer,
      narrateStream: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const handlers = createCoachAskHandlers(config);
    const { res } = fakeRes();

    await handlers.askStream(fakeReq({ question: "Hi", symbol: "AAPL" }), res);

    expect(onAfterAnswer).not.toHaveBeenCalled();
  });
});

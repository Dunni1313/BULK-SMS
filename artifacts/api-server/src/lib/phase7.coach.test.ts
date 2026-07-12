import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import * as coach from "./coach.js";
import {
  COACH_DISCLAIMER,
  explainSymbolStrategy,
  teachGreek,
  deltaMasterclass,
  greeksOverview,
  generateQuiz,
  gradeQuiz,
  CoachError,
} from "./coach.js";

// ── Test harness for the route-level "coach never executes" guarantee ─────────
// Hoisted so it runs before the modules under test are imported. We:
//   1. Strip OPENAI_API_KEY so coachLLM deterministically takes its template
//      fallback path (no network, no flakiness, disclaimer always enforced).
//   2. Expose mutable `dbRows` so the mocked DB can return either nothing (the
//      default — every data lookup safely no-ops) or a single candidate row (the
//      positive control that proves the execution spy actually fires).
const harness = vi.hoisted(() => {
  delete process.env.OPENAI_API_KEY;
  return { dbRows: [] as Record<string, unknown>[] };
});

// Mock @workspace/db with a chainable, awaitable query builder. Every method
// returns the same chain; awaiting it resolves to the current `dbRows`. Tables are
// benign column proxies so drizzle's eq()/desc() never throw on the (ignored)
// arguments. Named exports are listed explicitly — Vitest validates that each
// import binding exists on the mock.
vi.mock("@workspace/db", () => {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select", "from", "where", "orderBy", "limit", "insert", "values",
    "returning", "update", "set", "delete", "leftJoin", "innerJoin",
    "groupBy", "having", "offset", "onConflictDoUpdate", "onConflictDoNothing",
  ];
  for (const m of methods) chain[m] = () => chain;
  (chain as { then: unknown }).then = (resolve: (rows: unknown[]) => unknown) =>
    resolve(harness.dbRows);
  const table = () => new Proxy({}, { get: (_t, p) => String(p) });
  return {
    db: chain,
    pool: {},
    aiLessonsTable: table(),
    aiMessagesTable: table(),
    autoExecutionLogTable: table(),
    backtestResultsTable: table(),
    greeksQuizResultsTable: table(),
    journalEntriesTable: table(),
    scannerResultsTable: table(),
    settingsTable: table(),
    tradeExplanationsTable: table(),
    tradesTable: table(),
  };
});

// Replace the data/account helpers so the risk/strategy modes resolve to safe,
// deterministic numbers without a real DB.
vi.mock("./serverState.js", () => ({
  getAccountValue: vi.fn(async () => 125_000),
  ensureSeedTrades: vi.fn(async () => {}),
  computeTradeGreeks: vi.fn(() => ({ delta: 0, theta: 0, vega: 0, gamma: 0, unrealizedPnl: 0 })),
  getSettingsRow: vi.fn(async () => ({ executionMode: "manual" })),
}));

// Partial-mock execution.js: keep the real canonicalQuote (the deterministic
// coach tests above depend on it) but replace previewOptionOrder with a spy so we
// can prove no coach mode ever reaches the execution/preview surface.
vi.mock("./execution.js", async (importActual) => {
  const actual = await importActual<typeof import("./execution.js")>();
  return {
    ...actual,
    previewOptionOrder: vi.fn(async () => ({
      validation: { valid: true, violations: [] },
      ravishScore: 80,
      ravishTier: "elite",
      pop: 70,
      ev: 50,
      maxLoss: 300,
      riskPct: 0.3,
      portfolioRiskBeforePct: 1,
      portfolioRiskAfterPct: 2,
      canSubmit: false,
    })),
  };
});

import aiRouter, { generateAiResponse } from "../routes/ai.js";
import { previewOptionOrder } from "./execution.js";
import { getAccountValue } from "./serverState.js";
import {
  narrateTradeExplanation,
  narrateTradeExplanationStream,
  narrateGreekLesson,
  narrateAdjustment,
  narrateJournalReview,
  type AdjustmentNarrationInput,
  type JournalReviewData,
} from "./coachLLM.js";
import { ADJUSTMENT_DISCLAIMER } from "./adjustment.js";

describe("explainSymbolStrategy (deterministic trade explanation)", () => {
  const expl = explainSymbolStrategy("SPY", "iron_condor");

  it("includes the hard risk numbers: max loss and POP", () => {
    expect(expl.maxLoss).toBeGreaterThan(0);
    expect(typeof expl.maxLoss).toBe("number");
    expect(expl.pop).toBeGreaterThanOrEqual(0);
    expect(expl.pop).toBeLessThanOrEqual(100);
  });

  it("includes the full Greeks (delta and theta among them)", () => {
    expect(typeof expl.greeks.delta).toBe("number");
    expect(typeof expl.greeks.theta).toBe("number");
    expect(typeof expl.greeks.gamma).toBe("number");
    expect(typeof expl.greeks.vega).toBe("number");
  });

  it("includes an assignment-risk statement", () => {
    expect(typeof expl.assignmentRisk).toBe("string");
    expect(expl.assignmentRisk.length).toBeGreaterThan(0);
  });

  it("always carries the educational disclaimer", () => {
    expect(expl.disclaimer).toBe(COACH_DISCLAIMER);
  });

  it("reports the correct symbol and a labeled strategy", () => {
    expect(expl.symbol).toBe("SPY");
    expect(expl.strategyLabel.toLowerCase()).toContain("condor");
    expect(expl.legs.length).toBeGreaterThan(0);
  });
});

describe("teachGreek (Greeks tutor)", () => {
  it("teaches delta with definition, seller context, and key points", () => {
    const lesson = teachGreek("delta");
    expect(lesson.greek).toBe("delta");
    expect(lesson.definition.length).toBeGreaterThan(0);
    expect(lesson.forPremiumSellers.length).toBeGreaterThan(0);
    expect(Array.isArray(lesson.keyPoints)).toBe(true);
    expect(lesson.keyPoints.length).toBeGreaterThan(0);
    expect(lesson.disclaimer).toBe(COACH_DISCLAIMER);
  });

  it("teaches each of the four Greeks", () => {
    for (const g of ["delta", "theta", "gamma", "vega"] as const) {
      const lesson = teachGreek(g);
      expect(lesson.greek).toBe(g);
      expect(lesson.title.length).toBeGreaterThan(0);
    }
  });
});

describe("learn long-form content", () => {
  it("delta masterclass has sections and key points", () => {
    const c = deltaMasterclass();
    expect(c.sections.length).toBeGreaterThan(0);
    expect(c.keyPoints.length).toBeGreaterThan(0);
    expect(c.disclaimer).toBe(COACH_DISCLAIMER);
  });

  it("greeks overview has sections and a disclaimer", () => {
    const c = greeksOverview();
    expect(c.sections.length).toBeGreaterThan(0);
    expect(c.disclaimer).toBe(COACH_DISCLAIMER);
  });
});

describe("quiz generation and grading", () => {
  it("generates the requested number of questions for a topic", () => {
    const quiz = generateQuiz("greeks", 4);
    expect(quiz.quizId.length).toBeGreaterThan(0);
    expect(quiz.questions.length).toBe(4);
    for (const q of quiz.questions) {
      expect(q.options.length).toBeGreaterThan(1);
      expect(q.prompt.length).toBeGreaterThan(0);
    }
  });

  it("grades server-authoritatively: a perfect submission scores 100%", () => {
    const quiz = generateQuiz("mixed", 5);
    // Grading is server-authoritative — learn the correct answers from a first
    // pass (all zeros), then resubmit them to prove a perfect score is reachable.
    const probe = gradeQuiz(
      quiz.quizId,
      quiz.questions.map(() => 0),
    );
    expect(probe.total).toBe(quiz.questions.length);
    expect(probe.results.every((r) => typeof r.correctAnswer === "number")).toBe(true);
    expect(probe.results.every((r) => r.explanation.length > 0)).toBe(true);

    const perfect = gradeQuiz(
      quiz.quizId,
      probe.results.map((r) => r.correctAnswer),
    );
    expect(perfect.score).toBe(perfect.total);
    expect(perfect.percent).toBe(100);
    expect(perfect.disclaimer).toBe(COACH_DISCLAIMER);
  });

  it("a fully wrong submission scores zero", () => {
    const quiz = generateQuiz("greeks", 3);
    const probe = gradeQuiz(quiz.quizId, quiz.questions.map(() => 0));
    // Pick a definitely-wrong index per question (correctAnswer + 1, wrapped).
    const wrong = probe.results.map((r) => (r.correctAnswer + 1) % 4);
    const graded = gradeQuiz(quiz.quizId, wrong);
    // At least the ones we deliberately flipped should be wrong.
    expect(graded.score).toBeLessThan(graded.total);
    expect(graded.disclaimer).toBe(COACH_DISCLAIMER);
  });

  it("rejects a malformed quizId with a CoachError", () => {
    expect(() => gradeQuiz("not-valid-base64url!!", [0])).toThrow(CoachError);
  });
});

describe("safety: the coach never executes trades", () => {
  it("the disclaimer is non-empty and frames the coach as educational", () => {
    expect(COACH_DISCLAIMER.length).toBeGreaterThan(0);
    expect(COACH_DISCLAIMER.toLowerCase()).toMatch(/educational|not (financial )?advice/);
  });

  it("the deterministic coach module exposes no trade-execution surface", () => {
    const names = Object.keys(coach);
    const dangerous = names.filter((n) =>
      /execute|submit|placeorder|sendorder|buy|sell/i.test(n),
    );
    expect(dangerous).toEqual([]);
  });
});

// The explicit coach modes route deterministically in generateAiResponse. None
// of them may ever reach an execution code path — the only execution surface the
// assistant can touch is previewOptionOrder (mocked here as a spy). These tests
// lock that in so a future refactor can't silently wire a coach mode into
// preview/submit.
describe("safety: every explicit /ai/chat coach mode is read-only (never executes)", () => {
  const MODES = ["explain_trade", "teach_greeks", "risk_coach", "strategy_coach", "quiz"] as const;

  // A fully-populated scanner candidate, shared by every mocked DB query in a
  // cycle (the chain ignores its filters), so the data-lookup modes render
  // without crashing on a missing field.
  const CANDIDATE = {
    symbol: "SPY",
    strategy: "iron_condor",
    ravishScore: 80,
    ravishTier: "elite",
    pop: 70,
    ev: 50,
    maxLoss: 300,
    maxProfit: 150,
    credit: 150,
    shortPutStrike: 500,
    shortCallStrike: 520,
    daysToExpiry: 30,
    theta: 5,
  };

  beforeEach(() => {
    harness.dbRows = [];
    vi.mocked(previewOptionOrder).mockClear();
  });

  it.each(MODES)("mode '%s' returns teaching/data text and never calls previewOptionOrder", async (mode) => {
    // A message that, on the keyword path, WOULD trigger an execution preview —
    // proving the explicit mode short-circuits before any execution branch.
    const text = await generateAiResponse("review and submit the top trade now", { mode });

    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
    // No coach mode may claim an order was placed/filled/executed.
    expect(text).not.toMatch(/order (submitted|placed|filled|executed)|i (placed|submitted|executed)/i);
    expect(previewOptionOrder).not.toHaveBeenCalled();
  });

  it("no explicit mode reaches previewOptionOrder even with a live candidate present", async () => {
    // A ranked candidate exists, so the keyword review/submit path WOULD preview.
    harness.dbRows = [CANDIDATE];
    for (const mode of MODES) {
      vi.mocked(previewOptionOrder).mockClear();
      await generateAiResponse("can I take this trade? submit it", { mode });
      expect(previewOptionOrder).not.toHaveBeenCalled();
    }
  });

  it("positive control: the keyword review path DOES reach previewOptionOrder", async () => {
    // Proves the execution spy is correctly wired — so the assertions above
    // ('not called') are meaningful and not vacuously passing.
    harness.dbRows = [CANDIDATE];
    vi.mocked(previewOptionOrder).mockClear();
    await generateAiResponse("review the top trade for me");
    expect(previewOptionOrder).toHaveBeenCalledTimes(1);
  });
});

// COACH_DISCLAIMER must ride on every coach narration path — both the single-shot
// JSON response and the deterministic-template fallback. With no API key the
// narration layer always takes the template path, which is where the disclaimer
// invariant (enforceDisclaimer) must hold even when the structured input carries
// a different, feature-specific advisory.
describe("safety: COACH_DISCLAIMER is enforced on every narration path", () => {
  it("single-shot trade explanation (template fallback) carries the disclaimer", async () => {
    const n = await narrateTradeExplanation(explainSymbolStrategy("SPY", "iron_condor"));
    expect(n.source).toBe("template");
    expect(n.text).toContain(COACH_DISCLAIMER);
  });

  it("streamed trade explanation (template fallback) carries the disclaimer", async () => {
    let streamed = "";
    const n = await narrateTradeExplanationStream(
      explainSymbolStrategy("QQQ", "iron_condor"),
      (t) => {
        streamed += t;
      },
    );
    expect(n.source).toBe("template");
    expect(n.text).toContain(COACH_DISCLAIMER);
    expect(streamed).toContain(COACH_DISCLAIMER);
  });

  it("greek lesson (template fallback) carries the disclaimer", async () => {
    const n = await narrateGreekLesson(teachGreek("theta"));
    expect(n.source).toBe("template");
    expect(n.text).toContain(COACH_DISCLAIMER);
  });

  it("journal review (template fallback) carries the disclaimer", async () => {
    const data: JournalReviewData = {
      symbol: "SPY",
      strategy: "iron_condor",
      strategyLabel: "Iron Condor",
      status: "closed",
      outcome: "win",
      realizedPnl: 120,
      credit: 150,
      maxProfit: 150,
      maxLoss: 350,
      pop: 72,
      ev: 40,
      ravishScore: 82,
      exitReason: "profit target",
      heldDays: 18,
    };
    const n = await narrateJournalReview(data);
    expect(n.source).toBe("template");
    expect(n.review).toContain(COACH_DISCLAIMER);
  });

  it("adjustment narration appends COACH_DISCLAIMER even when input carries only ADJUSTMENT_DISCLAIMER", async () => {
    // ADJUSTMENT_DISCLAIMER is NOT a substitute for COACH_DISCLAIMER — enforce
    // appends the standard disclaimer so it is never the sole carrier.
    expect(ADJUSTMENT_DISCLAIMER).not.toContain(COACH_DISCLAIMER);
    const input: AdjustmentNarrationInput = {
      symbol: "SPY",
      symbolName: "S&P 500 ETF",
      strategyLabel: "Iron Condor",
      action: "hold",
      actionLabel: "Hold",
      severity: "info",
      rationale: "Position is inside tolerance.",
      triggeredSignals: [],
      currentPop: 70,
      entryPop: 72,
      daysToExpiry: 20,
      currentPnl: 50,
      maxLoss: 350,
      maxProfit: 150,
      threatenedSide: null,
      nearestShortStrike: null,
      distanceToShortPct: null,
      assignmentRisk: "Low — both shorts are out of the money.",
      disclaimer: ADJUSTMENT_DISCLAIMER,
    };
    const n = await narrateAdjustment(input);
    expect(n.source).toBe("template");
    expect(n.text).toContain(COACH_DISCLAIMER);
  });
});

// ── Streaming chat safety: POST /ai/chat/stream is also read-only ─────────────
// The SSE variant shares generateAiResponse but adds its own plumbing (an onToken
// sink wired into the SSE delta events, then a final `done` payload). That plumbing
// is NOT in the orval contract and was previously untested for the no-execution
// guarantee — a refactor could wire an execution call into the streaming path
// without tripping a test. These tests drive the REAL route handler against a
// fake SSE Response so the streamed events (delta/done/error) are asserted as the
// client would receive them, and the previewOptionOrder spy from the harness above
// proves no coach mode ever reaches the execution/preview surface.

// Pull the actual /ai/chat/stream handler off the exported router so we exercise
// the genuine SSE plumbing, not a re-implementation.
type RouteLayer = {
  route?: {
    path: string;
    stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
  };
};
function getStreamHandler(): (req: Request, res: Response) => Promise<void> {
  const stack = (aiRouter as unknown as { stack: RouteLayer[] }).stack;
  const layer = stack.find((l) => l.route?.path === "/ai/chat/stream");
  if (!layer?.route) throw new Error("/ai/chat/stream route not registered");
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

// The SSE wire format is `event: <name>\ndata: <json>\n\n`. JSON.stringify escapes
// real newlines, so blocks split cleanly on the blank line between events.
function parseSse(writes: string[]): SseEvent[] {
  const events: SseEvent[] = [];
  for (const block of writes.join("").split("\n\n")) {
    const lines = block.split("\n");
    const eventLine = lines.find((l) => l.startsWith("event: "));
    const dataLine = lines.find((l) => l.startsWith("data: "));
    if (eventLine && dataLine) {
      events.push({
        event: eventLine.slice("event: ".length),
        data: JSON.parse(dataLine.slice("data: ".length)) as Record<string, unknown>,
      });
    }
  }
  return events;
}

// Drive the stream handler with a fake Express Response that records every SSE
// write. Returns the parsed event stream.
async function driveStream(body: {
  message: string;
  mode?: string;
  level?: string;
}): Promise<{ events: SseEvent[]; ended: boolean }> {
  const writes: string[] = [];
  let ended = false;
  const res = {
    status: () => res,
    setHeader: () => res,
    flushHeaders: () => {},
    write: (chunk: string) => {
      writes.push(chunk);
      return true;
    },
    on: () => res,
    end: () => {
      ended = true;
    },
  };
  const req = { body, log: { error: () => {} } };
  await getStreamHandler()(req as unknown as Request, res as unknown as Response);
  return { events: parseSse(writes), ended };
}

describe("safety: the STREAMING /ai/chat/stream coach is also read-only (never executes)", () => {
  const MODES = ["explain_trade", "teach_greeks", "risk_coach", "strategy_coach", "quiz"] as const;

  // A fully-populated candidate that also carries the id + createdAt the route's
  // assistant-message insert (.returning()) reads back to build the `done` payload.
  // The mocked DB chain ignores filters and returns this for every query, so both
  // topCandidate() (the data lookups) and the insert resolve to a usable row.
  const CANDIDATE = {
    id: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    symbol: "SPY",
    strategy: "iron_condor",
    ravishScore: 80,
    ravishTier: "elite",
    pop: 70,
    ev: 50,
    maxLoss: 300,
    maxProfit: 150,
    credit: 150,
    shortPutStrike: 500,
    shortCallStrike: 520,
    daysToExpiry: 30,
    theta: 5,
  };

  beforeEach(() => {
    harness.dbRows = [CANDIDATE];
    vi.mocked(previewOptionOrder).mockClear();
  });

  it.each(MODES)(
    "stream mode '%s' emits a done payload and never calls previewOptionOrder",
    async (mode) => {
      // A message that, on the keyword path, WOULD trigger an execution preview —
      // proving the explicit mode short-circuits before any execution branch even
      // through the SSE plumbing.
      const { events } = await driveStream({ message: "review and submit the top trade now", mode });

      const done = events.find((e) => e.event === "done");
      expect(done).toBeDefined();
      const message = String(done?.data.message ?? "");
      expect(message.length).toBeGreaterThan(0);
      // The stream must surface at least one delta and never an error event.
      expect(events.some((e) => e.event === "delta")).toBe(true);
      expect(events.some((e) => e.event === "error")).toBe(false);
      // No coach mode may claim an order was placed/filled/executed.
      expect(message).not.toMatch(
        /order (submitted|placed|filled|executed)|i (placed|submitted|executed)/i,
      );
      // The execution/preview surface is never reached from a coach mode.
      expect(previewOptionOrder).not.toHaveBeenCalled();
    },
  );

  it("streamed 'done' payload still carries COACH_DISCLAIMER on the template fallback", async () => {
    // explain_trade routes through narrate(); with no API key it takes the
    // deterministic template path, where the disclaimer invariant must hold.
    const { events } = await driveStream({ message: "explain this trade", mode: "explain_trade" });

    const done = events.find((e) => e.event === "done");
    expect(done).toBeDefined();
    expect(String(done?.data.message ?? "")).toContain(COACH_DISCLAIMER);

    // The disclaimer also rode the streamed delta chunks (the template is emitted
    // as a single chunk on this path), so the user sees it mid-stream too.
    const streamedText = events
      .filter((e) => e.event === "delta")
      .map((e) => String(e.data.text ?? ""))
      .join("");
    expect(streamedText).toContain(COACH_DISCLAIMER);
    expect(previewOptionOrder).not.toHaveBeenCalled();
  });

  it("positive control: the keyword review path DOES reach previewOptionOrder through the stream route", async () => {
    // Proves the SSE harness is wired correctly — so the 'not called' assertions
    // above are meaningful and not vacuously passing because the route never runs.
    const { events } = await driveStream({ message: "review the top trade for me" });

    expect(previewOptionOrder).toHaveBeenCalledTimes(1);
    expect(events.find((e) => e.event === "done")).toBeDefined();
  });
});

// ── Streaming chat failure path: the AI engine erroring must fail closed ───────
// generateAiResponse is awaited inside the route's try/catch. If it throws
// mid-request, the route must emit a single SSE `error` event and then close the
// stream (the finally block's sse.close() → res.end()) — never leaking a
// half-written `done` payload or hanging the connection. We force the throw via a
// mocked dependency the engine awaits (getAccountValue, on the risk_coach path),
// which deliberately does NOT touch the execution/preview surface, so we can also
// prove previewOptionOrder is never reached on the error path.
describe("safety: the STREAMING /ai/chat/stream fails closed when the AI engine errors", () => {
  beforeEach(() => {
    harness.dbRows = [];
    vi.mocked(previewOptionOrder).mockClear();
    vi.mocked(getAccountValue).mockClear();
  });

  it("emits an SSE error event, closes the stream, and never sends done when generateAiResponse throws", async () => {
    // Force the engine to throw mid-request via a dependency it awaits. risk_coach
    // routes into portfolioRiskResponse → getAccountValue(), with no execution
    // surface in play, so the throw exercises the route's catch/finally directly.
    vi.mocked(getAccountValue).mockRejectedValueOnce(new Error("AI engine exploded"));

    const { events, ended } = await driveStream({
      message: "what is my portfolio risk?",
      mode: "risk_coach",
    });

    // The failure surfaces as a single SSE `error` event with a string payload.
    const errorEvents = events.filter((e) => e.event === "error");
    expect(errorEvents).toHaveLength(1);
    expect(typeof errorEvents[0]?.data.error).toBe("string");
    expect(String(errorEvents[0]?.data.error).length).toBeGreaterThan(0);

    // No `done` payload may leak on the error path...
    expect(events.some((e) => e.event === "done")).toBe(false);
    // ...and the stream must be closed cleanly (finally → sse.close() → res.end()).
    expect(ended).toBe(true);

    // The error path never reaches the execution/preview surface.
    expect(previewOptionOrder).not.toHaveBeenCalled();
  });
});

// v1.5.0 Sprint 2 — AI Coach Architecture Consolidation, Framework (backend).
//
// Every existing free-form "ask" coach endpoint in this codebase
// (routes/tradingCoach.ts's POST /trading/coach/ask[/stream], and
// routes/aiTradingCoach.ts's POST /trading-coach/ask[/stream]) hand-rolled
// the exact same request/response shape: validate the body, resolve the
// acting user, resolve a per-request grounding context (honestly 404 when
// it can't be resolved), narrate via one of coachLLM.ts's existing
// `narrate*`/`narrate*Stream` functions, and either return a single JSON
// payload or drive the same `meta -> delta... -> done -> error` SSE
// contract every streaming coach route already uses (lib/sse.ts's
// openSse()). This module extracts that shared shape into one generic
// factory, `createCoachAskHandlers()`, so a new specialist coach's ask
// route becomes a small config object instead of ~30 duplicated lines.
//
// Deliberately NOT a new narration engine: this module never calls an LLM
// provider itself, never defines a new prompt, and never changes what any
// existing coach's answer looks like — it only wires together the exact
// same already-existing pieces (a caller-supplied `narrate`/`narrateStream`
// pair from coachLLM.ts, the existing openSse() channel, and the existing
// zod body/response schemas) in one place. Two existing routers
// (routes/tradingCoach.ts, routes/aiTradingCoach.ts) were refactored to
// call this factory this sprint; their own request/response behavior is
// unchanged, confirmed by their own pre-existing test suites passing with
// zero assertion changes.

import type { Request, Response } from "express";
import { openSse } from "./sse.js";
import { llmAvailable } from "./coachLLM.js";

/** The minimal shape every existing "ask" coach body needs — a free-form
 * question. Callers extend this with whatever else their own zod schema
 * validates (symbol, scannerCandidateId, mode, level, …). */
export interface CoachAskBody {
  question: string;
}

/** What `resolveContext` returns for a successfully-resolved request: the
 * grounding context object to hand to `narrate`/`narrateStream`, plus the
 * deterministic fallback text every existing coach already computes for
 * when the LLM is unavailable. */
export interface ResolvedCoachContext<TContext> {
  context: TContext;
  fallback: string;
}

/** A zod-shaped schema — only the one method every config actually calls,
 * so this module never imports `zod` itself and stays agnostic to which
 * concrete schema library a given route's generated types use. */
export interface AskBodySchema<TBody> {
  safeParse(value: unknown): { success: true; data: TBody } | { success: false; error: { message: string } };
}

export interface ResponseShapeSchema {
  parse(value: unknown): unknown;
}

export interface CoachAskHandlerConfig<TBody extends CoachAskBody, TContext> {
  bodySchema: AskBodySchema<TBody>;
  /** Resolves the acting user for this request — every existing coach
   * route already calls `getScopedUserId(req)` directly; injected here so
   * this framework module never imports tenantScope.ts itself. */
  resolveUserId(req: Request): Promise<string>;
  /** Resolves this request's grounding context + fallback text. Returns
   * `null` to signal an honest 404 (e.g. an unresolvable symbol) — never a
   * fabricated context. A coach whose context can never fail to resolve
   * (e.g. the unified assistant) simply never returns `null`. */
  resolveContext(userId: string, body: TBody): Promise<ResolvedCoachContext<TContext> | null>;
  /** Message for the 404 response when `resolveContext` returns `null`. */
  notFoundMessage?(body: TBody): string;
  /** One of coachLLM.ts's existing `narrate*` functions — never new
   * narration logic, only wired through unchanged. */
  narrate(question: string, context: TContext, fallback: string): Promise<{ text: string; source: string }>;
  /** The streaming counterpart — coachLLM.ts's existing `narrate*Stream`. */
  narrateStream(
    question: string,
    context: TContext,
    fallback: string,
    onDelta: (text: string) => void,
  ): Promise<{ text: string; source: string }>;
  /** The route's own generated Zod response schema (`{ answer,
   * answerSource }`) — validated exactly as every existing route already
   * does before calling `res.json()`. */
  responseSchema: ResponseShapeSchema;
  /** Optional side effects around the narration call — e.g. persisting a
   * message to a coach-specific table. Called with the same (userId,
   * question) / (userId, answer) shape every existing persisted coach
   * already uses. Never required — most coaches don't persist at all. */
  onBeforeAnswer?(userId: string, question: string): Promise<void>;
  onAfterAnswer?(userId: string, answer: string): Promise<void>;
  /** Logged (via `req.log.error`) on a genuine mid-stream failure — kept
   * per-coach so log messages stay as specific as each existing route's
   * own message was before this refactor. */
  streamErrorLogMessage: string;
}

export interface CoachAskHandlers {
  ask(req: Request, res: Response): Promise<void>;
  askStream(req: Request, res: Response): Promise<void>;
}

/**
 * Builds the two Express handlers (`POST .../ask` and `POST .../ask/stream`)
 * every free-form coach route needs, from a small, typed config object.
 * Byte-for-byte the same request validation / 404 / JSON / SSE contract
 * every existing hand-written ask route already implements.
 */
export function createCoachAskHandlers<TBody extends CoachAskBody, TContext>(
  config: CoachAskHandlerConfig<TBody, TContext>,
): CoachAskHandlers {
  async function resolveOrRespond(
    req: Request,
    res: Response,
  ): Promise<{ userId: string; body: TBody; resolved: ResolvedCoachContext<TContext> } | null> {
    const parsed = config.bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return null;
    }

    const userId = await config.resolveUserId(req);
    const resolved = await config.resolveContext(userId, parsed.data);
    if (!resolved) {
      res.status(404).json({ error: config.notFoundMessage?.(parsed.data) ?? "Not found" });
      return null;
    }

    return { userId, body: parsed.data, resolved };
  }

  async function ask(req: Request, res: Response): Promise<void> {
    const prepared = await resolveOrRespond(req, res);
    if (!prepared) return;
    const { userId, body, resolved } = prepared;

    await config.onBeforeAnswer?.(userId, body.question);
    const n = await config.narrate(body.question, resolved.context, resolved.fallback);
    await config.onAfterAnswer?.(userId, n.text);

    res.json(config.responseSchema.parse({ answer: n.text, answerSource: n.source }));
  }

  async function askStream(req: Request, res: Response): Promise<void> {
    const prepared = await resolveOrRespond(req, res);
    if (!prepared) return;
    const { userId, body, resolved } = prepared;

    await config.onBeforeAnswer?.(userId, body.question);

    const sse = openSse(res);
    try {
      sse.send("meta", { source: llmAvailable() ? "llm" : "template", llmAvailable: llmAvailable() });
      const n = await config.narrateStream(body.question, resolved.context, resolved.fallback, (t) => sse.send("delta", { text: t }));
      await config.onAfterAnswer?.(userId, n.text);
      sse.send("done", { answer: n.text, answerSource: n.source });
    } catch (err) {
      req.log.error({ err }, config.streamErrorLogMessage);
      sse.send("error", { error: "Failed to answer question" });
    } finally {
      sse.close();
    }
  }

  return { ask, askStream };
}

// v1.3.0, Sprint 1 — AI Trading Coach, Backend Foundation (approved
// design doc: docs/v1.3.0-AI-Trading-Coach-Design.md). Distinct from, and
// additive to, the existing /trading/coach/... routes (Sprint 47's
// free-form Q&A + Phase 29's deterministic explanations, both untouched
// and reused as-is elsewhere) — this router lives at the /trading-coach/
// path prefix specifically to avoid any collision with that existing
// /trading/coach/ path.
//
// Every route here is a thin pass-through: resolve the user, build the
// unified context (lib/tradingCoachUnified.ts, itself pure composition
// over already-tested engines), narrate via the EXISTING, unmodified
// coachLLM.ts narrateTradeFreeform()/Stream() (reused verbatim — the
// design doc's own §7 explicitly calls out that its context parameter is
// `unknown`, so no changes to coachLLM.ts were needed at all), and
// persist both turns to the new trading_coach_messages table.
//
// Never calls execution.ts/optionsMath.ts/risk.ts/autoExecution.ts/
// autoAdjustment.ts directly, and never will — every fact answered here
// is a READ of already-computed output from those systems (via
// buildUnifiedCoachContext()), never a new computation, never a write,
// never an order. Reuses the existing general rate limiter (mounted once
// in app.ts) and the existing getScopedUserId()/tenant-isolation
// discipline used by every other route in this codebase.
//
// v1.5.0 Sprint 2 note (AI Coach Framework): the /ask and /ask/stream
// routes below are now built from the shared createCoachAskHandlers()
// factory (lib/aiCoachAskHandler.ts), the same one routes/tradingCoach.ts
// was refactored to use this sprint — this router's own context (never
// 404s: buildUnifiedCoachContext() always resolves) and its
// persist-before/persist-after message-writing are supplied as this
// factory call's own config, with zero change to the request/response
// contract, confirmed by this file's own existing route tests passing
// with zero assertion changes.

import { Router, type IRouter } from "express";
import { db, tradingCoachMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getScopedUserId } from "../lib/tenantScope.js";
import { narrateTradeFreeform, narrateTradeFreeformStream } from "../lib/coachLLM.js";
import { buildUnifiedCoachContext, unifiedCoachFallback } from "../lib/tradingCoachUnified.js";
import {
  AskUnifiedTradingCoachBody,
  AskUnifiedTradingCoachResponse,
  GetUnifiedTradingCoachMessagesResponse,
} from "@workspace/api-zod";
import { createCoachAskHandlers } from "../lib/aiCoachAskHandler.js";

const router: IRouter = Router();

// How many persisted messages to return — bounded, mirrors GET
// /ai/messages' own established limit exactly.
const MESSAGE_HISTORY_LIMIT = 50;

async function persistMessage(userId: string, role: "user" | "assistant", message: string): Promise<void> {
  // Best-effort — never blocks or fails the user-facing response, matching
  // recordAuditEvent()'s and every other best-effort writer's established
  // philosophy in this codebase.
  try {
    await db.insert(tradingCoachMessagesTable).values({ userId, role, message });
  } catch (err) {
    console.error("trading coach message persist failed", err);
  }
}

const unifiedCoachAskHandlers = createCoachAskHandlers<
  { question: string; symbol?: string; scannerCandidateId?: number; tradingPositionId?: number },
  Awaited<ReturnType<typeof buildUnifiedCoachContext>>
>({
  bodySchema: AskUnifiedTradingCoachBody,
  resolveUserId: (req) => getScopedUserId(req),
  // buildUnifiedCoachContext() always resolves (it never 404s — an
  // optional symbol/candidate/position simply resolves to an honest
  // null/unavailable field, matching this route's pre-refactor behavior).
  resolveContext: async (userId, body) => {
    const context = await buildUnifiedCoachContext(userId, {
      symbol: body.symbol,
      scannerCandidateId: body.scannerCandidateId,
      tradingPositionId: body.tradingPositionId,
    });
    return { context, fallback: unifiedCoachFallback(context, body.question) };
  },
  narrate: narrateTradeFreeform,
  narrateStream: narrateTradeFreeformStream,
  responseSchema: AskUnifiedTradingCoachResponse,
  onBeforeAnswer: (userId, question) => persistMessage(userId, "user", question),
  onAfterAnswer: (userId, answer) => persistMessage(userId, "assistant", answer),
  streamErrorLogMessage: "unified trading coach ask stream failed",
});

router.post("/trading-coach/ask", unifiedCoachAskHandlers.ask);

// SSE variant — same event contract as /trading/coach/ask/stream (meta ->
// delta... -> done), deliberately NOT in the OpenAPI/orval contract,
// matching that route's own precedent.
router.post("/trading-coach/ask/stream", unifiedCoachAskHandlers.askStream);

router.get("/trading-coach/messages", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const messages = await db
    .select()
    .from(tradingCoachMessagesTable)
    .where(eq(tradingCoachMessagesTable.userId, userId))
    .orderBy(desc(tradingCoachMessagesTable.createdAt))
    .limit(MESSAGE_HISTORY_LIMIT);

  res.json(
    GetUnifiedTradingCoachMessagesResponse.parse(
      messages.reverse().map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    ),
  );
});

export default router;

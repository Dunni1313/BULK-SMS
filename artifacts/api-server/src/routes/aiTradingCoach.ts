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

import { Router, type IRouter } from "express";
import { db, tradingCoachMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getScopedUserId } from "../lib/tenantScope.js";
import { narrateTradeFreeform, narrateTradeFreeformStream, llmAvailable } from "../lib/coachLLM.js";
import { openSse } from "../lib/sse.js";
import { buildUnifiedCoachContext, unifiedCoachFallback } from "../lib/tradingCoachUnified.js";
import {
  AskUnifiedTradingCoachBody,
  AskUnifiedTradingCoachResponse,
  GetUnifiedTradingCoachMessagesResponse,
} from "@workspace/api-zod";

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

router.post("/trading-coach/ask", async (req, res): Promise<void> => {
  const parsed = AskUnifiedTradingCoachBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const { question, symbol, scannerCandidateId, tradingPositionId } = parsed.data;
  const context = await buildUnifiedCoachContext(userId, { symbol, scannerCandidateId, tradingPositionId });
  const fallback = unifiedCoachFallback(context, question);

  await persistMessage(userId, "user", question);
  const n = await narrateTradeFreeform(question, context, fallback);
  await persistMessage(userId, "assistant", n.text);

  res.json(AskUnifiedTradingCoachResponse.parse({ answer: n.text, answerSource: n.source }));
});

// SSE variant — same event contract as /trading/coach/ask/stream (meta ->
// delta... -> done), deliberately NOT in the OpenAPI/orval contract,
// matching that route's own precedent.
router.post("/trading-coach/ask/stream", async (req, res): Promise<void> => {
  const parsed = AskUnifiedTradingCoachBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const { question, symbol, scannerCandidateId, tradingPositionId } = parsed.data;
  const context = await buildUnifiedCoachContext(userId, { symbol, scannerCandidateId, tradingPositionId });
  const fallback = unifiedCoachFallback(context, question);

  await persistMessage(userId, "user", question);

  const sse = openSse(res);
  try {
    sse.send("meta", { source: llmAvailable() ? "llm" : "template", llmAvailable: llmAvailable() });
    const n = await narrateTradeFreeformStream(question, context, fallback, (t) => sse.send("delta", { text: t }));
    await persistMessage(userId, "assistant", n.text);
    sse.send("done", { answer: n.text, answerSource: n.source });
  } catch (err) {
    req.log.error({ err }, "unified trading coach ask stream failed");
    sse.send("error", { error: "Failed to answer question" });
  } finally {
    sse.close();
  }
});

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

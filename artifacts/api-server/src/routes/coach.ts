import { Router, type IRouter } from "express";
import {
  db,
  aiLessonsTable,
  tradeExplanationsTable,
  greeksQuizResultsTable,
  tradesTable,
  journalEntriesTable,
} from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import {
  ExplainTradeBody,
  TeachGreekBody,
  GenerateQuizBody,
  GradeQuizBody,
  JournalReviewBody,
} from "@workspace/api-zod";
import {
  explainQuote,
  explainSymbolStrategy,
  teachGreek,
  deltaMasterclass,
  greeksOverview,
  generateQuiz,
  gradeQuiz,
  strategyLabel,
  CoachError,
  type GreekName,
  type TradeExplanation,
} from "../lib/coach.js";
import type { ExplainTradeInput } from "@workspace/api-zod";
import {
  narrateTradeExplanation,
  narrateTradeExplanationStream,
  narrateGreekLesson,
  narrateGreekLessonStream,
  narrateJournalReview,
  narrateJournalReviewStream,
  llmAvailable,
  type JournalReviewData,
} from "../lib/coachLLM.js";
import { canonicalQuote } from "../lib/execution.js";
import { openSse } from "../lib/sse.js";
import { scannerResultsTable } from "@workspace/db";
import { getLegacyOwnerUserId } from "../lib/legacyOwner.js";

const router: IRouter = Router();

function handleCoachError(err: unknown, res: import("express").Response): boolean {
  if (err instanceof CoachError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

type ResolvedExplanation =
  | { ok: true; explanation: TradeExplanation; scId: number | null }
  | { ok: false; status: number; error: string };

// Build the deterministic trade explanation from either a scanner result id or a
// symbol+strategy. Shared by the JSON and SSE explain-trade endpoints. May throw
// CoachError (handled by the caller); validation failures are returned inline.
async function resolveTradeExplanation(
  input: ExplainTradeInput,
): Promise<ResolvedExplanation> {
  const { scannerResultId, symbol, strategy } = input;
  if (scannerResultId != null) {
    const [row] = await db
      .select()
      .from(scannerResultsTable)
      .where(eq(scannerResultsTable.id, scannerResultId))
      .limit(1);
    if (!row) return { ok: false, status: 404, error: "Scanner result not found" };
    const quote = canonicalQuote(row.symbol, row.strategy);
    if (!quote) return { ok: false, status: 400, error: `Unable to rebuild quote for ${row.symbol}` };
    return { ok: true, explanation: explainQuote(quote, row.id), scId: row.id };
  }
  if (symbol && strategy) {
    return { ok: true, explanation: explainSymbolStrategy(symbol, strategy), scId: null };
  }
  return { ok: false, status: 400, error: "Provide scannerResultId, or both symbol and strategy" };
}

// Persist a trade explanation + its lesson; shared by the JSON and SSE paths.
async function persistTradeExplanation(
  explanation: TradeExplanation,
  scId: number | null,
  narration: { text: string; source: "llm" | "template" },
): Promise<number> {
  const userId = await getLegacyOwnerUserId();
  const [saved] = await db
    .insert(tradeExplanationsTable)
    .values({
      userId,
      symbol: explanation.symbol,
      strategy: explanation.strategy,
      scannerResultId: scId,
      ravishScore: explanation.ravishScore,
      pop: explanation.pop,
      maxLoss: explanation.maxLoss,
      summary: explanation as unknown as Record<string, unknown>,
      narrative: narration.text,
      source: narration.source,
    })
    .returning();

  await db.insert(aiLessonsTable).values({
    userId,
    kind: "trade_explanation",
    topic: `${explanation.symbol} ${explanation.strategyLabel}`,
    title: `${explanation.symbol} ${explanation.strategyLabel} — explained`,
    content: narration.text,
    source: narration.source,
  });

  return saved.id;
}

// POST /coach/explain-trade — explain a scanner candidate or a symbol+strategy.
// READ-ONLY: this never previews, submits, or executes an order.
router.post("/coach/explain-trade", async (req, res): Promise<void> => {
  const parsed = ExplainTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const resolved = await resolveTradeExplanation(parsed.data);
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }
    const { explanation, scId } = resolved;
    const narration = await narrateTradeExplanation(explanation);
    const id = await persistTradeExplanation(explanation, scId, narration);

    res.json({
      id,
      explanation,
      narrative: narration.text,
      source: narration.source,
      llmAvailable: llmAvailable(),
    });
  } catch (err) {
    if (handleCoachError(err, res)) return;
    throw err;
  }
});

// POST /coach/explain-trade/stream — same as above but streams the narrative as
// SSE. Sends `meta` (structured facts) first, then `delta` text chunks, then
// `done` (authoritative full text + persisted id). Validation/lookup errors are
// returned as normal JSON before the stream is opened.
router.post("/coach/explain-trade/stream", async (req, res): Promise<void> => {
  const parsed = ExplainTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let resolved: ResolvedExplanation;
  try {
    resolved = await resolveTradeExplanation(parsed.data);
  } catch (err) {
    if (handleCoachError(err, res)) return;
    throw err;
  }
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  const { explanation, scId } = resolved;

  const sse = openSse(res);
  try {
    sse.send("meta", {
      explanation,
      source: llmAvailable() ? "llm" : "template",
      llmAvailable: llmAvailable(),
    });
    const narration = await narrateTradeExplanationStream(explanation, (t) =>
      sse.send("delta", { text: t }),
    );
    let id: number | null = null;
    try {
      id = await persistTradeExplanation(explanation, scId, narration);
    } catch (err) {
      req.log.error({ err }, "failed to persist streamed trade explanation");
    }
    sse.send("done", { id, narrative: narration.text, source: narration.source });
  } catch (err) {
    req.log.error({ err }, "trade explanation stream failed");
    sse.send("error", { error: "Failed to explain trade" });
  } finally {
    sse.close();
  }
});

// POST /coach/teach-greek — tutor one of the four Greeks with a live example.
router.post("/coach/teach-greek", async (req, res): Promise<void> => {
  const parsed = TeachGreekBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { greek, symbol } = parsed.data;
  try {
    const lesson = teachGreek(greek as GreekName, symbol ?? "SPY");
    const narration = await narrateGreekLesson(lesson);

    await db.insert(aiLessonsTable).values({
      userId: await getLegacyOwnerUserId(),
      kind: "greek",
      topic: lesson.greek,
      title: lesson.title,
      content: narration.text,
      source: narration.source,
    });

    res.json({
      lesson,
      narrative: narration.text,
      source: narration.source,
      llmAvailable: llmAvailable(),
    });
  } catch (err) {
    if (handleCoachError(err, res)) return;
    throw err;
  }
});

// POST /coach/teach-greek/stream — SSE variant of teach-greek. Sends `meta`
// (the deterministic lesson) first, then `delta` narrative chunks, then `done`.
router.post("/coach/teach-greek/stream", async (req, res): Promise<void> => {
  const parsed = TeachGreekBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { greek, symbol } = parsed.data;
  let lesson;
  try {
    lesson = teachGreek(greek as GreekName, symbol ?? "SPY");
  } catch (err) {
    if (handleCoachError(err, res)) return;
    throw err;
  }

  const sse = openSse(res);
  try {
    sse.send("meta", {
      lesson,
      source: llmAvailable() ? "llm" : "template",
      llmAvailable: llmAvailable(),
    });
    const narration = await narrateGreekLessonStream(lesson, (t) =>
      sse.send("delta", { text: t }),
    );
    try {
      await db.insert(aiLessonsTable).values({
        userId: await getLegacyOwnerUserId(),
        kind: "greek",
        topic: lesson.greek,
        title: lesson.title,
        content: narration.text,
        source: narration.source,
      });
    } catch (err) {
      req.log.error({ err }, "failed to persist streamed greek lesson");
    }
    sse.send("done", { narrative: narration.text, source: narration.source });
  } catch (err) {
    req.log.error({ err }, "greek lesson stream failed");
    sse.send("error", { error: "Failed to generate lesson" });
  } finally {
    sse.close();
  }
});

// GET /coach/learn/delta — the Delta Masterclass content.
router.get("/coach/learn/delta", async (_req, res): Promise<void> => {
  res.json(deltaMasterclass());
});

// GET /coach/learn/greeks — the Greeks overview content.
router.get("/coach/learn/greeks", async (_req, res): Promise<void> => {
  res.json(greeksOverview());
});

// POST /coach/quiz — generate a quiz (answers withheld; graded server-side).
router.post("/coach/quiz", async (req, res): Promise<void> => {
  const parsed = GenerateQuizBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { topic, count } = parsed.data;
  const quiz = generateQuiz(topic ?? "mixed", count ?? 5);
  res.json(quiz);
});

// POST /coach/quiz/grade — grade answers against the server-held key & persist.
router.post("/coach/quiz/grade", async (req, res): Promise<void> => {
  const parsed = GradeQuizBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { quizId, answers } = parsed.data;
  try {
    const result = gradeQuiz(quizId, answers);
    await db.insert(greeksQuizResultsTable).values({
      userId: await getLegacyOwnerUserId(),
      topic: result.topic,
      score: result.score,
      total: result.total,
      percent: result.percent,
    });
    res.json(result);
  } catch (err) {
    if (handleCoachError(err, res)) return;
    throw err;
  }
});

// A UTC day key (YYYY-MM-DD) for streak bucketing — deterministic across servers.
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Count consecutive calendar days (UTC) with at least one attempt, walking back
// from today. The streak is "alive" if the most recent attempt is today or
// yesterday; otherwise it has lapsed and we return 0.
function computeStreak(dayKeys: Set<string>, now: Date): number {
  if (dayKeys.size === 0) return 0;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const todayKey = utcDayKey(now);
  const yesterdayKey = utcDayKey(new Date(now.getTime() - DAY_MS));

  // Anchor on today if there's an attempt today, else yesterday, else lapsed.
  let cursor: Date;
  if (dayKeys.has(todayKey)) {
    cursor = new Date(`${todayKey}T00:00:00.000Z`);
  } else if (dayKeys.has(yesterdayKey)) {
    cursor = new Date(`${yesterdayKey}T00:00:00.000Z`);
  } else {
    return 0;
  }

  let streak = 0;
  while (dayKeys.has(utcDayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

// GET /coach/quiz/progress — recent attempts, best score per topic, overall
// stats, plus motivational aggregates (improvement vs. first attempt, day streak).
router.get("/coach/quiz/progress", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(greeksQuizResultsTable)
    .orderBy(desc(greeksQuizResultsTable.createdAt))
    .limit(50);

  const attempts = rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    score: r.score,
    total: r.total,
    percent: r.percent,
    createdAt: r.createdAt.toISOString(),
  }));

  const bestMap = new Map<string, { bestPercent: number; attempts: number }>();
  for (const r of rows) {
    const cur = bestMap.get(r.topic) ?? { bestPercent: 0, attempts: 0 };
    cur.attempts += 1;
    if (r.percent > cur.bestPercent) cur.bestPercent = r.percent;
    bestMap.set(r.topic, cur);
  }
  const bestByTopic = Array.from(bestMap.entries())
    .map(([topic, v]) => ({ topic, bestPercent: v.bestPercent, attempts: v.attempts }))
    .sort((a, b) => b.bestPercent - a.bestPercent);

  const totalAttempts = rows.length;
  const averagePercent =
    totalAttempts === 0
      ? 0
      : rows.reduce((sum, r) => sum + r.percent, 0) / totalAttempts;

  // Streak + improvement need the FULL history, not just the latest 50 rows, so
  // pull a lightweight chronological projection of every attempt.
  const history = await db
    .select({
      percent: greeksQuizResultsTable.percent,
      createdAt: greeksQuizResultsTable.createdAt,
    })
    .from(greeksQuizResultsTable)
    .orderBy(asc(greeksQuizResultsTable.createdAt));

  const firstPercent = history.length > 0 ? history[0].percent : 0;
  const latestPercent =
    history.length > 0 ? history[history.length - 1].percent : 0;
  const improvement = latestPercent - firstPercent;

  const dayKeys = new Set(history.map((h) => utcDayKey(h.createdAt)));
  const streak = computeStreak(dayKeys, new Date());

  res.json({
    attempts,
    bestByTopic,
    totalAttempts,
    averagePercent,
    streak,
    improvement,
    firstPercent,
    latestPercent,
  });
});

type ResolvedReview =
  | { ok: true; trade: typeof tradesTable.$inferSelect; data: JournalReviewData }
  | { ok: false; status: number; error: string };

// Load a CLOSED trade and build its deterministic JournalReviewData. Shared by
// the JSON and SSE journal-review endpoints. Closed-trade-only by design.
async function resolveJournalReview(tradeId: number): Promise<ResolvedReview> {
  const [trade] = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.id, tradeId))
    .limit(1);
  if (!trade) return { ok: false, status: 404, error: "Trade not found" };
  if (trade.status !== "closed") {
    return { ok: false, status: 400, error: "Journal review is only available for closed trades" };
  }

  const realizedPnl = trade.currentPnl ?? 0;
  const heldDays =
    trade.closeDate && trade.openDate
      ? Math.max(
          0,
          Math.round((trade.closeDate.getTime() - trade.openDate.getTime()) / (24 * 60 * 60 * 1000)),
        )
      : null;
  const data: JournalReviewData = {
    symbol: trade.symbol,
    strategy: trade.strategy,
    strategyLabel: strategyLabel(trade.strategy),
    status: trade.status,
    outcome: realizedPnl >= 0 ? "winner" : "loser",
    realizedPnl,
    credit: trade.credit,
    maxProfit: trade.maxProfit,
    maxLoss: trade.maxLoss,
    pop: trade.pop,
    ev: trade.ev,
    ravishScore: trade.ravishScore,
    exitReason: trade.exitReason,
    heldDays,
  };
  return { ok: true, trade, data };
}

// Persist a journal review (lesson + linked journal entry); shared by both paths.
async function persistJournalReview(
  trade: typeof tradesTable.$inferSelect,
  data: JournalReviewData,
  review: { review: string; lessonLearned: string; source: "llm" | "template" },
): Promise<void> {
  await db.insert(aiLessonsTable).values({
    userId: await getLegacyOwnerUserId(),
    kind: "journal_review",
    topic: `${trade.symbol} ${data.strategyLabel}`,
    title: `${trade.symbol} ${data.strategyLabel} — trade review`,
    content: `${review.review}\n\nLesson learned: ${review.lessonLearned}`,
    source: review.source,
  });

  // Reuse journalEntries.lessonLearned: save the AI lesson back onto any journal
  // entry linked to this trade so it surfaces on the entry itself.
  await db
    .update(journalEntriesTable)
    .set({ lessonLearned: review.lessonLearned })
    .where(eq(journalEntriesTable.tradeId, trade.id));
}

// POST /coach/journal-review — coach a CLOSED trade into a review + lesson learned.
router.post("/coach/journal-review", async (req, res): Promise<void> => {
  const parsed = JournalReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const resolved = await resolveJournalReview(parsed.data.tradeId);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  const { trade, data } = resolved;

  const review = await narrateJournalReview(data);
  await persistJournalReview(trade, data, review);

  res.json({
    tradeId: trade.id,
    symbol: trade.symbol,
    strategy: trade.strategy,
    review: review.review,
    lessonLearned: review.lessonLearned,
    source: review.source,
    llmAvailable: llmAvailable(),
  });
});

// POST /coach/journal-review/stream — SSE variant. Streams the review prose; the
// deterministic lessonLearned arrives in the `done` event.
router.post("/coach/journal-review/stream", async (req, res): Promise<void> => {
  const parsed = JournalReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const resolved = await resolveJournalReview(parsed.data.tradeId);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  const { trade, data } = resolved;

  const sse = openSse(res);
  try {
    sse.send("meta", {
      tradeId: trade.id,
      symbol: trade.symbol,
      strategy: trade.strategy,
      source: llmAvailable() ? "llm" : "template",
      llmAvailable: llmAvailable(),
    });
    const review = await narrateJournalReviewStream(data, (t) =>
      sse.send("delta", { text: t }),
    );
    try {
      await persistJournalReview(trade, data, review);
    } catch (err) {
      req.log.error({ err }, "failed to persist streamed journal review");
    }
    sse.send("done", {
      tradeId: trade.id,
      review: review.review,
      lessonLearned: review.lessonLearned,
      source: review.source,
    });
  } catch (err) {
    req.log.error({ err }, "journal review stream failed");
    sse.send("error", { error: "Failed to generate review" });
  } finally {
    sse.close();
  }
});

// GET /coach/lessons — recent saved coaching output.
router.get("/coach/lessons", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(aiLessonsTable)
    .orderBy(desc(aiLessonsTable.createdAt))
    .limit(50);
  res.json(
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      topic: r.topic,
      title: r.title,
      content: r.content,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

export default router;

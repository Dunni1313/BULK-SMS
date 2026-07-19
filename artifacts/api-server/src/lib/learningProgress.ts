// AI Teacher & Learning Centre sprint — Learning Progress. The ONLY new
// user-state mutation this sprint introduces (recordViewed/
// recordCompleted, writing to the new learning_progress table). Quiz
// scores are never re-stored here — getLearningProgress() reads BOTH
// pre-existing quiz-results tables (greeks_quiz_results,
// value_quiz_results) directly via the shared computeQuizProgress()
// aggregation (lib/quizProgress.ts), reused unmodified for both.

import { db, learningProgressTable, greeksQuizResultsTable, valueQuizResultsTable } from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import { computeQuizProgress, type QuizProgressSummary } from "./quizProgress.js";
import { LEARNING_PATHS } from "./learningPaths.js";

// "coach" (Phase 21 — Institutional AI Coach) tracks which coach
// explanations (coach:symbol item keys, e.g. "investment:AAPL") a user has
// viewed/completed, mirroring "strategy"'s own flat (non-path) tracking
// shape — coaches aren't organized into Learning Paths, so they get no
// separate pathCompletion-style rollup, exactly like Strategy Academy.
export type LearningItemType = "lesson" | "glossary" | "path" | "strategy" | "coach";

export async function recordViewed(userId: string, itemType: LearningItemType, itemKey: string): Promise<void> {
  await db
    .insert(learningProgressTable)
    .values({ userId, itemType, itemKey, viewedAt: new Date(), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [learningProgressTable.userId, learningProgressTable.itemType, learningProgressTable.itemKey],
      set: { viewedAt: new Date(), updatedAt: new Date() },
    });
}

export async function recordCompleted(userId: string, itemType: LearningItemType, itemKey: string): Promise<void> {
  const now = new Date();
  await db
    .insert(learningProgressTable)
    .values({ userId, itemType, itemKey, viewedAt: now, completedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [learningProgressTable.userId, learningProgressTable.itemType, learningProgressTable.itemKey],
      set: { completedAt: now, updatedAt: now },
    });
}

export interface LearningPathCompletion {
  pathKey: string;
  title: string;
  topicsTotal: number;
  topicsCompleted: number;
  percentComplete: number;
}

export interface LearningHistoryEntry {
  itemType: LearningItemType;
  itemKey: string;
  viewedAt: string;
  completedAt: string | null;
}

export interface LearningProgressSummary {
  lessonsViewed: number;
  lessonsCompleted: number;
  glossaryTermsViewed: number;
  strategiesViewed: number;
  coachesViewed: number;
  pathCompletion: LearningPathCompletion[];
  greeksQuiz: QuizProgressSummary;
  valueQuiz: QuizProgressSummary;
  recentHistory: LearningHistoryEntry[];
  // Full key lists (never limited to recentHistory's 25-row window) so
  // frontend detail pages can render an accurate per-item checkmark
  // regardless of how long ago an item was viewed/completed.
  completedLessonKeys: string[];
  completedGlossaryKeys: string[];
  completedStrategyKeys: string[];
  completedCoachKeys: string[];
}

async function quizProgressFor(
  table: typeof greeksQuizResultsTable | typeof valueQuizResultsTable,
  userId: string,
): Promise<QuizProgressSummary> {
  const rows = await db
    .select()
    .from(table)
    .where(eq(table.userId, userId))
    .orderBy(desc(table.createdAt))
    .limit(50);
  const history = await db
    .select({ topic: table.topic, score: table.score, total: table.total, percent: table.percent, createdAt: table.createdAt })
    .from(table)
    .where(eq(table.userId, userId))
    .orderBy(asc(table.createdAt));
  return computeQuizProgress(rows, history);
}

export async function getLearningProgress(userId: string): Promise<LearningProgressSummary> {
  const [progressRows, greeksQuiz, valueQuiz] = await Promise.all([
    db.select().from(learningProgressTable).where(eq(learningProgressTable.userId, userId)),
    quizProgressFor(greeksQuizResultsTable, userId),
    quizProgressFor(valueQuizResultsTable, userId),
  ]);

  const lessonRows = progressRows.filter((r) => r.itemType === "lesson");
  const glossaryRows = progressRows.filter((r) => r.itemType === "glossary");
  const strategyRows = progressRows.filter((r) => r.itemType === "strategy");
  const coachRows = progressRows.filter((r) => r.itemType === "coach");
  const completedLessonKeys = new Set(lessonRows.filter((r) => r.completedAt !== null).map((r) => r.itemKey));
  const completedGlossaryKeys = glossaryRows.filter((r) => r.completedAt !== null).map((r) => r.itemKey);
  const completedStrategyKeys = strategyRows.filter((r) => r.completedAt !== null).map((r) => r.itemKey);
  const completedCoachKeys = coachRows.filter((r) => r.completedAt !== null).map((r) => r.itemKey);

  const pathCompletion: LearningPathCompletion[] = LEARNING_PATHS.map((path) => {
    const topicsCompleted = path.topics.filter((t) => completedLessonKeys.has(t.key)).length;
    return {
      pathKey: path.key,
      title: path.title,
      topicsTotal: path.topics.length,
      topicsCompleted,
      percentComplete: path.topics.length > 0 ? Math.round((topicsCompleted / path.topics.length) * 1000) / 10 : 0,
    };
  });

  const recentHistory: LearningHistoryEntry[] = [...progressRows]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 25)
    .map((r) => ({
      itemType: r.itemType as LearningItemType,
      itemKey: r.itemKey,
      viewedAt: r.viewedAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    }));

  return {
    lessonsViewed: lessonRows.length,
    lessonsCompleted: completedLessonKeys.size,
    glossaryTermsViewed: glossaryRows.length,
    strategiesViewed: strategyRows.length,
    coachesViewed: coachRows.length,
    pathCompletion,
    completedLessonKeys: [...completedLessonKeys],
    completedGlossaryKeys,
    completedStrategyKeys,
    completedCoachKeys,
    greeksQuiz,
    valueQuiz,
    recentHistory,
  };
}


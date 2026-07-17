// AI Teacher & Learning Centre sprint — shared quiz-progress aggregation.
//
// Extracted, behavior-preserving, from routes/coach.ts's own
// GET /coach/quiz/progress handler (which previously inlined this exact
// logic privately) so BOTH quiz systems in this codebase — the Greeks
// quiz (greeks_quiz_results) and the Value Investing quiz
// (value_quiz_results) — can share one real implementation instead of
// the Value quiz having no progress endpoint at all (a gap this
// sprint's own investigation found and closes) or a second, drifting
// copy of the same streak/improvement math.

export interface QuizAttemptRow {
  topic: string;
  score: number;
  total: number;
  percent: number;
  createdAt: Date;
}

export interface QuizProgressAttempt {
  id: number | null;
  topic: string;
  score: number;
  total: number;
  percent: number;
  createdAt: string;
}

export interface QuizProgressTopicBest {
  topic: string;
  bestPercent: number;
  attempts: number;
}

export interface QuizProgressSummary {
  attempts: QuizProgressAttempt[];
  bestByTopic: QuizProgressTopicBest[];
  totalAttempts: number;
  averagePercent: number;
  streak: number;
  improvement: number;
  firstPercent: number;
  latestPercent: number;
}

// A UTC day key (YYYY-MM-DD) for streak bucketing — deterministic across servers.
export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Count consecutive calendar days (UTC) with at least one attempt, walking back
// from today. The streak is "alive" if the most recent attempt is today or
// yesterday; otherwise it has lapsed and we return 0.
export function computeStreak(dayKeys: Set<string>, now: Date): number {
  if (dayKeys.size === 0) return 0;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const todayKey = utcDayKey(now);
  const yesterdayKey = utcDayKey(new Date(now.getTime() - DAY_MS));

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

// The full aggregation routes/coach.ts's own GET /coach/quiz/progress
// handler used to compute inline — byte-identical logic, now shared.
// `rows` must already be sorted newest-first (matching the established
// `orderBy(desc(createdAt))` query convention) for the `attempts` list
// and `bestByTopic`; `fullHistoryOldestFirst` (a separate, lightweight
// oldest-first projection) drives streak/improvement, exactly as the
// original handler's own two-query design already did.
export function computeQuizProgress(
  rowsNewestFirst: (QuizAttemptRow & { id: number })[],
  fullHistoryOldestFirst: QuizAttemptRow[],
  now: Date = new Date(),
): QuizProgressSummary {
  const attempts: QuizProgressAttempt[] = rowsNewestFirst.map((r) => ({
    id: r.id,
    topic: r.topic,
    score: r.score,
    total: r.total,
    percent: r.percent,
    createdAt: r.createdAt.toISOString(),
  }));

  const bestMap = new Map<string, { bestPercent: number; attempts: number }>();
  for (const r of rowsNewestFirst) {
    const cur = bestMap.get(r.topic) ?? { bestPercent: 0, attempts: 0 };
    cur.attempts += 1;
    if (r.percent > cur.bestPercent) cur.bestPercent = r.percent;
    bestMap.set(r.topic, cur);
  }
  const bestByTopic = Array.from(bestMap.entries())
    .map(([topic, v]) => ({ topic, bestPercent: v.bestPercent, attempts: v.attempts }))
    .sort((a, b) => b.bestPercent - a.bestPercent);

  const totalAttempts = rowsNewestFirst.length;
  const averagePercent =
    totalAttempts === 0 ? 0 : rowsNewestFirst.reduce((sum, r) => sum + r.percent, 0) / totalAttempts;

  const firstPercent = fullHistoryOldestFirst.length > 0 ? fullHistoryOldestFirst[0].percent : 0;
  const latestPercent =
    fullHistoryOldestFirst.length > 0 ? fullHistoryOldestFirst[fullHistoryOldestFirst.length - 1].percent : 0;
  const improvement = latestPercent - firstPercent;

  const dayKeys = new Set(fullHistoryOldestFirst.map((h) => utcDayKey(h.createdAt)));
  const streak = computeStreak(dayKeys, now);

  return { attempts, bestByTopic, totalAttempts, averagePercent, streak, improvement, firstPercent, latestPercent };
}

// AI Teacher & Learning Centre sprint — shared quiz-progress aggregation,
// extracted behavior-preserving from routes/coach.ts's own
// GET /coach/quiz/progress handler. Pure unit coverage, no database.

import { describe, it, expect } from "vitest";
import { utcDayKey, computeStreak, computeQuizProgress, type QuizAttemptRow } from "./quizProgress.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

describe("utcDayKey", () => {
  it("produces a stable YYYY-MM-DD key regardless of time-of-day", () => {
    expect(utcDayKey(new Date("2026-03-15T00:00:01.000Z"))).toBe("2026-03-15");
    expect(utcDayKey(new Date("2026-03-15T23:59:59.000Z"))).toBe("2026-03-15");
  });
});

describe("computeStreak", () => {
  const now = new Date("2026-03-15T12:00:00.000Z");

  it("is 0 for no attempts at all", () => {
    expect(computeStreak(new Set(), now)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const days = new Set([utcDayKey(now), utcDayKey(daysAgo(now, 1)), utcDayKey(daysAgo(now, 2))]);
    expect(computeStreak(days, now)).toBe(3);
  });

  it("still counts an active streak if the most recent attempt was yesterday, not today", () => {
    const days = new Set([utcDayKey(daysAgo(now, 1)), utcDayKey(daysAgo(now, 2))]);
    expect(computeStreak(days, now)).toBe(2);
  });

  it("resets to 0 once the gap since the last attempt exceeds a day", () => {
    const days = new Set([utcDayKey(daysAgo(now, 3))]);
    expect(computeStreak(days, now)).toBe(0);
  });

  it("stops counting at the first genuine gap in the day sequence", () => {
    // today, yesterday, then a gap (no day -2), then day -3.
    const days = new Set([utcDayKey(now), utcDayKey(daysAgo(now, 1)), utcDayKey(daysAgo(now, 3))]);
    expect(computeStreak(days, now)).toBe(2);
  });
});

function row(topic: string, score: number, total: number, percent: number, createdAt: Date): QuizAttemptRow & { id: number } {
  return { topic, score, total, percent, createdAt, id: 0 };
}

describe("computeQuizProgress", () => {
  const now = new Date("2026-03-15T12:00:00.000Z");

  it("honestly reports all-zero/empty for a user with no attempts", () => {
    const result = computeQuizProgress([], [], now);
    expect(result).toEqual({
      attempts: [],
      bestByTopic: [],
      totalAttempts: 0,
      averagePercent: 0,
      streak: 0,
      improvement: 0,
      firstPercent: 0,
      latestPercent: 0,
    });
  });

  it("bestByTopic keeps the highest percent per topic, sorted descending", () => {
    const rows = [
      row("greeks", 8, 10, 80, now),
      row("greeks", 6, 10, 60, daysAgo(now, 1)),
      row("volatility", 9, 10, 90, daysAgo(now, 2)),
    ];
    const result = computeQuizProgress(rows, [...rows].reverse(), now);
    expect(result.bestByTopic).toEqual([
      { topic: "volatility", bestPercent: 90, attempts: 1 },
      { topic: "greeks", bestPercent: 80, attempts: 2 },
    ]);
  });

  it("averagePercent is the mean across all attempts", () => {
    const rows = [row("greeks", 5, 10, 50, now), row("greeks", 10, 10, 100, daysAgo(now, 1))];
    const result = computeQuizProgress(rows, [...rows].reverse(), now);
    expect(result.averagePercent).toBe(75);
  });

  it("improvement compares the very first attempt ever to the very latest", () => {
    const oldestFirst = [row("greeks", 3, 10, 30, daysAgo(now, 5)), row("greeks", 9, 10, 90, now)];
    const result = computeQuizProgress([...oldestFirst].reverse(), oldestFirst, now);
    expect(result.firstPercent).toBe(30);
    expect(result.latestPercent).toBe(90);
    expect(result.improvement).toBe(60);
  });

  it("attempts list preserves the caller's own newest-first ordering and ISO-stamps createdAt", () => {
    const rows = [row("greeks", 9, 10, 90, now), row("greeks", 5, 10, 50, daysAgo(now, 1))];
    const result = computeQuizProgress(rows, [...rows].reverse(), now);
    expect(result.attempts[0].percent).toBe(90);
    expect(result.attempts[1].percent).toBe(50);
    expect(result.attempts[0].createdAt).toBe(now.toISOString());
  });

  it("streak is derived from the full history, not just the capped newest-first attempts list", () => {
    const oldestFirst = [row("greeks", 8, 10, 80, daysAgo(now, 1)), row("greeks", 9, 10, 90, now)];
    const result = computeQuizProgress([...oldestFirst].reverse(), oldestFirst, now);
    expect(result.streak).toBe(2);
  });
});

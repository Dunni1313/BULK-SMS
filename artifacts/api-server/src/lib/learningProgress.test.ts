// AI Teacher & Learning Centre sprint — Learning Progress. The ONLY new
// user-state mutation this sprint introduces. DB-backed unit coverage
// against fresh, isolated users.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, learningProgressTable, greeksQuizResultsTable, valueQuizResultsTable } from "@workspace/db";
import { recordViewed, recordCompleted, getLearningProgress } from "./learningProgress.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `learning-progress-${label}-${randomUUID()}@example.com`, displayName: `Learning Progress ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(learningProgressTable).where(eq(learningProgressTable.userId, userId));
  await db.delete(greeksQuizResultsTable).where(eq(greeksQuizResultsTable.userId, userId));
  await db.delete(valueQuizResultsTable).where(eq(valueQuizResultsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("getLearningProgress — a brand-new user", () => {
  it("honestly reports all-zero, never fabricated", async () => {
    const userId = await createUser("fresh");
    try {
      const progress = await getLearningProgress(userId);
      expect(progress.lessonsViewed).toBe(0);
      expect(progress.lessonsCompleted).toBe(0);
      expect(progress.glossaryTermsViewed).toBe(0);
      expect(progress.strategiesViewed).toBe(0);
      expect(progress.coachesViewed).toBe(0);
      expect(progress.completedLessonKeys).toEqual([]);
      expect(progress.completedCoachKeys).toEqual([]);
      expect(progress.recentHistory).toEqual([]);
      expect(progress.pathCompletion.every((p) => p.topicsCompleted === 0)).toBe(true);
      // Phase 21 — Institutional AI Coach & Education Platform added a 9th path.
      expect(progress.pathCompletion.length).toBe(8);
    } finally {
      await cleanupUser(userId);
    }
  });
});

describe("recordViewed / recordCompleted", () => {
  let userId: string;
  beforeAll(async () => {
    userId = await createUser("mutations");
  });
  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("recordViewed inserts a new row with completedAt still null", async () => {
    await recordViewed(userId, "lesson", "foundations-stocks");
    const progress = await getLearningProgress(userId);
    expect(progress.lessonsViewed).toBe(1);
    expect(progress.lessonsCompleted).toBe(0);
    expect(progress.completedLessonKeys).toEqual([]);
  });

  it("recordViewed on the same item is idempotent — no duplicate row (upsert on user+itemType+itemKey)", async () => {
    await recordViewed(userId, "lesson", "foundations-stocks");
    const progress = await getLearningProgress(userId);
    expect(progress.lessonsViewed).toBe(1);
  });

  it("recordCompleted marks the same row completed rather than inserting a second row", async () => {
    await recordCompleted(userId, "lesson", "foundations-stocks");
    const progress = await getLearningProgress(userId);
    expect(progress.lessonsViewed).toBe(1);
    expect(progress.lessonsCompleted).toBe(1);
    expect(progress.completedLessonKeys).toEqual(["foundations-stocks"]);
  });

  it("glossary and strategy items are tracked independently from lessons", async () => {
    await recordViewed(userId, "glossary", "delta");
    await recordCompleted(userId, "strategy", "iron_condor");
    const progress = await getLearningProgress(userId);
    expect(progress.glossaryTermsViewed).toBe(1);
    expect(progress.strategiesViewed).toBe(1);
    expect(progress.completedStrategyKeys).toEqual(["iron_condor"]);
  });

  it("pathCompletion correctly rolls up a completed topic into its own path's percentage", async () => {
    // foundations-stocks belongs to the "foundations" path per lib/learningPaths.ts.
    const progress = await getLearningProgress(userId);
    const foundationsPath = progress.pathCompletion.find((p) => p.pathKey === "foundations")!;
    expect(foundationsPath.topicsCompleted).toBe(1);
    expect(foundationsPath.percentComplete).toBeGreaterThan(0);
  });

  it("recentHistory reflects the most recently updated items, newest first", async () => {
    const progress = await getLearningProgress(userId);
    expect(progress.recentHistory.length).toBeGreaterThan(0);
    for (let i = 1; i < progress.recentHistory.length; i++) {
      const prev = new Date(progress.recentHistory[i - 1].viewedAt).getTime();
      const cur = new Date(progress.recentHistory[i].viewedAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });
});

describe("getLearningProgress — quiz progress is read live, never a second, drifting copy", () => {
  it("reflects a real greeks_quiz_results row without this module writing to that table itself", async () => {
    const userId = await createUser("quiz-reuse");
    try {
      await db.insert(greeksQuizResultsTable).values({ userId, topic: "delta", score: 8, total: 10, percent: 80 });
      const progress = await getLearningProgress(userId);
      expect(progress.greeksQuiz.totalAttempts).toBe(1);
      expect(progress.greeksQuiz.averagePercent).toBe(80);
      expect(progress.valueQuiz.totalAttempts).toBe(0);
    } finally {
      await cleanupUser(userId);
    }
  });
});

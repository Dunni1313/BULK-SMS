// AI Teacher & Learning Centre sprint — Learning Progress. The ONLY new
// user-state mutation this sprint introduces. DB-backed unit coverage
// against fresh, isolated users.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, learningProgressTable, greeksQuizResultsTable, valueQuizResultsTable } from "@workspace/db";
import { recordViewed, recordCompleted, setBookmarked, getLearningProgress } from "./learningProgress.js";

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
      expect(progress.completedKnowledgeCheckKeys).toEqual([]);
      expect(progress.recentHistory).toEqual([]);
      expect(progress.pathCompletion.every((p) => p.topicsCompleted === 0)).toBe(true);
      // Phase 21 — Institutional AI Coach & Education Platform added a 9th path.
      // Phase 29 — Institutional Trading AI Coach added a 10th path.
      // Phase 30 — Institutional Strategy Framework added an 11th path.
      // v1.4.0, Sprint L1 — Learning Centre Foundation added a 12th path
      // (platform-basics).
      // v1.4.0, Sprint L2A — Interactive Module Guides added a 13th path
      // (options-income-engine).
      // v1.4.0, Sprint L2J — AI Coach & Institutional Mentor Academy added
      // a 14th path (ai-academy).
      expect(progress.pathCompletion.length).toBe(13);
      expect(progress.bookmarks).toEqual([]);
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

  it("Phase 31 — viewedStrategyKeys reflects the Strategy Framework/Workbench's own view-only 'Mark as viewed' action, which never calls recordCompleted() and so never populates completedStrategyKeys", async () => {
    await recordViewed(userId, "strategy", "strategy-framework:99");
    const progress = await getLearningProgress(userId);
    expect(progress.viewedStrategyKeys).toContain("strategy-framework:99");
    // This key was only ever viewed, never completed, so it's honestly
    // absent from the completed-only list even though it's real progress.
    expect(progress.completedStrategyKeys).not.toContain("strategy-framework:99");
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

// v1.4.0, Sprint L1 — Learning Centre Foundation.
describe("setBookmarked", () => {
  let userId: string;
  beforeAll(async () => {
    userId = await createUser("bookmarks");
  });
  afterAll(async () => {
    await cleanupUser(userId);
  });

  it("bookmarking a never-before-seen item creates a row and surfaces it in bookmarks", async () => {
    await setBookmarked(userId, "lesson", "platform-basics-navigation", true);
    const progress = await getLearningProgress(userId);
    expect(progress.bookmarks).toHaveLength(1);
    expect(progress.bookmarks[0]).toMatchObject({ itemType: "lesson", itemKey: "platform-basics-navigation" });
    // Bookmarking also stamps viewedAt (via the same upsert path
    // recordViewed/recordCompleted use), so it counts as viewed too.
    expect(progress.lessonsViewed).toBe(1);
  });

  it("bookmarking is independent of completion — the item is not marked completed", async () => {
    const progress = await getLearningProgress(userId);
    expect(progress.completedLessonKeys).not.toContain("platform-basics-navigation");
  });

  it("un-bookmarking clears bookmarkedAt without deleting the row or its viewedAt/completedAt", async () => {
    await recordCompleted(userId, "lesson", "platform-basics-navigation");
    await setBookmarked(userId, "lesson", "platform-basics-navigation", false);
    const progress = await getLearningProgress(userId);
    expect(progress.bookmarks).toEqual([]);
    // The completion recorded just above is untouched by un-bookmarking.
    expect(progress.completedLessonKeys).toContain("platform-basics-navigation");
  });

  it("re-bookmarking the same item is idempotent — never a duplicate row", async () => {
    await setBookmarked(userId, "lesson", "platform-basics-navigation", true);
    await setBookmarked(userId, "lesson", "platform-basics-navigation", true);
    const progress = await getLearningProgress(userId);
    expect(progress.bookmarks).toHaveLength(1);
  });

  it("bookmarks span every item type independently, newest bookmark first", async () => {
    await setBookmarked(userId, "glossary", "kill-switch", true);
    const progress = await getLearningProgress(userId);
    expect(progress.bookmarks.length).toBeGreaterThanOrEqual(2);
    expect(progress.bookmarks[0]).toMatchObject({ itemType: "glossary", itemKey: "kill-switch" });
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

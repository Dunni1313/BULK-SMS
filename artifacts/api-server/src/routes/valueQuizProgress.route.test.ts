// AI Teacher & Learning Centre sprint — GET /stock-analyst/value-quiz/progress.
// Closes a real, pre-existing gap: the Value Investing quiz previously had
// no progress endpoint at all, unlike the Greeks quiz's own
// GET /coach/quiz/progress. Live route test against the real app + a real
// Postgres connection, reusing the exact shared aggregation
// (lib/quizProgress.ts's computeQuizProgress()) both quiz systems now share.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

describe("GET /stock-analyst/value-quiz/progress (live, real Postgres)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server.close();
  });

  it("returns a well-shaped progress summary, matching the same shape as the Greeks quiz's own progress endpoint", async () => {
    const [valueRes, greeksRes] = await Promise.all([
      fetch(`${baseUrl}/api/stock-analyst/value-quiz/progress`),
      fetch(`${baseUrl}/api/coach/quiz/progress`),
    ]);
    expect(valueRes.status).toBe(200);
    expect(greeksRes.status).toBe(200);
    const valueBody = (await valueRes.json()) as Record<string, unknown>;
    const greeksBody = (await greeksRes.json()) as Record<string, unknown>;
    expect(Object.keys(valueBody).sort()).toEqual(Object.keys(greeksBody).sort());
    expect(typeof valueBody.totalAttempts).toBe("number");
    expect(typeof valueBody.averagePercent).toBe("number");
    expect(typeof valueBody.streak).toBe("number");
    expect(Array.isArray(valueBody.attempts)).toBe(true);
    expect(Array.isArray(valueBody.bestByTopic)).toBe(true);
  });

  it("a real graded quiz attempt is reflected in a subsequent progress read", async () => {
    const quizRes = await fetch(`${baseUrl}/api/stock-analyst/value-quiz`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "moats", count: 3 }),
    });
    expect(quizRes.status).toBe(200);
    const quiz = (await quizRes.json()) as { quizId: string; questions: { id: string }[] };

    const gradeRes = await fetch(`${baseUrl}/api/stock-analyst/value-quiz/grade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quizId: quiz.quizId, answers: quiz.questions.map(() => 0) }),
    });
    expect(gradeRes.status).toBe(200);

    const progressRes = await fetch(`${baseUrl}/api/stock-analyst/value-quiz/progress`);
    const progress = (await progressRes.json()) as { totalAttempts: number };
    expect(progress.totalAttempts).toBeGreaterThan(0);
  });
});

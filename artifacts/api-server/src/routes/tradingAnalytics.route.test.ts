// Phase 32 — Institutional Trading Analytics Engine. Live route
// integration tests for GET /trading/analytics against a real app + real
// Postgres connection (no auth session needed — unauthenticated requests
// resolve to the legacy-owner stand-in per tenantScope.ts, matching every
// other route test in this codebase). Every created row is deleted at the
// end of its own test to avoid polluting the shared legacy-owner account
// for sibling test files, mirroring routes/tradingStrategies.route.test.ts's
// own established pattern.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

interface StrategyResponse {
  id: number;
  name: string;
}

interface ChecklistResponse {
  id: number;
  strategyId: number;
  items: { id: string; label: string; required: boolean; completed: boolean; notes: string; evidenceLinks: unknown[] }[];
}

interface PositionResponse {
  id: number;
}

interface JournalResponse {
  id: number;
}

interface DashboardBody {
  overview: {
    tradesReviewed: number;
    plansCreated: number;
    journalEntries: number;
    workspaceNotes: number;
    strategiesRegistered: number;
    checklistInstances: number;
    generatedAt: string;
  };
  strategyUsage: {
    strategiesRegistered: number;
    checklistInstances: number;
    requiredEvidenceByType: Record<string, number>;
    evidenceLinksAttachedByType: Record<string, number>;
  };
  journal: {
    entryCount: number;
    moodTally: Record<string, number>;
    setupTypeTally: Record<string, number>;
    lessonRecordedCount: number;
    averageRMultiple: number | null;
  };
  risk: {
    openPositionsCount: number;
    positionsWithBothStopAndTarget: number;
    plansWithRiskParams: number;
  };
  learning: { totalTopics: number };
  coach: { totalCoachViews: number; byType: { coach: string; viewCount: number }[]; mostRecentCoach: string | null };
  session: { totalClassified: number; activity: { label: string; count: number }[] };
  structure: { coachViewCount: number; strategiesRequiringAsEvidence: number };
  liquidity: { coachViewCount: number; strategiesRequiringAsEvidence: number };
  checklist: { totalInstances: number; byStrategy: { strategyId: number; strategyName: string }[] };
}

function validStrategyInput(name: string) {
  return {
    name,
    description: "A personally defined trade setup, registered for analytics test purposes.",
    category: "trend",
    timeframes: ["1h", "1D"],
    markets: ["equities"],
    requiredEvidence: ["structure", "liquidity"],
    checklist: [
      { id: "reviewed-structure", label: "Reviewed market structure", required: true },
      { id: "optional-note", label: "Optional note", required: false },
    ],
    educationalNotes: "Notes for testing.",
    references: ["Test reference"],
    version: "1.0.0",
  };
}

describe("Institutional Trading Analytics Engine routes (live, real Postgres)", () => {
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

  async function post(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  async function get(path: string): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`);
  }
  async function del(path: string): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`, { method: "DELETE" });
  }

  it("returns a well-shaped dashboard even for a shared account with no dedicated fixtures created yet (never crashes on a partially-empty account)", async () => {
    const res = await get("/trading/analytics");
    expect(res.status).toBe(200);
    const body = (await res.json()) as DashboardBody;
    expect(typeof body.overview.tradesReviewed).toBe("number");
    expect(typeof body.overview.generatedAt).toBe("string");
    expect(body.coach.byType).toHaveLength(9);
  });

  it("reflects a newly created strategy + checklist in overview, strategyUsage, and checklist analytics", async () => {
    const name = `Analytics Strategy ${randomUUID()}`;
    const before = (await (await get("/trading/analytics")).json()) as DashboardBody;

    const strategyRes = await post("/trading/strategies", validStrategyInput(name));
    const strategy = (await strategyRes.json()) as StrategyResponse;

    const afterStrategy = (await (await get("/trading/analytics")).json()) as DashboardBody;
    expect(afterStrategy.overview.strategiesRegistered).toBe(before.overview.strategiesRegistered + 1);
    expect(afterStrategy.strategyUsage.requiredEvidenceByType.structure).toBe(before.strategyUsage.requiredEvidenceByType.structure + 1);
    expect(afterStrategy.strategyUsage.requiredEvidenceByType.liquidity).toBe(before.strategyUsage.requiredEvidenceByType.liquidity + 1);

    const checklistRes = await post(`/trading/strategies/${strategy.id}/checklists`, { symbol: "AAPL" });
    const checklist = (await checklistRes.json()) as ChecklistResponse;

    const after = (await (await get("/trading/analytics")).json()) as DashboardBody;
    expect(after.overview.checklistInstances).toBe(afterStrategy.overview.checklistInstances + 1);
    expect(after.checklist.byStrategy.some((r) => r.strategyId === strategy.id && r.strategyName === name)).toBe(true);

    await del(`/trading/strategy-checklists/${checklist.id}`);
    await del(`/trading/strategies/${strategy.id}`);
  });

  it("reflects a newly created journal entry in journal analytics (mood tally, setup type, lesson-recorded rate, rMultiple)", async () => {
    const before = (await (await get("/trading/analytics")).json()) as DashboardBody;

    const entryRes = await post("/trading/journal", {
      title: `Analytics Journal Entry ${randomUUID()}`,
      content: "A real journal entry created for analytics testing.",
      mood: "confident",
      setupType: "breakout",
      lessonLearned: "Waited for confirmation before entering.",
      rMultiple: 2,
    });
    expect(entryRes.status).toBe(201);
    const entry = (await entryRes.json()) as JournalResponse;

    const after = (await (await get("/trading/analytics")).json()) as DashboardBody;
    expect(after.journal.entryCount).toBe(before.journal.entryCount + 1);
    expect(after.journal.moodTally.confident).toBe((before.journal.moodTally.confident ?? 0) + 1);
    expect(after.journal.setupTypeTally.breakout).toBe((before.journal.setupTypeTally.breakout ?? 0) + 1);
    expect(after.journal.lessonRecordedCount).toBe(before.journal.lessonRecordedCount + 1);

    await del(`/trading/journal/${entry.id}`);
  });

  it("reflects a newly created open position in risk and session analytics (real stop/target discipline, real session classification)", async () => {
    const before = (await (await get("/trading/analytics")).json()) as DashboardBody;

    const positionRes = await post("/trading/positions", {
      symbol: "MSFT",
      side: "long",
      quantity: 10,
      entryPrice: 100,
      stopPrice: 95,
      targetPrice: 115,
    });
    expect(positionRes.status).toBe(201);
    const position = (await positionRes.json()) as PositionResponse;

    const after = (await (await get("/trading/analytics")).json()) as DashboardBody;
    expect(after.risk.openPositionsCount).toBe(before.risk.openPositionsCount + 1);
    expect(after.risk.positionsWithBothStopAndTarget).toBe(before.risk.positionsWithBothStopAndTarget + 1);
    expect(after.session.totalClassified).toBe(before.session.totalClassified + 1);

    await del(`/trading/positions/${position.id}`);
  });

  it("reflects a newly created trade plan in risk analytics (real accountRiskPct, honestly null riskRewardRatio when not derivable)", async () => {
    const before = (await (await get("/trading/analytics")).json()) as DashboardBody;

    const planRes = await post("/trading/trade-plans", {
      symbol: "GOOGL",
      direction: "long",
      thesis: "Testing analytics aggregation over a real trade plan.",
      accountRiskPct: 1.5,
      entryPrice: 100,
      stopPrice: 95,
      targetPrice: 120,
    });
    expect(planRes.status).toBe(201);

    const after = (await (await get("/trading/analytics")).json()) as DashboardBody;
    expect(after.risk.plansWithRiskParams).toBe(before.risk.plansWithRiskParams + 1);
  });

  it("reflects a real Trading AI Coach view in coach analytics and structure/liquidity engine usage analytics", async () => {
    const before = (await (await get("/trading/analytics")).json()) as DashboardBody;

    // Mirrors the exact real learning_progress row components/coach/TradingCoachDrawer.tsx
    // writes on a "mark as viewed" action — itemType="coach", itemKey="<coach>:<scope>".
    // A fresh, collision-free scope per run: recordViewed() upserts on the
    // (userId, itemType, itemKey) unique key, so re-running this test against
    // the same shared legacy-owner account with a fixed scope would silently
    // update an existing row instead of creating a genuinely new one.
    const viewRes = await post("/learning-centre/progress/view", { itemType: "coach", itemKey: `structure:${randomUUID()}` });
    expect(viewRes.status).toBe(200);

    const after = (await (await get("/trading/analytics")).json()) as DashboardBody;
    expect(after.coach.totalCoachViews).toBe(before.coach.totalCoachViews + 1);
    expect(after.coach.mostRecentCoach).toBe("structure");
    const structureRow = after.coach.byType.find((r) => r.coach === "structure")!;
    expect(structureRow.viewCount).toBe((before.coach.byType.find((r) => r.coach === "structure")?.viewCount ?? 0) + 1);
    expect(after.structure.coachViewCount).toBe(structureRow.viewCount);
  });

  it("workspaceNotes excludes STRATEGY:<id> pseudo-symbol notes, counting only genuine per-symbol Trade Workspace notes", async () => {
    const before = (await (await get("/trading/analytics")).json()) as DashboardBody;

    const noteRes = await post("/trading/workspace-notes", { symbol: "AAPL", note: `Analytics test note ${randomUUID()}` });
    expect(noteRes.status).toBe(201);
    const note = (await noteRes.json()) as { id: number };

    const strategyName = `Note Exclusion Strategy ${randomUUID()}`;
    const strategyRes = await post("/trading/strategies", validStrategyInput(strategyName));
    const strategy = (await strategyRes.json()) as StrategyResponse;
    const strategyNoteRes = await post("/trading/workspace-notes", { symbol: `STRATEGY:${strategy.id}`, note: "Strategy note, should not count." });
    expect(strategyNoteRes.status).toBe(201);
    const strategyNote = (await strategyNoteRes.json()) as { id: number };

    const after = (await (await get("/trading/analytics")).json()) as DashboardBody;
    expect(after.overview.workspaceNotes).toBe(before.overview.workspaceNotes + 1);

    await del(`/trading/workspace-notes/${note.id}`);
    await del(`/trading/workspace-notes/${strategyNote.id}`);
    await del(`/trading/strategies/${strategy.id}`);
  });

  it("never fabricates a signal/score/prediction field anywhere in the live response", async () => {
    const res = await get("/trading/analytics");
    const body = await res.json();
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"tradingsignal"|"forecast"/);
  });
});

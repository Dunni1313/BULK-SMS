// Phase 6, Sprint 73 — Load & Chaos Testing: Automation Scheduler.
//
// Load-tests the scheduler's per-user cycle function (runAutoExecutionCycle
// / runAutoAdjustmentCycle, Phase 1 Sprint 8) at a scale well beyond the
// 2-3 users every prior scheduler test uses — proving cycle processing
// still completes correctly and in reasonable, measured time as the
// number of users grows. Same real-Postgres-database convention as
// autoScheduler.multiUser.test.ts (Sprint 8) and
// autoExecutionSecurityReview.test.ts (Sprint 67), for the same reason:
// the thing under test is real DB-state selection/mutation across many
// users, which a mocked db would not exercise faithfully.
//
// buildTicket/executeValidatedTicket/evaluateTradeAdjustment are mocked
// (deterministic, same convention as every prior scheduler test) so this
// suite's timing reflects the ORCHESTRATION overhead (settings reads,
// per-user gating, candidate selection, audit logging) rather than
// unrelated market-snapshot/ticket-building cost.
//
// Uses freshly-created, isolated per-test users only — never the shared
// legacy-owner account — avoiding the shared-account live-Postgres-
// parallelism flake category disclosed since Sprint 20.
//
// DELIBERATE DESIGN CHOICE, discovered during this sprint's own
// validation, not anticipated in the pre-approval plan: the first draft
// of this file called the real, globally-unscoped orchestration wrappers
// (runAutoExecutionCycleForAllUsers/runAutoAdjustmentCycleForAllUsers)
// directly. Under full-suite parallel execution, those wrappers' own
// internal SELECT (every currently-armed user, across ALL test files, not
// just this one) genuinely collided with sibling test files — including
// this sprint's own schedulerChaos.test.ts, which also arms many users —
// reproducing the already-disclosed getSettingsRow() check-then-insert
// race (Sprint 70) at a MUCH higher collision rate than any prior test
// ever exercised it at, up to and including a real FK-violation crash
// when a sibling file's afterAll deleted a user between the wrapper's own
// SELECT and its later per-user processing. This is a genuine, disclosed
// LIMITATION of testing this specific pair of already-known-racy wrapper
// functions at scale — not a Sprint 73 regression, and NOT fixed here
// (fixing getSettingsRow()'s own check-then-insert race would mean
// touching autoExecution.ts/autoAdjustment.ts/serverState.ts, requiring
// its own separate, explicitly-approved sprint per CLAUDE.md rule 2).
// The safe, scope-preserving substitute below load-tests
// runAutoExecutionCycle()/runAutoAdjustmentCycle() — the exact same
// per-user function the wrapper calls once per armed user, in the exact
// same sequential pattern — directly, scoped only to this file's own
// known user IDs, never touching the global armed-user query.

import { describe, it, expect, vi, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, settingsTable, tradesTable, scannerResultsTable, journalEntriesTable } from "@workspace/db";
import { runConcurrent, summarizeLatencies, successCount } from "./loadTestHarness.js";

interface MockAdj {
  action: string;
  actionLabel: string;
  autoActionable: boolean;
}
const adjById = new Map<number, MockAdj>();

vi.mock("./adjustment.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./adjustment.js")>();
  return {
    ...actual,
    evaluateTradeAdjustment: vi.fn((t: { id: number }) => adjById.get(t.id)),
  };
});

const buildTicketMock = vi.fn();
const executeValidatedTicketMock = vi.fn();
vi.mock("./execution.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./execution.js")>();
  return {
    ...actual,
    buildTicket: (...args: unknown[]) => buildTicketMock(...args),
    executeValidatedTicket: (...args: unknown[]) => executeValidatedTicketMock(...args),
  };
});

const { runAutoAdjustmentCycle } = await import("./autoAdjustment.js");
const { runAutoExecutionCycle } = await import("./autoExecution.js");

async function makeUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `sprint73-load-${label}-${randomUUID()}@example.com`, displayName: label })
    .returning({ id: usersTable.id });
  return row.id;
}

async function makeSettings(
  userId: string,
  overrides: { executionMode: string; autoExecuteEnabled: boolean; autoAdjustEnabled: boolean },
): Promise<void> {
  await db.insert(settingsTable).values({ userId, eventRiskEnabled: false, ...overrides });
}

const seededUserIds: string[] = [];

afterAll(async () => {
  for (const userId of seededUserIds) {
    await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
    await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
    await db.delete(scannerResultsTable).where(eq(scannerResultsTable.userId, userId));
    await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
  }
});

describe("Scheduler load — sequential per-user execution cycles at scale (Sprint 73)", () => {
  const ARMED_COUNT = 25;
  const UNARMED_COUNT = 10; // mixed in to prove selection stays correct at scale, not just fast

  it(`processes ${ARMED_COUNT} armed users' cycles sequentially (mirroring runAutoExecutionCycleForAllUsers' own internal loop), all executing successfully, in reasonable time; ${UNARMED_COUNT} unarmed users stay correctly untouched`, async () => {
    buildTicketMock.mockReset();
    executeValidatedTicketMock.mockReset();
    buildTicketMock.mockImplementation(() =>
      Promise.resolve({
        symbol: "SPY",
        strategy: "iron_condor",
        expiration: "2026-08-01",
        ravishScore: 90,
        validation: { valid: true, violations: [] },
      }),
    );
    let executeCallCount = 0;
    executeValidatedTicketMock.mockImplementation(async () => {
      executeCallCount += 1;
      return { broker: "mock", status: "filled", tradeId: executeCallCount, orderId: `order-${executeCallCount}` };
    });

    const armedUserIds: string[] = [];
    const unarmedUserIds: string[] = [];
    for (let i = 0; i < ARMED_COUNT; i++) {
      const userId = await makeUser(`exec-armed-${i}`);
      seededUserIds.push(userId);
      armedUserIds.push(userId);
      await makeSettings(userId, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: false });
      await db.insert(scannerResultsTable).values({ userId, symbol: "SPY", strategy: "iron_condor", ravishScore: 90 });
    }
    for (let i = 0; i < UNARMED_COUNT; i++) {
      const userId = await makeUser(`exec-unarmed-${i}`);
      seededUserIds.push(userId);
      unarmedUserIds.push(userId);
      await makeSettings(userId, { executionMode: "semi_auto", autoExecuteEnabled: false, autoAdjustEnabled: false });
      await db.insert(scannerResultsTable).values({ userId, symbol: "SPY", strategy: "iron_condor", ravishScore: 90 });
    }

    const start = performance.now();
    const results: Awaited<ReturnType<typeof runAutoExecutionCycle>>[] = [];
    for (const uid of armedUserIds) {
      results.push(await runAutoExecutionCycle(uid));
    }
    const totalMs = performance.now() - start;

    // Correctness at scale: every one of THIS file's own armed users executed
    // exactly once, scoped to userIds this test itself created and controls.
    expect(results).toHaveLength(ARMED_COUNT);
    expect(results.every((r) => r.blocked === false && r.executed === 1)).toBe(true);

    // eslint-disable-next-line no-console
    console.info(`[load] runAutoExecutionCycle x${ARMED_COUNT} sequential:`, {
      totalMs: Math.round(totalMs),
      avgMsPerUser: Math.round(totalMs / ARMED_COUNT),
    });
    // Generous ceiling — a real-DB-backed sequential loop over ARMED_COUNT
    // users with mocked ticket-building, in this shared sandbox.
    expect(totalMs).toBeLessThan(15000);

    // Every unarmed user's own cycle, if invoked directly, still correctly
    // blocks (Sprint 8's own established per-user-independence proof,
    // re-run here at UNARMED_COUNT scale rather than just one user).
    const unarmedResults = await Promise.all(unarmedUserIds.map((uid) => runAutoExecutionCycle(uid)));
    expect(unarmedResults.every((r) => r.blocked === true && r.executed === 0)).toBe(true);
  }, 30000);
});

describe("Scheduler load — sequential per-user adjustment cycles at scale (Sprint 73)", () => {
  const ARMED_COUNT = 25;

  it(`processes ${ARMED_COUNT} armed users' de-risk closes sequentially (mirroring runAutoAdjustmentCycleForAllUsers' own internal loop), all succeeding, in reasonable time`, async () => {
    const closeForProfit: MockAdj = { action: "close_for_profit", actionLabel: "Close for profit", autoActionable: true };

    const armedUserIds: string[] = [];
    for (let i = 0; i < ARMED_COUNT; i++) {
      const userId = await makeUser(`adj-armed-${i}`);
      seededUserIds.push(userId);
      armedUserIds.push(userId);
      await makeSettings(userId, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: true });
      const [trade] = await db
        .insert(tradesTable)
        .values({ userId, symbol: "SPY", strategy: "iron_condor", status: "open" })
        .returning({ id: tradesTable.id });
      adjById.set(trade.id, closeForProfit);
    }

    const start = performance.now();
    const results: Awaited<ReturnType<typeof runAutoAdjustmentCycle>>[] = [];
    for (const uid of armedUserIds) {
      results.push(await runAutoAdjustmentCycle(uid));
    }
    const totalMs = performance.now() - start;

    expect(results).toHaveLength(ARMED_COUNT);
    expect(results.every((r) => r.blocked === false && r.executed === 1)).toBe(true);
    // eslint-disable-next-line no-console
    console.info(`[load] runAutoAdjustmentCycle x${ARMED_COUNT} sequential:`, {
      totalMs: Math.round(totalMs),
      avgMsPerUser: Math.round(totalMs / ARMED_COUNT),
    });
    expect(totalMs).toBeLessThan(15000);
  }, 30000);
});

describe("Scheduler load — many concurrently-invoked individual cycles (Sprint 73)", () => {
  it("runs 30 different users' cycles concurrently (not the sequential loop above), all completing correctly", async () => {
    buildTicketMock.mockReset();
    executeValidatedTicketMock.mockReset();
    buildTicketMock.mockImplementation(() =>
      Promise.resolve({
        symbol: "SPY",
        strategy: "iron_condor",
        expiration: "2026-08-01",
        ravishScore: 90,
        validation: { valid: true, violations: [] },
      }),
    );
    executeValidatedTicketMock.mockImplementation(async () => ({
      broker: "mock",
      status: "filled",
      tradeId: Math.floor(Math.random() * 1_000_000),
      orderId: randomUUID(),
    }));

    const CONCURRENCY = 30;
    const userIds: string[] = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      const userId = await makeUser(`exec-concurrent-${i}`);
      seededUserIds.push(userId);
      userIds.push(userId);
      await makeSettings(userId, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: false });
      await db.insert(scannerResultsTable).values({ userId, symbol: "SPY", strategy: "iron_condor", ravishScore: 90 });
    }

    const { outcomes, latenciesMs, totalMs } = await runConcurrent(CONCURRENCY, (i) => runAutoExecutionCycle(userIds[i]));

    expect(successCount(outcomes)).toBe(CONCURRENCY);
    const fulfilled = outcomes.filter((o): o is PromiseFulfilledResult<Awaited<ReturnType<typeof runAutoExecutionCycle>>> => o.status === "fulfilled");
    // Every DIFFERENT user's cycle ran to real completion (per-user
    // single-flight never blocks a DIFFERENT user — Sprint 8's own proof,
    // re-run at 30-way real concurrency instead of the original 2).
    expect(fulfilled.every((f) => f.value.blocked === false && f.value.executed === 1)).toBe(true);

    const summary = summarizeLatencies(latenciesMs);
    // eslint-disable-next-line no-console
    console.info(`[load] runAutoExecutionCycle x${CONCURRENCY} concurrent:`, {
      totalMs: Math.round(totalMs),
      p50Ms: Math.round(summary.p50Ms),
      p95Ms: Math.round(summary.p95Ms),
      maxMs: Math.round(summary.maxMs),
    });
    expect(totalMs).toBeLessThan(15000);
    expect(summary.p95Ms).toBeLessThan(10000);
  }, 30000);
});

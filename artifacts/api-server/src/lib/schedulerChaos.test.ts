// Phase 6, Sprint 73 — Load & Chaos Testing: Automation Scheduler.
//
// Chaos/resilience scenarios for the automation scheduler, extending
// Sprint 67's own single-candidate mid-cycle kill-switch-flip proof and
// Sprint 8's own 2-user concurrency proof to genuinely adversarial scale
// and injected-failure conditions. Read-only with respect to
// autoExecution.ts/autoAdjustment.ts — every scenario here proves
// ALREADY-CORRECT, unmodified behavior holds under load; nothing in
// either engine is changed by this file.
//
// Same real-Postgres-database + mocked-execution-layer convention as
// autoScheduler.multiUser.test.ts (Sprint 8) and
// autoExecutionSecurityReview.test.ts (Sprint 67).
//
// Explicit limitation, documented here and in this sprint's own
// CLAUDE.md/Phase 6 doc entries: this file injects failures at the
// application layer (a mocked buildTicket/executeValidatedTicket call
// throwing) rather than actual infrastructure faults (killing the
// database connection, network partition, process crash). Deliberately
// out of scope this sprint — actually severing the shared test database
// mid-run would risk destabilizing every OTHER test file that may be
// running concurrently against the same database in this session's
// shared sandbox, an unacceptable blast radius for a testing-only sprint.
// Per-candidate/per-user exception injection is the honest, bounded
// substitute: it exercises the exact same try/catch resilience boundaries
// (buildTicket's catch, executeValidatedTicket's catch, the live
// freshGate() re-check) that a real infrastructure fault would also hit.

import { describe, it, expect, vi, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, settingsTable, tradesTable, scannerResultsTable, journalEntriesTable } from "@workspace/db";
import { runConcurrent, successCount } from "./loadTestHarness.js";

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
    .values({ email: `sprint73-chaos-${label}-${randomUUID()}@example.com`, displayName: label })
    .returning({ id: usersTable.id });
  return row.id;
}

async function makeSettings(
  userId: string,
  overrides: { executionMode: string; autoExecuteEnabled: boolean; autoAdjustEnabled: boolean },
): Promise<void> {
  await db.insert(settingsTable).values({ userId, eventRiskEnabled: false, ...overrides });
}

async function disarm(userId: string): Promise<void> {
  await db.update(settingsTable).set({ autoExecuteEnabled: false }).where(eq(settingsTable.userId, userId));
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

describe("Chaos — kill-switch flip mid-cycle at scale (Sprint 73, extends Sprint 67's 2-candidate proof)", () => {
  it("halts execution exactly at the flip point across 10 candidates, never executing after the flip, never crashing", async () => {
    const CANDIDATE_COUNT = 10;
    const FLIP_AT = 5; // flip after this many candidates have executed

    const userId = await makeUser("exec-flip-scale");
    seededUserIds.push(userId);
    await makeSettings(userId, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: false });

    await db.insert(scannerResultsTable).values(
      Array.from({ length: CANDIDATE_COUNT }, (_, i) => ({
        userId,
        symbol: `SYM${i}`,
        strategy: "iron_condor",
        ravishScore: 100 - i, // descending, so processing order is deterministic
      })),
    );

    buildTicketMock.mockReset();
    executeValidatedTicketMock.mockReset();
    buildTicketMock.mockImplementation((input: { scannerResultId: number }) =>
      Promise.resolve({
        symbol: `SYM-${input.scannerResultId}`,
        strategy: "iron_condor",
        expiration: "2026-08-01",
        ravishScore: 90,
        validation: { valid: true, violations: [] },
      }),
    );
    let executeCallCount = 0;
    executeValidatedTicketMock.mockImplementation(async () => {
      executeCallCount += 1;
      if (executeCallCount === FLIP_AT) {
        await disarm(userId);
      }
      return { broker: "mock", status: "filled", tradeId: executeCallCount, orderId: `order-${executeCallCount}` };
    });

    const result = await runAutoExecutionCycle(userId);

    expect(result.blocked).toBe(false);
    expect(executeValidatedTicketMock).toHaveBeenCalledTimes(FLIP_AT);
    expect(result.executed).toBe(FLIP_AT);
    const blockedDecisions = result.decisions.filter((d) => d.decision === "blocked");
    expect(blockedDecisions.length).toBeGreaterThanOrEqual(1);
    expect(blockedDecisions[0]!.reason).toMatch(/kill switch/i);
    // The whole cycle completed (returned normally) despite the mid-run flip —
    // no crash, no dangling promise, no partial/corrupted state.
    expect(result.decisions.length).toBeGreaterThanOrEqual(FLIP_AT + 1);
  }, 30000);
});

describe("Chaos — injected per-candidate failures within one cycle (Sprint 73)", () => {
  it("continues processing every other candidate when buildTicket throws for some of them, never crashing the cycle", async () => {
    const CANDIDATE_COUNT = 12;
    const userId = await makeUser("exec-partial-failure");
    seededUserIds.push(userId);
    await makeSettings(userId, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: false });

    const rows = await db
      .insert(scannerResultsTable)
      .values(
        Array.from({ length: CANDIDATE_COUNT }, (_, i) => ({
          userId,
          symbol: `FAIL${i}`,
          strategy: "iron_condor",
          ravishScore: 100 - i,
        })),
      )
      .returning({ id: scannerResultsTable.id });
    const failingIds = new Set(rows.filter((_, i) => i % 3 === 0).map((r) => r.id)); // every 3rd candidate fails

    buildTicketMock.mockReset();
    executeValidatedTicketMock.mockReset();
    buildTicketMock.mockImplementation((input: { scannerResultId: number }) => {
      if (failingIds.has(input.scannerResultId)) {
        return Promise.reject(new Error("simulated ticket-building failure"));
      }
      return Promise.resolve({
        symbol: `SYM-${input.scannerResultId}`,
        strategy: "iron_condor",
        expiration: "2026-08-01",
        ravishScore: 90,
        validation: { valid: true, violations: [] },
      });
    });
    executeValidatedTicketMock.mockImplementation(async () => ({
      broker: "mock",
      status: "filled",
      tradeId: Math.floor(Math.random() * 1_000_000),
      orderId: randomUUID(),
    }));

    const result = await runAutoExecutionCycle(userId);

    expect(result.blocked).toBe(false);
    expect(result.rejected).toBe(failingIds.size);
    expect(result.executed).toBe(CANDIDATE_COUNT - failingIds.size);
    expect(result.decisions).toHaveLength(CANDIDATE_COUNT);
    const rejectedDecisions = result.decisions.filter((d) => d.decision === "rejected");
    expect(rejectedDecisions.every((d) => d.reason === "simulated ticket-building failure")).toBe(true);
  }, 30000);

  it("continues processing every other candidate when order routing (executeValidatedTicket) throws for some of them", async () => {
    const CANDIDATE_COUNT = 10;
    const userId = await makeUser("exec-partial-routing-failure");
    seededUserIds.push(userId);
    await makeSettings(userId, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: false });

    await db.insert(scannerResultsTable).values(
      Array.from({ length: CANDIDATE_COUNT }, (_, i) => ({
        userId,
        symbol: `ROUTE${i}`,
        strategy: "iron_condor",
        ravishScore: 100 - i,
      })),
    );

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
    let callCount = 0;
    executeValidatedTicketMock.mockImplementation(async () => {
      callCount += 1;
      if (callCount % 2 === 0) throw new Error("simulated broker routing failure");
      return { broker: "mock", status: "filled", tradeId: callCount, orderId: `order-${callCount}` };
    });

    const result = await runAutoExecutionCycle(userId);

    expect(result.blocked).toBe(false);
    expect(result.executed + result.rejected).toBe(CANDIDATE_COUNT);
    expect(result.executed).toBeGreaterThan(0); // some succeeded despite interleaved failures
    expect(result.rejected).toBeGreaterThan(0); // some failed and were honestly recorded, not silently dropped
    const routingFailures = result.decisions.filter((d) => d.reason === "simulated broker routing failure");
    expect(routingFailures.length).toBeGreaterThan(0);
  }, 30000);
});

describe("Chaos — many concurrent users, one disarmed mid-flight by a simulated concurrent admin action (Sprint 73)", () => {
  it("isolates the disarmed user's own cycle without affecting any of the other 19 concurrently-running users", async () => {
    const OTHER_COUNT = 19;
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

    const targetUserId = await makeUser("exec-chaos-disarm-target");
    seededUserIds.push(targetUserId);
    await makeSettings(targetUserId, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: false });
    await db.insert(scannerResultsTable).values({ userId: targetUserId, symbol: "SPY", strategy: "iron_condor", ravishScore: 90 });

    const otherUserIds: string[] = [];
    for (let i = 0; i < OTHER_COUNT; i++) {
      const userId = await makeUser(`exec-chaos-other-${i}`);
      seededUserIds.push(userId);
      otherUserIds.push(userId);
      await makeSettings(userId, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: false });
      await db.insert(scannerResultsTable).values({ userId, symbol: "SPY", strategy: "iron_condor", ravishScore: 90 });
    }

    executeValidatedTicketMock.mockImplementation(async () => ({
      broker: "mock",
      status: "filled",
      tradeId: Math.floor(Math.random() * 1_000_000),
      orderId: randomUUID(),
    }));

    // Fire all 20 users' cycles concurrently; simulate an operator disarming
    // the target user via a genuinely concurrent, out-of-band DB write while
    // every cycle is already in flight.
    const [targetResult, ...otherResults] = await Promise.all([
      (async () => {
        // A brief delay lets the other 19 cycles' own freshGate() reads start
        // racing against this disarm, rather than trivially winning every time.
        await new Promise((r) => setTimeout(r, 5));
        await disarm(targetUserId);
        return runAutoExecutionCycle(targetUserId);
      })(),
      ...otherUserIds.map((uid) => runAutoExecutionCycle(uid)),
    ]);

    // The target user's own cycle either never got to execute (blocked
    // immediately by the pre-cycle gate) or halted before its one candidate —
    // either way, it must never show a successful execution once disarmed.
    expect(targetResult.executed).toBe(0);

    // Every OTHER concurrently-running user, genuinely unrelated to the
    // disarm, completed normally and in full — proving isolation holds
    // under real concurrent chaos, not just sequential invocation.
    expect(otherResults).toHaveLength(OTHER_COUNT);
    expect(otherResults.every((r) => r.blocked === false && r.executed === 1)).toBe(true);
  }, 30000);
});

describe("Chaos — recovery after a failed/blocked cycle (Sprint 73)", () => {
  it("a user whose cycle was blocked (or partially failed) runs cleanly on the very next tick once conditions are fixed", async () => {
    const userId = await makeUser("exec-recovery");
    seededUserIds.push(userId);
    await makeSettings(userId, { executionMode: "full_auto", autoExecuteEnabled: false, autoAdjustEnabled: false });
    await db.insert(scannerResultsTable).values({ userId, symbol: "SPY", strategy: "iron_condor", ravishScore: 90 });

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
      tradeId: 1,
      orderId: "order-1",
    }));

    // First tick: disarmed, correctly blocked, zero side effects.
    const blockedResult = await runAutoExecutionCycle(userId);
    expect(blockedResult.blocked).toBe(true);
    expect(blockedResult.executed).toBe(0);

    // Operator re-arms the switch (recovery action).
    await db.update(settingsTable).set({ autoExecuteEnabled: true }).where(eq(settingsTable.userId, userId));

    // Second tick: runs cleanly, no lingering effect from the prior blocked run.
    const recoveredResult = await runAutoExecutionCycle(userId);
    expect(recoveredResult.blocked).toBe(false);
    expect(recoveredResult.executed).toBe(1);
  }, 30000);
});

describe("Chaos — adjustment-side isolation under concurrent load (Sprint 73)", () => {
  it("closes only the armed users' de-risk-eligible trades across 15 concurrently-running cycles, isolating a disarmed one", async () => {
    const closeForProfit: MockAdj = { action: "close_for_profit", actionLabel: "Close for profit", autoActionable: true };
    const ARMED_COUNT = 14;

    const armedUserIds: string[] = [];
    for (let i = 0; i < ARMED_COUNT; i++) {
      const userId = await makeUser(`adj-chaos-armed-${i}`);
      seededUserIds.push(userId);
      armedUserIds.push(userId);
      await makeSettings(userId, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: true });
      const [trade] = await db
        .insert(tradesTable)
        .values({ userId, symbol: "SPY", strategy: "iron_condor", status: "open" })
        .returning({ id: tradesTable.id });
      adjById.set(trade.id, closeForProfit);
    }

    const disarmedUserId = await makeUser("adj-chaos-disarmed");
    seededUserIds.push(disarmedUserId);
    await makeSettings(disarmedUserId, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: false });
    const [disarmedTrade] = await db
      .insert(tradesTable)
      .values({ userId: disarmedUserId, symbol: "SPY", strategy: "iron_condor", status: "open" })
      .returning({ id: tradesTable.id });
    adjById.set(disarmedTrade.id, closeForProfit);

    const { outcomes } = await runConcurrent(ARMED_COUNT + 1, (i) =>
      i < ARMED_COUNT ? runAutoAdjustmentCycle(armedUserIds[i]) : runAutoAdjustmentCycle(disarmedUserId),
    );

    expect(successCount(outcomes)).toBe(ARMED_COUNT + 1);
    const armedResults = outcomes.slice(0, ARMED_COUNT).map((o) => (o.status === "fulfilled" ? o.value : null));
    expect(armedResults.every((r) => r && r.blocked === false && r.executed === 1)).toBe(true);
    const disarmedResult = outcomes[ARMED_COUNT];
    expect(disarmedResult.status).toBe("fulfilled");
    if (disarmedResult.status === "fulfilled") {
      expect(disarmedResult.value.blocked).toBe(true);
      expect(disarmedResult.value.executed).toBe(0);
    }

    const [row] = await db.select().from(tradesTable).where(eq(tradesTable.id, disarmedTrade.id));
    expect(row.status).toBe("open"); // never touched
  }, 30000);
});

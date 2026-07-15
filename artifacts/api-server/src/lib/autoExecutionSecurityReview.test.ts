// Phase 5, Sprint 67 — Testing & Security Audit checkpoint, first bounded slice
// (a dedicated review of the auto-execution/auto-adjustment kill-switch and
// guardrail logic; see .agents/memory/kill-switch-security-review.md for the
// full write-up).
//
// This file closes finding #1 of that review: no integration-level regression
// test previously existed for a kill-switch flip occurring MID-CYCLE — the
// exact historical bug auto-execution-engine.md documents as the reason
// freshGate()/the live per-close re-check exist ("a mid-cycle kill-switch
// flip breach the stated safety bounds"). Only the pure evaluateAutoGuardrails()
// unit tests (phase6.test.ts) exercised "switch off" as a static input; this
// file proves the LIVE, multi-candidate cycle actually halts mid-loop when an
// operator flips the switch off between two candidates, for both engines.
//
// Read-only with respect to autoExecution.ts/autoAdjustment.ts — this file
// adds coverage over already-correct, unmodified behavior; it changes nothing
// in either engine.
//
// Same real-Postgres-database convention as autoScheduler.multiUser.test.ts
// (Sprint 8), since the thing under test is real DB-state mutation racing
// against the live in-loop settings re-read, which a mocked db would not
// exercise faithfully.

import { describe, it, expect, vi, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, settingsTable, tradesTable, scannerResultsTable, journalEntriesTable } from "@workspace/db";

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
    .values({ email: `sprint67-${label}-${randomUUID()}@example.com`, displayName: label })
    .returning({ id: usersTable.id });
  return row.id;
}

async function makeSettings(userId: string): Promise<void> {
  await db.insert(settingsTable).values({
    userId,
    executionMode: "full_auto",
    autoExecuteEnabled: true,
    autoAdjustEnabled: true,
    eventRiskEnabled: false,
  });
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

describe("Kill-switch mid-cycle flip — auto-execution (Sprint 67 security review, finding #1)", () => {
  it("halts before executing the SECOND candidate when the master kill switch is flipped off between candidates in the same cycle", async () => {
    const userId = await makeUser("exec-midcycle");
    seededUserIds.push(userId);
    await makeSettings(userId);

    await db
      .insert(scannerResultsTable)
      .values([
        { userId, symbol: "SPY", strategy: "iron_condor", ravishScore: 90 },
        { userId, symbol: "QQQ", strategy: "iron_condor", ravishScore: 85 },
      ]);

    buildTicketMock.mockClear();
    executeValidatedTicketMock.mockClear();
    buildTicketMock.mockImplementation((input: { scannerResultId: number }) =>
      Promise.resolve({
        symbol: input.scannerResultId === undefined ? "SPY" : "SPY",
        strategy: "iron_condor",
        expiration: "2026-08-01",
        ravishScore: 90,
        validation: { valid: true, violations: [] },
      }),
    );

    let executeCallCount = 0;
    executeValidatedTicketMock.mockImplementation(async () => {
      executeCallCount += 1;
      if (executeCallCount === 1) {
        // Simulate the operator disarming automation in real time, between this
        // candidate's execution and the next candidate's fresh gate re-check —
        // the exact scenario the live freshGate() re-check (called right before
        // EVERY execution, not once per cycle) exists to catch.
        await disarm(userId);
      }
      return { broker: "mock", status: "filled", tradeId: executeCallCount, orderId: `order-${executeCallCount}` };
    });

    const result = await runAutoExecutionCycle(userId);

    expect(result.blocked).toBe(false); // the cycle itself started armed, so it's not a cycle-level block
    expect(executeValidatedTicketMock).toHaveBeenCalledTimes(1); // only the FIRST candidate executed
    expect(result.executed).toBe(1);
    // The second candidate must show up as a "blocked" decision, not silently
    // dropped and not executed — proving the mid-cycle halt is visible in the
    // audit trail, not just an early return.
    const blockedDecisions = result.decisions.filter((d) => d.decision === "blocked");
    expect(blockedDecisions.length).toBeGreaterThanOrEqual(1);
    expect(blockedDecisions[0]!.reason).toMatch(/kill switch/i);
  });
});

describe("Kill-switch mid-cycle flip — auto-adjustment (Sprint 67 security review, finding #1)", () => {
  it("halts before closing the SECOND trade when the master kill switch is flipped off between trades in the same cycle", async () => {
    const userId = await makeUser("adjust-midcycle");
    seededUserIds.push(userId);
    await makeSettings(userId);

    const [tradeA] = await db
      .insert(tradesTable)
      .values({ userId, symbol: "SPY", strategy: "iron_condor", status: "open" })
      .returning({ id: tradesTable.id });
    const [tradeB] = await db
      .insert(tradesTable)
      .values({ userId, symbol: "QQQ", strategy: "iron_condor", status: "open" })
      .returning({ id: tradesTable.id });

    const closeForProfit: MockAdj = { action: "close_for_profit", actionLabel: "Close for profit", autoActionable: true };
    // Trades are processed ordered by ravishScore desc (default 0 for both, so
    // insertion order via id is the effective tie-break in this test's own DB) —
    // tradeA (inserted first) is the first candidate evaluated.
    adjById.set(tradeA.id, closeForProfit);
    adjById.set(tradeB.id, closeForProfit);

    // Side effect on the FIRST trade's own adjustment evaluation: disarm the
    // user before the loop moves on to the second trade. autoAdjustment.ts
    // re-reads live settings and re-evaluates autoAdjustAllowed() before every
    // single close, so this exercises that exact live re-check.
    const evaluateTradeAdjustment = (await import("./adjustment.js")).evaluateTradeAdjustment as ReturnType<typeof vi.fn>;
    evaluateTradeAdjustment.mockImplementation((t: { id: number }) => {
      if (t.id === tradeA.id) {
        void disarm(userId);
      }
      return adjById.get(t.id);
    });

    const result = await runAutoAdjustmentCycle(userId);

    expect(result.blocked).toBe(false); // the cycle itself started armed
    expect(result.executed).toBe(1); // only tradeA closed

    const [rowA] = await db.select().from(tradesTable).where(eq(tradesTable.id, tradeA.id));
    const [rowB] = await db.select().from(tradesTable).where(eq(tradesTable.id, tradeB.id));
    expect(rowA.status).toBe("closed");
    expect(rowB.status).toBe("open"); // never touched — the mid-cycle halt protected it

    const blockedDecisions = result.decisions.filter((d) => d.decision === "blocked");
    expect(blockedDecisions.length).toBeGreaterThanOrEqual(1);
    expect(blockedDecisions[0]!.reason).toMatch(/kill switch/i);
  });
});

// Phase 1, Sprint 8 — automation scheduler multi-tenancy regression suite.
//
// Sprint 8's approved design (per docs/Phase-1-Foundation-Execution-Plan.md §4.4
// and the owner's explicit sign-off): the scheduler now runs one cycle PER user
// who is actually armed, instead of one global cycle. This suite proves the
// sprint's own acceptance criteria directly: two users with independently-armed
// kill switches behave completely independently, and a disarmed (or wrong-mode)
// user's positions are never touched by another user's armed cycle.
//
// Like lib/tenantIsolation.test.ts, this talks to a REAL Postgres database (via
// DATABASE_URL) rather than mocking @workspace/db — the thing under test is the
// armed-user selection query plus real trade-row mutation, which a mocked db
// would not exercise faithfully. `evaluateTradeAdjustment` is mocked (kept
// deterministic, same convention as autoAdjustment.cycle.test.ts) so this suite
// doesn't depend on live market-snapshot randomness; `closeTradePosition` and
// `getSettingsRow` run for REAL against the test database.

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  settingsTable,
  tradesTable,
  scannerResultsTable,
  journalEntriesTable,
} from "@workspace/db";

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

const { runAutoAdjustmentCycle, runAutoAdjustmentCycleForAllUsers } = await import("./autoAdjustment.js");
const { runAutoExecutionCycle, runAutoExecutionCycleForAllUsers } = await import("./autoExecution.js");

async function makeUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `sprint8-${label}-${randomUUID()}@example.com`, displayName: label })
    .returning({ id: usersTable.id });
  return row.id;
}

async function makeSettings(
  userId: string,
  overrides: { executionMode: string; autoExecuteEnabled: boolean; autoAdjustEnabled: boolean },
): Promise<void> {
  // eventRiskEnabled/eventRiskAutoBlockHigh default to true — turned off here so
  // this suite's assertions test per-user selection, not the (unrelated,
  // already-covered-elsewhere) event-risk feature.
  await db.insert(settingsTable).values({
    userId,
    eventRiskEnabled: false,
    ...overrides,
  });
}

async function makeOpenTrade(userId: string): Promise<number> {
  const [row] = await db
    .insert(tradesTable)
    .values({ userId, symbol: "SPY", strategy: "iron_condor", status: "open" })
    .returning({ id: tradesTable.id });
  return row.id;
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

describe("runAutoAdjustmentCycleForAllUsers — per-user independence", () => {
  let armedUser: string;
  let armedTradeId: number;
  let switchOffUser: string;
  let switchOffTradeId: number;
  let wrongModeUser: string;
  let wrongModeTradeId: number;

  beforeAll(async () => {
    armedUser = await makeUser("adj-armed");
    switchOffUser = await makeUser("adj-switch-off");
    wrongModeUser = await makeUser("adj-wrong-mode");
    seededUserIds.push(armedUser, switchOffUser, wrongModeUser);

    await makeSettings(armedUser, {
      executionMode: "full_auto",
      autoExecuteEnabled: true,
      autoAdjustEnabled: true,
    });
    await makeSettings(switchOffUser, {
      executionMode: "full_auto",
      autoExecuteEnabled: true,
      autoAdjustEnabled: false, // armed for OPENING, not for adjustment
    });
    await makeSettings(wrongModeUser, {
      executionMode: "semi_auto", // not full_auto at all
      autoExecuteEnabled: true,
      autoAdjustEnabled: true,
    });

    armedTradeId = await makeOpenTrade(armedUser);
    switchOffTradeId = await makeOpenTrade(switchOffUser);
    wrongModeTradeId = await makeOpenTrade(wrongModeUser);

    const closeForProfit: MockAdj = {
      action: "close_for_profit",
      actionLabel: "Close for profit",
      autoActionable: true,
    };
    adjById.set(armedTradeId, closeForProfit);
    adjById.set(switchOffTradeId, closeForProfit);
    adjById.set(wrongModeTradeId, closeForProfit);
  });

  it("closes only the fully-armed user's trade; the switch-off and wrong-mode users are never even selected", async () => {
    const results = await runAutoAdjustmentCycleForAllUsers();
    const runIds = results.map((r) => r.runId);
    expect(runIds).toHaveLength(1); // only one user was armed

    const [armedResult] = results;
    expect(armedResult.blocked).toBe(false);
    expect(armedResult.executed).toBe(1);

    const [armedRow] = await db.select().from(tradesTable).where(eq(tradesTable.id, armedTradeId));
    expect(armedRow.status).toBe("closed");
  });

  it("the switch-off user's trade is never touched, even if their cycle is invoked directly", async () => {
    const r = await runAutoAdjustmentCycle(switchOffUser);
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toMatch(/Auto-adjust/i);

    const [row] = await db.select().from(tradesTable).where(eq(tradesTable.id, switchOffTradeId));
    expect(row.status).toBe("open");
  });

  it("the wrong-mode user's trade is never touched, even if their cycle is invoked directly", async () => {
    const r = await runAutoAdjustmentCycle(wrongModeUser);
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toMatch(/Full-Auto/i);

    const [row] = await db.select().from(tradesTable).where(eq(tradesTable.id, wrongModeTradeId));
    expect(row.status).toBe("open");
  });

  it("two DIFFERENT users' cycles run concurrently without blocking each other (per-user single-flight)", async () => {
    const userX = await makeUser("adj-concurrent-x");
    const userY = await makeUser("adj-concurrent-y");
    seededUserIds.push(userX, userY);
    await makeSettings(userX, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: true });
    await makeSettings(userY, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: true });
    const tradeX = await makeOpenTrade(userX);
    const tradeY = await makeOpenTrade(userY);
    const hold: MockAdj = { action: "hold", actionLabel: "Hold", autoActionable: false };
    adjById.set(tradeX, hold);
    adjById.set(tradeY, hold);

    const [rx, ry] = await Promise.all([runAutoAdjustmentCycle(userX), runAutoAdjustmentCycle(userY)]);
    expect(rx.blocked).toBe(false);
    expect(ry.blocked).toBe(false);
  });

  it("the SAME user invoked concurrently still single-flights (one run blocks the other)", async () => {
    const userZ = await makeUser("adj-same-user-lock");
    seededUserIds.push(userZ);
    await makeSettings(userZ, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: true });

    const [a, b] = await Promise.all([runAutoAdjustmentCycle(userZ), runAutoAdjustmentCycle(userZ)]);
    const blockedRun = [a, b].find((r) => r.blocked && /already running/i.test(r.blockReason ?? ""));
    const realRun = [a, b].find((r) => !r.blocked);
    expect(blockedRun).toBeTruthy();
    expect(realRun).toBeTruthy();
  });
});

describe("runAutoExecutionCycleForAllUsers — per-user independence", () => {
  let armedUser: string;
  let disarmedUser: string;

  beforeAll(async () => {
    armedUser = await makeUser("exec-armed");
    disarmedUser = await makeUser("exec-disarmed");
    seededUserIds.push(armedUser, disarmedUser);

    await makeSettings(armedUser, { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: false });
    await makeSettings(disarmedUser, {
      executionMode: "full_auto",
      autoExecuteEnabled: false, // kill switch OFF
      autoAdjustEnabled: false,
    });

    await db
      .insert(scannerResultsTable)
      .values({ userId: armedUser, symbol: "SPY", strategy: "iron_condor" });
    await db
      .insert(scannerResultsTable)
      .values({ userId: disarmedUser, symbol: "SPY", strategy: "iron_condor" });
  });

  it("only the armed user's candidates ever reach buildTicket/executeValidatedTicket", async () => {
    buildTicketMock.mockClear();
    executeValidatedTicketMock.mockClear();
    buildTicketMock.mockResolvedValue({
      symbol: "SPY",
      strategy: "iron_condor",
      expiration: "2026-08-01",
      ravishScore: 90,
      validation: { valid: true, violations: [] },
    });
    executeValidatedTicketMock.mockResolvedValue({
      broker: "mock",
      status: "filled",
      tradeId: 1,
      orderId: "order-1",
    });

    // Other describe blocks in this suite seed their own execution-armed users
    // (autoExecuteEnabled doesn't gate auto-adjust, so several adjustment-focused
    // fixtures are incidentally execution-armed too) — so rather than asserting
    // an exact result count, assert the two things that actually matter: THIS
    // user's cycle ran, and the disarmed user's id never appears anywhere.
    const results = await runAutoExecutionCycleForAllUsers();
    const runUserIds = new Set(
      [...buildTicketMock.mock.calls, ...executeValidatedTicketMock.mock.calls].flatMap((call) =>
        call.filter((arg): arg is string => typeof arg === "string" && arg.length > 0),
      ),
    );
    expect(results.length).toBeGreaterThan(0);
    expect(buildTicketMock.mock.calls.some((call) => call[1] === armedUser)).toBe(true);
    expect(executeValidatedTicketMock.mock.calls.some((call) => call[2] === armedUser)).toBe(true);
    expect(runUserIds.has(disarmedUser)).toBe(false);
  });

  it("the disarmed user's cycle blocks immediately and never reaches buildTicket, even invoked directly", async () => {
    buildTicketMock.mockClear();
    executeValidatedTicketMock.mockClear();

    const r = await runAutoExecutionCycle(disarmedUser);
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toMatch(/kill switch/i);
    expect(buildTicketMock).not.toHaveBeenCalled();
    expect(executeValidatedTicketMock).not.toHaveBeenCalled();
  });
});

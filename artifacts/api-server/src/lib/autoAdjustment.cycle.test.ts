// Task #23 — end-to-end coverage for the auto-adjustment SAFETY LOOP itself.
//
// phase8.adjustment.test.ts already proves the deterministic signal/selection math
// and the pure `autoAdjustAllowed` gate. What was only verified by manual curl — and
// is exercised here — is the live cycle in `runAutoAdjustmentCycle()`:
//   1. it is a no-op unless the full arm gate (full_auto && master && auto-adjust) is on
//   2. it re-reads the gate before EVERY action so the kill switch halts mid-cycle
//   3. it auto-acts ONLY on the AUTO_ACTIONABLE de-risk subset (never roll/convert/hold)
//   4. concurrent invocations are single-flighted (no double-close)
//   5. closes route through the shared closeTradePosition helper and write a log row
//
// The DB, settings, per-trade evaluation, and the close helper are mocked at the
// module boundary so the test drives the cycle's control flow deterministically
// without a live Postgres connection.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Sentinel "columns" so mocked `eq`/`desc` can be introspected ─────────────
const COL = { status: "status_col", ravishScore: "score_col", id: "id_col" } as const;

// ─── Mutable mock state, reset before each test ───────────────────────────────
interface MockTrade {
  id: number;
  symbol: string;
  strategy: string;
  status: string;
  ravishScore: number;
}
interface MockEval {
  action: string;
  actionLabel: string;
  autoActionable: boolean;
}

const state: {
  settings: { executionMode: string; autoExecuteEnabled: boolean; autoAdjustEnabled: boolean };
  openTrades: MockTrade[];
  freshById: Record<number, MockTrade | undefined>;
  evalById: Record<number, MockEval>;
  insertedRows: Array<Record<string, unknown>>;
} = {
  settings: { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: true },
  openTrades: [],
  freshById: {},
  evalById: {},
  insertedRows: [],
};

// closeTradePosition spy — configurable side effect (e.g. flip the kill switch).
const closeSpy = vi.fn(async (trade: MockTrade, _userId: string, _reason?: string) => ({
  trade: { ...trade, status: "closed" },
  exitReason: "test",
  realizedPnl: 123,
  realizedPnlPercent: 12,
}));

// ─── drizzle-orm: keep everything real except eq/desc/and, which we make inspectable ─
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown) => ({ __col: col, __val: val }),
    desc: (col: unknown) => ({ __desc: col }),
    and: (...conds: Array<{ __col: unknown; __val: unknown }>) => ({ __and: conds }),
  };
});

// ─── @workspace/db: a hand-rolled query builder over the mock state ───────────
vi.mock("@workspace/db", () => {
  const tradesTable = COL;
  const autoExecutionLogTable = {};
  const db = {
    select: () => ({
      from: () => ({
        // The open-list query ends in `.orderBy(...)`; the fresh-trade lookup is
        // awaited directly off `.where(...)`. We satisfy both: the returned object
        // has an `.orderBy()` (open list) AND is thenable (single fresh lookup).
        // Sprint 7 wraps both queries as and(<primary condition>, eq(userId)) — the
        // id lookup still just needs to find the eq(tradesTable.id, ...) sub-condition.
        where: (cond: {
          __col?: unknown;
          __val?: unknown;
          __and?: Array<{ __col: unknown; __val: unknown }>;
        }) => ({
          orderBy: () => Promise.resolve(state.openTrades),
          then: (onF: (v: MockTrade[]) => unknown, onR?: (e: unknown) => unknown) => {
            const idCond = cond.__and
              ? cond.__and.find((c) => c.__col === tradesTable.id)
              : cond.__col === tradesTable.id
                ? cond
                : undefined;
            const fresh = idCond ? state.freshById[idCond.__val as number] : undefined;
            return Promise.resolve(fresh ? [fresh] : []).then(onF, onR);
          },
        }),
      }),
    }),
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        state.insertedRows.push(row);
      },
    }),
  };
  return { db, tradesTable, autoExecutionLogTable };
});

vi.mock("./serverState.js", () => ({
  getSettingsRow: vi.fn(async () => state.settings),
}));

vi.mock("./legacyOwner.js", () => ({
  getLegacyOwnerUserId: async () => "test-legacy-owner-id",
}));

// Keep the real AUTO_ACTIONABLE set (so the cycle's defensive double-check is the
// genuine production set), but drive each trade's recommendation deterministically.
vi.mock("./adjustment.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./adjustment.js")>();
  return {
    ...actual,
    evaluateTradeAdjustment: vi.fn((t: MockTrade) => state.evalById[t.id]),
  };
});

vi.mock("./tradeClose.js", () => ({
  closeTradePosition: (...args: [MockTrade, string, string?]) => closeSpy(...args),
}));

// Import AFTER the mocks are registered.
const { runAutoAdjustmentCycle } = await import("./autoAdjustment.js");

function evalFor(action: string): MockEval {
  // Mirror production: autoActionable is true only for the de-risk subset.
  const auto = ["close_for_profit", "close_for_loss", "reduce_risk"].includes(action);
  return { action, actionLabel: action.replace(/_/g, " "), autoActionable: auto };
}

beforeEach(() => {
  state.settings = { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: true };
  state.openTrades = [];
  state.freshById = {};
  state.evalById = {};
  state.insertedRows = [];
  closeSpy.mockClear();
  closeSpy.mockImplementation(async (trade: MockTrade) => ({
    trade: { ...trade, status: "closed" },
    exitReason: "test",
    realizedPnl: 123,
    realizedPnlPercent: 12,
  }));
});

function makeTrade(id: number, action: string, overrides: Partial<MockTrade> = {}): MockTrade {
  const t: MockTrade = { id, symbol: `SYM${id}`, strategy: "iron_condor", status: "open", ravishScore: 70, ...overrides };
  state.openTrades.push(t);
  state.freshById[id] = { ...t };
  state.evalById[id] = evalFor(action);
  return t;
}

describe("runAutoAdjustmentCycle — arm gate (no-op unless fully armed)", () => {
  it("is a no-op when mode is not full_auto and logs a single blocked decision", async () => {
    state.settings.executionMode = "semi_auto";
    makeTrade(1, "close_for_profit");

    const r = await runAutoAdjustmentCycle();

    expect(r.blocked).toBe(true);
    expect(r.blockReason).toMatch(/Full-Auto/);
    expect(r.scanned).toBe(0);
    expect(r.executed).toBe(0);
    expect(closeSpy).not.toHaveBeenCalled();
    // exactly one blocked audit row, kind "adjust"
    expect(state.insertedRows).toHaveLength(1);
    expect(state.insertedRows[0]).toMatchObject({ kind: "adjust", decision: "blocked" });
  });

  it("is a no-op when the master kill switch is off", async () => {
    state.settings.autoExecuteEnabled = false;
    makeTrade(1, "close_for_loss");

    const r = await runAutoAdjustmentCycle();

    expect(r.blocked).toBe(true);
    expect(r.blockReason).toMatch(/[Mm]aster/);
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it("is a no-op when only the subordinate auto-adjust switch is off", async () => {
    state.settings.autoAdjustEnabled = false;
    makeTrade(1, "reduce_risk");

    const r = await runAutoAdjustmentCycle();

    expect(r.blocked).toBe(true);
    expect(r.blockReason).toMatch(/Auto-adjust/);
    expect(closeSpy).not.toHaveBeenCalled();
  });
});

describe("runAutoAdjustmentCycle — AUTO_ACTIONABLE restriction", () => {
  it("auto-acts ONLY on close_for_profit / close_for_loss / reduce_risk", async () => {
    makeTrade(1, "close_for_profit");
    makeTrade(2, "close_for_loss");
    makeTrade(3, "reduce_risk");
    makeTrade(4, "roll_threatened");
    makeTrade(5, "roll_untested");
    makeTrade(6, "convert");
    makeTrade(7, "hold");

    const r = await runAutoAdjustmentCycle();

    expect(r.blocked).toBe(false);
    expect(r.scanned).toBe(7);
    expect(r.executed).toBe(3);
    expect(r.skipped).toBe(4);

    // Only the three de-risk trades hit the close helper.
    expect(closeSpy).toHaveBeenCalledTimes(3);
    const closedIds = closeSpy.mock.calls.map((c) => c[0].id).sort();
    expect(closedIds).toEqual([1, 2, 3]);

    const executedDecisions = r.decisions.filter((d) => d.decision === "executed").map((d) => d.action).sort();
    expect(executedDecisions).toEqual(["close_for_loss", "close_for_profit", "reduce_risk"]);
  });

  it("refuses to act on a structural action even if it claims to be auto-actionable", async () => {
    // Defensive double-check: the cycle gates on AUTO_ACTIONABLE.has(action), so a
    // roll/convert can never be auto-closed even if autoActionable is forced true.
    makeTrade(1, "roll_threatened");
    state.evalById[1] = { action: "roll_threatened", actionLabel: "Roll threatened", autoActionable: true };

    const r = await runAutoAdjustmentCycle();

    expect(closeSpy).not.toHaveBeenCalled();
    expect(r.executed).toBe(0);
    expect(r.skipped).toBe(1);
  });
});

describe("runAutoAdjustmentCycle — shared close path + audit log", () => {
  it("routes closes through closeTradePosition and writes an executed log row", async () => {
    makeTrade(1, "close_for_profit");

    const r = await runAutoAdjustmentCycle();

    expect(r.executed).toBe(1);
    // shared helper called with the FRESH trade and a labeled exit reason
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy.mock.calls[0][0].id).toBe(1);
    expect(closeSpy.mock.calls[0][2]).toMatch(/profit target/i);

    // an "executed" audit row was persisted for this trade, carrying realized P&L
    const executedRows = state.insertedRows.filter((row) => row.decision === "executed");
    expect(executedRows).toHaveLength(1);
    expect(executedRows[0]).toMatchObject({ kind: "adjust", decision: "executed", tradeId: 1 });

    const dec = r.decisions.find((d) => d.decision === "executed");
    expect(dec?.realizedPnl).toBe(123);
  });

  it("skips (does not close) a trade that closed between snapshot and action", async () => {
    makeTrade(1, "close_for_profit");
    // fresh re-read shows it already closed
    state.freshById[1] = { id: 1, symbol: "SYM1", strategy: "iron_condor", status: "closed", ravishScore: 70 };

    const r = await runAutoAdjustmentCycle();

    expect(closeSpy).not.toHaveBeenCalled();
    expect(r.executed).toBe(0);
    expect(r.skipped).toBe(1);
    const skipped = r.decisions.find((d) => d.decision === "skipped");
    expect(skipped?.reason).toMatch(/no longer open/i);
  });
});

describe("runAutoAdjustmentCycle — kill switch halts mid-cycle", () => {
  it("re-reads the gate before each action and stops when disarmed mid-cycle", async () => {
    makeTrade(1, "close_for_profit");
    makeTrade(2, "close_for_profit");
    makeTrade(3, "close_for_profit");

    // After the FIRST close, flip the master kill switch off. The per-action live
    // re-read should then halt the loop before trades 2 and 3 are touched.
    closeSpy.mockImplementation(async (trade: MockTrade) => {
      state.settings.autoExecuteEnabled = false;
      return { trade: { ...trade, status: "closed" }, exitReason: "test", realizedPnl: 50, realizedPnlPercent: 5 };
    });

    const r = await runAutoAdjustmentCycle();

    expect(closeSpy).toHaveBeenCalledTimes(1); // only trade 1 closed
    expect(r.executed).toBe(1);
    // a blocked record marks the mid-cycle halt
    const blocked = r.decisions.find((d) => d.decision === "blocked");
    expect(blocked).toBeTruthy();
    expect(blocked?.reason).toMatch(/[Mm]aster/);
  });
});

describe("runAutoAdjustmentCycle — single-flight", () => {
  it("rejects a concurrent invocation with no double-close", async () => {
    makeTrade(1, "close_for_profit");

    // Fire two cycles without awaiting in between; the second must see the
    // in-flight flag and bail out immediately.
    const [a, b] = await Promise.all([runAutoAdjustmentCycle(), runAutoAdjustmentCycle()]);

    const blockedRun = [a, b].find((x) => x.blocked && /already running/i.test(x.blockReason ?? ""));
    const realRun = [a, b].find((x) => !x.blocked);
    expect(blockedRun).toBeTruthy();
    expect(realRun).toBeTruthy();

    // The single real run closed trade 1 exactly once — no double-spend.
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(realRun?.executed).toBe(1);
  });
});

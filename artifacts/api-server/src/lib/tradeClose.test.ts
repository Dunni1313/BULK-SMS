// Task #33 — direct coverage for the shared close helper `closeTradePosition`.
//
// This helper is the SINGLE exit path shared by the manual "close trade" button
// (DELETE /trades/:id) and the automated de-risk loop. A regression here silently
// corrupts realized P&L and the trade journal for EVERY exit, so its three
// responsibilities each get their own test:
//   1. an explicit exitReasonOverride is used verbatim, and the trade is marked
//      closed with realized P&L + percent taken from the current Greeks
//   2. with no override, the exit reason is derived correctly from the
//      stop-loss / 75%-profit-target / manual rules
//   3. the journal entry carries the right mood ("confident" win / "cautious"
//      loss) and a win/loss tag
//
// The DB and serverState are mocked at the module boundary so no live Postgres is
// needed; `computeStopLoss` (pure math) is kept real so the threshold logic under
// test is the genuine production rule.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Sentinel "columns" so a mocked `eq` can be introspected ──────────────────
const COL = { id: "id_col", userId: "userId_col" } as const;
const TEST_USER_ID = "test-legacy-owner-id";

interface MockTrade {
  id: number;
  symbol: string;
  strategy: string;
  status: string;
  credit: number;
  maxProfit: number;
  maxLoss: number;
  ev: number;
  pop: number;
  ravishScore: number;
  legs: unknown;
}

// ─── Mutable mock state, reset before each test ───────────────────────────────
const state: {
  settings: { stopLossMultiplier: number; profitTarget75: number };
  greeks: { unrealizedPnl: number; unrealizedPnlPercent: number };
  tradeById: Record<number, MockTrade>;
  updatedRows: Array<{ id: number; set: Record<string, unknown> }>;
  journalRows: Array<Record<string, unknown>>;
} = {
  settings: { stopLossMultiplier: 2, profitTarget75: 75 },
  greeks: { unrealizedPnl: 0, unrealizedPnlPercent: 0 },
  tradeById: {},
  updatedRows: [],
  journalRows: [],
};

// ─── drizzle-orm: keep everything real except eq/and, which we make inspectable ─
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown) => ({ __col: col, __val: val }),
    and: (...conds: Array<{ __col: unknown; __val: unknown }>) => ({ __and: conds }),
  };
});

// ─── @workspace/db: a hand-rolled query builder over the mock state ───────────
vi.mock("@workspace/db", () => {
  const tradesTable = COL;
  const journalEntriesTable = {};
  const db = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: (cond: { __and: Array<{ __col: unknown; __val: unknown }> }) => ({
          returning: async () => {
            const idCond = cond.__and.find((c) => c.__col === tradesTable.id);
            const id = idCond?.__val as number;
            state.updatedRows.push({ id, set: values });
            return [{ ...state.tradeById[id], ...values }];
          },
        }),
      }),
    }),
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        state.journalRows.push(row);
      },
    }),
  };
  return { db, tradesTable, journalEntriesTable };
});

vi.mock("./serverState.js", () => ({
  getSettingsRow: vi.fn(async () => state.settings),
  computeTradeGreeks: vi.fn(() => ({
    delta: 0,
    gamma: 0,
    theta: 0,
    vega: 0,
    costToClose: 0,
    currentValue: 0,
    unrealizedPnl: state.greeks.unrealizedPnl,
    unrealizedPnlPercent: state.greeks.unrealizedPnlPercent,
  })),
}));

// Import AFTER the mocks are registered.
const { closeTradePosition } = await import("./tradeClose.js");

function makeTrade(overrides: Partial<MockTrade> = {}): MockTrade {
  const t: MockTrade = {
    id: 1,
    symbol: "SPY",
    strategy: "iron_condor",
    status: "open",
    credit: 200,
    maxProfit: 200,
    maxLoss: 800,
    ev: 50,
    pop: 0.7,
    ravishScore: 70,
    legs: [],
    ...overrides,
  };
  state.tradeById[t.id] = t;
  return t;
}

beforeEach(() => {
  state.settings = { stopLossMultiplier: 2, profitTarget75: 75 };
  state.greeks = { unrealizedPnl: 0, unrealizedPnlPercent: 0 };
  state.tradeById = {};
  state.updatedRows = [];
  state.journalRows = [];
});

describe("closeTradePosition — explicit exit reason override", () => {
  it("uses the override verbatim and marks the trade closed with realized P&L from current Greeks", async () => {
    const trade = makeTrade();
    state.greeks = { unrealizedPnl: 137.5, unrealizedPnlPercent: 68.75 };

    const result = await closeTradePosition(
      trade as never,
      TEST_USER_ID,
      "Auto de-risk: profit target reached",
    );

    // Override wins even though the Greeks would otherwise derive a different reason.
    expect(result.exitReason).toBe("Auto de-risk: profit target reached");
    expect(result.realizedPnl).toBe(137.5);
    expect(result.realizedPnlPercent).toBe(68.75);

    // The trade row was flipped to closed with the same realized numbers + a close date.
    expect(state.updatedRows).toHaveLength(1);
    const set = state.updatedRows[0].set;
    expect(set.status).toBe("closed");
    expect(set.exitReason).toBe("Auto de-risk: profit target reached");
    expect(set.currentPnl).toBe(137.5);
    expect(set.currentPnlPercent).toBe(68.75);
    expect(set.closeDate).toBeInstanceOf(Date);
    expect(result.trade.status).toBe("closed");
  });
});

describe("closeTradePosition — derived exit reason (no override)", () => {
  it('derives "Stop loss hit" when unrealized P&L breaches the stop', async () => {
    // credit 200 × stopLossMultiplier 2 = stop at -$400 (within maxLoss 800).
    const trade = makeTrade();
    state.greeks = { unrealizedPnl: -450, unrealizedPnlPercent: -225 };

    const result = await closeTradePosition(trade as never, TEST_USER_ID);

    expect(result.exitReason).toBe("Stop loss hit");
  });

  it('derives "Profit target reached (75%)" past the 75% target', async () => {
    // maxProfit 200 × 75% = $150 target.
    const trade = makeTrade();
    state.greeks = { unrealizedPnl: 160, unrealizedPnlPercent: 80 };

    const result = await closeTradePosition(trade as never, TEST_USER_ID);

    expect(result.exitReason).toBe("Profit target reached (75%)");
  });

  it('derives "Manual exit" when between the stop and the profit target', async () => {
    const trade = makeTrade();
    state.greeks = { unrealizedPnl: 50, unrealizedPnlPercent: 25 };

    const result = await closeTradePosition(trade as never, TEST_USER_ID);

    expect(result.exitReason).toBe("Manual exit");
  });
});

describe("closeTradePosition — journal entry mood + tags", () => {
  it('writes a "confident" mood and a "win" tag on a winning close', async () => {
    const trade = makeTrade();
    state.greeks = { unrealizedPnl: 160, unrealizedPnlPercent: 80 };

    await closeTradePosition(trade as never, TEST_USER_ID);

    expect(state.journalRows).toHaveLength(1);
    const entry = state.journalRows[0];
    expect(entry.mood).toBe("confident");
    expect(entry.tags).toEqual(["iron_condor", "win"]);
    expect(entry.realizedPnl).toBe(160);
    expect(entry.tradeId).toBe(1);
  });

  it('writes a "cautious" mood and a "loss" tag on a losing close', async () => {
    const trade = makeTrade();
    state.greeks = { unrealizedPnl: -450, unrealizedPnlPercent: -225 };

    await closeTradePosition(trade as never, TEST_USER_ID);

    expect(state.journalRows).toHaveLength(1);
    const entry = state.journalRows[0];
    expect(entry.mood).toBe("cautious");
    expect(entry.tags).toEqual(["iron_condor", "loss"]);
    expect(entry.realizedPnl).toBe(-450);
  });
});

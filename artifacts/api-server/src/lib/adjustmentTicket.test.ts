// Coverage for the roll/convert ticket BUILDER (the structural-adjustment path in
// execution.ts). phase8.adjustment.test.ts proves the deterministic
// signal/selection math; this file proves the ticket-assembly + submit guards that
// were previously only verified by hand via curl:
//   1. resolveAdjustmentTarget maps action+strategy correctly (IC->IF, IF->IC, roll
//      keeps strategy)
//   2. buildAdjustmentTicket rejects a position whose recommendation is NOT a
//      roll/convert (409) and a non-open source (409)
//   3. the source position is EXCLUDED from openRiskDollars so a roll isn't
//      double-counted against the portfolio cap
//   4. submitAdjustmentOrder enforces the confirm-required guard (400) and the
//      manual-mode submit block (409)
//
// The DB, settings, per-trade evaluation, market snapshot/quote builders, event
// risk, and the close helper are mocked at the module boundary so the builder's
// control flow runs deterministically without a live Postgres connection. The real
// pre-trade risk math (validatePreTrade + risk.ts) is kept so portfolio-risk
// numbers on the ticket are genuinely computed.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mutable mock state, reset before each test ───────────────────────────────
interface MockLeg {
  side: "buy" | "sell";
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  openPrice: number;
  quantity: number;
}
interface MockTrade {
  id: number;
  symbol: string;
  strategy: string;
  status: string;
  legs: MockLeg[];
  maxLoss: number;
  entryIv: number | null;
}
interface MockAdj {
  action: string;
  actionLabel: string;
  rationale: string;
}

const state: {
  settings: Record<string, unknown>;
  accountValue: number;
  tradeById: Record<number, MockTrade | undefined>;
  committedTrades: MockTrade[];
  adjById: Record<number, MockAdj>;
} = {
  settings: {},
  accountValue: 100000,
  tradeById: {},
  committedTrades: [],
  adjById: {},
};

// drizzle-orm: keep everything real except eq/inArray, which we make inspectable so
// the mock db can tell the id lookup from the portfolio-risk status query apart.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (_col: unknown, val: unknown) => ({ __op: "eq", val }),
    inArray: (_col: unknown, vals: unknown) => ({ __op: "inArray", vals }),
    and: (...conds: Array<{ __op: string; val?: unknown; vals?: unknown }>) => ({
      __op: "and",
      conds,
    }),
  };
});

vi.mock("@workspace/db", () => {
  const db = {
    select: () => ({
      from: () => ({
        where: (cond: {
          __op: string;
          val?: unknown;
          conds?: Array<{ __op: string; val?: unknown }>;
        }) => {
          if (cond.__op === "eq") {
            const t = state.tradeById[cond.val as number];
            return Promise.resolve(t ? [t] : []);
          }
          if (cond.__op === "inArray") return Promise.resolve(state.committedTrades);
          if (cond.__op === "and") {
            // Sprint 7 wraps every lookup as and(<primary condition>, eq(userId)) —
            // the primary condition (inArray membership, or an id eq) still fully
            // determines which fixture to return; userId scoping is covered by the
            // dedicated tenant-isolation suite, not this ticket-assembly test.
            const inArrayCond = cond.conds?.find((c) => c.__op === "inArray");
            if (inArrayCond) return Promise.resolve(state.committedTrades);
            const idCond = cond.conds?.find((c) => c.__op === "eq");
            if (idCond) {
              const t = state.tradeById[idCond.val as number];
              return Promise.resolve(t ? [t] : []);
            }
          }
          return Promise.resolve([]);
        },
      }),
    }),
    insert: () => ({ values: async () => {} }),
    delete: () => ({ where: async () => {} }),
  };
  return {
    db,
    tradesTable: {},
    journalEntriesTable: {},
    scannerResultsTable: {},
    autoExecutionLogTable: {},
  };
});

vi.mock("./serverState.js", () => ({
  getSettingsRow: vi.fn(async () => state.settings),
  getAccountValue: vi.fn(async () => state.accountValue),
  computeTradeGreeks: vi.fn(() => ({
    delta: 0,
    gamma: 0,
    theta: 0,
    vega: 0,
    costToClose: 0,
    currentValue: 0,
    unrealizedPnl: 0,
    unrealizedPnlPercent: 0,
  })),
}));

// Keep the real adjustment module (so AdjustmentAction etc. stay genuine) but drive
// each trade's recommendation deterministically.
vi.mock("./adjustment.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./adjustment.js")>();
  return {
    ...actual,
    evaluateTradeAdjustment: vi.fn((t: MockTrade) => state.adjById[t.id]),
  };
});

// Deterministic snapshot + quote builders. Each builder echoes the strategy it is
// asked for so the assembled ticket reflects the resolved target strategy.
function makeQuote(strategy: string) {
  return {
    symbol: "SPY",
    strategy,
    expiration: "2026-08-01",
    daysToExpiry: 45,
    shortPutStrike: 500,
    shortCallStrike: 600,
    longPutStrike: 490,
    longCallStrike: 610,
    credit: 200,
    maxProfit: 200,
    maxLoss: 800,
    pop: 75,
    ev: 50,
    theta: 5,
    vega: -10,
    ivRank: 40,
    liquidityScore: 80,
    returnOnCapital: 25,
    ravishScore: 70,
    ravishTier: "high_conviction",
    legs: [
      { side: "sell", optionType: "put", strike: 500, expiration: "2026-08-01", openPrice: 3, quantity: 1 },
      { side: "buy", optionType: "put", strike: 490, expiration: "2026-08-01", openPrice: 2, quantity: 1 },
      { side: "sell", optionType: "call", strike: 600, expiration: "2026-08-01", openPrice: 3, quantity: 1 },
      { side: "buy", optionType: "call", strike: 610, expiration: "2026-08-01", openPrice: 2, quantity: 1 },
    ],
    rejected: false,
    rejectReason: null,
    eventRiskLevel: "low",
    eventRiskPenalty: 0,
  };
}

vi.mock("./optionsMath.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./optionsMath.js")>();
  return {
    ...actual,
    getSnapshot: vi.fn(() => ({ symbol: "SPY", price: 550 })),
    buildIronCondor: vi.fn(() => makeQuote("iron_condor")),
    buildIronFly: vi.fn(() => makeQuote("iron_fly")),
    buildCalendar: vi.fn(() => makeQuote("calendar_spread")),
    buildEarnings: vi.fn(() => makeQuote("earnings")),
  };
});

vi.mock("./eventRisk.js", () => ({
  getEventRiskForSymbol: vi.fn(() => ({ blockShortPremium: false, level: "low", warnings: [] })),
}));

// Close helper is only reached after a successful open; none of these tests get
// that far, but stub it so nothing touches a real DB if the path changes.
const closeSpy = vi.fn(async (trade: MockTrade, _userId: string, _reason?: string) => ({
  trade: { ...trade, status: "closed" },
  exitReason: "test",
  realizedPnl: 0,
  realizedPnlPercent: 0,
}));
vi.mock("./tradeClose.js", () => ({
  closeTradePosition: (...args: [MockTrade, string, string?]) => closeSpy(...args),
}));

// Import AFTER the mocks are registered.
const { resolveAdjustmentTarget, buildAdjustmentTicket, submitAdjustmentOrder, TicketError } =
  await import("./execution.js");

const TEST_USER_ID = "test-legacy-owner-id";

const baseSettings = {
  executionMode: "semi_auto",
  maxRiskPerTrade: 5,
  maxPortfolioRisk: 50,
  stopLossMultiplier: 2,
  profitTarget50: 50,
  profitTarget75: 75,
  profitTarget90: 90,
  eventRiskEnabled: true,
  eventRiskBlockEarningsShortPremium: true,
};

function makeTrade(overrides: Partial<MockTrade> = {}): MockTrade {
  return {
    id: 1,
    symbol: "SPY",
    strategy: "iron_condor",
    status: "open",
    legs: [
      { side: "sell", optionType: "put", strike: 500, expiration: "2026-07-01", openPrice: 3, quantity: 1 },
      { side: "buy", optionType: "put", strike: 490, expiration: "2026-07-01", openPrice: 2, quantity: 1 },
      { side: "sell", optionType: "call", strike: 600, expiration: "2026-07-01", openPrice: 3, quantity: 1 },
      { side: "buy", optionType: "call", strike: 610, expiration: "2026-07-01", openPrice: 2, quantity: 1 },
    ],
    maxLoss: 800,
    entryIv: 0.2,
    ...overrides,
  };
}

function rollAdj(overrides: Partial<MockAdj> = {}): MockAdj {
  return {
    action: "roll_threatened",
    actionLabel: "Roll the threatened side",
    rationale: "Short strike is under pressure with time to repair.",
    ...overrides,
  };
}

beforeEach(() => {
  state.settings = { ...baseSettings };
  state.accountValue = 100000;
  state.tradeById = {};
  state.committedTrades = [];
  state.adjById = {};
  closeSpy.mockClear();
});

describe("resolveAdjustmentTarget", () => {
  it("converts an Iron Condor into an Iron Fly", () => {
    expect(resolveAdjustmentTarget("convert", "iron_condor")).toEqual({
      strategy: "iron_fly",
      kind: "convert",
    });
  });

  it("converts an Iron Fly back into an Iron Condor", () => {
    expect(resolveAdjustmentTarget("convert", "iron_fly")).toEqual({
      strategy: "iron_condor",
      kind: "convert",
    });
  });

  it("keeps the same strategy when rolling the threatened side", () => {
    expect(resolveAdjustmentTarget("roll_threatened", "iron_condor")).toEqual({
      strategy: "iron_condor",
      kind: "roll",
    });
  });

  it("keeps the same strategy when rolling the untested side", () => {
    expect(resolveAdjustmentTarget("roll_untested", "calendar_spread")).toEqual({
      strategy: "calendar_spread",
      kind: "roll",
    });
  });

  it("tightens any non-fly premium structure into an Iron Fly on convert", () => {
    expect(resolveAdjustmentTarget("convert", "calendar_spread")).toEqual({
      strategy: "iron_fly",
      kind: "convert",
    });
  });
});

describe("buildAdjustmentTicket — rejection paths", () => {
  it("rejects a position whose recommendation is not a roll or convert", async () => {
    state.tradeById[1] = makeTrade();
    state.adjById[1] = { action: "hold", actionLabel: "Hold", rationale: "Healthy." };

    await expect(buildAdjustmentTicket({ tradeId: 1 }, TEST_USER_ID)).rejects.toMatchObject({
      status: 409,
    });
    await expect(buildAdjustmentTicket({ tradeId: 1 }, TEST_USER_ID)).rejects.toThrow(/not a roll or convert/i);
  });

  it("rejects a closed (non-open) source position", async () => {
    state.tradeById[1] = makeTrade({ status: "closed" });
    state.adjById[1] = rollAdj();

    await expect(buildAdjustmentTicket({ tradeId: 1 }, TEST_USER_ID)).rejects.toMatchObject({ status: 409 });
    await expect(buildAdjustmentTicket({ tradeId: 1 }, TEST_USER_ID)).rejects.toThrow(/Only open positions/i);
  });

  it("rejects when the trade does not exist (404)", async () => {
    await expect(buildAdjustmentTicket({ tradeId: 999 }, TEST_USER_ID)).rejects.toMatchObject({ status: 404 });
  });
});

describe("buildAdjustmentTicket — roll context + risk exclusion", () => {
  it("builds a roll ticket carrying the adjustment context for the source position", async () => {
    state.tradeById[1] = makeTrade();
    state.adjById[1] = rollAdj();
    state.committedTrades = [state.tradeById[1]!];

    const ticket = await buildAdjustmentTicket({ tradeId: 1 }, TEST_USER_ID);

    expect(ticket.adjustment).toMatchObject({
      sourceTradeId: 1,
      action: "roll_threatened",
      kind: "roll",
      fromStrategy: "iron_condor",
      toStrategy: "iron_condor",
    });
    expect(ticket.strategy).toBe("iron_condor");
  });

  it("excludes the source position from openRiskDollars so a roll isn't double-counted", async () => {
    const source = makeTrade({ id: 1, maxLoss: 5000 });
    const other2 = makeTrade({ id: 2, maxLoss: 3000 });
    const other3 = makeTrade({ id: 3, maxLoss: 2000 });
    state.tradeById[1] = source;
    state.adjById[1] = rollAdj();
    // The portfolio-risk query returns ALL committed trades, INCLUDING the source.
    state.committedTrades = [source, other2, other3];
    state.accountValue = 100000;

    const ticket = await buildAdjustmentTicket({ tradeId: 1 }, TEST_USER_ID);

    // Existing open risk excluding the source = 3000 + 2000 = 5000 → 5% of 100k.
    // If the source's 5000 were (incorrectly) counted, this would be 10%.
    expect(ticket.portfolioRiskBeforePct).toBeCloseTo(5, 5);
    expect(ticket.validation.portfolioRiskBeforePct).toBeCloseTo(5, 5);
  });
});

describe("submitAdjustmentOrder — guards", () => {
  it("requires explicit confirmation (rejects confirm:false before any lookup)", async () => {
    // No trade configured — proves the confirm guard short-circuits first.
    await expect(
      submitAdjustmentOrder({ tradeId: 1, confirm: false }, TEST_USER_ID),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      submitAdjustmentOrder({ tradeId: 1, confirm: false }, TEST_USER_ID),
    ).rejects.toThrow(/confirmation is required/i);
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it("blocks submit in manual mode (scanner-only)", async () => {
    state.settings = { ...baseSettings, executionMode: "manual" };
    state.tradeById[1] = makeTrade();
    state.adjById[1] = rollAdj();
    state.committedTrades = [state.tradeById[1]!];

    await expect(
      submitAdjustmentOrder({ tradeId: 1, confirm: true }, TEST_USER_ID),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      submitAdjustmentOrder({ tradeId: 1, confirm: true }, TEST_USER_ID),
    ).rejects.toThrow(/Manual mode is scanner-only/i);
    // The source position is never closed when submission is blocked.
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it("surfaces a TicketError instance with a status code", async () => {
    state.settings = { ...baseSettings, executionMode: "manual" };
    state.tradeById[1] = makeTrade();
    state.adjById[1] = rollAdj();
    state.committedTrades = [state.tradeById[1]!];

    await expect(submitAdjustmentOrder({ tradeId: 1, confirm: true }, TEST_USER_ID)).rejects.toBeInstanceOf(
      TicketError,
    );
  });
});

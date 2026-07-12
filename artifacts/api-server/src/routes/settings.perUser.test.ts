// Sprint 5 — settings singleton -> per-user regression test (approved Phase 1
// plan §8.3: "explicit test that two users' settings (including their
// respective automation kill switches) are fully independent").
//
// No real auth exists yet (Sprint 6), so every route currently resolves the
// calling user via getLegacyOwnerUserId() (see lib/legacyOwner.ts). This test
// simulates two different callers by controlling that resolution directly,
// proving the underlying userId-scoped queries genuinely isolate — exactly
// what Sprint 6/7 will rely on once real per-request auth replaces the
// legacy-owner stand-in. The PATCH case directly guards against the bug this
// sprint fixed: the old update had no WHERE clause at all.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// ─── In-memory settings store, keyed by userId ─────────────────────────────
const store = new Map<string, Record<string, unknown>>();
let nextId = 1;

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown) => ({ __col: col, __val: val }),
  };
});

// Mirrors the .default(...) values in lib/db/src/schema/settings.ts — a real
// Postgres insert applies these even when the caller's .values({...}) omits
// them; this hand-rolled mock has to do the same so a created row is
// shaped like a real one (in particular, the automation kill switches
// default to false, not undefined).
const SCHEMA_DEFAULTS = {
  autoExecuteEnabled: false,
  autoMaxTradesPerDay: 5,
  autoMaxConcurrentPositions: 10,
  autoMinRavishScore: 68.0,
  autoMaxDailyLossPct: 5.0,
  autoQuantityPerTrade: 1,
  adjDeltaDriftTrigger: 0.3,
  adjPopDropTrigger: 15.0,
  adjShortStrikeProximityPct: 2.0,
  adjIvExpansionTrigger: 25.0,
  adjDteTrigger: 21,
  autoAdjustEnabled: false,
  eventRiskEnabled: true,
  eventRiskBlockEarningsShortPremium: true,
  eventRiskAutoBlockHigh: true,
  fundamentalsProvider: "simulated",
  fundamentalsConnected: false,
  fundamentalsApiKey: null,
  fundamentalsStalenessHours: 24,
  fundamentalsAutoRefresh: true,
};

vi.mock("@workspace/db", () => {
  const settingsTable = { userId: "user_id_col" };
  const db = {
    select: () => ({
      from: () => ({
        where: (cond: { __val: string }) => ({
          limit: async () => {
            const row = store.get(cond.__val);
            return row ? [row] : [];
          },
        }),
      }),
    }),
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        returning: async () => {
          const created = { id: nextId++, ...SCHEMA_DEFAULTS, updatedAt: new Date(), ...row };
          store.set(row.userId as string, created);
          return [created];
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: (cond: { __val: string }) => ({
          returning: async () => {
            const existing = store.get(cond.__val) ?? {};
            const updated = { ...existing, ...values, updatedAt: new Date() };
            store.set(cond.__val, updated);
            return [updated];
          },
        }),
      }),
    }),
  };
  // Phase 1, Sprint 10 — routes/settings.ts now writes a platform_audit_log
  // row after every successful PATCH. This test only cares about per-user
  // settings isolation, so the write is stubbed to a no-op.
  const recordAuditEvent = async () => {};
  return { db, settingsTable, recordAuditEvent };
});

let currentUserId = "user-a";
vi.mock("../lib/legacyOwner.js", () => ({
  getLegacyOwnerUserId: async () => currentUserId,
}));

import settingsRouter, { getOrCreateSettings } from "./settings.js";

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
  };
};

function getHandler(
  path: string,
  method: "get" | "patch",
): (req: Request, res: Response) => Promise<void> {
  const stack = (settingsRouter as unknown as { stack: RouteLayer[] }).stack;
  const layer = stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`${method.toUpperCase()} ${path} route not registered`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

interface FakeRes {
  statusCode: number;
  body: unknown;
}

function fakeRes(): Response & FakeRes {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res as unknown as Response & FakeRes;
}

beforeEach(() => {
  store.clear();
  nextId = 1;
  currentUserId = "user-a";
});

describe("settings: per-user isolation (Sprint 5 regression)", () => {
  it("getOrCreateSettings creates independent rows for different users", async () => {
    const a = await getOrCreateSettings("user-a");
    const b = await getOrCreateSettings("user-b");
    expect(a.userId).toBe("user-a");
    expect(b.userId).toBe("user-b");
    expect(a.id).not.toBe(b.id);
  });

  it("GET /settings returns each caller's own row, not the other's", async () => {
    const a = await getOrCreateSettings("user-a");
    await getOrCreateSettings("user-b");
    // Give user A a distinguishable value directly in the store, independent
    // of the route/PATCH path under test elsewhere in this file.
    store.set("user-a", { ...a, executionMode: "semi_auto" });

    const get = getHandler("/settings", "get");

    currentUserId = "user-a";
    const resA = fakeRes();
    await get({} as Request, resA);

    currentUserId = "user-b";
    const resB = fakeRes();
    await get({} as Request, resB);

    expect((resA.body as { executionMode: string }).executionMode).toBe("semi_auto");
    expect((resB.body as { executionMode: string }).executionMode).toBe("manual");
  });

  it("PATCH /settings only updates the calling user's row — including the automation kill switches", async () => {
    await getOrCreateSettings("user-a");
    await getOrCreateSettings("user-b");
    const get = getHandler("/settings", "get");
    const patch = getHandler("/settings", "patch");

    // User A arms full-auto with both kill switches on.
    currentUserId = "user-a";
    await patch(
      {
        body: { executionMode: "full_auto", autoExecuteEnabled: true, autoAdjustEnabled: true },
      } as Request,
      fakeRes(),
    );

    // User B never touched their settings — still fully disarmed defaults.
    currentUserId = "user-b";
    const resB = fakeRes();
    await get({} as Request, resB);
    const bodyB = resB.body as {
      executionMode: string;
      autoExecuteEnabled: boolean;
      autoAdjustEnabled: boolean;
    };
    expect(bodyB.executionMode).toBe("manual");
    expect(bodyB.autoExecuteEnabled).toBe(false);
    expect(bodyB.autoAdjustEnabled).toBe(false);

    // User A's own row genuinely changed.
    currentUserId = "user-a";
    const resA = fakeRes();
    await get({} as Request, resA);
    const bodyA = resA.body as {
      executionMode: string;
      autoExecuteEnabled: boolean;
      autoAdjustEnabled: boolean;
    };
    expect(bodyA.executionMode).toBe("full_auto");
    expect(bodyA.autoExecuteEnabled).toBe(true);
    expect(bodyA.autoAdjustEnabled).toBe(true);
  });
});

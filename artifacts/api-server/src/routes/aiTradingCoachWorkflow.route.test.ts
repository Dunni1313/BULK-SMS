// v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow. Live route
// integration tests against a real app + real Postgres connection + the
// real Better-Auth instance (no auth mocking), using a fresh, isolated,
// genuinely signed-up user per test, mirroring
// routes/aiWorkspaces.route.test.ts's own sign-up/session-cookie pattern
// (Sprint 7) so this file's own rows are never at risk of colliding with
// another concurrently-running test file's own data.
//
// Proves: GET /ai-trading-coach/state upserts-on-read for a brand-new user
// (preferences default to beginner/beginnerMode=true, daily state defaults
// to empty completed/skipped arrays and a null noTradeReason) and bundles a
// real market clock status from the existing, unmodified
// lib/marketCalendar.ts; PATCH /ai-trading-coach/preferences and
// PATCH /ai-trading-coach/state both validate their inputs and persist
// correctly, scoped to the calling user only; and a second, independent
// user never sees the first user's state (tenant isolation).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  settingsTable,
  sessionsTable,
  accountsTable,
  aiTradingCoachPreferencesTable,
  aiTradingCoachDailyStateTable,
} from "@workspace/db";
import type { Server } from "node:http";

interface SignedUpUser {
  userId: string;
  cookie: string;
}

function getCookie(res: Response): string {
  const raw = res.headers.get("set-cookie");
  if (!raw) throw new Error("expected a Set-Cookie header");
  return raw.split(";")[0];
}

const seededUserIds: string[] = [];

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(aiTradingCoachDailyStateTable).where(eq(aiTradingCoachDailyStateTable.userId, userId));
  await db.delete(aiTradingCoachPreferencesTable).where(eq(aiTradingCoachPreferencesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  await db.delete(accountsTable).where(eq(accountsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("AI Trading Coach Workflow routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `ai-trading-coach-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "AI Trading Coach Test User" }),
    });
    if (!res.ok) throw new Error(`sign-up failed: ${res.status}`);
    const body = (await res.json()) as { user: { id: string } };
    seededUserIds.push(body.user.id);
    return { userId: body.user.id, cookie: getCookie(res) };
  }

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    for (const userId of seededUserIds) {
      await cleanupUser(userId);
    }
    server.close();
  });

  // ─── GET /ai-trading-coach/state ────────────────────────────────────────

  it("upserts honest defaults for a brand-new user", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-trading-coach/state`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.preferences.experienceLevel).toBe("beginner");
    expect(body.preferences.beginnerModeEnabled).toBe(true);
    expect(body.dailyState.completedStepIds).toEqual([]);
    expect(body.dailyState.skippedStepIds).toEqual([]);
    expect(body.dailyState.noTradeReason).toBeNull();
    expect(typeof body.tradingDate).toBe("string");
    expect(body.tradingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.marketClock).toBeTruthy();
    expect(typeof body.marketClock.isOpen).toBe("boolean");
    expect(["alpaca", "static_approximation"]).toContain(body.marketClock.source);
  });

  it("is idempotent — a second GET for the same user/day returns the same row, not a duplicate", async () => {
    const user = await signUp();
    const first = await (await fetch(`${baseUrl}/api/ai-trading-coach/state`, { headers: { cookie: user.cookie } })).json() as any;
    const second = await (await fetch(`${baseUrl}/api/ai-trading-coach/state`, { headers: { cookie: user.cookie } })).json() as any;
    expect(second.dailyState.id).toBe(first.dailyState.id);
    expect(second.preferences.id).toBe(first.preferences.id);
  });

  // ─── PATCH /ai-trading-coach/preferences ────────────────────────────────

  it("updates experienceLevel and beginnerModeEnabled", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-trading-coach/preferences`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ experienceLevel: "advanced", beginnerModeEnabled: false }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.experienceLevel).toBe("advanced");
    expect(body.beginnerModeEnabled).toBe(false);

    const reread = await (await fetch(`${baseUrl}/api/ai-trading-coach/state`, { headers: { cookie: user.cookie } })).json() as any;
    expect(reread.preferences.experienceLevel).toBe("advanced");
    expect(reread.preferences.beginnerModeEnabled).toBe(false);
  });

  it("rejects an invalid experienceLevel", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-trading-coach/preferences`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ experienceLevel: "expert" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a non-boolean beginnerModeEnabled", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-trading-coach/preferences`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ beginnerModeEnabled: "yes" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an empty patch body", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-trading-coach/preferences`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  // ─── PATCH /ai-trading-coach/state ──────────────────────────────────────

  it("updates completedStepIds/skippedStepIds/noTradeReason for today", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-trading-coach/state`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({
        completedStepIds: ["morning-brief", "market-scan"],
        skippedStepIds: ["trade-planning"],
        noTradeReason: "No qualifying setups today.",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.completedStepIds).toEqual(["morning-brief", "market-scan"]);
    expect(body.skippedStepIds).toEqual(["trade-planning"]);
    expect(body.noTradeReason).toBe("No qualifying setups today.");
  });

  it("accepts an explicit, valid tradingDate override", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-trading-coach/state`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ tradingDate: "2026-01-05", completedStepIds: ["morning-brief"] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.tradingDate).toBe("2026-01-05");
    expect(body.completedStepIds).toEqual(["morning-brief"]);
  });

  it("rejects a malformed tradingDate", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-trading-coach/state`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ tradingDate: "01/05/2026", completedStepIds: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a non-string-array completedStepIds", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-trading-coach/state`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ completedStepIds: [1, 2, 3] }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts noTradeReason: null to clear a previously-set reason", async () => {
    const user = await signUp();
    await fetch(`${baseUrl}/api/ai-trading-coach/state`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ noTradeReason: "Market closed today." }),
    });
    const res = await fetch(`${baseUrl}/api/ai-trading-coach/state`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ noTradeReason: null }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.noTradeReason).toBeNull();
  });

  it("rejects an empty patch body", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/ai-trading-coach/state`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  // ─── Tenant isolation ────────────────────────────────────────────────────

  it("never leaks one user's coach state/preferences to another", async () => {
    const userA = await signUp();
    const userB = await signUp();

    await fetch(`${baseUrl}/api/ai-trading-coach/preferences`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: userA.cookie },
      body: JSON.stringify({ experienceLevel: "institutional", beginnerModeEnabled: false }),
    });
    await fetch(`${baseUrl}/api/ai-trading-coach/state`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: userA.cookie },
      body: JSON.stringify({ completedStepIds: ["morning-brief", "market-scan", "research"] }),
    });

    const bState = (await (
      await fetch(`${baseUrl}/api/ai-trading-coach/state`, { headers: { cookie: userB.cookie } })
    ).json()) as any;

    expect(bState.preferences.experienceLevel).toBe("beginner");
    expect(bState.preferences.beginnerModeEnabled).toBe(true);
    expect(bState.dailyState.completedStepIds).toEqual([]);
  });
});

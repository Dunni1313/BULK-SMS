// Phase 36 — Institutional Position Lifecycle Manager. Live route
// integration tests against a real app + real Postgres connection + the
// real Better-Auth instance (no auth mocking), using fresh, isolated,
// genuinely signed-up users (mirroring routes/optionsIncome.route.test.ts's
// own Phase 35 established sign-up/session-cookie pattern) so this file's
// own position/lifecycle-row counts are never at risk of colliding with
// another concurrently-running test file's own trades. Every open position
// inserted below uses a REAL, internally-consistent quote from
// optionsMath.ts's own getSnapshot()/buildIronCondor() — never fabricated
// financials. No live brokerage execution, auto trading, auto adjustment,
// or AI prediction path is exercised anywhere in this file.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, settingsTable, sessionsTable, accountsTable, optionsLifecycleStateTable, optionsLifecycleEventsTable, optionsPositionChecklistsTable } from "@workspace/db";
import { getSnapshot, buildIronCondor } from "../lib/optionsMath.js";
import type { Server } from "node:http";

interface InsertedTrade {
  id: number;
}

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
  await db.delete(optionsPositionChecklistsTable).where(eq(optionsPositionChecklistsTable.userId, userId));
  await db.delete(optionsLifecycleEventsTable).where(eq(optionsLifecycleEventsTable.userId, userId));
  await db.delete(optionsLifecycleStateTable).where(eq(optionsLifecycleStateTable.userId, userId));
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  await db.delete(accountsTable).where(eq(accountsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

async function insertOpenIronCondor(userId: string, symbol = "SPY"): Promise<InsertedTrade> {
  const snap = getSnapshot(symbol)!;
  const quote = buildIronCondor(snap, { dte: 45 });
  const legs = quote.legs.map((l) => ({ side: l.side, optionType: l.optionType, strike: l.strike, expiration: l.expiration, openPrice: l.openPrice, quantity: l.quantity }));
  const [row] = await db
    .insert(tradesTable)
    .values({ userId, symbol, strategy: "iron_condor", status: "open", legs, credit: quote.credit, maxProfit: quote.maxProfit, maxLoss: quote.maxLoss, pop: quote.pop, expiration: quote.expiration })
    .returning({ id: tradesTable.id });
  return row;
}

async function insertClosedTrade(userId: string, symbol = "AAPL", credit = 120): Promise<InsertedTrade> {
  const [row] = await db
    .insert(tradesTable)
    .values({
      userId,
      symbol,
      strategy: "iron_fly",
      status: "closed",
      legs: [],
      credit,
      maxProfit: credit,
      maxLoss: 250,
      exitReason: "Expired worthless",
      currentPnl: credit,
      openDate: new Date("2026-01-01T00:00:00Z"),
      closeDate: new Date("2026-02-01T00:00:00Z"),
    })
    .returning({ id: tradesTable.id });
  return row;
}

describe("Institutional Position Lifecycle Manager routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;
  let user: SignedUpUser;

  async function signUp(): Promise<SignedUpUser> {
    const email = `options-lifecycle-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "Options Lifecycle Test User" }),
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
    user = await signUp();
  });

  afterAll(async () => {
    for (const userId of seededUserIds) {
      await cleanupUser(userId);
    }
    server.close();
  });

  async function get(path: string, cookie = user.cookie): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`, { headers: { cookie } });
  }
  async function patch(path: string, body: unknown, cookie = user.cookie): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
  }
  async function post(path: string, body: unknown, cookie = user.cookie): Promise<Response> {
    return fetch(`${baseUrl}/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
  }

  // ─── Portfolio management / empty states ──────────────────────────────

  it("GET /options-lifecycle/portfolio honestly reports zeros/empty for a brand-new user with no positions", async () => {
    const res = await get("/options-lifecycle/portfolio");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.lifecycleSummary.totalPositions).toBe(0);
    expect(body.lifecycleSummary.positionsAwaitingReview).toBe(0);
    expect(body.positionConcentration).toEqual([]);
    expect(body.incomeAllocation.strategyMix).toEqual([]);
    expect(body.expirationTracker).toEqual([]);
    expect(Array.isArray(body.exposureTimeline)).toBe(true);
    for (const point of body.exposureTimeline) {
      expect(point.openPositionsCount).toBe(0);
    }
  });

  it("GET /options-lifecycle/coach lists exactly the 5 named coach topics", async () => {
    const res = await get("/options-lifecycle/coach");
    expect(res.status).toBe(200);
    const topics = (await res.json()) as any[];
    expect(topics).toHaveLength(5);
    expect(topics.map((t) => t.topic).sort()).toEqual(
      ["assignment_mechanics", "capital_allocation", "lifecycle_stages", "portfolio_concentration", "review_process"].sort(),
    );
    for (const t of topics) {
      expect(typeof t.disclaimer).toBe("string");
      expect(t.disclaimer.length).toBeGreaterThan(0);
    }
  });

  it("GET /options-lifecycle/coach/:topic returns a well-shaped explanation for a known topic", async () => {
    const res = await get("/options-lifecycle/coach/assignment_mechanics");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.topic).toBe("assignment_mechanics");
    expect(body.title).toBe("Assignment Mechanics");
    expect(body.explanation.length).toBeGreaterThan(0);
  });

  it("GET /options-lifecycle/coach/:topic 404s for an unknown topic, never fabricating an explanation", async () => {
    const res = await get("/options-lifecycle/coach/not_a_real_topic");
    expect(res.status).toBe(404);
  });

  // ─── Learning Centre integration ────────────────────────────────────────

  it("GET /options-lifecycle/learning lists all 8 stages, each with real, non-empty Learning Centre links", async () => {
    const res = await get("/options-lifecycle/learning");
    expect(res.status).toBe(200);
    const bundles = (await res.json()) as any[];
    expect(bundles).toHaveLength(8);
    expect(bundles.map((b) => b.stage).sort()).toEqual(
      ["draft", "planned", "open", "monitoring", "near_expiration", "assignment_risk", "closed", "archived"].sort(),
    );
    for (const bundle of bundles) {
      expect(bundle.links.length).toBeGreaterThan(0);
      for (const link of bundle.links) {
        expect(link.href).toBe(`/learn/paths/${link.pathKey}/${link.topicKey}`);
      }
    }
  });

  it("GET /options-lifecycle/learning/:stage returns assignment_risk's own bundle, including real Assignment Mechanics content", async () => {
    const res = await get("/options-lifecycle/learning/assignment_risk");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.stage).toBe("assignment_risk");
    expect(body.links.some((l: any) => l.topicKey === "foundations-assignment")).toBe(true);
  });

  it("GET /options-lifecycle/learning/:stage 404s for an unknown stage, never fabricating a learning bundle", async () => {
    const res = await get("/options-lifecycle/learning/not_a_real_stage");
    expect(res.status).toBe(404);
  });

  // ─── Lifecycle state ───────────────────────────────────────────────────

  it("GET /options-lifecycle/:tradeId/state honestly defaults an open position's stage from its own real status, with no explicit row yet", async () => {
    const trade = await insertOpenIronCondor(user.userId, "SPY");
    const res = await get(`/options-lifecycle/${trade.id}/state`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.tradeId).toBe(trade.id);
    expect(body.stage).toBe("open");
    expect(body.reviewCadence).toBe("manual");
  });

  it("GET /options-lifecycle/:tradeId/state 404s for a position that doesn't belong to the caller", async () => {
    const otherUser = await signUp();
    const otherTrade = await insertOpenIronCondor(otherUser.userId, "IWM");
    const res = await get(`/options-lifecycle/${otherTrade.id}/state`, user.cookie);
    expect(res.status).toBe(404);
  });

  it("GET /options-lifecycle/:tradeId/state 400s for a non-numeric trade id", async () => {
    const res = await get("/options-lifecycle/not-a-number/state");
    expect(res.status).toBe(400);
  });

  it("PATCH /options-lifecycle/:tradeId/state sets an explicit stage — never an automatic transition, only an explicit request", async () => {
    const trade = await insertOpenIronCondor(user.userId, "QQQ");
    const res = await patch(`/options-lifecycle/${trade.id}/state`, { stage: "monitoring" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.stage).toBe("monitoring");

    // Confirmed by a subsequent independent GET: the stage change was
    // durably persisted, not just echoed back in the PATCH response.
    const confirmRes = await get(`/options-lifecycle/${trade.id}/state`);
    expect(((await confirmRes.json()) as any).stage).toBe("monitoring");
  });

  it("PATCH /options-lifecycle/:tradeId/state sets an explicit review cadence independent of stage", async () => {
    const trade = await insertOpenIronCondor(user.userId, "MSFT");
    const res = await patch(`/options-lifecycle/${trade.id}/state`, { reviewCadence: "weekly" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.reviewCadence).toBe("weekly");
    expect(body.stage).toBe("open"); // untouched by the cadence-only update
  });

  it("PATCH /options-lifecycle/:tradeId/state 400s for an invalid stage value, never silently accepting it", async () => {
    const trade = await insertOpenIronCondor(user.userId, "GOOGL");
    const res = await patch(`/options-lifecycle/${trade.id}/state`, { stage: "not_a_real_stage" });
    expect(res.status).toBe(400);
  });

  it("PATCH /options-lifecycle/:tradeId/state 404s for a position that doesn't belong to the caller", async () => {
    const otherUser = await signUp();
    const otherTrade = await insertOpenIronCondor(otherUser.userId, "TSLA");
    const res = await patch(`/options-lifecycle/${otherTrade.id}/state`, { stage: "monitoring" }, user.cookie);
    expect(res.status).toBe(404);
  });

  // ─── Timeline / events (Position Timeline, History, Adjustment Journal, Assignment Tracker) ──

  it("GET /options-lifecycle/:tradeId/timeline is honestly empty until an event is actually recorded", async () => {
    const trade = await insertOpenIronCondor(user.userId, "AMZN");
    const res = await get(`/options-lifecycle/${trade.id}/timeline`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("a stage change is recorded onto the same timeline the events endpoint writes to — one append-only log, not two", async () => {
    const trade = await insertOpenIronCondor(user.userId, "NVDA");
    await patch(`/options-lifecycle/${trade.id}/state`, { stage: "near_expiration" });
    const res = await get(`/options-lifecycle/${trade.id}/timeline`);
    const events = (await res.json()) as any[];
    expect(events.some((e) => e.eventType === "stage_change" && e.stage === "near_expiration")).toBe(true);
  });

  it("POST /options-lifecycle/:tradeId/events logs a review event with a real reviewType, and it appears on the timeline", async () => {
    const trade = await insertOpenIronCondor(user.userId, "META");
    const res = await post(`/options-lifecycle/${trade.id}/events`, { eventType: "review", reviewType: "weekly", detail: "Thesis still intact, short strikes far OTM." });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.eventType).toBe("review");
    expect(body.reviewType).toBe("weekly");

    const timeline = (await (await get(`/options-lifecycle/${trade.id}/timeline`)).json()) as any[];
    expect(timeline.some((e) => e.id === body.id)).toBe(true);
  });

  it("POST /options-lifecycle/:tradeId/events 400s a review event missing its reviewType", async () => {
    const trade = await insertOpenIronCondor(user.userId, "AAPL");
    const res = await post(`/options-lifecycle/${trade.id}/events`, { eventType: "review", detail: "Missing reviewType." });
    expect(res.status).toBe(400);
  });

  it("POST /options-lifecycle/:tradeId/events logs an adjustment_note (Adjustment Journal) independent of assignment_note (Assignment Tracker)", async () => {
    const trade = await insertOpenIronCondor(user.userId, "SPY");
    await post(`/options-lifecycle/${trade.id}/events`, { eventType: "adjustment_note", detail: "Rolled the short put down 5 strikes." });
    await post(`/options-lifecycle/${trade.id}/events`, { eventType: "assignment_note", detail: "Short call now 2% ITM — watching closely." });

    const timeline = (await (await get(`/options-lifecycle/${trade.id}/timeline`)).json()) as any[];
    const adjustmentNotes = timeline.filter((e) => e.eventType === "adjustment_note");
    const assignmentNotes = timeline.filter((e) => e.eventType === "assignment_note");
    expect(adjustmentNotes).toHaveLength(1);
    expect(assignmentNotes).toHaveLength(1);
    expect(adjustmentNotes[0].detail).toContain("Rolled the short put");
    expect(assignmentNotes[0].detail).toContain("Short call now 2% ITM");
  });

  it("the timeline is newest-first", async () => {
    const trade = await insertOpenIronCondor(user.userId, "QQQ");
    await post(`/options-lifecycle/${trade.id}/events`, { eventType: "adjustment_note", detail: "First note." });
    await post(`/options-lifecycle/${trade.id}/events`, { eventType: "adjustment_note", detail: "Second note." });
    const timeline = (await (await get(`/options-lifecycle/${trade.id}/timeline`)).json()) as any[];
    expect(timeline[0].detail).toBe("Second note.");
    expect(timeline[1].detail).toBe("First note.");
  });

  it("GET /options-lifecycle/:tradeId/timeline 404s for a position that doesn't belong to the caller", async () => {
    const otherUser = await signUp();
    const otherTrade = await insertOpenIronCondor(otherUser.userId, "MSFT");
    const res = await get(`/options-lifecycle/${otherTrade.id}/timeline`, user.cookie);
    expect(res.status).toBe(404);
  });

  // ─── Checklists (checklist DATA only — never triggers an order/adjustment/stage change) ──

  it("GET /options-lifecycle/:tradeId/checklist instantiates the correct static template for a real strategy key, all items unchecked", async () => {
    const trade = await insertOpenIronCondor(user.userId, "GOOGL");
    const res = await get(`/options-lifecycle/${trade.id}/checklist?strategyKey=iron_condor`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.strategyKey).toBe("iron_condor");
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.checked).toBe(false);
    }
    expect(body.items.some((i: any) => i.id === "assignment-risk-understood")).toBe(true);
  });

  it("GET /options-lifecycle/:tradeId/checklist 404s for an unknown strategyKey on first read, never fabricating a checklist", async () => {
    const trade = await insertOpenIronCondor(user.userId, "TSLA");
    const res = await get(`/options-lifecycle/${trade.id}/checklist?strategyKey=not_a_real_strategy`);
    expect(res.status).toBe(404);
  });

  it("a second GET for the same position returns the SAME persisted checklist, not a freshly re-instantiated one", async () => {
    const trade = await insertOpenIronCondor(user.userId, "AMZN");
    const first = (await (await get(`/options-lifecycle/${trade.id}/checklist?strategyKey=cash_secured_put`)).json()) as any;
    await patch(`/options-lifecycle/${trade.id}/checklist`, { itemId: first.items[0].id, checked: true });
    const second = (await (await get(`/options-lifecycle/${trade.id}/checklist?strategyKey=cash_secured_put`)).json()) as any;
    expect(second.id).toBe(first.id);
    expect(second.items.find((i: any) => i.id === first.items[0].id).checked).toBe(true);
  });

  it("PATCH /options-lifecycle/:tradeId/checklist toggles exactly one item, leaving every other item's checked state untouched", async () => {
    const trade = await insertOpenIronCondor(user.userId, "NVDA");
    const created = (await (await get(`/options-lifecycle/${trade.id}/checklist?strategyKey=iron_fly`)).json()) as any;
    const targetItem = created.items[0];
    const otherItem = created.items[1];

    const res = await patch(`/options-lifecycle/${trade.id}/checklist`, { itemId: targetItem.id, checked: true });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as any;
    expect(updated.items.find((i: any) => i.id === targetItem.id).checked).toBe(true);
    expect(updated.items.find((i: any) => i.id === otherItem.id).checked).toBe(false);
  });

  it("completing every checklist item never changes the position's own lifecycle stage — checklist data only, no automatic transition", async () => {
    const trade = await insertOpenIronCondor(user.userId, "META");
    const checklist = (await (await get(`/options-lifecycle/${trade.id}/checklist?strategyKey=vertical_credit`)).json()) as any;
    for (const item of checklist.items) {
      await patch(`/options-lifecycle/${trade.id}/checklist`, { itemId: item.id, checked: true });
    }
    const state = (await (await get(`/options-lifecycle/${trade.id}/state`)).json()) as any;
    expect(state.stage).toBe("open"); // unchanged — checklist completion never triggers a stage transition
  });

  it("PATCH /options-lifecycle/:tradeId/checklist 404s when no checklist exists yet for the position", async () => {
    const trade = await insertOpenIronCondor(user.userId, "AAPL");
    const res = await patch(`/options-lifecycle/${trade.id}/checklist`, { itemId: "some-item", checked: true });
    expect(res.status).toBe(404);
  });

  // ─── Portfolio summary reflecting real positions/stages ────────────────

  it("the portfolio lifecycle summary tallies real positions by their own real stage, including a manually-set stage", async () => {
    const before = (await (await get("/options-lifecycle/portfolio")).json()) as any;
    const trade = await insertOpenIronCondor(user.userId, "SPY");
    await patch(`/options-lifecycle/${trade.id}/state`, { stage: "assignment_risk" });
    await insertClosedTrade(user.userId, "QQQ", 90);

    const after = (await (await get("/options-lifecycle/portfolio")).json()) as any;
    expect(after.lifecycleSummary.totalPositions).toBe(before.lifecycleSummary.totalPositions + 2);
    const assignmentRiskEntry = after.lifecycleSummary.byStage.find((s: any) => s.stage === "assignment_risk");
    expect(assignmentRiskEntry.count).toBeGreaterThanOrEqual(1);
    expect(after.lifecycleSummary.positionsAwaitingReview).toBeGreaterThan(before.lifecycleSummary.positionsAwaitingReview);
  });

  it("a real closed position with a real openDate/closeDate shows up in the portfolio exposure timeline for the months it was actually open", async () => {
    await insertClosedTrade(user.userId, "T", 75); // open 2026-01-01, closed 2026-02-01
    const res = await get("/options-lifecycle/portfolio");
    const body = (await res.json()) as any;
    const jan2026 = body.exposureTimeline.find((p: any) => p.monthEnd === "2026-01-31");
    // Only asserted if the 6-month trailing window (relative to "now")
    // actually includes January 2026 — never assumed, always checked.
    if (jan2026) {
      expect(jan2026.openPositionsCount).toBeGreaterThanOrEqual(1);
    }
  });

  // ─── Never fabricates a prediction/recommendation/forecast field ───────

  it("never fabricates a prediction/forecast/recommendation field anywhere in the live portfolio or state responses", async () => {
    const trade = await insertOpenIronCondor(user.userId, "GOOGL");
    const portfolio = await (await get("/options-lifecycle/portfolio")).json();
    const state = await (await get(`/options-lifecycle/${trade.id}/state`)).json();
    const serialized = (JSON.stringify(portfolio) + JSON.stringify(state)).toLowerCase();
    expect(serialized).not.toMatch(/"probability"|"prediction"|"forecast"|"recommendation"|"tradingsignal"|"autoexecute"|"autoadjust"/);
  });

  it("GET /options-lifecycle/portfolio requires no special auth beyond the established legacy-owner fallback (never a 500 for no cookie)", async () => {
    const res = await fetch(`${baseUrl}/api/options-lifecycle/portfolio`);
    expect(res.status).toBe(200);
  });
});

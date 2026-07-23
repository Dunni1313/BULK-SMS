// Phase 44 — Institutional Portfolio Workspace & Workflow Center. Live
// route integration tests against a real app + real Postgres connection +
// the real Better-Auth instance (no auth mocking), using a fresh, isolated,
// genuinely signed-up user per test block (mirroring
// routes/watchlists.route.test.ts's own Phase 43 established
// sign-up/session-cookie pattern) so this file's own workflows/pins/recent
// views are never at risk of colliding with another concurrently-running
// test file's own data.
//
// This file proves the Portfolio Workspace is a genuine, internally
// consistent COMPOSITION of the already-shipped, already-tested Decision
// Support Engine (Phase 40), Risk & Exposure Engine (Phase 37), Performance
// & Attribution Engine (Phase 38), Rebalancing Engine (Phase 41), Compliance
// Engine (Phase 42), and Watchlists Engine (Phase 43) — never a second,
// independently-computed set of figures. Orchestration and workflow only —
// no trade recommendations, no buy/sell signals, no AI predictions.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  tradesTable,
  settingsTable,
  sessionsTable,
  accountsTable,
  investingPortfoliosTable,
  investingHoldingsTable,
  tradingPositionsTable,
  compliancePoliciesTable,
  investingWatchlistsTable,
  investingWatchlistItemsTable,
  portfolioWorkflowInstancesTable,
  workspacePinnedResourcesTable,
  workspaceRecentViewsTable,
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
  await db.delete(workspaceRecentViewsTable).where(eq(workspaceRecentViewsTable.userId, userId));
  await db.delete(workspacePinnedResourcesTable).where(eq(workspacePinnedResourcesTable.userId, userId));
  await db.delete(portfolioWorkflowInstancesTable).where(eq(portfolioWorkflowInstancesTable.userId, userId));
  await db.delete(investingWatchlistItemsTable).where(eq(investingWatchlistItemsTable.userId, userId));
  await db.delete(investingWatchlistsTable).where(eq(investingWatchlistsTable.userId, userId));
  await db.delete(compliancePoliciesTable).where(eq(compliancePoliciesTable.userId, userId));
  await db.delete(investingHoldingsTable).where(eq(investingHoldingsTable.userId, userId));
  await db.delete(investingPortfoliosTable).where(eq(investingPortfoliosTable.userId, userId));
  await db.delete(tradingPositionsTable).where(eq(tradingPositionsTable.userId, userId));
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  await db.delete(accountsTable).where(eq(accountsTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("Institutional Portfolio Workspace & Workflow Center routes (live, real Postgres + real auth)", () => {
  let server: Server;
  let baseUrl: string;

  async function signUp(): Promise<SignedUpUser> {
    const email = `portfolio-workspace-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "Portfolio Workspace Test User" }),
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

  // ─── Dashboard aggregation ────────────────────────────────────────────

  it("GET /portfolio-workspace/dashboard returns an honest empty-shaped dashboard for a brand-new user", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/portfolio-workspace/dashboard`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.holdingsOverview.holdingsCount).toBe(0);
    expect(body.holdingsOverview.summary).toMatch(/no investing holdings/i);
    expect(body.tradingOverview.openPositionsCount).toBe(0);
    expect(body.optionsOverview.openPositionsCount).toBe(0);
    expect(body.watchlistsOverview.watchlists).toEqual([]);
    expect(body.activeWorkflows).toEqual([]);
    expect(body.recentReports.totalReports).toBe(0);
    expect(Array.isArray(body.outstandingIssues)).toBe(true);
  });

  it("dashboard's Holdings Overview is byte-consistent with real Investing holdings from the Risk & Exposure Engine", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Workspace Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "ORCL", targetWeightPct: 100, shares: 20, avgCostBasis: 50 });

    // Sequential, not Promise.all: the known, previously-disclosed
    // getSettingsRow() check-then-insert race (lib/serverState.ts) reliably
    // reproduces when two independent settings-touching dashboards are
    // fetched concurrently for the same brand-new user — the same
    // collision-avoidance discipline Phase 43's own route tests established.
    const dashboard = (await (await fetch(`${baseUrl}/api/portfolio-workspace/dashboard`, { headers: { cookie: user.cookie } })).json()) as any;
    const riskExposure = (await (await fetch(`${baseUrl}/api/risk-exposure/dashboard`, { headers: { cookie: user.cookie } })).json()) as any;

    expect(dashboard.holdingsOverview.holdingsCount).toBe(1);
    expect(dashboard.holdingsOverview.portfoliosCount).toBe(1);
    expect(dashboard.riskOverview.investing.allocationBySymbol).toEqual(riskExposure.investing.allocationBySymbol);
    const topAlloc = dashboard.holdingsOverview.topAllocations.find((a: any) => a.symbol === "ORCL");
    expect(topAlloc).toBeDefined();
    expect(topAlloc.weightPct).toBe(100);
  });

  it("dashboard's Outstanding Issues merges Compliance breaches with the Decision Support Engine's own outstanding issues", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Workspace Compliance Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "ORCL", targetWeightPct: 100, shares: 20, avgCostBasis: 50 });
    await db.insert(compliancePoliciesTable).values({ userId: user.userId, policyType: "position_allocation_max", label: "ORCL Position Cap", targetKey: "ORCL", direction: "max", limitValue: 10, enabled: true });

    const dashboard = (await (await fetch(`${baseUrl}/api/portfolio-workspace/dashboard`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(dashboard.complianceOverview.policyViolations.length).toBeGreaterThan(0);
    const complianceIssue = dashboard.outstandingIssues.find((i: any) => i.source === "compliance" && i.label === "ORCL Position Cap");
    expect(complianceIssue).toBeDefined();
    expect(complianceIssue.linkPath).toBe("/monitoring-compliance-engine");
  });

  it("never contains trade-recommendation or buy/sell-signal language anywhere in the dashboard response", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "No Fabrication Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "IBM", targetWeightPct: 100, shares: 3, avgCostBasis: 130 });

    const res = await fetch(`${baseUrl}/api/portfolio-workspace/dashboard`, { headers: { cookie: user.cookie } });
    const raw = await res.text();
    expect(raw.toLowerCase()).not.toMatch(/\byou should (buy|sell)\b|\brecommend(ed|ation)?\b|\bbuy signal\b|\bsell signal\b/);
  });

  // ─── Workflow Center ────────────────────────────────────────────────────

  it("GET /portfolio-workspace/workflows returns all 9 named catalog workflows", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/portfolio-workspace/workflows`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const catalog = (await res.json()) as any[];
    expect(catalog.length).toBe(9);
    expect(catalog.map((w) => w.key)).toEqual(
      expect.arrayContaining([
        "morning_review",
        "weekly_review",
        "monthly_review",
        "quarterly_review",
        "portfolio_review",
        "risk_review",
        "compliance_review",
        "performance_review",
        "scenario_review",
      ]),
    );
    for (const w of catalog) {
      expect(w.steps.length).toBeGreaterThan(0);
      for (const step of w.steps) expect(typeof step.linkPath).toBe("string");
    }
  });

  it("full workflow instance lifecycle: start, list active, toggle steps, auto-complete, delete", async () => {
    const user = await signUp();

    const startRes = await fetch(`${baseUrl}/api/portfolio-workspace/workflows/morning_review/start`, { method: "POST", headers: { cookie: user.cookie } });
    expect(startRes.status).toBe(201);
    const instance = (await startRes.json()) as any;
    expect(instance.workflowKey).toBe("morning_review");
    expect(instance.status).toBe("active");
    expect(instance.completedStepKeys).toEqual([]);
    expect(instance.totalSteps).toBe(4);

    const activeRes = await fetch(`${baseUrl}/api/portfolio-workspace/workflows/instances?status=active`, { headers: { cookie: user.cookie } });
    const active = (await activeRes.json()) as any[];
    expect(active.some((i) => i.id === instance.id)).toBe(true);

    // Toggle 3 of 4 steps — still active.
    for (const stepKey of ["check_outstanding_issues", "check_watchlists", "check_risk"]) {
      const stepRes = await fetch(`${baseUrl}/api/portfolio-workspace/workflows/instances/${instance.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: user.cookie },
        body: JSON.stringify({ stepKey, completed: true }),
      });
      expect(stepRes.status).toBe(200);
    }
    const stillActive = (await (await fetch(`${baseUrl}/api/portfolio-workspace/workflows/instances?status=active`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(stillActive.some((i) => i.id === instance.id)).toBe(true);

    // Complete the 4th step — the instance auto-completes.
    const finalRes = await fetch(`${baseUrl}/api/portfolio-workspace/workflows/instances/${instance.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ stepKey: "check_compliance", completed: true }),
    });
    const completed = (await finalRes.json()) as any;
    expect(completed.status).toBe("completed");
    expect(completed.completedStepKeys.sort()).toEqual(["check_compliance", "check_outstanding_issues", "check_risk", "check_watchlists"].sort());
    expect(completed.completedAt).not.toBeNull();

    const activeAfterCompletion = (await (await fetch(`${baseUrl}/api/portfolio-workspace/workflows/instances?status=active`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(activeAfterCompletion.some((i) => i.id === instance.id)).toBe(false);

    const deleteRes = await fetch(`${baseUrl}/api/portfolio-workspace/workflows/instances/${instance.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(deleteRes.status).toBe(200);
    const allAfterDelete = (await (await fetch(`${baseUrl}/api/portfolio-workspace/workflows/instances`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(allAfterDelete.some((i) => i.id === instance.id)).toBe(false);
  });

  it("404 for starting an unknown workflow key, and for updating/deleting a nonexistent or another user's instance", async () => {
    const user = await signUp();
    const other = await signUp();

    const badStart = await fetch(`${baseUrl}/api/portfolio-workspace/workflows/not_a_real_workflow/start`, { method: "POST", headers: { cookie: user.cookie } });
    expect(badStart.status).toBe(404);

    const otherInstance = (await (await fetch(`${baseUrl}/api/portfolio-workspace/workflows/risk_review/start`, { method: "POST", headers: { cookie: other.cookie } })).json()) as any;

    const crossUserPatch = await fetch(`${baseUrl}/api/portfolio-workspace/workflows/instances/${otherInstance.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ stepKey: "review_risk_overview", completed: true }),
    });
    expect(crossUserPatch.status).toBe(404);

    const missingDelete = await fetch(`${baseUrl}/api/portfolio-workspace/workflows/instances/999999999`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(missingDelete.status).toBe(404);
  });

  it("a workflow instance never changes anything about the user's own portfolio, positions, or trades", async () => {
    const user = await signUp();
    const [portfolio] = await db.insert(investingPortfoliosTable).values({ userId: user.userId, name: "Untouched Holdings" }).returning({ id: investingPortfoliosTable.id });
    await db.insert(investingHoldingsTable).values({ userId: user.userId, portfolioId: portfolio.id, symbol: "IBM", targetWeightPct: 100, shares: 5, avgCostBasis: 130 });

    const before = (await (await fetch(`${baseUrl}/api/risk-exposure/dashboard`, { headers: { cookie: user.cookie } })).json()) as any;
    const instance = (await (await fetch(`${baseUrl}/api/portfolio-workspace/workflows/portfolio_review/start`, { method: "POST", headers: { cookie: user.cookie } })).json()) as any;
    await fetch(`${baseUrl}/api/portfolio-workspace/workflows/instances/${instance.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ stepKey: "review_holdings", completed: true }),
    });
    const after = (await (await fetch(`${baseUrl}/api/risk-exposure/dashboard`, { headers: { cookie: user.cookie } })).json()) as any;
    expect(after.investing).toEqual(before.investing);
  });

  // ─── Pinned Resources (Favorites) ───────────────────────────────────────

  it("full pin/unpin lifecycle, duplicate pin 409s, reorder works", async () => {
    const user = await signUp();
    const emptyRes = await fetch(`${baseUrl}/api/portfolio-workspace/pins`, { headers: { cookie: user.cookie } });
    expect((await emptyRes.json())).toEqual([]);

    const pinBody = { resourceType: "dashboard", resourceKey: "watchlists-engine", label: "Watchlists & Opportunity Dashboard", linkPath: "/watchlists-engine" };
    const pinRes = await fetch(`${baseUrl}/api/portfolio-workspace/pins`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify(pinBody),
    });
    expect(pinRes.status).toBe(201);
    const pin = (await pinRes.json()) as any;
    expect(pin.label).toBe(pinBody.label);

    const dupeRes = await fetch(`${baseUrl}/api/portfolio-workspace/pins`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify(pinBody),
    });
    expect(dupeRes.status).toBe(409);

    const secondPin = (await (
      await fetch(`${baseUrl}/api/portfolio-workspace/pins`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: user.cookie },
        body: JSON.stringify({ resourceType: "dashboard", resourceKey: "risk-exposure-engine", label: "Risk & Exposure Engine", linkPath: "/risk-exposure-engine" }),
      })
    ).json()) as any;

    const reorderRes = await fetch(`${baseUrl}/api/portfolio-workspace/pins/reorder`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ orderedIds: [secondPin.id, pin.id] }),
    });
    expect(reorderRes.status).toBe(200);
    const list = (await (await fetch(`${baseUrl}/api/portfolio-workspace/pins`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(list[0].id).toBe(secondPin.id);

    const unpinRes = await fetch(`${baseUrl}/api/portfolio-workspace/pins/${pin.id}`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(unpinRes.status).toBe(200);
    const afterUnpin = (await (await fetch(`${baseUrl}/api/portfolio-workspace/pins`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(afterUnpin.some((p) => p.id === pin.id)).toBe(false);

    const missingUnpin = await fetch(`${baseUrl}/api/portfolio-workspace/pins/999999999`, { method: "DELETE", headers: { cookie: user.cookie } });
    expect(missingUnpin.status).toBe(404);
  });

  // ─── Recently Viewed ─────────────────────────────────────────────────────

  it("recording a view of the same resource twice keeps only the most recent, distinct-resource ordering", async () => {
    const user = await signUp();
    const emptyRes = await fetch(`${baseUrl}/api/portfolio-workspace/recent-views`, { headers: { cookie: user.cookie } });
    expect((await emptyRes.json())).toEqual([]);

    await fetch(`${baseUrl}/api/portfolio-workspace/recent-views`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ resourceType: "report", resourceKey: "watchlist-summary-report", label: "Watchlist Summary Report", linkPath: "/reporting-centre" }),
    });
    const secondViewRes = await fetch(`${baseUrl}/api/portfolio-workspace/recent-views`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ resourceType: "dashboard", resourceKey: "watchlists-engine", label: "Watchlists & Opportunity Dashboard", linkPath: "/watchlists-engine" }),
    });
    expect(secondViewRes.status).toBe(201);

    // Re-view the first resource — it should move to most-recent, never
    // duplicate.
    await fetch(`${baseUrl}/api/portfolio-workspace/recent-views`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ resourceType: "report", resourceKey: "watchlist-summary-report", label: "Watchlist Summary Report", linkPath: "/reporting-centre" }),
    });

    const list = (await (await fetch(`${baseUrl}/api/portfolio-workspace/recent-views`, { headers: { cookie: user.cookie } })).json()) as any[];
    expect(list.length).toBe(2);
    expect(list[0].resourceKey).toBe("watchlist-summary-report");
  });

  // ─── Quick Actions ───────────────────────────────────────────────────────

  it("GET /portfolio-workspace/quick-actions returns the fixed, non-empty curated list", async () => {
    const user = await signUp();
    const res = await fetch(`${baseUrl}/api/portfolio-workspace/quick-actions`, { headers: { cookie: user.cookie } });
    expect(res.status).toBe(200);
    const actions = (await res.json()) as any[];
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) {
      expect(typeof a.key).toBe("string");
      expect(typeof a.linkPath).toBe("string");
    }
  });

  // ─── AI Coach & Learning ──────────────────────────────────────────────

  it("AI Coach: all 5 topics, one by key, 404 for unknown; never a trade recommendation", async () => {
    const user = await signUp();
    const allRes = await fetch(`${baseUrl}/api/portfolio-workspace/coach`, { headers: { cookie: user.cookie } });
    const all = (await allRes.json()) as any[];
    expect(all.length).toBe(5);
    for (const t of all) expect(t.disclaimer).toBeTruthy();

    const oneRes = await fetch(`${baseUrl}/api/portfolio-workspace/coach/governance`, { headers: { cookie: user.cookie } });
    expect(oneRes.status).toBe(200);
    const one = (await oneRes.json()) as any;
    expect(one.topic).toBe("governance");
    expect(JSON.stringify(one).toLowerCase()).not.toMatch(/\byou should (buy|sell)\b/);

    const missingRes = await fetch(`${baseUrl}/api/portfolio-workspace/coach/nonexistent`, { headers: { cookie: user.cookie } });
    expect(missingRes.status).toBe(404);
  });

  it("Learning Centre: all 6 topics resolve to real, non-empty Learning Centre links; 404 for unknown", async () => {
    const user = await signUp();
    const allRes = await fetch(`${baseUrl}/api/portfolio-workspace/learning`, { headers: { cookie: user.cookie } });
    const all = (await allRes.json()) as any[];
    expect(all.length).toBe(6);
    for (const t of all) {
      expect(t.links.length).toBeGreaterThan(0);
      for (const link of t.links) {
        expect(link.title).toBeTruthy();
        expect(link.href).toMatch(/^\/learn\/paths\//);
      }
    }

    const oneRes = await fetch(`${baseUrl}/api/portfolio-workspace/learning/risk_review`, { headers: { cookie: user.cookie } });
    expect(oneRes.status).toBe(200);

    const missingRes = await fetch(`${baseUrl}/api/portfolio-workspace/learning/nonexistent`, { headers: { cookie: user.cookie } });
    expect(missingRes.status).toBe(404);
  });
});

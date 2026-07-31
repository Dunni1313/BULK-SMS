// v1.1.0 — Sidebar Navigation Redesign. Structural regression coverage for
// the canonical navigation config: every route that was reachable from the
// sidebar before this redesign must still be reachable afterward, exactly
// once, and the flattened/lookup helpers CommandPalette and SidebarNav
// depend on must behave correctly.

import { describe, it, expect } from "vitest";
import { NAV_GROUPS, ALL_NAV_ITEMS, DEFAULT_PINNED_HREFS, findNavItem, findGroupIdForHref } from "./nav-items";

// The exact 82 routes the pre-redesign NAV_ITEMS/LEARN_NAV_ITEMS arrays
// exposed, captured before the redesign began (Phase 10's own nav-items.ts,
// commit before this file was rewritten). This is the actual regression
// fixture for "do not remove any existing routes or functionality."
const PRE_REDESIGN_ROUTES = [
  "/",
  "/command-center",
  "/notifications",
  "/operations",
  "/options-dashboard",
  "/scanner",
  "/options/SPY",
  "/portfolio",
  "/trades",
  "/order-preview",
  "/position-sizing",
  "/adjustments",
  "/adjustment-preview",
  "/options-backtest",
  "/events",
  "/backtest",
  "/scoring",
  "/journal",
  "/options-income-workspace",
  "/options-lifecycle-manager",
  "/risk-exposure-engine",
  "/scenario-engine",
  "/performance-attribution-engine",
  "/decision-support-engine",
  "/rebalancing-engine",
  "/monitoring-compliance-engine",
  "/watchlists-engine",
  "/broker-reconciliation",
  "/portfolio-ai",
  "/portfolio-dashboard",
  "/portfolio-workspace",
  "/workspace",
  "/portfolio-analyst",
  "/stress-test",
  "/event-risk",
  "/concentration-risk",
  "/performance",
  "/trade-history",
  "/trade-performance",
  "/paper-portfolio",
  "/institutional-dashboard",
  "/executive-intelligence",
  "/institutional-intelligence",
  "/institutional-mentor",
  "/decision-engine",
  "/stock-analyst/investment-committee",
  "/opportunity-discovery",
  "/monitoring-dashboard",
  "/daily-report",
  "/research-terminal",
  "/reporting-centre",
  "/institutional-ai-coach",
  "/stock-analyst/executive-dashboard",
  "/stock-analyst",
  "/stock-analyst/scanner",
  "/stock-analyst/portfolio-construction",
  "/stock-analyst/portfolio-optimisation",
  "/trading-research",
  "/trading-journal",
  "/trading-backtest",
  "/trade-workspace",
  "/market-structure-workbench",
  "/liquidity-workbench",
  "/trade-planning-studio",
  "/strategy-framework",
  "/strategy-workbench",
  "/trading-analytics",
  "/trading-ai-coach",
  "/assistant",
  "/trade-journal-ai",
  "/cross-engine-workspace",
  "/learn",
  "/learn/paths",
  "/learn/strategy-academy",
  "/learn/glossary",
  "/learn/delta",
  "/learn/greeks",
  "/learn/quiz",
  "/lessons",
  "/stock-analyst/value-investing-school",
  "/autopilot",
  "/settings",
];

// Routes deliberately added to the sidebar since the v1.1.0 redesign
// (each disclosed in its own release's own docs — never a silent
// addition). This list, not PRE_REDESIGN_ROUTES itself, is what grows
// over time; PRE_REDESIGN_ROUTES stays frozen as the original "nothing
// was removed" fixture.
const ADDED_SINCE_REDESIGN_ROUTES = [
  // v1.2.0 — Trade Execution Center (docs/v1.2.0-Trade-Execution-Center.md).
  "/trade-execution-center",
  // v1.3.1 — AI Trading Coach (docs/v1.3.0-AI-Trading-Coach-Design.md).
  "/ai-trading-coach",
  // v1.5.0, Sprint 12 — Institutional Command Centre
  // (docs/v1.5.0-Sprint-12-Institutional-Command-Centre.md). "/" itself was
  // already in PRE_REDESIGN_ROUTES (previously Home.tsx, now the new
  // Institutional Command Centre); "/personal-dashboard" is the genuinely
  // new href — Home.tsx's own new address, fully preserved, not removed.
  "/personal-dashboard",
  // v1.5.0, Sprint 13 — Institutional Decision Engine
  // (docs/v1.5.0-Sprint-13-Institutional-Decision-Engine.md). A distinct
  // page/route from the pre-existing "/decision-engine" (already in
  // PRE_REDESIGN_ROUTES, untouched).
  "/decision-workflow",
  // v1.5.0, Sprint 14 — Institutional Execution & Lifecycle Manager
  // (docs/v1.5.0-Sprint-14-Institutional-Execution-Lifecycle.md). The
  // orchestration layer picking up right where Decision Workflow leaves off.
  "/execution-lifecycle",
  // v1.5.0, Sprint 15 — Institutional Portfolio & Risk Intelligence Engine
  // (docs/v1.5.0-Sprint-15-Portfolio-Risk-Intelligence.md). The intelligence
  // layer sitting above every other module.
  "/portfolio-risk-intelligence",
  // v1.5.0, Sprint 16 — Institutional Workflow Automation Engine
  // (docs/v1.5.0-Sprint-16-Workflow-Automation-Engine.md). Connects every
  // existing module into one unified, dismissible Task list.
  "/workflow-automation-engine",
  // v1.5.0, Sprint 17 — Institutional Knowledge & Intelligence Graph
  // (docs/v1.5.0-Sprint-17-Knowledge-Intelligence-Graph.md). Connects
  // Research/Strategies/Trade Plans/Journal/Companies/Themes into one
  // reusable, transparent knowledge graph.
  "/knowledge-graph",
  // v1.5.0, Sprint 18 — Institutional Playbooks & Operating Procedures
  // Engine (docs/v1.5.0-Sprint-18-Institutional-Playbooks.md). 12
  // documented operating procedures, each stage linking to an already-
  // existing module.
  "/playbooks",
  // v1.5.0, Sprint 19 — Institutional Decision Quality & Review Engine
  // (docs/v1.5.0-Sprint-19-Decision-Quality-Review.md). Evaluates decision
  // PROCESS quality using already-collected platform evidence — never
  // trade outcome.
  "/decision-quality-review",
];

describe("nav-items — the single canonical navigation configuration", () => {
  it("defines exactly 10 top-level groups", () => {
    expect(NAV_GROUPS).toHaveLength(10);
  });

  it("has a unique, non-empty id and label for every group", () => {
    const ids = NAV_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of NAV_GROUPS) {
      expect(g.id.length).toBeGreaterThan(0);
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.items.length).toBeGreaterThan(0);
    }
  });

  it("preserves every route reachable from the sidebar before the redesign, exactly once", () => {
    const currentHrefs = ALL_NAV_ITEMS.map((i) => i.href);
    expect(new Set(currentHrefs).size).toBe(currentHrefs.length);
    for (const href of PRE_REDESIGN_ROUTES) {
      expect(currentHrefs).toContain(href);
    }
    const expectedHrefs = [...PRE_REDESIGN_ROUTES, ...ADDED_SINCE_REDESIGN_ROUTES];
    expect(currentHrefs).toHaveLength(expectedHrefs.length);
    expect(new Set(currentHrefs)).toEqual(new Set(expectedHrefs));
  });

  it("never lists the same href in two different groups", () => {
    const seen = new Map<string, string>();
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        const existingGroup = seen.get(item.href);
        expect(existingGroup, `${item.href} appears in both "${existingGroup}" and "${group.id}"`).toBeUndefined();
        seen.set(item.href, group.id);
      }
    }
  });

  it("Home and Options Trading are the only groups marked defaultExpanded", () => {
    const expandedByDefault = NAV_GROUPS.filter((g) => g.defaultExpanded).map((g) => g.id);
    expect(expandedByDefault.sort()).toEqual(["home", "options-trading"]);
  });

  describe("findNavItem", () => {
    it("resolves a known href to its title and icon", () => {
      // v1.5.0, Sprint 12 — renamed to "Options Command Center" to
      // disambiguate from the new Institutional Command Centre at "/".
      const item = findNavItem("/command-center");
      expect(item?.title).toBe("Options Command Center");
      expect(item?.icon).toBeDefined();
    });

    it("returns undefined for an unknown href", () => {
      expect(findNavItem("/this-route-does-not-exist")).toBeUndefined();
    });
  });

  describe("findGroupIdForHref", () => {
    it("resolves a known href to the group that owns it", () => {
      expect(findGroupIdForHref("/settings")).toBe("administration");
      expect(findGroupIdForHref("/trading-journal")).toBe("trading-workbench");
      expect(findGroupIdForHref("/stock-analyst")).toBe("value-investing");
    });

    it("returns undefined for an unknown href", () => {
      expect(findGroupIdForHref("/this-route-does-not-exist")).toBeUndefined();
    });
  });

  describe("DEFAULT_PINNED_HREFS", () => {
    it("only pins routes that genuinely exist in the navigation config", () => {
      for (const href of DEFAULT_PINNED_HREFS) {
        expect(findNavItem(href), `${href} is not a real nav item`).toBeDefined();
      }
    });

    it("matches the redesign spec's own suggested defaults", () => {
      // v1.5.0, Sprint 12 — the new Institutional Command Centre ("/")
      // took over the first default pin slot from the old "/command-center".
      expect(DEFAULT_PINNED_HREFS).toEqual([
        "/",
        "/options-dashboard",
        "/scanner",
        "/portfolio-dashboard",
        "/assistant",
        "/settings",
      ]);
    });
  });
});

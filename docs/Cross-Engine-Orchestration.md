# Cross-Engine Orchestration — Phase 34 Audit & Design Record

Phase 34 — Cross-Engine Orchestration & Unified Workspace. An
orchestration and integration phase: unify the Investing Engine, Trading
Engine, and Executive Intelligence Hub into one seamless workflow, reusing
existing deterministic functionality wherever possible.

## Audit performed before implementation

Every workflow named in the brief was inspected directly before any code
was written:

**Investing:** Portfolio Dashboard (`investing_portfolios`/`investing_holdings`),
Research Terminal (`ResearchTerminal.tsx`), Committee Workbench
(`InvestmentCommitteeWorkbench.tsx` + `investing_decision_snapshots`),
Portfolio Optimizer (`PortfolioOptimisation.tsx`), Institutional AI Coach
(`investingCoach.ts`, 8 coaches), Reporting Centre
(`institutionalReporting.ts`), Executive Intelligence
(`executiveIntelligence.ts`, Phase 33).

**Trading:** Trade Workspace (`TradeWorkspace.tsx`), Trade Planning Studio
(`trading_trade_plans`), Strategy Framework (`tradingStrategyFramework.ts`),
Strategy Workbench (`StrategyWorkbench.tsx`), Trading Analytics
(`tradingAnalytics.ts`, Phase 32), Trading AI Coach (`tradingCoach.ts`, 9
coaches), Trading Journal (`trading_journal_entries`), Reporting Centre
(shared with Investing).

**Shared:** Executive Dashboard (`ExecutiveDashboard.tsx`, Phase 23),
Learning Centre (`LEARNING_PATHS` + `learning_progress`), Navigation
(`nav-items.ts`), Command Palette (`CommandPalette.tsx`, already
documented since Phase 10 as "ALSO the platform's Global Search"),
Reporting, Activity Timeline (`buildActivityTimeline()`, Phase 33).

## Genuine gap found before building anything

Two existing pages initially looked like they might already satisfy this
phase's own request, and were read in full before concluding they did
not:

- `InstitutionalWorkspace.tsx` (Phase 17) — a genuinely unified research
  cockpit, but **symbol-centric and Investing-only**: every panel
  (Watchlist, Portfolio, Opportunities, Monitoring, Notes, Active Alerts,
  Related Opportunities, AI Mentor Guidance) requires or revolves around a
  single searched symbol. No Trading Engine surface, no global entity
  search across categories, no cross-engine activity feed.
- `CommandCenter.tsx` (Institutional Command Center sprint) — a genuinely
  unified executive view, but **Options Income Engine-only** (Portfolio
  Health, Greeks, theta income, stress test) — no Investing or Trading
  Engine content at all.

`CommandPalette.tsx` was confirmed to already fuzzy-filter Positions,
Watchlist, Portfolios, (options) Journal, Lessons, Strategies (Strategy
Academy static content, not `trading_strategies`), Glossary, and AI
Observations client-side over already-fetched full lists — but it never
covered Holdings, Research Notes, Committee Snapshots, Trade Plans,
Trading Journal entries, real `trading_strategies` rows, or Reports. A
genuine deterministic backend search over those 9 entity categories did
not exist anywhere in the codebase.

**Conclusion:** no existing page or search surface satisfied the brief's
own request for a genuinely cross-engine (Investing + Trading + Executive
Intelligence) Unified Workspace with Global Search, Recent Activity,
Cross-Engine Tasks, Recent Items, Quick Actions, and Shortcuts. This
justified building `lib/crossEngineWorkspace.ts`, its 2 new routes, and
`pages/CrossEngineWorkspace.tsx`.

## Design decisions and why

1. **Extend Phase 33, never duplicate it.** `lib/executiveIntelligence.ts`
   is imported unmodified. The Overview tab's KPIs are the exact same
   `ExecutiveOverview` object Phase 33 already computes — this phase adds
   zero new KPI calculations. Recent Activity is Phase 33's own
   `buildActivityTimeline()` called with a large cap and then merged with
   3 new entry types, never a re-derivation of the base 7.

2. **Global Search is deterministic substring matching only**, per the
   brief's explicit "Do not introduce semantic search or AI search"
   instruction — `matches()` in `lib/crossEngineWorkspace.ts` is a plain
   case-insensitive `.includes()` check, nothing more.

3. **Cross-Engine Tasks reuses existing computed fields wherever
   possible**, rather than triggering a heavier engine call. The one
   candidate that would have required invoking `tradingRisk.ts`'s own
   heavier `buildTradingRiskAnalysis()` (which calls the Market Regime
   Engine per position) was deliberately avoided — instead, "positions
   missing a stop or target" is a trivial, cheap, purely-relational count
   directly over `trading_positions`, giving the same honest signal
   without an eager, per-request cascade into Engine 2's probability
   machinery.

4. **Cross-Engine Context is pure navigation**, matching `lib/workflows.ts`'s
   own Phase 10 precedent and disclosed scope decision for exactly this
   kind of "ordered sequence of existing pages" feature — no new stateful
   orchestrator, no persisted workflow-progress state.

5. **Workspace State is `localStorage` + `?tab=`, not a new DB table.**
   The brief's own "Workspace State" provide-item was interpreted as the
   bounded, already-established pattern this codebase uses elsewhere
   (`ExecutiveIntelligence.tsx`'s own `?tab=` deep link, the Research
   Terminal's own client-side Saved Layouts) — genuinely functional
   (returning to the page resumes your last tab) without any new
   persistence layer.

6. **Command Palette integration stops at the nav-item link, deliberately
   not a live-search rewire** — see `docs/Unified-Navigation.md` for the
   full disclosed reasoning (test-risk to an already-established,
   well-tested component).

## Files added

- `lib/crossEngineWorkspace.ts` / `.test.ts` (backend composition + 19
  unit tests)
- `routes/crossEngineWorkspace.ts` / `.route.test.ts` (2 routes + 9 live
  route tests)
- `pages/CrossEngineWorkspace.tsx` / `.test.tsx` (frontend + 15 tests)

## Files modified (all additive)

`routes/index.ts` (router registration), `App.tsx` (route registration),
`lib/nav-items.ts` (1 nav entry), `lib/quick-actions.ts` (1 new exported
list, `CROSS_ENGINE_QUICK_ACTIONS`, the original `QUICK_ACTIONS` untouched),
`ExecutiveDashboard.tsx`, `ExecutiveIntelligence.tsx`,
`InstitutionalDashboard.tsx`, `TradingAnalyticsDashboard.tsx`,
`ReportingCentre.tsx`, `pages/learn/LearningCentre.tsx` (one outbound link
each), plus `lib/api-spec/openapi.yaml` and the generated `api-zod`/
`api-client-react` codegen output.

## What was deliberately not built

- No trading signal, probability, or prediction of any kind.
- No automated entries, exits, or broker execution.
- No new trading mathematics — every number displayed already existed in
  a table or an earlier phase's own analytics function.
- No semantic/AI search.
- No new database table.
- No live-query rewire of the Command Palette (see above).

See `docs/Cross-Engine-Workspace.md` for the full feature description and
`docs/Unified-Navigation.md` for the integration-point-by-integration-point
record.

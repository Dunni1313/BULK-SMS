# Institutional Workspace Model — Design & Audit Record (Phase 44)

The exact design decisions behind `lib/portfolioWorkspace.ts`,
`lib/portfolioWorkflows.ts`, and `lib/workspacePins.ts`, kept as a permanent
record for future phases, mirroring the role
`docs/Institutional-Watchlists-Model.md` plays for Phase 43,
`docs/Institutional-Governance-Model.md` plays for Phase 42, and
`docs/Institutional-Rebalancing-Model.md` plays for Phase 41.

## Guiding constraint

The Phase 44 kickoff was explicit: **this phase is orchestration and
workflow only.** Do NOT implement trade recommendations, buy/sell signals,
AI predictions, portfolio optimisation, auto execution, auto hedging,
machine learning, market forecasting, or broker integration changes. Every
figure below was designed against that constraint first — every value is
either (a) reused verbatim from an existing, already-computed engine
output, or (b) a plain, deterministic aggregation over already-computed
figures — never a scoring model, never a recommendation.

## Audit performed before implementation

Before writing any code, the following components were investigated via
direct source reads, per the kickoff's own required audit.

### INVESTING

| Component | Investigated for | Verdict |
|---|---|---|
| Portfolio Dashboard (`lib/portfolioDashboard.ts`, Options-side) | Health-scoring shape | Not an Investing surface — reused only transitively via the Risk & Exposure Engine's own Options view (`risk.options.dashboard`) |
| Risk & Exposure Engine (`lib/riskExposureEngine.ts`, Phase 37) | Full Risk Overview, Holdings/Trading/Options headline figures | **Reused directly** — the single largest reuse target this phase has |
| Performance & Attribution Engine (`lib/performanceAttribution.ts`, Phase 38) | Full Performance Overview, Holdings/Trading/Options P&L headline figures | **Reused directly** |
| Scenario & Stress Testing Engine (`lib/scenarioEngine.ts`, Phase 39) | Scenario impact | Not directly re-exposed at the workspace level — already fully summarized inside the Decision Support Engine's own `scenarioSummary`, reused via that engine instead of a second direct call |
| Decision Support Engine (`lib/decisionSupportEngine.ts`, Phase 40) | Executive Home + Portfolio Snapshot | **Reused wholesale** — `buildDecisionSupportDashboard()`'s own output IS the Portfolio Snapshot, embedded verbatim; `executiveSummary` IS the Executive Home |
| Rebalancing Engine (`lib/rebalancingEngine.ts`, Phase 41) | Drifted-holdings headline count | **Reused directly** — read only for its own already-computed per-holding `rebalanceAction`, to surface a drift count on Holdings Overview; the full dashboard is not re-exposed (a deep link to `/rebalancing-engine` covers detail) |
| Compliance Engine (`lib/complianceEngine.ts`, Phase 42) | Compliance Overview | **Reused directly**, kept lean (`complianceSummary` + `policyViolations` only — the full per-category breakdown lives on its own dedicated page) |
| Watchlists Engine (`lib/watchlistsEngine.ts`, Phase 43) | Watchlists Overview | **Reused directly**, kept lean (`watchlists`/`watchlistHealth`/`crossEngineSummary`/`dashboardSummary` only — the full Opportunity Overview array lives on its own dedicated page) |

### TRADING

| Component | Investigated for | Verdict |
|---|---|---|
| Trading Workspace (`pages/TradeWorkspace.tsx` / `lib/tradingRisk.ts` etc., Phase 25) | A dedicated Trading overview concept | Investigated; the Risk & Exposure Engine's own already-computed Trading view (`risk.trading`) already supplies everything Holdings/Trading Overview needs — no second read |
| Trading Analytics (`lib/tradingAnalytics.ts`, Phase 32) | Usage-analytics concept | Investigated; a genuinely different concept from this phase's Trading Overview (session/checklist/coach-view counts, not portfolio state) — correctly not reused here |
| Market Structure (`lib/tradingMarketStructure.ts` and related) | A market-condition overview | Investigated; out of scope for a portfolio-state workspace — no reuse target found |

### OPTIONS

| Component | Investigated for | Verdict |
|---|---|---|
| Options Income Engine (`lib/optionsIncomeAnalytics.ts`, Phase 35) | Options Overview's own inputs | Reused transitively via the Risk & Exposure Engine's own Options view, not directly |
| Position Lifecycle (`lib/optionsLifecycle.ts`) | Per-position lifecycle state | Investigated; lifecycle tracking is position-state-oriented, not a workspace-overview concept — not applicable to this phase's scope |
| Greeks | Portfolio-wide Greeks | Reused transitively via the Risk & Exposure Engine's own already-computed Options view |
| Portfolio Exposure | Options allocation/buying power | **Reused directly** via `risk.options.dashboard` |

### SHARED

| Component | Investigated for | Verdict |
|---|---|---|
| Executive Dashboard / Executive Intelligence / Cross-Engine Workspace | Integration surfaces | **Extended** — one new deep link each, mirroring the exact pattern Phase 43's own Watchlists Engine link established |
| Reporting Centre (`lib/institutionalReporting.ts`) | Report-generation framework | **Reused directly** — the existing `ReportSection`/`InstitutionalReport` shape, `REPORT_TYPE_META` array, and `regenerate()` dispatcher, extended with 2 new entries each |
| Learning Centre (`lib/learningPaths.ts`) | Existing topic content | **Reused directly** — every Portfolio Workspace Learning link resolves a real, already-existing topic key, verified to exist before use |
| Institutional AI Coach (`lib/coach.ts`) | The shared disclaimer contract | **Reused directly** — `COACH_DISCLAIMER`, imported unmodified |
| Navigation / Command Palette (`lib/nav-items.ts`) | The single navigation index | **Extended** — one new `NavItem`; the Command Palette and sidebar both read this same array, so no second wiring point was needed |

**Genuine gap found, and how it was resolved:** no existing table
anywhere in this codebase supports (a) tracking a user's own progress
through a named, multi-step institutional review process, or (b) a
cross-resource-type pinning/favorites system, or (c) a bounded
"recently opened from the workspace" log. `dashboardWorkspaces.ts`
(Phase 10) was investigated and found to be a genuinely different
concept — a single, options-Home-page-specific widget-visibility/
ordering config, not a multi-type resource pin. Three new tables
(`portfolio_workflow_instances`, `workspace_pinned_resources`,
`workspace_recent_views`) fill these gaps.

## Design decisions made without blocking (disclosed here, per established precedent)

1. **"Favorites" and "Pinned Resources" are the same underlying
   persistence.** The kickoff's WORKSPACE section names both "Favorites"
   and "Pinned Resources" as things to provide. Rather than build two
   overlapping, functionally-identical persistence systems (which would
   mean a user "pinning" a resource in one system and it not appearing in
   the other), a single `workspace_pinned_resources` table backs both — the
   Workspace tab's "Favorites" card is simply the display name for the
   same pinned-resource list the Pinned Resources API manages. This is
   disclosed explicitly rather than silently assumed.
2. **Recently Viewed is scoped to the Workspace itself, not a global
   page-view tracker.** Instrumenting all ~90 existing pages in this
   codebase to record a "view" event would be a wholly disproportionate,
   out-of-scope undertaking for an orchestration-only phase, and would
   silently touch dozens of files never named in this phase's own kickoff.
   Instead, `workspace_recent_views` records only resources explicitly
   opened FROM the Portfolio Workspace's own quick-action links,
   pinned-resource links, and recent-reports/active-workflow links — a
   genuinely narrower, honestly-scoped feature, not the full ambition a
   literal reading of "Recently Viewed" might imply. This is disclosed
   explicitly, not silently narrowed.
3. **Quick Actions is a fixed, curated, non-persisted list**, the same
   "static catalog" precedent `WORKFLOW_CATALOG`
   (`lib/portfolioWorkflows.ts`) and `dashboardWorkspaces.ts`'s own
   `DEFAULT_WIDGET_IDS` (Phase 10) already established — never
   user-configurable, never persisted, matching the kickoff's own framing
   ("a fixed Quick Actions list").
4. **The Portfolio Workspace Dashboard is eager, not on-demand**, matching
   Phase 43's own Watchlists Dashboard precedent. Every engine this phase
   reuses (Decision Support, Risk & Exposure, Performance, Rebalancing,
   Compliance, Watchlists) is already a whole-portfolio dashboard with zero
   per-symbol external provider calls — computing the full workspace
   dashboard costs no additional provider calls regardless of portfolio
   size.
5. **Holdings/Trading/Options Overview are deliberately lean headline
   cards**, not a duplicate of the full Risk/Performance dashboards already
   exposed under their own named "Risk Overview"/"Performance Overview"
   sections. This avoids serializing the same nested per-symbol/per-position
   arrays twice under two different section names in the same response.
6. **Reporting Centre naming collision avoidance.** The existing
   `"portfolio-review"` report type (Portfolio Optimisation's own report,
   Phase 2) already existed and is conceptually adjacent to "portfolio
   review." The two new report types are named
   `"portfolio-workspace-summary"`/`"institutional-review-report"` —
   genuinely distinct strings, verified collision-free before codegen, no
   repeat of any prior phase's own schema-naming incident.
7. **A workflow instance reaching "completed" status is a deterministic
   bookkeeping computation, never automation.** When every step in a
   workflow's own static catalog definition has been checked off by the
   user, `updateWorkflowInstanceStep()` flips the instance's own `status`
   field from `"active"` to `"completed"` and stamps `completedAt`. This is
   identical in kind to a to-do list marking itself "done" once every item
   is checked — it never calls any trading, execution, or automation code
   path, and a dedicated route test (`portfolioWorkspace.route.test.ts`)
   proves a workflow instance never changes anything about the user's own
   portfolio, positions, or trades.

## What is genuinely new vs. reused, at a glance

This phase introduces **zero new scoring or valuation formulas.** The only
genuinely new code is:

1. **Holdings/Trading/Options Overview composition**
   (`buildHoldingsOverview()`/`buildTradingOverview()`/
   `buildOptionsOverview()`) — a plain reformatting of already-computed
   Risk & Exposure / Performance figures into lean headline cards, plus a
   `top 5 by weight` sort (a display convenience, not a new score).
2. **Outstanding Issues merge** (`mergeOutstandingIssues()`) — a plain
   relabel-and-concatenate of three engines' own already-computed issue
   lists (Decision Support's `outstandingIssues`, Watchlists' own
   `dashboardSummary.outstandingIssues`, Compliance's own
   `policyViolations`) into one list with a `source` tag — never a new
   score, never a ranking.
3. **The Workflow Center catalog and instance-tracking bookkeeping**
   (`lib/portfolioWorkflows.ts`) — deterministic, static step definitions
   and a plain checklist-completion state machine.
4. **Pinned Resources / Recently Viewed CRUD** (`lib/workspacePins.ts`) —
   plain persistence, no scoring.

## Never blended across engines

Every cross-engine-adjacent figure in this phase deliberately keeps
Investing/Trading/Options figures **separate**, never summed into one
blended total — the same discipline every prior cross-engine dashboard in
this project (Phases 37–43) already established:

- Holdings Overview, Trading Overview, and Options Overview are three
  genuinely separate cards, each honestly independent of the others'
  availability — never combined into one "total position" figure.
- The Executive Home / Portfolio Snapshot section is reused wholesale from
  the Decision Support Engine, which already established this discipline
  at Phase 40 (its own `capitalAllocationSummary` keeps Investing/Trading/
  Options entries separate) — this phase introduces no new blending logic
  on top of it.

## The Portfolio Workspace's honesty guarantees

- Every overview section honestly reflects zero-state (no holdings, no
  open positions, no watchlists) rather than a fabricated non-zero
  default — proven by dedicated "brand-new user" route tests.
- Outstanding Issues is an honestly empty array — never a fabricated
  "all clear" banner distinct from a genuinely empty list — when no
  engine reports any issue.
- A workflow instance's steps are exactly the catalog definition's own
  step keys — `updateWorkflowInstanceStep()` returns 404 (not a silent
  no-op) for a step key that isn't part of that workflow's own
  definition, never fabricating progress on a step that doesn't exist.
- No resource is ever auto-pinned and no view is ever auto-recorded —
  every row in `workspace_pinned_resources`/`workspace_recent_views`
  originates from an explicit user or explicit-navigation action.

## What was deliberately NOT built

- **No trade recommendations, buy/sell signals, or suggested trades.**
  Every figure describes a real, already-computed current state — never
  an instruction to act.
- **No portfolio optimisation, auto rebalancing, or auto execution.** This
  phase reads, aggregates, and presents — it never writes to a trade,
  position, or order, and never calls any execution-adjacent code.
- **No AI predictions, forecasting, or machine learning.** Every figure is
  either a direct reuse of an already-computed value or plain
  deterministic arithmetic. The AI Coach's own 5 explanations are
  deterministic, template-based prose about concepts only, enforced
  structurally since `explainWorkspaceTopic()`'s own signature takes only
  a topic key, never a symbol, position, or account figure.
- **No workflow ever executes anything.** Starting a workflow instance
  creates a tracked checklist; checking off a step is a plain database
  write to that instance's own row — no function anywhere in
  `lib/portfolioWorkflows.ts` calls a trading, execution, or automation
  code path.
- **No auto-pinning, no auto-recorded views.** Every pin and every
  recently-viewed entry originates from an explicit, traceable user
  action.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and every broker-integration file were not modified
by any file in this phase. `lib/decisionSupportEngine.ts`,
`lib/riskExposureEngine.ts`, `lib/performanceAttribution.ts`,
`lib/rebalancingEngine.ts`, `lib/complianceEngine.ts`, and
`lib/watchlistsEngine.ts` were also not modified — reused verbatim.

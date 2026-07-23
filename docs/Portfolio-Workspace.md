# Institutional Portfolio Workspace & Workflow Center

Phase 44 — a unified operating interface for portfolio managers, bringing
together every completed engine into a single workflow-driven dashboard.

**This phase is orchestration and workflow only.** Nothing here implements
or evaluates trade recommendations, buy/sell signals, AI predictions,
portfolio optimisation, auto execution, auto hedging, machine learning, or
market forecasting. Every figure shown is reused verbatim from an
already-shipped, already-tested engine — see
`docs/Institutional-Workspace-Model.md` for the full design and audit
record, and `docs/Workflow-Center.md` for the Workflow Center specifically.

## Where to find it

`/portfolio-workspace`, linked from the sidebar navigation, the Command
Palette (inherits the nav entry automatically), the Investing Executive
Dashboard, the Executive Intelligence Hub, the Cross-Engine Workspace's own
Workspace Shortcuts, and the Institutional Reporting Centre (two new
report types).

## Audit summary — what already existed vs. what this phase added

Before writing any code, the following reusable components were confirmed
present and load-bearing for this phase (full detail in
`docs/Institutional-Workspace-Model.md`):

| Component | Reused for |
|---|---|
| `lib/decisionSupportEngine.ts`'s `buildDecisionSupportDashboard()` (Phase 40) | Executive Home + Portfolio Snapshot, reused wholesale, never recomputed |
| `lib/riskExposureEngine.ts`'s `buildRiskExposureDashboard()` (Phase 37) | Risk Overview, plus headline figures on Holdings/Trading/Options Overview |
| `lib/performanceAttribution.ts`'s `buildPerformanceDashboard()` (Phase 38) | Performance Overview, plus headline figures on Holdings/Trading/Options Overview |
| `lib/rebalancingEngine.ts`'s `buildRebalancingDashboard()` (Phase 41) | Drifted-holdings headline count on Holdings Overview |
| `lib/complianceEngine.ts`'s `buildMonitoringComplianceDashboard()` (Phase 42) | Compliance Overview (a lean summary) |
| `lib/watchlistsEngine.ts`'s `buildWatchlistsDashboard()` (Phase 43) | Watchlists Overview (a lean summary) |
| `lib/executiveIntelligence.ts`'s `buildReportingSummary()` | Recent Reports |

**Genuine gap found:** no existing table tracked multi-step review-process
progress, cross-resource-type pinning, or a bounded recently-opened log.
Three new tables (`portfolio_workflow_instances`,
`workspace_pinned_resources`, `workspace_recent_views`) fill this gap.

## Views

The main page (`PortfolioWorkspace.tsx`), with 5 tabs: Dashboard, Workflow
Center, Workspace, Coach & Learning, Reporting.

### Dashboard

- **Executive Home** — the Decision Support Engine's own executive summary,
  reused wholesale.
- **Portfolio Snapshot** — the full Decision Support Dashboard (risk,
  performance, scenario, capital allocation, exposure, diversification
  summaries, executive alerts, key metrics, executive health).
- **Holdings / Trading / Options Overview** — lean headline cards (counts,
  totals, top allocations, drift/discipline figures) rather than a
  duplicate of the full Risk/Performance dashboards already exposed under
  their own named sections below.
- **Risk Overview** — the full Risk & Exposure Dashboard (Investing/
  Trading/Options/Combined).
- **Performance Overview** — the full Performance & Attribution Dashboard.
- **Compliance Overview** — a lean summary (compliance summary counts +
  policy violations); the full per-category detail lives on its own
  dedicated page.
- **Watchlists Overview** — a lean summary (watchlist list, health,
  cross-engine summary, dashboard summary); the full Opportunity Overview
  detail lives on its own dedicated page.
- **Recent Reports** — the calling user's own most recently generated
  Institutional Reports.
- **Active Workflows** — in-progress Workflow Center instances.
- **Outstanding Issues** — a merged, relabeled (never re-scored) list drawn
  from Decision Support's own outstanding issues, Watchlists' own
  dashboard-summary issues, and Compliance's own policy violations, each
  tagged with its originating source and a deep link back to that engine's
  own page.

Because every one of these dashboards is a whole-portfolio read (never a
per-symbol external provider fetch), the entire dashboard is built eagerly
in one call — see `lib/portfolioWorkspace.ts`'s own header comment.

### Workflow Center

See `docs/Workflow-Center.md` for the full design. In brief: a static
9-workflow catalog (Morning/Weekly/Monthly/Quarterly/Portfolio/Risk/
Compliance/Performance/Scenario Review), each with 3-5 steps that deep-link
into an already-shipped page. Starting a workflow creates a per-user
instance; checking off steps is plain bookkeeping — completing every step
deterministically flips the instance to "completed," never an automated
action.

### Workspace

- **Quick Actions** — a fixed, curated list of 7 navigation shortcuts into
  already-shipped surfaces.
- **Favorites (Pinned Resources)** — pin any dashboard, report, watchlist,
  strategy, or learning topic by resource type + key; unpin and manually
  reorder.
- **Recently Viewed** — the last 20 resources opened from within the
  Portfolio Workspace itself (its own quick actions, pinned-resource links,
  recent-report links, and workflow-step links) — never a global,
  every-page-in-the-app view tracker.

### Coach & Learning

AI Coach explanations and Learning Centre links for institutional
operating processes — see below.

### Reporting

A link into the Reporting Centre, which now carries two new report types
generated from this workspace's own dashboard.

## AI Coach & Learning Centre

`lib/workspaceCoach.ts` — 5 deterministic, template-based explanations
(portfolio review workflows, institutional operating processes, review
cycles, governance, reporting), reusing the platform's existing
`COACH_DISCLAIMER` unmodified. **Never a trade recommendation** — enforced
structurally, since `explainWorkspaceTopic()`'s own signature takes only a
topic key, never a symbol, position, or account figure.

`lib/workspaceLearning.ts` connects each of 6 distinct topics (portfolio
workflows, institutional review process, governance, monitoring,
performance review, risk review) to real, already-existing Learning Centre
content — zero duplicated lesson content. Deliberately a separate topic
list from the Coach's own 5 topics, per the kickoff's own two distinct
lists.

## Reporting Centre integration

Two new report types, both pure reformats of the same
`PortfolioWorkspaceDashboard`:

- **Portfolio Workspace Summary** (`GET /reporting/portfolio-workspace-summary`)
  — 7 sections: Executive Home, Holdings Overview, Trading Overview,
  Options Overview, Active Workflows, Recent Reports, Outstanding Issues.
- **Institutional Review Report** (`GET /reporting/institutional-review-report`)
  — 6 sections: Portfolio Health, Risk Overview, Compliance Overview,
  Watchlists Overview, Active Workflows, Outstanding Issues — the
  natural "generate a review record" step at the end of the Monthly and
  Quarterly Review workflows.

Both are pure reformats — zero new scoring, valuation, or aggregation logic
beyond what `buildPortfolioWorkspaceDashboard()` already computed.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/portfolio-workspace/dashboard` | The full Portfolio Workspace Dashboard for the calling user |
| GET | `/portfolio-workspace/workflows` | The static 9-workflow catalog |
| GET | `/portfolio-workspace/workflows/instances` | The calling user's own workflow instances (`?status=` optional) |
| POST | `/portfolio-workspace/workflows/:key/start` | Start a new instance of a catalog workflow |
| PATCH | `/portfolio-workspace/workflows/instances/:id` | Toggle a step's completion, or set status (active/abandoned) |
| DELETE | `/portfolio-workspace/workflows/instances/:id` | Delete a workflow instance |
| GET | `/portfolio-workspace/pins` | The calling user's own pinned resources |
| POST | `/portfolio-workspace/pins` | Pin a resource (409 on duplicate) |
| DELETE | `/portfolio-workspace/pins/:id` | Unpin a resource |
| POST | `/portfolio-workspace/pins/reorder` | Manually reorder pinned resources |
| GET | `/portfolio-workspace/recent-views` | The calling user's own recently viewed resources (most recent 20) |
| POST | `/portfolio-workspace/recent-views` | Record a resource as viewed |
| GET | `/portfolio-workspace/quick-actions` | The static Quick Actions list |
| GET | `/portfolio-workspace/coach` | All 5 AI Coach explanations |
| GET | `/portfolio-workspace/coach/:topic` | One explanation (404 for unknown topic) |
| GET | `/portfolio-workspace/learning` | All 6 topics' own Learning Centre links |
| GET | `/portfolio-workspace/learning/:topic` | One topic's links (404 for unknown topic) |
| GET | `/reporting/portfolio-workspace-summary` | Portfolio Workspace Summary Report |
| GET | `/reporting/institutional-review-report` | Institutional Review Report |

`GET /portfolio-workspace/dashboard` is deliberately a **GET**, matching
every prior engine's own established GET-only precedent for a dashboard
that takes no caller-supplied input beyond the authenticated user's own
identity.

## Testing

- `lib/workspaceCoach.test.ts` / `lib/workspaceLearning.test.ts` — pure
  unit tests for the deterministic coach/learning modules, mirroring the
  established `watchlistsCoach.test.ts`/`watchlistsLearning.test.ts`
  pattern.
- `routes/portfolioWorkspace.route.test.ts` — 13 live end-to-end HTTP tests
  against a real Postgres connection and the real Better-Auth instance:
  the honest empty dashboard, Holdings Overview byte-consistency with the
  Risk & Exposure Engine, Outstanding Issues merged from Compliance, a
  structural no-fabrication text scan, the full 9-workflow catalog, the
  full workflow instance lifecycle (start / list-active / toggle-steps /
  auto-complete-on-last-step / delete), 404s for an unknown workflow key
  and cross-user instance access, a proof that starting/completing a
  workflow never mutates any portfolio data, the full pin/unpin lifecycle
  (including a duplicate-pin 409 and manual reorder), recent-views
  dedup-by-most-recent, the static quick-actions list, the AI Coach (5
  topics + 404), and the Learning Centre (6 topics + 404).
- `routes/institutionalReporting.route.test.ts` was extended (not
  rewritten) to cover the 2 new report types and the updated report-type
  count (30 → 32).
- `pages/PortfolioWorkspace.test.tsx` — 10 frontend smoke tests following
  the established mocked-generated-hook pattern.
- `lib/tenantIsolation.test.ts` was extended (not rewritten) with new
  `portfolio_workflow_instances` / `workspace_pinned_resources` /
  `workspace_recent_views` cases, reusing the established
  `assertTenantIsolation` helper unchanged.

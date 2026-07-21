# Institutional Watchlists & Opportunity Dashboard

Phase 43 — a deterministic engine for organising assets into named,
taggable, manually-orderable watchlists and monitoring them using the
existing Investing, Trading, Options, Risk, Performance, Scenario, and
Compliance engines.

**This phase provides monitoring and organisation only.** Nothing here
implements or evaluates buy/sell recommendations, AI predictions, trade
signals, portfolio optimisation, auto execution, auto watchlist
generation, or machine learning. Every current value shown for a watched
symbol is reused verbatim from an already-shipped, already-tested engine —
see `docs/Institutional-Watchlists-Model.md` for the full design and audit
record.

## Where to find it

`/watchlists-engine`, linked from the sidebar navigation, the Command
Palette (inherits the nav entry automatically), the Investing Executive
Dashboard, the Executive Intelligence Hub, the Cross-Engine Workspace's own
Workspace Shortcuts, and the Institutional Reporting Centre (two new report
types). The Learning Centre overview is reached indirectly — every Coach &
Learning topic links out to real, already-existing Learning Centre content,
never a new lesson page.

## Audit summary — what already existed vs. what this phase added

Before writing any code, the following reusable components were confirmed
present and load-bearing for this phase (full detail in
`docs/Institutional-Watchlists-Model.md`):

| Component | Reused for |
|---|---|
| `lib/riskExposureEngine.ts`'s `buildRiskExposureDashboard()` (Phase 37) | Per-symbol Investing allocation, per-symbol Options allocation, capital allocation, Greeks (portfolio-wide), the Compliance Timeline |
| `lib/performanceAttribution.ts`'s `buildPerformanceDashboard()` (Phase 38) | Per-holding/per-position/per-trade Performance |
| `lib/scenarioEngine.ts`'s `buildScenarioDashboard()` (Phase 39) | Per-holding/per-position Scenario impact under the platform's own default shock scenarios |
| `lib/decisionSupportEngine.ts`'s `buildDiversificationSummary()` (Phase 40) | Investing/Options diversification scores |
| `lib/complianceEngine.ts`'s `evaluatePolicy()` (Phase 42) | Per-policy compliance status, filtered by target symbol |
| `lib/coach.ts`'s `positionGreeks()` | Summed over a watched symbol's own open Options legs |

**Genuine gap found:** the existing `value_watchlist` table (Phase 2,
Investing Engine) is a single flat per-user list — no support for multiple
named lists, categories, tags, or manual ordering. New
`investing_watchlists`/`investing_watchlist_items` tables fill this gap,
left entirely separate from `value_watchlist` (never touched, never
migrated).

## Views

The main page (`WatchlistsEngine.tsx`), with 5 tabs: Watchlists Dashboard,
Manage Watchlists, Opportunity Overview, Coach & Learning, Reporting.

### Watchlists Dashboard

- **Dashboard Summary** — watchlist count, watched-symbol count (distinct
  and total), held-somewhere count, and the number of enabled compliance
  policies currently in breach.
- **Highest Risk / Exposure / Allocation** — the single watched, held
  symbol with the largest worst-case scenario impact, the largest
  Investing/Options allocation weight, and the largest Investing market
  value, respectively — each honestly `null` when no watched symbol is
  held anywhere.
- **Outstanding Issues** — a deterministic list of real, disclosed
  conditions (e.g. "N watched symbol(s) are not currently held in any
  engine", "N enabled compliance policy(ies) are currently in breach").
- **Watchlist Health** — per-watchlist rollup: item count, held count,
  breach count, total market value, total unrealized P&L.
- **Cross-Engine Summary** — Capital Allocation (Investing/Trading/Options,
  never blended), Investing/Options Diversification scores, the
  Compliance Summary's counts, and Executive Health (the Options Engine's
  own already-computed `healthScore`/`overallRiskRating`).

### Manage Watchlists

Create/rename/archive/delete/reorder watchlists; add/remove/reorder
symbols within a watchlist, each with its own category, tags, and notes.
"Personal" and "Institutional" are watchlist **type labels** a user
chooses for their own organisational purposes — both remain owned by and
scoped to the single authenticated user; this platform has no multi-user
sharing model, and none is introduced here. Nothing is ever auto-created —
every watchlist and every item originates from an explicit user action.

### Opportunity Overview

Every distinct watched symbol's own allocation, performance, Greeks
(where applicable), scenario impact, and compliance status — reused
directly from the engines above. A symbol not currently held anywhere is
shown honestly as "not currently held in any engine," never fabricated.
This is a descriptive snapshot only — never a ranked or scored "buy this"
signal. See `docs/Opportunity-Dashboard.md` for the full per-field
breakdown.

## AI Coach & Learning Centre

`lib/watchlistsCoach.ts` — 5 deterministic, template-based explanations
(watchlists, research workflow, institutional monitoring, portfolio
organisation, asset tracking), reusing the platform's existing
`COACH_DISCLAIMER` unmodified. **Never a trade recommendation** — enforced
structurally, since `explainWatchlistsTopic()`'s own signature takes only a
topic key, never a symbol, position, or account figure.

`lib/watchlistsLearning.ts` connects each of 6 distinct topics (watchlists,
portfolio monitoring, asset research, institutional workflows,
diversification, capital allocation) to real, already-existing Learning
Centre content — zero duplicated lesson content. Deliberately a separate
topic list from the Coach's own 5 topics, per the kickoff's own two
distinct lists.

## Reporting Centre integration

Two new report types, both pure reformats of the same `WatchlistsDashboard`:

- **Watchlist Summary Report** (`GET /reporting/watchlist-summary-report`)
  — the dashboard-level rollup: Watchlist Overview, Watchlist Health, the
  Cross-Engine Summary, and the Dashboard Summary.
- **Opportunity Dashboard Report**
  (`GET /reporting/opportunity-dashboard-report`) — the full per-symbol
  Opportunity Overview.

Both are deliberately distinct from the existing `"watchlist"` report type
(the separate, flat price/margin-of-safety `value_watchlist` system) and
`"opportunity-discovery"` report type (a universe-wide screening scan) —
never a naming or scope collision with either.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/investing/watchlists/dashboard` | The full Watchlists & Opportunity Dashboard for the calling user |
| GET | `/investing/watchlists` | The calling user's own watchlists |
| POST | `/investing/watchlists` | Create a new watchlist |
| POST | `/investing/watchlists/reorder` | Manually reorder the calling user's own watchlists |
| GET | `/investing/watchlists/:id` | One watchlist by id, with its own items |
| PATCH | `/investing/watchlists/:id` | Update a watchlist |
| DELETE | `/investing/watchlists/:id` | Delete a watchlist (cascades to its own items) |
| POST | `/investing/watchlists/:id/items` | Add a symbol to a watchlist |
| POST | `/investing/watchlists/:id/items/reorder` | Manually reorder items within a watchlist |
| PATCH | `/investing/watchlists/:id/items/:itemId` | Update a watched symbol's own category/tags/notes/order |
| DELETE | `/investing/watchlists/:id/items/:itemId` | Remove a symbol from a watchlist |
| GET | `/investing/watchlists/coach` | All 5 AI Coach explanations |
| GET | `/investing/watchlists/coach/:topic` | One explanation (404 for unknown topic) |
| GET | `/investing/watchlists/learning` | All 6 topics' own Learning Centre links |
| GET | `/investing/watchlists/learning/:topic` | One topic's links (404 for unknown topic) |
| GET | `/reporting/watchlist-summary-report` | Watchlist Summary Report |
| GET | `/reporting/opportunity-dashboard-report` | Opportunity Dashboard Report |

`GET /investing/watchlists/dashboard` is deliberately a **GET**, matching
`GET /compliance/dashboard`'s and every prior engine's own established
GET-only precedent for a dashboard that takes no caller-supplied input
beyond the authenticated user's own identity.

## Testing

- `lib/watchlistsCoach.test.ts` / `lib/watchlistsLearning.test.ts` — pure
  unit tests for the deterministic coach/learning modules, mirroring the
  established `complianceCoach.test.ts`/`complianceLearning.test.ts`
  pattern.
- `routes/watchlists.route.test.ts` — live end-to-end HTTP tests against a
  real Postgres connection and the real Better-Auth instance: watchlist
  and item CRUD lifecycles (including duplicate-symbol 400s and cascade
  deletion), reorder endpoints, the honest empty dashboard, a symbol
  honestly reported as not held, per-symbol analytics proven
  byte-consistent against `GET /risk-exposure/dashboard`'s own output, a
  real compliance breach surfaced end-to-end, the AI Coach and Learning
  Centre endpoints (including 404s for unknown topics), and a structural
  scan proving no trade recommendation/buy-sell-signal language ever
  appears in any response.
- `routes/institutionalReporting.route.test.ts` was extended (not
  rewritten) to cover the 2 new report types and the updated report-type
  count (28 → 30).
- `pages/WatchlistsEngine.test.tsx` — frontend smoke tests following the
  established mocked-generated-hook pattern.
- `lib/tenantIsolation.test.ts` was extended (not rewritten) with new
  `investing_watchlists`/`investing_watchlist_items` cases, reusing the
  established `assertTenantIsolation` helper unchanged.

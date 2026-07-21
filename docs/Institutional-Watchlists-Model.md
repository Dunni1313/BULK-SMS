# Institutional Watchlists Model — Design & Audit Record (Phase 43)

The exact design decisions behind `lib/watchlists.ts` and
`lib/watchlistsEngine.ts`, kept as a permanent record for future phases,
mirroring the role `docs/Institutional-Governance-Model.md` plays for
Phase 42, `docs/Institutional-Rebalancing-Model.md` plays for Phase 41,
and `docs/Institutional-Decision-Model.md` plays for Phase 40.

## Guiding constraint

The Phase 43 kickoff was explicit: **this phase is monitoring and
organisation only.** Do NOT implement buy/sell recommendations, AI
predictions, trade signals, portfolio optimisation, auto execution, auto
watchlist generation, or machine learning. Every figure below was designed
against that constraint first — every value is either (a) reused verbatim
from an existing, already-computed engine output, or (b) a plain,
deterministic aggregation over already-computed figures (Watchlist Health,
Cross-Engine Summary, the dashboard-level highlights) — never a scoring
model, never a ranking implying "buy this."

## Audit performed before implementation

Before writing any code, the following components were investigated via
direct source reads, per the kickoff's own required audit.

### INVESTING

| Component | Investigated for | Verdict |
|---|---|---|
| Portfolio Dashboard (`lib/portfolioDashboard.ts`, Options-side) | Health-scoring shape | Not an Investing surface — reused only for `healthScore`/`overallRiskRating` as "Executive Health" |
| Risk & Exposure Engine (`lib/riskExposureEngine.ts`, Phase 37) | Per-symbol Investing/Options allocation, Greeks, capital allocation | **Reused directly** — the single largest reuse target this phase has |
| Performance Engine (`lib/performanceAttribution.ts`, Phase 38) | Per-symbol performance | **Reused directly** — genuinely per-holding/per-position/per-trade |
| Scenario Engine (`lib/scenarioEngine.ts`, Phase 39) | Per-symbol scenario impact | **Reused directly** for Investing/Trading holdings, which carry a clean per-position `impactDollars`; Options' own scenario view models rate shocks/a portfolio-level stress test, not a comparable per-symbol figure — honestly excluded rather than approximated |
| Decision Support Engine (`lib/decisionSupportEngine.ts`, Phase 40) | Diversification scoring | **Reused directly** — `buildDiversificationSummary()`, portfolio-wide only, surfaced once at the dashboard level |
| Compliance Engine (`lib/complianceEngine.ts`, Phase 42) | Per-policy compliance status | **Reused directly** — `evaluatePolicy()` is called with the exact same context shape (`risk`, `diversification`, `optionsThetaMonthly`) the Compliance Engine itself builds internally, filtered here by `targetKey` matching the watched symbol |

### TRADING

| Component | Investigated for | Verdict |
|---|---|---|
| Trading Analytics (`lib/tradingAnalytics.ts`) | A policy-adjacent concept | Investigated; no reusable per-symbol concept beyond what Performance/Risk already surface |
| Trading Risk Engine (`lib/tradingRisk.ts`) | Per-position dollar risk | Investigated; the Risk & Exposure Engine's own already-computed Trading view (open-position presence, account value) was sufficient for this phase's own per-symbol fields — a bespoke per-position dollar-risk read was judged out of scope for a monitoring/organisation phase |

### OPTIONS

| Component | Investigated for | Verdict |
|---|---|---|
| Options Income Engine (`lib/optionsIncomeAnalytics.ts`, Phase 35) | Income Stability's own inputs | Reused transitively via the Compliance Engine's own context, not directly |
| Position Lifecycle (`lib/optionsLifecycle.ts`) | Per-symbol lifecycle state | Investigated; lifecycle tracking is position-state-oriented, not a watchlist-analytics concept — not applicable to this phase's scope |
| Greeks | Per-symbol Greeks | **Reused directly** via `lib/coach.ts`'s own `positionGreeks()` primitive, summed over a watched symbol's own open Options legs — a genuinely new query (open trades' own `legs` column, not previously read outside `performanceAttribution.ts`'s own private helper), but zero new pricing/scoring logic |
| Portfolio Exposure | Per-symbol Options allocation | **Reused directly** via `risk.options.dashboard.allocationBySymbol` |

### SHARED

| Component | Investigated for | Verdict |
|---|---|---|
| Executive Dashboard / Executive Intelligence / Cross-Engine Workspace | Integration surfaces | **Extended** — one new deep link each, mirroring the exact pattern Phase 42's own Monitoring & Compliance Engine link established |
| Reporting Centre (`lib/institutionalReporting.ts`) | Report-generation framework | **Reused directly** — the existing `ReportSection`/`InstitutionalReport` shape, `REPORT_TYPE_META` array, and `regenerate()` dispatcher, extended with 2 new entries each |
| Learning Centre (`lib/learningPaths.ts`) | Existing topic content | **Reused directly** — every Watchlists Learning link resolves a real, already-existing topic key, verified to exist before use |
| Institutional AI Coach (`lib/coach.ts`) | The shared disclaimer contract | **Reused directly** — `COACH_DISCLAIMER`, imported unmodified |
| Navigation / Command Palette (`lib/nav-items.ts`) | The single navigation index | **Extended** — one new `NavItem`; the Command Palette and sidebar both read this same array, so no second wiring point was needed |

**Genuine gap found, and how it was resolved:** no existing table anywhere
in this codebase supports multiple named, taggable, manually-orderable
watchlists. The existing `value_watchlist` table (Phase 2, Investing
Engine) was investigated and found to be a **different, simpler
concept entirely** — a single flat per-user list of symbols with
price/margin-of-safety target fields, no lists, no tags, no categories, no
manual ordering. New `investing_watchlists`/`investing_watchlist_items`
tables fill this gap, deliberately named distinctly and left completely
separate — never a migration of `value_watchlist`'s own data, never a
shared code path.

## Design decisions made without blocking (disclosed here, per established precedent)

1. **"Personal" vs "Institutional" are watchlist type labels, not a real
   multi-user construct.** This platform has no multi-user sharing or
   permission model anywhere in its 43 phases — every "Institutional X"
   feature built so far has been per-user/single-tenant. `kind` is a
   free-text column (matching `compliance_policies.policy_type`'s own
   established free-text-not-enum precedent) a user sets on their own
   watchlist purely for their own organisational purposes; both kinds
   remain owned by and scoped to the single authenticated user.
2. **The Opportunity Overview and full dashboard are eager, not
   on-demand**, unlike Phase 2's Statements/Peers/Filings modules. Those
   modules are on-demand specifically because they cost one provider call
   per peer/document; every engine this phase reuses is a whole-portfolio
   dashboard already, so per-symbol analytics cost zero additional
   provider calls regardless of watchlist size.
3. **Reporting Centre naming collision avoidance.** The existing
   `"watchlist"` report type (Phase 2's own flat `value_watchlist` system)
   and `"opportunity-discovery"` report type (a universe-wide screening
   scan) both already existed. The new report types are named
   `"watchlist-summary-report"`/`"opportunity-dashboard-report"` —
   genuinely distinct strings, verified collision-free before codegen, no
   repeat of any prior phase's own schema-naming incident.

## What is genuinely new vs. reused, at a glance

This phase introduces **zero new scoring or valuation formulas.** The only
genuinely new code is:

1. **Per-symbol analytics composition** (`buildSymbolAnalytics()`) — a
   pure `find()`/`filter()` lookup across each already-fetched engine's
   own already-computed arrays, keyed by symbol. No new arithmetic beyond
   summing an array of already-computed dollar/percentage figures.
2. **Watchlist Health** and **Cross-Engine Summary** — plain rollups
   (counts, sums) over the per-symbol analytics array and the already-
   computed `RiskExposureDashboard`/`DiversificationSummary`.
3. **The dashboard-level highlights** (Highest Risk/Exposure/Allocation) —
   a plain `reduce()` max/min over the per-symbol analytics array.

## Never blended across engines

Every cross-engine-adjacent figure in this phase deliberately keeps
Investing/Trading/Options figures **separate**, never summed into one
blended total — the same discipline every prior cross-engine dashboard in
this project (Phases 37–42) already established:

- A watched symbol's own `investing`/`trading`/`options` analytics are
  three genuinely separate objects, each honestly `null` independent of
  the others' availability — never combined into one "total position"
  figure.
- Capital Allocation in the Cross-Engine Summary reuses
  `risk.combined.capitalAllocation` verbatim (Investing market value /
  Trading account value / Options portfolio value, kept as three separate
  entries) — never re-summed into a blended total.

## The Watchlists Engine's honesty guarantees

- A symbol's `heldInInvesting`/`heldInTrading`/`heldInOptions` and every
  nested analytics object are honestly `false`/`null` — never fabricated
  — whenever the symbol genuinely isn't resolved in that engine's own
  already-computed data.
- `compliance` is `null` (no policy targets this symbol) — a genuinely
  different meaning from the Compliance Engine's own `unavailable` status
  (a policy exists but its current value couldn't be resolved) — the two
  are never conflated.
- The dashboard-level highlights (Highest Risk/Exposure/Allocation) are
  `null` — never a fabricated "top pick" — when zero watched symbols are
  held anywhere.
- No opportunity, watchlist, or item is ever auto-created — every row
  originates from an explicit user action (create watchlist, add symbol).

## What was deliberately NOT built

- **No trade recommendations, buy/sell signals, or suggested trades.**
  Every analytics field describes a real, already-computed current
  state — it describes what *is*, never what to *do*.
- **No portfolio optimisation, auto rebalancing, or auto execution.** This
  phase reads, aggregates, and presents — it never writes to a trade,
  position, or order, and never calls any execution-adjacent code.
- **No AI predictions, forecasting, or machine learning.** Every figure is
  either a direct reuse of an already-computed value or plain
  deterministic arithmetic — no statistical model, no trained model, no
  probability distribution. The AI Coach's own 5 explanations are
  deterministic, template-based prose about concepts only, enforced
  structurally since `explainWatchlistsTopic()`'s own signature takes only
  a topic key, never a symbol, position, or account figure.
- **No auto watchlist generation.** No code path anywhere in this phase
  creates a watchlist or adds an item without an explicit, traceable user
  action (a `POST` request).
- **No ranked or scored "opportunity" signal.** The Opportunity Overview
  is presented in deterministic discovery order, never sorted by an
  implied "best opportunity first" — see `docs/Opportunity-Dashboard.md`
  for the full discussion.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and every broker-integration file were not modified
by any file in this phase. `lib/riskExposureEngine.ts`,
`lib/performanceAttribution.ts`, `lib/scenarioEngine.ts`,
`lib/decisionSupportEngine.ts`, and `lib/complianceEngine.ts` were also
not modified — reused verbatim. The existing `value_watchlist` table and
its own routes (`routes/stockAnalyst.ts`'s Value Watchlist CRUD) were not
touched.

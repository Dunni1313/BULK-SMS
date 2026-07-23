# Institutional Command Center

This document covers the Institutional Command Center as it exists
after the **Institutional Command Center** sprint. It is a companion to
`docs/Alpaca-Paper-Trading-Architecture.md` §4.15, which covers the same
sprint at a higher level alongside the rest of the Alpaca integration —
read that document for the broader architectural context.

---

## 1. What this is

The application's primary landing page, mounted at `/` — a single
executive workspace consolidating every existing dashboard in this
platform into 8 sections. **This sprint adds zero new backend routes,
zero new database queries, and zero new calculations of any kind.**
Every figure on this page is a direct, unmodified reuse of a `GET`
request another page in this codebase already makes. This is the
strongest possible reading of this sprint's own "do not rewrite existing
analytics, do not duplicate calculations, reuse existing pages, APIs and
components wherever possible" instruction — the entire sprint is a
frontend-only composition, confirmed by `git diff --stat` showing no new
backend files at all (aside from one small, additive extension to the
Portfolio Dashboard sprint's own response shape — see §4).

---

## 2. Not to be confused with `/institutional-dashboard`

This codebase already had a pre-existing page at `/institutional-dashboard`
(a separate, earlier sprint's own cross-engine composition covering
Market Structure, Multi-Timeframe, Regime, and Probability signals for
this platform's stock-research/trading-signal surfaces). **The new
Command Center is a deliberately distinct page, scoped entirely to this
platform's own Paper Trading options-income portfolio** — the two are
never merged, and this document exists specifically to disclose the
naming similarity rather than let it cause confusion, the same
"distinct-but-related surfaces, disclosed, not merged" precedent this
codebase has followed before for other similarly-named pairs of pages.

---

## 3. Data sources — one hook per section, all pre-existing

| Section | Hook(s) reused | Originally built for |
|---|---|---|
| 1. Executive Overview | `useGetPortfolioDashboard()`, `useGetPortfolioSummary()`, `useGetThetaIncome()` | Portfolio Risk Dashboard sprint; `pages/Dashboard.tsx` |
| 2. Portfolio Health | `useGetPortfolioDashboard()` — its own `widgets[]` array, unmodified | Portfolio Risk Dashboard sprint |
| 3. Options Income Engine | `useGetPerformanceAnalytics({ period: "all" })`, `useGetThetaIncome()`, `useGetPortfolioDashboard()`'s own `allocationByStrategy` | `pages/TradePerformance.tsx`, `pages/Dashboard.tsx`, Correlation & Concentration Overlay |
| 4. Greeks Summary | `useGetPortfolioGreeks()`, `useGetPortfolioDashboard()`'s own `netBeta`/`netBetaUnavailableReason` | `pages/Portfolio.tsx` |
| 5. Risk Alerts | `useGetPortfolioDashboard()`'s own `guidance[]` and `stressTestSummary[]` | Portfolio Risk Dashboard sprint |
| 6. Portfolio Allocation | `useGetPortfolioDashboard()`'s own 4 allocation bucket arrays | Correlation & Concentration Overlay |
| 7. Broker | `useGetPortfolioDashboard()`'s own `credentialsConfigured`/`brokerConnected`/`lastBrokerCheckAt` | Broker Health sprint (cached state) |
| 8. AI Insights | Client-side synthesis over the data the sections above already fetched, plus `useGetTopOpportunities()` | `pages/Dashboard.tsx`'s own "topPick" derivation |

**`useGetPortfolioDashboard()` alone satisfies the majority of this
page** — Sections 1, 2, 4 (Beta), 5, 6, and 7 are almost entirely built
from its already-computed response, since that sprint's own explicit
purpose was to unify Position Sizing, the Portfolio Stress Test, the
Event Risk Overlay, and the Correlation & Concentration Overlay into one
payload. This sprint discovered that unification was already the right
shape for a landing page and simply reused it.

---

## 4. One small, additive backend extension — not a new calculation

`lib/portfolioDashboard.ts`'s own `PortfolioDashboardResult` did not
previously surface `netBeta`/`netBetaUnavailableReason` on its top-level
response, even though the `concentration` object it already receives
internally (from `buildPortfolioConcentrationOverlay()`, unmodified)
always carries both fields. This sprint added exactly those 2 fields to
the response type and its `openapi.yaml` schema, populated by directly
assigning `concentration.netBeta`/`concentration.netBetaUnavailableReason`
— **zero new computation, a pure surface-level exposure of an
already-computed value from a prior sprint**, needed so the Command
Center's own Greeks Summary section can honestly disclose Beta's
permanent unavailability without a second network call.

No other backend file was touched. `lib/portfolioStressTest.ts`,
`lib/portfolioEventRisk.ts`, and `lib/portfolioConcentration.ts` all
remain zero-line diff, as they have been since their own respective
sprints.

---

## 5. Section-by-section detail

### 5.1 Executive Overview
Portfolio Value, Buying Power, Portfolio Health Score, and Overall Risk
Rating are the same fields `pages/PortfolioDashboard.tsx` already shows,
reused via the same hook. Daily P/L is `useGetPortfolioSummary()`'s own
`dayPnl` — the exact field `pages/Dashboard.tsx`'s own "Day P&L" card
already displays. Total Theta Income shows `useGetThetaIncome()`'s own
`monthly` figure, honestly labeled "(Monthly)" to avoid implying a
realized, collected total (see §5.3 for the genuinely realized figure).
Broker Status and Paper Trading Status reuse `useGetPortfolioDashboard()`'s
own cached broker-disclosure fields.

### 5.2 Portfolio Health
This section is **entirely** `useGetPortfolioDashboard()`'s own
`widgets[]` array (Position Sizing, Stress Test, Event Risk,
Concentration, Diversification, Greeks, Broker Health — 7 cards, each
already carrying its own `headline`/`detail`/`linkHref`), rendered as
clickable cards with no additional client-side logic beyond mapping the
array to `<Link>` components.

### 5.3 Options Income Engine
**Total Premium Collected** reuses `useGetPerformanceAnalytics({ period: "all" })`'s
own `thetaCollected` field — a genuinely *realized* figure from closed
trades, honestly labeled "(Realized)" to distinguish it from the
Executive Overview's own *projected* Total Theta Income figure, since
conflating the two would misrepresent one as the other. **Expected
Monthly Income** reuses `useGetThetaIncome()`'s own `monthly` field
directly (the same number shown in the Executive Overview, intentionally
— it is the same real projection, shown in two places for two different
audiences).

**Iron Condors** and **Calendar Spreads** counts reuse
`useGetPortfolioDashboard()`'s own `allocationByStrategy` buckets
(matching bucket `key` against this engine's own real `execution.ts`
`Strategy` enum values `"iron_condor"`/`"calendar_spread"`) — zero new
counting logic.

**Wheel Positions, Covered Calls, and Cash Secured Puts are always
honestly disclosed as "Not tracked in this engine," never fabricated as
a zero count.** Direct inspection of `execution.ts`'s own `Strategy`
type (`"iron_condor" | "iron_fly" | "calendar_spread" | "earnings"`)
before writing any code confirmed none of these 3 requested strategy
types has ever existed anywhere in this platform's own pricing, scanner,
or execution logic — showing a fabricated `0` here would be
indistinguishable from "genuinely tracked, currently zero open
positions," which would be dishonest. This mirrors the exact
"unsupported category, disclosed rather than silently omitted"
precedent the Earnings & Event Risk Portfolio Overlay sprint already
established for FDA decisions and product launches.

### 5.4 Greeks Summary
Net Delta/Gamma/Theta/Vega reuse `useGetPortfolioGreeks()` directly — the
platform's own original, pre-existing Greeks engine (`pages/Portfolio.tsx`),
distinct from (but computed over the same underlying trades as) the
Concentration overlay's own `netGreeks`. Beta is always shown as
honestly unavailable, reusing the same disclosed reason string the
Concentration overlay has carried since its own sprint (§4 above).

### 5.5 Risk Alerts
Reuses `useGetPortfolioDashboard()`'s own `guidance[]` array, filtered to
only the genuinely elevated codes (`elevated_risk`, `high_risk`,
`elevated_concentration`, `elevated_event_risk`,
`diversification_recommended`, `review_large_positions`) — the
healthy/moderate primary-rating codes are excluded, since those aren't
alerts, they're the all-clear state. **The one genuinely new logic on
this page** (still zero new calculation) is a plain client-side `sort`
picking the worst-impact entry from `dash.stressTestSummary` — an
already-fetched array — to surface a "Stress Test" alert when the worst
modeled scenario is genuinely negative, satisfying this section's own
"Reuse... Stress Test" requirement without a second stress-test call.

### 5.6 Portfolio Allocation
All 4 charts (Symbol, Sector, Strategy, Expiration) are the exact same
`ConcentrationBucket[]` arrays `pages/PortfolioConcentration.tsx` and
`pages/PortfolioDashboard.tsx` already render, using the identical
recharts `BarChart` styling already established by those pages.

### 5.7 Broker
**Deliberately does not call `GET /broker/health` on page load.** That
endpoint is manual-trigger-only everywhere else in this codebase
(`pages/Settings.tsx`'s own Broker Connection Status card uses
`enabled: false`), matching this whole project's "no automatic polling"
discipline. This section shows the same cached
`credentialsConfigured`/`brokerConnected`/`lastBrokerCheckAt` fields
`useGetPortfolioDashboard()` already discloses (itself sourced from the
last real check, never a fabricated live state), with a link to Settings
for a fresh check.

### 5.8 AI Insights
Deterministic, client-side text synthesis over data the sections above
have already fetched — **no LLM call, no new endpoint, and per the
explicit instruction, never an execution recommendation.** Largest Risk
prefers `highestEventRisk`, falling back to `highestConcentration`, both
already-computed fields. Largest Opportunity reuses
`useGetTopOpportunities()`'s own top-ranked candidate — the identical
`topPick` derivation `pages/Dashboard.tsx` already uses
(`ironCondors[0] ?? calendarSpreads[0]`). Concentration and
Diversification reuse the matching entries from
`dash.healthFactors[]`. Income Status reuses `useGetThetaIncome()`'s own
`monthly` figure with a plain, threshold-free descriptive sentence.

---

## 6. Navigation changes

**This is the only category of change outside pure composition this
sprint made**, and it is explicitly permitted by the sprint's own "No
routing changes outside navigation" instruction — installing a new
primary landing page inherently requires a navigation change.

- `App.tsx`: `/` now renders `CommandCenter` (new). The pre-existing
  `Dashboard` component — completely unmodified, confirmed by
  `git diff --stat` — moved to `/options-dashboard`.
- `AppLayout.tsx`: the "Dashboard" nav entry was renamed "Command
  Center" (still `href="/"`); a new "Options Dashboard" nav entry
  (`href="/options-dashboard"`) was added immediately after it.

No other route was added, removed, or repointed. No backend route
changed. No execution, broker-write, or portfolio-mutation logic of any
kind was touched.

---

## 7. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts`, `eventRisk.ts` — zero-line diff.
- `positionSizing.ts`, `portfolioStressTest.ts`, `portfolioEventRisk.ts`,
  `portfolioConcentration.ts` — zero-line diff.
- `pages/Dashboard.tsx`, `pages/Portfolio.tsx`, `pages/PortfolioAI.tsx`,
  `pages/TradePerformance.tsx`, `pages/Scanner.tsx` — zero-line diff;
  every one of their own hooks is reused, not reimplemented.
- No database migration.
- No broker write operations of any kind.
- No portfolio mutation of any kind.

---

## 8. Real Alpaca credential verification remains deferred

Consistent with every prior sprint in this family, this page is fully
functional without real Alpaca credentials — every disclosed
credentials/broker field is honest, never fabricated, regardless of
value.

---

## 9. Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4.15 — the higher-level
  architectural summary of this same sprint.
- `docs/Portfolio-Dashboard.md` — the Portfolio Risk Dashboard sprint
  whose own response shape this page reuses for the majority of its
  content, including the §4-documented additive `netBeta`/
  `netBetaUnavailableReason` extension.
- `docs/Portfolio-Correlation-Concentration.md`, `docs/Portfolio-Event-Risk.md`,
  `docs/Portfolio-Stress-Testing.md`, `docs/Position-Sizing.md` — the
  underlying overlays this page transitively reuses through the
  Portfolio Dashboard.
- `docs/Operations-Handbook.md` — day-to-day operational usage.
- CLAUDE.md rule 1 — `execution.ts` is never modified without explicit,
  specific approval; this sprint touches no execution/pricing/risk
  primitive at all.

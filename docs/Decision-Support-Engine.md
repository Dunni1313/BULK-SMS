# Institutional Decision Support Engine

Phase 40 — a deterministic executive workspace consolidating every
analytical engine built in Phases 37–39 (plus Portfolio Concentration)
into one Executive Summary, Portfolio Health Overview, Risk/Performance/
Scenario/Capital Allocation/Exposure/Diversification Summary,
deterministic Executive Alerts, Outstanding Issues, a Key Metrics
Dashboard, and an 11-dimension Executive Health scorecard.

**This phase provides interpretation only.** Nothing here implements or
evaluates AI predictions, trade recommendations, buy/sell signals,
portfolio optimisation, auto execution, auto hedging, auto rebalancing,
market forecasting, machine learning, or generative investment advice.
Every figure is either reused verbatim from an existing, already-tested
engine, or a thin, deterministic threshold/aggregation rule over those
already-computed figures.

## Where to find it

`/decision-support-engine`, linked from the sidebar navigation, the
Command Palette (inherits the nav entry automatically), the Investing
Executive Dashboard, the Executive Intelligence Hub, the Cross-Engine
Workspace's own Workspace Shortcuts, and the Institutional Reporting
Centre (two new report types). The Learning Centre overview is reached
indirectly — every Coach & Learning topic links out to real,
already-existing Learning Centre content, never a new lesson page.

## Audit summary — what already existed vs. what this phase added

Before writing any code, the following reusable components were
confirmed present and load-bearing for this phase (full detail in
`docs/Institutional-Decision-Model.md`):

| Component | Reused for |
|---|---|
| `lib/riskExposureEngine.ts`'s `buildRiskExposureDashboard()` (Phase 37) | Risk Summary, Capital Allocation Summary, most of the Exposure Summary |
| `lib/performanceAttribution.ts`'s `buildPerformanceDashboard()` (Phase 38) | Performance Summary |
| `lib/scenarioEngine.ts`'s `buildScenarioDashboard()` (Phase 39) | Scenario Summary, Scenario Resilience |
| `lib/portfolioConcentration.ts`'s `buildPortfolioConcentrationOverlay()` | Options' own diversification score |
| `lib/tradingLiquidity.ts` / `lib/optionsMath.ts`'s `getSnapshot()` (read-only) | Trading's/Options' own Liquidity health dimension |

**Genuine gap found:** `lib/executiveIntelligence.ts` (Phase 33) already
exists, but is a usage/activity aggregator (portfolios created, trades
reviewed, reports generated), not an analytical-content aggregator — it
never surfaced real Portfolio Health/Risk/Performance/Scenario content.
New `lib/decisionSupportEngine.ts` is the pure composition layer that
fills this gap.

## Views

### Executive Dashboard

The main page (`DecisionSupportEngine.tsx`), with 3 tabs: Executive
Dashboard, Coach & Learning, Reporting.

### Executive Summary

Headline counts and values per engine (Investing holdings/portfolio
count, Trading open positions, Options open positions), the overall
portfolio health score, alert/issue counts, and a deterministic
one-paragraph summary sentence — never blended into one figure.

### Portfolio Health Overview

Each engine's own already-computed overall health/risk score, side by
side, plus a renormalized-average overall score.

### Risk Summary / Performance Summary / Scenario Summary

Thin re-exports of the Risk & Exposure Engine's, Performance &
Attribution Engine's, and Scenario & Stress Testing Engine's own
already-computed Combined views — zero new risk, performance, or
scenario math.

### Capital Allocation Summary / Exposure Summary

Direct reuse of the Risk & Exposure Engine's own already-computed
`capitalAllocation`/`buyingPowerOverview`/`sectorConcentration`/
`strategyConcentration`/`assetAllocation`/`greeksSummary` fields.

### Diversification Summary

Each engine's own already-computed diversification/concentration score
— Investing (`investingRisk.ts`), Options (`portfolioConcentration.ts`)
— with Trading honestly reported unavailable (no such scoring formula
exists for it in this codebase), plus the disclosed, non-fabricated
cross-engine symbol-overlap Correlation Overview and Concentration
Timeline, both reused directly from the Risk & Exposure Engine.

### Executive Alerts

Deterministic, named-threshold observations only — sector allocation
exceeding target, strategy/expiration concentration high, buying power
utilisation high, diversification improved/declined (from two real
saved risk snapshots), and scenario resilience concerns under Market
-10%. Never a probability, never a forecast, never a suggested action.

### Outstanding Issues

A direct surfacing of already-flagged problems from the underlying
engines (unresolved symbols, missing stops/targets, risk-budget
breaches, Options guidance) — never a newly invented issue category.

### Key Metrics Dashboard

A flat re-presentation of 12 already-computed headline figures across
all 3 engines plus 2 cross-engine tallies — zero new computation.

### Executive Health Scorecard

11 dimensions, 5 of which reuse a genuine, already-existing 0–100
scoring formula (and feed a composite score); the other 6 are shown as
honest raw figures, explicitly excluded from the composite rather than
approximated. See `docs/Institutional-Decision-Model.md` for the full
per-dimension audit.

## AI Coach & Learning Centre

`lib/decisionSupportCoach.ts` — 8 deterministic, template-based
explanations (executive dashboards, institutional decision support,
portfolio interpretation, risk, performance, scenario analysis,
diversification, capital allocation), reusing the platform's existing
`COACH_DISCLAIMER` unmodified. Never a trade recommendation — enforced
structurally, since `explainDecisionSupportTopic()`'s own signature
takes only a topic key, never a symbol, position, or account figure.

`lib/decisionSupportLearning.ts` connects each of 7 distinct topics
(portfolio management, risk interpretation, performance interpretation,
scenario analysis, diversification, capital allocation, institutional
portfolio management) to real, already-existing Learning Centre content
— zero duplicated lesson content. Deliberately a separate topic list
from the Coach's own 8 topics, per the kickoff's own two distinct
lists.

## Reporting Centre integration

Two new report types, both pure reformats of the same
`buildDecisionSupportDashboard()` output — see
`docs/Executive-Insights.md` for the Executive Decision Summary's own
detail.

- **Executive Decision Summary** (`GET /reporting/executive-decision-summary`)
  — Executive Summary, Portfolio Health Overview, Executive Alerts,
  Outstanding Issues, Key Metrics Dashboard.
- **Institutional Health Report** (`GET /reporting/institutional-health-report`)
  — Portfolio Health Overview, Risk Summary, Diversification Summary,
  Executive Health Scorecard.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/decision-support/dashboard` | The full Decision Support dashboard for the calling user |
| GET | `/decision-support/coach` | All 8 AI Coach explanations |
| GET | `/decision-support/coach/:topic` | One explanation (404 for unknown topic) |
| GET | `/decision-support/learning` | All 7 topics' own Learning Centre links |
| GET | `/decision-support/learning/:topic` | One topic's links (404 for unknown topic) |
| GET | `/reporting/executive-decision-summary` | Executive Decision Summary |
| GET | `/reporting/institutional-health-report` | Institutional Health Report |

`GET /decision-support/dashboard` is deliberately a **GET**, not a
POST — unlike Phase 39's own `POST /scenario-engine/dashboard` (which
accepts a caller-supplied custom-scenario body), this dashboard takes
no caller-supplied input beyond the authenticated user's own identity,
matching `GET /risk-exposure/dashboard`'s and
`GET /performance-attribution/dashboard`'s own established GET-only
precedent.

## Testing

- `lib/decisionSupportCoach.test.ts` / `lib/decisionSupportLearning.test.ts`
  — pure unit tests for the deterministic coach/learning modules,
  mirroring the established `scenarioCoach.test.ts`/
  `scenarioLearning.test.ts` pattern.
- `routes/decisionSupportEngine.route.test.ts` — live end-to-end HTTP
  tests against a real Postgres connection and the real Better-Auth
  instance: the honest empty-portfolio dashboard, real cross-engine
  composition proven byte-consistent against the underlying Risk &
  Exposure Engine's own response, the Executive Health scorecard's own
  never-fabricated-score honesty, tenant isolation, the AI Coach and
  Learning Centre endpoints (including 404s for unknown topics), no
  special-auth requirement, both new Reporting Centre report types, and
  a structural scan proving no probability estimate/forecast/
  recommendation ever appears in the response.
- `pages/DecisionSupportEngine.test.tsx` — frontend smoke tests
  following the established mocked-generated-hook pattern (a plain GET
  query hook, unlike Scenario Engine's own POST-mutation shape).
- `routes/institutionalReporting.route.test.ts` was extended (not
  rewritten) to cover the 2 new report types and the updated report-type
  count (22 → 24).

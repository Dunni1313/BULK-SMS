# Trading Analytics Engine — Architecture

Phase 32. This document explains how the Institutional Trading Analytics
Engine is built and why every figure it produces is structurally
guaranteed to be a direct read, count, tally, or simple aggregate of
already-persisted data — never a new signal, score, or prediction.

## Design goal

Turn the Trading Engine's own already-persisted data (positions, trade
plans, journal entries, strategies, checklist instances, learning
progress, coach usage) into a coherent analytics dashboard **without
introducing a single new calculation that could be mistaken for a trading
signal.** Every builder function in `lib/tradingAnalytics.ts` is provably
a pure aggregation — sum, average, count, or bucket — over its input rows,
never a judgment about what those rows mean for a future trade.

## No new persistence

This phase adds **zero new database tables**. Every analytics figure is
computed live, on request, from the same tables every other Trading
Engine module already reads and writes: `trading_positions`,
`trading_trade_plans`, `trading_journal_entries`,
`trading_workspace_notes`, `trading_strategies`,
`trading_strategy_checklists`, and `learning_progress`. This mirrors the
established "reuse infrastructure other sprints already built" discipline
from every prior Trading Engine sprint.

## Core library: `lib/tradingAnalytics.ts`

Pure, deterministic, no I/O. Ten independently-testable builder
functions, one per requested analytics category, composed into
`buildTradingAnalyticsDashboard()`:

1. **`buildOverview()`** — direct row counts (trades reviewed, plans
   created, journal entries, strategies registered, checklist instances).
   Workspace notes explicitly exclude the `STRATEGY:<id>` pseudo-symbol
   convention (Phase 31's Strategy Notes), so "workspace usage" only
   counts genuine per-symbol Trade Workspace notes, never double-counting
   Strategy Workbench activity.
2. **`buildStrategyUsageAnalytics()`** — checklist completion counts and
   percentages, reusing `computeChecklistCompletion()`
   (`lib/tradingStrategyFramework.ts`, Phase 30) directly rather than a
   second formula. Evidence tallies (both declared-required and
   actually-attached) are counted over the same `EvidenceSourceType`
   vocabulary Phase 30 already established.
3. **`buildJournalAnalytics()`** — mood/setup-type tallies, lesson-recorded
   rate, and an R-multiple distribution across 5 fixed named buckets. All
   read directly from `trading_journal_entries.mood`/`.setupType`/
   `.lessonLearned`/`.rMultiple` — fields Phase 27 already persists.
4. **`buildRiskAnalytics()`** — averages and distributions over
   `trading_trade_plans.accountRiskPct`/`.riskRewardRatio` (fields already
   computed at plan-creation time, Phase 28) and real
   `trading_positions.stopPrice`/`.targetPrice` presence. **Deliberately
   never re-runs the live, provider-dependent Trading Risk Engine**
   (`lib/tradingRisk.ts`) — that engine is a real-time analysis over
   current market data, not a history log, and re-running it here would
   blur the "aggregate only existing data" boundary this phase's brief
   drew explicitly.
5. **`buildLearningAnalytics()`** — a pure reformatting of
   `getLearningProgress()`'s own already-computed `LearningProgressSummary`
   (`lib/learningProgress.ts`, Phase 21). "Weakest paths" is an honest
   sort (paths below a named `WEAK_PATH_THRESHOLD_PCT = 50` threshold,
   sorted lowest-first) of already-computed percentages — never a
   prediction of what a user should study next.
6. **`buildCoachAnalytics()`** — parses the already-persisted
   `learning_progress` rows written by
   `components/coach/TradingCoachDrawer.tsx` (Phase 29) on every "mark as
   viewed" action. Those rows use the format `itemType: "coach"`,
   `itemKey: "<coachType>:<symbolOrAccount>"` — read here directly, never
   a new tracking mechanism.
7. **`buildSessionAnalytics()`** — reuses `activeSessionsAt()`
   (`lib/trading/sessionService.ts`, Phase 25/27) **completely
   unmodified** to classify real `trading_positions.entryDate` timestamps
   into the 4 real named trading sessions (`sydney`/`tokyo`/`london`/
   `new_york`). The brief's own "Asia/London/New York/Overlap" vocabulary
   is a pure relabeling for display: Asia = sydney + tokyo combined,
   Overlap = any timestamp where `activeSessionsAt()` itself returns more
   than one session name. Never a synthetic 5th session.
8. **`buildStructureAnalytics()` / `buildLiquidityAnalytics()`** — a
   **disclosed proxy**. No Market Structure or Liquidity *analysis* is
   ever persisted anywhere in this codebase (`lib/tradingMarketStructure.ts`/
   `lib/tradingLiquidity.ts` compute live from a `MarketDataProvider` on
   every request, Phase 3, and are never logged to a table) — so genuine
   historical "Structure Analytics"/"Liquidity Analytics" over past
   readings is not honestly possible without fabricating a history that
   was never recorded. Instead, these two builders report the two real,
   persisted signals that *do* exist: how many times the Structure/
   Liquidity Trading AI Coach was consulted (reusing
   `buildCoachAnalytics()`'s own output), and how many registered
   strategies cite Market Structure/Liquidity as required evidence
   (reusing `buildStrategyUsageAnalytics()`'s own output). Neither is a
   re-derivation of a structure/liquidity reading itself — both are usage
   counts over already-recorded rows.
9. **`buildChecklistAnalytics()`** — groups checklist instances by
   strategy, again reusing `computeChecklistCompletion()` rather than a
   second formula.
10. **`buildTradingAnalyticsDashboard()`** — the single composition
    function, calling all of the above once each and assembling the full
    `TradingAnalyticsDashboard` shape.

## Route shape

One eager route, mirroring Phase 3 Sprint 50's own Institutional Dashboard
precedent ("small, bounded item counts per user, cheap enough to compute
eagerly"):

| Route | Shape | Reason |
|---|---|---|
| `GET /trading/analytics` | one composed payload | small, bounded per-user row counts across 6 tables + one existing function call — cheap enough to resolve eagerly in a single round trip, matching every other small-dataset dashboard in this codebase |
| `GET /reporting/trading-analytics-summary` | report | reuses `loadTradingAnalyticsInputs()`/`buildTradingAnalyticsDashboard()` exactly, reformatted into the generic report-section shape |

`routes/tradingAnalytics.ts`'s `loadTradingAnalyticsInputs(userId)` is
exported specifically so `routes/institutionalReporting.ts` can call it
directly — the Reporting Centre extension introduces **zero new
aggregation logic**, it only reformats the exact same already-computed
dashboard into `ReportSection[]`.

## Reporting integration

`lib/institutionalReporting.ts` gained a 12th `InstitutionalReportType`,
`trading-analytics-summary`, and `buildTradingAnalyticsSummaryReport()` —
7 sections (executive summary, strategy usage, journal analytics, risk
analytics, learning analytics, coach analytics, session analytics), each a
direct reformatting of one field on the already-computed
`TradingAnalyticsDashboard`. It computes no new metric.

## Why no signal, score, or prediction is possible here

Every builder function takes already-resolved rows or an already-computed
summary as its only input and returns a count, sum, average, or bucket
over them. None of the ten builders ever:

- reads live market data,
- calls a probability, regime, or structure engine to produce a *new*
  reading,
- combines fields into a composite "score" meant to imply future
  performance, or
- ranks, recommends, or predicts anything.

This is verified by a dedicated regression test
(`tradingAnalytics.test.ts`, "never fabricates a signal, score, or
prediction field anywhere in the composed dashboard") that serializes a
freshly-built dashboard and asserts it never contains the strings
`"probability"`, `"prediction"`, `"signal"`, or `"forecast"`, and no
numeric field literally named `score`.

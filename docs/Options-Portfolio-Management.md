# Options Portfolio Management (Phase 36)

The Institutional Position Lifecycle Manager's portfolio-wide view
(`GET /options-lifecycle/portfolio`, `lib/optionsPortfolioManagement.ts`).
**Pure composition layer — zero new portfolio math.** Every figure is
reused directly from an existing, already-tested engine.

## What's reused, from where

| Feature | Reused from |
|---|---|
| Position concentration | `buildPortfolioDashboard()` — the existing Portfolio Risk Dashboard (`allocationBySymbol`) |
| Strategy allocation | `buildPortfolioDashboard()` (`allocationByStrategy`) |
| Sector allocation | `buildPortfolioDashboard()` (`allocationBySector`) |
| Expiration ladder | `buildPortfolioDashboard()` (`expirationDistribution`) |
| Capital utilisation | `buildPortfolioDashboard()` (`portfolioValue`, `totalRiskDollars`, `totalRiskPct`) |
| Buying power allocation | `buildPortfolioDashboard()` (`buyingPower`) |
| Income allocation | `buildOptionsIncomeDashboard()` (Phase 35) — theta by-symbol/by-strategy, strategy mix |
| Expiration Tracker | `buildOptionsIncomeDashboard()` (Phase 35) — `upcomingExpirations` |

None of these figures are recomputed by this phase — the same functions
`GET /portfolio/dashboard` and `GET /options-income/dashboard` already
call are called again here and reformatted into one combined view.

## What's genuinely new

Only two functions in `lib/optionsLifecycle.ts` compute something this
phase didn't already have:

### Portfolio Exposure Timeline

`buildPortfolioExposureTimeline(userId, months = 6, asOf)` — a
deterministic reconstruction of what was actually open at each trailing
month-end, derived from each real trade's own `openDate`/`closeDate`.
**Never a fabricated snapshot, never a forecast** — a position only
counts at a given month-end if its own real `openDate` is on/before that
date and its own real `closeDate` is `null` or after that date. No new
snapshot table, no scheduled job — computed fresh on every read.

### Position Lifecycle Summary

`buildLifecycleSummary(userId)` — every real `trades` row tallied by its
own current lifecycle stage (an explicit `options_lifecycle_state` row
when one exists, else the honest default derived from the trade's own
real `status`). Also reports how many positions are currently in
`monitoring`, `near_expiration`, or `assignment_risk` (positions
"awaiting review"). Zero fabricated stage.

## Response shape

```
GET /options-lifecycle/portfolio
{
  positionConcentration: ConcentrationBucket[],
  strategyAllocation: ConcentrationBucket[],
  sectorAllocation: ConcentrationBucket[],
  expirationLadder: ConcentrationBucket[],
  capitalUtilisation: { portfolioValue, totalRiskDollars, totalRiskPct },
  buyingPowerAllocation: { buyingPower },
  incomeAllocation: { bySymbol, byStrategy, strategyMix },
  expirationTracker: UpcomingExpirationGroup[],
  exposureTimeline: { monthEnd, openPositionsCount, byStrategy }[],
  lifecycleSummary: { totalPositions, byStage, positionsAwaitingReview },
  generatedAt: string
}
```

## Reporting Centre integration

Two new report types (`lib/institutionalReporting.ts`), reusing this same
view/summary, reformatted into the platform's generic `ReportSection`
shape — zero new aggregation logic:

- **Options Portfolio Review** (`GET /reporting/options-portfolio-review`)
  — capital utilisation, position/strategy/sector concentration, the
  expiration ladder, income allocation, and the expiration tracker.
- **Position Lifecycle Summary**
  (`GET /reporting/position-lifecycle-summary`) — the lifecycle overview
  and positions-by-stage tally.

Both are also available via `POST /reporting/reports` for persistence,
matching every other report type's own save/list/delete flow.

## No trading logic

This module never calls `execution.ts`, `optionsMath.ts`, `risk.ts`,
`autoExecution.ts`, or `autoAdjustment.ts`, and introduces no new
scoring, allocation formula, or rebalancing recommendation — confirmed by
a dedicated test proving the live response never contains a
probability/prediction/forecast/recommendation field.

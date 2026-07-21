# Institutional Risk Model — Design & Audit Record (Phase 37)

The exact design decisions behind `lib/riskExposureEngine.ts`, kept as a
permanent record for future phases, mirroring the role
`docs/Options-Architecture.md` plays for Phase 35/36.

## Guiding constraint

The Phase 37 kickoff was explicit: **analytics and visibility only.** No
live execution, no auto hedging, no auto rebalancing, no trade/position
recommendations, no AI predictions, no probability forecasting, no
AI-based risk scoring, no automated alerts. Every design decision below
was made against that constraint first.

## Per-engine risk sources (confirmed via direct source reads before implementation)

| Engine | Function | Returns |
|---|---|---|
| Investing | `lib/investingRisk.ts`'s `computePortfolioRiskFromAllocation(holdings)` | `PortfolioRiskAnalysis { overall, concentration, sectorExposure, betaEstimate, components, totalMarketValue, unresolvedSymbols }` |
| Investing | `lib/portfolioConstruction.ts`'s `buildPortfolioAllocation(holdings, provider)` | Resolves each holding's live/simulated price → market value |
| Trading | `lib/tradingRisk.ts`'s `buildTradingRiskAnalysis(positions, accountValue, provider)` | `TradingRiskAnalysis { overall, positionSizing, stopDiscipline, portfolioBudget, ... }` |
| Options | `lib/portfolioDashboard.ts`'s `buildPortfolioDashboard(userId)` | `PortfolioDashboardResult` — the existing Portfolio Risk Dashboard |
| Options | `lib/optionsPortfolioManagement.ts`'s `buildOptionsPortfolioManagementView(userId)` | Income allocation, exposure timeline, lifecycle summary (Phase 36) |

None of these five functions were modified. `lib/riskExposureEngine.ts`
imports and calls each unchanged.

## Cross-portfolio aggregation for Investing

`buildInvestingRiskView(userId)` fetches **every** `investing_holdings`
row owned by the user, across every one of their portfolios, in one
query — not one call per portfolio. This is a legitimate reading of
"Aggregate existing deterministic data only": `buildPortfolioAllocation()`
already dedupes provider calls per distinct symbol internally, so passing
every holding across every portfolio in one call is exactly as cheap as
resolving one portfolio at a time, and correctly combines a symbol held in
more than one portfolio into one figure (`mergeBySymbolValue()`) rather
than double-counting or silently picking one portfolio's figure. This is
a pure aggregation — a portfolio-count merge — never a new valuation.

## The Combined view

`buildCombinedRiskView()` is the one function in this phase doing
non-trivial cross-engine work. Every field is documented here exactly:

- **Capital Allocation** — `investing.risk.totalMarketValue`,
  `trading.accountValue`, `options.dashboard.portfolioValue`, laid side
  by side. No sum, no blended total — deliberately, since summing a
  target-weight investing book, a real trading account, and an options
  income book into one number would imply they're fungible in a way this
  phase was never asked to model.
- **Buying Power Overview** — `trading.accountValue` and
  `options.dashboard.buyingPower`, side by side (Investing has no
  buying-power concept).
- **Sector Concentration** — the concatenation of Investing's own
  `sectorExposure.breakdown` and Options' own `allocationBySector`,
  tagged by `engine`. Never merged into one blended percentage per
  sector, since the two engines' own weight bases (Investing: % of
  market value; Options: % of open-position count/risk) are not directly
  comparable.
- **Strategy Concentration** — Options' own `allocationByStrategy`,
  unmodified. See "Deliberate scope decision" in
  `docs/Risk-Exposure-Engine.md` for why Trading's own strategy framework
  isn't included.
- **Asset Allocation** — a pure tally of counts across the 3 engines.
- **Greeks Summary** — `options.dashboard.netGreeks`, reused verbatim
  (Investing and Trading have no Greeks concept).
- **Correlation Overview** — see below.
- **Concentration Timeline** — see below.

## Correlation Overview — the one genuinely disclosed design decision

The Phase 37 kickoff explicitly asked for "Correlation Overview
(deterministic only)." A real correlation coefficient (e.g. Pearson
correlation of daily returns between two symbols/engines) requires a
historical price-return series. **This platform has no such
infrastructure anywhere** — confirmed by inspection before implementation:
neither `optionsMath.ts`, `tradingMarketData.ts`, nor any Investing-side
module stores or computes historical return series suitable for a
genuine correlation calculation.

Rather than fabricate a plausible-looking correlation number (which would
violate the platform's own unbroken never-fabricate discipline), the
Correlation Overview instead reports a real, honest, zero-fabrication
signal: **which symbols are genuinely held in more than one engine at
once** — e.g. AAPL held as an Investing position, also underlying an open
Trading position, also underlying an open Options trade. This is computed
as a pure set-intersection over each view's own already-resolved
holdings/positions (`buildCombinedRiskView()`'s `overlapMap`), tagged with
which engines hold it. The response always carries an explicit `note`
field stating this is a symbol-overlap read, not a statistical
correlation, so no caller can mistake it for one.

This is disclosed here as the phase's one genuinely novel design decision
— everything else in `lib/riskExposureEngine.ts` is either direct reuse or
a trivial aggregation (sum/group/concat).

## Concentration Timeline — real historical data, never fabricated

Two real, already-persisted sources are merged and sorted by date:

- `investing_risk_snapshots` (Phase 2 Sprint 29) — real, user-saved
  point-in-time Investing risk scores, written only via an explicit "Save
  Snapshot" action. Never auto-generated.
- Options' own Exposure Timeline
  (`optionsPortfolioManagement.ts`'s `exposureTimeline`, Phase 36) — a
  deterministic reconstruction of what was actually open at each trailing
  month-end, derived from each real trade's own `openDate`/`closeDate`.

No new snapshot table, no scheduled job. If a user has never saved an
Investing risk snapshot, the timeline honestly contains only the Options
side (still real, never empty-faked) — confirmed by a dedicated test.

## What was deliberately NOT built

- **No AI-based risk scoring anywhere.** Every score in this phase (the
  5 reused functions above) is deterministic arithmetic against named
  thresholds/caps, unchanged from its own already-shipped, already-tested
  form.
- **No automated alerts.** The dashboard is pull-only — a user must open
  the page or call the route; nothing here schedules a job, sends a
  notification, or writes to `platform_notifications`.
- **No hedging or rebalancing suggestion of any kind**, anywhere in the
  response shape or the AI Coach's prose — confirmed by a dedicated test
  scanning the live response for recommendation-shaped language.
- **No new database table.** This phase is entirely a read layer over
  existing tables.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and every broker-integration file were not imported,
read, or modified by any file in this phase.

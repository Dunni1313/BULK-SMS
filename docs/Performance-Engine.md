# Institutional Performance & Attribution Engine

Phase 38 — a deterministic Performance & Attribution Engine explaining
portfolio and strategy performance across Investing, Trading, and Options
— performance that has **already happened**, using only real,
already-persisted data.

**This phase is analytical only.** Nothing here implements or evaluates
AI predictions, future performance forecasts, trade recommendations,
portfolio optimisation, auto rebalancing, or auto execution, and generates
no alpha and no benchmark prediction. Every figure is either reused
verbatim from an already-shipped, already-tested engine, or a genuinely
new but small, disclosed formula computed directly from real, already-
persisted columns (never an estimate, never a fabricated number).

## Where to find it

`/performance-attribution-engine`, linked from the sidebar navigation, the
Command Palette (inherits the nav entry automatically), the Cross-Engine
Workspace's own Workspace Shortcuts, the Investing Executive Dashboard,
the Executive Intelligence Hub, the Institutional Reporting Centre (two
new report types), and the Learning Centre overview.

## Audit summary — what already existed vs. what this phase added

Before writing any code, the following reusable components were confirmed
present and load-bearing for this phase:

| Component | Reused for |
|---|---|
| `lib/portfolioConstruction.ts`'s `buildPortfolioAllocation()` (Phase 2 Sprint 28) | Investing holdings' resolved market value/price/sector — the same cheaper composition `lib/riskExposureEngine.ts` (Phase 37) already uses instead of the far heavier `buildPortfolioIntelligence()` |
| `lib/optionsIncomeAnalytics.ts`'s `buildIncomeOverview()`/`buildStrategyMix()` (Phase 35) | Options income figures (credit collected, realized premium, capital allocated, theta), reused verbatim |
| `lib/tradingBacktest.ts`'s Sharpe-ratio formula (mean/stdDev × √N over trade returns) | The ONLY Sharpe formula precedent anywhere in this codebase — reused in shape, applied to REAL closed trades instead of backtest output |
| `artifacts/ravish-trading/src/lib/tradeAnalytics.ts`'s win-rate/avg-win/avg-loss formula | Ported server-side, applied to real, already-persisted `trades.currentPnl` |
| `trading_positions`' own real, persisted `entryPrice`/`exitPrice`/`quantity`/`side` columns (Phase 3 Sprint 32) | No prior module in this codebase aggregated realized P&L from these — the one genuinely new Trading-side formula |

**Genuine gaps found, and how they were resolved — see
`docs/Institutional-Performance-Model.md` for the full, itemised
breakdown:**

- No existing module computed real, aggregate performance across
  Investing, Trading, and Options. New `lib/performanceAttribution.ts` is
  the pure composition/aggregation layer that does this.
- No Sortino ratio existed anywhere in this codebase. A standard
  downside-deviation-only variant of the same Sharpe formula shape was
  added, clearly disclosed as trade-return-based, not time-series-based.
- No module reconstructed a real historical P&L timeline for Trading or
  Options. This phase mirrors Phase 36's own Options Exposure Timeline
  pattern (real-timestamp reconstruction, no snapshot table) extended to
  sum real P&L per month.
- Investing has no realized-trade-return series (holdings are
  continuously held, not round-tripped) — its risk-adjusted performance
  honestly reports `available: false`, and its historical timeline shows
  real, user-saved market-value-over-time instead of P&L-over-time — an
  explicitly narrower, differently-sourced series, never fabricated to
  look equivalent to the other two engines'.

## The 10 named views (BUILD section)

All 10 are fields on the single `GET /performance-attribution/dashboard`
response, or the per-item lists already present within each per-engine
view (see `docs/Performance-Attribution.md` for the full response shape):

| View | Field |
|---|---|
| Performance Dashboard | the whole response |
| Return Attribution | `investing`/`trading`/`options`'s own total P&L fields, and `combined.byEngine` |
| Strategy Attribution | `trading.strategyAttribution`, `options.strategyAttribution`, `combined.strategyAttribution` |
| Sector Attribution | `investing.sectorAttribution`, `combined.sectorAttribution` |
| Asset Attribution | `investing`/`trading`/`options`'s own `assetAttribution`, `combined.assetAttribution` |
| Income Attribution | `options.incomeAttribution` (reused `buildStrategyMix()`) |
| Risk-adjusted Performance | `investing`/`trading`/`options`'s own `riskAdjusted`, `combined.riskAdjusted` |
| Historical Performance Timeline | `timeline` |
| Capital Efficiency | `investing`/`trading`/`options`'s own `capitalEfficiency`, `combined.capitalEfficiency` |
| Performance Breakdown | `investing.holdings`, `trading.positions`, `options.trades` — the per-item lists each view already carries |

## Performance Views

The frontend page exposes a single **Performance View** selector —
**Investing**, **Trading**, **Options**, or **Combined** (the default) —
a pure client-side filter over the one already-fetched dashboard
response. No recommendation, no optimisation, display only.

## AI Coach

5 deterministic explanations (`lib/performanceAttributionCoach.ts`) —
performance metrics, attribution, capital efficiency, risk-adjusted
returns, portfolio interpretation. Every function takes only a topic key,
never a symbol, position, or account figure — structurally preventing it
from ever discussing a specific real position or recommending a trade.
Reuses the platform's existing `COACH_DISCLAIMER` unmodified.

## Learning Centre integration

Each of the 5 AI Coach topics is connected
(`lib/performanceAttributionLearning.ts`) to relevant, already-existing
Learning Centre content — resolved live against `lib/learningPaths.ts`'s
own `getLearningTopic()`, never duplicated. One genuine, disclosed content
gap: no dedicated Sharpe/Sortino/risk-adjusted-return topic exists
anywhere in the Learning Centre today, so the `risk_adjusted_returns`
bundle links to the closest real, already-existing analogues (Expectancy
and Drawdown) rather than inventing a new lesson.

## Reporting Centre integration

Two new report types (`lib/institutionalReporting.ts`), reusing the same
`buildPerformanceDashboard()` response, reformatted into the platform's
generic `ReportSection` shape — zero new aggregation logic:

- **Performance Summary** (`GET /reporting/performance-summary`) —
  return by engine, per-engine performance overview, and capital
  efficiency.
- **Performance Attribution Report**
  (`GET /reporting/performance-attribution-report`) — sector/strategy/
  asset attribution, income attribution, risk-adjusted performance,
  capital efficiency, and the Historical Performance Timeline.

Both are also available via `POST /reporting/reports` for persistence,
matching every other report type's own save/list/delete flow.

## API surface

| Route | Purpose |
|---|---|
| `GET /performance-attribution/dashboard` | The full Investing/Trading/Options/Combined performance dashboard |
| `GET /performance-attribution/coach` / `/coach/:topic` | AI Coach explanations |
| `GET /performance-attribution/learning` / `/learning/:topic` | Learning Centre links per topic |

Every route resolves ownership via `getScopedUserId(req)` and scopes every
query by `userId`.

## No trading logic

This module never calls `execution.ts`, `optionsMath.ts`, `risk.ts`,
`autoExecution.ts`, or `autoAdjustment.ts`, and introduces no new trade
recommendation, portfolio optimisation, or automated rebalancing logic —
confirmed by dedicated tests proving the live response never fabricates a
probability/prediction/forecast/recommendation field.

## Database

No new tables. This phase reads existing tables (`investing_holdings`,
`investing_portfolios`, `investing_portfolio_snapshots`,
`trading_positions`, `trading_journal_entries`, `trades`) — it writes
nothing new anywhere.

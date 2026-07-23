# Institutional Risk & Exposure Intelligence Engine

Phase 37 — a deterministic cross-platform dashboard unifying Investing,
Trading, and Options risk into one institutional view.

**This phase is for analytics and visibility only.** Nothing here
implements or evaluates live execution, auto hedging, auto rebalancing,
trade recommendations, position recommendations, AI predictions,
probability forecasting, AI-based risk scoring, or automated alerts.
Every figure is either reused verbatim from an already-shipped,
already-tested engine, or a thin, pure aggregation (sum/group/set-
intersection) over those already-computed figures.

## Where to find it

`/risk-exposure-engine`, linked from the sidebar navigation, the Command
Palette (inherits the nav entry automatically), the Cross-Engine Quick
Actions list, the Investing Executive Dashboard, the Executive Intelligence
Hub, the Cross-Engine Workspace's own Workspace Shortcuts, the
Institutional Reporting Centre (two new report types), and the Learning
Centre overview.

## Audit summary — what already existed vs. what this phase added

Before writing any code, the following reusable components were confirmed
present and load-bearing for this phase:

| Component | Reused for |
|---|---|
| `lib/investingRisk.ts`'s `computePortfolioRiskFromAllocation()` (Phase 2 Sprint 29) | Investing risk score, concentration, sector exposure, beta |
| `lib/portfolioConstruction.ts`'s `buildPortfolioAllocation()` (Phase 2 Sprint 28) | Investing holdings' resolved market value/price |
| `lib/tradingRisk.ts`'s `buildTradingRiskAnalysis()` (Phase 3 Sprint 38/44) | Trading risk score, position sizing, stop discipline, portfolio budget |
| `lib/portfolioDashboard.ts`'s `buildPortfolioDashboard()` (Options Engine) | Options portfolio value, buying power, health score, net Greeks, allocation buckets |
| `lib/optionsPortfolioManagement.ts`'s `buildOptionsPortfolioManagementView()` (Phase 36) | Options income allocation, exposure timeline, lifecycle summary |
| `investing_risk_snapshots` table (Phase 2 Sprint 29) | Real, user-saved historical Investing risk scores for the Concentration Timeline |

**Genuine gaps found, and how they were resolved:**

- No existing module combined Investing + Trading + Options risk into one
  view. New `lib/riskExposureEngine.ts` is the pure composition layer that
  does this (see `docs/Institutional-Risk-Model.md` for its exact design).
- No existing module answered "which real symbols are held in more than
  one engine at once." This platform has no genuine price-covariance
  infrastructure to compute a real statistical correlation, so rather than
  fabricate a coefficient, the Correlation Overview reports a real, honest
  cross-engine symbol-overlap signal instead — see
  `docs/Institutional-Risk-Model.md` §Correlation Overview.
- No route existed for a combined risk read across all 3 engines. New
  `GET /risk-exposure/dashboard`.

## What's genuinely new vs. reused, at a glance

`lib/riskExposureEngine.ts` computes **zero new risk scores**. Its own
`buildInvestingRiskView()`/`buildTradingRiskView()`/`buildOptionsRiskView()`
each call straight through to an existing engine's own already-tested
function. The only genuinely new logic in the whole phase is:

1. **Cross-portfolio aggregation for Investing** — fetching all of a
   user's `investing_holdings` rows across every portfolio in one query
   and passing them to `buildPortfolioAllocation()`/
   `computePortfolioRiskFromAllocation()` together, rather than per
   portfolio. This is a pure aggregation (dedup by distinct symbol,
   combine per-symbol market value across portfolios), never a new
   scoring formula.
2. **The Combined view's own aggregation** (`buildCombinedRiskView()`) —
   sums, unions, and the disclosed cross-engine symbol-overlap read. See
   `docs/Institutional-Risk-Model.md` for the full breakdown.

## The 11 named views (BUILD section)

All 11 are fields on the single `GET /risk-exposure/dashboard` response
(see `docs/Risk-Dashboard.md` for the full response shape):

| View | Field |
|---|---|
| Risk Dashboard | the whole response |
| Portfolio Exposure Summary | `investing`/`trading`/`options` (per-engine) |
| Cross-Engine Exposure | `combined.capitalAllocation` + `combined.buyingPowerOverview` |
| Sector Concentration | `combined.sectorConcentration` |
| Strategy Concentration | `combined.strategyConcentration` |
| Asset Allocation | `combined.assetAllocation` |
| Buying Power Overview | `combined.buyingPowerOverview` |
| Capital Allocation | `combined.capitalAllocation` |
| Greeks Summary | `combined.greeksSummary` |
| Correlation Overview | `combined.correlationOverview` |
| Concentration Timeline | `combined.concentrationTimeline` |

## Risk Views

The frontend page exposes a single **Risk View** selector — **Investing**,
**Trading**, **Options**, or **Combined** (the default) — a pure
client-side filter over the one already-fetched dashboard response. No
recommendation, no optimisation, display only.

## Analytics

Every figure named in the kickoff's ANALYTICS section (capital allocation,
sector allocation, strategy allocation, buying power, open positions,
Greeks, expiration concentration, position concentration, trade
concentration, portfolio concentration) is present, reused from the
components listed above — none recomputed.

## AI Coach

7 deterministic explanations (`lib/riskExposureCoach.ts`) — risk, exposure,
diversification, concentration, position sizing, capital allocation,
Greeks. Every function takes only a topic key, never a symbol, position,
or account figure — structurally preventing it from ever discussing a
specific real position or recommending a trade or hedge. Reuses the
platform's existing `COACH_DISCLAIMER` unmodified.

## Learning Centre integration

Each of the 7 AI Coach topics is connected
(`lib/riskExposureLearning.ts`) to relevant, already-existing Learning
Centre content — resolved live against `lib/learningPaths.ts`'s own
`getLearningTopic()`, never duplicated.

## Reporting Centre integration

Two new report types (`lib/institutionalReporting.ts`), reusing the same
`buildRiskExposureDashboard()` response, reformatted into the platform's
generic `ReportSection` shape — zero new aggregation logic:

- **Risk & Exposure Summary** (`GET /reporting/risk-exposure-summary`) —
  risk overview, capital allocation, buying power overview, Greeks
  summary, and the cross-engine exposure/correlation overview.
- **Portfolio Concentration Report**
  (`GET /reporting/portfolio-concentration-report`) — sector/strategy
  concentration, asset allocation, and the concentration timeline.

Both are also available via `POST /reporting/reports` for persistence,
matching every other report type's own save/list/delete flow.

## API surface

| Route | Purpose |
|---|---|
| `GET /risk-exposure/dashboard` | The full Investing/Trading/Options/Combined dashboard |
| `GET /risk-exposure/coach` / `/coach/:topic` | AI Coach explanations |
| `GET /risk-exposure/learning` / `/learning/:topic` | Learning Centre links per topic |

Every route resolves ownership via `getScopedUserId(req)` and scopes every
query by `userId`.

## No trading logic

This module never calls `execution.ts`, `optionsMath.ts`, `risk.ts`,
`autoExecution.ts`, or `autoAdjustment.ts`, and introduces no new scoring,
allocation formula, hedging recommendation, or rebalancing recommendation
— confirmed by dedicated tests proving the live response never fabricates
a probability/prediction/forecast/recommendation field.

## Deliberate scope decision: Trading Strategy Framework excluded

`lib/tradingStrategyFramework.ts` (the `trading_strategies` table) was
investigated as a possible second input to Strategy Concentration, but
deliberately excluded from this phase: it would require an additional DB
query disproportionate to the value versus reusing Options' own already-
real, dollar-weighted `allocationByStrategy`. Strategy Concentration in
this phase is Options-only. A future phase could extend it if a genuine
need for Trading-side strategy concentration emerges.

## Database

No new tables. This phase reads existing tables (`investing_holdings`,
`investing_portfolios`, `trading_positions`, `trades`,
`investing_risk_snapshots`) — it writes nothing new anywhere.

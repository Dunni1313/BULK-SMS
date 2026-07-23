# Institutional Decision Model — Design & Audit Record (Phase 40)

The exact design decisions behind `lib/decisionSupportEngine.ts`, kept as
a permanent record for future phases, mirroring the role
`docs/Institutional-Scenario-Model.md` plays for Phase 39,
`docs/Institutional-Performance-Model.md` plays for Phase 38, and
`docs/Institutional-Risk-Model.md` plays for Phase 37.

## Guiding constraint

The Phase 40 kickoff was explicit: **this phase provides interpretation
only.** No AI predictions, no trade recommendations, no buy/sell
signals, no portfolio optimisation, no auto execution, no auto hedging,
no auto rebalancing, no market forecasting, no machine learning, no
generative investment advice. Every figure below was designed against
that constraint first — every value is either (a) reused verbatim from
an existing, already-computed engine output, or (b) a thin, deterministic
threshold/aggregation rule over those already-computed figures.

## Audit performed before implementation

Before writing any code, the following reusable components were
confirmed present via direct source reads:

| Component | Reused for |
|---|---|
| `lib/riskExposureEngine.ts`'s `buildRiskExposureDashboard()` (Phase 37) | Risk Summary, Capital Allocation Summary, most of the Exposure Summary — direct reads of its already-computed `CombinedRiskView` |
| `lib/performanceAttribution.ts`'s `buildPerformanceDashboard()` (Phase 38) | Performance Summary — a direct read of its already-computed `CombinedPerformanceView` |
| `lib/scenarioEngine.ts`'s `buildScenarioDashboard()` (Phase 39) | Scenario Summary — a direct read of its already-computed `CombinedScenarioView`; Options' own Scenario Resilience health dimension reuses the reused What-If Stress Test engine's own already-computed `riskScoreAfter` for the Market -10% scenario |
| `lib/portfolioConcentration.ts`'s `buildPortfolioConcentrationOverlay()` | Options' own `diversificationScore`, reused directly for the Diversification Summary |
| `lib/tradingLiquidity.ts`'s `buildLiquidityAnalysis()` and `lib/optionsMath.ts`'s `getSnapshot().liquidityScore` (read-only, never modified) | Trading's and Options' own Liquidity health dimension |
| `lib/executiveIntelligence.ts` (Phase 33) | Investigated and found NOT reusable for this phase — see "Genuine gap" below |

**Genuine gap found, and how it was resolved:** `lib/executiveIntelligence.ts`
already exists (Phase 33) but is a **usage/activity aggregator** —
portfolios created, trades reviewed, reports generated, coach views,
learning progress — never a health/risk/performance/scenario-content
aggregator. It answers "how much have you used this platform," not
"what does your portfolio look like right now." No existing module
consolidated real analytical content (Portfolio Health, Risk,
Performance, Scenario, Capital Allocation, Exposure, Diversification)
across all three engines into one executive view. New
`lib/decisionSupportEngine.ts` is the pure composition layer that does
this — the module this phase actually needed to build.

## What is genuinely new vs. reused, at a glance

`lib/decisionSupportEngine.ts` introduces **zero new scoring formulas**.
Every dimension is either a direct re-export of an already-computed
figure, or one of these thin aggregation rules:

1. **`avg()` — a renormalized average filtering out nulls.** Used for
   `overallScore` (Portfolio Health Overview) and the Executive Health
   composite score. Never silently treats a missing score as zero —
   averaging over `null` would understate a portfolio's health for the
   trivial reason that one engine's own score formula doesn't cover a
   given dimension.
2. **Named, disclosed alert thresholds** (`SECTOR_ALLOCATION_ALERT_PCT`,
   `STRATEGY_CONCENTRATION_ALERT_PCT`, `EXPIRATION_CONCENTRATION_ALERT_PCT`,
   `TRADING_RISK_UTILIZATION_ALERT_PCT`, `OPTIONS_RISK_UTILIZATION_ALERT_PCT`,
   `DIVERSIFICATION_CHANGE_NOTABLE_POINTS`) — plain numeric comparisons
   against already-computed figures, matching the codebase-wide
   "measured baseline, tune later" convention already established for
   Phase 4's rate-limit thresholds and other named-constant precedents
   throughout this project.

Nothing else in this file computes a genuinely new number.

## Never blended across engines

Every summary in `DecisionSupportDashboard` deliberately keeps
Investing/Trading/Options figures **side by side**, never summed into
one blended net-worth or blended score — the same discipline every one
of Phases 37–39's own Combined views already established:

- Investing shows a target-weight construction book (unrealized-P&L
  oriented), Trading shows a real trading account, and Options shows
  an income-focused derivatives book. Summing "Investing market value"
  + "Trading account value" + "Options portfolio value" into one
  fabricated "total net worth" figure would imply a fungibility this
  platform was never asked to model, and would silently misrepresent
  three genuinely different kinds of capital.
- The Portfolio Health Overview's `overallScore` is the one place this
  phase does average across engines — but only after confirming with
  each engine's own analyst-facing documentation that "higher is
  safer/healthier" is a shared convention across all three (confirmed
  via `investingRisk.ts`/`tradingRisk.ts`/`portfolioDashboard.ts`'s own
  scoring direction), and even then the per-engine scores are always
  shown alongside the composite, never hidden behind it.
- The Executive Health scorecard's own `compositeScore` is computed
  **only** over the 5 dimensions that genuinely share the same 0–100
  scale (`portfolio_health`, `risk_score`, `diversification`,
  `liquidity`, `scenario_resilience`) — the other 6 dimensions
  (Capital Utilisation, Performance, Exposure, Buying Power, Greeks,
  Income Stability) are shown as raw, honestly-labeled figures with
  `includedInComposite: false`, never coerced into a fabricated score.

## The Executive Health scorecard — an 11-dimension honesty audit

Each dimension was individually audited for whether a genuine,
already-existing 0–100 scoring formula exists anywhere in this codebase
before deciding whether to score it or report it raw:

| Dimension | Scored? | Source |
|---|---|---|
| Portfolio Health | Yes | `avg()` of each engine's own overall health/risk score |
| Capital Utilisation | No — raw % shown | `tradingRisk.ts` / `portfolioDashboard.ts` |
| Risk Score | Yes | `avg()` of Investing/Trading overall risk score + Options' base-case stress-test safety score |
| Performance | No — raw Sharpe shown | No 0–100 performance-scoring formula exists anywhere in this codebase |
| Diversification | Yes | `avg()` of Investing concentration score + Options diversification score (Trading has none) |
| Exposure | No — raw net Greeks shown | `riskExposureEngine.ts`'s own `combined.greeksSummary` |
| Liquidity | Yes | `avg()` of Trading's/Options' own per-symbol liquidity scores |
| Buying Power | No — raw dollar figures shown | `combined.buyingPowerOverview` |
| Greeks | No — raw net Greeks shown | `portfolioDashboard.ts`'s own `netGreeks` |
| Income Stability | No — raw theta-income figures shown | `optionsIncomeAnalytics.ts`'s own `computeThetaIncome()` |
| Scenario Resilience | Yes | The Scenario Engine's own already-computed Market -10% `riskScoreAfter` |

5 of 11 dimensions genuinely have a shared 0–100 scoring convention and
are scored (and feed the composite); the other 6 are shown as honest
raw figures. This ratio is disclosed, not hidden — the exact same
"self-documenting availability ratio" pattern Investment Quality (Phase
2 Sprint 15) and Competitive Advantage (Phase 2 Sprint 21) both already
established for their own permanently-partial dimension sets.

## Executive Alerts — deterministic, never a forecast

Every alert in `buildExecutiveAlerts()` is a named-threshold comparison
against an already-computed figure — never a probability, never a
forecast, never a suggested action:

- **Sector allocation exceeds target** — `combined.sectorConcentration`
  vs. `SECTOR_ALLOCATION_ALERT_PCT` (30%), the kickoff's own named
  example ("Technology allocation exceeds target.").
- **Strategy concentration high** — `combined.strategyConcentration`
  (Options) vs. `STRATEGY_CONCENTRATION_ALERT_PCT` (50%).
- **Expiration concentration high** — `options.dashboard.expirationDistribution`'s
  largest bucket vs. `EXPIRATION_CONCENTRATION_ALERT_PCT` (40%), the
  kickoff's own named example ("Options exposure concentrated in one
  expiration.").
- **Buying power utilisation high** — Trading's
  `portfolioBudget.totalRiskUsedPct` and Options'
  `dashboard.totalRiskPct` vs. their own named 70% thresholds, the
  kickoff's own named example ("Buying power utilisation is high.").
- **Diversification improved/declined** — resolved **only** from two
  real, previously-saved Investing risk snapshots in
  `riskExposureEngine.ts`'s own already-computed
  `combined.concentrationTimeline` — never fabricated, and silent when
  fewer than two data points exist. This is the kickoff's own named
  example ("Portfolio diversification improved.").
- **Scenario resilience concern** — a real, already-computed Market
  -10% impact (from `lib/scenarioEngine.ts`) exceeding 15%/25% of an
  engine's own base value.

No alert here ever states a probability that a condition will occur,
suggests a specific trade/hedge/rebalance, or predicts a future value —
each is purely an observation of a real, already-true condition,
confirmed by a dedicated test scanning the live response for
prediction/forecast/recommendation language.

## Outstanding Issues — a direct surfacing, never a new judgment

`buildOutstandingIssues()` introduces **zero new problem-detection
logic**. Every issue is a pass-through of a condition an existing engine
already flagged: Investing's `unresolvedSymbols`/concentration
cap-breach (from `investingRisk.ts`), Trading's unpriced
positions/missing stop/missing target/risk-budget breach (from
`tradingRisk.ts`), and Options' own `dashboard.guidance` array (from
`portfolioDashboard.ts`). This module never invents a new issue
category.

## What was deliberately NOT built

- **No AI predictions, trade recommendations, buy/sell signals, or
  generative investment advice of any kind.** Every Coach explanation
  (`lib/decisionSupportCoach.ts`) is deterministic, template-based
  prose about concepts only, and structurally cannot take a symbol,
  position, or account figure as input.
- **No portfolio optimisation, auto execution, auto hedging, or auto
  rebalancing.** This phase reads, aggregates, and presents — it never
  writes to a trade, position, or order.
- **No market forecasting or machine learning.** Every figure is either
  a direct reuse of an already-computed value or a plain threshold
  comparison — no statistical model, no trained model, no probability
  distribution.
- **No new database table.** This phase is entirely a read layer over
  the outputs of Phases 37–39's own already-persisted/already-computed
  engines, computed fresh on every request.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts` (only its already-exported, unmodified
`getSnapshot()` function is called read-only — the file itself has a
zero-line diff), `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`, and
every broker-integration file were not modified by any file in this
phase. `lib/riskExposureEngine.ts`, `lib/performanceAttribution.ts`,
`lib/scenarioEngine.ts`, and `lib/portfolioConcentration.ts` were also
not modified — reused verbatim.

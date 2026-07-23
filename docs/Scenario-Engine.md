# Institutional Scenario Engine

Phase 39 — a deterministic cross-platform dashboard evaluating the
impact of hypothetical market moves across Investing, Trading, and
Options portfolios.

**This phase is analytical only.** Nothing here implements or evaluates
AI predictions, market forecasting, price targets, trade
recommendations, portfolio optimisation, auto hedging, auto execution,
Monte Carlo simulation, or random scenario generation. Every scenario is
a deterministic, user-named "what if this hypothetical market move
happened right now" repricing over real, already-open holdings/
positions/trades — never a probability estimate of it actually
occurring.

## Where to find it

`/scenario-engine`, linked from the sidebar navigation, the Command
Palette (inherits the nav entry automatically), the Cross-Engine Quick
Actions list, the Investing Executive Dashboard, the Executive
Intelligence Hub, the Cross-Engine Workspace's own Workspace Shortcuts,
the Institutional Reporting Centre (two new report types), and the
Learning Centre overview.

## Audit summary — what already existed vs. what this phase added

Before writing any code, the following reusable components were
confirmed present and load-bearing for this phase (full detail in
`docs/Institutional-Scenario-Model.md`):

| Component | Reused for |
|---|---|
| `lib/portfolioStressTest.ts`'s `buildPortfolioStressTest()` (an already-shipped What-If Stress Test engine) | Options price/volatility scenario repricing, Portfolio/Asset/Strategy/Greeks/Buying Power/Capital Impact — verbatim, unmodified |
| `lib/optionsMath.ts`'s exported `bs()` (unmodified) | Black-Scholes repricing, now also called with a shocked risk-free rate for interest-rate scenarios |
| `lib/portfolioConstruction.ts`'s `buildPortfolioAllocation()` (Phase 2 Sprint 28) | Investing holdings' resolved price/sector/shares |
| `lib/tradingMarketData.ts`'s `getMarketDataProvider().getQuote()` | Current price per open Trading position |
| `settings.investingRiskFreeRate` (Sprint 11) | Base rate for the new Options interest-rate scenario |
| `lib/tradingScenarioComparison.ts` (Phase 28) | A distinct, unrelated feature — new-trade-entry scenario comparison, not touched by this phase |

**Genuine gaps found, and how they were resolved:**

- No existing module evaluated the SAME hypothetical market move across
  Investing, Trading, and Options at once. New `lib/scenarioEngine.ts`
  is the pure composition layer that does this.
- Investing and Trading had no scenario-repricing formula of any kind.
  A new, deliberately simple linear reprice
  (`shockedPrice = currentPrice * (1 + priceShockPct/100)`) was added —
  the only pricing model these two asset classes get, since raw equity
  positions have no convexity/Greeks in this codebase.
- Options had no interest-rate scenario. `optionsMath.ts`'s own `bs()`
  already accepted an optional risk-free-rate parameter no caller had
  ever supplied — this phase is the first to use it.
- No route existed for a combined scenario read across all 3 engines.
  New `POST /scenario-engine/dashboard`.

## Views

### Scenario Dashboard

The main page (`ScenarioEngine.tsx`), with 3 tabs: Scenario Dashboard,
Coach & Learning, Reporting.

### Market Move Simulator

A form on the Scenario Dashboard tab to add an optional custom
percentage move (with an optional label) alongside the 8 default
scenarios, then run the full evaluation via **POST**
`/scenario-engine/dashboard` — a POST, not a GET, since the dashboard
accepts caller-supplied input, mirroring `lib/portfolioStressTest.ts`'s
own `POST /execution/stress-test` precedent.

### Scenario View selector

Combined (cross-engine), Investing, Trading, or Options — the same
per-engine-view pattern established by
`docs/Risk-Exposure-Engine.md` (Phase 37) and
`docs/Performance-Attribution.md` (Phase 38).

### Portfolio Impact Summary / Asset Impact / Sector Impact / Strategy Impact

Rendered per scenario, per engine, in the Combined view — every figure
reused directly from each engine's own already-computed scenario
result, never blended across engines (see
`docs/Institutional-Scenario-Model.md`'s own "Combined view" section for
exactly why).

### Greeks Impact / Buying Power Impact / Capital Impact

Options-only views, reused verbatim from the existing What-If Stress
Test engine's own already-computed `after.greeks`/
`buyingPowerImpactDollars`/`after.totalRiskDollars`/`after.totalRiskPct`
fields.

### Scenario Comparison

The 4 default price scenarios (Market ±5%/±10%) compared side by side
across all 3 engines, both in the Scenario Dashboard's Combined view and
in the dedicated Scenario Analysis Report.

## Supported scenarios

Deterministic only, per the kickoff's explicit instruction. No
forecasting, no probability estimates.

| Key | Label | Category |
|---|---|---|
| `market_up_5` | Market +5% | price |
| `market_down_5` | Market -5% | price |
| `market_up_10` | Market +10% | price |
| `market_down_10` | Market -10% | price |
| `volatility_up` | Volatility Increase (+20%) | volatility |
| `volatility_down` | Volatility Decrease (-20%) | volatility |
| `rate_up` | Interest Rate Increase (+100bps) | rate |
| `rate_down` | Interest Rate Decrease (-100bps) | rate |
| `custom_N` | Custom (±N%) | price |

Volatility and rate scenarios are honestly `available: false` for
Investing and Trading — see
`docs/Institutional-Scenario-Model.md`'s "Honest inapplicability"
section.

## AI Coach & Learning Centre

`lib/scenarioCoach.ts` — 5 deterministic, template-based explanations
(scenario analysis, stress testing, portfolio resilience, Greeks impact,
capital impact), reusing the platform's existing `COACH_DISCLAIMER`
unmodified. Never a trade recommendation — enforced structurally, since
`explainScenarioTopic()`'s own signature takes only a topic key, never a
symbol, position, or account figure.

`lib/scenarioLearning.ts` connects each of those 5 topics to real,
already-existing Learning Centre content (`portfolio-stress-testing`,
`portfolio-event-risk`, `portfolio-health`, `greeks-portfolio-greeks`,
`institutional-capital-allocation`, `portfolio-buying-power`,
`institutional-risk-contribution`) — zero duplicated lesson content.

## Reporting Centre integration

Two new report types, both pure reformats of the same
`buildScenarioDashboard()` output — see `docs/Stress-Testing.md` for the
Stress Test Report's own detail.

- **Scenario Analysis Report** (`GET /reporting/scenario-analysis-report`)
  — the full multi-scenario, multi-engine picture: Executive Summary,
  Portfolio Impact Summary, Asset Impact, Sector Impact, Strategy
  Impact, Scenario Comparison.
- **Stress Test Report** (`GET /reporting/stress-test-report`) — the
  Options-focused severe-scenario deep dive.

## Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/scenario-engine/dashboard` | The full cross-engine scenario dashboard, optionally with custom scenarios |
| GET | `/scenario-engine/coach` | All 5 AI Coach explanations |
| GET | `/scenario-engine/coach/:topic` | One explanation (404 for unknown topic) |
| GET | `/scenario-engine/learning` | All 5 topics' own Learning Centre links |
| GET | `/scenario-engine/learning/:topic` | One topic's links (404 for unknown topic) |
| GET | `/reporting/scenario-analysis-report` | Scenario Analysis Report |
| GET | `/reporting/stress-test-report` | Stress Test Report |

## Testing

- `lib/scenarioCoach.test.ts` / `lib/scenarioLearning.test.ts` — pure
  unit tests for the deterministic coach/learning modules, mirroring the
  established `riskExposureCoach.test.ts`/`riskExposureLearning.test.ts`
  pattern.
- `routes/scenarioEngine.route.test.ts` — live end-to-end HTTP tests
  against a real Postgres connection and the real Better-Auth instance:
  the honest empty-portfolio dashboard, real linear repricing for a real
  Investing holding and Trading position (proven internally consistent
  against the response's own resolved prices, not a hardcoded expected
  figure), Market -10% vs. Market +5%'s genuinely opposite-and-larger
  impact, the Market Move Simulator's custom scenario (with and without
  an explicit label), the reused Options Stress Test engine plus the new
  interest-rate scenarios, tenant isolation, the AI Coach and Learning
  Centre endpoints (including 404s for unknown topics), no special-auth
  requirement, a 400 for a malformed request body, both new Reporting
  Centre report types, and a structural scan proving no probability
  estimate/forecast/recommendation ever appears in the response.
- `pages/ScenarioEngine.test.tsx` — frontend smoke tests following the
  established mocked-generated-hook pattern (the dashboard hook is a
  mutation, mocked the same way `PortfolioStressTest.test.tsx` already
  established for its own POST-based simulator).
- `routes/institutionalReporting.route.test.ts` was extended (not
  rewritten) to cover the 2 new report types and the updated report-type
  count (20 → 22).

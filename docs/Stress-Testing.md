# Stress Testing (Phase 39)

The Options-focused half of the Institutional Scenario & Stress Testing
Engine — see `docs/Scenario-Engine.md` for the full cross-engine
Scenario Dashboard and `docs/Institutional-Scenario-Model.md` for the
detailed design record.

## What "stress testing" means in this platform

Stress testing is scenario analysis pushed to the platform's own named
**severe** scenarios — Market -5%, Market -10%, and Volatility Increase
(+20%) — specifically to see how much damage a genuinely bad day could
do, not how likely that day is. A stress test never states a probability
of the scenario happening; it only reports what would happen to the
real, already-open portfolio if it did.

This is not a new engine. The Options side of stress testing was already
fully built and already tested before this phase began:
`lib/portfolioStressTest.ts`'s own `buildPortfolioStressTest()` (the
existing Portfolio Stress Test & Scenario Simulator page, reachable at
`/execution/stress-test`) already reprices every open options position
via `optionsMath.ts`'s own unmodified `bs()`, at a shocked underlying
price / shocked implied volatility / reduced time-to-expiration, and
already produces the exact figures this phase's "Stress Test Report"
needs. Phase 39 does not reimplement any of that — it reuses it
**verbatim** and adds one, disclosed, genuinely new formula (interest-
rate scenarios) plus a Reporting Centre presentation layer on top.

## Greeks Impact under stress

An options portfolio's own net delta/gamma/theta/vega are computed at
today's market conditions, and can shift meaningfully once a large shock
actually happens (gamma changes each position's own delta as the
underlying moves). The Stress Test Report's own "Greeks Impact" section
shows the SAME real open positions' Greeks immediately AFTER each severe
scenario's shock — `after.greeks` — alongside each Greek's own change
(`deltaChange`/`gammaChange`/`thetaChange`/`vegaChange`), all reused
directly from `lib/portfolioStressTest.ts`'s own already-computed
`ScenarioComparisonEntry`.

## Buying Power Impact

`buyingPowerImpactDollars` — reused directly from the existing engine's
own already-computed comparison. Never a fabricated estimate.

## Capital Impact

`base.totalRiskDollars`/`base.totalRiskPct` (before) and
`after.totalRiskDollars`/`after.totalRiskPct` (after), reused directly.
A defined-risk options strategy's own reserved margin does not move
purely because a price/volatility shock changed the position's
mark-to-market value — this is intentionally shown as largely unchanged
across scenarios, since that's a real, correct property of defined-risk
strategies (e.g. an iron condor's max loss is fixed at open), not an
unimplemented feature.

## Portfolio Resilience

Resilience is how much of a portfolio's value survives a genuinely bad
scenario intact. This platform never scores "resilience" with a single
fabricated number — the Stress Test Report instead shows the real,
repriced impact under each severe scenario side by side (Portfolio Value
Impact, Unrealized P&L Impact, Drawdown %), and the reader draws their
own conclusion by comparing across scenarios.

## The Stress Test Report

`GET /reporting/stress-test-report` (`buildStressTestReport()` in
`lib/institutionalReporting.ts`) narrows the full Scenario Dashboard to
exactly the platform's own 3 named severe scenarios
(`market_down_5`, `market_down_10`, `volatility_up`) and reformats them
into the standard `InstitutionalReport` shape:

1. **Executive Summary** — how many severe scenarios were evaluated, and
   the single worst modeled outcome by unrealized P&L impact.
2. **Portfolio Impact Summary (Severe Scenarios)** — portfolio value/
   unrealized P&L impact and drawdown % per severe scenario.
3. **Greeks Impact** — as above.
4. **Buying Power Impact** — as above.
5. **Capital Impact** — as above.

When the user has no open Options positions, the report honestly states
this in its Executive Summary (surfacing
`buildPortfolioStressTest()`'s own `inputIssues`) rather than fabricating
a stress-test result.

## Interest rate scenarios — the one genuinely new formula in this phase

`optionsMath.ts`'s own exported `bs()` already accepts an optional
risk-free-rate parameter `r` that no existing caller in this codebase
ever supplied. `lib/scenarioEngine.ts`'s `computeRateShockedTrade()`
supplies a shocked rate (base rate ± 100bps, read from the real
`settings.investingRiskFreeRate` field) to that already-existing
parameter, repricing every leg of every open options trade the same way
`portfolioStressTest.ts`'s own `computeShockedGreeks()` reprices for
price/IV/time shocks — a genuine reuse of existing deterministic
mathematics, never a new pricing model. `optionsMath.ts` itself was
never modified.

## What was deliberately NOT built

- No probability that a stress scenario actually occurs.
- No hedge or de-risking recommendation — the report states the real,
  repriced impact for the user's own review, never a suggested action.
- No new severe-scenario category beyond the platform's own already-named
  3 (Market -5%, Market -10%, Volatility Increase) — a future phase could
  extend this list, but this phase did not invent new named severity
  tiers.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts` (zero-line diff — only its already-
exported `bs()` is called with a new argument value elsewhere),
`risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`, and every broker-
integration file were not modified. `lib/portfolioStressTest.ts` itself
also has a zero-line diff this phase — reused, not touched.

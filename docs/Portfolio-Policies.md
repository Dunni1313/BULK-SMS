# Portfolio Policies (Phase 42)

The Policy Engine half of the Institutional Portfolio Monitoring &
Compliance Engine — see `docs/Monitoring-Compliance-Engine.md` for the
full dashboard/Coach/Learning/Reporting picture and
`docs/Institutional-Governance-Model.md` for the detailed design
record.

## What a "policy" is in this platform

A policy is a **user-chosen limit** — never a scoring formula, never a
prediction, never a recommendation. It pairs a `policyType` (one of 15
fixed, documented types) with a `limitValue` and a `direction`
(`max`: the current value must not exceed the limit; `min`: the
current value must not fall below the limit). Optionally, a
`targetKey` scopes the policy to one specific named entity (a sector,
a symbol, a strategy, an expiration bucket); when left blank, the
policy honestly applies to whichever entity of that type currently has
the highest/most-extreme value — a blanket rule, resolved fresh at
evaluation time, never defaulted to a fabricated entity name.

Every evaluation reports four honest things: the **current value**
(resolved fresh from an already-computed engine, never cached, never
persisted), the **limit** (the user's own chosen value), the
**difference** (`currentValue - limitValue`), and the **status**
(`compliant` / `breach` / `unavailable`). `unavailable` is never a
disguised `compliant` or `breach` — it means the underlying figure
genuinely could not be resolved (e.g. a `targetKey` that matches
nothing), and it is honestly excluded from both the compliant and
breach counts.

## The 15 policy types

| Policy Type | Category | Direction | Unit | Suggested default | Current-value source |
|---|---|---|---|---|---|
| `sector_allocation_max` | sector | max | pct | 40 (`SECTOR_CONCENTRATION_CAP_PCT`) | `risk.combined.sectorConcentration`, picked by `targetKey` (sector name) or the largest sector |
| `position_allocation_max` | position | max | pct | 25 (`SINGLE_SYMBOL_CONCENTRATION_CAP_PCT`) | `risk.investing.allocationBySymbol`, picked by `targetKey` (symbol) or the largest holding |
| `strategy_allocation_max` | strategy | max | pct | 50 (`STRATEGY_CONCENTRATION_ALERT_PCT`) | `risk.combined.strategyConcentration`, picked by `targetKey` (strategy) or the largest strategy |
| `investing_capital_allocation_max` | asset | max | usd | 100,000 | `risk.investing.risk.totalMarketValue` |
| `trading_capital_allocation_max` | asset | max | usd | 100,000 | `risk.trading.accountValue` |
| `options_capital_allocation_max` | asset | max | usd | 100,000 | `risk.options.dashboard.portfolioValue` |
| `trading_buying_power_utilization_max` | buying_power | max | pct | 6 (`MAX_PORTFOLIO_RISK_PCT`) | `risk.trading.risk.portfolioBudget.totalRiskUsedPct` |
| `options_buying_power_utilization_max` | buying_power | max | pct | 70 (`OPTIONS_RISK_UTILIZATION_ALERT_PCT`) | `risk.options.dashboard.totalRiskPct` |
| `portfolio_delta_max` | greeks | max | delta | 100 | `abs(risk.combined.greeksSummary.delta)` |
| `portfolio_gamma_max` | greeks | max | gamma | 10 | `abs(risk.combined.greeksSummary.gamma)` |
| `portfolio_theta_exposure_max` | greeks | max | theta | 500 | `abs(risk.combined.greeksSummary.theta)` |
| `expiration_concentration_max` | strategy | max | pct | 40 (`EXPIRATION_CONCENTRATION_ALERT_PCT`) | `risk.options.dashboard.expirationDistribution`, picked by `targetKey` (bucket) or the largest bucket |
| `investing_diversification_min` | diversification | min | score | 60 | `diversification.investing.score` |
| `options_diversification_min` | diversification | min | score | 60 | `diversification.options.score` |
| `options_income_stability_min` | income_stability | min | pct | 1 | see below |

Every "suggested default" is deliberately **reused, not invented** —
the exact same named constants already used elsewhere in this
codebase for the same concept (`lib/investingRisk.ts`'s
`SINGLE_SYMBOL_CONCENTRATION_CAP_PCT`/`SECTOR_CONCENTRATION_CAP_PCT`,
`lib/tradingRisk.ts`'s `MAX_PORTFOLIO_RISK_PCT`,
`lib/decisionSupportEngine.ts`'s own alert thresholds). A user is free
to accept, edit, or ignore every default — nothing is ever
auto-created without an explicit user action.

Note the deliberate per-engine split for capital allocation and
buying-power utilization (`investing_capital_allocation_max` /
`trading_capital_allocation_max` / `options_capital_allocation_max`,
and `trading_buying_power_utilization_max` /
`options_buying_power_utilization_max`): each policy row reads exactly
one engine's own figure, never a blended read — a structural
enforcement of the "Investing, Trading, and Options capital figures
are always evaluated and shown side by side, never summed into one
blended total" discipline already established for the Risk & Exposure
Engine and the Rebalancing Engine.

## Income Stability — the one genuinely new ratio

`options_income_stability_min` is the only policy type this phase
introduces genuine new arithmetic for:

```
incomeStabilityPct = (optionsThetaMonthly / optionsBuyingPower) * 100
```

`optionsThetaMonthly` is the Options Income Engine's own already-
computed projected monthly theta income
(`buildOptionsIncomeDashboard(inputs).overview.theta.monthly`, Phase
35). `optionsBuyingPower` is the Options Risk & Exposure view's own
already-computed buying power (`risk.options.dashboard.buyingPower`).
Both are real, already-tested figures — this ratio is a plain division
of two numbers this codebase already computes elsewhere, never a new
scoring model. Honestly `null` (never a fabricated 0 or a divide-by-
zero artifact) whenever either input is unresolved or the buying power
is zero or negative.

## Evaluation — how a current value becomes a status

`evaluatePolicy()` (`lib/complianceEngine.ts`) is the single, generic
comparison function every policy type shares:

1. Look up the policy type's own metadata (`policyTypeMeta()`) —
   category, unit, direction.
2. Resolve the current value via `resolveCurrentValue()`'s per-type
   switch (the table above), honestly `null` when the figure can't be
   resolved.
3. If the current value is `null`, the status is `unavailable` and the
   detail sentence says so plainly — never a fabricated compliant or
   breach reading.
4. Otherwise, the status is `breach` when (`direction === "max"` and
   `currentValue > limitValue`) or (`direction === "min"` and
   `currentValue < limitValue`), else `compliant`.
5. The detail sentence is deterministic and template-based (e.g.
   "AAPL Position Cap: current 40% exceeds the 25% limit.") — never
   LLM-generated, never a suggested remediation.

`pickEntry()` is the one shared helper behind every
`targetKey`-scoped policy type (sector/position/strategy/expiration):
if a `targetKey` is set, it case-insensitively sums every matching
entry's own value (so a `targetKey` matching more than one entry, e.g.
a sector name that happens to match two rows, is honestly summed, not
arbitrarily picked); if left blank, it picks whichever entry currently
has the highest value — the "apply to whichever entity is currently
largest" blanket-rule semantics, resolved fresh on every evaluation.

## The Compliance Summary — aggregated, not per-policy

`buildComplianceSummary()` rolls every evaluation up into one summary:
total policies, enabled policies, and compliant/breach/unavailable
counts — **computed only over enabled policies**, so a disabled
policy is a real, visible row in its own category list but never
distorts the headline read or appears in Policy Violations, even when
its own current value would otherwise breach. `overallStatus` is
`no_policies` when there are zero enabled policies, `breach` when at
least one enabled policy is in breach, else `compliant`.

## What was deliberately NOT built

- No trade recommendation, buy/sell signal, suggested share count, or
  order — every evaluation is a comparison and a status, never an
  instruction to act.
- No probability estimate, forecast, or prediction — every current
  value is a real, already-computed present-tense figure.
- No auto-remediation of a breach — Policy Violations are deterministic
  observations only.
- No persisted compliance-evaluation history — every evaluation is
  computed fresh on every read; the Compliance Timeline is reused
  directly from the Risk & Exposure Engine's own Concentration
  Timeline, the closest genuine historical proxy this codebase has.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and every broker-integration file were not
modified. `lib/decisionSupportEngine.ts`'s own
`buildDiversificationSummary()` behavior is byte-identical to before
this phase — the only change to that file is the additive `export`
keyword, confirmed behavior-preserving.

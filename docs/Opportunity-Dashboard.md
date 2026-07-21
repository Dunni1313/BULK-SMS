# Opportunity Dashboard (Phase 43)

The per-symbol analytics half of the Institutional Watchlists &
Opportunity Dashboard — see `docs/Watchlists-Engine.md` for the full
dashboard/Coach/Learning/Reporting picture and
`docs/Institutional-Watchlists-Model.md` for the detailed design record.

## What "Opportunity Overview" is in this platform

Opportunity Overview is a **deterministic, descriptive snapshot** of every
distinct symbol a user has chosen to watch — never a ranked or scored
"opportunity," never a buy/sell signal, never a prediction. Every field is
either a direct read from an already-computed engine or an honest `null`
when the underlying figure genuinely doesn't apply (the symbol isn't held
anywhere, or the relevant engine has no concept of it).

## The per-symbol analytics shape

For each distinct watched symbol, the engine reports:

| Field | Source | Honest-null condition |
|---|---|---|
| `heldInInvesting` / `heldInTrading` / `heldInOptions` | Whether the symbol appears in `riskExposureEngine.ts`'s own Investing allocation, `performanceAttribution.ts`'s own Trading positions, or Options allocation/trades | Never fabricated — a symbol not resolved in any of the three stays honestly `false` in all three |
| `investing.marketValue` / `investing.weightPct` | `risk.investing.allocationBySymbol` (Phase 37) | `null` when not held in Investing |
| `investing.unrealizedPnl` / `unrealizedPnlPct` / `sector` | `performance.investing.holdings` (Phase 38) | `null` when not held in Investing |
| `trading.openPositionsCount` / `closedPositionsCount` / `totalRealizedPnl` | `performance.trading.positions` (Phase 38) | `null`/`0` counts when not held in Trading |
| `options.weightPct` | `risk.options.dashboard.allocationBySymbol` (Phase 37) | `null` when not held in Options |
| `options.openPositionsCount` / `totalCurrentPnl` | `performance.options.trades` (Phase 38) | `0`/`null` when not held in Options |
| `options.netDelta` / `netTheta` | `lib/coach.ts`'s `positionGreeks()`, summed over the symbol's own open Options legs | `null` when no open Options position exists for the symbol |
| `compliance` | `complianceEngine.ts`'s own `evaluatePolicy()` output for any `position_allocation_max` policy whose `targetKey` matches the symbol (Phase 42) | `null` when no such policy is configured for this symbol — a genuinely different meaning from the Compliance Engine's own `unavailable` status, which means "a policy exists but its current value couldn't be resolved" |
| `scenarioWorstCaseImpactDollars` / `scenarioWorstCaseLabel` | The most negative impact across `scenarioEngine.ts`'s own default shock scenarios (Phase 39), for Investing/Trading holdings only | `null` when the symbol isn't held in Investing or Trading |

### Why Options scenario impact is honestly excluded

The Scenario Engine's own Options view models interest-rate shocks and a
portfolio-level stress test (Phase 39) — it doesn't produce a per-symbol,
per-scenario dollar-impact figure in the same shape Investing/Trading
holdings do. Rather than approximate one, an Options-only position's
`scenarioWorstCaseImpactDollars` stays honestly `null` even when the
symbol is held there.

## Zero N+1 provider calls

Every one of the engines above is a **whole-portfolio** dashboard, never a
per-symbol external data fetch. Computing analytics for every watched
symbol costs zero additional provider calls beyond the one-time dashboard
fetch — the same reason the Compliance Engine's own per-policy evaluation
(Phase 42) is cheap regardless of how many policies exist. This is why the
entire Watchlists Dashboard, including the full Opportunity Overview, is
built **eagerly**, in one call (`GET /investing/watchlists/dashboard`),
rather than split into a separate on-demand route the way Phase 2's
Statements/Peers/Filings modules were (those modules genuinely do cost one
provider call per peer/document).

## The dashboard-level roll-up

Four figures are derived from the full Opportunity Overview array, never
duplicating an existing formula:

- **Highest Risk** — the held symbol with the most negative
  `scenarioWorstCaseImpactDollars`.
- **Highest Exposure** — the held symbol with the largest single
  Investing-or-Options weight percentage.
- **Highest Allocation** — the held symbol with the largest Investing
  dollar market value.
- **Policy Breaches** — every enabled, currently-breached compliance
  policy (not scoped to watched symbols — the same dashboard-wide list
  `complianceEngine.ts` itself already produces).

All four are honestly `null`/empty when no watched symbol is held
anywhere — never a fabricated "top" pick from zero real candidates.

## What was deliberately NOT built

- **No ranked or scored "opportunity" list.** Every symbol in the
  Opportunity Overview is presented in the same deterministic order the
  dashboard's own distinct-symbol discovery produces — never sorted by an
  implied "best opportunity first."
- **No buy/sell signal, no suggested trade, no suggested share count.**
  Every figure describes a real, current state — never an instruction to
  act.
- **No AI prediction, forecast, or probability estimate.** Scenario impact
  is a hypothetical shock under the platform's own already-existing
  default scenarios (Market ±5%/±10%, Volatility Increase/Decrease,
  Interest Rate Increase/Decrease) — never a real-world forecast.
- **No auto watchlist generation.** A symbol only ever appears in the
  Opportunity Overview because a user explicitly added it to a watchlist.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and every broker-integration file were not modified.
`lib/riskExposureEngine.ts`, `lib/performanceAttribution.ts`,
`lib/scenarioEngine.ts`, `lib/decisionSupportEngine.ts`, and
`lib/complianceEngine.ts` were also not modified — reused verbatim.

# Executive Insights (Phase 40)

The Executive Alerts / Outstanding Issues / Key Metrics half of the
Institutional Decision Support Engine — see `docs/Decision-Support-Engine.md`
for the full Executive Dashboard and
`docs/Institutional-Decision-Model.md` for the detailed design record.

## What "executive insights" means in this platform

An executive insight is a deterministic, threshold-based observation
over already-computed data — never a forecast, never a probability
estimate, never a suggested action. "Technology allocation exceeds
target" is a statement about a real, current percentage crossing a
named, disclosed threshold; it is not a prediction that the allocation
will keep growing, and it never suggests trimming the position.

This is not a new engine. Every figure an Executive Insight reads from
was already computed by an existing, already-tested module before this
phase began — Risk & Exposure (Phase 37), Performance & Attribution
(Phase 38), Scenario & Stress Testing (Phase 39), Portfolio
Concentration. Phase 40 adds exactly one new layer: a set of named
thresholds and pass-through rules that turn those already-computed
figures into a short, scannable list.

## Executive Alerts

`buildExecutiveAlerts()` (`lib/decisionSupportEngine.ts`) evaluates 6
categories, each a plain comparison against a named constant:

| Alert | Threshold constant | Value |
|---|---|---|
| Sector allocation exceeds target | `SECTOR_ALLOCATION_ALERT_PCT` | 30% |
| Strategy concentration high | `STRATEGY_CONCENTRATION_ALERT_PCT` | 50% |
| Expiration concentration high | `EXPIRATION_CONCENTRATION_ALERT_PCT` | 40% |
| Trading risk-budget utilisation high | `TRADING_RISK_UTILIZATION_ALERT_PCT` | 70% |
| Options buying-power utilisation high | `OPTIONS_RISK_UTILIZATION_ALERT_PCT` | 70% |
| Diversification improved/declined | `DIVERSIFICATION_CHANGE_NOTABLE_POINTS` | 5 points |

Each alert carries an `engine` tag (`investing`/`trading`/`options`/
`cross-engine`), a `severity` (`info`/`moderate`/`elevated`), a short
`label`, and a `detail` sentence stating the real number and the
threshold it crossed — never a vague qualitative claim. Severity for the
two allocation-based alerts escalates to `elevated` only when the real
figure exceeds 1.5× the named threshold — a disclosed, deterministic
escalation rule, not a second hidden threshold.

The "Portfolio diversification improved/declined" alert is the most
carefully honesty-guarded of the six: it is generated **only** from two
real, previously-saved Investing risk snapshots
(`riskExposureEngine.ts`'s own already-computed
`combined.concentrationTimeline`, sourced from
`investing_risk_snapshots`) — never fabricated, and silently absent
whenever fewer than two snapshots exist yet for the calling user.

## Outstanding Issues

`buildOutstandingIssues()` never invents a new problem-detection rule —
it surfaces conditions the underlying engines already flag:

- Investing: unresolved symbols (from `investingRisk.ts`'s own
  `unresolvedSymbols`), a breached single-symbol concentration cap.
- Trading: unpriced positions (no stop, so dollar-sizing is impossible),
  positions missing a stop, positions missing a target, a breached
  portfolio risk budget.
- Options: every entry in `portfolioDashboard.ts`'s own `guidance`
  array, reused verbatim.

## Key Metrics Dashboard

`buildKeyMetrics()` is a flat, 12-entry re-presentation of already-
computed headline figures — market value, health score, and realized/
unrealized P&L per engine, plus Options' own buying power, and 2
cross-engine tallies (overall health score, symbols held across
multiple engines). Each entry carries a `unit` (`usd`/`pct`/`score`/
`count`) so the frontend renders it correctly without re-deriving the
unit from the metric's own code.

## The Executive Decision Summary Report

`GET /reporting/executive-decision-summary`
(`buildExecutiveDecisionSummaryReport()` in
`lib/institutionalReporting.ts`) reformats the Decision Support
dashboard's Executive Summary, Portfolio Health Overview, Executive
Alerts, Outstanding Issues, and Key Metrics Dashboard into the standard
`InstitutionalReport` shape:

1. **Executive Summary** — the deterministic summary sentence, plus a
   per-engine breakdown.
2. **Portfolio Health Overview** — each engine's own score, side by
   side.
3. **Executive Alerts** — every alert's own label/detail, or an honest
   "no alerts" statement when every monitored threshold is within
   range.
4. **Outstanding Issues** — every issue's own label/detail, or an
   honest "no issues" statement.
5. **Key Metrics Dashboard** — all 12 headline figures.

## What was deliberately NOT built

- No probability that a flagged condition will worsen or improve.
- No hedge, rebalance, trim, or trade suggestion of any kind — every
  alert and issue states a real, current fact for the user's own
  review, never a recommended response.
- No new alert category beyond the 6 named here and the outstanding-
  issue categories already flagged by the underlying engines — a
  future phase could extend this list, but this phase did not invent
  new severity tiers or alert types beyond what's documented above.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts` (zero-line diff — only its already-
exported, unmodified `getSnapshot()` is called read-only), `risk.ts`,
`autoExecution.ts`, `autoAdjustment.ts`, and every broker-integration
file were not modified. `lib/riskExposureEngine.ts`,
`lib/performanceAttribution.ts`, `lib/scenarioEngine.ts`, and
`lib/portfolioConcentration.ts` also have a zero-line diff this
phase — reused, not touched.

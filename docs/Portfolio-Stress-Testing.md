# Portfolio Stress Test & Scenario Simulator

This document covers the Portfolio Stress Test & Scenario Simulator as it
exists after the **Portfolio Stress Test & Scenario Simulator** sprint.
It is a companion to `docs/Alpaca-Paper-Trading-Architecture.md` §4.11,
which covers the same sprint at a higher level alongside the rest of the
Alpaca integration — read that document for the broader architectural
context; this one is scoped to the simulator itself in detail. It also
directly extends `docs/Trade-Adjustment.md` and `docs/Position-Sizing.md`
(the two prior sprints, whose reusable exposure/pricing helpers this
sprint builds on) — read those documents first if you haven't already.

---

## 1. What this is

A dedicated What-If simulator, `/stress-test`, that applies hypothetical
underlying price, implied-volatility, and time-decay shocks to the
user's own **current open portfolio** and shows the resulting impact —
without ever placing, closing, or modifying a real order, and without
ever contacting a broker.

1. **Scenario Simulator** — build one or more scenarios, each combining
   a price shock, an IV shock, and/or time decay (support for combining
   multiple shocks in one scenario is inherent in the shape of a single
   scenario, not a separate mode).
2. **Portfolio Impact** — portfolio value before/after, unrealized P/L
   impact, buying power impact (estimated), Greeks before/after and their
   deltas, exposure by symbol/strategy, and an always-honest
   sector-exposure disclosure.
3. **Risk Analysis** — largest losing/gaining position, positions
   breaching a configured risk threshold, concentration changes,
   portfolio drawdown, and a risk score before/after.
4. **Scenario Comparison** — every requested scenario is evaluated
   independently against the same starting portfolio and returned
   side by side, so named presets (Bullish/Bearish/High Vol/Low Vol) and
   custom combinations can be compared directly.

**All pricing calculations reuse this platform's existing options-math
engine. No execution logic was modified. No broker writes occur. No
orders are submitted. Every scenario result is hypothetical** — every one
of these is true by construction, not just by convention, and is proven
by this sprint's own test suite (see §7).

---

## 2. Backend: `POST /execution/stress-test`

New files this sprint, both purely additive:
- `artifacts/api-server/src/lib/portfolioStressTest.ts` —
  `buildPortfolioStressTest(input, userId)`.
- `artifacts/api-server/src/routes/portfolioStressTest.ts` — the one new
  route.

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, and
`autoAdjustment.ts` are **not modified** by this sprint — confirmed via
`git diff --stat` at every checkpoint. `serverState.ts` gained one
purely additive change: its previously-private `daysUntil()` helper was
`export`ed (zero logic change) so this sprint's own repricing function
could reuse the exact same days-to-expiration derivation
`computeTradeGreeks()` already uses.

### 2.1 Request

```json
{ "scenarios": [{ "label": "Sharp Selloff", "priceShockPct": -10, "ivShockPct": 25, "timeDecayDays": 7 }] }
```

`scenarios` is optional — when omitted or empty, the request runs
against `DEFAULT_SCENARIO_PRESETS` (Bullish +5% / Bearish -5% / High Vol
+20% IV / Low Vol -20% IV), so a caller always gets a useful result with
zero configuration.

### 2.2 Response shape (abbreviated)

```
{
  available: true,
  inputIssues: [{ index, field, code, message }],
  accountValue: number,
  credentialsConfigured, brokerConnected, lastBrokerCheckAt,
  sectorExposure: { available: false, reason },   // always this shape
  base: ScenarioEvaluation,        // the real, unshocked current portfolio
  riskScoreBefore: number,
  scenarios: [{
    label, shock: { priceShockPct, ivShockPct, timeDecayDays },
    after: ScenarioEvaluation,
    portfolioValueImpact, unrealizedPnlImpact, buyingPowerImpactDollars,
    deltaChange, gammaChange, thetaChange, vegaChange,
    largestLosingPosition, largestGainingPosition,
    positionsBreachingThreshold, concentrationChanges,
    drawdownPct, riskScoreAfter,
  }],
  generatedAt: string,
}
```

`ScenarioEvaluation` = `{ portfolioValue, totalUnrealizedPnl, greeks,
exposureBySymbol, exposureByStrategy, totalRiskDollars, totalRiskPct,
buyingPower, positions: [...] }`. Every position within it carries its
own shocked `greeks`/`costToClose`/`unrealizedPnl`/`unrealizedPnlPercent`.

This response is **never `available: false`** — an empty portfolio, an
invalid scenario shape, or missing credentials are all honestly reflected
in zeroed-out figures / `inputIssues` rather than a blanket failure,
since there's always something to show (the base case, even if empty).

---

## 3. The repricing engine — one new function, built entirely on optionsMath.ts

The one genuinely new pricing function this sprint introduces,
`computeShockedGreeks()`, is a shock-parameterized sibling of
`serverState.ts`'s own `computeTradeGreeks()` — not a modification of it.
It reprices every leg of a position at:

- a **shocked underlying price**: `snap.price × (1 + priceShockPct / 100)`
- a **shocked implied volatility**: `snap.iv × (1 + ivShockPct / 100)`
- a **reduced days-to-expiration**: `daysUntil(leg.expiration) − timeDecayDays`

via `optionsMath.ts`'s own unmodified `bs()` (Black-Scholes pricing and
Greeks) — the identical function `computeTradeGreeks()` already calls for
the unshocked mark. **At `Shock = {0, 0, 0}` this function is
byte-identical to `computeTradeGreeks()`'s own output** — proven directly
by a dedicated regression test (`lib/portfolioStressTest.test.ts`'s
"the zero-shock base position is byte-identical to computeTradeGreeks()'s
own output"), not just asserted in this document.

`bs()` itself already floors `T` at `1/365` and `sigma` at `0.01`
internally (unmodified, pre-existing behavior) — an extreme time-decay
shock that would push a position past its own expiration, or an extreme
IV crush, is therefore handled honestly by the existing engine's own
guard rails, never a separate ad-hoc clamp duplicating that logic.

Shock inputs themselves are clamped into sane numeric bounds before
repricing (price: -99% to +1000%; IV: -99% to +2000%; time decay: 0 to
3650 days) — "extreme scenarios" are computed, not rejected, but a
shock that would make the underlying price zero or negative (e.g. a
-100% price move) is never passed through to `bs()`.

---

## 4. Portfolio-level aggregation

`evaluateScenario(trades, accountValue, shock)` computes one full
`ScenarioEvaluation` for a given shock, and is called exactly twice per
request path: once with `Shock = {0,0,0}` (the always-present `base`
field) and once per requested scenario (`scenarios[i].after`) — the
"before" state is therefore never duplicated logic, it's the same
function called with a zero shock.

- **Portfolio value** = `accountValue + Σ(shocked unrealizedPnl)` — the
  exact same convention `routes/portfolio.ts`'s own Engine 3 dashboard
  already uses for its own `accountValue` field (`ACCOUNT_BASE +
  realized + unrealized`).
- **Exposure by symbol / by strategy** — grouped, summed shocked
  `costToClose` (mark-to-market value), not the structural `maxLoss` —
  deliberately genuinely shock-driven, unlike Position Sizing's own
  `exposureBySymbol` (which is maxLoss-based and therefore intentionally
  static across scenarios, see §5 below).
- **Structural risk figures** (`totalRiskDollars`/`totalRiskPct`) reuse
  `lib/positionSizing.ts`'s own already-exported `buildSnapshot()`
  unmodified — a defined-risk spread's reserved margin is fixed at trade
  open and does not move under any of these shocks.
- **Exposure by sector is always honestly reported unavailable** — the
  exact same disclosure Position Sizing already established:
  `{available: false, reason: "No sector/industry classification is
  stored on options positions in this engine."}`. Never fabricated.

---

## 5. Buying power impact — honestly always zero, and why that's correct

`buyingPower = (accountValue − totalRiskDollars) × 2`, reusing
`routes/portfolio.ts`'s own established formula unmodified. Since
`totalRiskDollars` is structural (`maxLoss`-based) and every supported
strategy in this engine is a defined-risk spread, its reserved margin
does not change under a price/IV/time shock — only the position's
current mark-to-market value does. **`buyingPowerImpactDollars` is
therefore a real, computed value that is honestly always `0`** for every
scenario against every portfolio — not a hardcoded placeholder, and not
an unimplemented feature; it is a disclosed, correct property of
defined-risk strategies, proven by a dedicated test
("buying power impact is honestly zero").

---

## 6. Risk score — a new, disclosed, named formula

`riskScoreBefore`/`riskScoreAfter` are the one genuinely new scoring
formula this sprint introduces, following the same "state a reasonable
default, disclose it" precedent as Position Sizing's
`BUYING_POWER_EXHAUSTION_THRESHOLD_PCT`/`MAX_LEVERAGE_RATIO` and Trade
Adjustment's `ADJUSTMENT_LEVERAGE_RATIO`. It blends 3 equally-weighted
components (each 0–100, higher is healthier):

1. **Concentration score** — `100 − (largest single-symbol exposure % ×
   100 / RISK_SCORE_CONCENTRATION_CAP_PCT)`, floored at 0.
   `RISK_SCORE_CONCENTRATION_CAP_PCT = 25`.
2. **Portfolio risk utilization score** — `100 − (totalRiskPct ÷
   settings.maxPortfolioRisk × 100)` — reuses the user's own already-
   configured `maxPortfolioRisk` setting (the same field
   `execution.ts`'s own `validatePreTrade` enforces), never a new
   threshold.
3. **Drawdown score** — `100 − (|drawdownPct| × RISK_SCORE_DRAWDOWN_SCALE)`.
   `RISK_SCORE_DRAWDOWN_SCALE = 5` (a 20% portfolio drawdown zeroes this
   component).

`riskScoreBefore` uses `drawdownPct = 0` (the base case can't have
drawn down from itself). `riskScoreAfter` uses that scenario's own
`drawdownPct`.

**Hard-cap override**: whenever any position genuinely breaches the
configured per-trade risk threshold (§7 below) under a scenario, the
blended score is capped at `RISK_THRESHOLD_BREACH_SCORE_CAP = 60`
regardless of how healthy the other two components read — the same
hard-cap-override pattern `investingRisk.ts` (Engine 1) and
`tradingRisk.ts` (Engine 2) already established for their own portfolio
risk scores.

---

## 7. Risk Analysis fields

| Field | Derivation |
|---|---|
| Largest losing / gaining position | The position whose shocked `unrealizedPnl − base unrealizedPnl` (its own P&L impact) is most negative / most positive. |
| Positions breaching threshold | Any position whose shocked loss, as a % of account value, exceeds the user's own `settings.maxRiskPerTrade` — the same setting `execution.ts`'s own `validatePreTrade` enforces at trade-open time, reused here as an informational proxy for "this position is now underwater beyond what a single new trade would be allowed to risk." Purely informational — never a live enforcement action. |
| Concentration changes | Per-symbol `pctOfAccount` (shocked mark-based) before vs. after, for every symbol present in either state. |
| Portfolio drawdown | `max(0, −portfolioValueImpact ÷ base.portfolioValue × 100)` — honestly `0` for a net-positive scenario, a positive percentage only for a net-negative one. |

A single-lot, defined-risk position's own hard-capped `maxLoss` is
typically a few hundred dollars — well under a 1%-of-$125,000 default
`maxRiskPerTrade` threshold (~$1,250) — so a genuine breach under
default settings requires either a larger position or a tightened
threshold; this is a real, disclosed structural property of defined-risk
strategies, confirmed by this sprint's own test suite deliberately
tightening a test user's `maxRiskPerTrade` to reliably exercise the
breach path (see `lib/portfolioStressTest.test.ts`).

---

## 8. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts` — zero-line diff.
- `computeTradeGreeks()` itself — unmodified, called as-is by every other
  existing feature; this sprint's own `computeShockedGreeks()` is a
  parallel, shock-parameterized sibling, never a replacement.
- `lib/positionSizing.ts`'s `buildSnapshot()`/`currentOpenTrades()`/
  `TradeRow` — unmodified, reused as-is (already exported in the prior
  Trade Adjustment sprint).
- No database migration.
- No broker write operations of any kind.
- No scenario, shock, or comparison is ever persisted — every result is
  computed fresh, in-memory, per request.

---

## 9. Real Alpaca credential verification remains deferred

Like every other sprint in this integration, `credentialsConfigured`/
`brokerConnected`/`lastBrokerCheckAt` are always honestly computed and
returned (informational only), but no live broker call is made by this
sprint's own code path — figures come entirely from local trade data and
`optionsMath.ts`'s own deterministic SIMULATED pricing engine. Real
Alpaca Paper account credentials remain the single blocking item for
verifying live-provider behavior anywhere in this integration.

---

## 10. Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4.11 — the higher-level
  architectural summary of this same sprint.
- `docs/Position-Sizing.md` — the prior sprint whose `buildSnapshot()`/
  `currentOpenTrades()`/`TradeRow` exports this sprint directly reuses.
- `docs/Trade-Adjustment.md` — the prior sprint whose Before/After
  comparison and warnings-list conventions this sprint's own risk
  analysis follows.
- `docs/Operations-Handbook.md` — day-to-day operational usage.
- CLAUDE.md rule 1 — `execution.ts` is never modified without explicit,
  specific approval; this sprint's own composition layer reuses
  `optionsMath.ts`'s pricing primitives, never duplicates or bypasses
  execution logic.

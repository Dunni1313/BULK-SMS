# Correlation & Concentration Risk Overlay

This document covers the Correlation & Concentration Risk Overlay as it
exists after the **Correlation & Concentration Risk Overlay** sprint. It
is a companion to `docs/Alpaca-Paper-Trading-Architecture.md` §4.13,
which covers the same sprint at a higher level alongside the rest of the
Alpaca integration — read that document for the broader architectural
context.

---

## 1. What this is

A dedicated, read-only overlay, `/concentration-risk`, that shows the
current open portfolio's own concentration and correlation risk:
net Greeks and directional exposure at the portfolio level, concentration
broken down across 7 dimensions (symbol, underlying, sector, strategy,
expiration, asset class, directional bias), categorical correlation
clustering (positions that genuinely share a trait, never a computed
statistical correlation), and read-only, informational risk guidance.

**Every figure reuses this platform's existing portfolio snapshot and
Greeks calculations unchanged. No execution logic was modified. No
broker writes occur. No orders are submitted. Risk guidance is
informational only.** Every one of these is true by construction, not
just by convention, and is proven by this sprint's own test suite (see
§8).

---

## 2. Investigation finding that shaped this sprint's whole design

Before writing any code, this sprint investigated what data this engine
actually has available for concentration/correlation analysis. Two real
gaps were found and, per this project's own "never fabricate, always
disclose" discipline, neither was papered over:

- **No beta figure exists anywhere in this engine's own data model.**
  `optionsMath.ts`'s own SIMULATED `UNIVERSE` carries no beta field for
  any of its 10 symbols, and no live market-data feed is wired into this
  engine (Engine 3's own live-data provider remains explicitly deferred
  per CLAUDE.md's Phase 3 completion note). Net portfolio beta is
  therefore **always** reported `null`, with an explicit
  `netBetaUnavailableReason` string — never approximated, never silently
  omitted.
- **No sector/industry classification exists in `optionsMath.ts` for its
  own `UNIVERSE`.** This is not the same situation as beta — Engine 1's
  own `lib/industryPeers.ts` (Phase 2 Sprint 20, cross-referenced in
  CLAUDE.md) already established the precedent that a small, hand-curated
  table of **real, publicly-known** sector classifications for a fixed,
  known symbol set is categorical metadata, not fabricated financial
  data. This sprint reuses that exact precedent — a new
  `KNOWN_SECTOR_MAP` in `lib/portfolioConcentration.ts` assigns the
  **same coarse sector values** Engine 1's own table already assigns to
  the same real companies (e.g. NVDA/AAPL/MSFT → `"Technology"`,
  GOOGL/META → `"Communication Services"`, AMZN/TSLA → `"Consumer
  Discretionary"`), plus dedicated ETF-fund labels for SPY/QQQ/IWM. Any
  symbol outside this fixed table (including any symbol outside
  `optionsMath.ts`'s own `UNIVERSE`, which this platform's own
  order-preview flow already prevents from ever becoming a real open
  position) honestly reports sector `"Unclassified"`, never a guessed
  classification. The response's own `sectorDataSource` field
  (`"KNOWN_UNIVERSE_METADATA"`) discloses this to every caller.

**Correlation is deliberately never a statistical model.** Per this
sprint's own explicit "do not invent new correlation models or external
market correlations" instruction, `buildClusters()` only groups
positions that already, genuinely share a known trait (same underlying,
same sector, same strategy, same expiration date, or the same
delta-sign directional bias) — filtered to groups of 2 or more positions
— never a computed correlation coefficient of any kind.

---

## 3. Backend: `GET /portfolio/concentration`

New files this sprint, both purely additive:
- `artifacts/api-server/src/lib/portfolioConcentration.ts` —
  `buildPortfolioConcentrationOverlay(userId)`.
- `artifacts/api-server/src/routes/portfolioConcentration.ts` — the one
  new route.

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and `eventRisk.ts` are **not modified** by this
sprint — confirmed via `git diff --stat` at every checkpoint.

### 3.1 Request

No request body — a plain `GET`, reading the calling user's own current
open portfolio (via `tenantScope.ts`'s established `getScopedUserId()`).

### 3.2 Response shape (abbreviated)

```
{
  totalPositions, totalPortfolioValue, accountValue,
  netGreeks: { delta, gamma, theta, vega },
  netBeta: null,
  netBetaUnavailableReason: string,
  netDirectionalExposure: {
    longExposureDollars, shortExposureDollars, netExposureDollars, netBiasLabel,
  },
  breakdowns: {
    symbol, underlying, sector, strategy, expiration, assetClass, directionalBias:
      { dimension, buckets: [{ key, label, positionCount, weightPct }], concentrationScore, largestBucket },
  },
  longShort: { longExposureDollars, shortExposureDollars, longPct, shortPct },
  callPut: { callNotional, putNotional, callPct, putPct },
  greeksContributions: [{ tradeId, symbol, strategy, delta, gamma, theta, vega, deltaSharePct }],
  clusters: [{ dimension, key, label, tradeIds, positionCount }],
  summary: {
    largestConcentration, highestDirectionalExposure, highestGreeksContributor,
    mostDiversifiedArea, leastDiversifiedArea,
    concentrationScore, diversificationScore, portfolioHealthLabel,
  },
  riskGuidance: { code, label, advisories: [{ code, label }] },
  accountValue, credentialsConfigured, brokerConnected, lastBrokerCheckAt,
  sectorDataSource: "KNOWN_UNIVERSE_METADATA",
  generatedAt: string,
}
```

**Always returns `200`** — an empty portfolio honestly returns a
zeroed-out result (every breakdown has zero buckets, `concentrationScore:
0`, `largestBucket: null`), never a fabricated 404 or error.

---

## 4. Existing portfolio and Greeks logic — direct reuse, zero new risk logic

This sprint introduces **no new pricing, Greeks, or portfolio-snapshot
math**. Every figure is built directly on top of already-existing,
already-tested functions:

- **`currentOpenTrades(userId)`** (`lib/positionSizing.ts`, established
  since the Trade Adjustment sprint) — the same per-user open-trade query
  every prior sprint in this family reuses unmodified.
- **`buildSnapshot(trades, accountValue)`** (`lib/positionSizing.ts`) —
  supplies `totalRiskDollars`, `longExposureDollars`,
  `shortExposureDollars`, and the pre-aggregated portfolio `greeks`
  object used directly as this sprint's own `netGreeks` field.
- **`computeTradeGreeks(...)`** (`lib/serverState.ts`, already exported
  and already reused by the Portfolio Stress Test sprint) — called once
  per open position, unmodified, to derive each position's own
  delta/gamma/theta/vega for the Greeks Contribution breakdown.
- **`getAccountValue(userId)` / `getSettingsRow(userId)` /
  `getLastBrokerCheckConnected()` / `getLastSuccessfulBrokerCheck()`** —
  the same broker-health/credential-disclosure primitives every prior
  sprint in this family already surfaces.

### 4.1 Concentration weight vs. portfolio weight — a deliberate, disclosed distinction

Earlier sprints in this family (Position Sizing, Portfolio Stress Test,
Event Risk) all express a position's own **"portfolio weight"** as
`maxLoss ÷ accountValue × 100` — a genuine share of the account's own
buying power, appropriate for those sprints' own account-relative
framing.

Concentration analysis needs a **different** denominator: a position's
share of the portfolio's **own total deployed risk**
(`maxLoss ÷ Σ maxLoss across every open position`), not its share of the
whole account. Using the account-relative figure here would understate
concentration for any account that isn't fully deployed — a single
position representing 100% of a portfolio's own risk could read as a
low, unremarkable percentage of a large account, masking a genuinely
concentrated book. `computePositions()` in
`lib/portfolioConcentration.ts` therefore computes `weightPct` against
`structural.totalRiskDollars` (from the same, already-computed
`buildSnapshot()` result), not `accountValue` — the correct denominator
for Herfindahl-Hirschman-Index-based concentration bucketing (see §5).

---

## 5. Concentration Analysis — the Herfindahl-Hirschman Index

`buildBreakdown()` computes, for every one of the 7 dimensions
(symbol/underlying/sector/strategy/expiration/asset class/directional
bias), a standard **Herfindahl-Hirschman Index (HHI)** —
`Σ (bucket weight fraction)²` across every bucket — mapped to a `0..100`
`concentrationScore` (`round(hhi × 100)`). This is a well-established,
disclosed statistical convention for measuring concentration (a single
100%-weight bucket scores 100; many evenly-split buckets score low),
not a proprietary or invented formula.

- **Underlying** is deliberately identical to **Symbol** for this
  engine — every open position here is a single-underlying options
  strategy (this platform does not currently support any multi-leg,
  multi-underlying structure), so `breakdowns.underlying` and
  `breakdowns.symbol` are the same computed breakdown, exposed under
  both keys for API-contract clarity per this sprint's own request.
- **Asset class** is always `"Equity Option"` for every position —
  genuinely true, not fabricated, since this engine only ever opens
  equity-options strategies — and is deliberately **excluded** from the
  "most/least diversified area" comparison in the summary (§6), since a
  dimension that is always 100% concentrated by construction isn't a
  meaningful diversification signal.
- **Directional bias** buckets each position as `bullish` / `bearish` /
  `neutral` from its own net delta sign, using the same
  `DIRECTIONAL_BIAS_DELTA_THRESHOLD` band already established for
  filtering out true near-zero-delta strategies.

---

## 6. Correlation Overlay — categorical clustering only

`buildClusters()` groups positions sharing an already-known trait across
5 dimensions — underlying, sector, strategy, expiration, and directional
bias — filtering to groups with **2 or more** positions (a single
un-repeated position is never reported as a "cluster"). Each cluster
carries its own `dimension`, the shared `key`/`label`, the full list of
`tradeIds` in the group, and `positionCount`. This is the entirety of
the "correlation" surface this sprint implements — no statistical
correlation coefficient, no external market-correlation data source, and
no new correlation model of any kind, per this sprint's own explicit
instruction.

---

## 7. Portfolio Summary and Risk Guidance

- **Largest concentration** — the `symbol` breakdown's own
  `largestBucket`.
- **Highest directional exposure** — whichever of long/short structural
  exposure (from the reused `buildSnapshot()` result) is larger.
- **Highest Greeks contributor** — the position with the largest
  `|delta|` share, from `buildGreeksContributions()`, sorted descending.
- **Most/least diversified area** — the dimension (among symbol, sector,
  strategy, expiration, directional bias — asset class excluded, §5)
  with the lowest/highest `concentrationScore`, respectively.
- **Concentration score / diversification score** — `concentrationScore`
  is the `symbol` breakdown's own HHI-derived score;
  `diversificationScore` is simply `100 − concentrationScore`.
- **Portfolio health indicator** — a plain 4-tier label derived from the
  same concentration score (`CONCENTRATION_WELL_DIVERSIFIED_MAX = 30`,
  `CONCENTRATION_MODERATE_MAX = 55`, `CONCENTRATION_HIGH_MAX = 75`).

**Risk Guidance** is a pure, exhaustive label mapping — zero execution
logic:

| Symbol concentration score | Code | Label |
|---|---|---|
| `<= 30` | `well_diversified` | Well Diversified |
| `<= 55` | `moderate_concentration` | Moderate Concentration |
| `<= 75` | `high_concentration` | High Concentration |
| `> 75` | `review_exposure` | Review Exposure |

An additional, independent advisory (`monitor_sector_concentration` /
"Monitor Sector Concentration") is appended whenever the **sector**
breakdown's own concentration score reaches
`SECTOR_CONCENTRATION_ADVISORY_THRESHOLD` (60), regardless of the
primary symbol-based guidance code — a portfolio can be well
symbol-diversified (many different tickers) while still being
sector-concentrated (all in the same real-world industry), and this
advisory exists specifically to surface that case.

**These labels are purely informational.** No adjustment, order, or
execution action is ever triggered by this page — there is no submit
action anywhere on it, and no execution recommendation of any kind is
ever generated.

---

## 8. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts`, `eventRisk.ts` — zero-line diff.
- `currentOpenTrades()` / `buildSnapshot()` / `computeTradeGreeks()` —
  unmodified, called as-is.
- The existing event-risk overlay (`lib/portfolioEventRisk.ts`) and its
  own reused `getEventRiskForSymbol()` engine — untouched, unrelated to
  this sprint.
- No database migration.
- No broker write operations of any kind.
- No portfolio mutation of any kind — this route only reads.

---

## 9. Real Alpaca credential verification remains deferred

This sprint, like every prior sprint in this family, is fully functional
without real Alpaca credentials — `credentialsConfigured` and
`brokerConnected` are honestly disclosed booleans (never fabricated), and
every figure is computed from this platform's own SIMULATED position
data regardless of their value. Live-credential verification against a
real Alpaca Paper account remains explicitly deferred, consistent with
every prior Alpaca-integration sprint's own disclosed scope.

---

## 10. Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4.13 — the higher-level
  architectural summary of this same sprint.
- `docs/Portfolio-Event-Risk.md` / `docs/Trade-Adjustment.md` /
  `docs/Position-Sizing.md` — the prior sprints whose `TradeRow` /
  `currentOpenTrades()` / `buildSnapshot()` shared shapes this sprint
  reuses unmodified.
- `docs/Portfolio-Stress-Testing.md` — the prior sprint whose
  `computeTradeGreeks()` reuse pattern this sprint follows.
- CLAUDE.md — Engine 1's `lib/industryPeers.ts` (Phase 2 Sprint 20) is
  the direct precedent this sprint's own `KNOWN_SECTOR_MAP` follows for
  "categorical metadata, not fabricated financial data."
- `docs/Operations-Handbook.md` — day-to-day operational usage.
- CLAUDE.md rule 1 — `execution.ts` is never modified without explicit,
  specific approval; this sprint's own composition layer reuses
  `positionSizing.ts`/`serverState.ts`'s pricing/risk primitives, never
  duplicates or bypasses them.

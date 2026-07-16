# Portfolio Risk Dashboard & Health Score

This document covers the Portfolio Risk Dashboard & Health Score as it
exists after the **Portfolio Risk Dashboard & Health Score** sprint. It
is a companion to `docs/Alpaca-Paper-Trading-Architecture.md` §4.14,
which covers the same sprint at a higher level alongside the rest of the
Alpaca integration — read that document for the broader architectural
context.

---

## 1. What this is

A single, dedicated, read-only executive dashboard, `/portfolio-dashboard`,
that unifies every prior Paper Trading portfolio overlay this codebase
already has — Position Sizing, the Portfolio Stress Test, the Earnings &
Event Risk Portfolio Overlay, and the Correlation & Concentration Risk
Overlay — into one Portfolio Health Score, an executive summary, risk
panels, widget cards linking to each overlay's own detailed page, and a
set of visualisations.

**Every figure reuses one of the 3 already-existing overlays (or
`positionSizing.ts`'s own `currentOpenTrades()`/`buildSnapshot()`)
unchanged. No execution logic was modified. No broker writes occur. No
orders are submitted. This dashboard is entirely read-only.** Every one
of these is true by construction, not just by convention, and is proven
by this sprint's own test suite (see §7).

---

## 2. Portfolio Health Score — design discipline

Per this sprint's own explicit **"do not invent statistical models —
every component must be derived from existing calculations"**
instruction, every one of the 8 requested Health Score factors is a
direct 0-100 health projection of a figure **already computed** by one
of the 3 reused overlays (or by `buildSnapshot()`). None of them call a
new pricing/provider function, and none of them compute a new
statistical technique (a covariance matrix, a fabricated VaR figure, an
ML score) — the exact category of thing the Concentration sprint's own
"do not invent new correlation models" instruction already ruled out for
a different module.

| Factor | Score derivation | Source |
|---|---|---|
| Concentration | `100 - concentrationScore` (symbol-level HHI) | `portfolioConcentration.ts` — `breakdowns.symbol.concentrationScore` |
| Diversification | `100 - sectorConcentrationScore` (sector-level HHI, deliberately a **different dimension** than the Concentration factor above, to avoid double-counting the same number) | `portfolioConcentration.ts` — `breakdowns.sector.concentrationScore` |
| Event Risk | A disclosed label→score mapping of the portfolio's highest classified `EventRiskLevel` (`none`→100, `low`→75, `medium`→50, `high`→20) | `portfolioEventRisk.ts` — `summary.highestRiskPosition.riskLevel` |
| Net Greeks Exposure | `100 - deltaSharePct` of the single largest Greeks contributor | `portfolioConcentration.ts` — `greeksContributions[0].deltaSharePct` |
| Directional Exposure | `100 - |longPct - shortPct|` — a simple balance measure over 2 numbers that already sum to 100 | `portfolioConcentration.ts` — `longShort.longPct` / `shortPct` |
| Position Sizing Quality | Direct, **unmodified reuse** of the Stress Test's own already-computed base-case risk score — zero new formula | `portfolioStressTest.ts` — `riskScoreBefore` |
| Number of Positions | A simple linear ramp against one named, disclosed threshold (`DASHBOARD_HEALTHY_POSITION_COUNT = 5`); 0 positions honestly scores 100 (no position-count risk) | `positionSizing.ts` — `currentOpenTrades()` count |
| Expiration Distribution | `100 - expirationConcentrationScore` (expiration-date-level HHI) | `portfolioConcentration.ts` — `breakdowns.expiration.concentrationScore` |

Only **2** small, disclosed, named threshold constants are genuinely new
this sprint (`EVENT_RISK_LEVEL_HEALTH_SCORE`, the label→score table
above, and `DASHBOARD_HEALTHY_POSITION_COUNT = 5`) — the same "state a
reasonable default, disclose it" precedent this whole codebase has
followed since Position Sizing's own
`BUYING_POWER_EXHAUSTION_THRESHOLD_PCT`/`MAX_LEVERAGE_RATIO`.

**Overall Health Score** = the equal-weighted average of all 8 factor
scores, rounded to the nearest integer. **Overall Risk Rating** is a
4-tier banding of that score (`healthy` ≥80, `moderate_risk` ≥60,
`elevated_risk` ≥40, else `high_risk`) — the same 4-tier convention
family the Concentration overlay's own `CONCENTRATION_WELL_DIVERSIFIED_MAX`/
`CONCENTRATION_MODERATE_MAX`/`CONCENTRATION_HIGH_MAX` already established.

An **empty portfolio honestly scores 100 across every factor** (no open
risk of any kind) — this falls out naturally from the underlying HHI/
percentage-of-zero conventions the 3 reused overlays already use for an
empty portfolio, with only 2 factors (Net Greeks Exposure, Number of
Positions) needing an explicit `positions.length === 0 ? 100 : ...`
guard since they don't inherit that guarantee automatically.

---

## 3. Backend: `GET /portfolio/dashboard`

New files this sprint, both purely additive:
- `artifacts/api-server/src/lib/portfolioDashboard.ts` —
  `buildPortfolioDashboard(userId)`.
- `artifacts/api-server/src/routes/portfolioDashboard.ts` — the one new
  route.

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, `eventRisk.ts`, `positionSizing.ts`,
`portfolioStressTest.ts`, `portfolioEventRisk.ts`, and
`portfolioConcentration.ts` are **not modified** by this sprint —
confirmed via `git diff --stat` at every checkpoint. This module only
ever calls into those files' own already-exported, already-tested
functions.

### 3.1 Request

No request body — a plain `GET`, reading the calling user's own current
open portfolio (via `tenantScope.ts`'s established `getScopedUserId()`).

### 3.2 Response shape (abbreviated)

```
{
  portfolioValue, buyingPower, totalRiskDollars, totalRiskPct,
  healthScore, overallRiskRating: { code, label },
  paperTradingMode: true,
  credentialsConfigured, brokerConnected, lastBrokerCheckAt,
  lastPortfolioUpdate, openPositionsCount,

  healthFactors: [{ code, label, score, sourceModule, detail }],

  netGreeks: { delta, gamma, theta, vega },
  largestPosition: { symbol, riskDollars, pctOfAccount } | null,
  largestRiskContributor: { tradeId, symbol, delta, deltaSharePct } | null,
  highestEventRisk: { tradeId, symbol, riskLevel } | null,
  highestConcentration: { dimension, bucket } | null,
  highestDirectionalExposure: { direction, exposureDollars, pct } | null,

  widgets: [{ code, label, headline, detail, linkHref }],

  allocationBySymbol, allocationBySector, allocationByStrategy,
  expirationDistribution: [{ key, label, positionCount, weightPct }],
  eventTimelineSummary: { ... },
  stressTestSummary: [{ label, portfolioValueImpact, riskScoreAfter }],

  guidance: [{ code, label, detail }],
  generatedAt,
}
```

**Always returns `200`** — an empty portfolio honestly returns a
fully-healthy score and zeroed-out figures, never a fabricated 404 or
error.

### 3.3 A real concurrency bug caught and fixed during this sprint's own validation

`getSettingsRow(userId)` (`serverState.ts`, unmodified by this sprint) is
a plain check-then-insert with no upsert safety. Each of the 3 reused
overlays this sprint composes independently calls `getSettingsRow()`
itself — the first draft of `buildPortfolioDashboard()` fired all 3
overlays concurrently via `Promise.all` *and* called `getSettingsRow()`
a 4th time itself, which reliably raced 4 simultaneous `INSERT`s against
the same `settings_user_id_unique` constraint for any brand-new user
with no settings row yet, reproducing on the very first test run.

**Fixed** by resolving `getSettingsRow(userId)` **once, alone, before**
firing the concurrent fan-out — this guarantees the settings row already
exists by the time the 3 sub-overlays' own internal calls run, so every
one of them becomes a safe, non-racy `SELECT` rather than a second
`INSERT`. This is a fix entirely within this sprint's own new
`portfolioDashboard.ts` composition function — `serverState.ts`'s own
`getSettingsRow()` itself was not touched.

---

## 4. Existing overlays reused — zero new risk logic

- **Position Sizing** (`lib/positionSizing.ts`) — `currentOpenTrades()`/
  `buildSnapshot()`, unmodified, supply Total Risk, Largest Position, and
  the `openPositionsCount` figure.
- **Portfolio Stress Test** (`lib/portfolioStressTest.ts`) —
  `buildPortfolioStressTest({}, userId)`, unmodified, supplies Portfolio
  Value, Buying Power, the base-case risk score (reused directly as the
  Position Sizing Quality factor), and the Stress Test Summary
  visualisation (a trimmed pass-through of its own `scenarios` array).
- **Earnings & Event Risk Portfolio Overlay** (`lib/portfolioEventRisk.ts`)
  — `buildPortfolioEventRiskOverlay(userId)`, unmodified, supplies
  Highest Event Risk, the Event Risk health factor, and the Event
  Timeline Summary visualisation (a direct pass-through of its own
  `summary`).
- **Correlation & Concentration Risk Overlay**
  (`lib/portfolioConcentration.ts`) — `buildPortfolioConcentrationOverlay(userId)`,
  unmodified, supplies Net Greeks, Largest Risk Contributor, Highest
  Concentration, Highest Directional Exposure, 4 of the 8 Health Score
  factors, and the Portfolio Allocation / Concentration Snapshot
  visualisations (direct pass-throughs of its own `breakdowns` buckets).

**Guidance also reuses, rather than re-derives, existing thresholds and
codes**: "Elevated Concentration" reuses the Concentration overlay's own
`riskGuidance.code`; "Diversification Recommended" reuses its own
already-exported `SECTOR_CONCENTRATION_ADVISORY_THRESHOLD`; "Review Large
Positions" reuses its own already-exported `CONCENTRATION_HIGH_MAX`;
"Elevated Event Risk" reuses the Event Risk overlay's own `highRiskCount`.
Only the primary Healthy/Moderate/Elevated/High rating label is
genuinely new banding logic, intrinsic to the Health Score itself.

---

## 5. Dashboard Widgets

7 widget cards, each a thin summary reusing already-computed figures,
each with a `linkHref` to its own existing detailed page — the frontend
renders each as a clickable card (`wouter`'s `Link`), never
re-implementing that page's own logic:

| Widget | Links to |
|---|---|
| Position Sizing | `/position-sizing` |
| Stress Test | `/stress-test` |
| Event Risk | `/event-risk` |
| Concentration | `/concentration-risk` |
| Diversification | `/concentration-risk` |
| Greeks | `/concentration-risk` |
| Broker Health | `/settings` |

---

## 6. What this sprint did not change

- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts`, `eventRisk.ts` — zero-line diff.
- `positionSizing.ts`, `portfolioStressTest.ts`, `portfolioEventRisk.ts`,
  `portfolioConcentration.ts` — zero-line diff; every figure this
  dashboard shows is a direct, unmodified reuse of these files' own
  already-exported functions.
- No database migration.
- No broker write operations of any kind.
- No portfolio mutation of any kind — this route only reads.

---

## 7. Test coverage

`lib/portfolioDashboard.test.ts` (against isolated, fresh test users, the
same pattern every prior overlay test file in this family already
established): empty portfolio (fully-healthy score, no fabricated
highlights), single position (fully-concentrated factor scoring),
balanced portfolio (multiple evenly-weighted symbols), high concentration
(a dominant single symbol, guidance surfacing Elevated Concentration and
Review Large Positions), high event risk (a real, empirically-verified
AAPL-at-45-DTE fixture matching `portfolioEventRisk.test.ts`'s own
established high-risk fixture, guidance surfacing Elevated Event Risk),
high Greeks exposure (one dominant position's delta share), missing
credentials, dashboard calculations (the Health Score's own equal-
weighted-average formula, the overall rating's own banding, the exact 7
widgets and their `linkHref`s, visualisation pass-through proofs),
determinism, and a never-mutates-the-trades-table proof.

`routes/portfolioDashboard.route.test.ts` — live HTTP shape/wiring
proofs against the shared legacy-owner account, including the
never-a-broker-write-surface proof and the honest credentials/broker
disclosure.

`PortfolioDashboard.test.tsx` — frontend smoke tests covering badges,
loading/error states, the honest empty-portfolio state, the Executive
Summary fields, all 8 Health Score factors with sort/filter interaction,
all 9 Risk Panel fields, all 7 widget links, both allocation charts, the
Event Timeline Summary, the Stress Test Summary, and informational-only
guidance.

---

## 8. Real Alpaca credential verification remains deferred

This sprint, like every prior sprint in this family, is fully functional
without real Alpaca credentials — `credentialsConfigured` and
`brokerConnected` are honestly disclosed booleans (never fabricated), and
every figure is computed from this platform's own SIMULATED position
data regardless of their value. Live-credential verification against a
real Alpaca Paper account remains explicitly deferred, consistent with
every prior Alpaca-integration sprint's own disclosed scope.

---

## 9. Cross-references

- `docs/Alpaca-Paper-Trading-Architecture.md` §4.14 — the higher-level
  architectural summary of this same sprint.
- `docs/Portfolio-Correlation-Concentration.md`, `docs/Portfolio-Event-Risk.md`,
  `docs/Portfolio-Stress-Testing.md`, `docs/Position-Sizing.md` — the 4
  prior sprints whose own already-computed output this dashboard
  composes, unmodified.
- `docs/Operations-Handbook.md` — day-to-day operational usage.
- CLAUDE.md rule 1 — `execution.ts` is never modified without explicit,
  specific approval; this sprint's own composition layer reuses 4 prior
  sprints' own risk primitives, never duplicates or bypasses them.

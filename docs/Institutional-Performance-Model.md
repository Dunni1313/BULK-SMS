# Institutional Performance Model — Design & Audit Record (Phase 38)

The exact design decisions behind `lib/performanceAttribution.ts`, kept
as a permanent record for future phases, mirroring the role
`docs/Institutional-Risk-Model.md` plays for Phase 37.

## Guiding constraint

The Phase 38 kickoff was explicit: **analytical only.** Do NOT implement
AI predictions, future performance forecasts, trade recommendations,
portfolio optimisation, auto rebalancing, auto execution, alpha
generation, or benchmark prediction. Every design decision below was made
against that constraint first.

## Per-engine reuse sources (confirmed via direct source reads before implementation)

| Engine | Function | Reused for |
|---|---|---|
| Investing | `lib/portfolioConstruction.ts`'s `buildPortfolioAllocation(holdings, provider)` | Resolved market value/price/sector per holding |
| Options | `lib/optionsIncomeAnalytics.ts`'s `buildIncomeOverview()`/`buildStrategyMix()` | Income overview, strategy mix / income attribution |
| Cross-cutting | `lib/tradingBacktest.ts`'s Sharpe-ratio formula (mean/stdDev × √N) | The shape reused for real trade-return-based risk-adjusted performance |

None of these three functions were modified. `lib/performanceAttribution.ts`
imports and calls each unchanged.

## The one deliberate reuse decision NOT taken: `buildPortfolioIntelligence()`

`lib/portfolioIntelligence.ts`'s `buildPortfolioIntelligence()` already
computes an unrealized-P&L "Performance" section per portfolio, and was
the obvious first candidate to reuse for the Investing view. It was
deliberately **not called**: direct inspection found it internally fetches
a full `ValueResearchReport` (Buffett/Graham/DCF/Tom Nash/Investment
Committee scoring) per distinct symbol via `buildValueResearchReport()` —
far more expensive than this phase needs, and its own
`PortfolioHoldingIntelligence` type has no `sector` field, which sector
attribution requires.

Instead, this phase calls the cheaper `buildPortfolioAllocation()`
directly (the same function `buildPortfolioIntelligence()` itself calls
internally, and the same "same formula, cheaper composition" choice
`lib/riskExposureEngine.ts` already made for Phase 37) and re-derives the
**identical** unrealized-P&L formula `portfolioIntelligence.ts`'s own
Performance section already uses:

```
costBasisValue = shares * avgCostBasis
unrealizedPnl  = marketValue - costBasisValue
unrealizedPnlPct = unrealizedPnl / costBasisValue * 100
```

This is a duplicated FORMULA, not a duplicated CALCULATION PATH — the
formula is trivial (3 lines) and reusing it byte-for-byte here rather than
routing through the far heavier function is the same disciplined
trade-off Sprint 21's Competitive Advantage engine made when it
deliberately excluded Industry Comparison from its own eager computation
for the same reason (cost vs. value).

## What's genuinely new vs. reused, at a glance

`lib/performanceAttribution.ts` computes **zero new scoring systems** and
**zero new financial models**. The genuinely new pieces, each disclosed
here in full:

### 1. Trading realized P&L aggregation (new)

No prior module in this codebase aggregated realized P&L from
`trading_positions`' own real, persisted `entryPrice`/`exitPrice`/
`quantity`/`side` columns. The formula:

```
direction    = side === "short" ? -1 : 1
realizedPnl  = (exitPrice - entryPrice) * quantity * direction
```

applied only to `status === "closed"` positions with a non-null
`exitPrice` — an open position never contributes a fabricated realized
figure.

### 2. Win rate / average win / average loss (ported, not new)

`artifacts/ravish-trading/src/lib/tradeAnalytics.ts`'s own
`computePerformanceAnalytics()` already computes this exact formula
client-side over `trades.currentPnl` for the existing, real-data-only
Trade Performance page. This phase **ports the identical formula
server-side**, applied to the same real `currentPnl` field for Options,
and to the newly-computed `realizedPnl` for Trading — the same shape, not
a new one.

### 3. Best-effort Trading strategy attribution (new, explicitly disclosed as best-effort)

`trading_journal_entries.tradingPositionId` has no foreign key constraint
— an established Phase 3 Sprint 39 precedent (a loose, unenforced
reference, mirroring `journal_entries.trade_id`'s own choice). This phase
does a best-effort join: for each closed Trading position, the most
recently created journal entry that references it (via
`tradingPositionId`) supplies its `setupType`; a position with no
matching entry, or an entry with no `setupType`, is honestly bucketed as
`"Unclassified"` rather than silently dropped or guessed — proven by a
dedicated test asserting exactly this fallback for an unlinked position.

### 4. Risk-adjusted performance — Sharpe & Sortino (new formula shape reused, Sortino genuinely new)

**The only Sharpe-ratio formula precedent anywhere in this codebase** is
`lib/tradingBacktest.ts`'s/`lib/optionsBacktest.ts`'s own:

```
mean    = average of a set of individual trade returns (%)
variance = average of (return - mean)^2
stdDev  = sqrt(variance)
sharpe  = stdDev > 0 ? (mean / stdDev) * sqrt(N) : null
```

This phase reuses that **exact shape**, applied to REAL closed
trades/positions instead of backtest output — Trading's own
`realizedPnlPct` per closed position, Options' own `currentPnlPercent`
per closed trade. This is explicitly a **TRADE-RETURN-BASED** measure,
not a time-series measure: no periodic real portfolio-value history
exists anywhere in this codebase (only point-in-time snapshots, and only
for Investing), so a genuine daily/weekly-return Sharpe ratio cannot be
honestly computed for any engine, and none is fabricated here. Every
`riskAdjusted` object carries an explicit `basis` string stating this
plainly.

**Sortino is a genuinely new addition** (no precedent existed anywhere in
this codebase before this phase) — the standard downside-deviation-only
variant of the same shape:

```
downsideDeviation = sqrt(average of (min(0, return))^2)
sortino = downsideDeviation > 0 ? (mean / downsideDeviation) * sqrt(N) : null
```

A standard, disclosed, textbook formula, not a novel invention — deviation
is computed only from returns below zero, against zero (the simplest,
most common Sortino convention absent a separately-configured minimum
acceptable return).

Both ratios honestly report `available: false` with an explicit reason
whenever fewer than 2 closed, decided trades exist (a meaningful standard
deviation needs at least 2 data points) — never a fabricated ratio from
an undersized sample.

**Investing always reports `available: false`.** Holdings are
continuously held, not discrete round-trip trades — there is no realized-
trade-return series to compute either ratio from, and none is
approximated from unrealized price moves (which would conflate a
different, non-comparable kind of return).

### 5. Capital efficiency (new, per-engine, each grounded in real columns)

- **Investing** — `returnOnDeployedCapitalPct` is deliberately identical
  to `totalUnrealizedPnlPct` (the portfolio-level unrealized return), not
  a second, competing formula — Investing genuinely has only one
  applicable "return on capital" concept given its data.
- **Trading** — `returnOnCapitalPct = totalRealizedPnl / sum(entryPrice * quantity for closed positions) * 100`
  — realized P&L relative to the real entry cost basis of the positions
  that actually produced it, a cleaner and more defensible denominator
  than the user's total account value (which reflects buying power, not
  capital actually put at risk in the trades measured).
- **Options** — `returnOnCapitalPct = totalRealizedPnl / sum(maxLoss for closed trades) * 100`
  — realized P&L relative to the real max-loss capital committed, reusing
  the exact `maxLoss` column already used elsewhere in this codebase as
  the standard "capital at risk" figure for a defined-risk options
  strategy.

### 6. Sector/strategy/asset attribution (new, pure grouping — no new scoring)

`attributeByKey()` is a single, shared, pure grouping helper: sums P&L by
key, counts trades per key, and computes each key's `weightPct` as its
share of the TOTAL ABSOLUTE P&L across all keys (so a large loser and a
large winner both register meaningfully, rather than a signed sum
cancelling itself into an artificially small weight). This is a pure
aggregation — sum/group/percentage — never a new financial model.

### 7. Historical Performance Timeline (new, real-timestamp reconstruction)

Mirrors Phase 36's own Options Exposure Timeline pattern exactly: no new
snapshot table, no scheduled job, derived entirely from real, already-
persisted timestamps:

- **Trading** — every closed position's own real `exitDate`, its already-
  computed `realizedPnl` summed per real calendar month.
- **Options** — every closed trade's own real `closeDate`, its
  already-persisted `currentPnl` summed per real calendar month.
- **Investing** — genuinely different and narrower, disclosed explicitly:
  Investing holdings have no realized-P&L history at all (they're
  continuously held), so its own timeline instead shows real, user-saved
  market-value-over-time from `investing_portfolio_snapshots`
  (`totalMarketValue`, written only via an explicit, opt-in "Save
  Snapshot" action elsewhere in the platform — never auto-generated).
  This is a deliberately different KIND of data point (a stock/value
  measure, not a monthly P&L flow) than Trading's/Options' own timeline
  points, tagged with a distinct `source` value
  (`"investing-market-value"` vs. `"trading-realized"`/
  `"options-realized"`) so no caller can mistake one for the other.

This is disclosed here as the phase's most significant genuinely novel
design decision — everything else in `lib/performanceAttribution.ts` is
either direct reuse or a trivial aggregation (sum/group/percentage).

## What was deliberately NOT built

- **No AI-based performance scoring anywhere.** Every figure in this
  phase is deterministic arithmetic over already-persisted real columns,
  never an LLM-derived or ML-derived score.
- **No forecast, prediction, or expected-future-return figure of any
  kind.** Risk-adjusted performance describes dispersion in ALREADY-
  REALIZED returns, never a future expectation — confirmed by a dedicated
  test scanning the live response for forecast-shaped language.
- **No trade recommendation, portfolio optimisation suggestion, or
  rebalancing suggestion of any kind**, anywhere in the response shape or
  the AI Coach's prose — confirmed by dedicated tests.
- **No alpha generation or benchmark comparison of any kind.** This phase
  never compares a return against a market index, a peer group, or any
  other external benchmark — only against the user's own real, historical
  data.
- **No new database table.** This phase is entirely a read layer over
  existing tables (`investing_holdings`, `investing_portfolios`,
  `investing_portfolio_snapshots`, `trading_positions`,
  `trading_journal_entries`, `trades`).

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, and every broker-integration file were not imported,
read, or modified by any file in this phase.

# Performance & Attribution Dashboard — Response Shape & UI Walkthrough

The dashboard behind `/performance-attribution-engine`'s **Performance
Dashboard** tab (`GET /performance-attribution/dashboard`,
`lib/performanceAttribution.ts`). Display only — no recommendation, no
optimisation, no forecast.

## Response shape

```
GET /performance-attribution/dashboard
{
  investing: {
    portfolioCount: number,
    holdingsCount: number,
    totalCostBasisValue: number | null,
    totalMarketValue: number | null,
    totalUnrealizedPnl: number | null,
    totalUnrealizedPnlPct: number | null,
    holdings: PerformanceInvestingHolding[],
    sectorAttribution: PerformanceAttributionEntry[],
    assetAttribution: PerformanceAttributionEntry[],
    riskAdjusted: PerformanceRiskAdjusted,       // always available:false — no realized trade-return series
    capitalEfficiency: { totalDeployed, returnOnDeployedCapitalPct, detail },
    unresolvedSymbols: string[],
    summary: string,
  },
  trading: {
    totalPositions, openPositionsCount, closedPositionsCount,
    winningTrades, losingTrades, winRate, averageWin, averageLoss,
    totalRealizedPnl, largestWinner, largestLoser, averageHoldingDays,
    positions: PerformanceTradingPosition[],
    strategyAttribution: PerformanceAttributionEntry[],  // best-effort Trading Journal join
    assetAttribution: PerformanceAttributionEntry[],
    riskAdjusted: PerformanceRiskAdjusted,               // trade-return-based Sharpe/Sortino
    capitalEfficiency: { capitalCommitted, returnOnCapitalPct, detail },
    summary: string,
  },
  options: {
    openPositionsCount, closedPositionsCount, winningTrades, losingTrades,
    winRate, averageWin, averageLoss, totalRealizedPnl,
    income: OptionsIncomeOverview,                       // reused verbatim
    trades: PerformanceOptionsTrade[],
    strategyAttribution: PerformanceAttributionEntry[],
    assetAttribution: PerformanceAttributionEntry[],
    incomeAttribution: OptionsStrategyMixEntry[],         // reused verbatim (buildStrategyMix())
    riskAdjusted: PerformanceRiskAdjusted,
    capitalEfficiency: { capitalCommitted, returnOnCapitalPct, detail },
    summary: string,
  },
  combined: {
    byEngine: { engine, label, totalPnl, pnlLabel }[],           // never blended into one number
    sectorAttribution: { engine, sector, pnl }[],                // Investing only
    strategyAttribution: { engine, key, label, pnl }[],          // Trading + Options
    assetAttribution: { engine, symbol, pnl }[],                 // all 3 engines, sorted by |pnl|
    capitalEfficiency: { engine, label, returnPct }[],
    riskAdjusted: { engine, available, sharpeRatio, sortinoRatio }[],
  },
  timeline: PerformanceTimelinePoint[],
  generatedAt: string,
}
```

## Performance View selector

The frontend page's own **Performance View** dropdown (Investing /
Trading / Options / Combined, default Combined) is a pure client-side
filter over this one already-fetched response — it never triggers a
second fetch.

### Investing view

Shows the portfolio's real unrealized P&L (`totalUnrealizedPnl`/
`totalUnrealizedPnlPct`), per-holding breakdown, sector attribution, and
capital efficiency (return on deployed cost basis) — all derived from
`lib/portfolioConstruction.ts`'s own already-resolved holdings, reusing
the identical unrealized-P&L formula `lib/portfolioIntelligence.ts`'s own
Performance section already uses.

### Trading view

Shows real realized P&L, win rate, average win/loss, largest winner/
loser, best-effort strategy attribution (via the Trading Journal's own
loose `tradingPositionId` reference), asset attribution, capital
efficiency (return on the entry cost basis of closed positions), and
trade-return-based risk-adjusted performance — all computed directly from
`trading_positions`' own real, persisted columns.

### Options view

Shows real realized P&L (from `trades.currentPnl` on closed trades), win
rate, strategy/asset attribution, income attribution (`buildStrategyMix()`,
reused verbatim), capital efficiency (return on the max-loss capital
committed on closed positions), and trade-return-based risk-adjusted
performance (from `trades.currentPnlPercent`).

### Combined view

The cross-engine view — see `docs/Institutional-Performance-Model.md` for
exactly how each field is derived. Cards, in order:

1. **Return by Engine** — Investing's unrealized P&L, Trading's realized
   P&L, Options' realized P&L, side by side. Never summed, since an
   unrealized figure and two realized figures are genuinely different
   measures.
2. **Sector Attribution** — Investing's own sector breakdown.
3. **Strategy Attribution** — Trading's and Options' own strategy
   breakdowns, tagged by engine, never blended.
4. **Asset Attribution** — every engine's own symbol-level attribution,
   sorted by magnitude of P&L.
5. **Capital Efficiency** — each engine's own real return-on-capital
   figure.
6. **Risk-Adjusted Performance** — each engine's own trade-return-based
   Sharpe/Sortino, or an honest `unavailable` (always the case for
   Investing).
7. **Historical Performance Timeline** — real monthly realized P&L
   (Trading/Options) and real saved Investing market-value snapshots.

## Empty states

Every list-shaped field above is an honest empty array (`[]`), never a
fabricated placeholder, when a user has no data for that engine yet — the
UI shows a plain "no data yet" message in each case rather than blank
space, confirmed by a dedicated frontend test asserting a brand-new user
sees an honest empty Combined view (including an honest empty Historical
Performance Timeline, never fabricated).

## Deep links

The Reporting tab's two links (`/reporting-centre?reportType=performance-summary`,
`/reporting-centre?reportType=performance-attribution-report`) reuse the
Institutional Reporting Centre's own already-established `?reportType=`
deep-link mechanism (Phase 22) — no new deep-link infrastructure was built
for this phase.

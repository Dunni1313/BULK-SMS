# Risk & Exposure Dashboard — Response Shape & UI Walkthrough

The dashboard behind `/risk-exposure-engine`'s **Risk Dashboard** tab
(`GET /risk-exposure/dashboard`, `lib/riskExposureEngine.ts`). Display
only — no recommendation, no optimisation.

## Response shape

```
GET /risk-exposure/dashboard
{
  investing: {
    portfolioCount: number,
    holdingsCount: number,
    risk: ConstructionPortfolioRiskAnalysis,   // reused from lib/investingRisk.ts
    allocationBySymbol: { symbol, marketValue, weightPct }[],
  },
  trading: {
    openPositionsCount: number,
    accountValue: number | null,
    risk: TradingRiskAnalysis,                 // reused from lib/tradingRisk.ts
  },
  options: {
    dashboard: PortfolioDashboardResult,       // reused, full, unmodified
    portfolioManagement: OptionsPortfolioManagementView, // reused, full, unmodified
  },
  combined: {
    capitalAllocation: { engine, label, value }[],
    buyingPowerOverview: { engine, label, value }[],
    sectorConcentration: { engine, sector, weightPct }[],
    strategyConcentration: { key, label, positionCount, weightPct }[],
    assetAllocation: {
      investingHoldingsCount, investingPortfolioCount,
      tradingOpenPositionsCount, optionsOpenPositionsCount,
    },
    greeksSummary: PortfolioGreeksSnapshot,    // reused, unmodified
    correlationOverview: {
      overlaps: { symbol, engines }[],
      overlapSymbolCount: number,
      note: string,
    },
    concentrationTimeline: { date, source, detail, value }[],
  },
  generatedAt: string,
}
```

## Risk View selector

The frontend page's own **Risk View** dropdown (Investing / Trading /
Options / Combined, default Combined) is a pure client-side filter over
this one already-fetched response — it never triggers a second fetch.

### Investing view

Shows `investing.risk.overall` (score/label/detail, reused verbatim from
`computePortfolioRiskFromAllocation()`) and `investing.allocationBySymbol`
— every symbol held across **all** of the user's own portfolios combined,
with real market value and weight.

### Trading view

Shows `trading.risk.overall` plus the 3 named sub-scores' own detail
strings (`positionSizing`, `stopDiscipline`, `portfolioBudget`) — all
reused verbatim from `buildTradingRiskAnalysis()`.

### Options view

Shows `options.dashboard.overallRiskRating`, `healthScore`, `buyingPower`,
and `netGreeks` — all reused verbatim from the existing Portfolio Risk
Dashboard.

### Combined view

The cross-engine view — see `docs/Institutional-Risk-Model.md` for exactly
how each field is derived. Cards, in order:

1. **Capital Allocation** — Investing market value, Trading account
   value, Options portfolio value, side by side.
2. **Buying Power Overview** — Trading account value, Options buying
   power.
3. **Asset Allocation** — holding/position counts across all 3 engines.
4. **Sector Concentration** — Investing's own sector-exposure breakdown
   plus Options' own sector-allocation breakdown, combined into one list.
5. **Strategy Concentration** — Options' own strategy allocation (see
   `docs/Risk-Exposure-Engine.md`'s "Deliberate scope decision" for why
   Trading strategy concentration isn't included yet).
6. **Greeks Summary** — the Options Engine's own net portfolio Greeks.
7. **Correlation Overview** — the real, disclosed cross-engine symbol
   overlap (never a fabricated correlation coefficient).
8. **Concentration Timeline** — real historical data points from saved
   Investing risk snapshots and the Options Exposure Timeline.

## Empty states

Every list-shaped field above is an honest empty array (`[]`), never a
fabricated placeholder, when a user has no data for that engine yet — the
UI shows a plain "no data yet" message in each case rather than blank
space, confirmed by a dedicated frontend test asserting a brand-new user
sees an honest empty Combined view (including the honest 6-month-trailing
Options Exposure Timeline, which is always present with zero-count months
rather than conditionally hidden).

## Deep links

The Reporting tab's two links (`/reporting-centre?reportType=risk-exposure-summary`,
`/reporting-centre?reportType=portfolio-concentration-report`) reuse the
Institutional Reporting Centre's own already-established `?reportType=`
deep-link mechanism (Phase 22) — no new deep-link infrastructure was
built for this phase.

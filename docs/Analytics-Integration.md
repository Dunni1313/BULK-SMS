# Trading Analytics Engine — Integration Points

Phase 32. This document is the audit-to-integration map: what existing
functionality was found, what was reused as-is, and exactly where the
Trading Analytics Engine was wired into it.

## Audit summary (pre-implementation)

| Existing surface | What was found | Reuse decision |
|---|---|---|
| **Trade Workspace** (`TradeWorkspace.tsx`) | `trading_positions` (real open/closed positions, entry timestamps, stop/target), a Trading AI Coach panel with per-coach outbound links (Phase 29/31) | Counted directly for Overview/Risk/Session Analytics. Added one more outbound link ("Open the Trading Analytics Dashboard") after the existing Strategy Workbench link. |
| **Trade Planning Studio** | `trading_trade_plans` (real, already-computed `accountRiskPct`/`riskRewardRatio`/`positionSize` at plan-creation time, Phase 28) | Counted directly for Risk Analytics — never recomputed. |
| **Market Structure Workbench** | A dedicated deterministic engine (`lib/tradingMarketStructure.ts`, Phase 3) that computes live from a `MarketDataProvider`, never persisted | No history table exists to aggregate. Reused only as a **Structure Coach usage proxy** (real Trading AI Coach view counts) and a **strategy evidence citation count** — never re-derived. |
| **Liquidity & Session Workbench** | Same live-compute, never-persisted shape as Market Structure (`lib/tradingLiquidity.ts`) | Same disclosed proxy approach as Structure. Session Analytics itself reuses the real, persisted `trading_positions.entryDate` classified via `activeSessionsAt()` (`lib/trading/sessionService.ts`, Phase 25/27) — genuinely real, not a proxy. |
| **Trading Journal** | `trading_journal_entries` (real `mood`/`setupType`/`lessonLearned`/`rMultiple` fields, Phase 27) | Counted and bucketed directly for Journal Analytics. |
| **Strategy Framework** (`lib/tradingStrategyFramework.ts`, Phase 30) | `trading_strategies`/`trading_strategy_checklists`, `computeChecklistCompletion()`, `EVIDENCE_SOURCE_TYPES` | `computeChecklistCompletion()` reused directly (zero second formula); evidence tallies reuse the exact `EvidenceSourceType` vocabulary. |
| **Strategy Workbench** (`StrategyWorkbench.tsx`, Phase 31) | An orchestration layer over the Strategy Framework, with its own outbound-link precedent | Added one outbound link ("Open the Trading Analytics Dashboard") below the existing workflow-step list. |
| **Trading AI Coach** (`TradingAICoach.tsx`, Phase 29) | 9 deterministic coaches, each writing a real `learning_progress` row (`itemType: "coach"`, `itemKey: "<coachType>:<scope>"`) on "mark as viewed" | Parsed directly for Coach Analytics — no new tracking mechanism. Added one outbound link to the new dashboard. |
| **Learning Centre** (`learn/LearningCentre.tsx`, `lib/learningProgress.ts`, Phase 21) | `getLearningProgress()`'s own already-computed `LearningProgressSummary`, including `pathCompletion` | Reformatted directly for Learning Analytics. Added a client-side "Weakest Topics" card to the Progress tab (same threshold/sort logic as the backend's own `buildLearningAnalytics()`, computed from data the page already fetches — no new request). Added one overview-tile link to the new dashboard. |
| **Reporting Centre** (`lib/institutionalReporting.ts`, Phase 22) | An established `InstitutionalReportType` union + per-type builder function pattern, already at 11 report types | Added a 12th type, `trading-analytics-summary`, following the exact existing pattern (`REPORT_TYPE_META` entry, a `build*Report()` function reusing the dashboard builder, a route, a frontend hook wire-up). |
| **Navigation / Command Palette** | `nav-items.ts` is the single source of truth both the sidebar nav and the Command Palette read from | Added one entry ("Trading Analytics", `BarChart3` icon); the Command Palette inherited it automatically, with no separate Command Palette code to touch. |
| **Investing Executive Dashboard** (`ExecutiveDashboard.tsx`, Phase 23) | An established "navigation-shortcut card" pattern, already used for the Strategy Workbench (Phase 31) | Added one more shortcut card, mirroring the Strategy Workbench card exactly. |
| **Executive Dashboard design language** | Established Card/Badge/Skeleton/Tabs/testid conventions already used by every Trading Engine page since Phase 23 | The new Trading Analytics Dashboard page reuses these components directly, plus the existing `recharts` `ResponsiveContainer`/`BarChart`/`PieChart` pattern already established (`Performance.tsx`) and the existing heatmap-grid visual pattern (`PortfolioConcentration.tsx`'s `heatColor()`). No new design system, no new chart library. |

**Genuine gaps identified** (nothing pre-existing covered these — new this
phase):

- No aggregation layer of any kind existed over the Trading Engine's own
  persisted data. Every module (positions, plans, journal, strategies,
  checklists, learning progress, coach usage) had its own CRUD routes and
  its own page, but nothing counted or summarized across them.
- No persisted history of Market Structure/Liquidity/Session *analyses*
  exists anywhere — this was discovered during the audit, not assumed,
  and is the reason Structure/Liquidity Analytics are built as a
  disclosed usage proxy rather than a fabricated historical reading.
- No 12th report type existed for cross-module Trading Engine analytics.

## Integration points actually wired

1. **Trade Workspace** (`TradeWorkspace.tsx`) — one new link in the AI
   Trading Coach Panel header, `data-testid="link-open-trading-analytics"`.
2. **Institutional Strategy Workbench** (`StrategyWorkbench.tsx`) — one
   new link below the workflow-step list,
   `data-testid="link-open-trading-analytics"`.
3. **Trading AI Coach** (`TradingAICoach.tsx`) — one new link in the page
   header, `data-testid="link-trading-coach-open-trading-analytics"`.
4. **Learning Centre** (`learn/LearningCentre.tsx`) — one new overview
   tile (`data-testid="link-overview-trading-analytics"`) and one new
   "Weakest Topics" card in the Progress tab
   (`data-testid="card-weakest-topics"`), computed client-side from
   already-fetched data.
5. **Reporting Centre** (`ReportingCentre.tsx`) — `ReportType` union,
   `REPORT_TYPE_VALUES` array, a new `tasRes` query hook
   (`useGetTradingAnalyticsSummaryReport`), and its entry in the
   `activeResult` dispatch — the report type itself already appears in
   the report-type `<Select>` because that list is populated dynamically
   from the backend's `GET /reporting/types` endpoint.
6. **Investing Executive Dashboard** (`ExecutiveDashboard.tsx`) — one new
   navigation-shortcut card, `data-testid="panel-trading-analytics-shortcut"`.
7. **Navigation** (`nav-items.ts`) — one new entry ("Trading Analytics",
   `BarChart3` icon, `/trading-analytics`), positioned directly after
   Strategy Workbench.
8. **Command Palette** — inherits the new nav entry automatically; no
   separate integration code exists to modify.
9. **Routing** (`App.tsx`) — one new lazy-loaded route,
   `/trading-analytics` → `TradingAnalyticsDashboard.tsx`.
10. **Backend routing** (`routes/index.ts`) — one new router mounted,
    `tradingAnalyticsRouter`.
11. **Reporting backend** (`routes/institutionalReporting.ts`) — a new
    `GET /reporting/trading-analytics-summary` route and a new
    `"trading-analytics-summary"` case in the existing POST-generate
    `regenerate()` switch, both calling the exported
    `loadTradingAnalyticsInputs()` from `routes/tradingAnalytics.ts`
    directly (zero duplicated query logic).

## What was deliberately left untouched

- `lib/tradingMarketStructure.ts` / `lib/tradingLiquidity.ts` — read from
  only through the Coach-usage/evidence-citation proxy, never recomputed,
  forked, or given a new persistence layer.
- `lib/tradingRisk.ts` (the live Trading Risk Engine) — never re-run by
  Risk Analytics, which only aggregates already-recorded plan parameters
  and position fields.
- `lib/trading/sessionService.ts`'s `activeSessionsAt()` — reused
  completely unmodified.
- `lib/tradingStrategyFramework.ts`'s `computeChecklistCompletion()` and
  `EVIDENCE_SOURCE_TYPES` — reused completely unmodified.
- `lib/learningProgress.ts`'s `getLearningProgress()` — reused completely
  unmodified.
- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts` — zero-line diff, confirmed via `git diff --stat`
  before and after this phase's implementation.
- The Institutional Investing Engine and Options Income Engine — neither
  was read from, written to, or referenced anywhere in this phase's code.

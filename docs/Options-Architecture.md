# Options Income Engine — Architecture & Audit Record

Phase 35's full repository audit, genuine-gap analysis, and design
decisions, for anyone building on top of this foundation later.

## Audit summary

### SHARED (reused, none modified)

| Component | Reused as |
|---|---|
| Institutional AI Coach framework (`lib/coach.ts`) | `positionGreeks()` for live per-position Greeks; `teachGreek()`/`explainQuote()`/`explainSymbolStrategy()` linked to from the workspace, never reimplemented |
| Learning Centre (`lib/strategyAcademy.ts`) | 8 of 9 Strategy Library templates' construction/idealMarket/assignmentRisk text reused verbatim |
| Reporting Centre (`lib/institutionalReporting.ts`) | Extended with a 14th report type, `options-income-summary`, following the exact `buildXSummaryReport()` pattern every prior report type already established |
| Portfolio components (`lib/portfolioDashboard.ts`) | Buying Power, Portfolio Exposure, and net Greeks reused directly via the existing `GET /portfolio/dashboard` route — zero re-derivation |
| Command Palette / Navigation (`lib/nav-items.ts`, `lib/quick-actions.ts`) | One new nav entry + one new Cross-Engine Quick Action; Command Palette inherits both automatically (Phase 34 precedent) |
| Cross-Engine Workspace | New Workspace Shortcut entry |
| Risk Engine (`lib/positionSizing.ts`) | `currentOpenTrades()`/`TradeRow` reused directly for the open-position query and portfolio-wide totals |

### TRADING (audited, not reused — genuinely different domain)

Trade Workspace, Trade Planning Studio, Strategy Framework, Strategy
Workbench, Trading Analytics, and Trading Journal all belong to Engine 2
(the Institutional Trading Engine — price-action structure, multi-
timeframe trend, liquidity) and operate on a structurally different data
model (`trading_positions`, `trading_journal_entries`) than Engine 3's
`trades` table. None of it applies to options income tracking; nothing was
reused from this group, and nothing in this group was modified.

### OPTIONS (audited exhaustively)

| Module | Finding |
|---|---|
| `execution.ts` | `Strategy` type is `"iron_condor" \| "iron_fly" \| "calendar_spread" \| "earnings"` — only 3 of these have real leg-building math (`buildIronCondor`, `buildIronFly`, `buildCalendar`); `earnings` recommends one of the other three. This is the real, current scope of "strategies this engine actually builds," confirmed against the code rather than assumed. |
| `optionsMath.ts` | Existing Greeks/pricing/payoff math — read, never modified, never duplicated. |
| `trades` table | Already has every column this phase's Position Model needs: `id, userId, symbol, strategy, status, executionMode, legs, openDate, closeDate, expiration, credit, maxProfit, maxLoss, currentPnl, currentPnlPercent, pop, ev, theta, ravishScore, entryIv, exitReason, notes, scannerResultId, alpacaOrderId`. No migration needed. |
| `lib/thetaIncome.ts` | Already an exported, generic, real-data-agnostic aggregator (`computeThetaIncome()`) producing daily/weekly/monthly/annualized theta plus by-symbol/by-strategy breakdowns — reused directly, fed with **live** per-position theta via `positionGreeks()`, never the stale entry-time `trades.theta` column. |
| Covered Call / Cash Secured Put / Wheel Strategy | Content-only in `strategyAcademy.ts` — no real leg-building engine exists for these today. Honestly labeled `builtByThisEngine: false` in the Strategy Library rather than silently implying otherwise. |

## Genuine gaps identified

1. **No endpoint existed anywhere to edit a trade's `notes` field.**
   `routes/trades.ts` only has GET/POST/DELETE. A new, narrowly-scoped
   `PATCH /options-income/positions/:id/notes` was added — touches only
   the `notes` column, never status/legs/pricing/execution.
2. **`lib/performanceAnalytics.ts` generates synthetic demo data, not real
   trade history.** Its `computeAnalytics()` calls `generateTradeHistory()`
   with a fixed seed (`"ravish-perf-v1"`) — a deterministic but entirely
   fabricated trade series, used elsewhere for Performance Analytics demo
   purposes. This was deliberately **not** reused for Income Overview,
   since doing so would have shown fabricated numbers as if they were the
   user's own real positions.
3. **No dedicated Options Income Summary report type existed** — the
   Reporting Centre's 13 report types covered every other engine but not
   this one. Added as report type 14.

## Existing components reused (backend)

- `lib/positionSizing.ts` — `currentOpenTrades(userId)`, `TradeRow` type.
- `lib/coach.ts` — `positionGreeks(symbol, legs)`.
- `lib/thetaIncome.ts` — `computeThetaIncome(positions)`, `ThetaPosition`
  type.
- `lib/strategyAcademy.ts` — `getStrategyAcademyEntry()`,
  `allStrategyAcademyEntries()`.
- `lib/tenantScope.ts` — `getScopedUserId(req)`, the same real-session /
  legacy-owner-fallback resolution every other route already uses.

## Position Model design decisions

- **Collateral reuses `trades.maxLoss` directly, with zero new math.** For
  every strategy this engine's own `execution.ts` actually builds
  (iron_condor/iron_fly/calendar_spread), `maxLoss` already IS the real
  capital-at-risk figure computed by the protected `optionsMath.ts` at
  entry — re-deriving it would risk drifting from the source of truth.
- **Lifecycle is derived, not stored** — a pure function over
  `status`/`exitReason`, so it can never fall out of sync with the
  columns it reads, and it costs zero schema change.
- **Live vs. stale theta.** `trades.theta` is a snapshot captured at entry
  time. Every dashboard/report figure instead computes theta live via
  `positionGreeks()` at read time, so Monthly Premium reflects the
  position's *current* Greeks, not its entry-day Greeks.

## New files

Backend:
- `lib/optionsIncomeAnalytics.ts` — pure aggregation functions (lifecycle
  classification, position-view mapping, income overview, strategy mix,
  upcoming expirations, dashboard composition). Zero DB access.
- `lib/optionsStrategyLibrary.ts` — the static 9-strategy metadata
  catalog.
- `routes/optionsIncome.ts` — 4 routes (`GET /options-income/dashboard`,
  `GET /options-income/positions`, `PATCH /options-income/positions/:id/notes`,
  `GET /options-income/strategy-library`), plus the exported
  `loadOptionsIncomeSummaryInputs()` helper the Reporting Centre reuses.

Frontend:
- `pages/OptionsIncomeWorkspace.tsx` — the 7-tab workspace (see
  `docs/Options-Workspace.md`).

Modified (additive only):
- `lib/institutionalReporting.ts` — new `options-income-summary` report
  type + `buildOptionsIncomeSummaryReport()`.
- `routes/institutionalReporting.ts` — new route + case-switch entry.
- `lib/api-spec/openapi.yaml` — 9 new schemas, 5 new paths.
- `lib/nav-items.ts`, `lib/quick-actions.ts` — one new entry each.
- `pages/ReportingCentre.tsx`, `pages/ExecutiveDashboard.tsx`,
  `pages/ExecutiveIntelligence.tsx`, `pages/CrossEngineWorkspace.tsx`,
  `pages/learn/LearningCentre.tsx` — one new hook mount / link / shortcut
  each, mirroring each file's own already-established pattern for a new
  report type or a new cross-engine surface.

## Protected areas — confirmed unchanged

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts` all show **zero-line diff** for this phase, confirmed
via `git diff --stat`. No broker integration code was touched. No
existing options mathematics, risk mathematics, or automated execution
logic was modified, extended, or duplicated.

See `docs/Options-Income-Engine.md` for the product-level overview and
`docs/Options-Workspace.md` for the UI walkthrough.

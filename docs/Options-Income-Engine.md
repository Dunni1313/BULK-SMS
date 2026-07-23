# Institutional Options Income Engine (Foundation)

Phase 35 — the institutional foundation for the Options Income Engine.
This phase builds a **presentation and tracking layer** over the existing,
mature, protected DK Option Engine (Engine 3) — it does not build new
trading logic, and it does not touch execution.

**This is a foundation phase, not an execution or automation phase.**
Nothing here implements or evaluates live brokerage execution, auto
trading, auto adjustments, AI predictions, direction forecasting, position
recommendations, trade alerts, or market timing. Every figure on this
engine's own new dashboard is a direct read, count, tally, or simple
aggregate of already-persisted `trades` rows or an already-computed value
from an existing, tested function (`positionGreeks()`, `computeThetaIncome()`,
`currentOpenTrades()`).

## Where to find it

`/options-income-workspace`, linked from the sidebar navigation, the
Command Palette (inherits the nav entry automatically), the Cross-Engine
Quick Actions list, the Investing Executive Dashboard, the Executive
Intelligence Hub, the Cross-Engine Workspace's own Workspace Shortcuts, the
Institutional Reporting Centre (a 14th report type), and the Learning
Centre overview.

## What it is

An **Institutional Options Income Workspace** with 7 tabs:

- **Dashboard** — Income Overview (open/closed position counts, capital
  allocated, open credit collected, realized premium), Monthly Premium (a
  daily/weekly/monthly/annualized theta projection from live position
  Greeks — a theta projection, never a P/L forecast), and Strategy Mix
  (open positions tallied by strategy).
- **Positions** — the deterministic Position Model: Underlying, Strategy,
  Expiration, Premium, Collateral, live Greeks, Status, Lifecycle, and
  Notes, filterable by open/closed/all. Notes are the one genuine write
  surface this phase adds — editable inline, saved via
  `PATCH /options-income/positions/:id/notes`, scoped to the notes field
  only.
- **Strategy Library** — the 9 requested strategy templates (Covered Call,
  Cash Secured Put, Wheel, Iron Condor, Iron Fly, Calendar, Diagonal,
  Vertical Credit, Vertical Debit) as pure metadata — legs, income type,
  collateral type, ideal market, assignment risk. Never a generated trade.
- **Income Calendar** — open positions grouped by their own real
  expiration date, soonest first, with real days-to-expiry.
- **Greeks Overview** — per-position live Greeks (delta/gamma/theta/vega)
  plus the portfolio's own net Greeks, reused directly from the existing
  Portfolio Risk Dashboard.
- **Risk & Exposure** — Buying Power and Portfolio Exposure (allocation by
  symbol), reused directly from the existing Portfolio Risk Dashboard —
  never recomputed here — with links out to the full Portfolio Dashboard,
  Concentration Risk, and Stress Test pages for deeper analysis.
- **Reporting** — the Options Income Summary report (see below), with a
  link to the full Institutional Reporting Centre.

## Position Model

Every field on a position is a direct read from the already-persisted
`trades` table, or an already-computed value from an existing function —
never fabricated:

| Field | Source |
|---|---|
| Underlying | `trades.symbol` |
| Strategy | `trades.strategy`, labeled via the Strategy Library |
| Expiration | `trades.expiration` |
| Premium | `trades.credit` |
| Collateral | `trades.maxLoss` — for every strategy this engine actually builds (iron_condor/iron_fly/calendar_spread), `maxLoss` already IS the real capital-at-risk figure computed by `optionsMath.ts` at entry |
| Buying Power | reused from the existing Portfolio Risk Dashboard (`GET /portfolio/dashboard`) |
| Greeks | `positionGreeks(symbol, legs)` — `lib/coach.ts`, unmodified |
| Status | `trades.status` |
| Lifecycle | deterministically derived from `trades.status`/`trades.exitReason` (see below) — never a prediction |
| Notes | `trades.notes` — the one field this phase adds a write route for |

### Position Lifecycle classification

Derived purely from already-persisted columns:

- `open`/`pending` → **open**
- `closed` + `exitReason` contains "expir" → **closed_expired**
- `closed` + `exitReason` contains "assign" → **closed_assigned**
- `closed` + `exitReason` contains "roll"/"convert" → **closed_rolled**
- `closed`, any other/no `exitReason` → **closed_manual**
- `cancelled`/`rejected` → passed through unchanged
- anything else → honestly reported **unknown**, never guessed

## Strategy Library

Treated as reusable templates — metadata only, never a generated trade.
9 supported strategies: Covered Call, Cash Secured Put, Wheel, Iron
Condor, Iron Fly, Calendar, Diagonal, Vertical Credit, Vertical Debit.
8 of the 9 reuse `lib/strategyAcademy.ts`'s already-authored institutional
content verbatim (construction, ideal market, assignment risk); only
Iron Condor, Iron Fly, and Calendar are actually built by this engine's
existing `execution.ts` — the other 6 are honestly labeled
`builtByThisEngine: false`.

## Income Reporting

The Institutional Reporting Centre gained a 14th report type, **Options
Income Summary**, reusing this engine's own `buildOptionsIncomeDashboard()`
exactly (the same function `GET /options-income/dashboard` calls) and
reformatting it into the generic `ReportSection` shape every other report
type already uses. Zero new aggregation logic.

## What it deliberately does not do

- No live brokerage execution — this engine only reads already-persisted
  `trades` rows, it never places, modifies, or cancels an order.
- No auto trading or auto adjustments — the existing kill-switch-gated
  automation engines (`autoExecution.ts`/`autoAdjustment.ts`) are
  untouched and unrelated to this phase.
- No AI predictions, direction forecasting, position recommendations,
  trade alerts, or market timing of any kind.
- No new options mathematics, Greeks formulas, or payoff calculations —
  every number is read or reused from `optionsMath.ts`/`coach.ts`/
  `thetaIncome.ts`, none of which were modified.

See `docs/Options-Architecture.md` for the full audit and design-decision
record, and `docs/Options-Workspace.md` for a tab-by-tab UI walkthrough.

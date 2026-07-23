# Trade Planning Workflow (Phase 28 — Trade Planning & Risk Studio)

The Trade Planning & Risk Studio (`/trade-planning-studio`) supports one continuous, guided workflow, all within a single page:

```
Select Instrument
      │
      ▼
Review Market Structure
      │
      ▼
Review Liquidity
      │
      ▼
Review Session
      │
      ▼
Create Trade Plan
      │
      ▼
Review Risk
      │
      ▼
Compare Scenarios
      │
      ▼
Record Notes
      │
      ▼
Review Checklist
      │
      ▼
Save Trade Plan
      │
      ▼
Open Trading Journal
```

Every step below names the exact panel and the exact already-shipped data it reads/writes — nothing here is a new signal, probability, or scoring system, only a guided sequence through already-computed facts and a human's own recorded intent.

## 1. Select Instrument

The top-bar symbol search (`studio-symbol-search` / `studio-symbol-search-submit`) sets the Studio's current instrument and deep-links the URL (`/trade-planning-studio?symbol=AAPL`), mirroring `TradeWorkspace.tsx`'s/`MarketStructureWorkbench.tsx`'s/`LiquidityWorkbench.tsx`'s own established deep-linking mechanic.

## 2. Review Market Structure

The **Market Structure** panel (left column) reuses `GET /trading/structure/:symbol` (Sprint 33/40, unmodified) directly — trend, confidence, and the trend-detail sentence — with an outbound link to the full Market Structure Workbench for deeper review.

## 3. Review Liquidity

The **Liquidity** panel (left column) reuses `GET /trading/liquidity/:symbol` (Sprint 35/45, unmodified) directly — liquidity band and the engine's own summary sentence — with an outbound link to the full Liquidity & Session Workbench.

## 4. Review Session

The **Session** panel (left column) reuses `GET /trading/session/:symbol` (Phase 25's Session Service, unmodified) directly — which named sessions are open right now, and today's realized session high/low.

## 5. Create Trade Plan

The **Entry Planning**, **Stop Planning**, and **Target Planning** panels (main column) — 3 distinct Cards per the approved brief, sharing one form — let a user set direction, entry price, account risk %, stop price, and target price, plus a free-text thesis. Submitting calls the exact same `POST /trading/trade-plans` (Phase 25, unmodified) that `TradeWorkspace.tsx`'s own combined form already uses, computing `positionSize`/`riskRewardRatio` via `computeRiskParameters()` — pure arithmetic, never a signal.

## 6. Review Risk

Four panels (main column) — **Position Size Review**, **Risk/Reward Review**, **Capital Allocation Summary**, **Portfolio Exposure Summary** — display the current trade plan's own computed risk fields and the portfolio-wide `GET /trading/risk` analysis's own `positionSizing`/`stopDiscipline`/`portfolioBudget` structure in full, not just the one-sentence summaries `TradeWorkspace.tsx`'s own Risk Panel shows. See `docs/Risk-Studio.md` for the full field-by-field mapping.

## 7. Compare Scenarios

The **Scenario Comparison** panel (main column) lets a user enter 2-5 named candidate entry/stop/target combinations and calls the new, stateless `POST /trading/trade-plans/scenarios/compare` — never persisted, never a recommendation, only an honest side-by-side of each scenario's own `computeRiskParameters()` output plus which one has the highest risk/reward ratio and which has the smallest position size. See `docs/Risk-Studio.md` §2.

## 8. Record Notes

The **Trade Review Notes** panel (right column) is a further UI consumer of Phase 25's own `trading_workspace_notes` table (the same table `TradeWorkspace.tsx`'s/`MarketStructureWorkbench.tsx`'s/`LiquidityWorkbench.tsx`'s own Notes panels already write to) — notes for the current symbol can be added and deleted directly from the Studio, and are visible from any of these pages.

## 9. Review Checklist

The **Trade Checklist** panel (left column) reuses Phase 25's own `buildTradeChecklist()` (`src/lib/trade-checklist.ts`) verbatim, with the exact same inputs `TradeWorkspace.tsx`'s own Checklist panel already passes (structure, multi-timeframe, liquidity, risk, the current trade plan) — zero new scoring logic.

## 10. Save Trade Plan

The **Save Trade Plan** button (header, top-right) submits any pending Entry/Stop/Target planning form and/or pending note text together in one action, mirroring `TradeWorkspace.tsx`'s own "Save Workspace" concept — an honest toast confirms what was actually saved, or that there was nothing pending to save.

## 11. Open Trading Journal

The **Trading Journal** panel (right column) shows how many journal entries exist and links out to the full `/trading-journal` page — the same "link out, don't duplicate" precedent every summary panel in this codebase follows, since Trading Journal already has its own complete CRUD page (Sprint 39/46).

## Supporting, always-visible panels

- **Evidence Panel** (right column) — the concrete supporting facts already computed by each reused engine (Market Structure's trend detail, Liquidity's summary, Risk's overall detail, the current Trade Plan's own thesis, the latest Scenario Comparison's own summary), surfaced verbatim.
- **Planning Timeline** — embedded within the Trade Plan Workspace (main column): every saved Trade Plan for the current symbol, oldest to newest, showing its own creation date, status, thesis, and computed risk figures — a pure chronological rendering of already-persisted rows, zero new computation.
- **AI Trading Coach** (right column) — reuses `POST /trading/coach/ask/stream` (Sprint 47/48) and the exact `streamCoach()` SSE client every other coach panel in this codebase already uses. It explains existing plan/risk outputs only — it never creates signals, entries, stops, targets, or directional recommendations, since the endpoint's own prompt already refuses to invent any of those.

## UI mechanics

- **Resizable panels**: a 3-column `ResizablePanelGroup` (left / main / right), each collapsible independently.
- **Saved layouts**: panel sizes persist across sessions via `autoSaveId="trade-planning-studio-layout"`, the same mechanism `TradeWorkspace.tsx`/`MarketStructureWorkbench.tsx`/`LiquidityWorkbench.tsx` already established for this codebase's meaning of "a saved layout."
- **Keyboard shortcuts**: `/` focuses the symbol search, `Escape` blurs a focused input, `[` / `]` collapse or expand the left/right panels — identical to the established convention.
- **Deep linking**: `/trade-planning-studio?symbol=SYMBOL` restores the selected instrument on load.

## Integration into other surfaces

Per the approved scope, the Studio is reachable from every named surface without re-implementing its own content elsewhere:

- **Institutional Trade Workspace** (`TradeWorkspace.tsx`) — the Risk Panel links out to the full Studio for the same symbol.
- **Market Structure Workbench** (`MarketStructureWorkbench.tsx`) — its own Trade Plan Integration panel links out the same way.
- **Liquidity & Session Workbench** (`LiquidityWorkbench.tsx`) — its own Trade Plan Integration panel links out the same way.
- **Trading Dashboard** (`InstitutionalDashboard.tsx`) — the Portfolio Risk card links out the same way.
- **Trading Journal** (`TradingJournal.tsx`) — a header-level link to the Studio, alongside the existing Phase 26/27 links.
- **Trading AI Coach** — embedded directly as the Studio's own AI Trading Coach panel.
- **Reporting** — a new `"trade-planning-summary"` report type in the Institutional Reporting Centre, reusing Trade Plans + Trading Risk verbatim (see `docs/Trade-Planning-Studio.md` §2).
- **Learning Centre** (`learn/LearningCentre.tsx`) — a "Continue Learning" tile links to the Studio.
- **Navigation** (`src/lib/nav-items.ts`) — a new "Trade Planning & Risk Studio" entry.
- **Command Palette** — auto-indexed via `ALL_NAV_ITEMS`, no separate registration needed.

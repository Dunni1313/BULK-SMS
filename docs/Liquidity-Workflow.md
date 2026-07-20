# Liquidity Workflow (Phase 27 — Liquidity & Session Workbench)

The Liquidity & Session Workbench (`/liquidity-workbench`) supports one continuous, guided workflow, all within a single page:

```
Select Instrument
      │
      ▼
Review Market Structure
      │
      ▼
Review Session
      │
      ▼
Review Liquidity
      │
      ▼
Compare Sessions
      │
      ▼
Review Trade Plan
      │
      ▼
Record Notes
      │
      ▼
Consult AI Trading Coach
      │
      ▼
Save Workspace
```

Every step below names the exact panel and the exact already-shipped data it reads/writes — nothing here is a new signal, probability, or scoring system, only a guided sequence through already-computed facts and a human's own recorded intent.

## 1. Select Instrument

The top-bar symbol search (`workbench-symbol-search` / `workbench-symbol-search-submit`) sets the Workbench's current instrument and deep-links the URL (`/liquidity-workbench?symbol=AAPL`), mirroring `MarketStructureWorkbench.tsx`'s (Phase 26) and `TradeWorkspace.tsx`'s (Phase 25) own established deep-linking mechanic.

## 2. Review Market Structure

The Evidence Panel (right column) surfaces the current instrument's Market Structure trend detail (`GET /trading/structure/:symbol`, Sprint 33/40, unmodified) verbatim — a condensed read; the full Market Structure Workbench (Phase 26) is one click away via the Trading Dashboard/Trading Research's own existing links, and via this page's own header advisory.

## 3. Review Session

The **Session Overview** panel (left column) reuses `GET /trading/session/:symbol` (Phase 25's Session Service, unmodified) directly — which named sessions are open right now, whether they overlap, and today's realized session high/low. The **Active Session Summary** and **Previous Session Summary** panels (left column) read the new `GET /trading/session-windows/:symbol` (this phase) for the currently-open session's own bounded range/duration, and the most-recently-closed session's own range/data-freshness.

## 4. Review Liquidity

The **Liquidity Overview** panel (left column) reuses `GET /trading/liquidity/:symbol` (Sprint 35/45, unmodified) directly — current price, liquidity band, buy/sell pressure direction, and the engine's own summary sentence. The **Buy / Sell Pressure Summary** panel (left column) shows the exact buy%/sell% split from the same engine. The **Liquidity Band Explorer** (main column) shows the current band plus confidence, alongside a **Relative Liquidity** badge — a plain statistical comparison (this phase's `lib/tradingLiquidityTimeline.ts`) of the instrument's own current liquidity score against its own recent average, never a new probability. The **Volume Profile Summary** panel (main column) lists the engine's own already-computed volume-at-price levels, honestly showing "no repeated volume level detected" when none exists.

## 5. Compare Sessions

The **Session High / Low Explorer** (main column) lists all 4 named sessions with their own role (active/previous/upcoming/other), range, and an honest "no candle data" label for Sydney/Tokyo (see `docs/Session-Analysis.md` §3 for why). The **Session Comparison** panel (main column) shows the same 4 sessions side by side in a table — duration, range, candle count — for direct comparison.

## 6. Review Trade Plan

The **Trade Plan Integration** panel (right column) is a further UI consumer of Phase 25's own `trading_trade_plans` table. Its thesis field is pre-filled from the Liquidity Overview's own already-computed summary sentence — an honest starting point the user can edit, never a fabricated recommendation.

## 7. Record Notes

The **Session Notes** panel (right column) is a further UI consumer of Phase 25's own `trading_workspace_notes` table (the same table `TradeWorkspace.tsx`'s and `MarketStructureWorkbench.tsx`'s own Notes panels already write to) — notes for the current symbol can be added and deleted directly from the Workbench, and are visible from any of these pages.

## 8. Consult AI Trading Coach

The **AI Trading Coach** panel (right column) reuses `POST /trading/coach/ask/stream` (Sprint 47/48) and the exact `streamCoach()` SSE client every other coach panel in this codebase already uses. This phase additively extended the coach's own grounding context (`buildTradeCoachContext()` in `routes/tradingCoach.ts`) with a `session` field, so the coach can now also ground an answer in which sessions are active and today's session high/low. It explains existing liquidity/session outputs only — it never creates signals, entries, stops, targets, or directional recommendations, since the endpoint's own prompt already refuses to invent any of those.

## 9. Save Workspace

The **Save Workspace** button (right column, bottom) submits any pending note text and/or a filled-in trade plan form together in one action, mirroring `TradeWorkspace.tsx`'s own "Save Workspace" concept — an honest toast confirms what was actually saved, or that there was nothing pending to save.

## Supporting, always-visible panels

- **Liquidity Timeline** (main column) — a chronological liquidity-band/pressure history, built by replaying the existing Liquidity Engine over rolling candle windows (the same technique `tradingStructureTimeline.ts`'s (Phase 26) own expanding-window replay already established). Each point shows its own liquidity band and buy/sell direction; the panel honestly shows "no liquidity timeline points detected" when the sample is too thin.
- **Evidence Panel** (right column) — the concrete supporting facts already computed by each reused engine (Market Structure's trend detail, Session Windows' summary, Liquidity's summary, Liquidity Timeline's summary), surfaced verbatim.

## UI mechanics

- **Resizable panels**: a 3-column `ResizablePanelGroup` (left / main / right), each collapsible independently.
- **Saved layouts**: panel sizes persist across sessions via `autoSaveId="liquidity-workbench-layout"`, the same mechanism `MarketStructureWorkbench.tsx` (Phase 26) and `TradeWorkspace.tsx` (Phase 25) already established for this codebase's meaning of "a saved layout."
- **Keyboard shortcuts**: `/` focuses the symbol search, `Escape` blurs a focused input, `[` / `]` collapse or expand the left/right panels — identical to `MarketStructureWorkbench.tsx`'s own established shortcuts.
- **Deep linking**: `/liquidity-workbench?symbol=SYMBOL` restores the selected instrument on load.

## Integration into other surfaces

Per the approved scope, the Workbench is reachable from every named surface without re-implementing its own content elsewhere:

- **Institutional Trade Workspace** (`TradeWorkspace.tsx`) — the Liquidity panel links out to the full Workbench for the same symbol.
- **Market Structure Workbench** (`MarketStructureWorkbench.tsx`) — its own Liquidity Context panel links out the same way.
- **Trading Dashboard** (`InstitutionalDashboard.tsx`) — the Liquidity signal card links out the same way.
- **Trading Research** (`TradingResearch.tsx`) — the Liquidity tab card links out the same way.
- **Trading Journal** (`TradingJournal.tsx`) — a header-level link to the Workbench, alongside the existing Phase 26 link to the Market Structure Workbench.
- **Risk Management** — not duplicated; integrated via the Workbench's own outbound link to the Trade Workspace's Risk Panel, the same pattern Phase 26 established.
- **Trading AI Coach** — embedded directly as the Workbench's own AI Trading Coach panel, now grounded on session data too.
- **Learning Centre** (`learn/LearningCentre.tsx`) — a "Continue Learning" tile links to the Workbench.
- **Navigation** (`src/lib/nav-items.ts`) — a new "Liquidity & Session Workbench" entry.
- **Command Palette** — auto-indexed via `ALL_NAV_ITEMS`, no separate registration needed.

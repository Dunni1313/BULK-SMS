# Structure Analysis Workflow (Phase 26 — Market Structure Workbench)

The Market Structure Workbench (`/market-structure-workbench`) supports one continuous, guided workflow, all within a single page:

```
Select Instrument
      │
      ▼
Select Timeframe
      │
      ▼
Review Current Structure
      │
      ▼
Inspect Swing Sequence
      │
      ▼
Compare Timeframes
      │
      ▼
Review Support and Resistance
      │
      ▼
Review Session Context
      │
      ▼
Record Structure Notes
      │
      ▼
Link Findings to a Trade Plan
      │
      ▼
Open Risk or Journal Panels
```

Every step below names the exact panel and the exact already-shipped data it reads/writes — nothing here is a new signal or scoring system, only a guided sequence through already-computed facts and a human's own recorded intent.

## 1. Select Instrument

The top-bar symbol search (`workbench-symbol-search` / `workbench-symbol-search-submit`) sets the Workbench's current instrument and deep-links the URL (`/market-structure-workbench?symbol=AAPL`), mirroring `TradeWorkspace.tsx`'s (Phase 25) and `InstitutionalWorkspace.tsx`'s (Phase 17) own established deep-linking mechanic.

## 2. Select Timeframe

The **Structure Overview** panel (left column) has its own timeframe selector (`1m`/`5m`/`15m`/`1h`/`1D` — the only 5 real timeframes the Market Data Provider supports). Changing it re-requests `GET /trading/structure/:symbol?interval=` for that timeframe, honestly reflecting a real, previously-server-only override this phase exposed to the frontend for the first time.

## 3. Review Current Structure

The **Structure Overview** panel shows the current price, trend classification (uptrend/downtrend/range), and the trend detail sentence — `GET /trading/structure/:symbol` (Sprint 33/40), unmodified. A display-state badge (Bullish/Bearish/Range/Unclear-Insufficient-Data) sits alongside the raw trend, a pure relabeling per `docs/Market-Structure-Workbench.md` §3. The **Range and Consolidation Summary** panel (left column) honestly states whether the instrument is currently ranging, and if so, the nearest known support/resistance context.

## 4. Inspect Swing Sequence

The **Swing High / Swing Low Explorer** (main column) lists every detected swing point from the current structure's own `swingPoints` array, oldest to newest. The **Higher High / Higher Low / Lower High / Lower Low Sequence** panel (main column) reads the new Structure Shift Timeline's own event list, filtered to just the 4 sequence event types — each event names whether a swing extended or reversed the prior same-kind swing, per `lib/tradingStructureTimeline.ts`'s pure comparison logic (zero new scoring).

## 5. Compare Timeframes

The **Multi-Timeframe Structure Matrix** (main column) — see `docs/Multi-Timeframe-Structure.md` for its full design — lets the user check/uncheck any of the 5 real timeframes and shows each one's trend, latest swing, key support/resistance, and freshness side by side, plus an honest structural-alignment-or-conflict readout (never a fabricated dominant trend when timeframes genuinely split).

## 6. Review Support and Resistance

The **Support and Resistance Zone Explorer** (main column) lists every detected zone from the current structure's own `zones` array — kind (support/resistance), price, and touch-count strength — honestly showing "no repeated zone detected" when none exists, never a fabricated level.

## 7. Review Session Context

The **Session Structure Summary** panel (left column) reuses `GET /trading/session/:symbol` (Phase 25's Session Service) unmodified — which named trading sessions (Sydney/Tokyo/London/New York) are open right now, and today's realized session high/low. Descriptive only. The **Liquidity Context** panel (left column) reuses `GET /trading/liquidity/:symbol` (Sprint 35/45) unmodified — liquidity band and buy/sell pressure direction.

## 8. Record Structure Notes

The **Structure Notes** panel (right column) is a second UI consumer of Phase 25's own `trading_workspace_notes` table (the same table `TradeWorkspace.tsx`'s Notes Panel already writes to) — notes for the current symbol can be added and deleted directly from the Workbench, and are visible from either page.

## 9. Link Findings to a Trade Plan

The **Trade Plan Integration** panel (right column) is a second UI consumer of Phase 25's own `trading_trade_plans` table. Its thesis field is pre-filled from the Structure Overview's own already-computed summary sentence — an honest starting point the user can edit, never a fabricated recommendation. `positionSize`/`riskRewardRatio` continue to be derived server-side via Phase 24's own unmodified `computeRiskParameters()`.

## 10. Open Risk or Journal Panels

The Workbench deliberately does not duplicate a Risk panel or a Journal panel — both already exist, fully built, in the Institutional Trade Workspace. The Trade Plan Integration panel's own **"Open Risk & Journal in Trade Workspace"** link deep-links to `/trade-workspace?symbol=SYMBOL`, carrying the current instrument across so the user lands on the exact same symbol's Risk Panel, Journal Panel, and AI Trading Coach without re-selecting anything.

## Supporting, always-visible panels

Two further panels support the workflow without being a workflow step of their own:

- **Structure Shift Timeline** (main column) — a chronological event list combining trend changes, range entries/exits, and support/resistance zone tests, built by replaying the existing Market Structure scorer over an expanding candle window (the same technique `tradingBacktest.ts`'s own `structure-breakout` strategy already established). Event names are exactly the 9 the brief specifies — never BOS/CHOCH/MSS or other strategy-specific terminology.
- **Evidence Panel** (right column) — the concrete supporting facts already computed by each reused engine (Structure's trend detail, the Matrix's own summary, the Timeline's own summary, Liquidity's summary), surfaced verbatim.
- **AI Trading Coach** (right column) — reuses `POST /trading/coach/ask/stream` (Sprint 47/48) and the exact `streamCoach()` SSE client every other coach panel in this codebase already uses. It explains existing structure outputs only — it never creates signals, entries, stops, targets, or directional recommendations, since the endpoint's own prompt already refuses to invent any of those.

## UI mechanics

- **Resizable panels**: a 3-column `ResizablePanelGroup` (left / main / right), each collapsible independently.
- **Saved layouts**: panel sizes persist across sessions via `autoSaveId="market-structure-workbench-layout"`, the same mechanism `InstitutionalWorkspace.tsx` (Phase 17) and `TradeWorkspace.tsx` (Phase 25) already established for this codebase's meaning of "a saved layout."
- **Keyboard shortcuts**: `/` focuses the symbol search, `Escape` blurs a focused input, `[` / `]` collapse or expand the left/right panels — identical to `TradeWorkspace.tsx`'s own established shortcuts.
- **Deep linking**: `/market-structure-workbench?symbol=SYMBOL` restores the selected instrument on load.

## Integration into other surfaces

Per the approved scope, the Workbench is reachable from every named surface without re-implementing its own content elsewhere:

- **Institutional Trade Workspace** (`TradeWorkspace.tsx`) — the Market Structure Summary panel links out to the full Workbench for the same symbol.
- **Trading Research** (`TradingResearch.tsx`) — the Market Structure card links out the same way.
- **Trading Dashboard** (`InstitutionalDashboard.tsx`) — the Market Structure signal card links out the same way.
- **Trade Plan Panel / Risk Panel / Workspace Notes** — integrated at the data layer (Trade Plans and Workspace Notes share the exact same Phase 25 tables) and via the Workbench's own outbound link to the Trade Workspace's Risk Panel and Journal Panel.
- **Trading Journal** (`TradingJournal.tsx`) — a header-level link back to the Workbench.
- **Trading AI Coach** — embedded directly as the Workbench's own AI Trading Coach panel, reusing the same endpoint every other coach panel in this codebase uses.
- **Learning Centre** (`learn/LearningCentre.tsx`) — a "Continue Learning" tile links to the Workbench.
- **Navigation** (`src/lib/nav-items.ts`) — a new "Market Structure Workbench" entry.
- **Command Palette** — auto-indexed via `ALL_NAV_ITEMS`, no separate registration needed.

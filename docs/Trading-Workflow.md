# Trading Workflow (Phase 25 — Institutional Trade Workspace)

The Institutional Trade Workspace (`/trade-workspace`) supports one continuous, guided workflow, all within a single page:

```
Select Instrument
      │
      ▼
Review Structure
      │
      ▼
Review Liquidity
      │
      ▼
Review Multi-Timeframe Analysis
      │
      ▼
Create Trade Plan
      │
      ▼
Review Risk
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

Every step below names the exact panel and the exact already-shipped (or newly-persisted) data it reads/writes — nothing here is a new signal or scoring system, only a guided sequence through already-computed facts and a human's own recorded intent.

## 1. Select Instrument

The top-bar symbol search (`workspace-symbol-search` / `workspace-symbol-search-submit`) sets the workspace's current instrument and deep-links the URL (`/trade-workspace?symbol=AAPL`) so the exact workspace state can be bookmarked or shared, mirroring `InstitutionalWorkspace.tsx`'s own established deep-linking mechanic (Phase 17). The **Instrument Overview** panel (left column) shows the selected symbol, its current price, and data source (always `SIMULATED` today).

## 2. Review Structure

The **Market Structure Summary** panel (main column) reuses `GET /trading/structure/:symbol` (Sprint 33/40) unmodified — trend classification (uptrend/downtrend/range), confidence level, and the plain-English trend detail sentence the engine already computes.

## 3. Review Liquidity

The **Liquidity Summary** panel reuses `GET /trading/liquidity/:symbol` (Sprint 35/45) unmodified — liquidity band, buy/sell pressure direction, and the engine's own summary sentence.

## 4. Review Multi-Timeframe Analysis

The **Multi-Timeframe Summary** panel reuses `GET /trading/multi-timeframe/:symbol` (Sprint 34/41) unmodified — dominant trend (honestly absent when timeframes disagree), trend agreement (unanimous/majority/split), and the engine's own summary sentence.

## 5. Create Trade Plan

The **Trade Plan Panel** is this phase's own genuinely new persistence surface. A trade plan is always human-authored: direction, thesis (free text), account risk %, entry/stop/target price. `positionSize` and `riskRewardRatio` are derived server-side via Phase 24's own unmodified `computeRiskParameters()` — pure arithmetic, never a recommendation on whether the levels themselves are good. A plan starts in `draft` status and can be moved to `active` (once acted on) or `cancelled`, and later to `closed`; every other transition is rejected with an honest `400`. Multiple plans can exist per symbol (e.g. a cancelled plan followed by a fresh one).

## 6. Review Risk

The **Risk Panel** reuses `GET /trading/risk` (Sprint 38/44) unmodified — this is portfolio-wide (over the calling user's own `trading_positions`), not per-symbol, so it's always visible regardless of which instrument is selected, matching `TradingResearch.tsx`'s own established precedent for this exact panel.

## 7. Record Notes

The **Notes Panel** is this phase's other new persistence surface — a lightweight, per-symbol, free-text note (distinct from the deeper, structured Trading Journal). Notes for the current symbol can be added and deleted directly from the workspace.

## 8. Consult AI Trading Coach

The **AI Trading Coach Panel** reuses `POST /trading/coach/ask/stream` (Sprint 47/48) and the exact `streamCoach()` SSE client `TradingResearch.tsx`'s own coach panel already uses — free-form Q&A grounded in Structure/Multi-Timeframe/Liquidity/Regime/Probability, the user's own portfolio Risk, and recent Trading Journal reflections. Nothing new is narrated here; this is the same coach, embedded in the workspace's own workflow.

## 9. Save Workspace

The **Save Workspace** button (top bar) is the workflow's closing action: it persists whatever is genuinely pending — an in-progress Trade Plan form (if the required fields are filled in but not yet submitted) and/or unsaved Notes text — via the exact same mutations each panel's own Save button would use. It never silently discards either, and never fabricates a "saved" confirmation when nothing was actually pending.

## Supporting, always-visible panels

Two further panels support the workflow without being a workflow step of their own:

- **Session Summary** (left column) — which named trading sessions (Sydney/Tokyo/London/New York) are open right now, and today's realized session high/low, via the new `GET /trading/session/:symbol` route. Descriptive only.
- **Trade Checklist** (left column) — a client-side, honest pass/warn/fail/unknown read of the workflow's own progress: has structure been reviewed, does multi-timeframe agree, is liquidity adequate, has a plan been created, is position size computed, is portfolio risk within limits. `unknown` (never a fabricated pass) whenever a step genuinely hasn't happened yet.
- **Journal Panel** (right column) — a condensed view of recent Trading Journal entries plus a quick-add form, linking out to the full `/trading-journal` page for complete management (the entry table has no `symbol` column of its own, so entries are shown globally, newest-first, honestly — not a fabricated per-symbol filter).
- **Evidence Panel** (left column) — the concrete supporting facts already computed by each reused engine (Structure's trend detail, Multi-Timeframe's summary, Liquidity's summary, Risk's detail, the current Trade Plan's thesis), surfaced verbatim.

## UI mechanics

- **Resizable panels**: a 3-column `ResizablePanelGroup` (left / main / right), each collapsible independently.
- **Saved layouts**: panel sizes persist across sessions via `autoSaveId="trade-workspace-layout"`, the same mechanism `InstitutionalWorkspace.tsx` (Phase 17) already established for this codebase's meaning of "a saved layout."
- **Keyboard shortcuts**: `/` focuses the symbol search, `Escape` blurs a focused input, `[` / `]` collapse or expand the left/right panels — identical to `InstitutionalWorkspace.tsx`'s own established shortcuts, deliberately avoiding the global Cmd+K Command Palette shortcut `AppLayout.tsx` already owns.
- **Deep linking**: `/trade-workspace?symbol=SYMBOL` restores the selected instrument on load.

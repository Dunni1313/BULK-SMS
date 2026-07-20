# Market Structure Workbench (Phase 26)

**Phase 26 — Institutional Market Structure Workbench.** An integration and analysis-workflow phase, not a rebuild of Engine 2's Market Structure Engine. Every trend/swing/zone/confidence read in the new Workbench is computed by already-shipped Phase 3 engines (Market Structure, Multi-Timeframe, Liquidity, Session) exactly as `TradingResearch.tsx`/`TradeWorkspace.tsx` already call them. The genuinely new work this phase is: (1) exposing two real, previously-server-only query-param overrides (per-panel timeframe selection) to the frontend for the first time; (2) a new, purely descriptive Structure Shift Timeline built by replaying the existing scorer over an expanding candle window (zero new scoring); and (3) the Workbench page itself, which composes all of the above into one guided, resizable-panel workflow.

This document describes what the Workbench is and how it's put together. See also:

- `docs/Multi-Timeframe-Structure.md` — the Multi-Timeframe Structure Matrix's own design (which timeframes, what each column means, how alignment/conflict is derived).
- `docs/Structure-Analysis-Workflow.md` — the step-by-step user workflow the Workbench supports.
- `docs/Trading-Workspace-Architecture.md` — Phase 25's Institutional Trade Workspace architecture, whose Trade Plans/Workspace Notes tables and resizable-panel/deep-linking/keyboard-shortcut mechanics this phase reuses unmodified.
- `docs/Trading-Engine-Architecture.md` — Phase 24's Engine 2 foundation audit, unmodified this phase.

---

## 1. Audit performed before writing any code

Per the explicit instruction for this phase, the existing Trading Engine and Institutional Trade Workspace were audited first, and only genuine Market Structure workflow gaps were built.

| Requested area | Already exists as | Status this phase |
|---|---|---|
| Institutional Trade Workspace | `TradeWorkspace.tsx` (Phase 25) — resizable-panel single-instrument cockpit | Reused, unmodified mechanics — gained one outbound deep link to the new Workbench |
| Market Structure Engine | `lib/tradingMarketStructure.ts` (Sprint 33) — `analyzeMarketStructure()`, `buildMarketStructureAnalysis()` | Reused, unmodified — only `ZONE_TOLERANCE_PCT` was newly exported (a constant, zero logic change) |
| Multi-Timeframe Analysis | `lib/tradingMultiTimeframe.ts` (Sprint 34) — `buildMultiTimeframeAnalysis(symbol, provider, timeframes?)` | Reused, unmodified — its own optional `timeframes` parameter already existed and simply had no route/UI exposure until this phase |
| Liquidity Engine | `lib/tradingLiquidity.ts` (Sprint 35) + `GET /trading/liquidity/:symbol` | Reused, unmodified |
| Session Service | `lib/trading/sessionService.ts` (Phase 25) + `GET /trading/session/:symbol` | Reused, unmodified |
| Swing Points / Support & Resistance | `analyzeMarketStructure()`'s own `swingPoints`/`zones` arrays | Reused, unmodified — the Workbench's Swing Explorer and Zone Explorer panels render these arrays directly |
| Trend Classification | `analyzeMarketStructure()`'s own `trend`/`confidenceLevel` fields | Reused, unmodified |
| Trade Plans | `trading_trade_plans` table + `routes/tradingTradePlans.ts` (Phase 25) | Reused, unmodified — the Workbench's Trade Plan Integration panel is a second UI consumer of the same table |
| Risk Management | `lib/tradingRisk.ts` (Sprint 38/44) + `GET /trading/risk` | Reused, unmodified — the Workbench does not duplicate a Risk panel; it links out to the Trade Workspace's own Risk Panel instead |
| Workspace Notes | `trading_workspace_notes` table + `routes/tradingWorkspaceNotes.ts` (Phase 25) | Reused, unmodified — the Workbench's Structure Notes panel is a second UI consumer of the same table |
| Trading Journal | `routes/tradingJournal.ts` (Sprint 39/46) | Reused, unmodified — the Workbench does not duplicate a Journal panel; it links out via the Trade Workspace |
| Trading AI Coach | `narrateTradeFreeform()` (Sprint 47), `POST /trading/coach/ask/stream` | Reused, unmodified — same `streamCoach()` SSE client every other coach panel in this codebase already uses; the endpoint's own prompt already refuses to invent entries/stops/targets/directional calls |
| Backtesting | `lib/tradingBacktest.ts` (Sprint 49) | Not touched — out of this phase's named panel list |
| Market Data Provider | `lib/tradingMarketData.ts` (Sprint 32) — `Timeframe = "1m"\|"5m"\|"15m"\|"1h"\|"1D"` | Reused, unmodified — confirmed no Monthly/Weekly/4H timeframe exists anywhere in this codebase; the Workbench only ever exposes these 5 real timeframes |
| Shared navigation | `src/lib/nav-items.ts`, `AppLayout.tsx`, Command Palette | Extended (one new nav entry); Command Palette auto-indexes it via `ALL_NAV_ITEMS`, no separate registration needed |
| Existing Executive Dashboard design language | `ExecutiveDashboard.tsx` (Phase 23) | Design-language precedent only; the Workbench instead mirrors `InstitutionalWorkspace.tsx`'s (Phase 17) / `TradeWorkspace.tsx`'s (Phase 25) resizable-panel/deep-linking/keyboard-shortcut mechanics, the closer structural match for this kind of cockpit |

### Genuine gaps found and built

| Gap | Why it was genuinely missing |
|---|---|
| Multi-Timeframe timeframe selection UI | `buildMultiTimeframeAnalysis()` already accepted an arbitrary `timeframes` array, but `GET /trading/multi-timeframe/:symbol` never exposed a way to request anything but the fixed default set (`15m`/`1h`/`1D`) |
| Structure Overview per-panel timeframe selector | `GET /trading/structure/:symbol` already supported `?interval=`/`?lookback=` overrides (Sprint 40), but no frontend caller had ever used them |
| Structure Shift Timeline | No module anywhere in the codebase produced a chronological event timeline (higher high / higher low / lower high / lower low / trend change / range entry / range exit / support test / resistance test) — only point-in-time trend/zone snapshots existed |
| HH/HL/LH/LL sequence labeling | No module labeled consecutive swing points against their own prior same-kind swing |
| Support/resistance "test" detection | No module flagged when a later swing point revisited an already-detected zone |
| The Workbench page itself | No page composed Structure + Multi-Timeframe + the new Timeline + Liquidity + Session + Notes + Trade Plans + AI Coach into one instrument-centric workflow with cross-timeframe comparison as its primary lens |

---

## 2. What was built

### Backend (one new query-param override + one new pure, reused-logic module)

- **`GET /trading/multi-timeframe/:symbol?timeframes=15m,1h,1D`** — a backward-compatible, undocumented (in the strict OpenAPI sense) query-param override on the existing route, mirroring the established pattern of keeping server-side-only overrides out of the formal typed contract to avoid a known Orval path+query codegen collision (first disclosed Sprint 40). Omitting the parameter is byte-identical to every pre-Phase-26 caller. Invalid timeframes 400, never silently dropped.
- **`lib/tradingStructureTimeline.ts`** — `buildStructureShiftTimelineFromCandles()` (pure) / `buildStructureShiftTimeline()` (orchestration). Reuses `analyzeMarketStructure()` (Sprint 33, unmodified) repeatedly over an expanding candle window — the exact technique `tradingBacktest.ts`'s own `structure-breakout` strategy already established — to detect trend-change points, plus pure comparisons over the already-computed `swingPoints`/`zones` arrays (using the newly-exported `ZONE_TOLERANCE_PCT` constant) for HH/HL/LH/LL labeling and zone-test detection. Zero new scoring, zero new probability.
- **`GET /trading/structure-timeline/:symbol?interval=&lookback=`** — a thin pass-through route mirroring `routes/tradingStructure.ts`'s own zero-business-logic pattern exactly.

No protected file (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`) was touched. `autoExecutionLog` was not touched.

### Frontend

- **`src/lib/structure-query.ts`** — a small, self-contained `fetch()`-based `useQuery` wrapper for the 3 real server-side overrides (`?interval=`/`?lookback=` on Structure and the Timeline; `?timeframes=` on Multi-Timeframe) that no generated Orval hook can expose without triggering the known path+query collision. The first frontend consumer in this codebase to need this workaround.
- **`src/lib/structure-display-state.ts`** — pure relabeling of already-computed `trend`/`confidenceLevel` (single timeframe) and `trendAgreement`/`dominantTrend` (cross-timeframe) onto 5 display states: Bullish, Bearish, Range, Transition, Unclear / Insufficient Data. Never a new score or probability — "Transition" reuses the engine's own honest "split" agreement signal; "Unclear / Insufficient Data" reuses the engine's own honest "Low" confidence or "insufficient-data" agreement signal.
- **`pages/MarketStructureWorkbench.tsx`** — the Workbench page itself. See `docs/Structure-Analysis-Workflow.md` for the full panel-by-panel workflow and `docs/Multi-Timeframe-Structure.md` for the Matrix's own design.

---

## 3. Structure states — never a new score

Per the approved scope, the Workbench displays exactly the 5 states named in the brief, and no others: **Bullish**, **Bearish**, **Range**, **Transition**, **Unclear / Insufficient Data**. Every one of these is a pure relabeling of an already-computed, already-shipped classification:

| Display state | Derived from | Never fabricated because |
|---|---|---|
| Bullish | `trend === "uptrend"` (single timeframe) or `dominantTrend === "uptrend"` (cross-timeframe) | Reuses the Market Structure / Multi-Timeframe Engine's own existing trend field |
| Bearish | `trend === "downtrend"` / `dominantTrend === "downtrend"` | Same as above |
| Range | `trend === "range"` / `dominantTrend === "range"` | Same as above |
| Transition | Multi-Timeframe's own honest `trendAgreement === "split"` signal | The engine itself already refuses to name a winner when timeframes genuinely disagree; the Workbench just labels that refusal "Transition" instead of leaving it blank |
| Unclear / Insufficient Data | `confidenceLevel === "Low"` (single timeframe) or `trendAgreement === "insufficient-data"` (cross-timeframe) | Reuses the engine's own honest low-confidence/insufficient-sample signal — never a forced directional read on a thin sample |

No probability is displayed anywhere in the Workbench, since none of Market Structure, Multi-Timeframe, or Liquidity produce one.

---

## 4. Deferred, per the approved scope

Explicitly **not** built this phase, per the phase brief's own instruction: Order Block detection, Fair Value Gap detection, ICT/SMC/ASAD/Trader Bill logic, automated signals, automated execution, entries/stops/targets/directional recommendations from the AI Trading Coach. None of these concepts exist anywhere in this codebase after this phase either. The Structure Shift Timeline's own event vocabulary is deliberately limited to the 9 names the brief specifies (new higher high / new higher low / new lower high / new lower low / trend change / range entry / range exit / support test / resistance test) — never BOS/CHOCH/MSS or any other strategy-specific terminology, since none of those concepts exist canonically anywhere in this codebase.

All existing, completed Institutional Investing Engine (Engine 1) and Options Income Engine (Engine 3) functionality was left untouched — this phase's diff is scoped entirely to Engine 2's new module/route/page plus deep links from other pages and the 3 documentation files this note belongs alongside.

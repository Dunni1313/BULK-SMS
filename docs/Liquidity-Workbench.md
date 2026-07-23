# Liquidity & Session Workbench (Phase 27)

**Phase 27 — Institutional Liquidity & Session Workbench.** An integration and workflow phase, not a rebuild of Engine 2's Liquidity Engine or Session Service. Every liquidity band/pressure/volume-profile read in the new Workbench is computed by the already-shipped Liquidity Engine (Sprint 35/45), exactly as `TradingResearch.tsx`/`TradeWorkspace.tsx`/`MarketStructureWorkbench.tsx` already call it. The Session Overview panel is a direct, unmodified reuse of Phase 25's own Session Service. The genuinely new work this phase is: (1) `lib/trading/sessionWindows.ts` — for each of the 4 real named trading sessions, its own most recent window's start/end/high/low/range/duration/data-freshness, plus which is active/previous/upcoming (pure timestamp math, reusing `TRADING_SESSION_WINDOWS`/`activeSessionsAt()` unmodified); and (2) `lib/tradingLiquidityTimeline.ts` — a chronological liquidity/pressure timeline built by replaying the existing `analyzeLiquidity()` scorer over rolling candle windows (zero new scoring), plus a plain statistical "Relative Liquidity" comparison and the full-sample volume profile surfaced as Key Liquidity Zones.

This document describes what the Workbench is and how it's put together. See also:

- `docs/Session-Analysis.md` — the Session Windows/Comparison design (what each of the 4 named sessions means, how active/previous/upcoming is derived, the disclosed Sydney/Tokyo data-coverage limitation).
- `docs/Liquidity-Workflow.md` — the step-by-step user workflow the Workbench supports.
- `docs/Market-Structure-Workbench.md` — Phase 26's sibling Workbench, whose resizable-panel/deep-linking/keyboard-shortcut mechanics and design language this phase reuses.
- `docs/Trading-Workspace-Architecture.md` — Phase 25's Institutional Trade Workspace architecture, whose Trade Plans/Workspace Notes tables this phase reuses unmodified.

---

## 1. Audit performed before writing any code

Per the explicit instruction for this phase, the existing Trading Engine, Liquidity Engine, and Session Service were audited first, and only genuine Liquidity/Session workflow gaps were built.

| Requested area | Already exists as | Status this phase |
|---|---|---|
| Institutional Trade Workspace | `TradeWorkspace.tsx` (Phase 25) — resizable-panel single-instrument cockpit | Reused, unmodified mechanics — gained one outbound deep link to the new Workbench |
| Market Structure Workbench | `MarketStructureWorkbench.tsx` (Phase 26) | Reused, unmodified — gained one outbound deep link; the new Workbench's own Evidence Panel reads its `trendDetail` field, not its own computation |
| Liquidity Engine | `lib/tradingLiquidity.ts` (Sprint 35/45) — `analyzeLiquidity()`, `buildLiquidityAnalysis()`, `GET /trading/liquidity/:symbol` | Reused, completely unmodified — zero changes to this file at all this phase |
| Session Service | `lib/trading/sessionService.ts` (Phase 25) — `activeSessionsAt()`, `buildSessionData()`, `TRADING_SESSION_WINDOWS`, `GET /trading/session/:symbol` | Reused, completely unmodified — zero changes to this file at all this phase |
| Market Data Provider | `lib/tradingMarketData.ts` (Sprint 32) — `MarketDataProvider.getCandles()` | Reused, unmodified |
| Multi-Timeframe Analysis | `lib/tradingMultiTimeframe.ts` (Sprint 34) | Not touched — out of this phase's named panel list |
| Trading Dashboard | `InstitutionalDashboard.tsx` (Phase 23) | Gained one outbound deep link from its existing Liquidity signal card |
| Trade Plans | `trading_trade_plans` table + `routes/tradingTradePlans.ts` (Phase 25) | Reused, unmodified — the Workbench's Trade Plan Integration panel is a further UI consumer of the same table |
| Trading Journal | `routes/tradingJournal.ts` (Sprint 39/46) + `TradingJournal.tsx` | Reused, unmodified — gained one outbound deep link |
| Workspace Notes | `trading_workspace_notes` table + `routes/tradingWorkspaceNotes.ts` (Phase 25) | Reused, unmodified — the Workbench's Session Notes panel is a further UI consumer of the same table |
| Trading AI Coach | `narrateTradeFreeform()` (Sprint 47), `POST /trading/coach/ask/stream` | Reused — its own grounding context (`buildTradeCoachContext()`) was additively extended with a `session` field this phase (see §2) |
| Risk Management | `lib/tradingRisk.ts` (Sprint 38/44) + `GET /trading/risk` | Not duplicated — the Workbench links out to the Trade Workspace's own Risk Panel instead |
| Backtesting | `lib/tradingBacktest.ts` (Sprint 49) | Not touched — out of this phase's named panel list |
| Shared navigation | `src/lib/nav-items.ts`, `AppLayout.tsx`, Command Palette | Extended (one new nav entry); Command Palette auto-indexes it via `ALL_NAV_ITEMS`, no separate registration needed |

### Genuine gaps found and built

| Gap | Why it was genuinely missing |
|---|---|
| Per-session window high/low/range/duration/freshness | `sessionService.ts`'s `buildSessionData()` only ever computed today's calendar-day realized high/low across whichever sessions are currently active — no module resolved a per-named-session window (its own start/end, whether it's active/previous/upcoming, its own bounded high/low) |
| Active / Previous / Upcoming session classification | No module classified the 4 named sessions by role relative to "now" |
| Session overlap detection at the window level | `activeSessionsAt()` already returns every session active right now, but no module surfaced this as a first-class "overlap" concept for a comparison UI |
| Session Comparison (all 4 sessions side by side) | No module or page compared session high/low/duration/candle coverage across Sydney/Tokyo/London/New York in one view |
| Liquidity Timeline (chronological liquidity/pressure history) | `analyzeLiquidity()` only ever produced one point-in-time snapshot over a candle sample — no module replayed it to build a chronological timeline |
| Relative Liquidity (statistical comparison, not a new score) | No module compared a symbol's own current liquidity to its own recent average |
| Key Liquidity Zones as a labeled, reusable panel concept | `analyzeLiquidity()`'s own `volumeProfile` already existed but had no dedicated "Key Liquidity Zones" panel of its own outside the Trading Research Liquidity tab |
| The Workbench page itself | No page composed Liquidity + Session + Session Windows + Liquidity Timeline + Notes + Trade Plans + AI Coach into one instrument-centric workflow |
| AI Trading Coach session-awareness | `buildTradeCoachContext()` (Sprint 47) never included session data, so the coach could not ground an answer about active/upcoming sessions |

---

## 2. What was built

### Backend (two new pure/sibling modules + two new thin routes + one additive coach context extension)

- **`lib/trading/sessionWindows.ts`** — `buildSessionWindowsFromCandles()` (pure) / `buildSessionWindows()` (orchestration). Reuses `TRADING_SESSION_WINDOWS`/`activeSessionsAt()` (Phase 25, unmodified) for each of the 4 named sessions' own UTC start/end hour, computes that session's most recent window (`mostRecentStart()`), classifies its role (`active`/`previous`/`upcoming`/`other`) from real timestamp comparisons, and bounds a real candle fetch (`MarketDataProvider.getCandles()`, Sprint 32, unmodified) to that window for high/low/range/candle-count. A separate `nextStartIso` field (distinct from the window's own `startIso`, which always describes the current/most-recent occurrence) gives the true forward-looking "when does this session open next" timestamp — critical for the upcoming-session concept, since a non-active session's own most-recent occurrence is always already in the past.
- **`GET /trading/session-windows/:symbol`** — a thin, path-parameter-only pass-through route (no query overrides, avoiding the known Orval path+query codegen collision entirely — see Sprint 40's own disclosed precedent).
- **`lib/tradingLiquidityTimeline.ts`** — `buildLiquidityTimelineFromCandles()` (pure) / `buildLiquidityTimeline()` (orchestration). Reuses `analyzeLiquidity()` (Sprint 35, completely unmodified) repeatedly over `ROLLING_WINDOW = 5`-candle rolling windows — the exact "repeated call over a rolling/expanding window" technique `tradingStructureTimeline.ts`'s (Phase 26) and `tradingBacktest.ts`'s own `structure-breakout` strategy already established — to build a chronological liquidity-band/pressure timeline. `relativeLiquidityFrom()` is a plain statistical comparison (the latest point's own already-computed `liquidityScore` against the average of the timeline's other points, bucketed at a ±10% band) — never a new score or probability, satisfying the brief's explicit "do not invent probabilities or scores" constraint. Key Liquidity Zones reuse `analyzeLiquidity()`'s own `volumeProfile` from one full-sample call, relabeled for this panel's purpose — zero new computation.
- **`GET /trading/liquidity-timeline/:symbol`** — a thin, path-parameter-only pass-through route, same collision-avoidance design as above.
- **`routes/tradingCoach.ts`** — additively extended: `buildTradeCoachContext()` gained an optional 4th parameter (`session: SessionData | null`), and a new `session` field (honestly `null` when unresolvable) on the returned grounding context. Both `/trading/coach/ask` and `/trading/coach/ask/stream` now call `buildSessionData()` (Phase 25's own unmodified function) and pass the result through. Every pre-existing field/caller behavior is unchanged.

No protected file (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`) was touched. `autoExecutionLog` was not touched. `lib/tradingLiquidity.ts` and `lib/trading/sessionService.ts` — the two engines this phase is built on top of — have a zero-line diff.

### Frontend

- **`pages/LiquidityWorkbench.tsx`** — the Workbench page itself. Both new backend routes are path-parameter-only, so this page consumes them via standard generated Orval hooks (`useGetTradingSessionWindows`, `useGetTradingLiquidityTimeline`) exactly like every other generated hook on the page — no custom `fetch()`-based query wrapper was needed this phase (unlike Phase 26's `structure-query.ts`, whose own routes needed undocumented query overrides). See `docs/Liquidity-Workflow.md` for the full panel-by-panel workflow.

---

## 3. Disclosed, honest data-coverage limitation

The existing `SimulatedMarketDataProvider`'s own intraday candle generation (`lib/tradingMarketData.ts`, unmodified, Sprint 32) only produces candles within a stylized ~09:30–16:00 UTC business-hours window, regardless of interval. This means:

- **Sydney (21:00–06:00 UTC)** and **Tokyo (00:00–09:00 UTC)** sessions never overlap that window — their own high/low/candleCount honestly read `null`/`0` in the Session High/Low Explorer and Session Comparison panels, always.
- **London (07:00–16:00 UTC)** fully overlaps the window.
- **New York (12:00–21:00 UTC)** partially overlaps (12:00–16:00 has real candle data; 16:00–21:00 does not).

This is disclosed as a known, honest limitation of the existing, unmodified SIMULATED market data model — not a bug introduced this phase, and not something this phase attempts to "fix" by modifying the shared/protected `tradingMarketData.ts`. It follows the same "thin/empty sample → honest empty result, never fabricated" discipline already used throughout this codebase (e.g. Investment Quality's, Competitive Advantage's, Management Quality's own permanently-unavailable metrics). The Workbench's own Session High/Low Explorer panel carries an explicit `CardDescription` disclosing this limitation directly in the UI. See `docs/Session-Analysis.md` §3 for the full technical detail.

---

## 4. Deferred, per the approved scope

Explicitly **not** built this phase, per the phase brief's own instruction: rebuilding the Liquidity Engine or Session Service, ICT/SMC/ASAD/Trader Bill/Order Block/Fair Value Gap logic, and automated trading signals. None of these concepts exist anywhere in this codebase after this phase either. "Relative Liquidity" and "Key Liquidity Zones" are both pure, disclosed reuses/comparisons of already-computed values — never a new probability or score. The AI Trading Coach panel explains existing liquidity/session outputs only; its own prompt (unchanged this phase) already refuses to invent entries/stops/targets/directional calls.

All existing, completed Institutional Investing Engine (Engine 1) and Options Income Engine (Engine 3) functionality was left untouched — this phase's diff is scoped entirely to Engine 2's two new modules/routes/page plus deep links from other pages, one additive AI Trading Coach context extension, and the 3 documentation files this note belongs alongside.

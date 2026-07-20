# Trade Planning & Risk Studio (Phase 28)

**Phase 28 — Institutional Trade Planning & Risk Studio.** An orchestration and workflow phase, not a rebuild of Trade Plans, Risk Management, Trading Journal, the Institutional Trade Workspace, the Market Structure Workbench, or the Liquidity & Session Workbench. Every analytical read on this page reuses an already-shipped Engine 2 hook exactly as `TradeWorkspace.tsx`/`MarketStructureWorkbench.tsx`/`LiquidityWorkbench.tsx` already call it (Market Structure, Multi-Timeframe, Liquidity, Session, Portfolio Risk), plus Phase 25's own Trade Plans/Workspace Notes persistence and Trade Checklist composition (`src/lib/trade-checklist.ts`, reused verbatim), the AI Trade Coach's own `streamCoach()` SSE client, and Trading Journal's own list/create hooks.

This document describes what the Studio is and how it's put together. See also:

- `docs/Risk-Studio.md` — the richer Risk display this phase adds (Position Size Review, Risk/Reward Review, Capital Allocation Summary, Portfolio Exposure Summary) and Scenario Comparison's own design.
- `docs/Trade-Planning-Workflow.md` — the step-by-step user workflow the Studio supports.
- `docs/Trading-Workspace-Architecture.md` — Phase 25's Institutional Trade Workspace architecture, whose Trade Plans/Workspace Notes tables and resizable-panel/deep-linking/keyboard-shortcut mechanics this phase reuses.
- `docs/Market-Structure-Workbench.md` / `docs/Liquidity-Workbench.md` — Phase 26/27's sibling Workbenches, whose design language and integration precedent this phase follows.

---

## 1. Audit performed before writing any code

Per the explicit instruction for this phase, the existing Institutional Trade Workspace, Trade Plans, Risk Management, Trading Journal, Market Structure Workbench, Liquidity & Session Workbench, Trading Dashboard, Workspace Notes, Trading AI Coach, Backtesting, Reporting, and Learning Centre were audited first, and only genuine workflow gaps were built.

| Requested area | Already exists as | Status this phase |
|---|---|---|
| Institutional Trade Workspace | `TradeWorkspace.tsx` (Phase 25) — resizable-panel single-instrument cockpit with a combined Entry/Stop/Target trade-plan form and a compact Risk Panel | Reused, unmodified — gained one outbound deep link to the new Studio |
| Trade Plans | `trading_trade_plans` table + `routes/tradingTradePlans.ts` + `computeRiskParameters()` (`lib/tradingDomainModel.ts`, Phase 24) | Reused, completely unmodified — zero changes to any of these three this phase |
| Risk Management | `lib/tradingRisk.ts` (Sprint 38/44) + `GET /trading/risk` — its own `positionSizing`/`stopDiscipline`/`portfolioBudget` structure was already fully computed, but no page surfaced more than one prose sentence per component | Reused, completely unmodified — the Studio's new panels are a richer *display* of the same already-computed fields, zero new math |
| Trading Journal | `routes/tradingJournal.ts` (Sprint 39/46) + `TradingJournal.tsx` | Reused, unmodified — condensed recent-entries + quick-add + outbound link, same "link out, don't duplicate" pattern `TradeWorkspace.tsx`'s own Journal Panel established; gained an inbound link from this phase |
| Market Structure Workbench | `MarketStructureWorkbench.tsx` (Phase 26) | Reused, unmodified — gained an outbound deep link to the new Studio from its own Trade Plan Integration panel |
| Liquidity & Session Workbench | `LiquidityWorkbench.tsx` (Phase 27) | Reused, unmodified — gained an outbound deep link the same way |
| Trading Dashboard | `InstitutionalDashboard.tsx` (Phase 23) | Gained one outbound deep link from its existing Portfolio Risk card |
| Workspace Notes | `trading_workspace_notes` table + `routes/tradingWorkspaceNotes.ts` (Phase 25) | Reused, unmodified — the Studio's Trade Review Notes panel is a further UI consumer of the same table |
| Trading AI Coach | `narrateTradeFreeform()` (Sprint 47), `POST /trading/coach/ask/stream` | Reused, unmodified — the same `streamCoach()` SSE client every other coach panel in this codebase already uses |
| Backtesting | `lib/tradingBacktest.ts` (Sprint 49) | Not touched — out of this phase's named panel list |
| Reporting | `lib/institutionalReporting.ts` / `routes/institutionalReporting.ts` (Phase 22) | Genuinely extended — see §2 below, a new report type reusing Trade Plans + Trading Risk verbatim |
| Learning Centre | `learn/LearningCentre.tsx` | Gained a "Continue Learning" tile |
| Shared navigation | `src/lib/nav-items.ts`, `AppLayout.tsx`, Command Palette | Extended (one new nav entry); Command Palette auto-indexes it via `ALL_NAV_ITEMS`, no separate registration needed |

### Genuine gaps found and built

| Gap | Why it was genuinely missing |
|---|---|
| Dedicated Entry/Stop/Target Planning panels | `TradeWorkspace.tsx`'s own Trade Plan Panel already combines entry/stop/target into one form — the brief explicitly names 3 distinct planning panels; this phase splits the same shared form into 3 visually distinct Cards without changing the underlying submission mechanics |
| Position Size Review / Risk/Reward Review | No page displayed a saved trade plan's own `positionSize`/`riskRewardRatio` as a dedicated, standalone review step — only inline within the saved-plans list |
| Capital Allocation Summary | `TradingRiskAnalysis.portfolioBudget`'s own per-position dollar/percent/within-limit breakdown (`perPosition[]`) was computed since Sprint 38 but never rendered anywhere beyond one prose sentence |
| Portfolio Exposure Summary | `TradingRiskAnalysis.stopDiscipline`'s own missing-stop/missing-target symbol lists and `positionSizing`'s own largest-position symbol/percent were likewise computed but never surfaced |
| Scenario Comparison | No stateless preview existed for comparing 2+ candidate entry/stop/target combinations before committing to a real, persisted Trade Plan |
| Planning Timeline | No page rendered a symbol's own saved Trade Plans as a chronological timeline (oldest to newest) |
| The Studio page itself | No page composed Entry/Stop/Target Planning + the 4 Risk review panels + Scenario Comparison + the Checklist + Notes + Journal + AI Coach into one guided planning-and-risk workflow |

---

## 2. What was built

### Backend (one new pure lib + one new thin route + one new Reporting report type)

- **`lib/tradingScenarioComparison.ts`** — `computeScenarioComparison()` (pure). Calls Phase 24's own `computeRiskParameters()` once per named scenario — the exact same function `routes/tradingTradePlans.ts`'s real `POST /trading/trade-plans` already calls when a plan is actually saved. `bestRiskRewardName`/`tightestRiskName` are honest max/min identifications over already-computed fields — never a new composite score, never a recommendation on which scenario to take. A scenario with a non-computable value (e.g. zero stop distance, or no account value supplied) is simply excluded from that particular comparison, never coerced to a fabricated number.
- **`POST /trading/trade-plans/scenarios/compare`** — a stateless, non-persisting preview endpoint, mirroring the Options Income Engine's own established Order Preview / Trade Adjustment Preview precedent. Accepts 2-5 scenarios; 400s outside that range. Falls back to the calling user's own `settings.tradingAccountValue` when no `accountValue` is supplied in the request body, matching `TradeWorkspace.tsx`'s own `risk?.accountValue ?? undefined` pattern for real Trade Plan creation.
- **`lib/institutionalReporting.ts` / `routes/institutionalReporting.ts`** — a new `"trade-planning-summary"` report type (the 10th), reusing the calling user's own `trading_trade_plans` rows and `buildTradingRiskAnalysis()`'s output verbatim, formatted into 3 `ReportSection`s (Executive Summary, Trade Plans Overview, Trading Risk Summary) — the exact same "thin reformatting, zero new calculation" pattern every other report type in that file already follows.

No protected file (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`) was touched. `lib/tradingRisk.ts`, `lib/tradingDomainModel.ts`, `routes/tradingTradePlans.ts`, `routes/tradingWorkspaceNotes.ts`, and `src/lib/trade-checklist.ts` all have a zero-line diff.

### Frontend

- **`pages/TradePlanningStudio.tsx`** — the Studio page itself, at `/trade-planning-studio`. See `docs/Trade-Planning-Workflow.md` for the full panel-by-panel workflow and `docs/Risk-Studio.md` for the Risk/Scenario Comparison panels' own design.

---

## 3. Deferred, per the approved scope

Explicitly **not** built this phase, per the phase brief's own instruction: automated execution, trading signals, ICT/SMC/ASAD/Trader Bill logic, Order Block detection, Fair Value Gap detection. The Scenario Comparison feature never recommends a scenario — it only identifies, via plain max/min, which already-computed value is highest/lowest, and its own UI badges say "Best R:R"/"Tightest Risk," never "Recommended." The AI Trading Coach panel explains existing plan/risk outputs only; its own prompt (unchanged this phase) already refuses to invent entries/stops/targets/directional calls.

All existing, completed Institutional Investing Engine (Engine 1) and Options Income Engine (Engine 3) functionality was left untouched — this phase's diff is scoped entirely to Engine 2's one new lib/route/report-type plus deep links from other pages and the 3 documentation files this note belongs alongside.

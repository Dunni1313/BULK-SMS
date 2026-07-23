# Institutional Trade Workspace (Phase 25)

**Phase 25 — Institutional Trade Workspace.** An orchestration and workflow phase, not a rebuild of Engine 2. Every analytical panel in the new workspace reuses an already-shipped Engine 2 module exactly as it exists on `TradingResearch.tsx`; the only genuinely new work is the persistence layer a real single-instrument workflow needed (Trade Plans, Workspace Notes, Session data) and the workspace page itself, which composes all of it into one guided, resizable-panel cockpit.

This document describes what the workspace is and how it's put together. See also:

- `docs/Trading-Workflow.md` — the step-by-step user workflow the workspace supports.
- `docs/Trading-Workspace-Architecture.md` — the technical architecture (backend routes/tables, frontend composition).
- `docs/Trading-Engine-Architecture.md` — Phase 24's own Engine 2 foundation audit, unmodified this phase.
- `docs/Trading-Domain-Model.md` — the shared TypeScript domain model (`TradePlan`, `SessionData`, etc.), extended this phase.

---

## 1. Audit performed before writing any code

Per the explicit instruction for this phase, the existing Trading Engine was audited first, and only genuine gaps were built.

| Requested area | Already exists as | Status this phase |
|---|---|---|
| Trading Dashboard | `InstitutionalDashboard.tsx` (Sprint 50) — at-a-glance, no navigation | Reused, unmodified — the Workspace is a different surface (guided, interactive workflow), not a replacement |
| Trading Research | `TradingResearch.tsx` (Sprints 40-48) — tabbed, full-detail | Reused, unmodified |
| Market Structure | `lib/tradingMarketStructure.ts` + `GET /trading/structure/:symbol` | Reused, unmodified |
| Multi-Timeframe | `lib/tradingMultiTimeframe.ts` + `GET /trading/multi-timeframe/:symbol` | Reused, unmodified |
| Liquidity | `lib/tradingLiquidity.ts` + `GET /trading/liquidity/:symbol` | Reused, unmodified |
| Trading Journal | `routes/tradingJournal.ts` (Sprint 39/46) full CRUD | Reused, unmodified — Journal Panel is a condensed view + quick-add, linking to the full page |
| Trading Backtesting | `lib/tradingBacktest.ts` (Sprint 49), `TradingBacktest.tsx` | Reused, unmodified — not embedded in the workspace (out of this phase's named panel list) |
| Trading AI Coach | `narrateTradeFreeform()` (Sprint 47), `POST /trading/coach/ask/stream` | Reused, unmodified — same `streamCoach()` SSE client `TradingResearch.tsx` already uses |
| Trade Workspace placeholder | Phase 24's static, zero-API-call `TradeWorkspace.tsx` | **Replaced** with the real, interactive workspace this document describes |
| Trade Plan Service | `lib/trading/tradePlanService.ts` (Phase 24, in-memory only) — `computeRiskParameters()`, `transitionTradePlanStatus()` | Reused, unmodified logic — given real persistence this phase (see §2) |
| Trading Domain Model | `lib/tradingDomainModel.ts` (Phase 24) — `TradePlan`, `RiskParameters`, `SessionData`, `TRADING_SESSION_WINDOWS` | Reused, unmodified — `TRADING_SESSION_WINDOWS` consumed for the first time this phase |
| Market Data | `lib/tradingMarketData.ts` (Sprint 32) — `MarketDataProvider.getCandles()` | Reused, unmodified — powers the new Session Summary panel |
| Shared navigation | `src/lib/nav-items.ts`, `AppLayout.tsx`, Command Palette | Reused, unmodified — route already wired since Phase 24 |
| Shared reporting | `lib/institutionalReporting.ts` (Phase 22) | Not touched this phase — Engine 2 has no reporting-framework equivalent yet (a disclosed gap, unchanged) |
| Shared notifications | `platform_notifications`, `NotificationBell.tsx` | Reused, unmodified — the workspace raises no new notification types |
| Executive Dashboard | `ExecutiveDashboard.tsx` (Phase 23) | Design-language precedent only; the workspace instead mirrors `InstitutionalWorkspace.tsx`'s (Phase 17) resizable-panel/deep-linking/keyboard-shortcut mechanics, since that page is the closer structural match for a single-instrument cockpit |

### Genuine gaps found and built

| Gap | Why it was genuinely missing |
|---|---|
| Trade Plan persistence | Phase 24's `tradePlanService.ts` was explicitly in-memory only, deferred "until a real UI consumer... actually needs it" — this workspace's own "Create Trade Plan" / "Save Workspace" steps are that consumer |
| Workspace Notes | No per-symbol, lightweight free-text note existed for Engine 2 (distinct from the deeper, structured Trading Journal) |
| Session route | `buildSessionData()`'s own shape existed in the domain model but had no route, no orchestration function, and no UI |
| Trade Checklist | No composition existed that reads Structure/Liquidity/Multi-Timeframe/Risk/Trade-Plan together and reports an honest per-item pass/warn/fail/unknown status |
| Evidence Panel | No surface existed that collects each engine's own already-computed summary/detail text into one supporting-evidence list |
| The Workspace page itself | Phase 24's `TradeWorkspace.tsx` was a deliberately empty, zero-API-call placeholder |

---

## 2. What was built

### Backend (real persistence + one thin orchestration route)

- **`trading_trade_plans`** table (`lib/db/manual-migrations/030_trading_trade_plans.sql`) — `id`, `userId` (FK, `ON DELETE RESTRICT`), `symbol`, `direction`, `status` (draft/active/closed/cancelled), `thesis`, `accountRiskPct`, `entryPrice`, `stopPrice`, `targetPrice`, and the two honestly-nullable derived fields `positionSize`/`riskRewardRatio` (computed at write time via Phase 24's own unmodified `computeRiskParameters()`). Not foreign-keyed to `trading_positions` — a plan may never become a position.
- **`trading_workspace_notes`** table (`lib/db/manual-migrations/031_trading_workspace_notes.sql`) — `id`, `userId`, `symbol`, `note`. Mirrors `investing_research_notes`' own established shape.
- **`routes/tradingTradePlans.ts`** — full CRUD (`GET /trading/trade-plans`, `GET /trading/trade-plans/:symbol`, `POST`, `PATCH /trading/trade-plans/:id`, `DELETE /trading/trade-plans/:id`), ownership-scoped via `getScopedUserId(req)`, status transitions validated through Phase 24's own `transitionTradePlanStatus()` (400 on an invalid transition, e.g. `draft` → `closed`).
- **`routes/tradingWorkspaceNotes.ts`** — full CRUD, mirroring `stockAnalyst.ts`'s own `/research-notes` pattern exactly.
- **`lib/trading/sessionService.ts`** — `buildSessionData(symbol, asOf?)`, a thin orchestration function reusing the existing `MarketDataProvider` seam and `TRADING_SESSION_WINDOWS`; reports which named sessions (Sydney/Tokyo/London/New York) are open at a given instant and today's realized session high/low. Descriptive only — never a signal or prediction.
- **`routes/tradingSession.ts`** — `GET /trading/session/:symbol`, a thin pass-through mirroring `routes/tradingStructure.ts`'s own zero-business-logic pattern.

No protected file (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`) was touched. `autoExecutionLog` was not touched.

### Frontend

- **`src/lib/trade-checklist.ts`** — a pure, I/O-free function (`buildTradeChecklist()`) composing already-fetched Structure/Multi-Timeframe/Liquidity/Risk/Trade-Plan data into 6 checklist items, each honestly `pass`/`warn`/`fail`/`unknown` — `unknown` (never a fabricated pass) whenever the underlying panel hasn't loaded yet.
- **`pages/TradeWorkspace.tsx`** — the real, interactive workspace, replacing Phase 24's placeholder. See `docs/Trading-Workspace-Architecture.md` for the full panel-by-panel breakdown.

---

## 3. Deferred, per the approved scope

Explicitly **not** built this phase, per the phase brief's own "Defer" section: Order Block detection, Fair Value Gap detection, ICT logic, SMC logic, ASAD strategy, Trader Bill strategy, automated signals, automated execution. None of these concepts exist anywhere in this codebase after this phase either — confirmed by `git diff --stat` showing no changes to `lib/tradingDomainModel.ts`'s own (still-empty) `STRATEGY_REGISTRY` or any signal-generation file.

All existing, completed Investing Engine (Engine 1) functionality was left untouched — this phase's diff is scoped entirely to Engine 2's own new tables/routes/page plus the two new documentation files this note itself belongs alongside.

# Phase 3 — Institutional Trading Engine (Engine 2) — Final Architecture & Completion Report

**Status: PHASE 3 COMPLETE.** Sprints 32–51 (20 sprints), all shipped, validated, committed, and pushed to `claude/sprint-1-inspection-validation-o9mlsk`. The one remaining item from the original module list — a Live Market-Data Provider — has been **explicitly deferred by the project owner**, not left open: *"I am explicitly deferring the optional Live Market-Data Provider. Do not implement it at this time."* With that decision confirmed, there is no outstanding Phase 3 work.

This report is the closing record of Phase 3, mirroring the role `docs/Phase-2-Investing-Engine-Execution-Plan.md`'s Sprint 31 played for Phase 2. It draws only on facts verified by direct inspection of the repository at the close of Sprint 51 — file listings, `git log`, migration contents, `openapi.yaml`, and the final validation run — not from planning-document assumptions.

---

## 1. Executive Summary

Phase 3 built **Engine 2 — the Institutional Trading Engine** from nothing: at the start of Sprint 32, this codebase had no real price-series market data, no candle-based technical analysis, no trading-specific risk management, and no trading journal or backtesting capability distinct from Engine 3's options-only tooling. Twenty sprints later, Engine 2 is a complete, coherent, SIMULATED-first trading-analysis platform sitting alongside the completed Engine 1 (Investing, Phase 2) and Engine 3 (Options Income, pre-existing) on the same shared platform layer (auth, multi-tenancy, `lib/ai-core`, audit logging) Phase 1 built.

Nine analytical engines were shipped: Market Data Foundation, Market Structure, Liquidity/Order Flow, Multi-Timeframe Trend, Market Regime Detection, Probability, Risk Management, Trading Journal, and a genuine walk-forward Backtesting engine — plus an AI Trade Coach (the third proof of the deterministic-math → `ai-core.narrate()` → enforced-disclaimer pattern first established in Phase 1 and reused in Phase 2) and an Institutional Dashboard unifying the whole per-symbol picture into one screen. A closing Trading Engine Unification sprint (Sprint 51) proved the entire surface holds together as one coherent product, the same discipline Phase 2's Sprint 31 established.

Every module is **SIMULATED-first, deterministic, and honestly labeled** — no live broker, Level 2, order-flow, or execution data was ever fabricated, and the engine never places an order (Engine 2 is read-only/advisory throughout this phase, by design). Every one of CLAUDE.md's non-negotiable protected files (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`, `autoExecutionLog`) was confirmed untouched at the close of every single sprint — Phase 3 added an entire new engine without ever touching the money-moving code that predates it.

The API test suite grew from 72 files / 778 tests (Phase 2's close) to 94 files / 1028 tests (Phase 3's close) — **+22 files, +250 tests**. The frontend suite grew from 7 files / 44 tests to 11 files / 94 tests — **+4 files, +50 tests**. Every sprint's validation was run against a real Postgres database, with the API suite run at least twice per sprint to catch flakes, and every known flake was investigated and confirmed pre-existing and unrelated before being disclosed as such.

---

## 2. Overall Architecture

Phase 3 followed the architectural recommendation set at Phase 3's own kickoff (§25 Decision 1 of the Phase 3 plan): **no monorepo restructure**. Engine 2 lives in the same flat `artifacts/api-server/src/{routes,lib}` directories as Engines 1 and 3, distinguished purely by a `trading*`/`market*` naming prefix — the exact convention Engine 1 proved out over 21 Phase 2 sprints with zero friction. The frontend follows the same pattern: a new `/trading/*`-flavored route namespace (`/trading-research`, `/trading-journal`, `/trading-backtest`, `/institutional-dashboard`), mirroring Engine 1's `/stock-analyst/*` namespace.

```
Platform layer (Phase 1)
  auth, multi-tenancy, lib/ai-core, platform_audit_log, settings
        |
        +-- Engine 1 — Investing (Phase 2, COMPLETE)
        |     valueReport.ts + 20 analyzer modules, investing_* tables
        |
        +-- Engine 2 — Trading (Phase 3, COMPLETE, THIS REPORT)
        |     Market Data seam -> Structure -> Multi-Timeframe -> Liquidity
        |     -> Regime -> Probability -> Risk -> {Journal, Backtest, AI Coach}
        |     -> Institutional Dashboard (composition layer, no new logic)
        |
        +-- Engine 3 — Options Income (pre-existing, PROTECTED)
              execution.ts / autoExecution.ts / risk.ts — never modified
              trades table — read-only cross-engine reference only
```

**Composition discipline, unbroken across all 20 sprints:** every module above Market Structure composes strictly on top of already-shipped modules, never re-deriving a signal a lower module already computed. `buildProbabilityAnalysis()` — the deepest composition chain in Engine 2 — transitively resolves Regime → Multi-Timeframe → Liquidity → Structure → the raw `MarketDataProvider` in one call, with zero duplicate candle fetches at any layer (proven directly by Sprint 51's own regression suite). The AI Trade Coach and the Institutional Dashboard are the two "top of the stack" consumers: the Coach composes Probability + Risk + Journal into one grounding context for an LLM; the Dashboard composes the same five per-symbol signals plus Risk/Journal/Backtest summaries into one screen — neither introduces a single new calculation.

**Engine independence, deliberately preserved:** Engine 2 never imports from Engine 1 or Engine 3's own lib files for its core calculations. Three deliberate, disclosed parallel constructions exist rather than cross-engine coupling: `tradingRegime.ts`'s macro-regime read is independent of Engine 1's `investingMacro.ts` and Engine 3's `marketBriefing.ts`; `TRADING_MARKET_UNIVERSE` (Sprint 32) independently duplicates, rather than imports, `INVESTING_UNIVERSE`'s (Engine 1) base-price seeding; `tradingRisk.ts` is a wholly new module built on `investingRisk.ts`'s proven *shape* (score cards, hard-cap overrides), never on `risk.ts`/`portfolioHealth.ts` (Engine 3's own risk code, protected). Every one of these decisions was explicitly disclosed and justified at the sprint that made it.

---

## 3. All Engines Delivered

| # | Engine | Sprint(s) | Core file(s) |
|---|---|---|---|
| 1 | Market Data Foundation | 32 | `lib/tradingMarketData.ts` — `MarketDataProvider` seam, `SimulatedMarketDataProvider`, bounded-lookback candle/quote generation |
| 2 | Market Structure | 33 (Core), 40 (Route+UI) | `lib/tradingMarketStructure.ts` — swing-point detection, support/resistance zone clustering, trend classification |
| 3 | Multi-Timeframe Trend | 34 (Core), 41 (Route+UI) | `lib/tradingMultiTimeframe.ts` — runs Structure at multiple timeframes, confluence via the shared `classifyAgreementSignal<T>()` |
| 4 | Liquidity / Order Flow | 35 (Core), 45 (Route+UI) | `lib/tradingLiquidity.ts` — volume profile, dollar-volume liquidity scoring, buy/sell pressure proxy |
| 5 | Market Regime Detection | 36 (Core), 42 (Route+UI) | `lib/tradingRegime.ts` — trend + liquidity + realized-volatility composite regime label |
| 6 | Probability Engine | 37 (Core), 43 (Route+UI) | `lib/tradingProbability.ts` — driftless lognormal probability cone (±1σ/±2σ), touch probability |
| 7 | Risk Management | 38 (Core), 44 (Route+UI + Positions CRUD) | `lib/tradingRisk.ts` — position sizing, stop/target discipline, portfolio risk budget, hard-cap overrides |
| 8 | Trading Journal | 39 (Core+CRUD), 46 (Frontend UI) | `routes/tradingJournal.ts`, `trading_journal_entries` table — full CRUD |
| 9 | Backtesting (Engine-2-native) | 49 | `lib/tradingBacktest.ts` — genuine walk-forward bar-by-bar simulation, 3 named strategies |
| — | AI Trade Coach | 47 (Core+Route), 48 (Frontend UI) | `coachLLM.ts`'s `narrateTradeFreeform`/`Stream`, `routes/tradingCoach.ts` — pure composition, zero new calculations |
| — | Institutional Dashboard | 50 | `pages/InstitutionalDashboard.tsx` — pure composition layer, zero new backend code |
| — | Trading Engine Unification | 51 | `tradingEngineUnification.test.ts` + `.route.test.ts` — closing regression/integration proof |

This is every module named in `CLAUDE.md` §1's Engine 2 mandate ("Market structure, liquidity, order flow, multi-timeframe analysis, probability engine, market regime detection, institutional dashboard, risk management, trading journal, AI trade coach") plus Backtesting, which the Phase 3 plan's own brief explicitly added as a natural Engine 2 deliverable.

**Every Route+UI slice followed the same thin-wrapper discipline:** a route contains zero business logic, calling straight through to an already-unit-tested Core engine function. This was verified sprint-by-sprint via `git diff --stat` showing the underlying `lib/trading*.ts` file unchanged whenever only a route/UI was added (Sprints 40–46).

---

## 4. API Surface

10 new OpenAPI tags, 13 documented paths (plus one deliberately-undocumented SSE streaming endpoint, matching the precedent Phase 2 Sprint 30 set for `/value-research/ask/stream`):

| Tag | Path(s) | Verb(s) |
|---|---|---|
| `trading-structure` | `/trading/structure/{symbol}` | GET |
| `trading-multi-timeframe` | `/trading/multi-timeframe/{symbol}` | GET |
| `trading-regime` | `/trading/regime/{symbol}` | GET |
| `trading-probability` | `/trading/probability/{symbol}` | GET |
| `trading-liquidity` | `/trading/liquidity/{symbol}` | GET |
| `trading-risk` | `/trading/risk` | GET (portfolio-wide, not per-symbol) |
| `trading-positions` | `/trading/positions`, `/trading/positions/{id}` | GET, POST, PATCH, DELETE |
| `trading-journal` | `/trading/journal`, `/trading/journal/{id}` | GET, POST, PATCH, DELETE |
| `trading-backtest` | `/trading/backtest/run`, `/trading/backtest/results` | POST, GET |
| `trading-coach` | `/trading/coach/ask` (+ undocumented `/ask/stream`) | POST |

**Design conventions held for all 13 endpoints, with zero exceptions:**
- Per-symbol read routes (`structure`/`multi-timeframe`/`regime`/`probability`/`liquidity`) are thin, unauthenticated-safe pass-throughs — no ownership scoping needed since they're read-only market analysis, not a user's own resource. 404 for an unresolvable/invalid-shaped symbol, never a fabricated analysis.
- User-scoped resource routes (`positions`/`journal`/`backtest`/`risk`) are ownership-scoped via `getScopedUserId(req)` and the established `and(eq(id), eq(userId))` pattern — 404, never a separate 403, for both "doesn't exist" and "isn't yours."
- Every schema uses the established `Trading`-prefixed naming convention, verified collision-free against Engine 1/3's own schemas before every codegen run (one genuine Orval path+query-parameter collision was discovered and worked around at Sprint 40, documented there — the fix was to keep `?interval=&lookback=` query overrides functional but outside the strict OpenAPI-modeled surface, the same precedent as the SSE routes).
- `api-zod`/`api-client-react` were regenerated cleanly after every schema change, with zero manual edits to generated files at any point in the phase.

Two new `settings` columns support Engine 2's provider/account configuration, following the exact shape `fundamentalsProvider`/`fundamentalsConnected` (Engine 1, Sprint 11) established: `tradingDataProvider` (default `"simulated"`, client-settable), `tradingDataConnected` (default `false`, **read-only** — never client-settable, always reflects real state). A third, `tradingAccountValue` (nullable, no default, client-settable), was added at Sprint 44 to size Risk Management's position-sizing math, deliberately independent of Engine 3's own options-derived account value.

---

## 5. UI Modules

Four new top-level pages, one new shared presentational module:

| Page | Route | Sprint(s) | Purpose |
|---|---|---|---|
| `TradingResearch.tsx` | `/trading-research` | 40–45, 48, 50 | Full-detail, tabbed research surface (Research tab: Structure/Multi-Timeframe/Regime/Probability/AI Coach eager cards; Liquidity tab: on-demand) plus the always-visible Portfolio Risk management section (positions CRUD, account value, risk analysis) |
| `TradingJournal.tsx` | `/trading-journal` | 39 (backend), 46 (UI) | Full CRUD journal UI, adapted from the options-side `Journal.tsx`'s established list/detail/mood-tag pattern |
| `TradingBacktest.tsx` | `/trading-backtest` | 49 | Run-form, equity-curve chart, KPI tiles, trade log, results history — adapted from the options-side `Backtest.tsx`'s rendering pattern, without its options-specific "Explain This Trade" feature |
| `InstitutionalDashboard.tsx` | `/institutional-dashboard` | 50 | Condensed, no-tabs, one-symbol-lookup overview of all 5 per-symbol signals + always-visible Portfolio Risk/Journal/Backtest summaries — pure composition, zero new backend code |
| `src/lib/trading-format.tsx` | (shared module) | 50 | 10 presentational badge-class/icon helpers, extracted from `TradingResearch.tsx` and reused by `InstitutionalDashboard.tsx` — a behavior-preserving refactor, not new logic |

**Navigation:** 4 new sidebar items (Institutional Dashboard, Trading Research, Trading Journal, Trading Backtest), positioned as a contiguous Engine 2 block with the Dashboard first as the natural landing page.

**Deliberate design choices held throughout the phase:**
- Eager vs. on-demand: Structure/Multi-Timeframe/Regime/Probability are cheap enough to compute eagerly on symbol search; Liquidity carries its own volume-profile computation and was kept behind an on-demand tab in `TradingResearch.tsx` (mirroring Phase 2's Statements/Peers cost-control precedent) — but the Institutional Dashboard deliberately fetches all five concurrently, since "no additional navigation" is that page's entire reason to exist.
- Every card is honestly labeled `SIMULATED` (or `LIVE`, for the future) exactly as its originating engine module labels it — no page fabricates or re-labels a data source.
- Two distinct-but-related pages (`TradingResearch.tsx` for full detail + management, `InstitutionalDashboard.tsx` for at-a-glance overview) were deliberately not merged, with a disclosed cross-reference comment in each explaining why — the same "distinct-but-related surfaces, disclosed, not merged" precedent Sprint 36 established between `tradingRegime.ts` and `marketBriefing.ts`.

---

## 6. Database Schema Additions

**3 new tables**, all purely additive, `NOT NULL` from creation (except genuinely-optional fields), no nullable→backfill→enforce migration needed (zero existing rows at creation, same precedent as `platform_audit_log`):

| Table | Migration | Notes |
|---|---|---|
| `trading_positions` | `010_trading_engine_tables.sql` | Instrument-agnostic open/closed position ledger. `user_id` FK `ON DELETE RESTRICT`. Deliberately a new table, not a retrofit of Engine 3's options-legs-coupled `trades` table (§0 Correction 3 of the Phase 3 plan). |
| `trading_journal_entries` | `010_trading_engine_tables.sql` | Mirrors `journal_entries`' core shape (title/content/mood/tags/lessonLearned) plus trading-relevant fields (`entryPrice`/`exitPrice`/`rMultiple`/`setupType`) replacing Engine 3's options-specific fields. `trading_position_id` deliberately has **no** FK constraint, mirroring `journal_entries.trade_id`'s own established loose-reference precedent. |
| `trading_backtest_results` | `013_trading_backtest_results.sql` | Reuses the options-side `backtest_results` table's persisted-results *shape* (headline columns + jsonb detail), not the table or its options-specific simulation logic — this table's `tradeLog` is a REAL trade-by-trade log from a genuine walk-forward simulation. Includes a `data_source` column (`SIMULATED`/`LIVE`) so a persisted backtest honestly records which data source produced it. |

**3 new `settings` columns** across 2 migrations:

| Column | Migration | Default | Client-settable? |
|---|---|---|---|
| `trading_data_provider` | `011_trading_settings.sql` | `'simulated'` | Yes |
| `trading_data_connected` | `011_trading_settings.sql` | `false` | No — read-only, always reflects real state |
| `trading_account_value` | `012_trading_account_value.sql` | `NULL` (no default) | Yes |

Every one of these 4 migrations is `IF NOT EXISTS`/purely additive with a documented rollback (`DROP TABLE`/`DROP COLUMN`), following the manual-migration-script discipline CLAUDE.md rule 7 requires for every schema change in this project. No existing table, column, route, or exported function signature was altered or removed anywhere in Phase 3.

---

## 7. Testing Summary

| Suite | Phase 2 close (Sprint 31) | Phase 3 close (Sprint 51) | Growth |
|---|---|---|---|
| `@workspace/api-server` test files | 72 | 94 | **+22** |
| `@workspace/api-server` tests | 778 | 1,028 | **+250** |
| `@workspace/ravish-trading` test files | 7 | 11 | **+4** |
| `@workspace/ravish-trading` tests | 44 | 94 | **+50** |

**Testing disciplines held across all 20 sprints, with zero exceptions:**
- Every pure-function Core engine module has its own dedicated unit-test suite with zero DB/provider dependency (`tradingMarketStructure.test.ts`, `tradingMultiTimeframe.test.ts`, `tradingLiquidity.test.ts`, `tradingRegime.test.ts`, `tradingProbability.test.ts`, `tradingRisk.test.ts`, `tradingBacktest.test.ts`).
- Every route has its own live, end-to-end HTTP test file against a real running app instance and a real Postgres connection — never a mocked Express layer.
- Every honest-unavailable/honest-null path (invalid ticker shape, too-few-candles, no-signal-triggered, insufficient-risk-data) is explicitly tested, never merely assumed.
- Every hard-cap/threshold/banding rule (Risk Management's 2%/6% caps, Liquidity's High/Moderate/Low bands, Structure's confidence tiers) is tested at its exact boundary.
- Determinism is proven directly (repeated calls / repeated full-engine sweeps asserted byte-identical via `toEqual`) rather than assumed from "it's seeded."
- Tenant isolation for every new user-scoped table (`trading_positions`, `trading_journal_entries`, `trading_backtest_results`) was added to the shared `assertTenantIsolation` suite the same sprint the table was created, plus a dedicated IDOR proof (`and(id, userId)` never resolving another user's row) for at least one route per table.
- The closing Sprint 51 added a genuinely new regression category — cross-composition-path consistency (`tradingEngineUnification.test.ts`, 8 tests) proving that the *same* signal, reached via two different composition chains for the same symbol, agrees byte-for-byte — the direct Engine-2 analog of every Phase 2 sprint's "prove prior sprints' outputs are unchanged via direct equality" discipline.
- The full-surface unification test (`tradingEngineUnification.route.test.ts`, 11 tests) proves the literal Blueprint acceptance bar: one symbol lookup resolves across every Engine 2 module for one user, concurrently, with zero 404s; an unknown symbol 404s consistently everywhere, never a partial/fabricated result.

---

## 8. Validation Summary

Every one of the 20 sprints ran the full validation sequence — `pnpm run typecheck`, `pnpm --filter @workspace/api-server run test` (run at least twice per sprint to catch flakes), `pnpm --filter @workspace/ravish-trading run test`, `PORT=5000 BASE_PATH=/ pnpm run build` — against a real, disposable local Postgres database with the full schema pushed and the legacy-owner user seeded. No sprint's completion was reported without every command actually being run and its real output inspected, per CLAUDE.md §4's own honesty requirement.

**Final validation, at the close of Sprint 51:**
- `pnpm run typecheck` — clean across all workspaces.
- `pnpm --filter @workspace/api-server run test` — **94 files / 1,028 tests**, fully clean on both the first and a repeated run (zero flakes).
- `pnpm --filter @workspace/ravish-trading run test` — **11 files / 94 tests**, all passing.
- `PORT=5000 BASE_PATH=/ pnpm run build` — all 3 packages (`api-server`, `ravish-trading`, `mockup-sandbox`) build successfully.

**Known pre-existing flake categories, encountered and disclosed at various points across the phase — none originating in Phase 3 code, each confirmed via `git status`/serial re-runs:**
- A `fetchedAt`-timing race in `fundamentals.investingUniverse.test.ts`/`value.test.ts` (Engine 1, pre-existing since Phase 2 Sprint 16).
- An `autoScheduler.multiUser.test.ts` FK-violation race under parallel execution (Phase 1 Sprint 8's own scheduler test, pre-existing).
- A `tenantIsolation.test.ts` `afterAll`-cleanup FK race under contention (first observed Phase 3 Sprint 33, confirmed via a serial re-run to be a live-Postgres-parallelism artifact, not a real failure).
- Occasional single unreproduced transient failures under elevated resource contention, each confirmed clean on a subsequent run.

Every protected file (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`, `autoExecutionLog` table/schema/write sites) was confirmed untouched via `git diff --stat` at the close of every single sprint in the phase — zero exceptions.

---

## 9. Documentation Updates

- `docs/Phase-3-Trading-Engine-Execution-Plan.md` — the authoritative execution plan, updated after every sprint with that sprint's as-built write-up, the roadmap table's status, and the top status line. Now marked **PHASE 3 COMPLETE**, with §25 Decision 7 (Live Market-Data Provider) marked **DEFERRED**.
- `CLAUDE.md` — updated after every sprint with that sprint's summary in §3 ("Current phase and sprint status"), now reflecting Phase 3's completion and pointing to this report and the Phase 4 plan.
- This document, `docs/Phase-3-Final-Completion-Report.md` — new, the closing record of Phase 3.
- `docs/Phase-4-Master-Execution-Plan.md` — new, produced alongside this report (see below).

No other planning document (`docs/DK-AI-OS-Architecture-Blueprint.md`, `docs/DK-Option-Engine-Technical-Audit.md`, `docs/Phase-1-Foundation-Execution-Plan.md`, `docs/Phase-2-Investing-Engine-Execution-Plan.md`) was modified during Phase 3 — each remains the accurate historical record of its own phase.

---

## 10. Commits Produced

All 20 Phase 3 sprint commits, in order, each a single commit ending with the established `Co-Authored-By`/`Claude-Session` trailer, all pushed to `claude/sprint-1-inspection-validation-o9mlsk`:

| Sprint | Commit | Summary |
|---|---|---|
| 32 | `9433630` | Market Data Foundation |
| 33 | `c68193f` | Market Structure Engine (Core) |
| 34 | `c4b819b` | Multi-Timeframe Trend Engine (Core) |
| 35 | `3d09eb5` | Order Flow and Liquidity Engine (Core) |
| 36 | `ac69fbf` | Market Regime Detection Engine (Core) |
| 37 | `e9bc1b5` | Probability Engine (Core) |
| 38 | `43f5dc1` | Risk Management Engine (Core) |
| 39 | `c86f145` | Trading Journal (Core + basic CRUD) |
| 40 | `097336b` | Market Structure Route + UI (first bounded backlog slice) |
| 41 | `b7c1681` | Multi-Timeframe Route + UI (second bounded backlog slice) |
| 42 | `91c33a3` | Market Regime Route + UI (third bounded backlog slice) |
| 43 | `859f83d` | Probability Route + UI (fourth bounded backlog slice) |
| 44 | `d0364d9` | Risk Management Route + UI + basic Trading Positions CRUD (fifth bounded backlog slice) |
| 45 | `e3f5841` | Liquidity Route + UI as an on-demand tab (sixth and final bounded backlog slice) |
| 46 | `4f84746` | Trading Journal Frontend UI (final Route+UI backlog item) |
| 47 | `3083e1c` | AI Trade Coach — Core + Route |
| 48 | `79eef09` | AI Trade Coach — Frontend UI (completes the module) |
| 49 | `9afc8f4` | Backtesting, Engine-2-native |
| 50 | `622d9c6` | Institutional Dashboard |
| 51 | `1f2f14e` | Trading Engine Unification (closing sprint) |

Plus this report's own documentation-update commit (marking the Live Market-Data Provider deferred and adding this report + the Phase 4 plan).

---

## 11. Remaining Technical Debt

Carried forward from the Phase 3 plan's own §26 Technical Debt Review (still accurate at Phase 3's close — none of these were introduced by Phase 3, and none were Phase 3 blockers):

- **CORS allowed-origin list** — still an open item on CLAUDE.md's outstanding-decisions list (§3, item #6). Worth closing before a future phase adds yet more routes to an already-open surface.
- **No rate-limiting/abuse protection** on any Express route (Technical Audit §10.4) — unchanged since the original audit; Phase 3 added 13 more unprotected routes. A dedicated rate-limiting sprint (middleware-level) is a reasonable candidate for early Phase 4, not bundled into any feature sprint.
- **`OPENAI_API_KEY` deprecation window** (CLAUDE.md §3, item #7) — the deprecated overload still works with a warning; the window itself was never formally closed.
- **`stock_analysis_history` per-user vs. shared cache** (CLAUDE.md §3, item #3) — still unresolved, Engine 1-scoped, not touched by Phase 3.
- **`marketBriefing.ts`/`dailyReport.ts` remain cross-engine-coupled** (serving Engine 3's Portfolio AI cockpit) — Phase 3 added the disclosed cross-reference comment between `tradingRegime.ts` and `marketBriefing.ts` (Sprint 36) to prevent confusion between the two regime-shaped things, but did not (and should not) merge them.
- **`coach.ts`'s 700+-line mixed content/math file** — not urgent; Engine 2's own coach content stayed small (`coachLLM.ts`'s Engine-2 additions are narration functions only, no large content library), so this didn't compound during Phase 3.
- **`autoExecutionLog`/`platform_audit_log` have no retention/archival policy** — both append-only, unchanged assessment, not urgent at current volumes.
- **Frontend bundle size** — `artifacts/ravish-trading`'s production build now emits a single ~1.5MB JS chunk (Vite's own 500kB warning threshold), a natural consequence of the growing single-page-app surface across 3 engines. Code-splitting (`build.rollupOptions.output.manualChunks` or route-level `dynamic import()`) is a reasonable Phase 4 housekeeping candidate, not a Phase 3 blocker — no user-facing symptom has been observed.
- **`artifacts/mockup-sandbox`'s fate is still undecided** (unchanged from the original Technical Audit) — cheap to resolve (archive or document), still open.

**Nothing new was introduced by Phase 3 itself** — direct inspection at each sprint's close found no duplicate logic, no dead code, no orphaned TODOs, consistent with the same review Phase 2's own close performed.

---

## 12. Deferred Optional Work

**Live Market-Data Provider (§25 Decision 7 of the Phase 3 plan) — explicitly deferred by the project owner.**

> "I am explicitly deferring the optional Live Market-Data Provider. Do not implement it at this time."

This is a confirmed decision, not an open question. Current state: `getMarketDataProvider(userId?)` always returns the `SimulatedMarketDataProvider` instance regardless of the `tradingDataProvider` setting's stored value — the exact one-call-away-from-real shape `getFundamentalsProvider()` (Engine 1) already established. No live candidate (`PolygonMarketDataProvider` or otherwise) has been built, budgeted, or scheduled. Real order-flow-grade data (Level 2 depth, trade-print tape) was flagged from Phase 3's own kickoff as likely a separate, paid, institutional-tier product even from an existing vendor relationship (Polygon) — genuinely out of scope for a SIMULATED-first phase.

This decision can be revisited at any time on a future explicit owner request; nothing about Phase 3's architecture blocks it — `MarketDataProvider` is a clean seam specifically designed to accept a live implementation without touching any downstream Engine 2 module.

---

## 13. Recommended Priorities for Phase 4

See `docs/Phase-4-Master-Execution-Plan.md` for the full plan. In summary, in recommended order:

1. **Options Income Engine enhancements** (Engine 3) — the lowest-risk starting point, since Engine 3's core is complete and proven; enhancements are additive, not foundational.
2. **Cross-engine consolidation opportunities** identified in the Phase 4 plan (see its own §"Consolidation Opportunities") — mostly documentation/discoverability work, low risk, high value.
3. **Institutional Investing Engine (Engine 1) enhancements**, if any further fundamental-analysis depth is wanted beyond Phase 2's already-complete 21-sprint build-out.
4. **Cross-cutting platform hardening** (rate-limiting, CORS finalization, bundle code-splitting) — candidates for either their own short sprint or folded into whichever engine-enhancement sprint touches the most routes.
5. **Live Market-Data Provider** — remains available to schedule the moment the project owner reopens §25 Decision 7; Phase 4 does not require it.

Full detail, sequencing, dependencies, and risk assessment are in the Phase 4 plan.

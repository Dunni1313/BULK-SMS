# Strategy Framework — Architecture

Phase 30. This document explains how the Institutional Strategy Framework
is built and why it is designed to be structurally incapable of shipping
or evaluating a named trading methodology.

## Design goal

Allow N future strategies (ICT, SMC, ASAD, Trader Bill, Tom Nash, the
Dunni Framework, or any user-authored methodology) to plug into the
existing Trading Engine — Market Structure, Liquidity & Session, Trade
Planning, Trading AI Coach, Trading Journal, Risk — **without any of
those modules being duplicated, forked, or strategy-specific.** Phase 30
builds the plug, not anything that plugs into it.

## Data model

Two new tables, both brand-new (`NOT NULL` from creation, no backfill):

- **`trading_strategies`** — one row per user-authored strategy.
  `userId` FK `ON DELETE RESTRICT` (the universal per-user-table
  convention). `category` is free text validated against a fixed,
  generic enum at the application layer (`trend`, `reversal`,
  `breakout`, `range`, `scalping`, `swing`, `position`, `other`) — never
  a named-methodology value. `timeframes` / `markets` /
  `requiredEvidence` / `checklist` / `references` are jsonb arrays.
  `checklist` stores the **template** shape
  (`{id, label, required}[]`) — a strategy's own checklist definition,
  not a live instance.
- **`trading_strategy_checklists`** — one row per checklist *instance*
  (e.g. "my Trend strategy's checklist for this AAPL trade").
  `strategyId` FK **`ON DELETE CASCADE`** to `trading_strategies.id` —
  deleting a strategy is a genuine parent/child relationship where the
  child checklist instances have no independent meaning once their
  parent strategy is gone, matching the existing
  `investing_holdings.portfolio_id → investing_portfolios.id`
  precedent (Phase 2). `userId` still FK `ON DELETE RESTRICT`
  independently, so the universal per-user protection is never weakened
  by the cascade. `items` jsonb stores the instantiated
  `{id, label, required, completed, notes, evidenceLinks}[]` — a
  snapshot copied from the strategy's template at instance-creation
  time, so editing a strategy's template later never silently mutates
  an already-in-progress checklist instance.

Migration: `lib/db/manual-migrations/032_trading_strategy_framework.sql`.

## Core library: `lib/tradingStrategyFramework.ts`

Pure, deterministic, no I/O. Six areas, each independently testable:

1. **Categories** — `StrategyCategory` union + label map. Fixed,
   generic, never extended per-methodology.
2. **Evidence** — `EvidenceSourceType` union (`structure`, `liquidity`,
   `session`, `risk`, `trade-plan`, `journal`, `coach`) +
   `buildEvidenceLink()`, a pure citation-packaging function
   (`{sourceType, label, detail, url}`). It never fetches or computes
   anything — the caller passes in an already-computed detail string
   and an optional symbol for the deep link.
3. **Checklist Engine** — `instantiateChecklistItems()` (template →
   fresh, all-incomplete instance items), `computeChecklistCompletion()`
   (pure derived stats: total/completed/required/requiredCompleted
   counts + percentage), `deriveChecklistStatus()`
   (`not_started` / `in_progress` / `complete` — "complete" requires
   every *required* item done; an empty checklist can never be
   "complete").
4. **Validation Framework** — `validateStrategyMetadata()` is
   **structural only**: non-empty name/description, a category from the
   fixed enum, unique checklist item ids, a parseable version string. It
   is explicitly proven (by test) to never flag a real methodology name
   like "My ICT-Inspired Setup" as invalid — validation checks that the
   metadata is *well-formed*, never that the methodology itself is
   sound.
5. **Learning projection** — `toStrategyLearningSummary()`, a pure
   mapping from a strategy row to the small summary shape the Learning
   Viewer displays (name, category, evidence count, checklist item
   count). No new content is generated.
6. Types shared by the routes and the Strategy Coach
   (`StrategyMetadata`, `StrategyChecklistInstance`,
   `StrategyEvidenceLink`, etc.).

## Strategy Coach — the 9th deterministic Trading Coach

`lib/tradingCoach.ts`'s existing `TradingCoachType` union gained one new
value, `"strategy"`, alongside the 8 coaches shipped in Phase 29
(Structure, Liquidity, Session, Risk, Trade Plan, Journal, Scenario, and
the general coach). `explainStrategyCoach(strategy, checklist)` composes
its explanation **purely from already-persisted data**: the strategy's
own metadata fields and `computeChecklistCompletion()`'s derived stats.
It never evaluates whether the strategy's rules are sound, never
fabricates a completion percentage, and its `commonMistakes` list
explicitly warns against treating checklist completion as a trading
signal — the same "explains, never predicts, never recommends" contract
every other Trading Coach in this codebase already honors.

**Routing note:** the new coach is exposed via a literal-path route,
`GET /trading/coach/strategy/:strategyId`, registered **before** the
existing generic `GET /trading/coach/:coach/:symbol` route in
`routes/tradingCoach.ts`. Both routes structurally match a 2-segment
path, so Express's first-match-wins ordering is what keeps
`/trading/coach/strategy/123` from ever falling through to the generic
symbol-scoped handler. Neither `SYMBOL_SCOPED_TRADING_COACHES` nor
`ACCOUNT_SCOPED_TRADING_COACHES` includes `"strategy"`, so the generic
route could never have served it correctly even if reached.

## Reporting integration

`lib/institutionalReporting.ts` gained a 12th `InstitutionalReportType`,
`strategy-framework-summary`, and `buildStrategyFrameworkSummaryReport()`
— three sections: an executive summary (strategy/checklist counts), the
strategy registry (name/category/version/evidence-required list per
strategy), and checklist instances (status + completion percentage per
instance). It reads already-persisted rows only; it computes no new
performance metric.

## Learning integration

`lib/learningPaths.ts` gained an 11th `LearningPath`,
`strategy-framework` (4 topics: overview, categories-and-evidence,
checklist-engine, coach). `glossaryCategory: "trading"` is reused, not a
new category. Three new glossary terms
(`trading-strategy-framework`, `strategy-checklist`,
`strategy-evidence-link`) were added to the existing glossary. Progress
tracking reuses the existing `learning_progress` persistence
unmodified — a Strategy Framework "viewed" event is just another
`itemType: "strategy"` row, keyed `strategy-framework:<strategyId>`.

## Route shape

Route shapes match data scope, the same convention every prior Trading
Engine module in this codebase follows:

| Route | Shape | Reason |
|---|---|---|
| `GET/POST /trading/strategies` | list/create | registry-wide |
| `GET/PATCH/DELETE /trading/strategies/:id` | CRUD | single strategy |
| `GET/POST /trading/strategies/:strategyId/checklists` | list/create | checklists under one strategy |
| `GET/PATCH/DELETE /trading/strategy-checklists/:id` | CRUD | single checklist instance |
| `GET /trading/coach/strategy/:strategyId` | coach | literal-path priority over the generic coach route |
| `GET /reporting/strategy-framework-summary` | report | registry + checklist rollup |

## Why no strategy content shipped this phase

The brief was explicit: this is an architecture/framework phase, not a
strategy-implementation phase. Every data model, validation rule, and
coach explanation above is built to be **content-agnostic** — a user
could register "ICT Order Blocks," "My Own Reversal Setup," or a
strategy with a single-word name, and the framework behaves identically
either way, because it never inspects a strategy's *name* or
*description* for meaning; it only inspects the *shape* of the metadata
(non-empty fields, valid category, well-formed checklist). This is a
deliberate architectural property, verified by a dedicated test
(`tradingStrategyFramework.test.ts`, the "never flags a real methodology
name as invalid" case, and `StrategyFramework.test.tsx`, the "never names
a real trading methodology" case).

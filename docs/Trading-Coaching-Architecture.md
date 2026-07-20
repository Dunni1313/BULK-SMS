# Trading Coaching Architecture (Phase 29)

This document records the full pre-implementation audit, the routing design decisions, and the corrections made during implementation for the Institutional Trading AI Coach.

## 1. The core architectural decision: deterministic, not LLM-narrated

Phase 29's own constraints are unusually strict: the Coach must **never** create a trading signal, predict price, recommend buying/selling, or invent a probability, and every explanation must include its source component, deterministic calculation, supporting data, and a link back to the originating panel — "no hidden reasoning."

The existing free-form Trading AI Coach (`routes/tradingCoach.ts`, Sprint 47/48) is LLM-narrated (`narrateTradeFreeform()`, `coachLLM.ts`) — it grounds its answer in real deterministic data and has a disclaimer/template-fallback contract, but an LLM's phrasing is not, by construction, a byte-for-byte guarantee against ever drifting into invented content on an open-ended question.

Rather than try to make the free-form path stricter, Phase 29 follows Phase 21's own already-proven answer to this exact problem for Engine 1: build a **second, purely deterministic** capability (`lib/tradingCoach.ts`) that never calls an LLM at all — every sentence is either a direct quote of an already-computed field, a plain relabeling, or a hand-authored, symbol-independent piece of static educational copy (`commonMistakes`, `institutionalPerspective`, `howToInterpret`). This satisfies "no hidden reasoning" and "never invents a probability" as a structural property of the code, not a prompt instruction. The free-form LLM path is left completely untouched, still available for genuinely open-ended questions the deterministic coaches don't cover.

## 2. Routing design

Three route shapes, chosen to match how each coach's underlying data is actually scoped, rather than forcing one artificial shape onto all 8:

- **`GET /trading/coach/:coach/:symbol`** — `structure`, `liquidity`, `session`, `risk`, `trade-plan`. All five are meaningfully per-symbol, and all five reuse the *exact same* composition chain the free-form coach's own `gatherUserContext()`/`buildProbabilityAnalysis()` calls already established — zero duplicate provider calls.
- **`GET /trading/coach/:coach`** — `journal`, `psychology`. Both are genuinely account-wide (a user's Trading Journal isn't scoped to one symbol), so forcing a `:symbol` segment onto these would have meant either ignoring it silently (a footgun) or fabricating a symbol-filtered journal view nobody asked for. Express registers both shapes safely — they never collide, since they differ in path-segment count.
- **`POST /trading/coach/scenario`** — the Scenario Coach needs a request body (2-5 candidate scenarios), not a path parameter, and reuses `computeScenarioComparison()` (Phase 28) directly rather than requiring the client to first call `/compare` and then re-POST the result.

## 3. Corrections made during implementation, disclosed

- **Glossary key collision.** The first draft of the new `"trading"` glossary section used the keys `position-sizing` and `capital-allocation` — both already existed as Engine 1 keys (`portfolio`/`value-investing` categories). `glossary.test.ts`'s own "every term has a unique key" test caught the collision immediately. Fixed by renaming the two Engine-2 entries to `trading-position-sizing`/`trading-capital-allocation` and updating every cross-reference in `glossary.ts`, `learningPaths.ts`, and `tradingCoach.ts` — never touching Engine 1's own two pre-existing entries.
- **`glossaryCategories()`/`CATEGORY_LABELS` hardcoded lists.** Two places — `lib/glossary.ts`'s own `glossaryCategories()` helper (backend) and `pages/learn/Glossary.tsx`'s `CATEGORY_LABELS` record (frontend) — independently hardcode the full category list rather than deriving it from the `GlossaryCategory` union type. Both needed a one-line addition for `"trading"`, caught by the existing test suite and a `tsc` type error respectively, not discovered by inspection ahead of time.
- **Ticker-shape test fixture.** An early draft of the "no trade plan exists yet" route test generated a random honest-empty-state symbol using a base36-encoded random string (e.g. `ZQ7F2A1`) — this failed `tradingMarketData.ts`'s own `^[A-Z]{1,5}(\.[A-Z])?$` ticker-shape regex (too long, contained digits), returning 404 instead of the expected 200. Fixed by generating a random 5-letter-only symbol instead.
- **Postgres resource exhaustion.** Encountered twice mid-session (`ECONNREFUSED 127.0.0.1:5432`); resolved via `sudo service postgresql restart` both times, per the brief's own anticipated procedure. Neither occurrence was a code regression — confirmed by immediately re-running the exact same test file successfully after the restart.

## 4. Confirmed zero-gap reuse (no new persistence, no new report type)

- `lib/learningProgress.ts`'s `"coach"` item type was already engine-agnostic before this phase — Trading Coach views are recorded with the identical mechanism Engine 1's coach already uses, just a different `itemKey` prefix.
- `lib/institutionalReporting.ts`'s `"ai-coach-summary"` report type reads generic `learning_progress` rows — it required zero code change to cover Engine 2's own coach usage, since it was never Engine-1-specific to begin with.
- No new database table was created — the audit confirmed `trading_trade_plans`, `trading_journal_entries`, and every Engine 2 analysis module already existed and needed only read-only reuse.

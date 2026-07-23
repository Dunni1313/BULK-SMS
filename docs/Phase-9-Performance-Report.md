# Phase 9 — Performance Report

Companion to `docs/Phase-9-Production-Readiness-Report.md`. Real measurements from a real production build (`PORT=5000 BASE_PATH=/ pnpm run build`) run in this session — not estimated.

---

## 1. Frontend bundle sizes (top chunks, raw byte size)

| Chunk | Size | Gzip | Note |
|---|---|---|---|
| `index-*.js` (main app shell + shared vendor code) | 480.43 kB | 148.50 kB | Largest chunk. Under Vite's 500 kB warning threshold, no warning printed, but has grown from an earlier-recorded 461.57 kB baseline (other thread's own history) |
| `generateCategoricalChart-*.js` (recharts) | 377.59 kB | 104.51 kB | Already its own separate, lazily-loaded chunk — recharts' own internal code-splitting, not something this project's build config controls directly |
| `markdown-*.js` | 158.35 kB | 48.02 kB | Markdown rendering (AI coach/narration output) — also already its own separate chunk |
| `StockResearch-*.js` | 69.20 kB | 13.12 kB | Largest individual page chunk |
| `PortfolioAI-*.js` | 36.83 kB | 9.85 kB | |

Every page in the app (`App.tsx`) already loads via `React.lazy()` + a dynamic `import()`, established in an earlier sprint (this project's own "Frontend Bundle Code-Splitting" work) — confirmed still in effect this phase; Phase 9 made no change to that mechanism.

**No chunk exceeds the 500 kB warning threshold** — the build completed with no size warning.

## 2. Backend bundle

`dist/index.mjs` is 5.9 MB (esbuild-bundled, all dependencies inlined into a single Node.js server file). This is expected and not a performance concern in the same sense as a frontend chunk — it's never sent to a browser, only loaded once by the Node.js process at server startup. Flagged here only for completeness, not as a defect.

## 3. Database query performance — before/after this phase

Three composite/single-column indexes were added, each targeting a query pattern confirmed by direct `grep` across every route/lib file in the codebase (not assumed):

| Index | Table | Query pattern it serves | Evidence |
|---|---|---|---|
| `journal_entries_trade_id_idx` | `journal_entries` | `WHERE trade_id = ?` (Trade History/Performance pages' linked-journal-entry lookup) | `tradeJournal.ts`'s `linkedJournalEntriesFor()` |
| `scanner_results_user_id_status_idx` | `scanner_results` | `WHERE user_id = ? AND status = 'active'` | `routes/scanner.ts`, lines 126/138 |
| `trades_user_id_status_idx` | `trades` | `WHERE user_id = ? AND status = ?` — confirmed as the single most common query shape against this table, appearing in `routes/ai.ts`, `routes/portfolio.ts`, `routes/trades.ts`, `autoAdjustment.ts`, `autoExecution.ts`, `brokerReconciliation.ts`, `dailyReport.ts`, `execution.ts`, `orderPreview.ts`, `positionSizing.ts`, `serverState.ts`, `tradeAdjustmentPreview.ts`, `tradeJournal.ts` — ~15 call sites | direct `grep` count, this session |

All three were applied against a real Postgres database (the local `dkos_test`/`dkos_dev` instances used for this session's own validation) and verified present via `pg_indexes` before the test suite was re-run — not just written and assumed correct.

Every existing query these serve returns **exactly the same rows** as before — this is purely an access-path change (index scan vs. sequential scan / index-then-filter), never a behavior change.

## 4. Database connection pool

Before Phase 9, `pg.Pool` had zero explicit configuration — every route and background job shared one pool falling back silently to library defaults (10 max connections, no idle timeout, no connection-acquisition timeout, no statement timeout). An unbounded query or a burst of concurrent requests could hold connections open indefinitely.

Now: `max` (10), `idleTimeoutMillis` (30s), `connectionTimeoutMillis` (10s), and `statement_timeout` (30s) are all explicit, named, and environment-overridable (`DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`, `DB_STATEMENT_TIMEOUT_MS`). These are conservative, disclosed starting defaults — not a claim about the "correct" value for any specific deployment's real traffic, which nothing in this codebase has measured yet.

## 5. Backend micro-optimization: `ensureSeedTrades()`

Previously issued 3 sequential single-row `INSERT` statements (3 round-trips to the database) when seeding a brand-new user's demo positions. Now issues 1 multi-row `INSERT` (1 round-trip). Output is byte-identical — same 3 rows inserted, same values, only the round-trip count changed. This runs once per user, on first access, so the real-world performance impact is small but genuine and free.

## 6. Frontend React Query tuning

`App.tsx`'s `QueryClient` previously had `refetchOnWindowFocus: false, retry: false` with an implicit `staleTime: 0` (React Query's own default) — meaning every remount of a component using an already-fetched query triggered an immediate, redundant network refetch. Now `staleTime: 15_000` / `gcTime: 5 * 60_000` are set as a default floor; any page needing tighter freshness (e.g. `NotificationBell`'s own 20s poll) already overrides this per-query and is unaffected.

## 7. Recommendations for a future performance-focused sprint

- Investigate whether recharts' `generateCategoricalChart` chunk (377.59 kB) can be reduced — e.g. importing only the specific chart primitives each page actually uses rather than the shared bundle, if recharts' own export surface allows it.
- Re-measure the main `index` chunk's growth trend over the next few sprints; if it crosses 500 kB, revisit what's landing in the shared/vendor chunk vs. what could be pushed into a page-specific lazy chunk.
- Add real query-timing instrumentation (e.g. slow-query logging above a threshold) rather than relying on manual `grep`-based query-pattern audits for future indexing decisions.
- No load testing was performed this phase (out of scope — Phase 9 was explicitly a code-hardening pass, not an infrastructure-capacity pass).

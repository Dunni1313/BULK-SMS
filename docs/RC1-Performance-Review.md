# Version 1 Release Candidate (RC1) — Performance Review

Step 3 of the RC1 hardening pass. Builds on `docs/Phase-9-Performance-Report.md`
(the platform's first real measurement pass, taken much earlier in this
thread's history at ~160 backend test files) with fresh, current
measurements at Phase 44's actual size — real numbers from a real
production build, not estimated.

## 1. Frontend bundle size (current, real measurement)

From `PORT=5000 BASE_PATH=/ pnpm run build`, run in this session:

| Chunk | Size | Gzip | Note |
|---|---|---|---|
| `index-*.js` (shared vendor + app shell) | 559.61 kB | 162.61 kB | Largest chunk. Over Vite's 500 kB warning threshold (the build prints the warning). Grown from Phase 9's own recorded 480.43 kB baseline. |
| `generateCategoricalChart-*.js` (recharts) | 377.62 kB | 104.52 kB | Already its own separate, lazily-loaded chunk. |
| `markdown-*.js` | 158.35 kB | 48.02 kB | AI coach/narration rendering, already its own separate chunk. |
| `StockResearch-*.js` | 76.27 kB | 14.68 kB | Largest individual page chunk. |
| `PortfolioAI-*.js` | 36.75 kB | 9.81 kB | |

**Trend, consistent with what Phase 9 already flagged as "a trend to
watch, not an immediate defect":** the main chunk has grown from 480.43 kB
(Phase 9) to 559.61 kB now, reflecting 34 additional phases of genuine
feature work (the entire Investing, Trading Structure/Regime/Liquidity/
Probability/Risk, Portfolio Workspace, Watchlists, and Reporting surfaces
were all built since Phase 9). This is expected growth for a platform that
has roughly tripled in page count since that measurement, not a
regression introduced by any single change.

## 2. Code-splitting / lazy loading

Already fully adopted, confirmed by direct count: `App.tsx` contains 86
`lazy(() => import(...))` calls covering all 74 pages plus a handful of
heavier sub-components. No page is statically imported into the main
bundle. `recharts`' own internal chart-rendering module
(`generateCategoricalChart`) and the markdown renderer are both already
separate, independently-loaded chunks — Rollup's own automatic
shared-dependency extraction, not a manual configuration this project
maintains.

**No further code-splitting was applied this phase.** Splitting the
remaining 559.61 kB shared vendor chunk further (via `manualChunks`) is
the kind of change that carries real regression risk — module-resolution
issues from an incorrect chunk boundary are subtle and easy to miss in
testing — for a benefit ("under 500 kB" vs. "just over") that doesn't meet
the bar this RC1 pass's own "only implement deterministic improvements"
instruction sets. Flagged as a known item in `docs/Known-Limitations.md`,
matching Phase 9's own precedent of disclosing rather than attempting a
risky fix under hardening-pass constraints.

## 3. React rendering

- `useMemo`/`useCallback`: 90 usages across `pages/*.tsx`, applied where
  a page performs a genuine derived computation from fetched data (e.g.
  aggregating a dashboard's own arrays for a chart) — not blanket-applied
  everywhere, consistent with not memoizing values cheap enough that
  memoization itself costs more than the recomputation.
- `React.memo`: 1 usage. Given this platform's component architecture —
  one top-level page component per route, rendered once per navigation,
  not a deeply nested list of thousands of frequently-re-rendering rows —
  `React.memo` has genuinely low ROI here; the places where it would
  matter (e.g. a large scrollable table row) were checked and found to
  already avoid unnecessary re-renders via `useMemo`-derived row data
  rather than needing a `memo`-wrapped row component.
- No component was found doing an obviously wasteful re-render (e.g. an
  inline object/array literal passed as a prop to a component that itself
  does expensive work per render) during the spot checks performed for
  this review.

## 4. Repeated queries / duplicate calculations

No new duplicate-calculation pattern was found. This project's own
established discipline — every composition-layer module (Decision
Support, Risk & Exposure, Performance & Attribution, Portfolio Workspace,
and every engine since) explicitly documents in its own header comment
which prior module's output it reuses "verbatim, never recomputed" — makes
this easy to verify by inspection rather than needing a runtime profiler:
every `buildXDashboard()` composition function reads other modules'
already-computed output, never re-derives the same figure twice within one
request.

## 5. Database queries

- Every user-scoped query filters by `userId` in the query itself (see
  `docs/RC1-Security-Review.md` §2), which also means every such query is
  covered by the `(user_id)` or `(user_id, ...)` indexes already added
  across this project's phase history — no new missing index was found.
- `auto_execution_log` remains unindexed beyond its primary key — this is
  the exact, already-disclosed item from `Phase-9-Technical-Debt-Report.md`,
  left untouched because CLAUDE.md rule 3 explicitly forbids modifying
  this table "as part of general audit-log work." Still correctly
  untouched this phase.
- No N+1 query pattern was found in any of the composition-layer modules
  reviewed — each resolves its own dependencies via a single batched
  `Promise.all([...])` of already-scoped, already-indexed queries (the
  established pattern since `lib/decisionSupportEngine.ts`, Phase 40).

## 6. OpenAPI usage

Every backend route's request/response is validated through the same
generated Zod schema pair (`api-zod`) both server- and client-side, with
no route found bypassing this contract. No inconsistency was found between
`openapi.yaml`'s documented shape and what a route actually returns for
any of the routes spot-checked during this review.

## Summary

No performance regression was found. The one real, measurable finding
(bundle size crossing the 500 kB advisory threshold) is disclosed, not
silently fixed, since a safe fix would require a genuinely new
manual-chunking strategy that carries more regression risk than benefit
for a hardening-only pass — consistent with Phase 9's own handling of the
same trend at an earlier point in its growth.

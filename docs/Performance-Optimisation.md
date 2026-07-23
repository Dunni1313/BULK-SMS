# Performance Optimisation — Institutional Investing Engine

**Phase 23 — Executive Dashboard & Production Readiness.** Performance audit across React rendering, memoisation, bundle size, code splitting, and query caching for the Institutional Investing Engine pages.

---

## 1. Code splitting / lazy loading

Every page in scope is already route-level lazy-loaded (`React.lazy(() => import("./pages/X"))`) — this convention was established platform-wide in an earlier sprint and has been followed for every phase since, including the new `ExecutiveDashboard.tsx` added this phase. Confirmed via `App.tsx`: no page component in this engine is statically imported.

## 2. Bundle size

Current production build (`PORT=5000 BASE_PATH=/ pnpm run build`):

| Chunk | Size (min) | Size (gzip) |
|---|---|---|
| `index-*.js` (main/shared chunk) | 510.13 kB | 154.27 kB |
| `generateCategoricalChart-*.js` (recharts, shared) | 377.59 kB | 104.51 kB |
| `markdown-*.js` (shared) | 158.35 kB | 48.02 kB |
| `StockResearch-*.js` (largest page-specific chunk) | 76.31 kB | 14.71 kB |
| `ExecutiveDashboard-*.js` (this phase's new page) | 10.72 kB | 2.75 kB |

**The 500 kB main-chunk warning is a pre-existing, previously-disclosed condition** (first flagged around Phases 18–19, well before this phase began) — it is not something this phase introduced or grew meaningfully (main chunk moved from ~509.3 kB to 510.1 kB, entirely attributable to the small amount of shared code the new Executive Dashboard route pulls in, not a regression this phase caused). Fixing it properly means either a `manualChunks` split of the main bundle or trimming a genuinely large shared dependency (`recharts`, `react-markdown`) — both are cross-engine changes with cross-engine regression risk, judged out of scope for "identify only genuine improvements" within a single-engine consolidation phase. Documented here as a known, unresolved item, not silently ignored.

Every other page-specific chunk in the engine is well under the threshold — `ExecutiveDashboard.tsx` itself, despite adding 11 panels' worth of hooks, compiles to a 10.72 kB chunk, confirming that lazy-loading plus reuse of already-shipped hooks/components (rather than new heavy dependencies) keeps new pages cheap.

## 3. React rendering / memoisation

Two genuine unmemoised-derived-value issues were found and fixed:

| File | Issue | Fix |
|---|---|---|
| `PortfolioOptimisation.tsx` | `heldSymbolSet` (a `Set` built from `optimisation?.positionQualityRanking`) was reconstructed on every render | Wrapped in `useMemo`, keyed on `optimisation?.positionQualityRanking` |
| `StockResearch.tsx` | `watchedSymbols` (a `Set` built from the watchlist) had the same issue | Wrapped in `useMemo`, keyed on `watchlist` |

No other genuine unmemoised-derivation issue was found across the 13 audited pages — most pages either derive from already-memoised query results directly in JSX (cheap, no allocation to memoise) or don't build a new collection from query data at all.

## 4. Query caching / duplicate network requests

`InstitutionalWorkspace.tsx` has 4 sub-components each independently calling `useGetValueWatchlist()`/`useGetPortfolios()`/`useListNotifications()`. **This was investigated and confirmed not to be a real performance problem**: TanStack Query dedupes by query key — every one of those calls shares one cache entry and results in exactly one network request per unique key, regardless of how many components subscribe to it. This is normal, idiomatic React Query composition. A prop-lifting refactor was considered and rejected: it would touch 4 sub-components' signatures for zero measurable network-request reduction. See `docs/Production-Readiness.md` §1.6 for the full reasoning.

No other duplicate-fetch pattern (a hand-rolled `useQuery` re-implementing an already-generated hook) was found beyond the one already fixed in `OpportunityDiscovery.tsx` (see `docs/Production-Readiness.md` §1.1).

## 5. Large tables

`OpportunityDiscovery.tsx`'s ranking table and `PortfolioOptimisation.tsx`'s candidate tables render directly from already-paginated/bounded API responses (the scanner and optimisation engines cap their own result counts server-side) — no client-side virtualization was judged necessary, since no table in this engine renders an unbounded row count.

## 6. Summary

| Area | Status |
|---|---|
| Route-level code splitting | Already in place for every page, including the new Executive Dashboard |
| Bundle size | One pre-existing, disclosed, unresolved warning (main chunk); not grown by this phase |
| Memoisation | 2 real gaps found and fixed |
| Query caching | Reviewed; no real duplicate-request issue found |
| Large tables | Reviewed; server-side bounding already sufficient |

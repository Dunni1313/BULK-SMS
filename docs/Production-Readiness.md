# Production Readiness — Institutional Investing Engine

**Phase 23 — Executive Dashboard & Production Readiness.** A consolidation, optimisation, and production-hardening pass across every Institutional Investing Engine page built in Phases 12–22. No new valuation models, scoring systems, or recommendations were introduced. This document records the audit performed, what was fixed, and what was reviewed and deliberately left unchanged, with reasoning.

**Scope note:** "Institutional Investing Engine" here means `StockResearch.tsx`, `ResearchTerminal.tsx`, `InstitutionalWorkspace.tsx`, `DecisionEngine.tsx`, `InvestmentCommitteeWorkbench.tsx`, `PortfolioConstruction.tsx`, `PortfolioOptimisation.tsx`, `OpportunityDiscovery.tsx`, `MonitoringDashboard.tsx`, `InstitutionalAICoach.tsx`, `ReportingCentre.tsx`, `StockScanner.tsx`, and `ValueInvestingSchool.tsx`. `PortfolioAnalyst.tsx`, `InstitutionalIntelligence.tsx`, and `InstitutionalMentor.tsx` were confirmed, via their own header comments, to be Options Income Engine (Engine 3) pages despite similar naming, and were excluded from this pass.

---

## 1. Audit findings and fixes

### 1.1 Duplicated code (fixed)

| Duplication | Found in | Fix |
|---|---|---|
| `recommendationBadgeClass()` | `ResearchTerminal.tsx`, `DecisionEngine.tsx`, `InvestmentCommitteeWorkbench.tsx`, `OpportunityDiscovery.tsx` (4 copies) | Extracted to `src/lib/investing-format.ts`, all 4 call sites updated |
| `checklistBadgeClass()` | `ResearchTerminal.tsx`, `DecisionEngine.tsx`, `InvestmentCommitteeWorkbench.tsx` (3 copies) | Extracted to `src/lib/investing-format.ts` |
| `fmtUsd()` | `StockResearch.tsx`, `PortfolioConstruction.tsx` (2 copies) | Extracted to `src/lib/investing-format.ts` |
| `fmtPct()` | `ResearchTerminal.tsx`, `OpportunityDiscovery.tsx`, `PortfolioConstruction.tsx` (3 divergent copies — one used `"—"` for null, others `"n/a"`, one wasn't null-safe at all) | Standardized on the fraction-based, null-safe, `"n/a"`-returning version in `src/lib/investing-format.ts`. `DecisionEngine.tsx`'s own `fmtPct` was dead code (never called) — deleted outright, not migrated. |
| `useInstitutionalDecision()` / `useInvestmentMemo()` | `DecisionEngine.tsx`, `InvestmentCommitteeWorkbench.tsx`, `ResearchTerminal.tsx` (3 near-identical copies of the Orval `?portfolioId=`-override workaround) | Extracted to `src/hooks/use-institutional-decision.ts`. `ResearchTerminal.tsx`'s own copy always made a raw `fetch()` even without a `portfolioId`; standardizing on the other two pages' generated-function-reusing variant is a disclosed, behavior-preserving simplification for that one page. |
| Hand-rolled compare-fetch in `OpportunityDiscovery.tsx` | A raw `useQuery` + `fetch("/api/opportunity-discovery/compare?...")`, duplicating logic the generated `useCompareOpportunitiesRoute` hook (already used by `PortfolioOptimisation.tsx`) already provides | Replaced with `useCompareOpportunitiesRoute` directly |

### 1.2 Silent error states (fixed)

`PortfolioOptimisation.tsx` had 4 data hooks (`useGetPortfolios`, `useGetPortfolioOptimisation`, `useGetOptimisationReviews`, `useCompareOpportunitiesRoute`) with **zero error handling** — a failed fetch left the page showing an infinite loading skeleton (for the main optimisation panel) or silently fell through to an unrelated "empty" message (for reviews/comparison), never telling the user anything actually failed. Fixed: each hook's `isError` is now read and rendered as an honest, distinct error message, never confused with the equally-honest "no data yet" empty state.

`OpportunityDiscovery.tsx`'s comparison query had the same gap (`compareQuery.data &&` with no loading/error branch at all) — fixed the same way, plus added the missing loading skeleton.

### 1.3 Accessibility (fixed)

Icon-only buttons with no accessible name (a `title` attribute is not reliably announced by screen readers):

- `ReportingCentre.tsx` — presentation prev/next slide buttons, delete-saved-report button
- `MonitoringDashboard.tsx` — delete-note button
- `StockResearch.tsx` — refresh-universe button (had `title` only, no `aria-label`)

All 5 now carry a descriptive `aria-label`. Every other icon-only button audited across the 13 pages already had one (an established convention since Phase 19–22).

### 1.4 Layout inconsistency (fixed)

`OpportunityDiscovery.tsx`'s page header diverged from the majority pattern used by every other "regular page" in the engine (icon inside the `<h1>`, description before the permanent-labels badge row). It instead wrapped the icon in a separate `<div>` beside the `<h1>` and put the badges before the description. Restructured to match the majority pattern — **no `data-testid` was renamed**, so the fix is purely visual/structural.

`ResearchTerminal.tsx` and `InstitutionalWorkspace.tsx` use a visibly different header (`text-xl`, no description paragraph, full-height `-m-6` toolbar layout) — reviewed and confirmed **intentional**: both are dense, full-screen "terminal/workspace" surfaces, a deliberately different design language from the 11 other "regular" pages, not accidental drift. Left unchanged.

### 1.5 Performance (fixed)

- `PortfolioOptimisation.tsx`: `heldSymbolSet` (a `Set` built from `optimisation?.positionQualityRanking`) was rebuilt on every render — wrapped in `useMemo`.
- `StockResearch.tsx`: `watchedSymbols` (a `Set` built from the watchlist) had the same issue — wrapped in `useMemo`.

### 1.6 Reviewed, deliberately not changed

- **Symbol-search input consolidation.** 6 pages each have their own symbol-search input, but they fall into two genuinely different interaction patterns: `ResearchTerminal.tsx`/`InstitutionalWorkspace.tsx` use a `ref`-driven, keyboard-shortcut-focusable input feeding a multi-symbol compare/split workflow; `DecisionEngine.tsx`/`InvestmentCommitteeWorkbench.tsx`/`InstitutionalAICoach.tsx`/`ReportingCentre.tsx` use a plain input plus a page-specific primary-action button. Forcing these into one shared component would mean re-wiring `ref`-based focus behavior and 4 different submit semantics for a purely cosmetic gain, at real regression risk against passing tests. Reviewed, not consolidated.
- **`InstitutionalWorkspace.tsx`'s duplicated `useGetValueWatchlist`/`useGetPortfolios`/`useListNotifications` calls** across its 4 sidebar sub-components. TanStack Query dedupes by query key automatically — every sub-component subscribing to the same hook shares one cache entry and triggers exactly one network request, regardless of how many components call it. This is idiomatic React Query composition, not a performance bug; a prop-lifting refactor across 4 sub-components was judged not worth the restructuring risk for a change with zero measurable network-request benefit.

## 2. Loading / empty / error state conventions (now consistent)

Every page in scope follows, or was brought into line with, this contract per data hook:

| State | Convention |
|---|---|
| Loading | `<Skeleton>` sized to the eventual content's shape |
| Error (`isError`) | A short, honest `text-rose-400` message, distinct from the empty-state message, never a fabricated/blank render |
| Empty (loaded, zero items) | A muted, honest message naming what's missing, never conflated with the error message |
| Populated | The real data, rendered |

## 3. Not touched

No valuation model, scoring formula, or investment recommendation logic was modified anywhere in this phase. No backend route, database table, or `openapi.yaml` schema was added or changed except the Executive Dashboard's own consumption of already-existing endpoints (see `docs/Executive-Dashboard.md`).

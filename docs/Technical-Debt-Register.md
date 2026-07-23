# Technical Debt Register

Produced by the Documentation Synchronization pass (branch
`docs/repository-baseline-sync`). Scope: items verified directly during
this pass's own read-only audit (git history inspection, file-listing
inspection, direct reads of existing docs) — **nothing here is
speculative.** `docs/Known-Limitations.md` (v1.0.0) already documents 12
disclosed scope boundaries (live-provider verification, notification
channels, CSP header, bundle size, two pre-`Card`-convention pages, no
container artifact, `REQUIRE_AUTH` default, the two housekeeping items,
E2E coverage depth) — those are not repeated here in full; only items this
pass found beyond that list, or updates to items that changed since
v1.0.0, are recorded below.

## 1. Documentation debt

- **`CLAUDE.md` went unedited from the v1.0.0 freeze commit (`dc2a126`)
  through the entire v1.1.0 release** (confirmed via
  `git log dc2a126..HEAD -- CLAUDE.md`, empty prior to this branch) despite
  36 phases of Phase 9–44 work, the Alpaca Paper Trading Expansion, "Phase
  8," and the v1.1.0 sidebar redesign all having shipped without a
  corresponding entry. **Status: resolved by this pass** (`CLAUDE.md`
  §3a–§3e). **Recurrence risk**: nothing in the repository enforces that a
  shipped feature gets a `CLAUDE.md` entry — this is a process discipline,
  not a tooling gate. No lint/CI check exists for this and none was added
  by this pass (documentation-only scope, per this task's own
  instruction not to add tooling).
- **`PortfolioConstruction.tsx`'s Timeline tab (Phase 13) is under-
  documented.** `docs/Institutional-Portfolio-Manager.md` names it as one
  of 10 tabs but gives it none of the depth given to Quality/Risk/
  Performance. Tracked as a v1.2 roadmap item
  (`docs/Repository-Roadmap.md` §Current development, item 2).

## 2. Naming collisions (confirmed real, not code duplication)

Each pair below is two genuinely separate modules/pages with overlapping
or confusingly similar names — verified by reading both modules' own
import lists and confirming neither imports the other. None of these
represent duplicated business logic; the risk is purely a reader/future-
contributor confusing the two.

- **"Institutional Trading AI Coach"** (`lib/tradingCoach.ts` +
  `pages/TradingAICoach.tsx`, Phase 29) **vs. "AI Trade Coach"**
  (`coachLLM.ts`'s `narrateTradeFreeform()` + `routes/tradingCoach.ts`'s
  original `/ask` endpoint, Phase 3 Sprint 47–48). Two separate coach
  surfaces for Engine 2, built ~1 month apart, sharing the word "Trading"
  and "Coach" but not the same route file's original purpose (Phase 29
  reuses the filename `routes/tradingCoach.ts` for its own new endpoints
  alongside the Sprint 47 ones already there).
- **"Cross-Engine Workspace"** (`lib/crossEngineWorkspace.ts` +
  `pages/CrossEngineWorkspace.tsx`, Phase 34) **vs. "Cross-Engine Command
  Center"** (`InstitutionalDashboard.tsx`, Phase 4 Sprint 54). Both
  surface Engine 1 + Engine 2 (+ Engine 3, for the newer one) output on
  one screen; they are separate pages with separate code, not a
  duplicate build of the same feature — but a new contributor asked "where
  is the cross-engine view" would reasonably need pointing to both.
- **"Institutional Performance & Attribution Engine"**
  (`lib/performanceAttribution.ts`, Phase 38, real portfolio data) **vs.**
  the pre-existing **`performanceAnalytics.ts`** (from the Alpaca
  Expansion wave's Trade Performance page, §3b — synthetic/client-side
  analytics). Different data sources, different consumers, same general
  subject area.
- **"Institutional Scenario & Stress Testing Engine"**
  (`lib/scenarioEngine.ts`, Phase 39) **vs.** the pre-existing
  **`portfolioStressTest.ts`** (Alpaca Expansion wave, §3b). Phase 39's own
  commit message describes it as report-integrated and distinct from, not
  a replacement for, the earlier stress-test module.

**Recommendation**: no action required for Version 1 — none of these
collisions affects runtime correctness. If a future phase touches any of
these areas, consider a doc-comment cross-reference at the top of each
file (the same pattern `tradingRegime.ts` used in Phase 3 Sprint 36 to
disambiguate itself from `marketBriefing.ts`) rather than a rename or
merge, to avoid the regression risk of touching working code purely for
naming clarity.

## 3. Future refactoring opportunity: repeated Coach+Learning composition pattern

Phases 37 through 44 (8 phases) each independently created their own
`lib/<domain>Engine.ts` + `lib/<domain>Coach.ts` + `lib/<domain>Learning.ts`
triplet (`riskExposureCoach.ts`/`riskExposureLearning.ts`,
`performanceAttributionCoach.ts`/`...Learning.ts`, `scenarioCoach.ts`/
`scenarioLearning.ts`, `decisionSupportCoach.ts`/`...Learning.ts`,
`rebalancingCoach.ts`/`...Learning.ts`, `complianceCoach.ts`/
`...Learning.ts`, `watchlistsCoach.ts`/`...Learning.ts`,
`workspaceCoach.ts`/`...Learning.ts`), plus `optionsLifecycleCoach.ts`/
`optionsLifecycleLearning.ts` from Phase 36 — 9 near-identical
Coach+Learning pairs in total, confirmed by direct file-listing inspection
during this pass, each following the same shape without a shared base
abstraction the way Phase 2's Investment Quality Engine became explicit
shared infrastructure for Graham/Buffett/Tom Nash/the Committee.

**This is a genuine, verified duplication-of-shape (not necessarily of
logic — each domain's own coach content differs) worth a future
consolidation pass**, extracting a shared "deterministic domain coach"
composition helper once a clear common interface is confirmed across all
9 — following this project's own established "extract on the second real
caller, not preemptively" convention, which arguably should have applied
by the 3rd or 4th of these 9. Not fixed by this pass (documentation-only
scope; refactoring 9 files is implementation work requiring its own
approved sprint).

## 4. Data-source / bundle-size items updated since v1.0.0

- **Frontend main bundle chunk**: `docs/Known-Limitations.md` #6 recorded
  559.61 kB at v1.0.0. The v1.1.0-era developer package's own
  `docs/Troubleshooting-Guide.md` (read directly during this pass) records
  **571.15 kB as of v1.1.0** — the sidebar redesign's `AppLayout` grew
  slightly, still eagerly loaded on every page. Still advisory-only (Vite
  warns, does not fail the build). The same disclosed remediation
  (`manualChunks` vendor-splitting) remains open and unscheduled.
- Every data-source limitation in `docs/Known-Limitations.md` §1–2 (live
  FMP/Alpha Vantage, live Alpaca broker) remains unchanged and unresolved
  as of v1.1.0 — no new credentials became available at any point during
  the Phase 9–44 buildout or the v1.0.0/v1.1.0 releases. Re-confirmed, not
  newly discovered, by this pass.

## 5. Items explicitly NOT included here (already resolved, not re-litigated)

- `ravish-trading-engine.zip` and `artifacts/mockup-sandbox` — both have
  an explicit, recorded project-owner decision (kept, documented) per
  `CLAUDE.md`'s Sprint 65 entry and `Known-Limitations.md` #10–11. Not
  re-opened by this pass.
- `uuid` vs. `serial` for `users.id`, the `OPENAI_API_KEY` legacy fallback
  — both explicitly resolved (kept as-is, indefinitely) per `CLAUDE.md`'s
  "Outstanding owner decisions" list. Not re-opened.

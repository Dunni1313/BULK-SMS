# Version 1 Release Candidate (RC1) — Repository Audit

Produced at the start of the RC1 hardening phase, per the project owner's
own explicit instruction: "the goal is NOT to build new functionality...
only production hardening, quality improvements, consistency,
documentation and release preparation." This document is Step 1 of that
instruction — presented before any change beyond the one fix disclosed in
§7 below.

**Context this audit builds on, not duplicates.** This repository already
went through two earlier hardening passes in this same development
thread, both still valid and referenced rather than repeated here:

- **Phase 9 — Production Hardening** (`docs/Phase-9-Production-Readiness-Report.md`,
  `Phase-9-Security-Review.md`, `Phase-9-Performance-Report.md`,
  `Phase-9-Technical-Debt-Report.md`, `Phase-9-Deployment-Checklist.md`,
  `Phase-9-Release-Checklist.md`) — added security response headers,
  global error handling, uncaught-exception handlers, removed 27 confirmed-
  dead component files, and recorded a technical-debt list.
- **Phase 10 — UI Standards** (`docs/UI-Standards.md`) — formalized the
  spacing/typography/card/badge/loading/empty-state conventions that were
  already the dominant pattern across the platform's pages at that point.

Those two phases happened relatively early in this thread (around ~160
backend test files). This audit re-runs the same categories of check
**fresh, at the platform's current size** (Phase 44, 242 backend test
files / 94 frontend test files / 55 database tables / 73 backend routes /
74 frontend pages), to confirm nothing has drifted since, and to surface
anything genuinely new.

---

## 1. Unfinished work, TODOs, FIXMEs, dead code

| Check | Method | Result |
|---|---|---|
| `TODO`/`FIXME`/`XXX:`/`HACK:` markers | `grep -rEn` across all non-generated, non-test `.ts`/`.tsx` source in `artifacts/api-server/src`, `artifacts/ravish-trading/src`, `lib/` | **Zero matches.** |
| Leftover `console.log(...)` debug statements | Same scope, excluding `logger.ts` and `scripts/` | **Zero matches.** |
| `debugger;` statements | Same scope | **Zero matches.** |
| Circular dependencies (backend) | `npx madge --circular` against `artifacts/api-server/src/index.ts` | **One found and fixed** — see §7. Re-verified clean after the fix. |
| Circular dependencies (frontend) | `npx madge --circular` against `artifacts/ravish-trading/src/App.tsx` | **Zero.** |

Conclusion: no unfinished-work markers exist anywhere in application source. This is a direct, expected consequence of every phase across this project's history disclosing deviations and deferrals explicitly in its own completion report and in `CLAUDE.md`, rather than leaving a `TODO` in the code — the "disclose, don't silently fix or silently skip" discipline established since early in this thread.

## 2. Duplicated code

No new duplication was found beyond what's already disclosed in `Phase-9-Technical-Debt-Report.md`. The project's own established pattern — extracting a shared pure function on the *second* real caller (`classifyMarginOfSafety()`, `classifyAgreementSignal<T>()`, `computeWatchlistTargets()`, and dozens more named in `CLAUDE.md`'s own phase history) rather than pre-emptively — has kept genuine duplication low. The one real structural issue found (a type-only circular import between two files that both legitimately need related types) is fixed in §7, not left as duplication.

## 3. Unused API endpoints

All 73 backend route files are registered and reachable:

- 71 of 73 are imported and mounted by `routes/index.ts`.
- The remaining 2 (`routes/health.ts`, `routes/auth.ts`) are mounted directly in `app.ts` instead, by design — health must stay reachable even when auth middleware is active, and auth mounts Better-Auth's own handler tree, which doesn't go through the shared business-route pipeline. This is the established, documented pattern, not an oversight.

No route file was found with zero references to it from `routes/index.ts` or `app.ts`.

## 4. Unused database tables

All 55 exported `*Table` schema objects in `lib/db/src/schema/` are referenced somewhere in application code outside their own schema file, with one apparent exception investigated directly: `verificationsTable`. It has no direct import in `artifacts/api-server/src` or `lib/db/src/*.ts` query code — but it **is** wired into Better-Auth's own schema mapping (`lib/auth/src/index.ts`: `verifications: verificationsTable`) and Better-Auth's Drizzle adapter reads/writes it internally through that registration, not through a hand-written query. Confirmed in use, not dead.

## 5. Unused frontend components / orphaned pages

All 74 page files in `artifacts/ravish-trading/src/pages/` are reachable from `App.tsx`'s route table — 73 via the literal `./pages/<Name>` lazy-import path, and `not-found.tsx` via the `@/pages/not-found` alias form (missed by a naive grep, confirmed present on inspection).

Phase 9 already removed 27 confirmed-dead component files at that point in the project's history; no new orphaned component was found during this audit.

## 6. Inconsistent naming, styling, navigation, report layouts, AI Coach / Learning topics

- **Naming:** route files, page files, and `lib/` modules consistently follow the established `camelCase.ts` (backend) / `PascalCase.tsx` (frontend pages) conventions throughout, with no exceptions found.
- **Styling:** adoption of the shared `components/ui/card`, `components/ui/skeleton`, and `components/ui/badge` primitives (the backbone of `UI-Standards.md`'s own conventions) is near-universal: 75 of 77 non-test page files import `Card`, 74 of 77 use a `Skeleton` loading state.
  - The 2 pages without `Card`: `Dashboard.tsx` and `PortfolioAI.tsx` — both among the oldest pages in the codebase (the original Options Income Engine's own dashboard and AI-portfolio pages, predating the institutional `Card`-based convention `UI-Standards.md` formalized). Consistent with Phase 9's own explicit "a full retrofit of every existing page... would itself have been a large, risky undertaking well outside 'polish'" decision, these were **not** rewritten this phase either — flagged here as known, disclosed, low-risk stylistic drift, not fixed.
  - The 3 pages without `Skeleton`: `Login.tsx` and `not-found.tsx` legitimately need none (a static form and a static 404 message with no data fetch). `PaperPortfolio.tsx` fetches broker data on an explicit, user-triggered action (`enabled: false` until a button click) rather than automatically on mount, so there is no automatic loading window a skeleton would cover — a deliberate on-demand pattern, not a gap.
- **Navigation:** every page is reachable from the sidebar nav (`nav-items.ts`) or from an explicit deep link on a related page — confirmed for the Portfolio Workspace (Phase 44) and every earlier phase's own disclosed "integrate into N named surfaces" step.
- **Report layouts:** all 32 report types in `lib/institutionalReporting.ts` share one `InstitutionalReport` envelope (`{id, reportType, title, sections[], generatedAt}`), rendered by one shared `ReportingCentre.tsx` view — no per-report-type bespoke layout exists to drift.
- **AI Coach topics:** every one of the platform's coach modules (Options `coachLLM.ts`, Investing `investingCoach.ts`, Trading `tradingCoach`, Workspace `workspaceCoach.ts`, Watchlists `watchlistsCoach.ts`, and others) follows the identical `{topic, question, answer}` / `explain<Domain>Topic(topic)` shape and reuses `COACH_DISCLAIMER` from the single shared `lib/coach.ts` — confirmed via direct inspection of the newest (`workspaceCoach.ts`, Phase 44) against the oldest coach modules in the codebase.
- **Learning topics:** every Learning Centre integration links to real, pre-existing Learning Path content (never duplicated lesson text) — confirmed for `workspaceLearning.ts` (Phase 44) against `watchlistsLearning.ts` (Phase 43) and the original Learning Centre topic set.

## 7. Fix applied this phase

**Circular dependency: `lib/notifications.ts` ↔ `lib/monitoringEngine.ts`.**

`notifications.ts` imports evaluator functions from `monitoringEngine.ts`; `monitoringEngine.ts` imported the `AlertCandidate`/`AlertSeverity` **types** back from `notifications.ts` (as `import type`, so it never affected runtime behavior — `pnpm run typecheck` was clean both before and after). `madge --circular` still flagged it as a structural cycle, and Phase 9's own Release Checklist explicitly tracked "zero circular dependencies" as a release-quality gate.

Fix: extracted `AlertType`/`AlertSeverity`/`AlertCandidate` into a new `lib/alertTypes.ts`, with `notifications.ts` re-exporting them unchanged (`export type { ... } from "./alertTypes.js"`) so every existing importer — including `routes/monitoringEngine.ts`, which was not touched — keeps compiling with zero changes of its own. Pure type relocation, zero behavioral change. Verified: `madge --circular` now reports zero cycles on the backend; `pnpm run typecheck` clean; the 4 test files touching this code path (`notifications.test.ts`, `monitoringEngine.test.ts`, `routes/monitoringEngine.route.test.ts`, `routes/notifications.route.test.ts`) all pass.

## 8. Audit conclusion

The mechanical portion of this audit (Steps 1–5 above) found the repository in materially clean condition: zero TODO/dead-code markers, zero unused routes/tables/pages, and only the one structural circular-import issue, now fixed. This is consistent with — not surprising given — the project's own unbroken disclosure discipline across 44 phases: every deviation, deferral, or known limitation was written down in `CLAUDE.md` or a dedicated doc at the time it happened, rather than left as silent debt.

The qualitative findings (Step 6) are two small, already-disclosed, low-risk stylistic gaps on the platform's two oldest pages (`Dashboard.tsx`, `PortfolioAI.tsx`) — not fixed this phase, for the same reason Phase 9 declined to retrofit them: a cosmetic rewrite of working, already-tested pages carries real regression risk for a benefit this RC1 pass's own "only implement deterministic improvements" instruction doesn't justify. See `docs/RC1-UI-UX-Review.md` for the full disposition, and `docs/RC1-Performance-Review.md`, `docs/RC1-Security-Review.md`, `docs/RC1-Test-Quality-Review.md` for Steps 3–5.

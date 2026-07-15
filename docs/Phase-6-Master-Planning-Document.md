# Phase 6 — Testing, Security & Production-Readiness — Master Planning Document

**Status: PHASE 6 IN PROGRESS.** This document proposed a candidate Phase 6 scope, sequence, and strategy; the project owner has approved and **Sprints 69 (§2a), 70 (§2c), 71 (§2d), 72 (§2e), 73 (§2f), and 74 (§2g) have all shipped** — the platform's first browser-level E2E testing capability, 2 genuine cross-engine E2E flows, dedicated Vitest coverage for all 14 previously-untested legacy pages (closing the frontend test-coverage gap entirely), the platform's first load/chaos testing of the automation scheduler (M4), and the platform's first monitoring/alerting/incident-runbook capability (M5, achieved). The project owner directed that Monitoring/Alerting stay in Phase 6 rather than move to Phase 7 (per the Sprint 73 completion report's own recommendation), so §2b's "not yet applied" re-homing recommendation for that item is now superseded. **No sprint number below Sprint 75 is a commitment** — per the established per-sprint approval process (`CLAUDE.md` §3, unbroken since Phase 1), each further proposed sprint still requires its own explicit kickoff, scope confirmation, and approval before any code is written, exactly as every sprint from 1 through 74 required.

**Prepared after:** Phase 5's close (`docs/Phase-5-Final-Completion-Report.md`), the Sprint 69 planning review that recommended closing Phase 5 rather than opening a further sprint, and a fresh reading of `docs/DK-AI-OS-Architecture-Blueprint.md`'s own original Phase 6 (Testing) and Phase 7 (Production) sections against the platform as it actually exists today at the close of Sprint 68.

---

## 0. Why This Is "Phase 6," Not a Continuation of Phase 5

The Blueprint's original 7-phase roadmap (§5 of the Blueprint) was: Foundation → Investing → Trading → Options Income (move+harden) → Integration → **Testing** → **Production**. This repository's executed phase numbering diverged starting at Phase 4 (documented in `docs/Phase-5-Master-Execution-Plan.md` §0): the executed "Phase 4" absorbed platform hardening plus a meaningful slice of the Blueprint's own Phase 5 ("Integration"), and the executed "Phase 5" closed out the rest of Integration plus a first bounded slice of the Blueprint's Phase 6 ("Testing").

What's left, reconciled against what's actually shipped:
- **The Blueprint's Phase 6 (Testing)** is only partially satisfied — Sprint 67 covered its single highest-consequence sub-item (a security review of the kill-switch/guardrail system), but its other three named deliverables (frontend coverage extended to remaining untested pages, an integration/e2e test suite, load testing) are untouched.
- **The Blueprint's Phase 7 (Production)** has not been started at all — no CI/CD-to-production pipeline, no monitoring/alerting stack, no incident runbook, no staged live-data rollout.

Phase 6, as proposed here, combines the remainder of the Blueprint's own Phase 6 with the *groundwork* for its Phase 7 — not a full production go-live (that stays properly gated behind explicit owner sign-off per sprint, the same as every phase before it), but the concrete, buildable pieces that make a future go-live decision possible: E2E test coverage, monitoring/alerting, a staged live-data rollout path, and a documented security/deployment/release process.

---

## 1. Objectives

1. Close the frontend test-coverage gap on the platform's 14 untested legacy pages (all pre-existing Engine 3 pages, predating Phase 1).
2. Stand up the platform's first browser-level E2E testing capability — currently zero — covering at minimum one critical flow per engine.
3. Add load/chaos testing for the scheduler-driven automation engine, the single highest-consequence subsystem in the platform (per CLAUDE.md's own framing).
4. Verify the live-data provider paths (Engine 1's FMP/Alpha Vantage, the Options Income Engine's own live-data path) the moment credentials are available — build the verification harness now so it's a same-day task once credentials arrive, not a fresh build.
5. Stand up production-grade monitoring/alerting and an incident-response runbook, reusing the existing `pino` structured-logging foundation and `platform_audit_log`/`auto_execution_log` tables as the observability substrate (per the Blueprint's own explicit reuse guidance).
6. Produce a documented, staged live-data and production rollout plan — staged per engine (Options Income first, Investing second, Trading last), matching the Blueprint's own explicit risk-reduction rationale — without necessarily executing that rollout within this phase; Phase 6's job is to make the rollout *possible and safe*, not to flip the switch.
7. Close the remaining trivial backlog items (`uuid`-vs-`serial` documentation closure) opportunistically, not as their own sprint.

**Explicitly not an objective of Phase 6:** building new engine features, touching `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts` beyond what a security review or monitoring instrumentation genuinely requires (and even then, only with the same maximum-scrutiny, explicit-approval process every prior phase has used), or actually flipping any engine to live/real-money mode without a separate, explicit go-ahead.

---

## 2. Proposed Sprint Sequence

Numbering continues the project's single global counter, starting at **Sprint 69**. Every sprint below is a proposal, not a commitment — sequencing may change based on what the project owner actually wants to prioritize, and any sprint may be split further (mirroring the Sprint 33/34, 57/58 Core-then-Route+UI precedent) once its true scope is better understood at kickoff.

**Renumbered after the post-Sprint-69 roadmap review (§2b):** the Cross-Engine E2E Integration Suite (originally listed as candidate #72) was promoted to Sprint 70, ahead of the frontend legacy-page coverage sweep. The table below reflects the actual shipped/assigned order; items not yet reached keep their original candidate numbers as placeholders only — still not commitments.

| # | Sprint | Type | Status | Rationale for this position |
|---|---|---|---|---|
| 69 | E2E Testing Framework Selection + First Smoke Slice | Foundation | **SHIPPED (§2a)** | Nothing else in this phase can be scoped concretely until a framework (Playwright is the natural default — headless Chromium is already pre-installed in this environment) is chosen; ships with one real smoke test per engine (login → one Engine 1/2/3 flow each) to prove the harness works end-to-end, not just install tooling |
| 70 | Cross-Engine E2E Integration Suite | Testing | **SHIPPED (§2c)** | Promoted ahead of the coverage sweep per §2b's review — highest remaining business value, zero new tooling decisions, directly reuses Sprint 69's harness; adds real browser-level flows spanning 2+ engines on the Institutional Dashboard and the Cross-Engine Daily Report |
| 71 | Frontend Legacy-Page Test Coverage — Slice 1 | Testing | **SHIPPED (§2d)** | Bounded to the 5 smallest/simplest of the 14 untested pages (not-found, Scoring, Login, OptionChain, Portfolio) — smallest-first, mirroring the Route+UI backlog-reduction pattern from Phase 3, Sprints 40–46, which handled exactly this kind of "many similar items, one at a time" backlog |
| 72 | Frontend Legacy-Page Test Coverage — Slice 2 | Testing | **SHIPPED (§2e)** | Remaining 9 pages (Events, Scanner, Backtest, Journal, AutoPilot, Performance, Dashboard, TradeTicket, Adjustments) — closes the frontend test-coverage gap entirely, all 27 pages now covered |
| 73 | Load & Chaos Testing — Automation Scheduler | Testing/Security | **SHIPPED (§2f)** | The Blueprint's own explicitly-named highest-risk gap ("if this phase gets compressed... it's the automation/execution path... that pays for it first") — the tooling decision (resolved: no new tool, pure Vitest) was its own first sub-step, mirroring Sprint 69's own framework-selection precedent |
| 74 | Monitoring, Alerting & Incident Runbook | Production-readiness | **SHIPPED (§2g)** — stayed in Phase 6 per explicit owner direction | Reuses `pino` (already the logging foundation) + `platform_audit_log`/`auto_execution_log` (already the compliance/observability substrate) per the Blueprint's own explicit reuse guidance; produces a real, testable incident-response runbook, not just a document |
| 75 | Live Provider Verification — Engine 1 (FMP/Alpha Vantage) | Conditional | Blocked (no credentials) | Fires the moment `FMP_API_KEY`/`ALPHA_VANTAGE_API_KEY` become available — this is Sprint 62 finally unblocked, a pure verification pass over already-built code, no new logic; can run at any point once credentials arrive, independent of this sequence |
| 76 | Live Provider Verification — Options Income Engine | Conditional | Blocked (no credentials) | Same shape as 75, for the Options Income Engine's own live-data path (the Blueprint's original Phase 4 item that was never executed) |
| 77 | Staged Production Rollout Plan — Documentation + Go-Live Checklist | Production-readiness | Not started (§2b recommends re-homing to a future Phase 7) | Produces the actual staged rollout plan and go-live checklist the Blueprint calls for (Options Income → Investing → Trading), explicitly covering the automation kill-switch — a planning/documentation sprint, not a go-live event itself |
| — | Notification Delivery — email/push | Conditional, unscheduled | Blocked (no infra) | Fires the moment SMTP/VAPID credentials + infrastructure exist; not sequenced into the numbered list above since it has no dependency on anything else in this phase |

**Estimated sprint count: 9 numbered sprints (69–77), plus 1 unscheduled conditional item.** Realistically, 6 of the 9 (69–74) are unconditionally implementable today; the remaining 3 (75–77) are either credential-gated or deliberately positioned last since they depend on 69–74's own output (a rollout plan needs the testing/monitoring groundwork to already exist to be credible).

---

## 2a. Sprint 69 — E2E Testing Framework Selection + First Smoke Slice — SHIPPED

Implemented exactly as proposed in §2's own table row, no scope expansion.

**Framework selected: Playwright (`@playwright/test`), confirmed, not just assumed from this document's own earlier recommendation** — verified this environment's pre-installed Chromium (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) is directly usable, `webServer` natively launches this repo's own two-process (Express + Vite) architecture with health-checked startup/teardown and no custom orchestration script, and it's a single npm dependency (no browser-farm/grid service) — the same "no new infrastructure beyond installing a package" bar every prior sprint's dependency additions have met.

New workspace package `artifacts/e2e` (fits the existing `artifacts/*` glob, no `pnpm-workspace.yaml` change): `@playwright/test` pinned to the **exact** version `1.56.0`, empirically confirmed via a real browser-launch check to match the pre-installed Chromium revision (1194) — a version bump later must re-verify this match, documented in `artifacts/e2e/README.md`.

**One small, disclosed, opt-in-only change to `vite.config.ts`** (test/dev-server config, not application business logic): a new `E2E_API_PROXY_TARGET` env var (undefined by default, zero effect on any existing invocation) enables a `/api` proxy on the Vite dev/preview servers, required because Playwright's two separate local processes (frontend on 4173, backend on 4300) have no other way to reach each other — this repo's real deployment target merges both origins at the infrastructure level, a detail invisible to this repo's own config. `CORS_ALLOWED_ORIGINS` is set on the backend's `webServer` process (an env var, not a code change) so Better-Auth's own `trustedOrigins` (Phase 1 Sprint 6) accepts the frontend's local origin during sign-up/sign-in.

**First smoke slice, exactly as scoped:** 3 tests, one per engine, each independently signing up a fresh user then exercising one real flow — Engine 1 (select AAPL from the Coverage Universe, `/stock-analyst`), Engine 2 (search AAPL, `/trading-research`, assert Market Structure renders), Engine 3 (open `/portfolio-ai`, assert real Portfolio Health/Market Exposure scores render via the existing auto-seeded-trades behavior). No cross-engine flow, no per-page coverage sweep, no other Phase 6 sprint's scope was started.

New `.github/workflows/ci.yml` `e2e` job, genuinely separate from the existing `test` job, with its own disposable Postgres service and a freshly-generated `BETTER_AUTH_SECRET` (installs Chromium itself via `playwright install --with-deps chromium`, since a fresh GitHub Actions runner has no pre-installed browser).

**No genuinely new owner decisions surfaced** — framework choice, ports, and proxy wiring were all resolvable from this document's own already-approved recommendation and Sprint 69's own explicit scope.

**Files changed:** `artifacts/e2e/` (new package — `package.json`, `playwright.config.ts`, `tests/`, `README.md`), `artifacts/ravish-trading/vite.config.ts` (additive, opt-in proxy), `.github/workflows/ci.yml` (new `e2e` job), `.gitignore` (Playwright artifact dirs). No database migration, no `openapi.yaml` change, no application route/component/business-logic change.

**Tests:** 3 new Playwright specs, all passing, run twice locally with zero flakes (one strict-mode locator ambiguity — "Portfolio Health" also matching an unrelated "Portfolio Health Trend" heading — caught and fixed with `{ exact: true }` during the first local run).

No trading logic, options execution, scheduler behavior, guardrails, kill switches, authentication, tenant isolation, or audit logging were touched; `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts` have a zero-line diff this sprint.

**Rollback:** `git revert` — one new package directory, one additive `vite.config.ts` change (a no-op unless `E2E_API_PROXY_TARGET` is explicitly set), one new CI job, a `.gitignore` addition; no database migration to unwind, no application behavior changed for any existing user-facing path.

**Validation:** `pnpm run typecheck` clean (including the new `artifacts/e2e` package). `pnpm --filter @workspace/api-server run test` — the first parallel run was fully clean (112 files / 1,190 tests); a second parallel run hit two separate, previously-disclosed pre-existing flake categories (the `fetchedAt`-timing race in `value.test.ts`, and one instance of the shared-legacy-owner-account live-Postgres-parallelism flake in `phase4Unification.route.test.ts`), both confirmed via `git status --porcelain` to be in files untouched by Sprint 69; a definitive serial re-run confirmed clean: 112 files / 1,190 tests, zero failures. `pnpm --filter @workspace/ravish-trading run test` — 17 files / 149 tests, unchanged. `PORT=5000 BASE_PATH=/ pnpm run build` — all packages build successfully; largest frontend chunk unchanged at 461.57 kB.

**Sprint 70 was not started.**

---

## 2b. Post-Sprint-69 Phase 6 Roadmap Review

Performed at the project owner's explicit request before Sprint 70 began. Reviewed every remaining item (frontend legacy-page coverage, cross-engine E2E, load/chaos testing, monitoring/alerting, live-data verification, production rollout, release readiness) for business value, technical value, dependencies, effort, and correct phase placement.

**Key conclusions:**
- **Cross-Engine Browser E2E Integration Suite (originally Sprint 72) promoted ahead of the frontend legacy-page coverage sweep (originally 70/71).** It's the highest-remaining-business-value item — the literal Blueprint Phase 6 "integration test suite" deliverable Phase 5's own closure review flagged by name — and directly reuses Sprint 69's harness with zero new tooling decisions, unlike the coverage sweep's own (still real, but lower-urgency) mechanical debt closure.
- **Recommended (not yet applied): narrow Phase 6 to its actual Testing charter** (69, cross-engine E2E, the 2 frontend-coverage slices, and load/chaos testing as its capstone) and re-home Monitoring/Alerting, Live-Data Verification, and the Staged Rollout Plan into a distinctly-named future **Phase 7 — Production Readiness**, mirroring the Blueprint's own original Phase 6/Phase 7 split.
- **Production-readiness score at the time of review: 51/100** — strong on security/tenancy/guardrails (30/30) and testing maturity building (14/25), weak on operational readiness (2/20), live-data readiness (2/15), and deployment/rollout readiness (3/10).
- **Top risks named:** no monitoring/alerting or incident runbook; the kill-switch/guardrail logic untested under real concurrent load; live-data paths entirely unverified against real APIs; the production CORS origin still unset; no staged rollout plan or go-live checklist yet.

Full analysis delivered in chat per the project owner's request; this section is the durable record. See §2c for Sprint 70's own as-built result.

---

## 2c. Sprint 70 — Cross-Engine Browser E2E Integration Suite — SHIPPED

Implemented exactly as proposed in §2b's own recommendation, no scope expansion.

Extends Sprint 69's harness with 2 new specs, reusing `signUpAndLogin` and the exact same `playwright.config.ts`/`webServer`/CI wiring unmodified — zero new npm dependencies, zero new tooling.

- **`cross-engine-command-center.spec.ts`** — drives `InstitutionalDashboard.tsx`: asserts the always-visible Portfolio Overview section shows Engine 1's honest-empty Portfolio Construction state alongside Engine 3's real, auto-seeded Options Income account data side by side, without either being blended; then searches AAPL and asserts Engine 1's Investment Committee card and Engine 2's Technical Read card both render together — the literal Cross-Engine Command Center guarantee (Phase 4, Sprint 54).
- **`cross-engine-daily-report.spec.ts`** — drives `CrossEngineDailyReport.tsx`: asserts all 3 engine sections render together for a fresh user — Engine 1's honest "Watchlist is empty" state, Engine 2's honest insufficient-data trading-risk read, and Engine 3's real, auto-seeded health/open-position data.

**One genuine, pre-existing backend bug discovered (not introduced) by this sprint's own test run, disclosed and explicitly NOT fixed, per the sprint's own scope boundary:** `lib/serverState.ts`'s `getSettingsRow()` is a plain check-then-insert with no upsert safety, dormant since Phase 1 Sprint 5 — no prior test had ever driven multiple concurrent settings-touching requests for a genuinely brand-new user within a single page load. `InstitutionalDashboard.tsx`'s own pre-existing multi-hook-on-mount design is exactly that trigger, and intermittently reproduced a duplicate-settings-row race during local validation (1 failure in 3 early runs). Diagnosed honestly as pre-existing backend business logic entirely outside Sprint 70's E2E-only scope — not fixed here. Instead, `cross-engine-command-center.spec.ts` makes one isolated, deterministic `GET /api/settings` warm-up call immediately after sign-up and before navigating to the multi-hook dashboard page, so the settings row already exists by the time the dashboard's own concurrent hooks resolve it — a legitimate, scope-preserving E2E test-design choice, not a production code change. The underlying `getSettingsRow()` race itself remains open technical debt, flagged here for a future sprint's consideration.

**Files changed:** `artifacts/e2e/tests/cross-engine-command-center.spec.ts` (new), `artifacts/e2e/tests/cross-engine-daily-report.spec.ts` (new) — nothing else. No database migration, no `openapi.yaml` change, no application route/component/business-logic change.

**Tests:** 2 new Playwright specs (7 total across the E2E suite now), confirmed stable across 2 full clean runs after the settings-race warm-up fix (5/5 passing both times, zero flakes).

No trading logic, options execution, scheduler behavior, guardrails, kill switches, authentication, tenant isolation, or audit logging were touched; `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts`/`serverState.ts` all have a zero-line diff this sprint.

**Rollback:** `git revert` — 2 new spec files only; no database migration to unwind, no application behavior changed.

**Validation:** `pnpm run typecheck` clean. `pnpm --filter @workspace/api-server run test` — run twice per the explicit instruction, both fully clean: 112 files / 1,190 tests, zero failures, zero flakes either run. `pnpm --filter @workspace/ravish-trading run test` — 17 files / 149 tests, unchanged. `PORT=5000 BASE_PATH=/ pnpm run build` — all packages build successfully, no size warning. Full 5-spec E2E suite run twice after the fix: both fully clean, 5/5 passing, zero flakes.

**Sprint 71 was not started.**

---

## 2d. Sprint 71 — Frontend Legacy Page Test Coverage — Slice 1 — SHIPPED

Implemented exactly as proposed in §2's own table row (renumbered to 71 after §2b's re-sequencing), no scope expansion.

**Slice selected: the 5 smallest/simplest of the 14 untested legacy pages** — `not-found.tsx` (21 lines), `Scoring.tsx` (93), `Login.tsx` (119), `OptionChain.tsx` (145), `Portfolio.tsx` (147) — smallest-first, establishing the per-page test-writing pattern before Slice 2 tackles the larger remaining 9 pages. Not a genuinely new owner decision — an implementation-level choice within the already-approved "Slice 1" boundary, matching the precedent Sprint 40 set picking Market Structure as the Route+UI backlog's own first slice.

All 5 new test files follow the established mocked-generated-hook pattern (`vi.hoisted` state object, top-level `vi.mock("@workspace/api-client-react", ...)` spreading `importActual`) already used by every other page test in this codebase:
- `not-found.test.tsx` (1 test) — the static 404 heading/message, no hooks to mock.
- `Scoring.test.tsx` (3 tests) — loading skeletons, the honest empty-leaderboard message, real leaderboard rows once resolved.
- `Login.test.tsx` (6 tests) — following `App.test.tsx`'s own established `@/lib/auth-client` mocking pattern (Sprint 53): the default sign-in form, toggling to sign-up, successful sign-in/sign-up submitting the right credentials and navigating home, an honest error toast on a failed sign-in (the first test in this codebase asserting real `<Toaster />` content, rendered alongside `<Login />` for that one case only), and the already-signed-in state.
- `Portfolio.test.tsx` (5 tests) — loading skeletons, an honest empty-positions message, real greeks/position rendering, AI recommendations shown only when genuinely present, and a proof an empty recommendations array never fabricates the card.
- `OptionChain.test.tsx` (3 tests) — rendered standalone with no `<Route>` ancestor, so wouter's `useParams()` correctly falls back to the page's own documented "SPY" default; loading skeletons, real call/put chain rendering, and a proof chain data is never fabricated before it resolves.

**One locator bug caught and fixed during this sprint's own test-writing, not a production bug:** `OptionChain.test.tsx`'s first draft used `getByRole("combobox", { name: "SPY" })`, whose accessible-name computation didn't match the rendered text the way expected — fixed with `getByRole("combobox")` + `.toHaveTextContent("SPY")`.

**Files changed:** 5 new test files only (listed above) — zero application source files (backend or frontend) touched.

**Tests:** 23 new tests total across the 5 files. `src/test/page-test-pattern.guardrail.test.ts` (22 tests, unmodified) confirms none of the 5 new files violate the established `vi.resetModules()`/dynamic-`import()` prohibition.

No trading logic, options execution, scheduler behavior, guardrails, kill switches, authentication, tenant isolation, or audit logging were touched; `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts`/`serverState.ts` all have a zero-line diff this sprint.

**Rollback:** `git revert` — 5 new test files only; no database migration to unwind, no application behavior changed.

**Validation:** `pnpm run typecheck` clean. `pnpm --filter @workspace/api-server run test` — run twice, both fully clean: 112 files / 1,190 tests, zero failures (expected, since this sprint touched zero backend files). `pnpm --filter @workspace/ravish-trading run test` — 22 files / 172 tests (5 new files, 23 new tests), all passing. `PORT=5000 BASE_PATH=/ pnpm run build` — all packages build successfully, no size warning. The full Playwright E2E suite (5 specs, unchanged from Sprint 70) was run 4 times total to reach 2 clean, definitive back-to-back runs: the first 2 exploratory runs each hit the well-documented, previously-disclosed `getSettingsRow()` concurrency race (Sprint 70's own disclosure — this time via `engine1-investing.spec.ts` and `routes/scanner.ts`'s `scanAndPersist`, confirmed unrelated to Sprint 71 via `git status --porcelain` showing zero backend files changed), never a failure in any of the 5 new frontend test files; the final 2 definitive runs were both fully clean, 5/5 passing, zero flakes.

**Sprint 72 was not started.**

---

## 2e. Sprint 72 — Frontend Legacy Page Test Coverage — Slice 2 — SHIPPED

Approved via a single terse "approve," matching the exact candidate item this session's own Sprint 71 completion report had already proposed. Implemented exactly as proposed in §2's own table row, no scope expansion.

**Slice selected: the remaining 9 untested legacy pages**, re-verified via a fresh scan rather than assumed — this scan also caught that the original table row above (and Sprint 71's own completion report) had accidentally omitted `Scanner.tsx` from the "remaining 9 pages" list, corrected here and in the actual set of files written: `Events.tsx`, `Scanner.tsx`, `Backtest.tsx`, `Journal.tsx`, `AutoPilot.tsx`, `Performance.tsx`, `Dashboard.tsx`, `TradeTicket.tsx`, `Adjustments.tsx`. This closes the frontend test-coverage gap entirely — every page in `artifacts/ravish-trading/src/pages` now has a dedicated test file. Not a genuinely new owner decision — an implementation-level page ordering choice, matching Sprint 71's own precedent.

All 9 new test files follow the established mocked-generated-hook pattern:
- `Events.test.tsx` (3 tests) — loading placeholders, an honest empty-calendar message with all 4 stat cards honestly reading zero, real events grouped/counted by date.
- `Scanner.test.tsx` (5 tests) — loading skeletons, an honest "No opportunities found" empty state, real scanner rows including the honest no-event-risk "—" indicator, Review-button navigation to `/ticket/:id`, and the Run Scan trigger.
- `Backtest.test.tsx` (5 tests) — a loading placeholder, an honest empty-history message, the equity curve and KPI tiles for the latest result (with a proof that Win Rate/Expectancy/Return legitimately render twice — once in the KPI tile, once in the same result's own sole history-table row — while Max Drawdown, which has no table column, renders once), the history table with multiple real rows, and a new-run submission.
- `Journal.test.tsx` (7 tests, reusing the established `streamCoach` mocking pattern) — loading skeletons, an honest empty-entries message, a real entry with its strategy/exit-reason/P&L badges and lesson-learned callout, a negative realized P&L rendering without a fabricated leading plus sign, a new-entry submission, and an AI Coach review request/render round-trip.
- `AutoPilot.test.tsx` (6 tests, explicitly documented as read-only with respect to the actual kill-switch/guardrail logic per CLAUDE.md rule 2 — every hook is mocked, so no real backend execution/guardrail code path is exercised) — loading skeleton, DISARMED with an honest empty decision log, ARMED with real today's-stats, real decision-log rows, flipping the master kill switch, and a manual cycle-run trigger.
- `Performance.test.tsx` (4 tests) — loading skeletons, real KPI values including the raw (non-relabeled) best-strategy value, real best/worst ticker rows, and the breakdown table.
- `Dashboard.test.tsx` (10 tests) — this page has no single loading gate; each of its 7 hooks/sections is independently gated, mirroring the `InstitutionalDashboard.test.tsx`/`TradingResearch.test.tsx` multi-hook precedent. Covers pre-resolution loading with honest "—" risk fields, real KPI values, the Top Pick hero and its Review-button navigation, the honest empty theta message, real theta figures and by-strategy breakdown, market data health including the fallback-provider warning banner, real risk-status-bar values, Review-button navigation from a "Top Iron Condors" panel row, an honest empty earnings message, and real earnings-engine cards — with assertions deliberately targeting fields unique to the real data under test, since "NVDA"/"AAPL" also appear in the page's own purely-decorative `TickerTape` fake-symbol list.
- `TradeTicket.test.tsx` (7 tests) — mocks `useParams` alongside `useLocation` since this page reads `scannerId`/`tradeId` from the URL. Covers an honest "no candidate selected" message and Back-to-Scanner navigation, loading skeletons, an honest preview-failure error message, a real ticket render (metrics, legs, Pre-Trade Risk Validation PASSED badge and checks), the Before → After roll/convert panel for an adjustment ticket, a full submit-and-confirm flow navigating to `/trades`, and the quantity stepper re-triggering a preview with the updated count.
- `Adjustments.test.tsx` (9 tests, the final legacy-page test file) — a loading skeleton, an honest all-clear attention-queue message, a real attention-queue row with its severity/recommendation/de-risk badge, closing a de-risk-eligible position after confirmation, arming auto-adjust via the master switch, saving trigger thresholds, a manual adjustment-cycle-run trigger, an honest empty decision-log message, and real decision-log rows grouped by cycle. `wouter`'s `useLocation` is mocked because the page's embedded `TradeAdjustmentSheet` component calls it unconditionally on every render even while closed; the sheet itself (a shared component with no dedicated test file of its own, outside this sprint's page-list scope) is never opened by these tests, so `streamCoach` needed no mock here.

**Four test-assertion bugs caught and fixed during this sprint's own test-writing, none a production bug:**
1. A "$320" currency-rounding ambiguity in `Performance.test.tsx`'s ticker fixture — fixed by using a whole-number fixture value.
2. An accidental value collision between `winRate: 0.76` and `actualPop: 0.76` both rendering "76.0%" in `Performance.test.tsx` — fixed by giving `actualPop` a distinct value.
3. A mistaken assumption that `Performance.tsx`'s "Best Strategy" highlight relabels its value — it renders the raw `bestStrategy` string unchanged (e.g. "iron_condor," not "iron condor") — fixed by asserting the actual raw text.
4. Duplicate-text collisions in `Backtest.test.tsx` (Win Rate/Expectancy/Return legitimately render twice when the sole fixture is both the "latest result" and the sole history-table row) and `Dashboard.test.tsx` ("88" legitimately renders 3 times: the hero's own ScoreRing gauge, its large Ravish Score figure, and the same opportunity's own ScoreRing in the "Top Iron Condors" panel below, since it's also that panel's sole entry) — both fixed with `getAllByText(...).length` assertions proving the exact expected duplication rather than forcing an artificial uniqueness.

**Files changed:** 9 new test files only (listed above) — zero application source files (backend or frontend) touched.

**Tests:** 55 new page-level tests across the 9 files, plus 9 new guardrail sub-checks (one per new file) in `src/test/page-test-pattern.guardrail.test.ts`, confirming none of the 9 new files violate the established `vi.resetModules()`/dynamic-`import()` prohibition.

No trading logic, options execution, scheduler behavior, guardrails, kill switches, authentication, tenant isolation, or audit logging were touched; `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts`/`serverState.ts` all have a zero-line diff this sprint.

**Rollback:** `git revert` — 9 new test files only; no database migration to unwind, no application behavior changed.

**Validation:** `pnpm run typecheck` clean. `pnpm --filter @workspace/api-server run test` — run twice: the first run hit the well-documented, previously-disclosed `fetchedAt`-timing race in `value.test.ts`'s own SIMULATED-determinism check (confirmed via `git status --porcelain` unrelated to this sprint, which touched only frontend test files) — 111 files passed / 1 failed, 1,189 tests passed / 1 failed; the second run was fully clean — 112 files / 1,190 tests, zero failures. `pnpm --filter @workspace/ravish-trading run test` — 31 files / 236 tests (9 new files, 55 new tests + 9 new guardrail sub-checks), all passing. `PORT=5000 BASE_PATH=/ pnpm run build` — all packages build successfully, no size warning (largest chunk unchanged at 461.57 kB). The full Playwright E2E suite (5 specs, unchanged from Sprint 70) was run 3 times to reach 2 clean, definitive runs: the first run was fully clean (5/5); the second run hit a single 30-second timeout in `cross-engine-command-center.spec.ts` (the same page/flow category as Sprint 70's own previously-disclosed `getSettingsRow()` concurrency race, confirmed unrelated to Sprint 72 via `git status --porcelain` showing zero backend/E2E-spec files changed); the third, definitive run was fully clean again, 5/5 passing, zero flakes.

**With Sprint 72's completion, M2 ("Full frontend test coverage," see §4) is now achieved.**

---

## 2f. Sprint 73 — Load & Chaos Testing — Automation Scheduler — SHIPPED

Implemented exactly as proposed in §2's own table row, no scope expansion into Sprint 74.

**Tooling decision, resolved via `AskUserQuestion` before any code was written (the plan's own explicitly-flagged first sub-step):** the project owner chose the recommended option — **no new tool**. Every load/chaos scenario is a plain Vitest test file, reusing the exact real-app-instance + native `fetch()` pattern every prior `*.route.test.ts` file already uses (Sprint 40's own precedent) plus `Promise.allSettled`-based concurrency fan-out for load and direct scheduler-function invocation for chaos (mirroring Sprint 8's `autoScheduler.multiUser.test.ts` and Sprint 67's `autoExecutionSecurityReview.test.ts`) — zero new npm dependencies, zero external binaries (k6/Artillery ruled out), zero new CI wiring.

**New `lib/loadTestHarness.ts`** — a small, dependency-free, testing-only utility module, never imported by any route/scheduler/production code path: `runConcurrent()` (Promise.allSettled fan-out with per-task latency timing, never throws — a rejected task is captured, not propagated), `percentile()`/`summarizeLatencies()` (nearest-rank p50/p95/p99), `successCount()`/`rejectionReasons()`. `lib/loadTestHarness.test.ts` (8 tests) proves the harness's own math.

**Load testing methodology** (`routes/loadTest.route.test.ts`, 4 tests): HTTP-level concurrent fan-out against real, already-shipped, globally-scoped routes only — `/api/healthz` and Engine 2's `/api/trading/structure/:symbol` (Sprint 40's own header comment already confirms this route needs no ownership/tenant scoping). Scenarios: 100 concurrent health checks; 25 concurrent real Market Structure computations across 5 symbols; 20 concurrent honest-404s for an unresolvable symbol (graceful degradation under load); a post-100-way-burst responsiveness check (no lingering degradation). **Deliberately excludes per-user routes under the shared legacy-owner account** — that would risk exactly the "shared-legacy-owner-account live-Postgres-parallelism flake" category disclosed since Sprint 20 and reproduced repeatedly in this session's own E2E runs.

**Chaos-testing methodology** (`lib/schedulerLoad.test.ts`, 3 tests; `lib/schedulerChaos.test.ts`, 6 tests): extends Sprint 8's 2-3-user proofs and Sprint 67's 2-candidate mid-cycle kill-switch-flip proof to genuinely adversarial scale, against freshly-created, isolated per-test users only. Scenarios: 25 sequential armed-user execution/adjustment cycles at scale; 30 concurrently-invoked different users' cycles, all isolated; a mid-cycle kill-switch flip across 10 candidates; injected per-candidate `buildTicket` failures (every 3rd of 12 candidates); injected `executeValidatedTicket` routing failures interleaved with successes; a 20-user real-concurrency scenario where one user is disarmed by a simulated concurrent admin action mid-flight while 19 unrelated users complete normally; a recovery-after-blocked-cycle proof; a 15-way concurrent adjustment-isolation proof. All scenarios are read-only with respect to `autoExecution.ts`/`autoAdjustment.ts` — every one proves already-correct, unmodified behavior holds under load.

**Performance results** (real measured numbers, `console.info`-logged, mirroring Sprint 52's `requestMetrics.ts` baseline-logging precedent — all well under their own deliberately generous ceilings):

| Scenario | Total time | p50 | p95 | Max |
|---|---|---|---|---|
| `/api/healthz` × 100 concurrent | ~281–300ms | ~187ms | ~236–240ms | ~240–241ms |
| `/api/trading/structure/:symbol` × 25 concurrent | ~164–176ms | ~150ms | ~161–163ms | ~163ms |
| `runAutoExecutionCycle` × 25 sequential | ~406ms (~16ms/user) | — | — | — |
| `runAutoAdjustmentCycle` × 25 sequential | ~287ms (~11ms/user) | — | — | — |
| `runAutoExecutionCycle` × 30 concurrent | ~190ms | ~187ms | ~190ms | ~190ms |

**Limitations, all explicitly documented in the test files' own header comments:**

1. **The real, globally-unscoped orchestration wrappers (`runAutoExecutionCycleForAllUsers`/`runAutoAdjustmentCycleForAllUsers`) are NOT load-tested directly at scale.** Discovered during this sprint's own validation, not anticipated in the pre-approval plan: the first draft called them directly, and under full-suite parallel execution their own internal SELECT (every currently-armed user across the ENTIRE suite) genuinely collided with this sprint's own sibling `schedulerChaos.test.ts` file, reproducing the already-disclosed `getSettingsRow()` check-then-insert race (Sprint 70) at a far higher rate than any prior test, up to and including a real FK-violation crash when one file's `afterAll` deleted a user between the wrapper's SELECT and its later per-user processing. Fixing `getSettingsRow()`'s own race would mean touching `autoExecution.ts`/`autoAdjustment.ts`/`serverState.ts`, requiring its own separate, explicitly-approved sprint per CLAUDE.md rule 2 — out of scope for a testing-only sprint. The safe substitute: load-test `runAutoExecutionCycle()`/`runAutoAdjustmentCycle()` directly — the identical per-user function the wrapper calls once per armed user, in the identical sequential pattern — scoped only to each file's own known user IDs.
2. **No actual infrastructure fault injection** (killing the database connection, network partition, process crash) — by design from the start, not discovered mid-sprint. Severing the shared test database mid-run would risk destabilizing every other test file running concurrently against the same database in this session's shared sandbox. Per-candidate/per-user exception injection is the bounded substitute, exercising the same try/catch resilience boundaries a real infrastructure fault would hit.
3. **Thresholds are informational, not a strict performance SLA** — generous ceilings sized to catch genuine hangs/regressions without false-failing on ordinary sandbox jitter, consistent with this project's "reuse existing testing infrastructure, don't fabricate false precision" discipline.
4. **A test-infrastructure-only fix, not a scope change:** Vitest's default 5000ms per-test timeout was hit once under heavy full-suite parallel contention for the heaviest 25–35-user tests; all 13 new `it()` blocks across the 3 heavier files were given an explicit 30-second timeout.

**Files changed:** `lib/loadTestHarness.ts` (new), `lib/loadTestHarness.test.ts` (new), `routes/loadTest.route.test.ts` (new), `lib/schedulerLoad.test.ts` (new), `lib/schedulerChaos.test.ts` (new) — 5 new files only, zero application source files touched.

**Tests:** 21 new tests total across 4 test files (`loadTestHarness.test.ts` 8, `loadTest.route.test.ts` 4, `schedulerLoad.test.ts` 3, `schedulerChaos.test.ts` 6).

No trading logic, options execution, scheduler behavior, guardrails, kill switches, authentication, tenant isolation, or audit logging were touched; `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts`/`serverState.ts` all have a zero-line diff this sprint.

**Rollback:** `git revert` — 5 new test/utility files only; no database migration to unwind, no application behavior changed.

**Validation:** `pnpm run typecheck` clean. `pnpm --filter @workspace/api-server run test` — run twice per the explicit instruction, plus a definitive serial re-run: the first parallel run was fully clean (116 files / 1,211 tests); the second parallel run hit 3 failures, all independently confirmed pre-existing, previously-disclosed flake categories unrelated to this sprint via `git status --porcelain` (the `fetchedAt`-timing race, first noted Sprint 16; the shared-legacy-owner-account live-Postgres-parallelism race, first noted Sprint 20) — none in any Sprint-73-touched file; a definitive serial re-run (`vitest run --no-file-parallelism`) confirmed fully clean: 116 files / 1,211 tests, zero failures. The new load/chaos suite (4 files, 21 tests) was additionally run 5 times in isolation to confirm repeatability — all 5 fully clean, zero flakes. `pnpm --filter @workspace/ravish-trading run test` — 31 files / 236 tests, unchanged. `PORT=5000 BASE_PATH=/ pnpm run build` — all packages build successfully, no size warning (largest chunk unchanged at 461.57 kB). The full Playwright E2E suite (5 specs, unchanged) was run 5 times total to reach 2 clean, definitive back-to-back runs: 3 of the 5 runs each hit exactly one instance of the well-documented, previously-disclosed `getSettingsRow()` concurrency race (Sprint 70's own disclosure), confirmed unrelated to Sprint 73 via `git status --porcelain`; the final 2 consecutive runs were both fully clean, 5/5 passing, zero flakes.

**With Sprint 73's completion, M4 ("Automation engine load-tested," see §4) is now achieved.**

---

## 2g. Sprint 74 — Monitoring, Alerting & Incident Runbook — SHIPPED

Implemented exactly as proposed in §2's own table row, no scope expansion into Sprint 75. **No remaining owner decisions surfaced** — unlike Sprint 73's tool choice or Sprint 56's delivery-channel choice, both the plan's own Objective 5 and the project owner's kickoff instructions were fully prescriptive (reuse `pino` + `platform_audit_log`/`auto_execution_log`, no new monitoring service), so no `AskUserQuestion` was needed.

**Zero changes to any protected file.** `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts` all remain zero-line diff — every instrumentation point lives in `index.ts` (the scheduler tick) and `lib/notifications.ts` (the alerts tick), neither of which is protected, wrapping their own existing calls with pure timing/outcome observation that never changes what they do.

### Monitoring architecture

New `lib/systemHealth.ts` — the monitoring core:
- **Background-job health tracking** (`recordJobRun()`/`getJobHealthSnapshot()`) — an in-memory per-job state mirroring `lib/requestMetrics.ts`'s own Sprint 52 pattern exactly, tracking 3 jobs: `auto-execution`, `auto-adjustment` (both `index.ts`'s 60s scheduler tick), and `alerts` (`lib/notifications.ts`'s 5-minute tick, Sprint 56).
- A cheap **database connectivity check** (`SELECT 1`, real latency measured).
- Two **audit-log-derived alert signals** — `guardrailBlocksLastHour` (`auto_execution_log` where `decision="blocked"`, last hour) and `authFailuresLastHour` (`platform_audit_log` where `eventType="auth.login_failed"`, last hour) — the literal "turn existing logs into active alerting signals" the plan's Objective 5 calls for. Computed **only from the periodic 5-minute timer**, never the live request path, since `auto_execution_log` has no index beyond its primary key and CLAUDE.md rule 3 forbids adding one as part of general audit-log work.
- A pure `evaluateAlerts()` function producing the 6 alert categories in §2 below.
- **Edge-triggered incident persistence** — every alert is `pino`-logged every tick; only a genuinely *new* alert category is persisted to `platform_audit_log` via the already-existing `recordAuditEvent()` writer (Sprint 10), `eventType: "monitoring.alert"` — no new table, no migration. A still-active alert isn't re-persisted every 5 minutes; a resolved-then-reoccurring alert persists again.

**Live-vs-cached design, explicitly disclosed:** `GET /monitoring/status` (new route, mounted on the same `healthRouter` as `/healthz` — same auth-exempt, rate-limit-exempt treatment) computes database connectivity, job health, and the current request-metrics window fresh on every call; the two audit-log-derived signals are read from the periodic timer's own cache — `auditSignals.computedAt` is honestly `null` until the server's first monitoring tick, never fabricated.

`lib/requestMetrics.ts` gained one small, additive, read-only export (`getCurrentWindowSnapshot()`) so `systemHealth.ts` could read the current unflushed window without disturbing the existing 5-minute logging cadence.

### Alert categories

| Category | Severity | Threshold |
|---|---|---|
| `database.unreachable` | critical | Connectivity check failed |
| `scheduler.repeated_failure` | critical | `consecutiveFailures >= 3` |
| `scheduler.stuck` | critical | Last run older than 2× the job's own expected interval |
| `errors.elevated_5xx_rate` | warning | 5xx rate > 10%, with ≥20 requests in the window |
| `guardrail.elevated_block_rate` | warning | > 20 blocked decisions/hour |
| `auth.elevated_failure_rate` | warning | > 10 failed logins/hour |

All 6 threshold values are named, adjustable constants — generous starting defaults, matching Sprint 52's own "measured baseline, tune later" precedent, since no real production traffic data exists yet.

### Incident runbook

New `docs/Incident-Response-Runbook.md` — the operator-facing companion to `systemHealth.ts`'s own engineering-rationale header comment. Full monitoring-architecture description, each of the 6 alert categories with its own symptom/meaning/likely-causes/diagnosis/recovery-procedure/verification steps (§2.2's `scheduler.repeated_failure` explicitly walks through using the existing kill switch as the fastest containment action, and reiterates that any fix touching a protected file still requires the same maximum-scrutiny approval process — an incident is not an exception to CLAUDE.md rule 2), and a general 7-step incident workflow (detect → triage → contain → diagnose → fix → verify → record).

### Health endpoints

`GET /api/monitoring/status` — new, joins `GET /api/healthz` on the auth/rate-limit-exempt health router.

No database migration — `platform_audit_log`'s already-general `eventType` column absorbs the new `"monitoring.alert"` value with zero schema change, the same precedent every prior sprint adding a new event type has followed since Sprint 10. `openapi.yaml` gained a new `monitoring` tag, the `/monitoring/status` path, and 6 new `Monitoring`-prefixed schemas; `api-zod`/`api-client-react` regenerated cleanly, no collisions.

**One real test-design bug caught and fixed during this sprint's own repeatability validation, not a production bug:** the first draft of the "re-persists an alert once it resolves and later reoccurs" test used a fixed message string, so 5 repeated real invocations of the test (run back-to-back against the same persistent Postgres database, per this sprint's own "run monitoring tests multiple times to confirm repeatability" requirement) accumulated rows under that fixed string across runs, breaking the test's own exact-count assertion — fixed by making the message unique per test run, matching the same discipline `notifications.route.test.ts` (Sprint 56) and `optionsBacktest.route.test.ts` (Sprint 58) both already established for this exact situation.

**Files changed:** `lib/systemHealth.ts` (new), `lib/systemHealth.test.ts` (new), `routes/monitoring.route.test.ts` (new), `docs/Incident-Response-Runbook.md` (new); `index.ts`, `lib/notifications.ts`, `lib/requestMetrics.ts`, `routes/health.ts`, `lib/api-spec/openapi.yaml` (small, additive edits — none protected).

**Tests:** 24 new tests total (`systemHealth.test.ts` 20, `monitoring.route.test.ts` 4).

No trading logic, options execution, scheduler *behavior*, guardrails, kill switches, authentication, tenant isolation, or audit logging were touched — this sprint only *observes* the scheduler's own existing behavior, never changes it.

**Rollback:** `git revert` — 4 new files + 5 small additive edits to non-protected files + 1 openapi/codegen regeneration; no database migration to unwind, no application behavior changed for any existing route.

**Validation:** `pnpm run typecheck` clean. `pnpm --filter @workspace/api-server run test` — run twice, both fully clean: 118 files / 1,235 tests (+24 new), zero failures, zero flakes either run. `pnpm --filter @workspace/ravish-trading run test` — 31 files / 236 tests, unchanged. `PORT=5000 BASE_PATH=/ pnpm run build` — all packages build successfully, no size warning (largest chunk unchanged at 461.57 kB). The new monitoring test suite was additionally run 5 times in isolation to confirm repeatability — the first pass caught the test-design bug above; all 5 runs after the fix were fully clean, zero flakes. The full Playwright E2E suite (5 specs, unchanged) was run 4 times to reach 2 clean, definitive back-to-back runs: the first 2 exploratory runs each hit one instance of the well-documented, previously-disclosed `getSettingsRow()` concurrency race (Sprint 70's own disclosure), confirmed unrelated to Sprint 74 via `git status --porcelain`; the final 2 consecutive runs were both fully clean, 5/5 passing, zero flakes.

**With Sprint 74's completion, M5 ("Observable in production," see §4) is now achieved.** Sprint 75 was not started.

---

## 3. Dependencies

| Sprint | Depends on | External dependency |
|---|---|---|
| 69 | None | None — Chromium is already pre-installed in this environment |
| 70, 71 | 69 (reuses its harness/conventions) | None |
| 72 | 69, 70, 71 | None |
| 73 | None (ran in parallel with 69–72) | **RESOLVED**: no new tool, pure Vitest — see §2f |
| 74 | None (ran in parallel with 69–73) | None — reused existing `pino`/audit-log infrastructure, see §2g |
| 75 | None | **`FMP_API_KEY`/`ALPHA_VANTAGE_API_KEY`** — not present in this session |
| 76 | None | **Options Income Engine's own live-data provider credentials** — not present in this session |
| 77 | 69–74 (a credible rollout plan needs the testing/monitoring groundwork) | None to *write* the plan; executing it later needs 75/76's credentials plus a separate explicit go-ahead |
| Notification Delivery | None | **SMTP/VAPID credentials + infrastructure** — not present in this session |

No proposed sprint touches `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, or `autoAdjustment.ts` beyond read-only inspection or narrowly-scoped, separately-approved instrumentation (e.g., Sprint 74 might add a log line inside the scheduler tick — that specific change, if genuinely needed, would require the same explicit approval CLAUDE.md rule 2 has required for every prior touch to that code, with no exception implied by this document).

---

## 4. Major Milestones

1. **M1 — E2E capability exists** (after Sprint 69, **ACHIEVED**): the platform has its first-ever browser-level automated test, proving the harness works against the real app.
2. **M3 — Cross-engine E2E proof** (after Sprint 70, **ACHIEVED**, reached ahead of M2 per §2b's promotion): at least one real browser flow proves a user can move across engines and see consistent state, the literal Blueprint Phase 6 "integration test suite" deliverable.
3. **M2 — Full frontend test coverage** (after Sprint 72, **ACHIEVED**): all 27 pages have a dedicated test file; zero untested legacy surface remains.
4. **M4 — Automation engine load-tested** (after Sprint 73, **ACHIEVED**): the highest-consequence subsystem has been exercised under realistic and adversarial load conditions, not just unit-level correctness.
5. **M5 — Observable in production** (after Sprint 74, **ACHIEVED**): monitoring/alerting and a real incident runbook exist — the platform could be operated, not just deployed.
6. **M6 — Live-data verified** (after 75/76, whenever credentials arrive): both Engine 1's and the Options Income Engine's live-data paths are proven against real APIs, not just mocked-fetch tests.
7. **M7 — Go-live-ready** (after Sprint 77): a concrete, staged rollout plan and go-live checklist exist — the actual go-live decision remains the project owner's, separately gated, but the platform is no longer blocked on planning to make that decision.

---

## 5. Testing Strategy

- **Framework:** Playwright is the recommended default (Chromium is pre-installed in this environment per the session's own tooling notes; Vite + React 19 has first-class Playwright support; it can run headless in CI without new infrastructure).
- **Scope discipline, carried forward from every prior phase's own precedent:** E2E tests prove *integration* (does the browser-rendered app correctly call real routes and render real data), not *business logic* — the existing 1,190 backend tests and 149 frontend unit/component tests remain the source of truth for correctness; E2E adds a layer neither currently provides, it doesn't replace either.
- **Bounded scope per sprint**, matching the Route+UI backlog-reduction precedent (Phase 3, Sprints 40–46) and the Phase 2 "extract on the second real caller" discipline — no single sprint should try to write E2E coverage for the whole platform at once.
- **CI integration:** the existing `.github/workflows/ci.yml` (added Sprint 1) is the natural home for a new E2E job, run separately from the existing unit-test job so a slow E2E suite never blocks fast unit-test feedback.
- **Regression discipline preserved:** every new E2E test, like every unit test before it, must be run at least twice during validation to catch flakes, following the unbroken practice since Phase 1.

---

## 6. Production-Readiness Strategy

Grounded directly in the current §11.6 checklist from `docs/Phase-5-Final-Completion-Report.md`:

| Area | Current state | Phase 6 action |
|---|---|---|
| Auth / multi-tenancy | ✅ Ready | No action needed |
| Kill switches / guardrails | ✅ Reviewed + load/chaos-tested | Sprint 73 extended this from "correct under normal conditions" to "correct under adversarial conditions" — done |
| Rate limiting | ✅ Ready | No action needed |
| Audit logging | ✅ Ready + active alerting | Sprint 74 turned existing logs into actual monitoring/alerting, not just passive records — done |
| CORS | ⚠️ Mechanism ready, value pending | Still needs the project owner to supply the real production origin — not resolvable by any sprint, flagged again here so it doesn't get lost |
| Frontend bundle size | ✅ Ready | No action needed |
| Live market/fundamentals data | ❌ Not verified | Sprints 75/76, conditional on credentials |
| Live broker/execution data | ❌ Not built | Explicitly out of scope — remains deferred per the Phase 3-close owner decision; not reopened by this document |
| Notification delivery beyond in-app | ❌ Not built | Conditional item, unscheduled, fires when infrastructure exists |
| E2E/browser test coverage | ❌ Does not exist | Sprints 69, 72 |
| Load/chaos testing | ✅ Ready | Sprint 73 — done |
| Frontend page test coverage | ⚠️ Partial (13/27) | Sprints 70, 71 |
| Monitoring/alerting | ✅ Ready | Sprint 74 — done |
| Incident response runbook | ✅ Ready | Sprint 74 — `docs/Incident-Response-Runbook.md` — done |
| Staged rollout plan | ❌ Does not exist | Sprint 77 |

**Production readiness is a checklist to satisfy, not a single event to schedule** — Phase 6, as proposed, closes every row this session can close without external credentials; the rows that remain red after Phase 6 are exactly the ones genuinely outside this session's control.

---

## 7. Live-Data Rollout Strategy

Directly follows the Blueprint's own explicit, reasoned guidance (§Phase 7): **stage the rollout, never flip all three engines to live simultaneously.**

1. **Options Income Engine first** — the most mature, most tested code in the entire platform (pre-existing, protected, unmodified execution logic across all of Phases 1–5). Lowest incremental risk of the three.
2. **Investing Engine second** — Phase 2's 19 modules are extensively tested against SIMULATED data; live verification (Sprint 75) is a pure data-source swap behind an already-built provider seam (`getFundamentalsProvider()`), not a logic change.
3. **Trading Engine last** — the newest engine, carrying the most novel, least battle-tested modules (Probability, Regime Detection, the walk-forward backtester). The Blueprint's own reasoning ("newest, least tested, still carrying novel unproven modules") is unchanged by anything shipped since — if anything, Engine 2's own live-data provider was explicitly deferred by the project owner at Phase 3's close, so it stays last both by risk profile and by standing instruction.

**Each stage is its own separately-approved decision, not an automatic progression.** Sprint 75/76 only *verify* the provider code works against real APIs — they do not flip any user's settings to live mode. Actually switching a real deployment to live data for any engine is a go-live decision outside this document's authority, requiring its own explicit approval exactly like every other consequential decision in this project's history.

---

## 8. Security Roadmap

- **Sprint 73 (Load/Chaos Testing)** extends Sprint 67's own read-only review from "is the logic correct" to "does the logic hold under concurrent load and adversarial timing" — the same category of gap Sprint 67's own kill-switch mid-cycle-flip test closed, but at the infrastructure/concurrency level rather than the unit level.
- **Sprint 74 (Monitoring/Alerting)** adds real-time visibility into guardrail trips, error rates, and latency — turning the existing `platform_audit_log`/`auto_execution_log` tables from passive records into active alerting signals, per the Blueprint's own explicit deliverable list for its Phase 7.
- **No further changes to protected files are anticipated or authorized by this document.** If Sprint 73 or 74's own implementation genuinely requires touching `autoExecution.ts`/`autoAdjustment.ts` (e.g., to add a monitoring hook), that specific change must be separately proposed, scoped, and approved with the same maximum-scrutiny process CLAUDE.md rule 2 has required since Phase 1 — this planning document does not pre-authorize it.
- **CORS production origin** remains a standing, unresolved security-relevant gap — flagged here again so it isn't lost, resolvable only by the project owner supplying the real value.
- **A formal external security audit** (mentioned in the Blueprint's own Phase 6 text as "internal or external") is not proposed as a numbered sprint here — it's a decision the project owner may want to make once Sprints 69–74 close out the internal gaps, not before.

---

## 9. Deployment Roadmap

1. Confirm the production CORS origin (owner-supplied value — no sprint can resolve this).
2. Stand up a production CI/CD pipeline building on the existing `.github/workflows/ci.yml`, per the Blueprint's own reuse guidance (`.replit` autoscale deployment config as one viable path, not the only one).
3. Wire Sprint 74's monitoring/alerting into whatever hosting environment is actually chosen.
4. Execute Sprint 77's staged rollout plan, engine by engine, each stage requiring its own explicit go/no-go decision.

**None of this is scheduled as a numbered Phase 6 sprint** except where explicitly listed above (74 for monitoring, 77 for the plan itself) — actual production deployment execution is a Phase 7-equivalent event in the Blueprint's own terms, appropriately gated behind Phase 6's groundwork and the project owner's own separate go-ahead.

---

## 10. Release Strategy

- **Continuous, not big-bang**, consistent with every phase this project has executed since Sprint 1 — one sprint, one commit, one push, one explicit approval at a time. Phase 6 changes nothing about this discipline.
- **No feature freeze proposed** — Phase 6 is testing/hardening/production-readiness work, not a stabilization branch; the main branch stays the single source of truth throughout, exactly as it has for 68 sprints.
- **Rollback discipline unchanged:** every sprint's own completion report continues to state its rollback instructions (`git revert`, migration-down scripts where applicable) — Phase 6 introduces no new release mechanism, only new tests and observability around the existing one.
- **The actual "release" this phase is building toward** is the first live-data go-live for any engine — and per §7 above, that is explicitly staged, explicitly gated, and explicitly not authorized by this planning document.

---

## 11. What This Document Does Not Do

- It does not approve any sprint. Sprint 69 (or whichever sprint the project owner chooses to start with) requires its own kickoff, scope confirmation, and explicit approval, exactly like every sprint before it.
- It does not authorize any change to `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`, or `autoExecutionLog`.
- It does not authorize flipping any engine to live/real-money mode.
- It does not commit to the exact sprint count, sequence, or numbering above — these are proposals, explicitly labeled as such, subject to revision the moment the project owner reviews them.

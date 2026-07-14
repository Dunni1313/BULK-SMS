# Phase 4 — Final Execution Plan

**Status: IN PROGRESS. Sprint 52 (Platform Hardening) is shipped** — see §10 for the as-built write-up. A readiness review (`docs/Phase-4-Readiness-Report.md`) preceded implementation, confirming Sprint 52 was ready to begin exactly as scoped. Sprint 53 onward remains planning only until each sprint's own pre-implementation plan is separately approved, per the established per-sprint process (`CLAUDE.md` §3).

**Prepared after:** an initial draft (superseded by this document — see §0 for what changed and why), Phase 3's close (`docs/Phase-3-Final-Completion-Report.md`), a fresh review of `docs/DK-AI-OS-Architecture-Blueprint.md`, `CLAUDE.md`'s full sprint history (Phases 1–3, 51 shipped sprints), and direct inspection of the current codebase — including confirming, by grep, that no rate-limiting library, no notification/email infrastructure, and no observability/metrics stack exists anywhere in the codebase today. Sprint numbering continues the project's single global counter: Phase 1 was Sprints 1–10, Phase 2 was Sprints 11–31, Phase 3 was Sprints 32–51. **Phase 4 begins at Sprint 52.**

---

## 0. Architecture Review — What Changed From the Draft, and Why

The original draft plan (13 sprints, Sprints 52–64) was reviewed against the completed Phase 3 codebase before any implementation began, per explicit instruction. Four changes resulted:

1. **Cut the draft's "Shared ScoreCard/hard-cap-override utility" sprint entirely.** This project has a consistent, proven convention — `classifyMarginOfSafety()` (Phase 2 Sprint 12) and `classifyAgreementSignal<T>()` (Sprint 17) were both extracted only once a *second real caller* already needed the identical logic, never speculatively ahead of one. Direct inspection confirms no sprint anywhere in this finalized plan creates a new risk-scoring module that would need this pattern — extracting it now would have zero concrete consumer, the exact "designing for a hypothetical future requirement" this project has otherwise avoided throughout Phases 1–3. The three existing implementations (`portfolioHealth.ts`/`risk.ts` in Engine 3, `investingRisk.ts` in Engine 1, `tradingRisk.ts` in Engine 2) are working code and stay untouched; if a genuine fourth consumer appears in a future phase, extract it then.
2. **Split the draft's single "Options Engine-Native Backtesting" sprint into two** (Core, then Route+UI). As one sprint it under-stated its own true scope — the same scope Sprint 49 needed a full sprint for on the *easier* domain (single-instrument candles, not multi-leg options pricing). The Route+UI half is given an explicit off-ramp: proceed only once Core's own output has proven meaningfully more trustworthy than the existing fabricated-statistics generator.
3. **Folded the draft's "Options Engine route audit" sprint into Platform Hardening (Sprint 52).** As drafted it had no concrete scope of its own beyond "whatever the platform-wide pass missed" — not a deliverable, a placeholder. Its one genuine concern (excluding scheduler-internal calls from user-facing rate limits) is now an explicit line item in Sprint 52's own acceptance criteria instead of a second thin sprint.
4. **Added a new "Alerts & Notifications" sprint.** Direct inspection found this platform has no push-based capability of any kind today — Sprint 27's watchlist target-crossing check and Sprint 38's Risk Management hard-cap breach detection are both pull-only (a user must open a page to see them). This is a genuine institutional-grade gap the draft plan never addressed. Its exact delivery channel (in-app notification center vs. email vs. push) is flagged as a real owner decision, not assumed, matching how the Live Market-Data Provider was handled at the close of Phase 3.

Net: 13 sprints in, 13 sprints out (−1 cut, −1 folded, +1 split, +1 added), but every sprint that survived is now either more tightly scoped, more honestly sized, or reuses an existing engine service more explicitly than the draft required.

---

## 1. Framing: What Phase 4 Actually Is

The project owner's own framing for this phase names all three long-term DK engines:

1. **Institutional Investing Engine (Fundamental Analysis)** — Engine 1, built in Phase 2 (Sprints 11–31, 21 sprints, complete).
2. **Institutional Trading Engine** — Engine 2, built in Phase 3 (Sprints 32–51, 20 sprints, complete) — explicitly marked **"now complete"**.
3. **Options Income Engine** — Engine 3, the original pre-existing system — explicitly marked **"enhancements only — core already exists."**

Read together, Phase 4 is an **enhancement and consolidation phase across a platform where all three engines' cores already exist**, not a fourth engine. By the same logic that makes Engine 3 "enhancements only," Engine 1's Phase 4 work is additive depth on Phase 2's foundation, not a rebuild. Engine 2 needs no further core work at all; its role in Phase 4 is as a **reuse target** — proven infrastructure other sprints compose, never re-derive.

Four workstreams, in recommended order:

- **A. Platform Cross-Cutting Foundation** — housekeeping flagged as technical debt across Phases 1–3, done once, centrally, before it compounds further.
- **B. Cross-Engine Consolidation & Platform Capabilities** — the platform-level "one coherent product" work the Blueprint always envisioned, plus the one genuine institutional-grade capability gap this review surfaced (alerting).
- **C. Options Income Engine (Engine 3) Enhancements** — additive, never touching the protected execution/risk/kill-switch code.
- **D. Institutional Investing Engine (Engine 1) Enhancements** — additive, closing gaps Phase 2's own sprint reports explicitly flagged as deferred future work.

---

## 2. Final Sprint Sequence

| Sprint | Workstream | Module | Objective |
|---|---|---|---|
| 52 | A | Platform Hardening — **SHIPPED** | See the as-built write-up in §10. Rate-limiting middleware across every route, the CORS mechanism confirmed finalized, and a lightweight request-volume baseline informed real (measured, not guessed) threshold values. |
| 53 | A | Frontend Bundle Code-Splitting — **SHIPPED** | See the as-built write-up in §10. Route-level `React.lazy()` for all 28 pages plus a single `<Suspense>` boundary; no `manualChunks` config needed — Rollup auto-split `recharts` on its own. Largest chunk 436.95 kB, under the 500kB threshold. |
| 54 | B | Cross-Engine Command Center — **SHIPPED** | See the as-built write-up in §10. Extended the Institutional Dashboard with a new Cross-Engine Verdict section pairing Engine 1's Investment Committee verdict with Engine 2's Market Regime technical read — zero new routes, zero new engine calculations, both cards resolve independently. |
| 55 | B | Macro/Regime Side-by-Side View | Show `marketBriefing.ts` (Engine 3), `investingMacro.ts` (Engine 1), and `tradingRegime.ts` (Engine 2)'s three independent regime reads side-by-side for context — pure UI, zero engine-logic merging. |
| 56 | B | Alerts & Notifications | Reuse Sprint 27's watchlist target-crossing check (Engine 1) and Sprint 38's Risk Management hard-cap breach detection (Engine 2) as the trigger sources for a new notification capability — **delivery channel (in-app center / email / push) is an explicit owner decision to make at this sprint's own kickoff, not assumed here.** |
| 57 | C | Options Engine-Native Backtesting (Core) | A genuine walk-forward options-strategy backtest replaying real simulated price paths bar-by-bar through actual options-pricing math, replacing the trust gap in `routes/backtest.ts`'s existing fabricated-statistics generator (which is left in place, unmodified, as a parallel legacy path). **Must evaluate reusing `MarketDataProvider`'s (Engine 2, Sprint 32) existing candle generation for the underlying price path before writing any new price-simulation code** — a disclosed fallback to an independent generator is acceptable only if that reuse is genuinely incompatible, and the incompatibility must be documented, not assumed. `optionsMath.ts` is read from for pricing/Greeks, never modified. |
| 58 | C | Options Engine-Native Backtesting (Route + UI) | **Conditional on Sprint 57's own output proving valuable** — a route + results UI for the new engine, mirroring the Core-then-Route+UI split that served every Phase 3 module well. |
| 59 | C | AI Options Coach — Conversation Memory Parity | Bring the options coach's UI to the same session-local Q&A history/streaming UX Engine 1's and Engine 2's coach panels already have (Sprints 30, 48) — frontend-only; `coach.ts`'s deterministic math and disclaimer enforcement untouched. |
| 60 | D | Document Intelligence — Additional Document Types | Extend `EdgarDocumentProvider` (Sprint 22) to implement 10-Q and earnings-transcript ingestion — the `DocumentType` union already anticipates these; zero interface change needed. |
| 61 | D | AI Investment Committee — LLM-Narrated Synthesis | Upgrade the Committee's Sprint 17 deterministic-only reasoning to genuine `ai-core`-narrated synthesis, reusing the `narrate()`/`enforceDisclaimer()` pattern already proven three times (options coach, Engine 1's value coach, Engine 2's trade coach). |
| 62 | D | Live FMP/Alpha Vantage Provider Verification | **Conditional on API credentials becoming available.** Pure verification of already-built, mocked-fetch-tested code paths — no new logic. Can run in parallel with any other sprint; produces nothing if credentials never arrive. |
| 63 | D | Management Quality Analysis — LLM-Narrated Dimensions | Fill in the 4 dimensions Sprint 23 explicitly left `unavailable` pending "LLM reading comprehension" (Strategic Consistency, Long-Term Focus, Communication Quality, Shareholder Alignment). **Depends on Sprint 61** — the lower-compliance-risk sibling upgrade must prove the pattern first, since CLAUDE.md itself names this module "the highest reputational/compliance risk in Engine 1." The Sprint 23 guarantee (never characterize a named individual, only the company's process-discipline signals) must be explicitly re-confirmed at this sprint's own kickoff, not assumed to carry over silently. |
| 64 | — | Phase 4 Unification & Regression Pass | Full-platform regression proving all 3 engines plus the new Cross-Engine Command Center (Sprint 54) and Alerts (Sprint 56) resolve consistently for one symbol/one user, zero fabricated results anywhere. Closes Phase 4. |

---

## 3. Sprint-by-Sprint: Dependencies, Effort, Risk, Acceptance Criteria

| Sprint | Dependencies | Effort | Risk | Acceptance Criteria |
|---|---|---|---|---|
| 52 | None | S | Moderate (misconfigured limits can break the scheduler's own internal calls) | Rate-limiting live on every route; scheduler-internal calls provably excluded; CORS list finalized and documented; a request-volume baseline exists and was used to set threshold values (not guessed). |
| 53 | None | S | Low | Production bundle's largest chunk is under Vite's default 500kB warning threshold; frontend test suite passes unmodified. |
| 54 | None (both source engines already complete) | M | Low | One symbol lookup shows Engine 1's Investment Committee verdict and Engine 2's technical read on one screen; read-only, zero new engine calculations; live end-to-end test proves both resolve concurrently for the same symbol. |
| 55 | None | S | Low | All 3 engines' regime reads visible together for one symbol; zero engine-logic merging; each read is independently attributable to its own originating engine. |
| 56 | Owner decision on delivery channel | M–L (depends on channel chosen) | Moderate (new delivery infrastructure, first of its kind in this codebase) | Every alert traces to an existing, already-tested detection (watchlist target-crossing or risk hard-cap breach) — zero new detection logic; a user can enable/disable alerts; no alert is ever sent for SIMULATED data without being labeled as such. |
| 57 | None (both `MarketDataProvider` and `optionsMath.ts` already exist and are stable) | L | **High** — closest proximity to protected code of any Phase 4 sprint | A genuine bar-by-bar walk-forward simulation (not fabricated statistics) produces a trade log and equity curve for at least one real options strategy; `optionsMath.ts`/`execution.ts`/`risk.ts` provably unmodified (`git diff --stat`); the `MarketDataProvider` reuse evaluation is documented in the sprint's own completion report regardless of outcome. |
| 58 | **Sprint 57**, and Core proving valuable | M | Low | Route + results UI mirror the pattern `routes/tradingBacktest.ts`/`pages/TradingBacktest.tsx` already proved; `routes/backtest.ts` (legacy) provably unmodified. |
| 59 | None | S | Low | Options coach UI reaches the same empty/loading/error/history states Engine 1/2's coach panels already have; zero changes to `coach.ts`'s math or disclaimer enforcement. |
| 60 | None | M | Low | 10-Q and earnings-transcript ingestion honestly degrade (never fabricate) exactly like the existing 10-K path; `DocumentType` union needed no shape change. |
| 61 | None | M | Moderate (LLM-narration correctness, not a technical risk) | Committee's narrated reasoning carries the same disclaimer invariants every other `ai-core` consumer does; deterministic fallback still exists and is tested when the LLM is unavailable. |
| 62 | External credentials only | S (if it runs at all) | Low | Live provider calls succeed against the already-built, already-tested code path; no new logic written. |
| 63 | **Sprint 61** | M | **High (compliance/reputational, not technical)** | Zero named-individual characterization anywhere in the new dimensions' output — explicitly re-tested, not assumed inherited from Sprint 23's own design; the same honest-unavailable discipline applies to any dimension that still can't be genuinely computed. |
| 64 | All prior Phase 4 sprints | S | Low | Live end-to-end test proves the full platform (all 3 engines + Command Center + Alerts) resolves consistently for one symbol/one user with zero 404s; unknown-symbol honest-null proven across every module touched this phase. |

*(Effort key: S = roughly one Phase-3-style bounded sprint; M = a full sprint at the upper end of Phase 3's own sprint sizes; L = comparable to Sprint 49's own full-engine build-out.)*

---

## 4. Major Milestones

- **Milestone A — Platform Hardened** (Sprints 52–53): rate-limiting live with a documented, data-informed threshold; CORS finalized; frontend bundle within Vite's default warning threshold.
- **Milestone B — One Coherent Platform, With Push Capability** (Sprints 54–56): the Cross-Engine Command Center ships — the first point in this project's history where a user sees Engine 1's fundamental verdict, Engine 2's technical read, and Engine 3's options-income context for the same symbol on one screen; the platform gains its first push-based (not pull-only) capability.
- **Milestone C — Options Income Engine Enhanced** (Sprints 57–59): a genuine walk-forward options backtest exists alongside the legacy statistics-based one, if Core proves its own value; the options coach reaches UX parity with Engines 1/2.
- **Milestone D — Institutional Investing Engine Enhanced** (Sprints 60–63): Document Intelligence covers more filing types; the AI Investment Committee and (contingent) Management Quality Analysis both gain genuine LLM-narrated reasoning, closing two of Phase 2's own explicitly-disclosed deferred-work items.
- **Milestone E — Phase 4 Complete** (Sprint 64): full-platform regression passes; a Phase 4 completion report is delivered, mirroring this document's own role at Phase 3's close.

---

## 5. Reuse Strategy

**Engine 2 services this plan reuses, and where:**

- **`MarketDataProvider` (`lib/tradingMarketData.ts`, Sprint 32)** — **required** evaluation target for Sprint 57's underlying price-path generation, the first genuine cross-engine *data* reuse (not just read-only analysis reuse) attempted in this platform's history.
- **`buildProbabilityAnalysis()` and the full Structure→Multi-Timeframe→Liquidity→Regime→Probability chain (Sprints 33–37)** — read-only context source for Sprint 54's Command Center.
- **`tradingRegime.ts`'s output** — read-only source for Sprint 55's side-by-side view.
- **`tradingRisk.ts`'s existing `capBreached` flags** — the direct, required trigger source for Sprint 56's risk-side alerts; no new breach-detection logic.
- **`classifyAgreementSignal<T>()`** (Phase 2 Sprint 17, reused again in Phase 3 Sprints 34/51) — the template any future "does everyone agree" scoring in Phase 4 should follow if the need arises; no sprint in this plan currently needs a new instance.
- **`lib/ai-core`'s `narrate()`/`narrateStream()`/`enforceDisclaimer()`** — the proven template for Sprints 59/61/63, already serving 3 coach/narration domains with zero shared-machinery changes needed.

**Not reused, deliberately:** `trading_positions`/`trading_journal_entries` (Engine 2's own user-authored data) stay out of any Phase 4 consolidation — the Phase 3 plan already ruled out merging these with Engine 1's portfolio construction or Engine 3's executed trades, for reasons that still hold.

---

## 6. Technical Risks

Ranked by genuine risk, not effort:

1. **Sprint 57 (Options-Native Backtesting, Core) — highest technical risk.** Closest proximity to protected code (`optionsMath.ts`) of any Phase 4 sprint. Must stay strictly read-only against it, the same discipline `valueReport.ts`/`valueInvesting.ts` already proved safe for Engine 1 (Phase 2, Sprint 11). Any design that can't stay read-only must be re-scoped, not worked around.
2. **Sprint 63 (Management Quality LLM dimensions) — highest compliance/reputational risk, not technical.** CLAUDE.md already names this category "highest reputational/compliance risk in Engine 1." Sprint 23's own never-characterize-a-named-individual guarantee must be explicitly re-verified for the new dimensions, not assumed to carry over.
3. **Sprint 52 (Rate-limiting) — moderate technical risk.** Misconfigured limits could throttle the auto-execution scheduler's own internal calls; explicit exclusion is now a named acceptance criterion, not left implicit.
4. **Sprint 56 (Alerts & Notifications) — moderate risk, first-of-its-kind infrastructure.** No prior precedent in this codebase for outbound delivery (email/push); whichever channel the owner decision selects, this is genuinely new infrastructure, not a composition of existing pieces the way most of this plan is.
5. **Everything in Workstream B otherwise (Sprints 54–55) and Workstream D's non-LLM sprints (60, 62) are low risk** — read-only composition or pure verification over already-complete, already-tested engines.

---

## 7. Success Criteria for Phase 4

- A user can see all three engines' own verdicts for one symbol on one screen (Command Center), with zero new engine-logic duplication.
- Every route in the platform is rate-limited, with a documented, data-informed threshold — not a guessed one — and zero legitimate scheduler-internal traffic throttled.
- At least one genuinely alertable event (a watchlist target crossing or a risk hard-cap breach) can reach a user without them having to open the app and check, via whichever delivery channel the owner decision selects.
- If built, the options-native backtest produces a real, non-fabricated trade log and equity curve, coexisting with (not replacing) the legacy generator until it's proven trustworthy.
- The AI Investment Committee's reasoning is genuinely LLM-narrated, with the same disclaimer/fallback guarantees every other `ai-core` consumer has.
- Zero protected files (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`, `autoExecutionLog`) modified anywhere in the phase.
- Full regression suite green across all three engines at Sprint 64's close, mirroring the exact bar Sprints 31 and 51 both cleared at their own phases' close.

---

## 8. Recommended Pre-Coding Work (Not a Sprint)

- **A lightweight request-volume baseline before Sprint 52 sets any rate-limit threshold** — folded into Sprint 52 itself (see §2), not a separate sprint, since sizing a limit without real traffic data would be guessing, not engineering.
- **A `CLAUDE.md` housekeeping pass is worth considering before Phase 4 adds a fourth phase's worth of sprint entries** — the file has grown very large across three phases' detailed sprint histories. Archiving Phase 1–2's entries to a separate historical file while keeping the live document leaner would reduce context overhead for every future session without losing any information. This is flagged as worth doing, not scheduled as a numbered sprint, since it's pure documentation housekeeping with zero code impact.

---

## 9. What This Plan Deliberately Does Not Include

- **No implementation.** Per the explicit instruction, this document is planning only.
- **No work on the protected files** beyond read-only consultation, anywhere in this plan.
- **No live Market-Data Provider work for Engine 2** — remains explicitly deferred per the project owner's own instruction at Phase 3's close; nothing in Phase 4 requires or blocks on it.
- **No monorepo restructure** — Phase 3's own §25 Decision 1 (no restructure) continues to apply.
- **No forced consolidation** of the three independent SIMULATED price generators or the three user-authored position/journal/portfolio schemas — both evaluated and explicitly left alone, for stated reasons.
- **No speculative shared-utility extraction** (see §0.1) — the codebase's own proven "extract on the second real consumer" discipline is preserved, not preempted.
- **No backup/disaster-recovery or MFA work** — real gaps, explicitly flagged (§0 framing, missing-capabilities review), but out of scope for a feature-enhancement phase without their own dedicated, separately-approved decision.

---

## 10. Sprint-by-Sprint As-Built Notes

### Sprint 52 — Platform Hardening — SHIPPED

- **No new `AskUserQuestion` needed** — the plan itself already named every genuine owner decision this sprint could surface; the one real open item (the actual production CORS origin value) is confirmed still unresolved and documented as such, not guessed.
- **Confirmed by direct inspection before writing any code:** the auto-execution/auto-adjustment scheduler never makes an HTTP request to this server — it calls `runAutoExecutionCycleForAllUsers()`/`runAutoAdjustmentCycleForAllUsers()` as plain in-process function calls. There was nothing to build a "scheduler-internal calls" bypass for; this is documented in `middlewares/rateLimit.ts`'s own header comment rather than silently omitted.
- **New `lib/requestMetrics.ts`** — the plan's own required request-volume baseline: an in-memory counter, pino-logged every 5 minutes, no new dependency. **The Sprint 52 threshold values are a measured baseline, not a guess** — every existing route test file was grep-counted for its own peak per-server-instance request volume before any threshold was set (busiest: `portfolioConstruction.route.test.ts` at 23); the general limit (300 req/60s) was set at >10x that.
- **New `middlewares/rateLimit.ts`** — `express-rate-limit`-based, two tiers: a general limiter across every `/api` route, and a stricter `authRateLimiter` (20 req/60s default) scoped to `/api/auth/*`.
- **One real bug caught and fixed by this sprint's own validation:** the first implementation mounted `authRateLimiter` alongside `authRouter` in one `app.use("/api", ...)` call, which — since Express does not restrict a co-mounted middleware to only the sub-paths a later router matches — applied the stricter auth limit to every `/api/*` route in the app, not just auth ones. Caught by the new live end-to-end test (a non-auth route's rate-limit header showed the auth tier's threshold), fixed by scoping the mount to the literal `/api/auth` path prefix.
- **Health checks are exempt from rate-limiting by mount order** (mounted before either limiter), never a special-cased skip.
- **Test-mode safety:** both limiters skip entirely whenever `NODE_ENV === "test"` unless `FORCE_RATE_LIMIT_IN_TEST=true` is explicitly set — the ~1,000+ pre-existing tests were never at risk of tripping a shared, accumulating limit, confirmed by two clean full-suite runs.
- **New `TRUST_PROXY` env var** (opt-in, safe default) for real reverse-proxy deployments, without blindly trusting a spoofable header when none is present.
- **CORS finalization:** confirmed the existing Sprint-6 `CORS_ALLOWED_ORIGINS` mechanism is the complete, correct, finalized approach for Owner Decision #6 — no code change needed; `.env.example` clarified to state this explicitly.
- **Tests:** `lib/requestMetrics.test.ts` (4), `middlewares/rateLimit.test.ts` (4, isolated app), `routes/rateLimit.route.test.ts` (5, live end-to-end against the real `app.js`, including the SSE-stream-passes-through-uncut proof the readiness report specifically flagged).
- **Rollback:** `git revert` — purely additive; `pnpm remove express-rate-limit` if the dependency itself needs removing.
- **Validation:** `pnpm run typecheck` clean. `pnpm --filter @workspace/api-server run test` — 97 files / 1,041 tests (13 new), fully clean on both runs, zero flakes. `pnpm --filter @workspace/ravish-trading run test` — 11 files / 94 tests, unchanged. `PORT=5000 BASE_PATH=/ pnpm run build` — all 3 packages build successfully.

### Sprint 53 — Frontend Bundle Code-Splitting — SHIPPED

- **No new `AskUserQuestion` needed** — the plan's own scope (route-level `dynamic import()`/`manualChunks`, pure build-tooling change, zero behavior change) was unambiguous.
- **Every one of `ravish-trading`'s 28 page components (`App.tsx`) converted from a static `import` to `React.lazy(() => import(...))`** — each page becomes its own on-demand chunk instead of shipping in one large up-front bundle; `<Switch>` (inside `AppLayout`) wrapped in a single `<Suspense fallback={<PageLoadingFallback />}>`. The sidebar/nav/header still render immediately from the main bundle; only the page-content area shows a skeleton fallback while a route's own chunk downloads.
- **Verified empirically that route-level lazy-loading alone satisfies the acceptance criteria, no `manualChunks` config needed** — Rollup's own automatic shared-dependency extraction split `recharts`' heavy `generateCategoricalChart` module into its own separate chunk (377.58 kB) once it was imported by multiple independently-lazy-loaded pages rather than one monolithic bundle. `vite.config.ts` needed zero changes.
- **Acceptance criterion confirmed via a real production build:** largest chunk `index-BDgbSl4c.js` at 436.95 kB, under Vite's default 500 kB warning threshold, with no "chunks larger than 500 kBs" warning printed.
- Every page's own component, props, routing path, and behavior are byte-for-byte unchanged; only how and when its JS arrives in the browser changed.
- **New `App.test.tsx`** — the first test in this codebase to exercise the real router end-to-end (every other page test renders its own page component directly, bypassing `App.tsx`/wouter entirely, so all of them are structurally unaffected and needed no modification — confirmed by grepping for any existing `render(<App` usage before this sprint: none existed).
- **A previously-undocumented, pre-existing project guardrail was discovered and had to be respected, not modified:** `src/test/page-test-pattern.guardrail.test.ts` fails any test file combining `vi.resetModules()` with `vi.doMock()`/a dynamic relative `import()`, per its own doc comment, because that pattern "has repeatedly broken under parallel CPU load" — independently corroborated within this same session by Sprint 52's own rate-limit test file needing an identical redesign for the same reason. `App.test.tsx`'s first draft used exactly that forbidden pattern (to get fresh router state per navigated route) and was rejected by the guardrail; fixed by following the codebase's established reliable pattern (`vi.hoisted()` + top-level `vi.mock()` + a STATIC `import App from "./App"`, matching `pages/Trades.test.tsx`'s reference shape) and driving navigation via `window.history.pushState()` before each fresh `render()` call — wouter's browser-location hook reads `window.location` reactively on mount, so no module reset was needed.
- **Two jsdom-gap stubs added to the shared `src/test/setup.ts`:** `window.matchMedia` (new this sprint — `AppLayout`'s `useIsMobile` hook requires it, and `App.test.tsx` is the first test to render `AppLayout` rather than a bare page component) alongside the pre-existing `ResizeObserverStub` (Sprint 18 precedent).
- **Two hook-level test-fixture mocks needed for the same first-ever-`AppLayout`-render reason:** `useListTradeAdjustments` (`@workspace/api-client-react`) stubbed to an empty array, and `useSession` (`@/lib/auth-client`) stubbed to an honest "no session" — both via the established "override just the specific hooks needed, spread `importActual` for the rest" pattern every other page test already uses.
- **Tests:** `App.test.tsx` (4 tests — Suspense-fallback-then-real-content on `/login`, a `/settings` navigation mounting real content, an unknown path rendering the honest `NotFound` page rather than a fabricated route, two different routes mounting two genuinely different pages' own content on fresh renders).
- No trading logic, options execution, scheduler behavior, guardrails, kill switches, authentication, tenant isolation, audit logging, or any backend file were touched — frontend-only sprint; the entire `artifacts/api-server` tree has a zero-line diff, confirmed via `git diff --stat`. No database migration.
- **Rollback:** `git revert` — purely additive/mechanical; no dependency changes, no schema changes.
- **Validation:** `pnpm run typecheck` clean. `pnpm --filter @workspace/api-server run test` — run twice per instruction: first run hit the well-documented, previously-disclosed `fetchedAt`-timing race in `fundamentals.investingUniverse.test.ts` (first noted in Sprint 16's report, recurring in Sprints 19/20/24/27/46/49; confirmed via `git status --porcelain` that this file is untouched by Sprint 53) — 96 files passed / 1 failed, 1040/1041 tests passed; second run fully clean — 97 files / 1,041 tests, zero failures — confirming the flake's established transient nature, not a Sprint 53 regression. `pnpm --filter @workspace/ravish-trading run test` — 12 files / 99 tests (5 new: 4 in `App.test.tsx` plus 1 new guardrail sub-check for the new file), all passing. `PORT=5000 BASE_PATH=/ pnpm run build` — all 3 packages build successfully; largest frontend chunk 436.95 kB, no size warning.

### Sprint 54 — Cross-Engine Command Center — SHIPPED

- **No new `AskUserQuestion` needed** — the plan's own dependency line already resolved the only real choice ("None (both source engines already complete)"); extending the existing `InstitutionalDashboard.tsx` (Sprint 50) was the natural, lower-effort path since it already owns the per-symbol search state Engine 2's signals use.
- **Zero new engine calculations, zero new backend routes** — both reads this sprint pairs were already shipped and independently tested: `GET /stock-analyst/value/:symbol` (Engine 1, its `investmentCommittee` field since Phase 2 Sprint 17) and `GET /trading/regime/:symbol` (Engine 2, Phase 3 Sprint 42).
- **The Engine 1 side is one new frontend call** to `useGetValueReport(symbol)` — an existing generated hook that was unused anywhere in the frontend until now, since `StockResearch.tsx` instead streams a narrated report through a heavier SSE endpoint this card deliberately doesn't need for a plain verdict read.
- **The Engine 2 side reuses the `regime` object the signal grid below was already fetching** — not a second fetch, not a new computation.
- **New "Cross-Engine Verdict" section** on `InstitutionalDashboard.tsx`, positioned above the existing 5-signal grid, pairing an "Engine 1 — Investment Committee" card with an "Engine 2 — Technical Read" card — both cards resolve independently and concurrently, so a failure on one side never blocks the other, proven by a dedicated test.
- **One small local helper, deliberately not shared:** `committeeVerdictBadgeClass()` was added directly to `InstitutionalDashboard.tsx`, not to `trading-format.tsx`, since Investment Committee's Buy/Hold/Wait vocabulary is Engine 1's own and that shared module's own header comment establishes it holds only Engine 2's vocabulary. `agreementBadgeClass()` (already shared, already matches Investment Committee's `agreement` enum exactly) was reused as-is.
- **Tests:** 2 new `InstitutionalDashboard.test.tsx` cases (both cards render together in the same grid — the literal "on one screen" proof — and an honest Engine-1-error-doesn't-block-Engine-2 proof) plus one pre-existing test updated for the new advisory copy; new `routes/crossEngineCommandCenter.route.test.ts` (5 live end-to-end tests — both routes individually resolve, resolve concurrently with zero 404s, 404 consistently for an unknown symbol across both, and neither engine's response gained a field belonging to the other).
- No trading logic, options execution, scheduler behavior, guardrails, kill switches, authentication, tenant isolation, or audit logging were touched; `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts` have a zero-line diff this sprint. No database migration, no `openapi.yaml` change.
- **Rollback:** `git revert` — purely additive; no dependency, schema, or route changes to unwind.
- **Validation:** `pnpm run typecheck` clean. `pnpm --filter @workspace/api-server run test` — 98 files / 1,046 tests (5 new), fully clean on both runs, zero flakes. `pnpm --filter @workspace/ravish-trading run test` — 12 files / 101 tests (2 new), all passing. `PORT=5000 BASE_PATH=/ pnpm run build` — all 3 packages build successfully; largest frontend chunk 437.34 kB, still under the 500 kB threshold Sprint 53 established.

---

*This plan makes no code changes beyond what its own Sprint-by-Sprint As-Built Notes (§10) record as actually shipped, sprint by sprint, with explicit approval at each step. Every file path and behavior claim in §§0–9 was verified by direct inspection of the actual repository at the close of Phase 3, including confirming by grep the absence of rate-limiting, notification, and observability infrastructure — not assumed from prior planning documents alone.*

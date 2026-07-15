# Phase 5 — Final Execution Plan

**Status: IN PROGRESS.** All four flagged scope decisions have been resolved by the project owner (§2). **Sprint 65 (Housekeeping & Outstanding Decisions Closure), Sprint 66 (Unified Portfolio Dashboard, side-by-side view only), and Sprint 67 (Testing & Security Audit checkpoint — first bounded slice) are all SHIPPED** — see §3 for all three as-built write-ups. A pre-Sprint-66 milestone review (§3b) confirmed Phases 3–5 are accurately documented, no incomplete work was left behind, every deferred item is explicitly tracked, and all protected files remain zero-diff across the entire Sprint 32–65 range. Sprint 68 onward remains planning only until each sprint's own pre-implementation plan is separately approved, per the established per-sprint process (`CLAUDE.md` §3). Sprint numbering continues the project's single global counter: Phase 1 was Sprints 1–10, Phase 2 was Sprints 11–31, Phase 3 was Sprints 32–51, Phase 4 was Sprints 52–64 (12 shipped; Sprint 62 blocked, open). **Phase 5 began at Sprint 65.**

**Prepared after:** Phase 4's close (`docs/Phase-4-Final-Completion-Report.md`), a fresh reconciliation of `docs/DK-AI-OS-Architecture-Blueprint.md`'s original 7-phase roadmap against what this repository's own phase-by-phase execution actually did (§0, unchanged from the draft), and the project owner's explicit resolution of the four scope decisions the draft surfaced (§2).

---

## 0. Reconciling the Blueprint's Original Roadmap With What Actually Shipped

The Blueprint (§5) laid out 7 phases: Foundation → Investing Engine → Trading Engine → **Options Income Engine (move + harden existing code)** → **Integration** → Testing → Production. This repository's actual execution diverged from that numbering starting at Phase 4 — a deliberate, disclosed choice each time, not drift:

- **Phase 1–3 matched the Blueprint exactly:** Foundation, Investing Engine, Trading Engine.
- **The executed "Phase 4"** (`docs/Phase-4-Master-Execution-Plan.md`, Sprints 52–64) was **not** the Blueprint's original Phase 4 ("Options Income Engine — move + harden"). It was a fresh architecture review's own construction: platform hardening, frontend performance, and — genuinely significant for this reconciliation — **it already delivered a meaningful slice of the Blueprint's original Phase 5 ("Integration")**: the Cross-Engine Command Center (Sprint 54), the Macro/Regime Side-by-Side View (Sprint 55), and Alerts & Notifications (Sprint 56, the platform's first push-based capability, satisfying part of the Blueprint's "Notification delivery" deliverable).

**Net effect: the Blueprint's original Phase 4 (Options Income move+harden) was never executed as its own phase, and Phase 5 (Integration) is now partially, not fully, satisfied.** Direct inspection at Phase 5-planning time confirmed what's actually still missing from each:

**From the Blueprint's original Phase 4 (Options Income Engine), still outstanding:**
- The "composable strategy builder" — confirmed by direct inspection of `optionsMath.ts`: today there are exactly 4 hand-built strategy functions (`buildIronCondor`, `buildIronFly`, a calendar-spread equivalent, `buildEarnings`, keyed by a `WIN_RATE_BASE` lookup of `iron_condor`/`iron_fly`/`calendar_spread`/`earnings`), not a generalized composable engine. This is squarely inside `optionsMath.ts`, a CLAUDE.md-protected file. **Resolved (§2, decision 1): deferred indefinitely.**
- Live-data end-to-end verification for the options engine's own providers remains unproven (distinct from, but analogous to, Sprint 62's still-blocked Engine 1 live-provider verification). **Remains an open candidate, unscheduled (§4).**
- The `trades` table was never migrated into a "shared Portfolio DB schema" — Phase 1 Sprint 4/7 added `userId` scoping to it in place, which satisfied the *multi-tenancy* half of "move to shared platform," but no cross-engine portfolio schema unification happened. Superseded by decision 2 below (side-by-side view only — no schema unification needed for that scope).

**From the Blueprint's original Phase 5 (Integration), still outstanding after Phase 4's partial delivery:**
- **Unified Portfolio Dashboard (stocks + options combined)** — **RESOLVED (Sprint 66, §3):** shipped as a side-by-side view only, no blended net-worth computation, per Decision 2.
- **Cross-engine Reporting** — `dailyReport.ts` remains Engine-3-only. No decision has been made on this yet; remains an open candidate, unscheduled (§4).
- **Unified Settings UI** — `settings` is already one shared per-user table/route (`routes/settings.ts`, since Phase 1 Sprint 5), so the *data layer* is already unified; whether the `Settings.tsx` *page* should be reorganized is a smaller, optional UX question, not tracked as a Phase 5 deliverable unless separately raised.
- **Cross-engine AI Assistant routing** — does not exist. **Resolved (§2, decision 3): skip. The three existing specialized coach panels (Engine 1/2/3) stay as they are.**
- **Notification delivery beyond in-app** (email/push/webhook) — Sprint 56 shipped in-app only, by the project owner's own explicit choice at that sprint's kickoff (no real SMTP/push credentials or infrastructure existed in this session). **Unchanged, still blocked** — no new decision was needed since nothing about the underlying blocker (no credentials) has changed.

**Genuinely new since the Blueprint was written, not in its original 7-phase list at all, and not resolved by Phase 4:**
- Sprint 62 (Live FMP/Alpha Vantage Provider Verification) — still blocked on credentials. Unaffected by Phase 5.
- Two housekeeping items flagged since the original Technical Audit: `ravish-trading-engine.zip` and `artifacts/mockup-sandbox`. **RESOLVED (Sprint 65, §3):** the zip is kept as an intentional archival backup (investigated, confirmed safe to remove, but explicitly not deleted per the project owner's instruction — revisit after a future release); `mockup-sandbox` is documented (`artifacts/mockup-sandbox/README.md`) and kept as active design tooling.
- Two items from CLAUDE.md §3's own outstanding-decisions list: `stock_analysis_history` per-user-vs-shared caching (item #3), the `OPENAI_API_KEY` deprecation window (item #7). **RESOLVED (Sprint 65, §3)** — both closed as documentation-only decisions, zero code change; see `CLAUDE.md` §3 for the exact resolution text.
- The Blueprint's own Phase 6 (Testing/Security Audit) — **RESOLVED (Sprint 67, §3):** a first bounded slice shipped, a dedicated read-only security review of the auto-execution/auto-adjustment kill-switch and guardrail logic plus the genuine test-coverage gaps it surfaced. The broader Blueprint Phase 6 deliverables (frontend coverage sweep, full cross-engine integration suite, load/chaos testing) remain unscoped candidates for a future sprint.

---

## 1. Sequencing Rationale

No better sequencing than the draft's own candidate ordering was found during this finalization pass. The project owner's own choice — housekeeping and outstanding decisions first — matches the exact precedent Phase 4 itself set (Sprint 52, Platform Hardening, ran before any cross-engine feature work) and is the lowest-risk possible opening sprint for a new phase: every item in Sprint 65's scope is either read-only investigation, a documentation-level decision closure, or a small, additive, non-protected-file change — nothing in it touches execution logic, guardrails, or any money-moving path. This is consistent with, not a deviation from, the draft.

---

## 2. Owner Decisions — RESOLVED

| # | Decision | Resolution |
|---|---|---|
| 1 | Composable Strategy Builder (protected `optionsMath.ts`/`execution.ts`) | **Deferred indefinitely.** Not scheduled. Revisit only on a future explicit owner request, with the same maximum-scrutiny process CLAUDE.md rule 1 requires for any change to that code. |
| 2 | Unified Portfolio Dashboard (stocks + options) | **Side-by-side view only** — a page pairing Engine 1's Portfolio Construction and Engine 3's Portfolio/Portfolio AI views, no blended net-worth computation. Not yet scheduled to a specific sprint number; remains an open candidate (§4). |
| 3 | Cross-Engine AI Assistant Routing | **Skip.** The three existing specialized coach panels (options, investing, trading) stay exactly as they are; no fourth unifying chat surface will be built. |
| 4 | Sprint 65 priority | **Housekeeping + outstanding CLAUDE.md decisions first.** Scoped in §3 below. |

**No code will be written under decisions 1–3** (deferred/skipped). Decision 4 is what Sprint 65 (§3) implements, pending the project owner's separate, explicit approval of that specific sprint's proposal.

---

## 3. Sprint 65 — Phase 5 Housekeeping & Outstanding Decisions Closure — SHIPPED

**One change from the original proposal, per the project owner's explicit instruction:** `ravish-trading-engine.zip` was **not** deleted, despite the investigation below confirming it would have been safe to remove. It is kept, treated as an intentional archival backup, with removal deferred to a future release rather than acted on now.

- **`ravish-trading-engine.zip`** — confirmed by direct inspection (`unzip -l`) to be a full point-in-time monorepo backup: 860KB compressed, 2.7MB / 451 files uncompressed, covering `.agents/memory/`, `artifacts/` (including a snapshot of `mockup-sandbox`), `lib/`, `scripts/`, and root config files, dated May 28–June 8, 2026 — fully redundant with git history and unreferenced by any build, CI config, or doc. **Kept unchanged**, per the project owner's explicit instruction; `CLAUDE.md` §3 item #8 documents the investigation findings and the decision to defer removal.
- **`artifacts/mockup-sandbox`** — confirmed by `git log` to have existed unchanged since the very first commit: a 60-file Vite + Radix-UI design/prototyping sandbox with its own `package.json`/`vite.config.ts`, still typechecked and built every sprint via the monorepo-wide `pnpm run build`, never wired into the shipped product. Resolved with a new `artifacts/mockup-sandbox/README.md` documenting its purpose and its deliberate exclusion from the production application — the Technical Audit's own "document ongoing purpose" branch, chosen over archiving/deleting a working 60-file tool.
- **`stock_analysis_history` per-user-vs-shared-cache decision** (CLAUDE.md §3 item #3) — confirmed by schema inspection to already be fully per-user (`userId` FK, `NOT NULL`, `ON DELETE RESTRICT`, enforced since Phase 1 Sprint 4), with 21+ Phase 2 sprints and every Phase 4 sprint built on that assumption. Resolved as a pure documentation closure — per-user confirmed as the final design, no shared-cache optimization planned, zero code change.
- **`OPENAI_API_KEY` deprecation window** (CLAUDE.md §3 item #7) — resolved the same way: the Sprint 2 fallback stays open indefinitely (negligible maintenance cost, no evidence any real deployment has migrated off it, removing it would be a pure breaking change with no offsetting benefit), zero code change to `coachLLM.ts`/`@workspace/ai-core`.

**Zero feature work, zero database migrations, zero changes to any protected file** — `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts` confirmed zero-line diff via `git diff --stat`. Files changed: `CLAUDE.md` (§3 items #3, #6, #7, #8, #9 resolved) and the new `artifacts/mockup-sandbox/README.md` — nothing else. No new test surface was introduced, so the existing suites were run once each rather than flake-checked twice, per the sprint's own pre-approved validation plan.

**Validation:** `pnpm run typecheck` clean (including `mockup-sandbox`). `pnpm --filter @workspace/api-server run test` — 107 files / 1,162 tests, fully clean. `pnpm --filter @workspace/ravish-trading run test` — 16 files / 134 tests, all passing, unmodified. `PORT=5000 BASE_PATH=/ pnpm run build` — all packages, including `mockup-sandbox`, build successfully.

---

## 3a. Pre-Sprint-66 Milestone Review

Performed before Sprint 66's own implementation began, covering Phases 3–5 (Sprint 32 through Sprint 65):

- **Documentation accuracy:** every commit from Sprint 52 through Sprint 65 (16 commits: 12 shipped Phase 4 sprints, 1 blocked-sprint commit, 3 Phase 5 planning commits) is correctly reflected in `CLAUDE.md`, the Phase 4 plan's roadmap/dependency tables and all 13 `§10` as-built subsections, and this Phase 5 plan. Two small stale cross-references were found and fixed (commit `8a2a4da`, documentation-only): this plan's own top status line still said Sprint 65 hadn't shipped after it had, and `CLAUDE.md`'s Sprint 65 entry reported test results vaguely instead of with the exact counts every other entry states.
- **No incomplete implementation items:** a full diff scan (`git diff 1c8c273~1..HEAD`) for `TODO`/`FIXME`/`XXX` markers introduced across Sprints 52–65 found zero genuine hits.
- **Every deferred item explicitly documented:** cross-referenced Sprint 62, the Composable Strategy Builder, Unified AI Chat Routing, Notification Delivery beyond in-app, the Live Market-Data Provider, and the Testing & Security Audit checkpoint — each traces to a specific, named decision with a stated reason in at least one of the three living docs, never silently dropped.
- **Protected files:** `git diff --stat` across the **entire Phase 3–5 range** (Sprint 32's own baseline commit through Sprint 65, not just Phase 4–5) confirms zero-line diff on `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`. A direct content scan of all five files for incomplete-work markers also came back clean.
- **Technical debt noted, none blocking:** no formal Testing & Security Audit checkpoint has ever run (Blueprint Phase 6); 3 known, long-standing, transient test-flake categories remain (none ever blocking); the CORS production origin value is still a real deployment-time gap; `uuid` vs `serial` (CLAUDE.md item #5) is effectively settled by 65 sprints of unbroken precedent but never formally marked resolved; the frontend's largest bundle chunk has crept from 436.95 kB to ~460.6 kB, still comfortably under the 500 kB threshold.

Full findings delivered in chat per the project owner's request; this section is the durable record.

---

## 3b. Sprint 66 — Unified Portfolio Dashboard (side-by-side view only) — SHIPPED

Implements Decision 2 exactly as scoped: a page pairing Engine 1's Portfolio Construction and Engine 3's real trades-backed account, side by side, with no blended net-worth or combined-allocation computation.

- New, always-visible "Portfolio Overview" section on `InstitutionalDashboard.tsx`, positioned directly above the existing Portfolio Risk/Journal/Backtest row — not gated by the page's per-symbol search, since a portfolio isn't scoped to a single symbol lookup (matching that row's own Sprint 50 precedent).
- **Zero new backend routes, zero new engine calculations.** Reuses `useGetPortfolios()` (Engine 1, already powering `PortfolioConstruction.tsx`'s own list) and `useGetPortfolioSummary()` (Engine 3, already powering `PortfolioAI.tsx`'s own cockpit) — both already generated, both already used elsewhere in the frontend; this is the first time either is fetched inside `InstitutionalDashboard.tsx` itself.
- Engine 1's card shows portfolio count + total holdings count (summed from the list endpoint's own summary shape, avoiding an N+1 per-portfolio detail fetch). Engine 3's card shows account value, total P&L (color-coded), and open-position count, reusing the page's existing `fmtUsd` helper and badge conventions.
- Icons reused directly from `AppLayout.tsx`'s own nav (`Briefcase` for Portfolio Construction, `PieChart` for Portfolio) rather than picking new ones.
- Each card links out to its own full page (`/stock-analyst/portfolio-construction`, `/portfolio`) for management actions — the same "link out, don't re-implement" pattern every other summary card on this page already follows.
- Honest empty states when a user has no portfolios/no account activity, never a fabricated "0".

**Files changed:** `artifacts/ravish-trading/src/pages/InstitutionalDashboard.tsx`, `artifacts/ravish-trading/src/pages/InstitutionalDashboard.test.tsx` — nothing else. No database migration, no `openapi.yaml` change (both consumed endpoints already existed and were already documented).

**Tests:** 5 new `InstitutionalDashboard.test.tsx` cases — the section's always-visible honest-empty-state proof, both cards' real-data rendering with an explicit proof that no blended/combined net-worth text ever appears anywhere on the page, the two outbound links, and a proof the section persists whether or not a symbol has been searched. All 14 tests in the file (9 existing + 5 new) passed on the first isolated run.

No trading logic, options execution, scheduler behavior, guardrails, kill switches, authentication, tenant isolation, or audit logging were touched; `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts` have a zero-line diff this sprint — frontend-only, the entire `artifacts/api-server` tree is untouched.

**Rollback:** `git revert` — two frontend files, no database migration to unwind, no backend changes.

**Validation:** `pnpm run typecheck` clean. `pnpm --filter @workspace/api-server run test` — run twice per the explicit instruction: the first run hit the well-documented, previously-disclosed `fetchedAt`-timing race in `value.test.ts`'s own SIMULATED-determinism check (confirmed via `git status --porcelain` that `value.test.ts`/`fundamentals.ts` are both untouched by Sprint 66) — 106 files passed / 1 failed, 1,161 tests passed / 1 failed; the second run was fully clean — 107 files / 1,162 tests, zero failures. `pnpm --filter @workspace/ravish-trading run test` — 16 files / 138 tests (5 new), all passing. `PORT=5000 BASE_PATH=/ pnpm run build` — all 3 packages build successfully; largest frontend chunk 460.62 kB, still comfortably under the 500 kB threshold Sprint 53 established.

---

## 3c. Sprint 67 — Testing & Security Audit checkpoint (first bounded slice) — SHIPPED

Resolved via `AskUserQuestion` before any work began: of the two live (non-blocked) Phase 5 candidates in §4, the project owner chose the Testing & Security Audit checkpoint over the Cross-Engine Daily Report, scoped to a dedicated, read-only security review of the auto-execution/auto-adjustment kill-switch and guardrail logic (`execution.ts`, `autoExecution.ts`, `autoAdjustment.ts`, `risk.ts`), plus any genuine test-coverage gaps it surfaces — the Blueprint's own explicitly-named highest-priority sub-item.

**Read-only with respect to the protected files, per CLAUDE.md rule 2's maximum-scrutiny requirement.** New `.agents/memory/kill-switch-security-review.md` is the durable record of the review. Summary:

- **No bug or security gap was found in the protected logic itself.** Every invariant already documented in `auto-execution-engine.md`/`trade-adjustment-engine.md` was independently re-verified against the current source and holds: two-switch (opening) / three-switch (adjustment, master checked before subordinate) gating; per-user single-flight; the live gate re-check before EVERY execution/close (not once per cycle); the shared risk path (`buildTicket` → `decideCandidate` → `executeValidatedTicket`, identical to the manual/semi-auto submission path); the restricted `AUTO_ACTIONABLE` subset (never roll/convert); audit logging that never changes accounting on a write failure; and genuine per-user query isolation throughout both engines.
- **One previously-undocumented safety property was found and recorded** (not a gap): `autoAdjustment.ts` re-confirms a trade's `open` status immediately before closing it, a second independent check beyond the initial open-trades snapshot, guarding against a race with a manual close landing mid-cycle.
- **The manual trigger routes were confirmed NOT to be a bypass path** — `POST /execution/auto/run`/`/execution/auto/adjust/run` call the exact same gated cycle functions the scheduler uses; calling them while disarmed reports `blocked: true`, never executes anything.
- **Three genuine test-coverage gaps were found and closed, all purely additive:**
  1. No integration-level regression test existed for a kill-switch flip occurring *mid-cycle* — the exact historical bug the live re-check was built to prevent. Closed by new `lib/autoExecutionSecurityReview.test.ts` (2 tests: a mocked side effect disarms the switch between the first and second candidate/trade for each engine, proving the loop halts on the second one).
  2. `routes/autoExecution.ts` had zero dedicated route-level tests. Closed by new `routes/autoExecution.route.test.ts` (5 live end-to-end HTTP tests: status shape, both manual triggers honestly blocked with the correct precedence-ordered reason at either the master or subordinate level, and both audit logs resolving correctly).
  3. No test proved the kill-switch fields themselves are audit-logged. Closed by one new case in `auditLog.test.ts` (a fresh isolated user, `PATCH /settings` flipping both switches, confirming the audit row's `changedFields` names them without ever carrying the boolean values).

**Files changed:** `.agents/memory/kill-switch-security-review.md` (new), `artifacts/api-server/src/lib/autoExecutionSecurityReview.test.ts` (new), `artifacts/api-server/src/routes/autoExecution.route.test.ts` (new), `artifacts/api-server/src/lib/auditLog.test.ts` (one new case appended) — nothing else. No database migration, no `openapi.yaml` change, no frontend change.

**Tests:** 8 new tests total (2 + 5 + 1), all passed on the first isolated run.

No trading logic, options execution, scheduler behavior, guardrails, kill switches, authentication, tenant isolation, or audit logging were *modified*; `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts` have a zero-line diff this sprint, confirmed via `git diff --stat`.

**Rollback:** `git revert` — one new memory doc, two new test files, one existing test file with one new case appended; no database migration to unwind, no production code changed anywhere.

**Validation:** `pnpm run typecheck` clean. `pnpm --filter @workspace/api-server run test` — run twice per the explicit instruction, both fully clean: 109 files / 1,170 tests (+8 new), zero failures, zero flakes either run. `pnpm --filter @workspace/ravish-trading run test` — 16 files / 138 tests, unchanged — no frontend change this sprint. `PORT=5000 BASE_PATH=/ pnpm run build` — all 3 packages build successfully; largest frontend chunk unchanged at 460.62 kB.

---

## 4. Open Candidates — Unscheduled, No Sprint Number Yet

These remain genuine Phase 5 candidates per the Blueprint reconciliation (§0) but have no committed sprint number. Each will need its own kickoff and explicit approval when the project owner chooses to schedule it, per the established per-sprint process:

- **Cross-Engine Daily Report** spanning all three engines (Blueprint Phase 5) — no decision made yet on whether this is wanted.
- **Options Income Engine — Live-Data End-to-End Verification** (Blueprint Phase 4) — conditional on live broker/data credentials, likely blocked the same way Sprint 62 is.
- **Testing & Security Audit checkpoint — remaining scope** (Blueprint Phase 6) — the broader deliverables beyond Sprint 67's own first bounded slice (a frontend test-coverage gap sweep, a full cross-engine integration suite, load/chaos testing for the scheduler-driven automation engine) remain unscoped.
- **Notification Delivery — email/push channels** — remains blocked without real SMTP/push credentials or infrastructure, unchanged since Sprint 56.

**No code will be written for any item in this section** until it is separately scoped, presented, and explicitly approved.

# Project Baseline — v1.4.0 Sprint L1

**Snapshot date:** 2026-07-26
**HEAD:** `af73230dd2de084295f8eab8170039958ff5cb3c` (branch `main`, merge commit for PR #8)
**Repository:** `Dunni1313/BULK-SMS` ("DK AI Institutional Investing & Trading OS")

This is a point-in-time baseline, written immediately after merging Learning
Centre Sprint L1 (Foundation) into `main`. It exists to give a fresh session
— human or AI — an accurate, verified picture of where the project stands,
without needing to re-derive it from the full commit history. For the
exhaustive, phase-by-phase build record, see `CLAUDE.md`; for release-level
summaries, see `CHANGELOG.md` (currently stale — see Technical Debt below).

---

## 1. Current platform capabilities

A three-engine institutional platform, one shared platform layer:

- **Engine 1 — Institutional Investing Engine.** Company research,
  valuation models (Graham/DCF/Buffett/blended), economic moat, quality
  scoring, industry comparison, portfolio construction/optimisation, an
  AI Investment Committee, and an Institutional Mentor.
- **Engine 2 — Institutional Trading Engine.** Market structure,
  multi-timeframe trend, liquidity, market regime, probability, risk
  management, trade planning, a trading journal, and an AI Trading Coach.
- **Engine 3 — Options Income Engine.** The original, mature DK Option
  Engine — scanner, execution, portfolio management, Greeks, automation
  (kill-switch-gated), and its own AI coach. This remains the foundation
  every later engine builds alongside, not on top of.
- **Cross-engine layer.** Command Centre, Institutional Dashboard,
  Executive Intelligence, a Cross-Engine Command Center/Workspace, and
  now the **Learning Centre** — a unified educational hub spanning all
  three engines plus platform mechanics.
- **Platform services.** Authentication (Better-Auth) with full
  multi-tenant isolation, a platform-wide audit log, rate limiting,
  monitoring/alerting, Alpaca paper-trading integration, and an
  automation kill switch gating all auto-execution/auto-adjustment.

**New in this baseline (v1.4.0 Sprint L1):** the Learning Centre gained a
Learning Home Dashboard (category navigation, Continue Learning, Recently
Viewed, Bookmarks), a shared lesson-rendering template, bookmark support,
Command Palette search integration for bookmarked content, and a reusable
"Ask AI Coach" launcher — plus 3 fully-populated foundation lessons
(Platform Basics & Navigation, Command Centre, Learning Centre Overview)
establishing the template for every future lesson.

## 2. Repository health

| Signal | Status |
|---|---|
| `pnpm run typecheck` | ✅ Clean (all 5 typechecked packages) |
| `PORT=5000 BASE_PATH=/ pnpm run build` | ✅ All packages build successfully |
| Backend tests | ✅ 244 files / 2,866 tests, run twice post-merge, fully clean, zero failures |
| Frontend tests | ✅ 111 files / 1,281 tests, fully clean |
| Local `main` vs. remote `main` | ✅ Fully synchronised at `af73230` |
| Protected execution files | ✅ Zero-line diff since Sprint 11 (the last legitimate touch — a behaviour-preserving re-export shim in `optionsMath.ts`) |
| Lint | No `lint` script exists anywhere in this repository; `typecheck` is the established static-analysis gate in its place |
| Total commits on `main` | 316 |
| `docs/*.md` files | 175 |
| Real frontend pages (excl. tests) | 87 |
| Manual DB migrations | 39, sequential, hand-reviewed (`nullable → backfill → enforce`) |

A mid-session local Postgres crash occurred twice during this sprint's own
validation (under heavy concurrent build+test load in this sandbox) —
diagnosed from the cluster's own log as an environment/resource-limit
issue, not a code defect; the cluster was restarted both times and
validation re-run cleanly afterward. Not expected to recur in a normal
deployment environment with adequate resources.

## 3. Architecture status

- **Monorepo**: pnpm workspaces. Backend `artifacts/api-server` (Express
  5, Drizzle/Postgres). Frontend `artifacts/ravish-trading` (React 19 +
  Vite + wouter + TanStack Query + shadcn/Radix). Shared `lib/db`,
  `lib/api-spec` (OpenAPI source of truth) → `lib/api-zod` +
  `lib/api-client-react` (Orval-generated).
- **Auth/multi-tenancy**: Better-Auth, real sessions, every business route
  ownership-scoped via `getScopedUserId(req)` + `and(eq(id), eq(userId))`.
- **Automation safety**: a master kill switch (Settings) gates all
  auto-execution/auto-adjustment; every guardrail check happens live,
  immediately before each action, not once per cycle. Untouched this
  sprint and every sprint since Sprint 11.
- **AI narration**: `lib/ai-core` — a shared, provider-agnostic core
  (`narrate()`/`narrateStream()`) enforcing disclaimers centrally; every
  engine's coach is a thin domain layer on top of it, never a duplicate
  implementation.
- **Learning Centre** (this baseline's own focus): `lib/learningPaths.ts`
  (11 learning paths incl. the new Platform Basics), `lib/glossary.ts`
  (118 terms across 10 categories incl. the new "platform" category),
  `lib/learningProgress.ts` (per-user view/complete/bookmark tracking on
  one `learning_progress` table), and a new shared frontend component set
  (`LessonRenderer`, `BookmarkButton`, `AskCoachLauncher`,
  `RelatedGlossaryBadges`).

## 4. Completed milestones

- **v1.0.0** — First stable release (Version 1 freeze declared).
- **v1.1.0** — Sidebar Navigation Redesign.
- **v1.2.0** — Trade Execution Center.
- **v1.3.0 / v1.3.1** — AI Trading Coach (backend + UI).
- **v1.3.2** — Version 1 Polish Sprint.
- **✓ v1.4.0 Sprint L1 — Learning Centre Foundation** (this baseline).
  Merged via PR #8, merge commit `af73230`.

## 5. Outstanding roadmap

**Learning Centre (immediate):**
- Sprint L2 — Core Lesson Library (the remaining ~65 lessons across the
  10 pre-existing paths, using the L1-established `LessonRenderer`
  template)
- Sprint L3 — Trading Academy
- Sprint L4 — Guided Tours
- Sprint L5 — Example Mode
- Sprint L6 — Certifications & Quizzes

**Longer-standing, previously-disclosed and still open (per `CLAUDE.md`),
unaffected by this sprint:**
- Live market-data/broker provider verification (FMP/Alpha Vantage/Alpaca)
  — blocked on real API credentials, not present in any session to date.
- The Composable Strategy Builder — deferred indefinitely per an explicit
  project-owner decision (touches protected `optionsMath.ts`/`execution.ts`).
- A Testing & Security Audit checkpoint's remaining scope (frontend
  legacy-page coverage sweep, browser-level E2E for the newer surfaces,
  load/chaos testing) — no committed sprint number yet.

## 6. Test counts

| Suite | Files | Tests | Result |
|---|---|---|---|
| Backend (`api-server`) | 244 | 2,866 | ✅ Pass (run twice post-merge) |
| Frontend (`ravish-trading`) | 111 | 1,281 | ✅ Pass |

## 7. Build status

`PORT=5000 BASE_PATH=/ pnpm run build` succeeds for all 3 packages
post-merge. The frontend build prints its own pre-existing "chunks larger
than 500 kB" warning (the shared `index-*.js` entry chunk at ~575.9 kB and
a `recharts`-derived `generateCategoricalChart-*.js` chunk at ~377.6 kB) —
confirmed, by inspecting the named chunks, to contain no Learning Centre
code and to already have been the two largest chunks before this sprint.

## 8. Technical debt (disclosed, none newly introduced this sprint)

- **`CHANGELOG.md` is stale** — its newest entry is `v1.3.1`; it is
  missing both `v1.3.2` (already merged, PR #7) and this sprint's
  `v1.4.0`. Not updated as part of this sprint, since it wasn't part of
  the requested scope — flagged here for a deliberate decision on who
  updates it and when.
- **`README.md`'s own version banner is stale** — it reads "Version
  1.2.0," several releases behind the repository's actual current state.
  Same disclosure as above.
- **`ravish-trading-engine.zip`** (repo root, ~860 KB) and
  **`artifacts/mockup-sandbox`** — both previously reviewed and
  explicitly kept (not deleted) per prior project-owner direction; still
  present, unchanged, and out of scope for this sprint.
- **Remote branch cleanup** — several already-merged feature branches
  remain on `origin` and were not deleted after their own merges
  (`v1.1.0-sidebar-redesign`, `v1.2.0-trade-execution-center`,
  `v1.3.0-ai-trading-coach`, `v1.3.1-ai-trading-coach-ui`,
  `v1.3.2-version1-polish`), plus 4 apparently-unrelated stray branches
  (`claude/gold-scalping-indicator-SFGCD`,
  `claude/gold-trading-data-pipeline-QBJD8`,
  `claude/torah-titans-design-PCkyR`,
  `claude/sprint-1-inspection-validation-o9mlsk`) and
  `docs/repository-baseline-sync`. **This sprint's own
  `v1.4.0-learning-centre` branch was deleted locally but could not be
  deleted on the remote** — this session's git proxy rejected the
  deletion (`HTTP 403`, the same class of restriction previously
  disclosed for annotated-tag pushes), and no GitHub API tool for
  deleting a ref is available in this session's toolset. **This branch
  needs to be deleted manually** (GitHub's PR page shows a "Delete
  branch" button on a merged PR) or by a session with broader git-proxy
  permissions.

No new technical debt was introduced by Sprint L1 itself — every new
component/route/column is additive, and the quality-review pass actually
reduced pre-existing debt (the glossary-badge duplication across 3 files).

## 9. Recommended next sprint

**Sprint L2 — Core Lesson Library.** Populate the remaining ~65 lessons
across the 10 pre-existing learning paths (Foundations, Greeks,
Volatility, Strategies, Portfolio, Performance, Institutional,
Institutional Investing, Trading Engine, Strategy Framework) using the
`LessonRenderer` template and 13-field content shape this sprint
established and proved out on 3 real lessons. This is the natural next
step per the frozen Learning Content Master Plan's own phased order, and
requires no new infrastructure — only content authored against the
already-built, already-tested template.

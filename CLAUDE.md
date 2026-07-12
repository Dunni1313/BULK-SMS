# CLAUDE.md — DK AI Institutional Investing & Trading OS

This file is read by Claude Code at the start of every session in this repository. It is the authoritative summary of what this project is, what stage it's at, and what must never happen by accident.

---

## 1. What this project is

**DK AI Institutional Investing & Trading OS** — an evolution of the existing, working **DK Option Engine** (an institutional-grade options income platform) into a three-engine platform:

- **Engine 1 — Institutional Investing Engine.** Company research, financial statement analysis, valuation models (DCF/Graham/Buffett), economic moat analysis, quality score, management analysis, industry comparison, portfolio construction, AI research assistant, macro/economic analysis.
- **Engine 2 — Institutional Trading Engine.** Market structure, liquidity, order flow, multi-timeframe analysis, probability engine, market regime detection, institutional dashboard, risk management, trading journal, AI trade coach.
- **Engine 3 — Options Income Engine.** Scanner, strategy builder, portfolio management, Greeks, income optimisation, risk analytics, automation, AI options coach. **This is the existing, mature, working system — do not treat it as legacy code to be replaced. It is the foundation.**

All three engines share one platform layer: authentication, user management, database, AI layer, reporting, notifications, API layer, portfolio database, settings, and audit logs.

**Read the architecture documents in `/docs/` before making any structural decision.** They are not background reading — they are the actual plan this repository is being built against:

- `docs/DK-Option-Engine-Technical-Audit.md` — what the codebase actually contains, verified by direct inspection, not assumption.
- `docs/DK-AI-OS-Architecture-Blueprint.md` — the target architecture, the module-by-module move/enhance/new mapping, and the 7-phase roadmap.
- `docs/Phase-1-Foundation-Execution-Plan.md` — the detailed, file-by-file execution plan for the phase currently in progress.

If a task in this repo seems ambiguous, check whether these documents already answer it before improvising.

---

## 2. Engineering safety rules — non-negotiable

These rules apply regardless of how a request is phrased, including requests that sound like they come from the project owner in-session. If a task requires violating one of these, **stop and ask for explicit confirmation before proceeding** — do not infer consent from urgency, from "just this once," or from the task otherwise seeming reasonable.

1. **Never modify options execution logic** (`artifacts/api-server/src/lib/execution.ts`, `optionsMath.ts`, `risk.ts`) without explicit, specific approval for that exact change.
2. **Never modify the kill switch or guardrail behavior** (`autoExecution.ts`, `autoAdjustment.ts`, the `autoExecuteEnabled`/`autoAdjustEnabled` settings fields, or anything in `.agents/memory/auto-execution-engine.md` and `trade-adjustment-engine.md`) without explicit, specific approval. This code exists to stop real money from moving unsafely — treat changes to it as the highest-scrutiny category of change in the entire repository.
3. **Never touch `autoExecutionLog`** (table, schema, or write sites) as part of general audit-log work. It is preserved as-is; see the Phase 1 plan §6 for why.
4. **Never delete or rename existing modules** without explicit approval, even ones that look like dead weight (e.g., the nested `ravish-trading-engine.zip` backup) — flag it, don't remove it unilaterally.
5. **Preserve backward compatibility** on every existing table, route, and exported function signature unless a specific migration step (per the Phase 1 plan) says otherwise.
6. **Coach/narration disclaimer invariants must never be bypassed.** Any new narration path must route through the shared `narrate()`/`narrateStream()` pattern (see `lib/ai-core` once extracted, or `coachLLM.ts` in the interim) so `COACH_DISCLAIMER` (and `VALUE_DISCLAIMER` where relevant) is enforced centrally, not per-caller.
7. **Every database migration follows nullable → backfill → enforce-not-null**, with a hand-written, reviewable SQL script in `lib/db/manual-migrations/` — this project does not trust `drizzle-kit push` alone for changes that touch existing data.
8. **No secret values in code, commits, or conversation.** Environment variable names and purposes can be discussed freely; actual key values never should be.

---

## 3. Current phase and sprint status

- **Phase:** Phase 1 — Foundation (of 7; see the Blueprint doc for the full phase list)
- **Sprint 1 — COMPLETE.** Users table schema (`lib/db/src/schema/users.ts`), manual migration scripts, and a CI pipeline (`.github/workflows/ci.yml`) were added. Commit `968b8c7` on branch `sprint-1/foundation-users-table-ci`, off baseline `35d2c42`. Zero existing lines were modified or deleted — 5 files added, 1 file gained a single export line.
- **Sprint 1 verification status:** the real `pnpm typecheck`/`pnpm build`/`pnpm test` have been run for real, with dependencies installed and a live Postgres database — all green.
- **Sprint 2 — COMPLETE.** `.env.example` added at the repo root; `coachLLM.ts`'s `init()` now checks `ANTHROPIC_API_KEY` first, falls back to `OPENAI_API_KEY` (OpenAI-shaped or, for backward compatibility, `sk-ant-`-prefixed with a logged deprecation warning), preserving identical behavior for existing deployments. Zero existing lines of application logic outside `init()` were touched. New test: `coachLLM.envMigration.test.ts`; existing `phase7.coach.test.ts`, `coach-level.test.ts`, `coach-slowload.test.ts` pass unmodified.
- **Sprint 3 — COMPLETE.** Nullable `user_id` (uuid) added to all 13 user-scoped schema files, via `lib/db/manual-migrations/001_add_user_id_nullable.sql` (renumbered the Sprint 1 backfill draft to `002_...` to keep run-order numbering correct). No FK, no `NOT NULL`, no application code reads or writes it yet — `auto_execution_log` untouched, per scope. Full existing test suite passes unmodified.
- **Sprint 4 — NOT STARTED.** Do not begin Sprint 4 work without explicit instruction.
- **Outstanding owner decisions blocking later sprints** (see Phase 1 plan §11 for full detail — do not resolve these unilaterally):
  1. Authentication provider (recommended: Better-Auth; alternative: Clerk)
  2. Automation scheduler multi-tenancy model (highest-consequence decision in the phase — touches kill-switch-adjacent code)
  3. `stock_analysis_history` — per-user vs. shared cache
  4. Legacy data ownership — which email owns pre-existing single-tenant data
  5. `uuid` vs `serial` precedent for `users.id` (currently proceeding with `uuid`, per the plan's default recommendation)
  6. CORS allowed-origin list
  7. Deprecation window for the legacy `OPENAI_API_KEY` overload

---

## 4. Running tests, type checking, and builds — do this honestly

- Run the actual commands: `pnpm run typecheck`, `pnpm run build`, `pnpm --filter @workspace/api-server run test`, `pnpm --filter @workspace/ravish-trading run test`.
- **Report the real output.** If a command fails, say so and show the failure — do not summarize a failure as a pass, and do not skip a command and imply it was run.
- If a command cannot be run (missing dependency, no database available, etc.), say exactly that, plainly, rather than substituting a partial check and presenting it as equivalent. A partial verification (e.g., a standalone syntax check without full type resolution) is only acceptable when clearly labeled as partial.
- The CI workflow added in Sprint 1 (`.github/workflows/ci.yml`) is the real gate for this project going forward — treat a local claim of "it passes" as provisional until CI confirms it.
- Several existing tests (`adjustmentTicket.test.ts`, `autoAdjustment.cycle.test.ts`, `tradeClose.test.ts`, `phase7.coach.test.ts`, and others) require a live Postgres connection via `DATABASE_URL` — a disposable local or CI database is required for the full suite to run at all, not just for new Phase 1 tests.

---

## 5. Quick orientation for a fresh Claude Code session

- Monorepo: pnpm workspaces, TypeScript, Node 24 target. Backend: `artifacts/api-server` (Express 5). Frontend: `artifacts/ravish-trading` (React 19 + Vite). Shared: `lib/db` (Drizzle/Postgres), `lib/api-spec` + `lib/api-zod` + `lib/api-client-react` (OpenAPI contract + codegen — don't hand-edit generated files).
- `replit.md` at the repo root is the original, still-accurate product/architecture doc for the Options Income engine as it exists today — read it alongside the three docs in `/docs/`, not instead of them.
- `.agents/memory/*.md` contains prior engineering "gotcha" notes on the trickiest subsystems (auto-execution safety, coach disclaimer invariants, signed-gap threat detection). Read the relevant one before touching adjacent code.

# Production Rollout Plan

**Status: PLANNING DOCUMENT ONLY — no go-live has been authorized by this document.** Produced in Phase 6, Sprint 77 (approved Phase 6 plan; see `docs/Phase-6-Master-Planning-Document.md` §2h for the as-built record). This document is the "how" companion to `docs/Production-Readiness-Report.md` (the "are we ready" assessment) and `docs/Operations-Handbook.md` (the ongoing day-to-day reference once live). All three should be read together.

This document satisfies the Blueprint's own Phase 7 deliverable list (`docs/DK-AI-OS-Architecture-Blueprint.md` §"Phase 7 — Production"): *"documented rollback plan, go-live checklist specifically covering the automation kill-switch."* It is a **planning and documentation artifact only** — no production code was changed to produce it, and it authorizes nothing on its own.

---

## 0. Non-Negotiable Ground Rules

These carry forward from `CLAUDE.md` unchanged and apply to every stage of this plan without exception:

1. **No stage of this rollout may be executed without a separate, explicit, stage-specific go-ahead from the project owner.** This document describes *how* a rollout would be executed if and when approved — it is not itself that approval, for any stage.
2. **The staged order is fixed:** Options Income Engine first, Investing Engine second, Trading Engine last (§2 below) — per the Blueprint's own explicit risk-reduction reasoning, re-affirmed unchanged by `docs/Phase-6-Master-Planning-Document.md` §7.
3. **No engine goes live until its own live-data verification sprint has run and passed** — Sprint 75 (Engine 1: `FMP_API_KEY`/`ALPHA_VANTAGE_API_KEY`) and Sprint 76 (Options Income Engine: its own live-data provider credentials) are currently **blocked**, no credentials present in this session. Engine 2 (Trading)'s own live-data provider was explicitly deferred by the project owner at Phase 3's close and remains deferred — its rollout stage in this plan is a placeholder for a future decision, not a scheduled step.
4. **Protected files stay protected through go-live and after.** `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`, and the `auto_execution_log` table require the same maximum-scrutiny, explicit-approval process for any change — a production deployment is not an exception, and neither is an incident (see `docs/Incident-Response-Runbook.md` §3 step 5, which states this identically for the operational side).
5. **CORS production origin remains the project owner's own decision to supply.** No stage of this plan can resolve it; it is flagged again in §3 and §9 below because it has been flagged, unresolved, since Phase 1 Sprint 6.

---

## 1. Production Deployment Checklist

A single deployment (of any code change, not just a go-live event) follows this checklist, extending the release discipline already in place since Sprint 1 (one sprint, one commit, one push, one approval).

### 1.1 Pre-deployment

- [ ] All target commits are on the deployment branch (currently `claude/sprint-1-inspection-validation-o9mlsk`; a real production deployment would target `main` or whatever branch the hosting platform is configured to build from).
- [ ] `pnpm run typecheck` passes with zero errors across every workspace package.
- [ ] `pnpm run build` completes successfully — both `artifacts/ravish-trading` (frontend) and `artifacts/api-server` (backend) produce their output artifacts with no errors, and the frontend's largest bundle chunk stays under the 500 kB warning threshold established in Sprint 53 (currently 461.57 kB).
- [ ] `pnpm --filter @workspace/api-server run test` passes in full, run at least twice to catch flakes, per the unbroken practice since Phase 1.
- [ ] `pnpm --filter @workspace/ravish-trading run test` passes in full.
- [ ] The Playwright E2E suite (`pnpm --filter @workspace/e2e run test`) passes, run at least twice, per the Phase 6 testing strategy (§5 of the Phase 6 plan).
- [ ] `git diff --stat` against the pre-deployment baseline confirms `execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts`/`auto_execution_log` are untouched, UNLESS a change to one of them was itself separately, explicitly approved for this specific deployment (in which case that approval is documented in the relevant commit's own message and sprint record).
- [ ] Any new database migration in `lib/db/manual-migrations/` has been reviewed by hand (per `CLAUDE.md` rule 7: nullable → backfill → enforce-not-null, never `drizzle-kit push` alone for changes touching existing data) and its file is the next sequential number after the current highest (`016_options_backtest_results.sql` as of Sprint 77 — see §3.3).
- [ ] `.env.example` has been checked against any new environment variable introduced by the deployment — every real variable the application reads must have a name-and-purpose entry there, per the standing "no secret values in code, commits, or conversation" rule (`CLAUDE.md` rule 8).

### 1.2 Deployment execution

- [ ] Take a fresh database backup immediately before applying any new migration (§4 below) — never skip this step even for a "trivial" additive migration.
- [ ] Apply any new manual migration file(s) in `lib/db/manual-migrations/`, in strict numeric order, against the production database.
- [ ] Deploy the built application artifacts to the target hosting environment.
- [ ] Confirm the new process starts successfully — check `GET /api/healthz` returns `200 {"status":"ok"}` within a reasonable startup window (this codebase's own `PORT` requirement means the process exits immediately if misconfigured — a fast, loud failure is expected and correct here, not a bug to work around).
- [ ] Confirm `GET /api/monitoring/status` (Sprint 74) resolves and shows `database.connected: true` and every tracked background job (`auto-execution`, `auto-adjustment`, `alerts`) reporting `lastStatus: "ok"` once each has had time to complete its own first tick after restart (up to 5 minutes for the slowest, the `alerts` job).

### 1.3 Post-deployment

- [ ] Run the Post-Launch Validation checklist (§8 below) in full.
- [ ] Confirm no new alert has fired in `GET /api/monitoring/status` in the 15 minutes following deployment.
- [ ] Record the deployment (commit hash, timestamp, deployer, any migration applied) — this project's own convention is the commit message and `CLAUDE.md`'s sprint-history entry; a real production deployment should additionally record this in whatever deployment log the hosting platform provides.

---

## 2. Staged Rollout Strategy (Engine by Engine)

Directly follows the Blueprint's own explicit guidance (`docs/DK-AI-OS-Architecture-Blueprint.md` §"Phase 7 — Production"), re-affirmed by `docs/Phase-6-Master-Planning-Document.md` §7: **stage the rollout, never flip all three engines to live simultaneously.**

| Stage | Engine | Rationale | Current status |
|---|---|---|---|
| **1** | Options Income Engine | The most mature, most tested code in the entire platform — pre-existing, protected, unmodified execution logic across every phase of this project. Lowest incremental risk of the three. | Sprint 76 (live-data provider verification) is **blocked** — no credentials present in this session. |
| **2** | Investing Engine (Engine 1) | Phase 2's 19 modules are extensively tested against SIMULATED data; live verification is a pure data-source swap behind an already-built provider seam (`getFundamentalsProvider()`), not a logic change. | Sprint 75 (`FMP_API_KEY`/`ALPHA_VANTAGE_API_KEY` verification) is **blocked** — no credentials present in this session. |
| **3** | Trading Engine (Engine 2) | The newest engine, carrying the most novel, least battle-tested modules (Probability, Regime Detection, the walk-forward backtester). Stays last both by risk profile and by the project owner's own standing instruction — its live-data provider was explicitly deferred at Phase 3's close and has not been reopened. | **Deferred indefinitely** — no live-data provider exists to verify; `getMarketDataProvider()` always returns the SIMULATED instance today, by design. |

**Each stage is independent and separately gated.** A go-ahead for Stage 1 is not a go-ahead for Stage 2, and none of the three is implied by this document's own existence — each requires the project owner's own explicit, stage-specific decision, exactly as every consequential decision has required throughout this project's history.

**What "live" means for each stage, precisely:** flipping the relevant per-user `settings` field(s) that select a live data/execution provider over the SIMULATED default (e.g., `fundamentalsProvider`, `tradingDataProvider`, and — for the Options Income Engine specifically — real broker credentials wired into `execution.ts`'s own already-existing broker-routing logic, which has never been exercised against a real broker in this project's history). **Going live never means writing new code** for any of the three engines — every engine's SIMULATED-vs-LIVE seam was built provider-agnostic from the start specifically so this would be true.

---

## 3. Environment Validation

Before any deployment (and especially before any go-live stage), validate the target environment against this checklist. See `.env.example` for the authoritative, currently-maintained inventory of every environment variable this application reads — this section explains *why* each group matters for go-live specifically, it does not replace that file.

### 3.1 Core runtime variables

- [ ] `DATABASE_URL` — points at the real production Postgres instance, not a dev/staging database. Connection verified via `GET /api/monitoring/status`'s `database.connected` field (Sprint 74).
- [ ] `NODE_ENV=production` — set correctly; this gates several behaviors (the pino transport, e.g. — see `lib/logger.ts`) and is checked by the test-mode rate-limiter skip (`middlewares/rateLimit.ts`), which must NOT be accidentally left in test mode in production.
- [ ] `PORT` — the application throws and exits immediately at startup if unset (`index.ts`'s own explicit check) — this is intentional, loud-failure-by-design behavior, not a bug.
- [ ] `BASE_PATH` — matches the actual deployment routing configuration.
- [ ] `LOG_LEVEL` — set appropriately for production volume (typically `info`, not `debug`).

### 3.2 Authentication & security variables

- [ ] `BETTER_AUTH_SECRET` — a real, freshly-generated secret (`openssl rand -base64 32`), never the value used in this session's own test runs, never committed anywhere.
- [ ] `BETTER_AUTH_URL` — the API server's real public base URL.
- [ ] `CORS_ALLOWED_ORIGINS` — **the standing, unresolved gap flagged since Phase 1 Sprint 6.** The mechanism is finalized and ready (Sprint 52 confirmed this); the actual production frontend origin value has never been supplied in any session and must come from the project owner before go-live. Left unset, CORS stays fully open — acceptable for a single-origin deployment (frontend and backend served from the same origin), a genuine gap only for a split-origin deployment.
- [ ] `REQUIRE_AUTH` — decide deliberately for go-live. Left unset/false (the default throughout this project's history), every route falls back to the legacy-owner stand-in when no session exists — appropriate only for a genuinely single-tenant deployment. A real multi-user go-live should set this to `true` after confirming sign-in/sign-up work end-to-end in the target environment.
- [ ] Rate-limiting variables (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `AUTH_RATE_LIMIT_MAX_REQUESTS`, `TRUST_PROXY`) — the Sprint 52 defaults are a measured baseline for this session's own test traffic, not production traffic. Revisit once real production request-volume data exists (`GET /api/monitoring/status`'s `requestMetrics` field, and the periodic request-volume log lines Sprint 52 already established, are the source for that future tuning decision). `TRUST_PROXY` specifically must only be set to `true` if a real reverse proxy sits in front of the application — setting it without one lets a client spoof its own rate-limit key.

### 3.3 Provider credentials (per rollout stage)

- [ ] `ALPACA_API_KEY` / `ALPACA_API_SECRET` — required only for the Options Income Engine's own live-broker path (Stage 1). **Never verified live in any session to date** — `execution.ts`'s broker-routing logic exists but has no track record against a real Alpaca account.
- [ ] `FMP_API_KEY` / `ALPHA_VANTAGE_API_KEY` — required only for Engine 1's live-data path (Stage 2). Currently absent; Sprint 75 remains blocked.
- [ ] `POLYGON_API_KEY` — present in the env-var inventory but **not yet wired to any provider** (`polygonProvider.ts` exists but is unused) — do not treat its presence as meaning anything is live.

### 3.4 Database schema state

- [ ] Confirm the production database has every manual migration applied, in order, up through `016_options_backtest_results.sql` (the latest as of Sprint 77) — 17 migration files total (`000` through `016`), each hand-reviewed per `CLAUDE.md` rule 7, none of them a raw `drizzle-kit push` against data-bearing tables.
- [ ] Confirm the schema matches what `drizzle-kit push` (non-force) reports with **zero pending changes** — a non-zero diff before go-live means either a missed migration or a genuine schema drift that must be understood before proceeding, never silently pushed.

---

## 4. Backup & Recovery

**No managed backup service is currently configured for this project's own development/test database** — this section documents the procedure a production deployment must put in place, not a system already running. The specific hosting platform's own managed-backup feature (if the chosen platform offers one, e.g. a managed Postgres provider's automatic point-in-time recovery) should be preferred over the manual procedure below where available; this section is the fallback baseline that works regardless of hosting choice.

### 4.1 Backup procedure

- **What:** A full logical dump of the production Postgres database via `pg_dump` (or the hosting platform's own equivalent), covering every table — application data (`users`, `trades`, `settings`, all 17 migrations' worth of tables) plus the two audit trails (`platform_audit_log`, `auto_execution_log` — CLAUDE.md rule 3 protects `auto_execution_log`'s *schema and write sites* from casual modification, it does not exempt it from being backed up like every other table).
- **When:**
  - **Immediately before every deployment that includes a new migration** (§1.2 above) — non-negotiable.
  - **On a regular schedule independent of deployments** (daily, at minimum, for any real production deployment) — this project's own current session has no such schedule configured, since it has never run against a real production database.
- **Where:** Stored somewhere genuinely independent of the primary database (a separate object-storage bucket or the hosting platform's own backup retention), never only on the same disk/volume as the live database.
- **Retention:** A reasonable starting default is 30 days of daily backups plus the most recent pre-deployment backup kept indefinitely until the next deployment's own backup supersedes it — tune based on actual compliance/business requirements once a real hosting decision is made.

### 4.2 Recovery procedure

1. Identify the target restore point (the most recent backup before a data-loss incident, or a specific pre-deployment backup if rolling back a bad migration alongside a code rollback — see §5).
2. Provision a fresh database instance (or use the hosting platform's own restore-in-place feature if available).
3. Restore the logical dump via `pg_restore` (or the platform equivalent).
4. Point `DATABASE_URL` at the restored instance.
5. Run `GET /api/monitoring/status` to confirm connectivity, then a manual smoke test of a handful of core read routes (`GET /api/trades`, `GET /api/settings`, `GET /api/scanner/results`) before considering the restore complete.
6. **If the incident involved the automation scheduler, confirm the kill switch state after restore matches what it should be** — a restore to a backup taken before an operator armed or disarmed the switch would silently revert that decision; this is the one recovery step with genuine automation-safety consequences and must never be skipped or assumed.

### 4.3 What this plan does not cover

- **Disaster recovery for the hosting infrastructure itself** (a full region outage, DNS failure) — outside this application's own scope; depends entirely on whatever hosting platform is eventually chosen.
- **Point-in-time recovery below daily granularity** — achievable only via the hosting platform's own managed WAL-archiving feature, if offered; the manual `pg_dump` procedure above only supports restoring to the moment of the last dump.

---

## 5. Release Process

Unchanged from the discipline this project has followed continuously since Sprint 1, re-affirmed by `docs/Phase-6-Master-Planning-Document.md` §10:

- **Continuous, not big-bang.** One sprint, one commit, one push, one explicit approval at a time. A production go-live for any engine stage follows this exact same discipline — it is a deployment like any other, distinguished only by the stage-specific approval gate in §2 above, not by a different release mechanism.
- **No feature freeze.** The main branch stays the single source of truth throughout; Phase 6/7 work does not introduce a stabilization branch or any parallel release track.
- **Every release is reviewable after the fact.** The commit message, the relevant sprint's `CLAUDE.md` entry, and (for anything migration-bearing) the manual migration file itself are the durable record of what shipped and why — the same standard this project has held itself to for 77 sprints.

---

## 6. Rollback Procedures

### 6.1 Code-only rollback (no migration involved)

1. Identify the last known-good commit.
2. `git revert` the offending commit(s) (never a force-reset on a shared branch, per the project's own git-safety discipline).
3. Rebuild and redeploy from the reverted state, following §1's checklist in full — a rollback is a deployment, not an exception to deployment discipline.
4. Verify via §8 (Post-Launch Validation) exactly as for a forward deployment.

### 6.2 Rollback involving a migration

Manual migrations in this project follow `CLAUDE.md` rule 7's nullable → backfill → enforce-not-null discipline specifically **so that a rollback is possible without data loss** at each intermediate step:

1. If the migration only added nullable columns/tables (the vast majority of this project's 17 migrations to date), a code-only rollback (§6.1) is sufficient — the new columns/tables are simply unused by the reverted code, no schema rollback needed.
2. If the migration enforced a `NOT NULL` constraint or otherwise changed existing data in a way the reverted code cannot tolerate, restore from the pre-deployment backup taken in §1.2/§4.1 rather than attempting to hand-write a down-migration under incident pressure — this project has never needed a down-migration script because every migration to date has been additive-first by design; restoring from backup is the safer, already-tested path.
3. Re-run §8's Post-Launch Validation checklist after any migration-involving rollback.

### 6.3 Rollback of a live-data go-live stage specifically

Reverting a specific user (or all users) from LIVE back to SIMULATED for any engine requires **no code change and no rollback in the code-deployment sense** — it is a `settings` field flip (`fundamentalsProvider`, `tradingDataProvider`, or the equivalent broker-connection field for Options Income), reversible via `PATCH /api/settings` exactly as easily as it was enabled. This is a deliberate design property of every engine's provider seam, not an emergency procedure — confirm the field flips correctly and `GET /api/monitoring/status` shows no resulting alert before considering it complete.

### 6.4 Kill switch — the fastest rollback for the automation engine specifically

For any incident involving the auto-execution/auto-adjustment scheduler, the kill switch (`autoExecuteEnabled`/`autoAdjustEnabled` via `PATCH /api/settings`, or the AutoPilot/Adjustments pages' own master switches) is always the fastest, safest containment action — it requires no deploy, no rollback, and takes effect on the very next scheduler tick (within 60 seconds). This is documented identically in `docs/Incident-Response-Runbook.md` §2.2 and repeated here because it is the single most important rollback-adjacent procedure in this entire plan.

---

## 7. Monitoring Verification

Before any go-live stage, and periodically thereafter, verify the Sprint 74 monitoring stack is genuinely functioning, not merely deployed:

- [ ] `GET /api/monitoring/status` resolves with `database.connected: true`.
- [ ] All 3 tracked background jobs (`auto-execution`, `auto-adjustment`, `alerts`) show `lastStatus: "ok"` after allowing time for each to complete at least one real tick (60s for the first two, 5 minutes for `alerts`).
- [ ] `requestMetrics.total` increments across two calls a few minutes apart — proves the request-volume counter is genuinely counting live traffic, not stuck.
- [ ] `auditSignals.computedAt` is a real, recent timestamp (not `null`) after the server has been running for at least 5 minutes — proves the periodic monitoring timer itself is ticking.
- [ ] Deliberately trigger one **synthetic** alert in a non-production environment first (e.g., temporarily lower `JOB_FAILURE_ALERT_THRESHOLD` or force a job failure) and confirm: (a) the alert appears in `GET /api/monitoring/status`'s `alerts` array, (b) a `pino` warn/error log line is emitted, (c) a `platform_audit_log` row with `eventType: "monitoring.alert"` is created. **Never perform this specific verification step against the real production environment** — it is a pre-go-live rehearsal step only.
- [ ] Confirm whatever external uptime/monitoring tool is chosen for the real deployment (not built by this project — `GET /api/monitoring/status` is designed to be polled by one, it is not itself an alerting *delivery* mechanism beyond structured logs and the audit table) is actually polling `/api/healthz` and/or `/api/monitoring/status` and configured to page a human on a sustained failure.

---

## 8. Go-Live Checklist

This is the checklist to run **immediately before and during** any specific stage's go-live (§2), in addition to — never instead of — the general Production Deployment Checklist (§1).

### 8.1 Before flipping any engine to live

- [ ] The relevant live-data verification sprint (75 for Engine 1, 76 for Options Income) has run and passed against real credentials — **not applicable to any stage as of Sprint 77**, since both remain blocked.
- [ ] §3 (Environment Validation) is complete for the target environment, including the provider-credential subsection specific to this stage.
- [ ] §7 (Monitoring Verification) is complete.
- [ ] A recent backup exists (§4.1).
- [ ] The project owner has given explicit, stage-specific, written go-ahead for **this exact stage** — not a general "proceed with rollout" approval.

### 8.2 The automation kill-switch-specific checklist

Per the Blueprint's own explicit requirement ("go-live checklist specifically covering the automation kill-switch"), this sub-checklist applies **only when the Options Income Engine (Stage 1) goes live**, since that is the only engine with an automation scheduler acting on real capital:

- [ ] Confirm, for every user who will have live-broker credentials configured, that `autoExecuteEnabled` and `autoAdjustEnabled` both **default to `false`** — no user should ever be silently armed by a migration or a deployment. (Confirmed by design: every `settings` row's own schema defaults these to `false`; this step is a verification, not a code change.)
- [ ] Confirm `executionMode` defaults to `manual` or `semi_auto`, never `full_auto`, for a newly-live-broker-connected user.
- [ ] Confirm `GET /api/execution/auto/status` correctly reports `armed: false` for a representative test user immediately after their broker credentials are connected, before any explicit arming action.
- [ ] Walk through arming the switch manually for one test account first (never a real user's account) against the real live broker in a controlled manner, confirm one real (small, deliberately bounded) trade executes and is correctly logged to `auto_execution_log`, then disarm and confirm no further activity occurs.
- [ ] Confirm the manual trigger routes (`POST /execution/auto/run`, `POST /execution/auto/adjust/run`) are not a bypass of the kill switch — per `.agents/memory/kill-switch-security-review.md` (Sprint 67), they call the exact same gated cycle functions the scheduler itself uses; re-verify this holds against the live-broker code path specifically, since Sprint 67's own review only exercised the SIMULATED path.
- [ ] Confirm `docs/Incident-Response-Runbook.md`'s own kill-switch-related procedures (§2.2) are accurate for the live environment — update the runbook if anything about the live path differs from the SIMULATED path it was originally written against.

### 8.3 Go/no-go decision point

At this point, present the completed §8.1 and (if Stage 1) §8.2 checklists to the project owner for the final go/no-go call. **This document does not make that call — it only ensures every input to it has been gathered.**

---

## 9. Post-Launch Validation

Run immediately after any deployment (§1.3) and, additionally, on an extended schedule after a go-live stage specifically:

### 9.1 Immediate (within 1 hour of deployment/go-live)

- [ ] `GET /api/healthz` and `GET /api/monitoring/status` both resolve correctly.
- [ ] No new alert category has appeared in `GET /api/monitoring/status` that wasn't present pre-deployment.
- [ ] A real user can sign up, sign in, and reach at least one page per engine (the exact flows Sprint 69's own E2E smoke suite already automates — `engine1-investing.spec.ts`, `engine2-trading.spec.ts`, `engine3-options-income.spec.ts` — a manual spot-check of the same flows in the real production environment is the human-verified equivalent).
- [ ] For a live-data go-live stage specifically: confirm the newly-live provider is genuinely being used (`fundamentalsConnected`/`tradingDataConnected`/the Options Income equivalent reads `true`, and a real report/scan shows non-SIMULATED-labeled data) — never assume, always check the actual response's own `dataSource`/`connected` field.

### 9.2 Extended (24–72 hours after go-live specifically)

- [ ] Review `platform_audit_log` for the full window — confirm no unexpected spike in `auth.login_failed` or `monitoring.alert` rows.
- [ ] Review `auto_execution_log` (if Stage 1 went live) for the full window — confirm decision counts and reasons look sane relative to expected volume, and that no `blocked` decision's `reason` text indicates a genuine bug rather than an expected guardrail trip.
- [ ] Confirm the request-metrics 5-minute log lines (Sprint 52) show stable, expected traffic patterns, not an anomaly.
- [ ] Solicit direct confirmation from the project owner (or designated real users, if applicable) that the live-data output looks correct and trustworthy for the newly-live engine — this project's own SIMULATED-vs-LIVE discipline means this is the first time this specific data path has ever been human-reviewed against reality.

### 9.3 Rollback trigger criteria

Roll back (§6) immediately, without waiting for further investigation, if any of the following occur in the post-launch window:

- A `scheduler.repeated_failure` or `database.unreachable` alert (Sprint 74's own critical-severity categories) persists for more than 15 minutes despite the recovery steps in `docs/Incident-Response-Runbook.md`.
- Any evidence of the automation engine executing a trade it should not have (a guardrail bypass, a kill-switch failure) — this triggers an **immediate** kill-switch disarm (§6.4) regardless of whether a full rollback is also needed.
- A live-data provider returns data that is materially wrong (not just momentarily stale) — revert that specific provider setting to SIMULATED (§6.3) immediately, investigate separately.

---

## 10. Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner of mitigation |
|---|---|---|---|---|---|
| 1 | Automation engine executes an unintended trade due to a guardrail bug exposed only under real market conditions (never exercised against a real broker before) | Medium | Critical | Sprint 67's read-only kill-switch review + Sprint 73's load/chaos testing cover correctness under adversarial *conditions*, but neither has ever run against a real broker; §8.2's controlled-single-account rehearsal is the mitigation for this specific gap | Project owner + whoever executes Stage 1 |
| 2 | Live-data provider (FMP/Alpha Vantage/Options broker) returns unexpected response shapes never seen by this project's mocked-fetch test coverage | Medium | Moderate | Sprints 75/76 are explicitly scoped as "verification passes," not code-complete guarantees — expect to find and fix genuine parsing gaps during those sprints, which is precisely why they're scheduled before go-live, not skipped | Whoever executes Sprints 75/76 |
| 3 | CORS production origin is never supplied, blocking a split-origin deployment indefinitely | High (already true today) | Low–Moderate (blocks one deployment topology, not correctness) | Flagged repeatedly since Phase 1 Sprint 6; resolvable only by the project owner supplying the real value | Project owner |
| 4 | No managed backup service configured; a manual `pg_dump` procedure (§4) is not battle-tested against a real production incident | Low (until go-live), then ongoing | Critical if it occurs | Adopt the target hosting platform's own managed backup feature where available; rehearse the manual restore procedure (§4.2) at least once in a non-production environment before go-live | Whoever selects the hosting platform |
| 5 | `REQUIRE_AUTH` left unset in a real multi-tenant production deployment, silently routing unauthenticated requests to the legacy-owner stand-in | Low (requires forgetting §3.2) | High (a real tenant-isolation leak in practice, even though the underlying per-request scoping is correct) | §3.2's own explicit checklist item; this is a deployment-configuration risk, not a code risk — `getScopedUserId()`'s own fallback behavior is correct and tested, the risk is deploying with the wrong *setting* | Whoever executes any multi-tenant deployment |
| 6 | Rate-limiting thresholds (Sprint 52's own measured baseline) are tuned for this session's test traffic, not real production traffic, and either falsely throttle real users or fail to slow a real attack | Medium | Moderate | §3.2 flags this explicitly; `GET /api/monitoring/status`'s own `requestMetrics` field plus the periodic request-volume log lines are the intended data source for a future, real-traffic-informed retuning | Whoever operates the platform post-launch |
| 7 | The `scheduler.stuck`/`scheduler.repeated_failure` alert thresholds (Sprint 74) were chosen without any real production traffic data and may be miscalibrated (too sensitive or not sensitive enough) | Medium | Low–Moderate | Explicitly disclosed as "starting defaults, tune with real data" in both Sprint 74's own report and `docs/Incident-Response-Runbook.md`; revisit after the first real production month | Whoever operates the platform post-launch |
| 8 | Engine 2 (Trading)'s own live-data provider remains permanently deferred with no scheduled path to resolution | High (a known, accepted gap) | Low (deliberate scope boundary, not a defect) | No mitigation needed unless the project owner reopens this decision — explicitly out of scope per the Phase 3-close instruction, re-affirmed here | Project owner, only if/when reopened |

---

## 11. Cross-References

- `docs/Production-Readiness-Report.md` — the current-state readiness assessment this plan is built on top of.
- `docs/Operations-Handbook.md` — the ongoing, day-to-day operational reference for once a stage is live.
- `docs/Incident-Response-Runbook.md` (Sprint 74) — the detailed per-alert-category diagnosis/recovery procedures this plan's §6.4/§7/§9.3 rely on.
- `docs/Phase-6-Master-Planning-Document.md` §2h — the as-built sprint record for the work that produced this document.
- `docs/DK-AI-OS-Architecture-Blueprint.md` — the original source of the staged-rollout requirement and the Phase 7 deliverable list this document satisfies.
- `.env.example` — the authoritative, currently-maintained environment-variable inventory referenced throughout §3.

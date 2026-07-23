# Operations Runbook

**Phase 11 — Live Market Operations & Production Validation.** This is the SRE/on-call-facing reference for this phase's own additions: the background-job audit, the Operations Dashboard, administrator promotion, and the security review. It does not replace `docs/Operations-Handbook.md` (the broader, feature-usage-oriented day-to-day guide covering every engine) or `docs/Incident-Response-Runbook.md` (per-alert-category diagnosis/recovery) — both remain the authoritative reference for their own scope, cross-referenced below rather than duplicated.

---

## 1. Background job audit

**Finding, stated plainly:** this platform has exactly **5 real, scheduled background processes** — all plain `setInterval` timers, no message queue, no cron daemon, no job-scheduling library of any kind (`bullmq`/`bull`/`agenda`/`node-cron` — none are dependencies of this project). Confirmed by a direct grep for every `setInterval` call site in `artifacts/api-server/src` before writing this document.

| Timer | File | Interval | Job-health tracked? |
|---|---|---|---|
| Auto-execution cycle | `index.ts` | 60s | Yes (`recordJobRun("auto-execution", ...)`) |
| Auto-adjustment cycle | `index.ts` | 60s (same tick) | Yes (`recordJobRun("auto-adjustment", ...)`) |
| Alerts evaluation | `lib/notifications.ts` | 5 min | Yes (`recordJobRun("alerts", ...)`) |
| Monitoring cycle (audit-signal computation) | `lib/systemHealth.ts` | 5 min | N/A — this *is* the observability system itself |
| Request-metrics window flush | `lib/requestMetrics.ts` | 5 min | N/A — same reason |

(A 6th `setInterval`, in `lib/sse.ts`, is a per-connection SSE heartbeat/keepalive, not a scheduled job in the sense meant here.)

**Explicit finding on the phase's own named items — "Daily summaries, Intelligence snapshots, Notifications, Learning reminders, Journal generation":** of these five, only **Notifications** is a real scheduled job (the Alerts timer above). The other four are **not** background jobs anywhere in this codebase — they are computed **on demand**, only when a user opens the relevant page:

- **Daily summaries** (`lib/crossEngineDailyReport.ts`) — its own header comment states this explicitly: "never emailed, pushed, or run on a cron/background job." Computed fresh on every `GET /cross-engine-report` call.
- **Intelligence snapshots** (`lib/intelligenceEngine.ts`) — written only when a user views the Institutional Intelligence page, never on a timer.
- **Learning reminders** — the AI Teacher & Learning Centre's own progress tracking is read/written on user interaction, not scheduled.
- **Journal generation** — both the options-side and Engine-2 Trading Journals are user-authored, created via an explicit `POST`, never auto-generated.

This is a deliberate, previously-established architectural pattern across this entire project (every "on-demand, not eager" disclosure since Phase 2 Sprint 19), not an oversight discovered this phase — this audit's contribution is confirming it holds and stating it plainly in one place, since the phase's own kickoff text implied these might be scheduled jobs needing review.

**Retry safety:** none of the 5 real timers retry on failure within the same tick — each tick either succeeds or logs the failure and waits for the next natural tick (60s or 5 min later). This is a deliberate, existing design (not changed this phase): a failed auto-execution/auto-adjustment cycle for one user never blocks any other user's cycle in the same tick (Phase 1 Sprint 8's per-user isolation), and every failure is both logged via `pino` and recorded via `recordJobRun()`'s `consecutiveFailures` counter, visible on the Operations Dashboard (§3 below) and alertable via `GET /monitoring/status`'s own existing `scheduler.repeated_failure`/`scheduler.stuck` categories (Phase 6 Sprint 74, `docs/Incident-Response-Runbook.md` §2.2).

## 2. Administrator promotion

There is **no self-service admin-promotion endpoint anywhere in this codebase**, deliberately — `users.role` (added Phase 1 Sprint 6, `input: false` so a client can never self-assign it at signup) had never been checked by any route until this phase's `requireAdmin` middleware. Granting the "admin" role is a manual, operator-level database action:

```sql
UPDATE users SET role = 'admin' WHERE email = 'operator@example.com';
```

Run this only against a real, trusted operator's account. There is no UI for it — this is intentional, matching the "no role-based admin functionality exists today" disclosure this project already made in `docs/Operations-Handbook.md` §6.5 before this phase, now resolved for the one specific case (the Operations Dashboard) this phase needed it for.

## 3. Operations Dashboard

`/operations` (admin-gated both client-side, for UX, and server-side via `requireAdmin` on every data route — the server-side gate is the real security boundary, proven by `routes/ops.route.test.ts`). Five sections, every one a thin read of an already-existing endpoint:

| Section | Source |
|---|---|
| API Health | `GET /monitoring/status` (Phase 6, unmodified) |
| Broker Health | `GET /broker/health` (Phase 6, unmodified) |
| Active Alerts | `GET /monitoring/status`'s own `alerts[]`/`auditSignals` |
| Background Job Scheduler ("Queue Status") | `GET /monitoring/status`'s own `jobs[]` — honestly labeled as scheduler-tick health, not a real queue, since none exists |
| Live Market Data Validation ("Data Freshness") | `GET /ops/market-data-validation` (new this phase — `docs/Live-Market-Validation.md`) |
| Recent Syncs | `GET`/`POST /broker/reconciliation/reports` (new this phase — `docs/Broker-Reconciliation.md`) |

## 4. Security review

Reviewed per the phase's own request: secrets management, environment variables, authentication, authorization, tenant isolation, rate limiting, API validation.

| Area | Finding |
|---|---|
| Secrets management | No secret value has ever been committed to this repository (`CLAUDE.md` rule 8, unbroken across every phase); `.env.example` documents every variable name, never a value. No managed secrets vault (AWS Secrets Manager, Vault, etc.) is configured — all secrets are plain process environment variables. **This is an accepted, disclosed gap for a small-scale deployment**, not fixed this phase (introducing one would be new infrastructure, not validation). |
| Environment variables | `.env.example` is the authoritative inventory (confirmed current as of this phase — no new variables were required for this phase's own work; the market calendar/clock reuse the existing `ALPACA_API_KEY`/`ALPACA_API_SECRET`). |
| Authentication | Better-Auth (Phase 1 Sprint 6), session-cookie-based, `BETTER_AUTH_SECRET` required at startup (the process throws if unset — confirmed live during this phase's own test runs). Unchanged this phase. |
| Authorization | **Genuinely extended this phase**: `requireAdmin` is the first role-based route gate in this codebase's history. Every other route continues to use the established per-resource ownership-scoping pattern (`getScopedUserId(req)` + `and(eq(id), eq(userId))`), unaffected. |
| Tenant isolation | Both new tables this phase added (`broker_reconciliation_reports`, and Phase 10's `dashboard_workspaces` reused unmodified) have a dedicated `assertTenantIsolation` test case; confirmed passing. |
| Rate limiting | `middlewares/rateLimit.ts` (Phase 4 Sprint 52) is unmodified and unaffected by this phase's new routes — they inherit the same general `/api` limiter. |
| API validation | Every new response is validated against a generated Zod schema (`api.parse(...)`) before being sent, matching this codebase's universal convention; the one exception (`POST /broker/reconciliation/reports`'s response) is disclosed in `routes/brokerReconciliation.ts`'s own comment — Orval deduplicated its standalone schema, so the already-TypeScript-typed object is returned directly rather than fighting the generator for a schema with no standalone export. |

### Remaining production risks, disclosed

1. **No live credentials exist in this session** (FMP, Alpha Vantage, Alpaca, Polygon) — every live-provider code path (market calendar/clock included) is covered only by mocked-fetch tests, never a real network call. This is the single largest remaining gap before any real production go-live, tracked since Sprint 62/75/76 and unresolved by this phase.
2. **In-memory state does not survive a multi-instance deployment.** `jobHealth`, `requestMetrics`'s window counters, the rate limiter's own request counts, and the broker-health "last successful check" cache are all plain module-level `Map`/variable state — correct for a single server instance, but would silently under-report or double-report if this platform were ever horizontally scaled to multiple instances behind a load balancer. Not a bug today (this platform runs as one instance), but a real constraint on future scaling, not previously written down in one place before this phase.
3. **No managed secrets vault** (see above) — accepted for the current deployment scale.
4. **No external penetration test or formal security audit** has been performed on this codebase — `docs/Phase-9-Security-Review.md` was an internal review, not a third-party audit.
5. **The static market-calendar approximation** (`docs/Live-Market-Validation.md` §2) doesn't know about early-close half-days or unscheduled exchange closures — a narrow, low-frequency gap, not a security risk, but relevant to any go-live decision that depends on market-hours logic.

None of these are new discoveries requiring urgent action — all are pre-existing, now-consolidated-in-one-place disclosures, consistent with this project's unbroken "state the real risk, don't fabricate a clean bill of health" discipline.

## Cross-references

- `docs/Operations-Handbook.md` — the broader, feature-usage-oriented operational guide (all engines).
- `docs/Incident-Response-Runbook.md` — per-alert-category diagnosis and recovery for `GET /monitoring/status`'s own alert categories.
- `docs/Live-Market-Validation.md` — the market-data validation work this phase added.
- `docs/Broker-Reconciliation.md` — the reconciliation-reports persistence this phase added.
- `docs/Production-GoLive-Checklist.md` — the consolidated go-live checklist, incorporating this phase's own findings.

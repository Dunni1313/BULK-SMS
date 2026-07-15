# Incident Response Runbook

**Status: living operational document.** Introduced in Phase 6, Sprint 74 (Monitoring, Alerting & Incident Runbook — see `docs/Phase-6-Master-Planning-Document.md` §2g for the as-built record). Update this document whenever the monitoring architecture or an alert category's own thresholds change — it should always describe the system as it actually behaves, not as originally designed.

This is the operator-facing companion to `artifacts/api-server/src/lib/systemHealth.ts`'s own header comment (the engineering rationale) — this document is the "what do I actually do" reference.

---

## 1. Monitoring Architecture

Three layers, all reusing infrastructure that already existed before this sprint — no new monitoring service, no new database table, no new third-party dependency.

### 1.1 Structured logging (pino) — unchanged foundation

Every request and every background-job tick already logs through the shared `pino` logger (`lib/logger.ts`). Sprint 74 adds no new logging *mechanism* — it adds new *log events* (job outcomes, alerts) on top of the existing one.

### 1.2 Background-job health tracking — `lib/systemHealth.ts`

Three background jobs are tracked in-memory, each recording its own `lastRunAt` / `lastDurationMs` / `lastStatus` (`ok` | `error` | `never_run`) / `lastError` / `consecutiveFailures` / `totalRuns` / `totalFailures`:

| Job name | Owner | Real interval | Purpose |
|---|---|---|---|
| `auto-execution` | `index.ts`'s scheduler tick | 60s | Opens new automated positions (guarded by the master kill switch) |
| `auto-adjustment` | `index.ts`'s scheduler tick | 60s | De-risks open positions (guarded by three switches, master-before-subordinate) |
| `alerts` | `lib/notifications.ts`'s `startAlertsScheduler()` | 5min | Evaluates user-facing watchlist/risk notifications (Phase 4, Sprint 56 — a completely different, user-facing alerting concern from this document's own operator-facing alerts, never conflated) |

`recordJobRun()` is called from `index.ts` and `lib/notifications.ts` (neither is a protected file) as a thin wrapper around each job's own already-existing call — it observes the outcome, it never changes what the job does. **`execution.ts`/`optionsMath.ts`/`risk.ts`/`autoExecution.ts`/`autoAdjustment.ts` were not modified at all by this sprint.**

### 1.3 Alert evaluation, derived from already-existing tables

Every 5 minutes (`startMonitoringTimer()`, same cadence as the alerts scheduler), `runMonitoringCycle()`:

1. Pings the database (`SELECT 1`).
2. Reads the current in-memory job-health snapshot.
3. Reads the current request-metrics window (`lib/requestMetrics.ts`, Sprint 52).
4. Queries `auto_execution_log` for guardrail-`blocked` decisions in the last hour, and `platform_audit_log` for `auth.login_failed` events in the last hour — the literal "turn existing logs into active alerting signals" the Phase 6 plan calls for. **Neither table's schema was touched** — `auto_execution_log` in particular remains exactly as CLAUDE.md rule 3 requires (untouched by general audit-log work).
5. Evaluates all of the above against the named thresholds in §2 below, producing a list of alerts.
6. Logs every alert (`pino warn`/`error`); persists only genuinely **new** alerts (edge-triggered — a still-active alert isn't re-persisted every 5 minutes) to `platform_audit_log` via the already-existing `recordAuditEvent()` writer (Sprint 10), `eventType: "monitoring.alert"`.

### 1.4 Operational health endpoint

`GET /api/monitoring/status` — mounted on the same router as `/api/healthz`, exempt from authentication and rate-limiting for the same reason `/healthz` is (a monitoring system must be able to poll it without friction). Computes database connectivity, job health, and the current request-metrics window **fresh on every call**; the two audit-log-derived signals (§1.3 step 4) are read from the periodic timer's own cache, since `auto_execution_log` has no index beyond its primary key and must not be scanned on every poll (see `systemHealth.ts`'s own header comment). `auditSignals.computedAt` is honestly `null` until the first periodic tick has run.

```json
{
  "status": "ok",
  "timestamp": "2026-07-15T18:00:00.000Z",
  "database": { "connected": true, "latencyMs": 3, "error": null },
  "jobs": [
    { "job": "auto-execution", "lastRunAt": "...", "lastStatus": "ok", "consecutiveFailures": 0, ... }
  ],
  "requestMetrics": { "total": 142, "byStatusClass": { "2xx": 138, "3xx": 0, "4xx": 4, "5xx": 0, "other": 0 } },
  "auditSignals": { "guardrailBlocksLastHour": 2, "authFailuresLastHour": 0, "computedAt": "..." },
  "alerts": []
}
```

---

## 2. Alert Categories, Thresholds, and Recovery Procedures

All thresholds below are **named, adjustable constants** in `lib/systemHealth.ts` (`JOB_FAILURE_ALERT_THRESHOLD`, `JOB_STALE_MULTIPLIER`, `GUARDRAIL_BLOCK_RATE_ALERT_THRESHOLD`, `AUTH_FAILURE_RATE_ALERT_THRESHOLD`, and the two inline `errors.elevated_5xx_rate` constants) — starting defaults chosen to be generous enough to avoid false alarms on this platform's current traffic, matching Sprint 52's own "measured baseline, tune later" precedent for `rateLimit.ts`. Revisit them once real production traffic data exists.

### 2.1 `database.unreachable` — **critical**

**Symptom:** `GET /monitoring/status`'s `database.connected` is `false`, or an alert with this category appears.
**Meaning:** The application's `SELECT 1` ping to Postgres failed.
**Likely causes:** Database process down, connection pool exhausted, network partition between app and DB, credentials rotated without updating `DATABASE_URL`.
**Diagnosis:**
1. Check `database.error` in the `/monitoring/status` response — it carries the real driver error message.
2. Check whether the database process itself is running (`pg_lsclusters` in this environment; the real hosting platform's own DB dashboard in production).
3. Check recent deploys for a `DATABASE_URL` or credential change.
**Recovery:** Restart the database process if it's down. If the pool is exhausted, check for a connection leak (a query never releasing its client) — none is known to exist in this codebase as of Sprint 74, but if diagnosed, the fix belongs to whichever module holds the leak, following that file's own change-approval requirements (protected files need the same maximum-scrutiny process as always).
**Verification:** `GET /monitoring/status` shows `database.connected: true` again; the `database.unreachable` alert disappears from `alerts` on the next periodic tick (up to 5 minutes).

### 2.2 `scheduler.repeated_failure` — **critical**

**Symptom:** A job's `consecutiveFailures` reaches `JOB_FAILURE_ALERT_THRESHOLD` (3).
**Meaning:** The named background job (`auto-execution`, `auto-adjustment`, or `alerts`) has thrown an uncaught error on its last 3+ consecutive ticks.
**This is the platform's single highest-consequence alert category** — `auto-execution`/`auto-adjustment` failing repeatedly means the automation engine may not be opening or de-risking positions as configured, even though the kill switch itself is a separate, independent safety mechanism (a failing tick is not the same as an unsafe tick — the engine fails closed, never open, on any uncaught error).
**Diagnosis:**
1. Check `jobs[].lastError` in `/monitoring/status` for the specific failing job.
2. Check application logs around the job's own `lastRunAt` timestamp for the full stack trace (pino logs the full error server-side; the HTTP response only carries the message).
3. Cross-reference `platform_audit_log`/`auto_execution_log` for the same time window to see whether real trades were affected.
**Recovery, in order of increasing severity:**
1. If the failure is transient (a single bad market-data response, a momentary DB blip), it may self-resolve on the next tick — confirm via `consecutiveFailures` dropping back to 0.
2. If it does not self-resolve, **use the existing kill switch** — disarm `autoExecuteEnabled` (and `autoAdjustEnabled` if the adjustment job is the one failing) via `PATCH /api/settings`, or the Settings UI, or the AutoPilot/Adjustments pages' own master switches. This immediately stops the automation engine from acting while the underlying bug is diagnosed, without needing a deploy.
3. Diagnose and fix the root cause. If the fix requires touching `autoExecution.ts`/`autoAdjustment.ts`/`execution.ts`/`optionsMath.ts`/`risk.ts`, it requires the same explicit, separately-approved, maximum-scrutiny process CLAUDE.md rule 2 has required since Phase 1 — an incident does not waive that requirement.
**Verification:** The job's `lastStatus` returns to `ok`, `consecutiveFailures` resets to 0, and the alert clears on the next periodic tick.

### 2.3 `scheduler.stuck` — **critical**

**Symptom:** A job's `lastRunAt` is older than `JOB_STALE_MULTIPLIER` (2×) its own expected interval (auto-execution/auto-adjustment: 120s; alerts: 10min).
**Meaning:** The job hasn't run recently — either the whole Node process has stalled/crashed, or the `setInterval` itself was somehow cleared.
**Diagnosis:** Check whether the process is still alive at all (a process-level health check, e.g. is the server responding to `GET /healthz`?). If `/healthz` itself doesn't respond, this is a process-down incident, not a scheduler-specific one.
**Recovery:** Restart the server process. `startAutoScheduler()`/`startAlertsScheduler()`/`startMonitoringTimer()` are all called once from `index.ts`'s real entrypoint on every server start, so a clean restart always re-establishes all three timers.
**Verification:** The job's `lastRunAt` updates again within its own expected interval; the alert clears on the next periodic tick.

### 2.4 `errors.elevated_5xx_rate` — **warning**

**Symptom:** The current request-metrics window's 5xx rate exceeds 10%, with at least 20 requests in the window (avoiding false alarms on tiny traffic).
**Meaning:** A meaningful fraction of recent requests are failing server-side.
**Diagnosis:** Check application logs for the actual 5xx responses in the current window (pino logs every request's status code); look for a common route or error pattern.
**Recovery:** Depends entirely on the root cause found in diagnosis — a bad deploy (roll back), a downstream dependency outage (a live data provider, if ever enabled — currently none is, per the Phase 3 close decision), or a genuine application bug (fix and redeploy, following the standard change-approval process for whatever file needs it).
**Verification:** The 5xx rate in a fresh request window drops back under 10%; the alert clears on the next periodic tick.

### 2.5 `guardrail.elevated_block_rate` — **warning**

**Symptom:** More than `GUARDRAIL_BLOCK_RATE_ALERT_THRESHOLD` (20) `auto_execution_log` rows with `decision = "blocked"` in the last hour.
**Meaning:** The automation engine's own guardrails (position caps, daily loss limits, the kill switch itself) are tripping unusually often. This is not necessarily a bug — it could mean a user is intentionally near their own configured limits — but a sudden spike is worth a human look.
**Diagnosis:** Query `GET /execution/auto/log` (or the AutoPilot/Adjustments pages) for the actual blocked decisions and their `reason` text in the last hour; look for a pattern (one user hitting the same guardrail repeatedly, vs. many users, vs. a single guardrail dominating).
**Recovery:** Usually none needed — this is an informational signal, not an outage. If the pattern reveals a genuine bug (e.g., a guardrail tripping when it shouldn't), that's a `autoExecution.ts`/`autoAdjustment.ts` change requiring the standard maximum-scrutiny approval process.
**Verification:** The rate naturally drops as the trailing-hour window rolls forward past the spike; no explicit action is required for the alert itself to clear.

### 2.6 `auth.elevated_failure_rate` — **warning**

**Symptom:** More than `AUTH_FAILURE_RATE_ALERT_THRESHOLD` (10) `platform_audit_log` rows with `eventType = "auth.login_failed"` in the last hour.
**Meaning:** Possible credential-stuffing or brute-force activity — complements (does not replace) Sprint 52's own rate limiter, which already throttles the request *volume* of such attempts; this alert surfaces the *outcome* pattern instead.
**Diagnosis:** Query `platform_audit_log` for the actual failed-login rows and their timestamps/IPs (if captured by the request logger) in the last hour; look for concentration against a small number of accounts vs. a broad spray.
**Recovery:** Sprint 52's rate limiter is already the first line of defense (20 auth requests/60s per the `authRateLimiter`). If a genuine attack is confirmed, consider tightening `RATE_LIMIT_MAX_REQUESTS`/the auth-specific limit (both env-overridable, no code change needed), or blocking the source IP at the infrastructure/proxy layer (outside this application's own scope).
**Verification:** The rate naturally drops as the trailing-hour window rolls forward; no explicit action is required for the alert itself to clear.

---

## 3. General Incident Workflow

1. **Detect** — via `GET /monitoring/status` (poll it, or wire it into an external uptime/monitoring tool), the periodic `pino` warn/error log lines, or a `platform_audit_log` row with `eventType = "monitoring.alert"`.
2. **Triage** — read the alert's own `category`/`severity`/`message`; consult §2 above for that category's specific diagnosis steps.
3. **Contain** — for anything touching the automation engine specifically, the kill switch (§2.2) is always the fastest, safest containment action; it requires no deploy and takes effect on the very next scheduler tick (within 60s).
4. **Diagnose** — application logs (full stack traces), `/monitoring/status`'s own snapshot, and the relevant audit table (`platform_audit_log` or `auto_execution_log`) are the three sources of truth. Never guess at a root cause without checking at least one of them.
5. **Fix** — apply the minimum change that resolves the root cause. Any change to a protected file (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`, the kill-switch/guardrail fields) requires the same explicit, separately-approved process every prior sprint in this project's history has required — an incident is not an exception to that rule.
6. **Verify** — confirm via `/monitoring/status` that the specific alert's condition has genuinely cleared, not just that the symptom that prompted investigation has gone away.
7. **Record** — the incident is already recorded in `platform_audit_log` (the initial detection) by the monitoring system itself; if the incident warranted a code change, that change's own commit message and this project's `CLAUDE.md` sprint-history convention are the durable record of what was done and why.

---

## 4. What This Runbook Does Not Cover

- **Live broker/order-execution incidents** — out of scope; no live broker integration exists anywhere in this platform as of Sprint 74 (the Phase 3 close decision explicitly deferred it).
- **Live market-data provider outages** (FMP, Alpha Vantage, a future live options-data vendor) — none of these paths are live in this deployment; Sprints 62/75/76 (still blocked on credentials) are where that verification work lives.
- **Infrastructure-level incidents** (the hosting platform itself down, DNS, TLS certificate expiry) — outside this application's own code; consult the hosting platform's own operational documentation.
- **A formal external security audit** — the Phase 6 plan's own §8 explicitly leaves this as a future owner decision, not a numbered sprint.

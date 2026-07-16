# Operations Handbook

**Status: living operational document**, introduced in Phase 6, Sprint 77 (see `docs/Phase-6-Master-Planning-Document.md` §2h). This is the day-to-day reference for **operating** the platform once deployed — distinct in purpose from `docs/Production-Rollout-Plan.md` (the one-time go-live procedure) and `docs/Incident-Response-Runbook.md` (Sprint 74, the per-alert-category diagnosis/recovery reference this handbook cross-references rather than duplicates).

Update this document whenever an operational procedure changes — it should describe how the platform is actually operated, not how it was originally designed to be.

---

## 1. Who This Document Is For

Whoever holds day-to-day operational responsibility for a running deployment of this platform — checking its health, responding to routine questions from users, performing routine maintenance, and being the first line of response before an issue escalates to the deeper diagnosis in `docs/Incident-Response-Runbook.md`.

---

## 2. Daily Operations

- [ ] Check `GET /api/monitoring/status` — confirm `status: "ok"` and `alerts: []`. If `status: "degraded"`, consult `docs/Incident-Response-Runbook.md` §2 for the specific alert category shown.
- [ ] Skim the previous 24 hours of `pino` logs (or whatever log-aggregation tool the hosting platform provides) for any `error`-level line not already surfaced as a monitoring alert.
- [ ] If the Options Income Engine's automation is live for any user (Stage 1 of the rollout plan), spot-check `GET /execution/auto/status` for that account and confirm the reported state (`armed`, `executionMode`) matches what's expected.

## 3. Weekly Operations

- [ ] Review the request-volume snapshot log lines (Sprint 52, every 5 minutes) for the week's own traffic trend — is total volume growing in a way that suggests revisiting the rate-limit thresholds (`docs/Production-Rollout-Plan.md` §3.2)?
- [ ] Review `platform_audit_log` for the week's `auth.login_failed` and `settings.updated` rows — a routine sanity check, not a forensic audit, looking only for anything that looks obviously wrong (a burst of failures from one account, a settings change nobody remembers making).
- [ ] Confirm the most recent scheduled database backup (`docs/Production-Rollout-Plan.md` §4.1) completed successfully.
- [ ] If any live-data provider is active (Stage 1/2 of the rollout), spot-check that its own `*Connected` settings field still reads `true` and that a fresh report/scan genuinely carries live (not silently-fallen-back-to-SIMULATED) data in its `dataSource` field.

## 4. Monthly Operations

- [ ] Review the accumulated month of `GET /api/monitoring/status` alert history (via `platform_audit_log`'s `eventType = "monitoring.alert"` rows) — look for any alert category that fires repeatedly; a recurring `warning`-severity alert that never escalates to `critical` may still indicate a threshold that needs retuning (`docs/Production-Rollout-Plan.md` §10, risk #7).
- [ ] Reconcile the manual migration file count in `lib/db/manual-migrations/` against what's actually applied to the production database — confirm no migration was ever skipped.
- [ ] Rotate any credential nearing its own provider's recommended rotation window (§5 below).
- [ ] Re-read `docs/Incident-Response-Runbook.md` in full — confirm nothing about the described architecture has silently drifted from reality; update it if it has.

---

## 5. Credential Rotation

**General procedure, applicable to any of the credentials in `.env.example`:**

1. Generate the new credential value with the issuing provider (Anthropic, Alpaca, FMP, Alpha Vantage, or regenerate `BETTER_AUTH_SECRET` via `openssl rand -base64 32`).
2. Update the environment variable in the hosting platform's own secret-management interface — **never** commit the real value anywhere, per `CLAUDE.md` rule 8.
3. Restart the application process so the new value takes effect (this codebase reads all credentials from `process.env` at call time or at `init()`, never caches a stale value across a restart).
4. Confirm the affected functionality still works (e.g., after rotating `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`, confirm `POST /coach/teach-greek` or any AI-narration endpoint still returns a real, non-fallback response).
5. Revoke the old credential with the issuing provider once the new one is confirmed working.

**`BETTER_AUTH_SECRET` specifically:** rotating this invalidates every existing user session (Better-Auth signs session tokens with it) — every signed-in user will need to sign in again. Communicate this to users before rotating in a live multi-tenant deployment, or schedule it for a low-traffic window.

**Broker/live-data credentials specifically (once any rollout stage is live):** rotating `ALPACA_API_KEY`/`ALPACA_API_SECRET` while the automation scheduler is armed for that account risks a mid-cycle authentication failure — per `docs/Incident-Response-Runbook.md`'s own established pattern, this surfaces honestly as a `scheduler.repeated_failure` alert (the engine fails closed, never silently), but the cleaner procedure is to **disarm the kill switch first** (§6 below), rotate, confirm connectivity via a read-only call, then re-arm.

---

## 6. Common Operational Tasks

### 6.1 Arming / disarming the automation kill switch

- **Disarm (the fast, safe default action for any concern):** `PATCH /api/settings` with `{"autoExecuteEnabled": false}` (and `{"autoAdjustEnabled": false}` if the adjustment engine specifically is the concern), or via the AutoPilot/Adjustments pages' own master switches. Takes effect on the very next scheduler tick (within 60 seconds) — no restart needed.
- **Arm:** the reverse — set the field(s) back to `true`, and confirm `executionMode` is set to `full_auto` (both are required together; see `.agents/memory/auto-execution-engine.md` for the full precedence rules). Only arm an account after confirming its guardrail settings (`autoMaxTradesPerDay`, `autoMaxConcurrentPositions`, `autoMinRavishScore`, `autoMaxDailyLossPct`) are genuinely what that user intends — never arm with default/placeholder guardrail values for a real account.

### 6.2 Running a manual scheduler cycle

`POST /execution/auto/run` (opening) or `POST /execution/auto/adjust/run` (de-risking) trigger one cycle immediately for the calling user, outside the normal 60-second tick — useful for confirming a guardrail change takes effect without waiting for the next natural tick. Per Sprint 67's own security review, these are **not** a kill-switch bypass — they call the identical gated cycle function the scheduler itself uses.

### 6.3 Checking why a specific decision was made

`GET /execution/auto/log` (and its `/adjust/log` counterpart) return the full, filterable decision history from `auto_execution_log` — every `executed`/`skipped`/`rejected`/`blocked` decision carries its own `reason` text. This is the first place to look for "why didn't my trade execute" or "why was this position closed" questions, before escalating to a code-level investigation.

### 6.4 Checking a user's own settings/audit history

`GET /api/settings` for current state; `platform_audit_log` (filtered by `userId`) for the history of changes to it, including who/when/which fields changed (never the values themselves, per the established privacy-preserving `changedFields`-only logging convention).

### 6.5 Verifying the Alpaca Paper Trading broker connection

`GET /api/broker/health` performs a live, read-only, authenticated round trip
to Alpaca's Paper Trading API (`GET /v2/account`, `/v2/positions`,
`/v2/orders`) and reports connection status, account balances, and open
position/order counts — never places, modifies, or cancels an order. It does
not run automatically; call it explicitly to check or refresh the connection
status. `GET /api/settings`'s `alpacaConnected` field reflects the outcome of
the most recently-performed check (a passive cache read, not a live call
triggered by `/settings` itself) — it stays honestly `false` until
`/api/broker/health` has been called at least once in the running process.

**Via the UI:** Settings → Broker Connection → **Check Connection**. The
button is disabled while the check is in flight and re-enables once it
completes. On success it shows account status, buying power, cash balance,
portfolio value, open position/order counts, and the last successful check
time; on failure it shows the exact reason, plus — specifically when
credentials are missing — a friendly note naming the required
`ALPACA_API_KEY`/`ALPACA_API_SECRET` environment variables. The connection
indicator at the top of the card updates immediately from the response,
before any settings reload. A permanent "Paper Trading Only" badge on the
card is a standing reminder that this connection never targets a live
endpoint.

Full detail: `docs/Broker-Health-API.md` (§10 covers the UI specifically).

### 6.6 Reconciling local trades against Alpaca Paper Trading orders/positions

`GET /api/broker/reconciliation` compares this platform's own local trade
records against Alpaca's real Paper Trading orders and positions and
reports discrepancies — missing at broker, missing locally, status/quantity/
symbol mismatches, open-position mismatches. **Entirely read-only**: it
never corrects, cancels, or closes anything on either side, and it only
runs when explicitly requested (page load or a manual Refresh button) —
never on a schedule.

**Via the UI:** the "Broker Reconciliation" nav item (`/broker-reconciliation`).
Shows a summary (Fully Reconciled or an issue count), an order-reconciliation
table (local vs. broker status/quantity/fill side by side), and a
position-comparison table — plus a Refresh button, disabled while a check is
in flight. When credentials are missing, the page stays fully usable and
shows the honest reason rather than a blank or fabricated result. There is
no distinct admin role in this platform (§6.7 below) — this page is
reachable by any signed-in user, scoped to their own account's own trades.

Two related read-only endpoints exist alongside it: `GET /api/broker/orders`
(every order, any status) and `GET /api/broker/orders/:orderId` (a single
order by id) — useful for direct inspection outside the reconciliation
comparison itself.

Full detail, including the normalized order-lifecycle model and every
reconciliation rule: `docs/Alpaca-Paper-Trading-Architecture.md`.

### 6.7 Adding a new operator/admin user

This platform's `role` field on `users` exists but — confirmed by direct inspection — has no differentiated admin-only functionality built on top of it as of Sprint 77; every route's own authorization is per-user data scoping (`getScopedUserId()`), not role-based. There is currently no "operator dashboard" distinct from a regular user's own account. Standing up one is out of scope for this handbook and would be its own future sprint if ever needed.

### 6.8 Checking the Paper Portfolio Dashboard

The "Paper Portfolio" nav item (`/paper-portfolio`) composes Broker Health,
positions, and Reconciliation into one at-a-glance view: account status,
buying power, cash balance, portfolio value, open position/order counts,
Unrealized P/L (summed live from real positions once checked), Realized P/L
(always honestly "Not available" — no endpoint exists for it, see
`docs/Alpaca-Paper-Trading-Architecture.md` §4.6), and one card per open
position (symbol, quantity, average cost, long/short, and a reconciliation
badge).

**Every section requires its own explicit Refresh** — Refresh Broker
Health, Refresh Portfolio, Refresh Reconciliation. None of the three fetch
automatically on page load; this page is stricter about "manual only" than
the Broker Reconciliation page (§6.6), which does fetch once on load. Each
button disables itself, independently, only while its own request is in
flight. When credentials are missing or a check fails, each section shows
its own honest reason and the rest of the page stays fully usable.

Full detail: `docs/Alpaca-Paper-Trading-Architecture.md` §4.6.

---

## 7. Escalation

1. **First response:** consult this handbook's own §2–§6 for anything routine.
2. **An active alert in `GET /api/monitoring/status`:** consult `docs/Incident-Response-Runbook.md` §2 for the specific category.
3. **Anything touching a protected file** (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`) **as a candidate fix:** this requires the project owner's own explicit, separately-approved decision — no operator, however senior, may make this call unilaterally, per `CLAUDE.md` rule 2, restated identically in the incident runbook and the rollout plan.
4. **Anything involving real money moving unexpectedly:** disarm the kill switch (§6.1) immediately, first, before any further diagnosis — this is never the wrong first move, even if it later turns out the automation was behaving correctly.
5. **A genuine data-loss or database-corruption event:** `docs/Production-Rollout-Plan.md` §4.2 (Recovery Procedure).

**This handbook does not define a specific human escalation chain (names, phone numbers, paging rotations)** — that is inherently deployment-specific and outside what a codebase-level document can specify; the project owner should fill this in for whatever real team eventually operates a production deployment.

---

## 8. Cross-References

- `docs/Broker-Health-API.md` — the Alpaca Paper Trading broker/account read-only verification API referenced in §6.5 above.
- `docs/Alpaca-Paper-Trading-Architecture.md` — the full Alpaca integration picture (order submission, Broker Health, Order Lifecycle & Reconciliation, and the Paper Portfolio Dashboard), including the reconciliation panel referenced in §6.6 and the portfolio dashboard referenced in §6.8 above.
- `docs/Incident-Response-Runbook.md` — per-alert-category diagnosis and recovery.
- `docs/Production-Rollout-Plan.md` — the one-time go-live procedure and backup/recovery details this handbook's §6/§7 draw on.
- `docs/Production-Readiness-Report.md` — current-state readiness assessment.
- `.agents/memory/auto-execution-engine.md` / `trade-adjustment-engine.md` — the full engineering-level precedence rules for the kill switch, referenced but not duplicated in §6.1 above.
- `.env.example` — the authoritative environment-variable inventory referenced in §5.

# Version 1 Release Candidate (RC1) — Security Review

Step 4 of the RC1 hardening pass. Per the explicit instruction, this
**hardens the existing implementation — it does not redesign
authentication.** Builds on `docs/Phase-9-Security-Review.md` (which added
security response headers, global error handling, and uncaught-exception
handlers) and confirms those protections, plus everything added since,
remain in place and working at Phase 44's current size.

**Self-review disclosure, carried forward from Phase 9's own report:**
this is a self-review performed by the same development thread that made
the changes it describes — it is **not** a substitute for an independent,
formal security audit, and this document says so explicitly rather than
implying otherwise.

## 1. Authentication

Better-Auth, self-hosted against the platform's own `users` table (Phase
1, Sprint 6) — unchanged and not redesigned this phase, per the explicit
instruction. Confirmed still wired: `middlewares/requireAuth.ts` gates
protected routes, `middlewares/auth.ts`'s `loadSession` populates
`req.user` non-blockingly for routes that need to know the caller without
requiring one. `REQUIRE_AUTH` remains an explicit, disclosed opt-in
(unset = every route resolves a legacy-owner stand-in via
`getScopedUserId()`, the same rollback-safe default `Phase-9-Technical-Debt-Report.md`
already documented as intentional, not a defect).

## 2. Authorisation / tenant isolation

Verified by direct inspection, not assumption: of the 71 non-exempt
backend route files, 64 call `getScopedUserId(req)` before touching any
user-owned data. The remaining 7 (`events`, `options`, `performance`,
`scoring`, `tradingSession`, `tradingSessionWindows`, plus `routes/index.ts`
itself, which registers no routes of its own) were each individually
checked and confirmed to serve either read-only, non-user-scoped market
data (event calendars, option chains, session windows) or entirely
synthetic/deterministic demo data with no real per-user backing store
(`performance/*` — its own module header states "Nothing here touches the
real trades table") — none is a tenant-isolation gap.

**Admin authorization**, added at Phase 11 (this thread's own "Live Market
Operations & Production Validation" phase): `middlewares/requireAdmin.ts`
gates `routes/ops.ts`'s Operations Dashboard routes on `req.user.role ===
"admin"`, returning a real 401 for no session and a distinct 403 (not a
404) for an authenticated-but-non-admin session — deliberately different
from this codebase's own ownership-scoping 404 convention, since these
routes aren't per-resource and there's no existence to leak. There is
still no self-service admin-promotion endpoint — granting the role remains
a manual, operator-level database action, matching the project's own
documented "no automated privilege escalation path" design.

`lib/tenantIsolation.test.ts` continues to be extended with every new
user-scoped table added by every phase (3 more added in Phase 44 alone:
`portfolio_workflow_instances`, `workspace_pinned_resources`,
`workspace_recent_views`) — re-confirmed passing this phase.

## 3. Input validation

Every documented route validates its request body/query against the
generated Zod schemas (`api-zod`, derived from `openapi.yaml`) before
touching application logic — the same pattern used consistently since the
OpenAPI contract was introduced. No route was found parsing `req.body`
directly without a schema `.parse()`/`.safeParse()` call.

## 4. Secrets

- No hardcoded secret-like literal (API key prefix, inline password
  string) was found anywhere in non-test application source, confirmed via
  a targeted `grep` for common secret shapes.
- `.env.example` documents every environment variable name and its
  purpose, never a real value — unchanged, consistent with CLAUDE.md rule
  8 ("Environment variable names and purposes can be discussed freely;
  actual key values never should be").
- Settings-table secret fields (e.g. `alpacaApiKey`) are never logged —
  `settings.updated`'s audit-log entry records only the **names** of
  changed fields, never their values (Phase 1, Sprint 10's own design,
  re-verified unchanged).

## 5. Rate limiting

`middlewares/rateLimit.ts` remains in place: a general limiter across
every `/api` route plus a stricter tier specifically scoped to
`/api/auth/*` (credential-stuffing mitigation). Confirmed still correctly
scoped (the mounting-order bug this project's own history disclosed and
fixed — an earlier draft accidentally applied the auth-specific limit to
every route — remains fixed). Health checks stay exempt by mount order.
Both limiters continue to skip in `NODE_ENV === "test"` unless explicitly
forced, so the test suite is unaffected.

## 6. Logging

`platform_audit_log` (Phase 1, Sprint 10) continues to record
authentication events, settings changes (field names only), and — since
Phase 74/monitoring work — background-job health and alert-worthy
conditions. `auto_execution_log` remains untouched, per CLAUDE.md rule 3.
Structured `pino` logging is used consistently across the backend; no
route was found using a raw `console.log` for request logging (see
`docs/RC1-Repository-Audit.md` §1).

## 7. Error handling

Phase 9's global Express error-handling middleware (logs the real error
server-side, returns only a generic `{"error": "Internal server error"}`
to the caller) and the `uncaughtException`/`unhandledRejection` process
handlers in the real server entrypoint (`index.ts`) are both confirmed
still present and unmodified.

## 8. Sensitive data exposure

- The established 404-for-both-"doesn't exist"-and-"isn't yours" pattern
  (never a separate 403 for ownership routes, avoiding an existence leak)
  is used consistently across every ownership-scoped route checked,
  including Phase 44's new Portfolio Workspace routes.
- No route was found echoing a caller-supplied value back into an error
  message in a way that would leak another user's data (every "not found"
  message is generic, never including the requested resource's own
  content).

## Summary

No new security defect was found this phase. Every protection Phase 9
added (headers, global error handling, uncaught-exception handling) and
every phase since (rate limiting, admin authorization, monitoring/alerting
audit trail) remains in place and correctly scoped. The one item still
carried forward as deliberately deferred, unchanged from
`Phase-9-Technical-Debt-Report.md`: no Content-Security-Policy header,
since a real CSP needs a genuine inventory of every legitimate script/
style/connect origin the frontend actually talks to, and guessing one
either breaks the app or provides no real protection. See
`docs/Known-Limitations.md`.

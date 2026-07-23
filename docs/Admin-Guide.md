# Admin Guide

For operators running a live instance of this platform day-to-day. This
guide is the short, orientation-level companion to the deeper operational
references it links out to — read this first, then follow a link when you
need the full procedure.

## Roles

- **Regular user** — every route resolves to `getScopedUserId(req)`: a
  real authenticated user's own data, fully tenant-isolated from every
  other user (verified by `lib/tenantIsolation.test.ts` on every
  user-scoped table).
- **Admin** — `users.role === "admin"` gates `routes/ops.ts`'s Operations
  Dashboard routes via `middlewares/requireAdmin.ts`. There is no
  self-service admin-promotion endpoint anywhere in this codebase —
  granting the role is a manual, operator-level database action
  (`UPDATE users SET role = 'admin' WHERE id = '<user-id>'`), by design.

## The kill switch — the single most important thing to know

The Options Income Engine's automation (auto-execution and auto-
adjustment) is gated by two settings-table switches
(`autoExecuteEnabled`/`autoAdjustEnabled`), checked live before every
single execution or close — not once per cycle. **Disarming either switch
is the fastest, safest way to stop automated trading activity for a
user**, and requires no code change, deployment, or restart. See
`docs/Incident-Response-Runbook.md` §2.2 for the full diagnosis/recovery
procedure, and `.agents/memory/auto-execution-engine.md` for the engine's
own detailed safety invariants.

## Day-to-day operations

The full, living reference is `docs/Operations-Handbook.md` — daily/
weekly/monthly checklists, credential rotation, and the escalation ladder.
Key entry points:

- **Health**: `GET /api/healthz` — always reachable, exempt from auth and
  rate limiting.
- **Monitoring**: `GET /api/monitoring/status` — database connectivity,
  background-job health (the 60-second automation scheduler tick and the
  5-minute alerts tick), and audit-log-derived alert signals (elevated
  guardrail-block rate, elevated auth-failure rate). See
  `docs/Incident-Response-Runbook.md` for what each alert category means
  and how to respond.
- **Audit trail**: `platform_audit_log` records authentication events and
  settings changes (field names only, never values); `auto_execution_log`
  records every automation decision (armed/blocked/executed) and is never
  modified by general audit-log work, per CLAUDE.md rule 3.

## Multi-tenancy

`REQUIRE_AUTH` defaults **off** — every request resolves to a single
legacy-owner account when unset. This is a deliberate, rollback-safe
default, not a bug. Before any real multi-user deployment: set
`REQUIRE_AUTH=true`, verify sign-in end-to-end, and confirm
`CORS_ALLOWED_ORIGINS` is set to your real frontend origin (unset means
fully open CORS, fine for local development, not for production).

## Deployment and rollback

See `docs/Deployment-Guide.md`, `docs/Production-Rollout-Plan.md`, and
`docs/RC1-Release-Checklists.md` for the full, step-by-step procedures —
not duplicated here.

## Getting help from the platform itself

Every engine has its own AI Coach (never a trade recommendation — every
coach module is structurally incapable of taking a symbol/position/account
figure as input for its topic explanations) and a Learning Centre linking
into real educational content. Point a new operator or user at these
before assuming a support ticket is needed.

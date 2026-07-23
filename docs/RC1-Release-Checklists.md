# Version 1 Release Candidate (RC1) — Release Checklists

Step 10 of the RC1 hardening pass: Known Issues, Migration Notes,
Deployment Checklist, Production Checklist, Rollback Checklist for
`v1.0.0-rc1`. Companion to `docs/Release-Notes-v1.0.0-rc1.md` (the
narrative summary) and `docs/Production-Rollout-Plan.md`/
`docs/Operations-Handbook.md` (the deeper, ongoing operational
references this checklist doesn't duplicate).

## Known Issues

See `docs/Known-Limitations.md` for the full, detailed list with
rationale for each. Punch-list form:

- [ ] Live market-data providers (FMP/Alpha Vantage) — never verified against real credentials.
- [ ] Live broker integration (Alpaca) — never verified against real credentials.
- [ ] No email/push notification delivery (in-app only).
- [ ] No independent, formal security audit (self-review only).
- [ ] No Content-Security-Policy header.
- [ ] Frontend main bundle chunk (559.61 kB) over the 500 kB advisory threshold.
- [ ] `Dashboard.tsx`/`PortfolioAI.tsx` don't use the shared `Card` component (cosmetic).
- [ ] No containerized deployment artifact (`Dockerfile`).

None of these block a SIMULATED-mode deployment. All are pre-existing,
this release's own `docs/Known-Limitations.md` states so explicitly, and
none was newly introduced by this hardening pass.

## Migration Notes

- 37 hand-written manual migration files exist under
  `lib/db/manual-migrations/`, numbered `000` through `036`, applied in
  order — the current, complete schema state as of this release.
- **This release adds zero new migrations.** The one production code
  change this phase made (`lib/alertTypes.ts`) is a pure TypeScript type
  relocation with no database impact.
- Every migration follows the nullable → backfill → enforce-not-null
  discipline (CLAUDE.md rule 7) — safe to apply against a database with
  existing data, in numeric order, without a maintenance-window data
  transformation step beyond what each migration file itself already
  documents.
- Before deploying this release to an environment that hasn't kept pace
  with every migration: confirm which of the 37 files have already been
  applied (`SELECT * FROM drizzle_migrations` or an equivalent tracking
  mechanism your deployment uses) and apply the remainder in order.

## Deployment Checklist

- [ ] `pnpm run typecheck` — clean across the whole workspace.
- [ ] `pnpm --filter @workspace/api-server run test` — run at least twice;
      if a failure appears, cross-reference `docs/RC1-Test-Quality-Review.md`'s
      known flake categories before treating it as a regression, then
      re-run serially (`vitest run --no-file-parallelism`) to confirm.
- [ ] `pnpm --filter @workspace/ravish-trading run test` — all files
      passing.
- [ ] `PORT=5000 BASE_PATH=/ pnpm run build` — succeeds (a chunk-size
      warning on the main bundle is expected and disclosed, not a
      failure).
- [ ] Every manual migration file up to `036_portfolio_workspace.sql`
      applied to the target database.
- [ ] `DATABASE_URL`, `BETTER_AUTH_SECRET` set for the target environment.
- [ ] `REQUIRE_AUTH` and `CORS_ALLOWED_ORIGINS` set deliberately (not left
      at their permissive local-dev defaults) if this is a real multi-user
      deployment.
- [ ] `git diff --stat` against the 5 protected files + broker integration
      confirms zero-line diff (re-verify at deploy time, not just at code-
      review time).

## Production Checklist

- [ ] `GET /api/healthz` reachable and returning healthy.
- [ ] `GET /api/monitoring/status` reachable, database connectivity true,
      background-job health showing recent successful ticks for both the
      automation scheduler and the alerts worker.
- [ ] A real sign-up + sign-in verified end-to-end if `REQUIRE_AUTH=true`.
- [ ] The kill switch (`autoExecuteEnabled`/`autoAdjustEnabled` in
      Settings) is in the intended state for this deployment — armed only
      if automation is genuinely wanted live.
- [ ] Rate limiting confirmed active (`RateLimit-*` response headers
      present on a real request).
- [ ] `platform_audit_log` receiving real entries for sign-in/sign-out and
      settings changes.
- [ ] Every live-data-provider env var either genuinely configured and
      verified, or deliberately left unset with the platform running in
      its fully-functional SIMULATED mode — never a half-configured state
      the platform can't honestly label.

## Rollback Checklist

- [ ] **Automation-only concern** (an automation decision looks wrong):
      disarm the kill switch via Settings — instant, no deployment
      involved. This is always the fastest, safest first response.
- [ ] **Code regression, no new migration involved**: redeploy the
      previous build/commit.
- [ ] **A migration was involved**: confirm the migration's own
      nullable/backfill/enforce structure — a rollback typically means
      redeploying the previous code against a database that still has the
      new (nullable, additive) column/table, which is safe by
      construction; only a genuinely destructive migration (none in this
      release) would need special handling.
- [ ] After any rollback: re-run the Deployment Checklist above against
      the rolled-back state before considering the incident closed.
- [ ] Record the rollback and its cause in `platform_audit_log`-adjacent
      operational notes (or your team's own incident record), per
      `docs/Incident-Response-Runbook.md`'s general workflow.

# Deployment Guide

This is the short, orientation-level entry point. The full, step-by-step
procedures already exist and are not duplicated here:

- **One-time go-live procedure**: `docs/Production-Rollout-Plan.md` (the
  Blueprint-mandated 3-stage order: Options Income Engine first, Investing
  Engine second, Trading Engine last).
- **Day-to-day operations once live**: `docs/Operations-Handbook.md`.
- **Incident diagnosis/recovery**: `docs/Incident-Response-Runbook.md`.
- **This release's own checklists**: `docs/RC1-Release-Checklists.md`
  (Known Issues, Migration Notes, Deployment Checklist, Production
  Checklist, Rollback Checklist for v1.0.0-rc1 specifically).

## Runtime model

This is a Node.js process, not a containerized deployment — there is no
`Dockerfile`/`docker-compose.yml` in this repository, and none was added
for this release (deliberately; see `docs/Known-Limitations.md`). The
backend (`artifacts/api-server`) builds to a single `dist/index.mjs` via
`node ./build.mjs`, and the frontend (`artifacts/ravish-trading`) builds
to static assets served by the same process. `.env.example`'s `REPL_ID`
variable reflects that this platform has, in practice, been deployed on
Replit's own Autoscale infrastructure — the process model (one Node
process, environment variables for configuration, a `PORT`/`BASE_PATH`
pair) is portable to any standard Node hosting environment, not
Replit-specific.

## Build

```bash
PORT=5000 BASE_PATH=/ pnpm run build
```

Runs `pnpm run typecheck` first (the build fails fast on a type error),
then builds every workspace package with a `build` script.

## Required environment variables for a real deployment

At minimum: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `REQUIRE_AUTH=true`,
`CORS_ALLOWED_ORIGINS` (set to your real frontend origin — leaving it
unset means fully open CORS). See `docs/Installation.md` and
`.env.example` for the full list, including the optional live-data
provider credentials this release does not yet verify end-to-end (see
`docs/Known-Limitations.md`).

## Database migrations on deploy

Every schema change ships as a hand-written SQL file in
`lib/db/manual-migrations/`, applied in numeric order — this project does
not run `drizzle-kit push` against a production database. Before deploying
a build that includes new migrations, confirm every file in that directory
up to the current release has been applied:

```bash
psql "$DATABASE_URL" -f lib/db/manual-migrations/<next-file>.sql
```

## Rollback

- **Automation-only concern** (an automation decision looks wrong): arm
  down the kill switch (`autoExecuteEnabled`/`autoAdjustEnabled` in
  Settings) — instant, no deployment involved. See `docs/Admin-Guide.md`.
- **Code regression, no new migration involved**: redeploy the previous
  build.
- **A migration was involved**: see `docs/RC1-Release-Checklists.md`'s
  Rollback Checklist and `docs/Production-Rollout-Plan.md` §4 for the full
  blast-radius-specific procedure — this project's manual-migration
  discipline (nullable → backfill → enforce-not-null) exists specifically
  to make a migration-involving rollback tractable.

## Monitoring after deploy

`GET /api/monitoring/status` — see `docs/Admin-Guide.md` and
`docs/Incident-Response-Runbook.md`.

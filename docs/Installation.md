# Installation

## Prerequisites

- Node.js 22.x (this workspace was built and validated against v22.22.2).
- pnpm 10.x (`preinstall` refuses to run under npm/yarn).
- A Postgres 16 database (local or remote) for development and testing.

## 1. Install dependencies

```bash
pnpm install
```

`preinstall` removes any stray `package-lock.json`/`yarn.lock` and refuses
to proceed under a non-pnpm package manager — this is intentional, not a
bug.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in, at minimum:

| Variable | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | Everything | A real Postgres connection string. |
| `BETTER_AUTH_SECRET` | Authentication | Any string ≥32 characters for local dev; a real secret in production, never committed. |

Everything else in `.env.example` is optional and documented inline —
`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` (AI coach narration; the platform
degrades to deterministic templates when neither is set), `ALPACA_*`
(options broker integration), `FMP_API_KEY`/`ALPHA_VANTAGE_API_KEY`/
`POLYGON_API_KEY` (live market-data providers — the platform runs fully
functional in SIMULATED mode without any of these; see
[`Known-Limitations.md`](Known-Limitations.md)), `REQUIRE_AUTH` (defaults
off — every route falls back to a single legacy-owner account when unset,
a deliberate rollback-safe default), and the rate-limiting/CORS variables.

## 3. Set up the database

Push the Drizzle schema, then apply every hand-written manual migration in
order (this project does not rely on `drizzle-kit push` alone for changes
touching existing data — see `docs/Architecture.md`):

```bash
cd lib/db
pnpm drizzle-kit push   # creates tables from the current schema
for f in manual-migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

If `drizzle-kit push` hangs in a sandboxed environment, apply the schema
directly via the manual migration files in numeric order instead — every
migration is idempotent-safe to inspect before running.

## 4. Typecheck and build

```bash
pnpm run typecheck
pnpm run build
```

`build` runs `typecheck` first, then builds every package with a `build`
script (`artifacts/ravish-trading` via Vite, `artifacts/api-server` via
its own `build.mjs`).

## 5. Run the servers

Development (backend + frontend, single combined process):

```bash
cd artifacts/api-server && pnpm run dev
```

Frontend dev server alone (proxying `/api` to a separately-running
backend):

```bash
cd artifacts/ravish-trading && pnpm run dev
```

Production, after `pnpm run build`:

```bash
PORT=5000 BASE_PATH=/ pnpm run build   # from the repo root
cd artifacts/api-server && pnpm run start
```

## 6. Run tests

```bash
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/ravish-trading run test
```

The backend suite needs a real Postgres connection (`DATABASE_URL`) — a
disposable local or CI database is required, not just for new features but
for the existing suite as a whole. If PostgreSQL produces environmental
failures under parallel test execution, re-run with
`vitest run --no-file-parallelism` — see `docs/RC1-Test-Quality-Review.md`
for the known, already-disclosed flake categories this addresses.

## Troubleshooting

- **`localhost:5432 — no response`**: Postgres isn't running. On a system
  using `pg_ctlcluster` (e.g. Debian/Ubuntu), `pg_ctlcluster 16 main
  start`.
- **`drizzle-kit push` hangs**: apply the manual migration SQL files
  directly instead (see Step 3).
- **A single test file times out under `beforeAll`**: usually resource
  contention from too many app instances starting concurrently against one
  shared database — re-run that file alone or with
  `--no-file-parallelism`.

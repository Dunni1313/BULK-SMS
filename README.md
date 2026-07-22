# DK AI Institutional Investing & Trading OS

**Version 1.0.0**

A three-engine institutional platform for options income, systematic
trading research, and investment decision support — built on top of the
existing, mature **DK Option Engine** (Engine 3), extended with an
**Institutional Investing Engine** (Engine 1) and an **Institutional
Trading Engine** (Engine 2), all sharing one platform layer: authentication,
multi-tenancy, database, AI narration, reporting, and audit logging.

This README is the entry point. For depth, see:

- [`docs/Architecture.md`](docs/Architecture.md) — how the three engines and the shared platform fit together.
- [`docs/Installation.md`](docs/Installation.md) — get a local instance running.
- [`docs/Developer-Guide.md`](docs/Developer-Guide.md) — conventions, workflow, where things live.
- [`docs/Admin-Guide.md`](docs/Admin-Guide.md) — operating a running instance.
- [`docs/API-Guide.md`](docs/API-Guide.md) — the REST API and how it's generated/consumed.
- [`docs/Deployment-Guide.md`](docs/Deployment-Guide.md) — how to deploy and roll back.
- [`docs/Version-1-Feature-List.md`](docs/Version-1-Feature-List.md) — everything shipped in v1.
- [`docs/Release-Notes-v1.0.0.md`](docs/Release-Notes-v1.0.0.md) — the current release's own notes.
- [`docs/Known-Limitations.md`](docs/Known-Limitations.md) — what's deliberately deferred or simulated, and why.
- [`docs/RC1-Diagrams-And-Catalogues.md`](docs/RC1-Diagrams-And-Catalogues.md) — architecture/dependency/navigation diagrams, report/learning/coach catalogues.
- [`CHANGELOG.md`](CHANGELOG.md) — what changed, release by release.
- [`CLAUDE.md`](CLAUDE.md) — the authoritative, exhaustive phase-by-phase build history and the engineering safety rules that govern this codebase.

## What this is

Three engines, one platform:

1. **Engine 1 — Institutional Investing Engine.** Company research,
   financial statement analysis, valuation models (DCF/Graham/Buffett/Tom
   Nash), an AI Investment Committee, economic moat and quality scoring,
   industry comparison, portfolio construction, watchlists, decision
   support, rebalancing, and compliance.
2. **Engine 2 — Institutional Trading Engine.** Market structure, multi-
   timeframe trend, liquidity/order-flow, market regime detection, a
   probability engine, portfolio-wide risk management, a trading journal,
   and a research/coach workspace — all built on a simulated (deterministic,
   never fabricated) market-data seam, with live-data verification an
   explicitly deferred, credential-gated future step.
3. **Engine 3 — Options Income Engine.** The original, mature, working
   system this platform is built on top of — a scanner, strategy builder,
   Greeks, portfolio exposure, income optimization, risk analytics,
   automation (with an explicit kill switch), and an AI options coach.

A shared platform layer underpins all three: Better-Auth authentication,
per-user tenant isolation (verified by a dedicated test suite on every
user-scoped table), a Drizzle/Postgres database, an `ai-core` narration
layer with a single enforced disclaimer contract, an Institutional
Reporting Centre, a Learning Centre, and a platform-wide audit log.

## Quick start

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL and BETTER_AUTH_SECRET at minimum
pnpm run build
pnpm run typecheck
```

See [`docs/Installation.md`](docs/Installation.md) for the full setup,
including database migrations and running the dev servers.

## Monorepo layout

```
artifacts/api-server      Express 5 backend (TypeScript, ESM)
artifacts/ravish-trading  React 19 + Vite frontend
artifacts/e2e             Playwright end-to-end tests
artifacts/mockup-sandbox  Design/prototyping sandbox (not part of the shipped app)
lib/db                    Drizzle schema + hand-written manual migrations
lib/api-spec               openapi.yaml — the single source of truth for the REST contract
lib/api-zod                Generated Zod validators (do not hand-edit)
lib/api-client-react       Generated React Query hooks (do not hand-edit)
lib/ai-core                Provider-agnostic LLM narration core (caching, disclaimers, streaming)
lib/auth                   Better-Auth configuration
docs/                       All architecture, operations, and release documentation
```

## Status

This is the **first stable release, v1.0.0**. See
[`docs/Release-Notes-v1.0.0.md`](docs/Release-Notes-v1.0.0.md) for what's
in it, and [`docs/Known-Limitations.md`](docs/Known-Limitations.md) for
what's explicitly deferred (live market-data providers, a formal external
security audit, email/push notification delivery).

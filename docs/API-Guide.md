# API Guide

## Contract-first, generated, never hand-edited

The single source of truth for this platform's REST API is
`lib/api-spec/openapi.yaml`. Every route's request/response shape is
generated from it into two packages:

- `lib/api-zod` — Zod validators, used **server-side** in every route
  handler (`Schema.parse(req.body)` / `Schema.parse(responseData)`).
- `lib/api-client-react` — React Query hooks, used **client-side**
  (`useGetPortfolioWorkspaceDashboard()`, etc.) — this is how the
  frontend talks to the backend; hand-written `fetch()` calls against
  undocumented endpoints are not the established pattern.

After changing `openapi.yaml`, regenerate both:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Never hand-edit anything under a package's `generated/` directory — the
next codegen run will silently overwrite it.

## Base path and versioning

Every route is mounted under `/api`. There is no `/v1`/`/v2` prefix in
this platform's own API — Version 1 of the *platform* (this release) ships
one API surface, not a versioned-endpoint scheme. `routes/auth.ts` (all
Better-Auth endpoints) and `routes/health.ts` are mounted directly by
`app.ts` rather than through the shared business-route pipeline; every
other route goes through `routes/index.ts`.

## Authentication

Bearer/cookie-based sessions via Better-Auth. Most business routes accept
an unauthenticated request and resolve to a legacy-owner stand-in account
when `REQUIRE_AUTH` is unset (the platform's deliberate, rollback-safe
default — see `docs/Admin-Guide.md`). With `REQUIRE_AUTH=true`, an
unauthenticated request to a protected route receives a real 401.

## Ownership and error conventions

- **404, never a separate 403, for "doesn't exist" vs. "isn't yours."**
  Every ownership-scoped route (a workflow instance, a pinned resource, a
  trading position, a journal entry, and so on) queries with an explicit
  `and(eq(id), eq(userId))` filter — a request for another user's resource
  gets the identical 404 a nonexistent id would, deliberately avoiding an
  existence leak.
- **400** for a request body/query that fails Zod validation.
- **Global error handler**: an unhandled exception in any route returns a
  generic `{"error": "Internal server error"}` — the real error is logged
  server-side via `pino`, never leaked to the caller.

## Rate limiting

A general limiter applies to every `/api` route; a stricter tier applies
specifically to `/api/auth/*`. Standard `RateLimit-*` response headers are
set on every response. `GET /api/healthz` is exempt by mount order.

## Streaming endpoints

A handful of AI-narration endpoints (e.g.
`POST /stock-analyst/value-research/ask/stream`,
`POST /trading/coach/ask/stream`) are Server-Sent Endpoints with a
`meta → delta → done` event contract, deliberately kept **outside** the
formal OpenAPI contract — Orval's generator can't cleanly model an SSE
stream's shape, so these are consumed via a small shared `streamCoach()`
client helper on the frontend rather than a generated hook. Every
non-streaming version of the same capability (e.g. the single-shot
`POST .../ask`) **is** fully documented in `openapi.yaml`.

## Discovering the API

- `lib/api-spec/openapi.yaml` is the definitive, browsable source (any
  standard OpenAPI viewer renders it).
- `docs/RC1-Diagrams-And-Catalogues.md` §7–9 catalogues every report type,
  Learning Centre topic, and AI Coach topic exposed via the API.
- Every route file under `artifacts/api-server/src/routes/` corresponds
  1:1 with a section of `openapi.yaml` — reading the route file alongside
  the spec is the fastest way to understand a given endpoint's real
  behavior, including any deliberately-undocumented query-parameter
  overrides (always disclosed in that route file's own header comment when
  present).

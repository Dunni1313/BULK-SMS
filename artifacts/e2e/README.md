# @workspace/e2e

Phase 6, Sprint 69 — this platform's first browser-level end-to-end testing
capability. See `docs/Phase-6-Master-Planning-Document.md` §5 (and the
Sprint 69 as-built note in that same document) for the full
framework-selection rationale and scope.

## What this is

A [Playwright](https://playwright.dev) suite that drives the real, built
application (both the Express `api-server` and the built `ravish-trading`
frontend, served via `vite preview`) in a real browser — proving the
platform actually works end-to-end, a layer neither the existing ~1,190
backend unit/route tests nor the existing ~150 frontend component tests
provide on their own. It complements, never replaces, those suites.

**Scope of this first slice, per the approved Sprint 69 boundary:** one
smoke test per engine (login → one real flow), proving the harness itself
works. Broader E2E coverage (a cross-engine integration suite, more flows
per engine) is explicitly out of scope here and belongs to a future,
separately-approved sprint.

## Running locally

Requires a real Postgres database (the same one every other test suite in
this repo needs) and a `BETTER_AUTH_SECRET`:

```sh
export DATABASE_URL="postgresql://<user>:<pass>@localhost:5432/<db>"
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
cd artifacts/e2e
pnpm test
```

Playwright's own `webServer` config builds and starts both the backend
(port 4300) and the frontend (port 4173, `vite preview`) automatically,
waits for both to report healthy, runs the suite, then tears both down.
Nothing needs to be started manually first.

## Browsers

This environment ships with Chromium pre-installed at a fixed path
(`PLAYWRIGHT_BROWSERS_PATH`) — `@playwright/test` is pinned to an exact
version (`1.56.0`, see `package.json`) confirmed to match that pre-installed
browser revision. **Do not bump this version casually** — a mismatch
produces a "browser not found, run `playwright install`" error, since a
newer/older `@playwright/test` release generally expects a different
Chromium revision. If a version bump is ever needed, verify the new
version's expected revision actually matches what's pre-installed (or
budget time for a real `playwright install` download) before changing it.

A fresh CI runner (see `.github/workflows/ci.yml`'s own `e2e` job) has no
pre-installed browser at all and runs `playwright install --with-deps
chromium` itself — this is expected and correct there, unlike in this
session's own interactive sandbox.

## Why a proxy is needed (`E2E_API_PROXY_TARGET`)

The frontend's generated API client makes relative `/api/...` requests,
resolved against whatever origin the page was loaded from. In this repo's
real deployment target, frontend and backend are served under one origin
by the hosting infrastructure — there is no proxy config anywhere in this
repo's own source for that. Since Playwright's `webServer` runs the two
halves as genuinely separate local processes on separate ports, this
package's `playwright.config.ts` sets `E2E_API_PROXY_TARGET` when starting
the frontend's `vite preview` process, which `vite.config.ts` reads to
enable an opt-in-only proxy (`undefined`/no-op for every other
`dev`/`build`/`preview` invocation that doesn't set this var).

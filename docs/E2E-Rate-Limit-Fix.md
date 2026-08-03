# E2E Rate-Limit Fix — Maintenance Note

Branch: `fix/e2e-signup-login-timeout`. Repository maintenance, independent
of PR #48 (backend database race conditions) and PR #49 (trade adjustment
preview test determinism), and independent of PR #46/#47.

## Root cause

Playwright's E2E suite (`artifacts/e2e`) intermittently failed sign-up with
tests stuck on `/login`, and separately with slow/flaky timeouts on later
steps. Direct evidence, reproduced against a real server:

- **Exact endpoint returning 429**: `POST /api/auth/sign-up/email` returned
  `HTTP 429` with body
  `{"error":"Too many requests — please slow down and try again shortly."}`
  when the auth rate-limit budget was exhausted. General `/api/*` routes
  (e.g. `/api/trade-plans`, `/api/stock-analyst/research-notes/:symbol`)
  returned 429 from the general limiter under the same mechanism.
- **Rejection point**: the rate-limit middleware runs before Better-Auth's
  own handler, so a 429'd sign-up never reaches account creation — confirmed
  directly (the `users` table row count was unchanged after a 429'd sign-up
  attempt). Session creation never begins; no partial state is left behind.
- **Why the redirect never happens**: `Login.tsx`'s `handleSubmit` does
  `if (result.error) { toast(...); return; }` before ever calling
  `navigate("/")`. A 429 makes `signUp.email()` resolve with `result.error`
  set, so the page never leaves `/login` — this is a genuinely stuck state,
  not a slow one, matching the CI symptom exactly (Playwright's own repeated
  polling never found a different URL, because nothing was ever going to
  change it).
- **Rate-limit key**: IP address — `express-rate-limit`'s own default
  (`middlewares/rateLimit.ts` sets no custom `keyGenerator`). **Parallel
  Playwright workers/specs share this bucket**: every worker/spec in one
  suite run is a separate browser context, but all originate from the same
  machine (`127.0.0.1`) against one long-lived `api-server` process, so they
  share one IP and therefore one bucket. **Limiter state persists across the
  whole run**: `express-rate-limit`'s in-memory store lives for the
  server process's lifetime, so traffic accumulates across every spec and
  every retry within the same 60-second sliding window, not per-spec.
- **Thresholds/window**: `AUTH_RATE_LIMIT_MAX_REQUESTS` default 20,
  `RATE_LIMIT_MAX_REQUESTS` default 300, both per `RATE_LIMIT_WINDOW_MS`
  default 60,000ms.
- **Measured legitimate peak** (direct repro against a real server, one
  full E2E suite run): 303 general API requests and 21 `/api/auth/*`
  requests inside a single 60-second window — both at or over the
  production defaults, purely from this suite's own legitimate traffic.

**Why the production implementation was already correct**: IP-keyed rate
limiting with a 300/20-per-60s threshold is the right, standard design for
a real deployment, where each real user genuinely has their own IP. The
failure only exists in the single-process, single-machine Playwright
environment, where many independent *simulated* users share one IP by
construction of the test topology — not a defect in the rate limiter, but a
mismatch between the limiter's real-world assumption (one IP ≈ one client)
and this specific test topology (one IP ≈ many concurrently-simulated
clients).

## Why the fix is configuration-only, not behavioural

`middlewares/rateLimit.ts` was not modified — confirmed via
`git diff --stat`, zero-line diff against `origin/main`. The production
rate-limiting *algorithm* (IP-keyed, `express-rate-limit`'s own default
keying, the same 300/20-per-60s thresholds) is unchanged for every real
deployment, regardless of `NODE_ENV`.

The fix uses the *already-existing*, *already-documented*
`RATE_LIMIT_MAX_REQUESTS`/`AUTH_RATE_LIMIT_MAX_REQUESTS` environment-variable
overrides — the exact mechanism `middlewares/rateLimit.ts`'s own header
comment (Phase 4, Sprint 52) names as the intended way for "a real
production deployment [to] retune them" once real traffic data justifies
it. This fix uses that same mechanism for the mirror-image, equally
legitimate case: a same-machine, multi-simulated-user *test* topology
retuning the thresholds for its own real, measured, legitimate traffic
pattern.

The override is set in exactly one place: `artifacts/e2e/playwright.config.ts`'s
own `webServer[0].env` block, which only ever applies to the specific
`api-server` child process Playwright itself starts and manages for the
E2E run. No production deployment sources this file. With the env vars
unset — the state of every real deployment, always — the server falls
straight back to the unmodified defaults (300/20), still fully enforced,
still IP-keyed, byte-identical to today's behaviour.

New values: `RATE_LIMIT_MAX_REQUESTS=3000`, `AUTH_RATE_LIMIT_MAX_REQUESTS=300`
— roughly 10x headroom over the measured peaks (303 and 21 respectively),
matching Sprint 52's own "measured baseline, not a guess" convention for
these same two variables.

## Validation

- **10 total full E2E suite runs** (3 fresh-build `CI=true` runs matching
  GitHub Actions exactly, plus 7 additional runs reusing the same built
  servers): **0/10 runs showed any HTTP 429 response, and 0/10 runs showed
  a test stuck on `/login`.**
- A small number of unrelated, pre-existing, already-disclosed flakes
  occurred across those 10 runs (a `getSettingsRow()`-category timing issue
  documented in this repository since an earlier sprint) — confirmed
  unrelated by the complete absence of any 429 or `/login`-stuck symptom in
  every one of those failures, and by this fix touching only
  `playwright.config.ts`, which cannot affect that code path.
- Backend test suite: run twice against a fresh database. Two pre-existing,
  already-disclosed, unrelated failures reproduced consistently — both
  expected on this branch (based on `origin/main`, pre-dating both PR #48's
  and PR #49's own separate fixes for these exact issues) and orthogonal to
  this change.
- Frontend test suite: 184/184 files, 2351/2351 tests, clean.
- Root TypeScript typecheck: clean, 0 errors.
- Production build (`PORT=5000 BASE_PATH=/ pnpm run build`): all packages
  built successfully.

## Files changed

- `artifacts/e2e/playwright.config.ts` — additive only, 28 lines added, 0
  removed.
- `docs/E2E-Rate-Limit-Fix.md` — this file.

No test assertions were weakened. No authentication security control was
removed, relaxed, or bypassed. No arbitrary timeout was increased.

# Phase 9 — Security Review

Companion to `docs/Phase-9-Production-Readiness-Report.md`. This is a self-review performed by the same session that made the changes it describes — it is **not** a substitute for an independent, formal security audit, and this report says so explicitly rather than implying otherwise.

---

## 1. What was fixed this phase

| Finding | Severity | Fix | File |
|---|---|---|---|
| No security-related response headers at all | Medium | New dependency-free middleware setting `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-DNS-Prefetch-Control: off`, and conditional `Strict-Transport-Security` (only over a genuinely secure/TLS-terminated connection, or explicit opt-in via `FORCE_HSTS=true`) | `middlewares/securityHeaders.ts` (new), mounted first in `app.ts` |
| Unhandled route errors could leak stack traces / internal detail to the client | Medium | New global Express error-handling middleware, mounted last: logs the real error server-side via the existing structured pino logger, returns only a generic `{"error": "Internal server error"}` to the caller | `app.ts` |
| An uncaught exception or unhandled promise rejection outside any request handler could crash the process silently, with no log line, or leave it running in a corrupted state | Low–Medium (availability, not confidentiality) | New `process.on("uncaughtException")`/`process.on("unhandledRejection")` handlers in the real server entrypoint — log via the same structured logger, then exit cleanly so a process manager can restart a fresh instance | `index.ts` |

Why "dependency-free" for the headers middleware, specifically: every header set is a single, static, well-understood string with no per-request computation and no meaningful configuration surface — not enough to justify a new third-party dependency (`helmet`) and its associated supply-chain surface, for a codebase that has otherwise been deliberate about its dependency footprint.

---

## 2. Findings investigated and deliberately NOT fixed this phase (with reasons)

| Finding | Severity | Why not fixed now |
|---|---|---|
| `REQUIRE_AUTH` defaults to unset (auth not mandatory) | High (context-dependent) | This is a documented, intentional rollback-safe default from an earlier sprint — every route already falls back to a legacy-owner stand-in when no session exists. Flipping the default is a **deployment decision**, not a code defect: a genuinely single-tenant deployment may correctly want this off. Recommendation: any real multi-user deployment must set `REQUIRE_AUTH=true` and verify sign-in end-to-end first. This is now called out explicitly in the Production Readiness Report and the Deployment Checklist so it can't be missed |
| `alpacaApiKey` returned in plaintext by `GET`/`PATCH /settings` | Medium | A real fix (mask-on-read, write-only-on-change) changes the settings API's response shape, which `Settings.tsx`'s own broker-connection edit form currently depends on. Rushing this during a broad hardening pass risked a real regression to a working feature. Documented as technical debt for a dedicated, small follow-up sprint |
| No Content-Security-Policy | Medium | A CSP is only meaningful (and only safe to ship) once every legitimate script/style/connect-src origin the frontend actually uses has been enumerated. Writing one from a guess would either break the app or provide no real protection. Not attempted this phase — flagged as real, open work |
| No formal external penetration test / security audit | — | Out of scope for a single self-directed hardening phase. This document is explicitly not a substitute |

---

## 3. Pre-existing security posture, unaffected by this phase (verified still in place, not modified)

These were not touched this phase but were checked to confirm they still function as intended after Phase 9's other changes:

- **Authentication** — Better-Auth session-based auth, unaffected. Login/logout tested via the frontend test suite (`Login.test.tsx`, part of the 596 passing frontend tests).
- **Tenant isolation** — every business route scopes its queries via `getScopedUserId(req)`; unaffected by Phase 9's changes. No route file's ownership-scoping logic was modified this phase.
- **Rate limiting** — `middlewares/rateLimit.ts`'s general and auth-specific limiters, unaffected. Confirmed still correctly mounted (general limiter across `/api`, auth limiter scoped specifically to `/api/auth`) by reading the current `app.ts` after Phase 9's own edits to that same file.
- **CORS** — `CORS_ALLOWED_ORIGINS`-driven allow-list mechanism, unaffected; still defaults to fully open when unset (documented, pre-existing behavior, not something Phase 9 changed).
- **Redaction in logs** — pino's own `redact` config (`req.headers.authorization`, `req.headers.cookie`, `res.headers['set-cookie']`) is unaffected; the new global error middleware logs via the same `logger` instance, so the same redaction rules apply to its output too — verified by reading `lib/logger.ts`.
- **Password/credential handling** — Better-Auth's own credential storage, unaffected; Phase 9 touched no auth-related file beyond the two audit-adjacent middleware wirings listed above.

---

## 4. Supply-chain note

Zero new npm dependencies were added this phase. The one place a dependency might have been reached for (security headers) was deliberately hand-written instead — see §1.

---

## 5. Recommendation

Treat this report as a starting checklist for a real, independent security review before any live-money or live-broker cutover — not as a completed audit. The highest-priority open item for that future review is the `REQUIRE_AUTH` default and the `alpacaApiKey` plaintext-echo finding, both flagged above as deliberately deferred rather than silently accepted.

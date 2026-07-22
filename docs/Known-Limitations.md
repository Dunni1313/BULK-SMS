# Known Limitations (v1.0.0)

Every item here is a deliberate, disclosed scope boundary or deferral —
never a silently-hidden gap. Consistent with this project's own unbroken
disclosure discipline, each item states what it is, why it's this way, and
what would need to change to close it.

## 1. Live market-data providers are wired but unverified

`fundamentals.ts` (Engine 1) supports FMP and Alpha Vantage as live
providers; `tradingMarketData.ts` (Engine 2) and the broker integration
(Engine 3) support live credentials too. **No API keys or broker
credentials are configured in this environment**, and none was available
at any point across this project's build history. Every engine runs fully
functional in SIMULATED mode (deterministic, seeded, honestly labeled
`dataSource: "SIMULATED"` on every response) — this is not a stub or a
placeholder, it is a genuine, tested, complete data path — but end-to-end
verification against real live providers has never been performed. Live
verification is a pure credential-driven pass over already-built,
already-tested provider code with no new logic required, per this
project's own established precedent for exactly this kind of blocked item.

## 2. Options income live broker verification is unverified

Same shape as above, specific to the Options Income Engine's broker
integration (Alpaca) — the code exists and is tested, but has never been
exercised against real broker credentials in this environment.

## 3. Notification delivery is in-app only

Alerts (watchlist target crossings, risk cap breaches, and more) are
delivered to an in-app notification center only. Email and push delivery
were deliberately not built — this session has no real SMTP/push
credentials or infrastructure to build or verify either channel end-to-end,
and shipping unverified delivery code would be worse than not shipping it.

## 4. No formal, independent security audit

Every security review referenced in this repository (`docs/Phase-9-Security-Review.md`,
`docs/RC1-Security-Review.md`) is a **self-review** performed by the same
development thread that made the changes it describes. Neither is a
substitute for an independent, formal penetration test or security audit,
and both say so explicitly. A dedicated external review is recommended
before any deployment handling real financial data at scale.

## 5. No Content-Security-Policy header

A real CSP needs a genuine inventory of every legitimate script/style/
connect-src origin the frontend actually talks to — guessing one either
breaks the app (too strict) or provides no real protection (too loose).
Deferred, not silently skipped; carried forward unchanged from
`Phase-9-Technical-Debt-Report.md`.

## 6. Frontend main bundle chunk exceeds the 500 kB advisory threshold

559.61 kB as of this release (see `docs/RC1-Performance-Review.md`).
Code-splitting and lazy-loading are already fully adopted (86 lazy imports
covering all 74 pages); further reduction would require a genuinely new
`manualChunks` vendor-splitting strategy, which carries real regression
risk for a benefit this hardening-only release doesn't justify pursuing
without its own dedicated, validated effort.

## 7. Two pages predate the platform's `Card`-based UI convention

`Dashboard.tsx` and `PortfolioAI.tsx` (the original Options Income
Engine's own oldest pages) do not use the shared `Card` component other
pages use — cosmetic only, not a functional gap. Not retrofitted this
release, for the same reason Phase 9 declined to: rewriting a working,
already-tested page purely for visual consistency carries real regression
risk. See `docs/RC1-UI-UX-Review.md`.

## 8. No containerized deployment artifact

There is no `Dockerfile`/`docker-compose.yml` in this repository. The
platform has, in practice, been deployed as a plain Node.js process (this
repository's `.env.example` includes a `REPL_ID` variable reflecting
Replit Autoscale as one real deployment target). A container image is a
reasonable future addition but was not fabricated for this release without
a real deployment target to validate it against.

## 9. `REQUIRE_AUTH` defaults off

Every request resolves to a single legacy-owner account when this env var
is unset — a deliberate, rollback-safe default carried since Phase 1,
Sprint 5/7 of this project's history, not a defect. Must be explicitly set
to `true` (with `CORS_ALLOWED_ORIGINS` also configured) before any real
multi-user deployment. See `docs/Admin-Guide.md`.

## 10. `artifacts/mockup-sandbox` is not part of the shipped application

A design/prototyping sandbox, typechecked and built alongside the rest of
the monorepo but never wired into the production application. Documented
in its own `README.md`, kept for now as an active design tool.

## 11. `ravish-trading-engine.zip` at the repository root

A full point-in-time monorepo backup archive, confirmed redundant with git
history and unreferenced by any build/CI/doc. Kept, not deleted, per an
explicit prior decision to treat it as an intentional archival backup —
revisit its removal after a future release if confirmed no longer needed.

## 12. End-to-end (browser-level) test coverage is a smoke-level subset

Playwright E2E tests exist and cover representative flows across all
three engines and cross-engine surfaces, but do not exhaustively cover
every one of the platform's 74 pages — the primary correctness guarantee
for the long tail of pages is the 336 backend + frontend unit/integration
test files, not full browser-level E2E coverage of every page.

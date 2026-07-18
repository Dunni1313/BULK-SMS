# Live Market Validation

**Phase 11 — Live Market Operations & Production Validation.** This document covers the market-data validation work this phase added: a US market calendar/clock (`lib/marketCalendar.ts`), and a cross-provider live market data validation report (`lib/liveMarketValidation.ts`), exposed to administrators via `GET /ops/market-data-validation` and the Operations Dashboard.

**Scope discipline, stated up front:** per this phase's own "do NOT rewrite existing analytics, reuse everything already built" instruction, this work is a *consolidation* layer over provider-status systems that already existed — it introduces exactly two genuinely new pieces of logic (the market calendar/clock, and the staleness/missing-data thresholds) and reuses every other signal unmodified.

---

## 1. The three market-data provider systems this platform already has

Direct inspection at the start of this phase found this platform has **three separate, independently-selected provider systems**, one per engine — this was true before this phase and remains true after it; nothing was merged:

| System | File | Providers | Own status surface |
|---|---|---|---|
| Options Engine (original platform) | `lib/providers/index.ts`, `selectProvider()` | Alpaca (options chain), Polygon (`polygonProvider.ts` — a genuine, honest placeholder: `isAvailable()` always `false`, never fabricates a chain), Mock | `GET /market-data/health` (pre-existing) |
| Engine 1 — Investing | `lib/fundamentals.ts`, `getFundamentalsProvider()` | FMP, Alpha Vantage, Simulated | `GET /fundamentals/provider-status` (pre-existing, `getFundamentalsProviderStatuses()`) — already tracks `not_configured`/`rate_limited`/`unreachable`/`no_data`/`ok`/`idle` per provider with real `lastSuccessAt`/`lastFallbackAt` timestamps |
| Engine 2 — Trading | `lib/tradingMarketData.ts`, `getMarketDataProvider()` | Simulated only — a live provider is explicitly deferred (Phase 3 plan §25 Decision 7), never fabricated | none needed — always Simulated today |

**None of these were rebuilt.** `lib/liveMarketValidation.ts`'s `buildLiveMarketValidationReport()` calls all three of the above, unmodified, and combines their outputs into one report.

## 2. Market Calendar & Clock (`lib/marketCalendar.ts`) — genuinely new

No trading-calendar, market-holiday, or timezone awareness existed anywhere in this codebase before this phase. Two sources, in explicit priority order — the same live-with-fallback discipline every provider in this codebase already follows:

1. **Alpaca's own `/v2/clock` and `/v2/calendar`** (`getAlpacaMarketClock()`/`getAlpacaMarketCalendar()`, added to the existing `lib/providers/alpacaBroker.ts` rather than a new file, since they're the same Trading API family as the account/positions/orders calls already there) — live, authoritative, used whenever Alpaca credentials are configured and reachable.
2. **A static, deterministic approximation** — the 10 standard NYSE/Nasdaq full-day holidays, computed by formula for the requested year (nth-weekday-of-month rules, the Anonymous Gregorian algorithm for Good Friday, and the standard Saturday→Friday/Sunday→Monday weekend-observed shift for the 4 fixed-date holidays) rather than a hardcoded literal-date table that would silently go stale — plus standard 9:30am–4:00pm America/New_York weekday hours. Verified against hand-checked 2026 dates (`marketCalendar.test.ts`).

Every result carries an honest `source: "alpaca" | "static_approximation"` field — the static path is never presented as live.

**Disclosed limitation of the static approximation:** it does not know about an early-close half-day (the day after Thanksgiving, Christmas Eve) or an exchange-declared unscheduled closure — only Alpaca's own live `/v2/calendar` captures those. This is a real, accepted gap, not a bug, and it only matters on the handful of days per year it applies to.

**Live verification is explicitly deferred** — no `ALPACA_API_KEY`/`ALPACA_API_SECRET` exist in this session (confirmed by direct inspection of `process.env` and every `.env*` file, the same check performed at every prior credential-gated sprint in this project's history). `getAlpacaMarketClock()`/`getAlpacaMarketCalendar()` are covered only by mocked-fetch tests.

## 3. Cross-provider validation report (`lib/liveMarketValidation.ts`)

`buildLiveMarketValidationReport(userId, optionsSettings, fundamentalsSettings)` returns:

- `marketClock` — from §2 above.
- `optionsEngine` — one `MarketDataSourceStatus` from `selectProvider()`'s own result.
- `investingEngine[]` — one `MarketDataSourceStatus` per FMP/Alpha Vantage entry from `getFundamentalsProviderStatuses()`.
- `tradingEngine` — one `MarketDataSourceStatus` from `getMarketDataProvider()`.
- `conflictingProviderDetection` — see §5.
- `overallStale`/`overallMissingData` — `true` if any source flags either.

### Staleness

A provider is flagged `stale` only when **it is the currently-selected provider** AND has a known `lastSuccessAt` older than 15 minutes (`STALE_THRESHOLD_MINUTES`) AND **the market is currently open** (via the Market Clock). The same staleness figure is never flagged outside market hours — an identical "last successful fetch 3 hours ago" reading is unremarkable at 2am and genuinely stale at 11am on a trading day. Verified in `liveMarketValidation.test.ts` with the system clock frozen to a real Saturday.

### Missing data

Flagged when a provider has a configured API key (or the options engine explicitly requested a live provider) but its own status reports a failure state (`rate_limited`/`unreachable`/`no_data`, or "requested a live provider but got Mock back").

## 4. Live market data validation audit — what was checked, and what's honestly deferred

Per the phase's own request to audit price accuracy, option chain accuracy, Greeks consistency, corporate actions, splits, dividends, earnings, trading calendar, time zones, and market holidays:

| Item | Finding |
|---|---|
| Trading calendar / market holidays | **Built this phase** — §2 above. |
| Time zones | **Built this phase** — all clock computations are explicitly `America/New_York`-aware via `Intl.DateTimeFormat`, no new dependency. |
| Price accuracy, option chain accuracy, Greeks consistency | **Cannot be verified live** — no live credentials exist for any provider in this session (FMP, Alpha Vantage, Alpaca, Polygon). Every SIMULATED path's own internal consistency (e.g. Greeks computed from the same deterministic pricing model that generated the quote) was already proven by each engine's own existing test suite across Phases 1–6; that is unchanged and unaffected by this phase. Live-vs-real-market accuracy verification remains an open item, tracked as Sprint 75/76-equivalent work, pending credentials. |
| Corporate actions, splits, dividends | **Not modeled anywhere in this codebase**, live or simulated — a genuine, disclosed gap. `Fundamentals`'s own dividend-per-share field is a snapshot value, not a corporate-actions feed; there is no split-adjustment logic anywhere. Adding this is out of scope for a validation phase and would be new functionality. |
| Earnings | Already covered by Engine 1's Earnings Intelligence Engine (Phase 2) and Engine 1/2's own event-risk overlays — unmodified by this phase. |

## 5. Detect conflicting providers — an honest architectural finding, not a bug

The phase's own instruction asks to "detect conflicting providers." Direct inspection found this does not apply to this platform's design: **each engine selects and queries exactly one active provider at a time** (via a `settings` column — `marketDataProvider`, `fundamentalsProvider`, `tradingDataProvider`), never two live sources concurrently for the same data. There is no second reading to conflict with the first, so there is nothing to detect. `conflictingProviderDetection.applicable` is always `false`, with the reason stated in the field itself, verified by test. Building genuine multi-source consensus (e.g., polling both FMP and Alpha Vantage for the same symbol and flagging a >X% divergence) would be a real, new capability requiring a different architecture — noted as a candidate for a future phase, not attempted here.

## 6. Access

`GET /ops/market-data-validation` — administrator-only (`requireAdmin`), surfaced on the Operations Dashboard. See `docs/Operations-Runbook.md` for the admin-promotion procedure.

## Cross-references

- `docs/Broker-Reconciliation.md` — the broker-side (not market-data-side) validation this phase also added.
- `docs/Operations-Runbook.md` — the Operations Dashboard itself, and background-job/security review.
- `docs/Alpaca-Paper-Trading-Architecture.md` — the existing Alpaca integration this phase's `getAlpacaMarketClock()`/`getAlpacaMarketCalendar()` additions extend.

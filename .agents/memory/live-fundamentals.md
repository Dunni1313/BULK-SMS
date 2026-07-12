---
name: Live fundamentals provider seam
description: How the value-investing module sources real vs simulated fundamentals, and the honesty invariants that must hold.
---

# Live fundamentals provider

The value-investing module fetches company fundamentals through a provider seam
(`FundamentalsProvider`) so live data and simulated data share one code path.

- Live providers: Financial Modeling Prep (`FMP_API_KEY`) and Alpha Vantage
  (`ALPHA_VANTAGE_API_KEY`). Provider choice comes from Settings
  `fundamentalsProvider`; the live provider is only selected when that provider's
  matching env key is present.
- `getFundamentalsProvider()` is async and short-circuits to the simulated
  provider with NO DB read when no live key is set (keeps unit tests DB-free and
  the default safe).

## Honesty invariants (do not break)

- **Never show simulated numbers under a LIVE label.** `resolveFundamentals()`
  only labels data LIVE when a live provider actually returned it. On any live
  error / empty result it falls back to the simulated provider, whose data is
  correctly labelled SIMULATED. The report's `dataSource`/`simulated` flags drive
  the UI badge (LIVE = green, SIMULATED = amber).
- **Fair value stays honest.** When intrinsic value can't be computed it is
  reported UNAVAILABLE — never fabricated — regardless of data source.
- **`fundamentalsConnected` is computed, not stored.** The settings route
  overrides it via `fundamentalsConnectionStatus(settings).connected` (selected
  provider ≠ simulated AND its key present) on both GET and PATCH, so a stale DB
  value can never claim a connection that isn't real.
- **Freshness is only meaningful for LIVE data.** Every datum carries
  `fetchedAt` (ISO), but for SIMULATED it's just process time, so the UI shows
  the "Fetched X ago" relative-time label ONLY when `!simulated`. LIVE providers
  preserve `fetchedAt` across the 15-min cache (set at fetch, not request time),
  so it reflects true data age. A force-refresh passes `FetchOpts{forceRefresh}`
  which skips the cache READ but still writes it.
- **Fallback carries a typed reason for honest degradation messaging.** When a
  live fetch fails/empties, `resolveFundamentals` attaches
  `fallback{attemptedProvider,reason,message}` to the simulated result. `reason`
  is `rate_limit` (err message matches `/limit/i`), `error`, or `no_data`; the UI
  shows an amber banner so a rate-limited fallback is never silent.
- **Provider status is observability-only and in-process.** An in-memory
  `providerActivity` map (`recordProviderSuccess`/`recordProviderFallback`, wired
  into `resolveFundamentals`) tracks the most recent success/fallback per live
  provider. `getFundamentalsProviderStatuses(settings)` derives a per-provider
  state — `ok` / `rate_limited` (temporary, self-recovers) / `unreachable`
  (missing/invalid key or outage) / `no_data` / `not_configured` / `idle` — and
  must keep "rate-limited (will recover)" messaging distinct from
  "misconfigured / unreachable". It resets on restart (like the live cache) and
  NEVER mutates returned fundamentals. Exposed at `GET /fundamentals/provider-status`,
  surfaced on the Settings "Live Provider Status" card (60s auto-refresh).

## Auto-refresh of stale live data

- Stale LIVE fundamentals can auto-refresh (toggle `fundamentalsAutoRefresh`,
  default ON). The watcher lives **client-side** in `StockResearch.tsx`, not on the
  server — it reuses the existing `forceRefresh` universe path.
- It must never spam the provider: gated to LIVE only (simulated has no freshness
  concept → no live rows → not stale → never fires), and throttled by THREE layers —
  a per-`fetchedAt`-batch guard (don't re-fetch the same data), a wall-clock cooldown
  floor, and the server's 15-min live cache. A rate-limited refresh falls back to
  simulated rows (no live rows) which self-terminates the loop.
- **How to apply:** keep auto-refresh client-side and keep all three throttles; if you
  move it server-side or add an interval, re-verify it can't loop on a persistently
  stale/rate-limited provider.

**Why:** the task was to wire real fundamentals while keeping the SIMULATED
labelling truthful — users must always be able to trust whether a number is real.

**How to apply:** if you add a new live provider or narration path, route data
through `resolveFundamentals` (so the fallback + labelling holds) and keep the
disclaimer split (`VALUE_DISCLAIMER` vs `LIVE_VALUE_DISCLAIMER`) keyed off
`dataSource`. `buildValueResearchReport` is async — all callers must await it.

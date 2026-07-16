# Broker Health API — Alpaca Paper Trading (Read-Only)

This document covers the read-only Alpaca Paper Trading account-verification
capability added as the follow-up milestone to the Alpaca Integration
Readiness Review (post-Sprint-77). It is **read-only** end to end: it never
places, modifies, or cancels an order, and it never introduces a live-trading
endpoint. It exists to let an operator (or the Settings page) confirm that
this platform's configured Alpaca credentials actually authenticate against a
real Alpaca Paper Trading account before relying on the existing order-
submission path (`execution.ts`), which is untouched by this work.

## 1. What was added

| Layer | New surface |
|---|---|
| Provider | `artifacts/api-server/src/lib/providers/alpacaBroker.ts` — `getAlpacaAccount()`, `getAlpacaPositions()`, `getAlpacaOrders()`, `checkAlpacaBrokerHealth()` |
| Route | `GET /api/broker/health` (`routes/brokerHealth.ts`) |
| Settings | `GET /api/settings`'s `alpacaConnected` field is now computed from the most recent broker-health check, not a static stored value |
| OpenAPI | `BrokerHealth` schema, `getBrokerHealth` operation, `broker` tag |

Nothing under `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
or `autoAdjustment.ts` was touched. The hardcoded order-submission endpoint
(`https://paper-api.alpaca.markets/v2/orders` in `execution.ts`) is unchanged
and untouched by this work.

## 2. Endpoints

### `GET /v2/account`, `GET /v2/positions`, `GET /v2/orders?status=open`

These are Alpaca's own real, documented endpoints, called against the
**hardcoded Paper Trading host** `https://paper-api.alpaca.markets` — the
exact same host `execution.ts`'s own `ALPACA_ORDERS_URL` already targets for
order submission. There is no live-trading host anywhere in this module, and
no configuration switch selects one; the constant is a plain string literal.

Each is exposed as a standalone, provider-agnostic function in
`alpacaBroker.ts`:

```ts
getAlpacaAccount(settingsApiKey?): Promise<BrokerResult<AlpacaAccount>>
getAlpacaPositions(settingsApiKey?): Promise<BrokerResult<AlpacaPosition[]>>
getAlpacaOrders(settingsApiKey?): Promise<BrokerResult<AlpacaOrder[]>>
```

`BrokerResult<T>` is a discriminated union:

```ts
type BrokerResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "no_credentials" | "unauthorized" | "http_error" | "network_error"; status?: number; message: string };
```

Alpaca returns its numeric account/position/order fields (buying power, cash,
quantities, prices, …) **as strings** — a well-documented Alpaca quirk. This
module parses them to real numbers at the boundary (`parseFloat`), so every
caller downstream works with actual numbers, never a string that happens to
look numeric.

These functions were deliberately **not** added as methods on the existing
`AlpacaOptionsProvider` class (`alpacaProvider.ts`). That class implements the
shared `OptionsProvider` interface, which `MockOptionsProvider` and
`PolygonOptionsProvider` also implement — those providers have no concept of
a broker account, so adding account/position/order methods there would be a
design mismatch. `alpacaBroker.ts` is a standalone sibling module instead,
reusing `alpacaProvider.ts`'s own `readAlpacaCreds()` so both modules resolve
credentials identically.

### `GET /api/broker/health`

The one new HTTP endpoint. A thin route handler — it resolves the calling
user's settings (for their stored `alpacaApiKey`, if any) and delegates
entirely to `checkAlpacaBrokerHealth()`. No request body, no query
parameters, ownership-scoped the same way every other route in this codebase
is (`getScopedUserId(req)` — a real session wins, else the legacy-owner
stand-in when `REQUIRE_AUTH` is off).

Response shape (`BrokerHealth`):

```jsonc
{
  "connected": false,
  "authenticationSuccessful": false,
  "accountStatus": null,
  "buyingPower": null,
  "cashBalance": null,
  "portfolioValue": null,
  "openPositionsCount": null,
  "openOrdersCount": null,
  "lastSuccessfulCheckAt": null,
  "reason": "No Alpaca credentials configured",
  "checkedAt": "2026-07-16T09:23:00.000Z"
}
```

On a genuine, authenticated success:

```jsonc
{
  "connected": true,
  "authenticationSuccessful": true,
  "accountStatus": "ACTIVE",
  "buyingPower": 200000.50,
  "cashBalance": 100000.25,
  "portfolioValue": 150000.75,
  "openPositionsCount": 3,
  "openOrdersCount": 1,
  "lastSuccessfulCheckAt": "2026-07-16T09:23:00.000Z",
  "reason": "Connected — Alpaca Paper Trading account authenticated successfully",
  "checkedAt": "2026-07-16T09:23:00.000Z"
}
```

Every numeric/count field is **honestly `null`**, never a fabricated `0` or
guessed value, whenever it wasn't actually resolved from a real Alpaca
response this call.

## 3. Connection flow

1. A caller (the Settings page, or an operator via `curl`/Postman) issues
   `GET /api/broker/health`.
2. The route resolves the calling user's `settings.alpacaApiKey` (their
   stored key, if they set one via `PATCH /api/settings`).
3. `checkAlpacaBrokerHealth()` resolves actual credentials via
   `readAlpacaCreds()`: the `ALPACA_API_KEY` environment variable wins if
   set, otherwise falls back to the settings-stored key. The secret always
   comes **only** from `ALPACA_API_SECRET` — there is no settings field for
   it, and none is ever stored in the database. This is the same
   credential-resolution rule `execution.ts`'s order-submission path already
   uses; this module does not introduce a second one.
4. If no key **and** secret pair is available, the check short-circuits —
   honestly reports "not connected, no credentials," and makes zero network
   calls.
5. If credentials are present, `GET /v2/account` is called first. Its outcome
   decides `connected`/`authenticationSuccessful` for the whole check:
   - **Success (2xx):** authentication is proven. `GET /v2/positions` and
     `GET /v2/orders?status=open` are then fetched in parallel purely for
     their counts.
   - **401/403:** reported as `unauthorized` — the credentials were rejected.
   - **Any other non-2xx status:** reported as `http_error`, carrying the
     real HTTP status.
   - **A thrown/network-level failure** (DNS, timeout, connection refused,
     …): reported as `network_error`.
6. If the account call succeeds but positions or orders individually fail
   (e.g. a transient hiccup right after authentication succeeded), that does
   **not** retroactively flip `connected`/`authenticationSuccessful` back to
   false — only the affected count (`openPositionsCount` or
   `openOrdersCount`) is honestly reported as `null`.

## 4. `lastSuccessfulCheckAt` and `alpacaConnected` — two distinct, deliberately separate pieces of state

`alpacaBroker.ts` keeps two small pieces of in-memory, process-local state
(mirroring the existing `getLastLiveFetch()` pattern in `fundamentals.ts`,
Phase 1):

- **`lastSuccessfulCheckAt`** (`getLastSuccessfulBrokerCheck()`) — the
  timestamp of the most recent check that actually authenticated
  successfully. A failed check **never** updates it, so a broken connection
  never appears "recently successful" just because it worked once earlier.
  This is the value surfaced in `BrokerHealth.lastSuccessfulCheckAt`.
- **`lastCheckConnected`** (`getLastBrokerCheckConnected()`) — the outcome of
  the **most recent** check, success or failure. This is what
  `GET /api/settings`'s `alpacaConnected` field now reflects.

These are deliberately not the same field. If a connection succeeds once and
then later fails, `lastSuccessfulCheckAt` correctly keeps the earlier
success's timestamp (an honest historical record — "the last time it did
work"), while `lastCheckConnected` — and therefore `alpacaConnected` in
`GET /api/settings` — correctly flips back to `false` (an honest current
statement — "it is not connected right now").

**Important operational implication:** `GET /api/settings` does **not**
itself trigger a live network call to Alpaca on every read — that would slow
down every settings-page load and needlessly consume Alpaca's own rate
limits. It only reads the passive, in-memory cache populated by whichever
call to `GET /api/broker/health` most recently ran. This means
`alpacaConnected` is honestly `false` until `GET /api/broker/health` has been
called at least once in the running process — there is no bootstrap health
check performed automatically at server startup. An operator or the frontend
must explicitly hit `/api/broker/health` (e.g. via a "Check Connection"
action) to populate it.

This cache is **process-local, in-memory, and not persisted** — it resets on
every server restart/deploy, exactly like `getLastLiveFetch()`'s own
long-established behavior for the fundamentals-provider freshness marker.

## 5. Failure handling — every branch, and what the caller sees

| Situation | `connected` | `authenticationSuccessful` | `reason` (example) | HTTP status of `/api/broker/health` |
|---|---|---|---|---|
| No `ALPACA_API_KEY`/`ALPACA_API_SECRET` (env) and no `settings.alpacaApiKey` | `false` | `false` | "No Alpaca credentials configured" | `200` |
| Credentials present, Alpaca returns `401`/`403` | `false` | `false` | "Alpaca rejected the configured credentials (authentication failed)" | `200` |
| Credentials present, Alpaca returns another non-2xx (e.g. `500`) | `false` | `false` | "Alpaca returned an error: Alpaca returned HTTP 500" | `200` |
| Credentials present, the request itself fails (DNS/timeout/connection refused) | `false` | `false` | "Could not reach Alpaca: <underlying error message>" | `200` |
| Account call succeeds, positions/orders call individually fails | `true` | `true` | "Connected — …" (the affected count is `null`) | `200` |
| Full success | `true` | `true` | "Connected — Alpaca Paper Trading account authenticated successfully" | `200` |

The route itself **always returns HTTP 200** for a well-formed request — a
broker-side or network-side failure is a legitimate, honestly-reported
*result* of the health check, not an error in this platform's own API. This
mirrors the existing `GET /api/market-data/health` endpoint's own contract
(`connected: false` with a `reason`, still `200`), which this new endpoint
was deliberately modeled after.

## 6. Authentication behaviour

- **Credential source is unchanged from the existing order-submission path**:
  key from `ALPACA_API_KEY` (env) first, then `settings.alpacaApiKey`;
  secret from `ALPACA_API_SECRET` (env) only, never stored in the database
  and never accepted via any settings field or request body. This module
  introduces no second credential-resolution rule.
- **No credential value is ever logged, cached, or returned in a response.**
  `checkAlpacaBrokerHealth()`'s cache stores only a boolean
  (`lastCheckConnected`) and an ISO timestamp (`lastSuccessfulCheckAt`) — it
  never stores the key, secret, or any part of Alpaca's raw response.
  Failure messages logged via `logger.error()` (`alpacaGet()`'s catch block)
  include only the request path and the underlying error message, never the
  credentials used to make the request.
- **A `401`/`403` from Alpaca is distinguished from every other failure
  mode** (`unauthorized` vs. `http_error` vs. `network_error`), so an
  operator can tell "the key/secret are wrong" apart from "Alpaca (or the
  network) is having a problem" at a glance.
- **This endpoint performs no write of any kind against Alpaca.** Every
  request it issues is a `GET`. There is no code path in `alpacaBroker.ts`
  that can place, modify, or cancel an order — that logic lives exclusively
  in `execution.ts`, which this work does not touch.

## 7. `GET /api/settings`'s `alpacaConnected` field — before and after

**Before this change:** `alpacaConnected` was a plain, stored `boolean`
column, hardcoded to `false` at row creation (`getOrCreateSettings()`) and
never updated by any code path afterward — a permanently stale placeholder.

**After this change:** every `GET`/`PATCH /api/settings` response computes
`alpacaConnected` fresh from `getLastBrokerCheckConnected() ?? false` — the
outcome of the most recent `GET /api/broker/health` check performed in the
current server process (see §4 above for why this is a passive cache read,
not a live call triggered by `/settings` itself). The underlying database
column is unchanged (still exists, still defaults to `false` at row
creation) but is no longer what the API actually serves — the same pattern
already established for `fundamentalsConnected` (Phase 1) and
`tradingDataConnected` (Phase 3, Sprint 32), both of which are likewise
computed, never client-settable, and not sourced from their own stored
column value. `alpacaConnected` was never present in `SettingsUpdate` (the
`PATCH` body schema) either before or after this change — it was already
architecturally intended to be system-computed, it simply hadn't been wired
up to reflect anything real until now.

## 8. What this milestone does *not* do (explicitly out of scope)

- **No order submission, modification, or cancellation.** Only `GET`
  requests are ever issued.
- **No live-trading endpoint.** The hardcoded host is
  `paper-api.alpaca.markets`; there is no configuration value, environment
  variable, or code path anywhere in this module (or in `execution.ts`) that
  can target `api.alpaca.markets` (the live host).
- **No position/order sync into this platform's own database.** The
  `open positions`/`open orders` counts returned by `/api/broker/health` are
  read live from Alpaca on every call and are not persisted anywhere —
  `execution.ts`'s own trade-tracking (the `trades` table) remains the
  system of record for trades this platform itself placed, and is untouched.
- **No automated/scheduled health check.** `checkAlpacaBrokerHealth()` only
  runs when `GET /api/broker/health` is actually called by a client; there is
  no background job, cron, or scheduler tick that calls it. (Compare to the
  automation scheduler's own 60-second tick in `autoExecution.ts`/
  `autoAdjustment.ts` — deliberately untouched and unrelated to this work.)

## 9. Verification performed this session

No real Alpaca credentials exist in this environment (`ALPACA_API_KEY`/
`ALPACA_API_SECRET` are both confirmed unset — the same standing gap
disclosed for every other credential-dependent milestone in `CLAUDE.md`,
e.g. Sprints 62/75/76). Verification in this session is therefore:

- **Unit tests** (`alpacaBroker.test.ts`, 17 cases) — full coverage of
  `getAlpacaAccount`/`getAlpacaPositions`/`getAlpacaOrders`'s success/
  `no_credentials`/`unauthorized`/`http_error`/`network_error` paths against
  **mocked** `fetch`, plus the orchestrator's caching behavior.
- **Live route tests** (`brokerHealth.route.test.ts`, 4 cases) — one
  genuinely live, unmocked case (this environment's real "no credentials"
  state), plus 3 cases that mock only the outbound call to Alpaca's own host
  while exercising the real HTTP route, real request/response validation,
  and the real `GET /api/settings` wiring end to end.

**A real Alpaca Paper account connection has not been verified live in this
session** — that requires the project owner to supply real
`ALPACA_API_KEY`/`ALPACA_API_SECRET` values. Once available, no further code
changes should be needed: set the two environment variables and call
`GET /api/broker/health` to confirm.
